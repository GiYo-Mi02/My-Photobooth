import express from "express";
import {
  authMiddleware,
  adminMiddleware,
  optionalAuthMiddleware,
} from "../middleware/auth.js";
import Session from "../models/Session.js";
import Photo from "../models/Photo.js";
import Template from "../models/Template.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const PHOTOSTRIP_DIR = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "photostrips"
);
const DEFAULT_WIDTH = 1800;
const DEFAULT_HEIGHT = 1200;

const clampNumber = (value, min, max) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const createRoundedMaskSvg = (width, height, radius) =>
  `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></svg>`;

const generateGridSlots = (count, width, height, options = {}) => {
  if (count <= 0) return [];
  const padding = clampNumber(
    options.padding ?? Math.round(width * 0.02),
    0,
    width / 4
  );
  const borderRadius = clampNumber(
    options.borderRadius ?? 32,
    0,
    Math.min(width, height)
  );
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const availableWidth = width - padding * (columns + 1);
  const availableHeight = height - padding * (rows + 1);
  const slotWidth = Math.floor(availableWidth / columns);
  const slotHeight = Math.floor(availableHeight / rows);

  const slots = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    slots.push({
      x: Math.round(padding + column * (slotWidth + padding)),
      y: Math.round(padding + row * (slotHeight + padding)),
      width: slotWidth,
      height: slotHeight,
      rotation: 0,
      borderRadius,
    });
  }
  return slots;
};

const generateSixteenLayout = (count, width, height, options = {}) => {
  const padding = clampNumber(
    options.padding ?? Math.round(width * 0.015),
    0,
    width / 4
  );
  const borderRadius = clampNumber(
    options.borderRadius ?? 28,
    0,
    Math.min(width, height)
  );
  const leftWidth = Math.floor(width * 0.28);
  const rightWidth = width - leftWidth - padding * 3;
  const leftSlotHeight = Math.floor((height - padding * 5) / 4);
  const rightColWidth = Math.floor((rightWidth - padding) / 2);
  const rightSlotHeight = Math.floor((height - padding * 7) / 6);

  const slots = [];

  // Left column 1x4
  for (let i = 0; i < 4 && slots.length < count; i += 1) {
    slots.push({
      x: padding,
      y: padding + i * (leftSlotHeight + padding),
      width: leftWidth,
      height: leftSlotHeight,
      rotation: 0,
      borderRadius,
    });
  }

  // Right area 2x6 (12 slots)
  const baseX = leftWidth + padding * 2;
  for (let row = 0; row < 6 && slots.length < count; row += 1) {
    for (let col = 0; col < 2 && slots.length < count; col += 1) {
      slots.push({
        x: baseX + col * (rightColWidth + padding),
        y: padding + row * (rightSlotHeight + padding),
        width: rightColWidth,
        height: rightSlotHeight,
        rotation: 0,
        borderRadius,
      });
    }
  }

  return slots.slice(0, count);
};

const scaleTemplateSlots = (slots, widthScale, heightScale) =>
  slots.map((slot) => ({
    x: Math.round(slot.x * widthScale),
    y: Math.round(slot.y * heightScale),
    width: Math.max(1, Math.round(slot.width * widthScale)),
    height: Math.max(1, Math.round(slot.height * heightScale)),
    rotation: slot.rotation || 0,
    borderRadius: slot.borderRadius || 0,
  }));

const resolveSlots = ({
  template,
  count,
  outputWidth,
  outputHeight,
  layout,
  customization,
}) => {
  const templateSlots = Array.isArray(template?.photoSlots)
    ? [...template.photoSlots]
    : [];
  const hasTemplateSlots =
    templateSlots.length >= count && customization?.autoLayout !== true;
  const widthScale = template?.dimensions?.width
    ? outputWidth / template.dimensions.width
    : 1;
  const heightScale = template?.dimensions?.height
    ? outputHeight / template.dimensions.height
    : 1;

  if (hasTemplateSlots) {
    return scaleTemplateSlots(
      templateSlots.slice(0, count),
      widthScale,
      heightScale
    );
  }

  if (layout === "left1x4_right2x6") {
    return generateSixteenLayout(
      count,
      outputWidth,
      outputHeight,
      customization
    );
  }

  return generateGridSlots(count, outputWidth, outputHeight, customization);
};

// Create a new session
router.post("/create", optionalAuthMiddleware, async (req, res) => {
  try {
    const { userId, settings } = req.body || {};
    const session = new Session({
      userId: userId || req.user?.userId || null,
      settings: settings || {},
      metadata: {
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
        startTime: new Date(),
      },
    });
    await session.save();
    res.status(201).json({
      message: "Session created successfully",
      session: {
        id: session.sessionId,
        settings: session.settings,
        status: session.status,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// Get session details (with photos)
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findOne({ sessionId })
      .populate("templateId")
      .lean();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const photos = await Photo.find({ sessionId: session._id }).sort({
      photoNumber: 1,
    });
    res.json({
      session: {
        id: session.sessionId,
        status: session.status,
        totalPhotos: session.totalPhotos,
        selectedPhotos: session.selectedPhotos,
        template: session.templateId,
        settings: session.settings,
        photostripPath: session.photostripPath,
        createdAt: session.createdAt,
        metadata: session.metadata,
      },
      photos,
    });
  } catch (error) {
    console.error("Get session error:", error);
    res.status(500).json({ error: "Failed to retrieve session" });
  }
});

// Update session (status, template, selectedPhotos)
router.put("/:sessionId", optionalAuthMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, templateId, selectedPhotos, settings } = req.body;
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (status) session.status = status;
    if (templateId) session.templateId = templateId;
    if (selectedPhotos) session.selectedPhotos = selectedPhotos;
    if (settings && typeof settings === "object") {
      const allowedSettings = {};
      if (Object.prototype.hasOwnProperty.call(settings, "photoInterval")) {
        const raw = Number(settings.photoInterval);
        if (Number.isFinite(raw)) {
          allowedSettings.photoInterval = clampNumber(raw, 1000, 60000);
        }
      }
      if (Object.prototype.hasOwnProperty.call(settings, "maxPhotos")) {
        const raw = Number(settings.maxPhotos);
        if (Number.isFinite(raw)) {
          allowedSettings.maxPhotos = clampNumber(raw, 1, 20);
        }
      }
      if (Object.prototype.hasOwnProperty.call(settings, "autoAdvance")) {
        allowedSettings.autoAdvance = Boolean(settings.autoAdvance);
      }
      session.settings = {
        ...session.settings,
        ...allowedSettings,
      };
    }
    await session.save();
    res.json({
      message: "Session updated successfully",
      session: {
        id: session.sessionId,
        status: session.status,
        totalPhotos: session.totalPhotos,
        selectedPhotos: session.selectedPhotos,
        template: session.templateId,
        photostripPath: session.photostripPath,
        metadata: session.metadata,
        settings: session.settings,
      },
    });
  } catch (error) {
    console.error("Update session error:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
});

// Generate photostrip image using Sharp
router.post("/:sessionId/photostrip", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      templateId,
      selectedPhotoIds,
      targetWidth,
      targetHeight,
      forceOrientation,
      layout,
      customization = {},
    } = req.body || {};

    if (!Array.isArray(selectedPhotoIds) || selectedPhotoIds.length === 0) {
      return res
        .status(400)
        .json({ error: "selectedPhotoIds must contain at least one photo" });
    }

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const template = templateId
      ? await Template.findById(templateId)
      : session.templateId
      ? await Template.findById(session.templateId)
      : null;

    if (!template) {
      return res
        .status(400)
        .json({ error: "Template is required for photostrip generation" });
    }

    // Fetch and validate selected photos (preserve order from request)
    const photos = await Photo.find({
      _id: { $in: selectedPhotoIds },
      sessionId: session._id,
    }).lean();

    if (photos.length !== selectedPhotoIds.length) {
      return res.status(400).json({
        error: "Some selected photos could not be found in this session",
      });
    }

    const photosById = new Map(
      photos.map((photo) => [photo._id.toString(), photo])
    );

    let outputWidth =
      Number(targetWidth) || template.dimensions?.width || DEFAULT_WIDTH;
    let outputHeight =
      Number(targetHeight) || template.dimensions?.height || DEFAULT_HEIGHT;

    if (forceOrientation === "portrait" && outputWidth > outputHeight) {
      [outputWidth, outputHeight] = [outputHeight, outputWidth];
    }
    if (forceOrientation === "landscape" && outputHeight > outputWidth) {
      [outputWidth, outputHeight] = [outputHeight, outputWidth];
    }

    outputWidth = Math.max(400, Math.round(outputWidth));
    outputHeight = Math.max(400, Math.round(outputHeight));

    const slotDefinitions = resolveSlots({
      template,
      count: selectedPhotoIds.length,
      outputWidth,
      outputHeight,
      layout,
      customization,
    });

    if (slotDefinitions.length < selectedPhotoIds.length) {
      return res.status(400).json({
        error: "Unable to determine layout for all selected photos",
      });
    }

    const templatePath = template.path?.replace(/^[/\\]+/, "");
    if (!templatePath) {
      return res.status(400).json({ error: "Template file path is missing" });
    }

    const absoluteTemplatePath = path.join(__dirname, "..", "..", templatePath);

    try {
      await fs.access(absoluteTemplatePath);
    } catch (accessError) {
      return res
        .status(404)
        .json({ error: "Template file could not be found on disk" });
    }

    await fs.mkdir(PHOTOSTRIP_DIR, { recursive: true });

    const overlays = [];

    for (let index = 0; index < selectedPhotoIds.length; index += 1) {
      const photoId = selectedPhotoIds[index];
      const slot = slotDefinitions[index];
      const photo = photosById.get(photoId.toString());

      if (!photo) continue;

      const photoPath = photo.path?.replace(/^[/\\]+/, "");
      if (!photoPath) {
        throw new Error(`Photo ${photoId} is missing file path information`);
      }

      const absolutePhotoPath = path.join(__dirname, "..", "..", photoPath);

      let pipeline = sharp(absolutePhotoPath);
      const filters = photo.filters || {};
      const modulateOptions = {};

      if (Number.isFinite(filters.brightness) && filters.brightness !== 100) {
        modulateOptions.brightness = Math.max(0.1, filters.brightness / 100);
      }
      if (Number.isFinite(filters.saturation) && filters.saturation !== 100) {
        modulateOptions.saturation = Math.max(0, filters.saturation / 100);
      }
      if (Object.keys(modulateOptions).length > 0) {
        pipeline = pipeline.modulate(modulateOptions);
      }
      if (Number.isFinite(filters.contrast) && filters.contrast !== 100) {
        const contrastFactor = Math.max(0.1, filters.contrast / 100);
        pipeline = pipeline.linear(
          contrastFactor,
          -(0.5 * contrastFactor) + 0.5
        );
      }
      if (Number.isFinite(filters.blur) && filters.blur > 0) {
        pipeline = pipeline.blur(Math.min(50, filters.blur / 2));
      }
      if (filters.grayscale) {
        pipeline = pipeline.grayscale();
      }
      if (filters.sepia) {
        pipeline = pipeline.recomb([
          [0.3588, 0.7044, 0.1368],
          [0.299, 0.587, 0.114],
          [0.2392, 0.4696, 0.0912],
        ]);
      }
      if (filters.vintage) {
        pipeline = pipeline.tint({ r: 230, g: 198, b: 158 });
      }

      const resized = await pipeline
        .rotate(slot.rotation || 0, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .resize(Math.max(slot.width, 1), Math.max(slot.height, 1), {
          fit: "cover",
        })
        .toBuffer();

      let overlayBuffer = resized;
      if (slot.borderRadius > 0) {
        const radius = Math.min(
          slot.borderRadius,
          Math.min(slot.width, slot.height) / 2
        );
        const maskSvg = createRoundedMaskSvg(slot.width, slot.height, radius);
        overlayBuffer = await sharp(resized)
          .composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
          .toBuffer();
      }

      overlays.push({
        input: overlayBuffer,
        top: Math.round(slot.y),
        left: Math.round(slot.x),
      });
    }

    if (overlays.length === 0) {
      return res.status(400).json({
        error: "No valid photos were available to generate the photostrip",
      });
    }

    const outputFilename = `photostrip-${sessionId}-${Date.now()}.jpg`;
    const outputPath = path.join(PHOTOSTRIP_DIR, outputFilename);

    await sharp(absoluteTemplatePath)
      .resize(outputWidth, outputHeight, { fit: "cover" })
      .ensureAlpha()
      .composite(overlays)
      .jpeg({ quality: clampNumber(customization.quality ?? 90, 40, 100) })
      .toFile(outputPath);

    session.photostripPath = `/uploads/photostrips/${outputFilename}`;
    session.status = "completed";
    session.selectedPhotos = selectedPhotoIds;
    if (
      !session.templateId ||
      session.templateId.toString() !== template._id.toString()
    ) {
      session.templateId = template._id;
    }
    session.metadata = session.metadata || {};
    session.metadata.endTime = new Date();
    if (session.metadata.startTime) {
      session.metadata.duration =
        session.metadata.endTime - session.metadata.startTime;
    }

    await session.save();
    await Template.findByIdAndUpdate(template._id, {
      $inc: { usageCount: 1 },
    }).catch(() => {});

    res.json({
      photostrip: {
        path: session.photostripPath,
        url: session.photostripPath,
        template: template._id.toString(),
        photosUsed: overlays.length,
        width: outputWidth,
        height: outputHeight,
      },
      session: {
        id: session.sessionId,
        status: session.status,
        photostripPath: session.photostripPath,
      },
      message: "Photostrip generated successfully",
    });
  } catch (error) {
    console.error("Generate photostrip error:", error);
    res.status(500).json({ error: "Failed to generate photostrip" });
  }
});

// Admin: get all sessions with stats and pagination
router.get("/all/list", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    const query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const sessions = await Session.find(query)
      .skip(Number(skip))
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    const total = await Session.countDocuments(query);
    // Stats aggregation
    const stats = await Session.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgPhotos: { $avg: "$totalPhotos" },
          avgDuration: { $avg: "$metadata.duration" },
        },
      },
    ]);
    res.json({
      sessions,
      stats,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get all sessions error:", error);
    res.status(500).json({ error: "Failed to retrieve sessions" });
  }
});

// Admin: delete session
router.delete(
  "/:sessionId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await Session.findOne({ sessionId });
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      // Delete related photos
      await Photo.deleteMany({ sessionId: session._id });
      // TODO: delete photostrip file if exists
      await Session.deleteOne({ _id: session._id });
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Delete session error:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  }
);

export default router;
