import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import Template from "../models/Template.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for template uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const fs = await import("fs/promises");
      const uploadPath = path.join(
        __dirname,
        "..",
        "..",
        "uploads",
        "templates"
      );
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `template-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB for templates
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype =
      allowedTypes.test(file.mimetype) || file.mimetype === "image/svg+xml";

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for templates!"));
    }
  },
});

// Get all active templates
router.get("/", async (req, res) => {
  try {
    const { category, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    const query = { isActive: true };
    if (category && category !== "all") {
      query.category = category;
    }

    const templates = await Template.find(query)
      .populate("uploadedBy", "username")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ isDefault: -1, usageCount: -1, createdAt: -1 });

    const total = await Template.countDocuments(query);
    const categories = await Template.distinct("category", { isActive: true });

    res.json({
      templates,
      categories,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({ error: "Failed to retrieve templates" });
  }
});

// Get template categories (place before param routes)
router.get("/categories/list", async (req, res) => {
  try {
    const categories = await Template.distinct("category", { isActive: true });

    const categoryInfo = categories.map((category) => ({
      value: category,
      label: category.charAt(0).toUpperCase() + category.slice(1),
      count: 0, // Will be populated below
    }));

    // Get counts for each category
    for (const categoryInfo of categoryInfo) {
      categoryInfo.count = await Template.countDocuments({
        category: categoryInfo.value,
        isActive: true,
      });
    }

    res.json({ categories: categoryInfo });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to retrieve categories" });
  }
});

// Upload new template (admin only)
router.post(
  "/upload",
  authMiddleware,
  adminMiddleware,
  upload.single("template"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Template file is required" });
      }

      const {
        name,
        description,
        category = "custom",
        photoSlots = "[]",
        isDefault = false,
        layoutJson,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Template name is required" });
      }

      // Parse photo slots
      let parsedPhotoSlots;
      try {
        parsedPhotoSlots = JSON.parse(photoSlots);
        // If an object with frames is provided, map frames to slots
        if (!Array.isArray(parsedPhotoSlots) && parsedPhotoSlots?.frames) {
          parsedPhotoSlots = parsedPhotoSlots.frames;
        }
        if (!Array.isArray(parsedPhotoSlots)) {
          throw new Error("Photo slots must be an array");
        }
      } catch (parseError) {
        return res.status(400).json({
          error: "Invalid photo slots format. Must be a JSON array.",
        });
      }

      // Get image metadata
      const metadata = await sharp(req.file.path).metadata();

      // Generate thumbnail (preserve aspect; landscape-safe)
      const thumbnailFilename = `thumb-${req.file.filename}`;
      const thumbnailPath = path.join(
        path.dirname(req.file.path),
        thumbnailFilename
      );

      const thumbBase = sharp(req.file.path).resize(480, 480, {
        fit: "inside",
        withoutEnlargement: true,
      });
      if ((metadata.format || "").toLowerCase() === "png") {
        await thumbBase.png({ quality: 80 }).toFile(thumbnailPath);
      } else {
        await thumbBase.jpeg({ quality: 80 }).toFile(thumbnailPath);
      }

      // If this template is set as default, remove default from others
      if (isDefault === "true" || isDefault === true) {
        await Template.updateMany({ isDefault: true }, { isDefault: false });
      }

      const template = new Template({
        name,
        description,
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: `/uploads/templates/${req.file.filename}`.replace(/\\/g, "/"),
        thumbnailPath: `/uploads/templates/${thumbnailFilename}`.replace(
          /\\/g,
          "/"
        ),
        size: req.file.size,
        mimeType: req.file.mimetype,
        dimensions: {
          width: metadata.width,
          height: metadata.height,
        },
        photoSlots: parsedPhotoSlots,
        category,
        isDefault: isDefault === "true" || isDefault === true,
        uploadedBy: req.user.userId,
        metadata: {
          colorMode: metadata.space,
          format: metadata.format,
          dpi: metadata.density || 72,
          layoutJson: layoutJson || undefined,
        },
      });

      await template.save();

      res.status(201).json({
        message: "Template uploaded successfully",
        template,
      });
    } catch (error) {
      console.error("Template upload error:", error);

      // Clean up uploaded file on error
      if (req.file) {
        const fs = await import("fs/promises");
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.warn(
            "Could not clean up uploaded file:",
            cleanupError.message
          );
        }
      }

      res.status(500).json({
        error: "Failed to upload template",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Get template by ID (after explicit routes)
router.get("/:id", async (req, res) => {
  try {
    const template = await Template.findById(req.params.id).populate(
      "uploadedBy",
      "username"
    );

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ template });
  } catch (error) {
    console.error("Get template error:", error);
    res.status(500).json({ error: "Failed to retrieve template" });
  }
});

// Update template (admin only)
router.put("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, category, photoSlots, isActive, isDefault } =
      req.body;

    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Parse photo slots if provided
    let parsedPhotoSlots;
    if (photoSlots) {
      try {
        parsedPhotoSlots =
          typeof photoSlots === "string" ? JSON.parse(photoSlots) : photoSlots;

        if (!Array.isArray(parsedPhotoSlots)) {
          throw new Error("Photo slots must be an array");
        }
      } catch (parseError) {
        return res.status(400).json({
          error: "Invalid photo slots format. Must be a JSON array.",
        });
      }
    }

    // If this template is being set as default, remove default from others
    if (isDefault === true || isDefault === "true") {
      await Template.updateMany(
        { _id: { $ne: req.params.id }, isDefault: true },
        { isDefault: false }
      );
    }

    // Update template
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (parsedPhotoSlots !== undefined)
      updateData.photoSlots = parsedPhotoSlots;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const updatedTemplate = await Template.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate("uploadedBy", "username");

    res.json({
      message: "Template updated successfully",
      template: updatedTemplate,
    });
  } catch (error) {
    console.error("Template update error:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// Delete template (admin only)
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Delete the files
    const fs = await import("fs/promises");
    const templatePath = path.join(
      __dirname,
      "..",
      "..",
      template.path.replace(/^[/\\]+/, "")
    );

    try {
      await fs.unlink(templatePath);

      if (template.thumbnailPath) {
        const thumbnailPath = path.join(
          __dirname,
          "..",
          "..",
          template.thumbnailPath.replace(/^[/\\]+/, "")
        );
        await fs.unlink(thumbnailPath);
      }
    } catch (fileError) {
      console.warn("Could not delete template files:", fileError.message);
    }

    // Delete from database
    await Template.findByIdAndDelete(req.params.id);

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Delete template error:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// Increment template usage count
router.post("/:id/use", async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    await template.incrementUsage();

    res.json({
      message: "Template usage recorded",
      usageCount: template.usageCount,
    });
  } catch (error) {
    console.error("Template usage error:", error);
    res.status(500).json({ error: "Failed to record template usage" });
  }
});

// (moved categories route above)

export default router;

// Dev-only: seed a default template to get started quickly
if (process.env.NODE_ENV !== "production") {
  router.post(
    "/seed/default",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
      try {
        // Ensure upload directory exists
        const fs = await import("fs/promises");
        const templatesDir = path.join(__dirname, "../../uploads/templates");
        await fs.mkdir(templatesDir, { recursive: true });

        // Define a 4x6 inch canvas at ~300 DPI (portrait)
        // 4in x 6in => 1200px x 1800px
        const width = 1200; // px (~4 inches at 300dpi)
        const height = 1800; // px (~6 inches at 300dpi)
        const background = { r: 255, g: 255, b: 255, alpha: 1 };

        // Build a blank image
        const base = sharp({
          create: { width, height, channels: 3, background },
        }).jpeg({ quality: 92 });

        // Save template image
        const filename = `template-seed-${Date.now()}.jpg`;
        const fullPath = path.join(templatesDir, filename);
        await base.toFile(fullPath);

        // Create thumbnail
        const thumbName = `thumb-${filename}`;
        const thumbPath = path.join(templatesDir, thumbName);
        await sharp(fullPath)
          .resize(300, 400, { fit: "cover" })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);

        // Define 4 vertical slots with padding (designed for 4x6 portrait)
        const pad = 60; // px padding around
        const gap = 40; // gap between slots
        const slotsCount = 4;
        const slotWidth = width - pad * 2; // 1080
        const totalGaps = gap * (slotsCount - 1);
        const availableHeight = height - pad * 2 - totalGaps;
        const slotHeight = Math.floor(availableHeight / slotsCount);

        const photoSlots = Array.from({ length: slotsCount }, (_, i) => ({
          x: pad,
          y: pad + i * (slotHeight + gap),
          width: slotWidth,
          height: slotHeight,
          rotation: 0,
          borderRadius: 0,
        }));

        // Create template document
        const template = new Template({
          name: "Classic 4x Vertical - 4x6in (Seed)",
          description:
            "Default 4x6 inch photostrip template with 4 vertical slots",
          filename,
          originalName: filename,
          path: `/uploads/templates/${filename}`,
          thumbnailPath: `/uploads/templates/${thumbName}`,
          size: (await fs.stat(fullPath)).size,
          mimeType: "image/jpeg",
          dimensions: { width, height },
          photoSlots,
          category: "classic",
          isActive: true,
          isDefault: true,
          uploadedBy: req.user.userId,
          metadata: { colorMode: "rgb", dpi: 72, format: "jpeg" },
        });

        await Template.updateMany({ isDefault: true }, { isDefault: false });
        await template.save();

        return res.status(201).json({
          message: "Default template seeded",
          template,
        });
      } catch (error) {
        console.error("Seed template error:", error);
        return res
          .status(500)
          .json({ error: "Failed to seed default template" });
      }
    }
  );
}
