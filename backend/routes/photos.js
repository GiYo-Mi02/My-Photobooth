import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import Photo from "../models/Photo.js";
import Session from "../models/Session.js";
import { authMiddleware } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const fs = await import("fs/promises");
      const uploadPath = path.join(__dirname, "..", "..", "uploads", "photos");
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `photo-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Upload photo (base64 or file)
router.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    const { sessionId, photoNumber, base64Data } = req.body;

    if (!sessionId || !photoNumber) {
      return res.status(400).json({
        error: "Session ID and photo number are required",
      });
    }

    // Find or create session
    let session = await Session.findOne({ sessionId });
    if (!session) {
      session = new Session({ sessionId });
      await session.save();
    }

    // Enforce max 10 photos per session using atomic increment
    // Attempt to increment; if already at limit, reject
    const updatedSession = await Session.findOneAndUpdate(
      { _id: session._id, totalPhotos: { $lt: 10 } },
      { $inc: { totalPhotos: 1 } },
      { new: true }
    );

    if (!updatedSession) {
      return res
        .status(400)
        .json({ error: "Maximum photos reached for this session" });
    }

    const assignedPhotoNumber = updatedSession.totalPhotos; // 1..10

    let photoPath, filename, originalName, fileSize, mimeType;

    // Handle base64 upload
    if (base64Data) {
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid base64 data" });
      }

      mimeType = matches[1];
      const imageBuffer = Buffer.from(matches[2], "base64");

      filename = `photo-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      const photosDir = path.join(__dirname, "..", "..", "uploads", "photos");
      const fs = await import("fs/promises");
      await fs.mkdir(photosDir, { recursive: true });
      photoPath = path.join(photosDir, filename);
      originalName = `photo-${photoNumber}.jpg`;

      // Process and save the image
      await sharp(imageBuffer).jpeg({ quality: 85 }).toFile(photoPath);

      fileSize = imageBuffer.length;
    }
    // Handle file upload
    else if (req.file) {
      filename = req.file.filename;
      photoPath = req.file.path;
      originalName = req.file.originalname;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
    } else {
      return res.status(400).json({
        error: "No photo data provided",
      });
    }

    // Get image metadata
    const metadata = await sharp(photoPath).metadata();

    // Create photo document
    const photo = new Photo({
      sessionId: session._id,
      filename,
      originalName,
      path: `/uploads/photos/${filename}`,
      size: fileSize,
      mimeType,
      photoNumber: assignedPhotoNumber,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        colorSpace: metadata.space,
      },
    });

    await photo.save();

    // Update session status/timestamps if reached 10
    if (updatedSession.totalPhotos >= 10) {
      updatedSession.status = "completed";
      updatedSession.metadata.endTime = new Date();
      updatedSession.metadata.duration =
        updatedSession.metadata.endTime - updatedSession.metadata.startTime;
      await updatedSession.save();
    }

    res.status(201).json({
      message: "Photo uploaded successfully",
      photo,
      session: {
        id: updatedSession.sessionId,
        totalPhotos: updatedSession.totalPhotos,
        status: updatedSession.status,
      },
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    res.status(500).json({
      error: "Failed to upload photo",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get photos for a session
router.get("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const photos = await Photo.find({ sessionId: session._id }).sort({
      photoNumber: 1,
    });

    res.json({
      session: {
        id: session.sessionId,
        totalPhotos: session.totalPhotos,
        status: session.status,
        selectedPhotos: session.selectedPhotos,
      },
      photos,
    });
  } catch (error) {
    console.error("Get photos error:", error);
    res.status(500).json({ error: "Failed to retrieve photos" });
  }
});

// Select/deselect photos for photostrip
router.put("/select", async (req, res) => {
  try {
    const { sessionId, photoIds } = req.body;

    if (!sessionId || !Array.isArray(photoIds)) {
      return res.status(400).json({
        error: "Session ID and photo IDs array are required",
      });
    }

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // First, deselect all photos for this session
    await Photo.updateMany({ sessionId: session._id }, { isSelected: false });

    // Then select the specified photos
    if (photoIds.length > 0) {
      await Photo.updateMany(
        {
          sessionId: session._id,
          _id: { $in: photoIds },
        },
        { isSelected: true }
      );

      // Update session with selected photos
      session.selectedPhotos = photoIds;
      await session.save();
    }

    const updatedPhotos = await Photo.find({ sessionId: session._id }).sort({
      photoNumber: 1,
    });

    res.json({
      message: "Photo selection updated",
      selectedCount: photoIds.length,
      photos: updatedPhotos,
    });
  } catch (error) {
    console.error("Photo selection error:", error);
    res.status(500).json({ error: "Failed to update photo selection" });
  }
});

// Apply filters to a photo
router.put("/filter/:photoId", async (req, res) => {
  try {
    const { photoId } = req.params;
    const { filters } = req.body;

    if (!filters || typeof filters !== "object") {
      return res.status(400).json({ error: "Filters object is required" });
    }

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Update filters
    photo.filters = { ...photo.filters, ...filters };
    await photo.save();

    res.json({
      message: "Filters applied successfully",
      photo,
    });
  } catch (error) {
    console.error("Apply filter error:", error);
    res.status(500).json({ error: "Failed to apply filters" });
  }
});

// Delete a photo
router.delete("/:photoId", authMiddleware, async (req, res) => {
  try {
    const { photoId } = req.params;

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Delete the file
    const fs = await import("fs/promises");
    const fullPath = path.join(
      __dirname,
      "..",
      "..",
      photo.path.replace(/^[/\\]+/, "")
    );

    try {
      await fs.unlink(fullPath);
    } catch (fileError) {
      console.warn("Could not delete photo file:", fileError.message);
    }

    // Delete from database
    await Photo.findByIdAndDelete(photoId);

    // Update session photo count
    const session = await Session.findById(photo.sessionId);
    if (session) {
      session.totalPhotos = Math.max(0, session.totalPhotos - 1);
      session.selectedPhotos = session.selectedPhotos.filter(
        (id) => id.toString() !== photoId
      );
      await session.save();
    }

    res.json({ message: "Photo deleted successfully" });
  } catch (error) {
    console.error("Delete photo error:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// Get all photos (admin only)
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, sessionId } = req.query;
    const skip = (page - 1) * limit;

    const query = sessionId ? { sessionId } : {};

    const photos = await Photo.find(query)
      .populate("sessionId", "sessionId status createdAt")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Photo.countDocuments(query);

    res.json({
      photos,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get all photos error:", error);
    res.status(500).json({ error: "Failed to retrieve photos" });
  }
});

export default router;
