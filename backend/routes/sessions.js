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

// Simple XML escape for dynamic footer text
const escapeXml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

// Dual 3x2 panels (left & right), up to 12 photos (6 each). Reserves footer space.
const generateDual3x2Layout = (count, width, height, options = {}) => {
  const c = clampNumber(count, 1, 12);
  if (c <= 0) return [];
  const footerRatio = clampNumber(options.footerRatio ?? 0.14, 0.05, 0.3);
  const outerPad = clampNumber(
    options.panelPadding ?? Math.round(width * 0.03),
    0,
    width / 3
  );
  const panelGap = clampNumber(
    options.panelGap ?? Math.round(width * 0.04),
    0,
    width / 2
  );
  const footerHeight = Math.round(height * footerRatio);
  const workHeight = height - footerHeight;
  // Two panels side by side
  const panelWidth = Math.floor((width - outerPad * 2 - panelGap) / 2);
  const panelInnerPad = clampNumber(
    options.slotPadding ?? Math.round(panelWidth * 0.03),
    0,
    panelWidth / 4
  );
  const rows = 3;
  const cols = 2;
  const slotGap = panelInnerPad;
  const slotWidth = Math.floor((panelWidth - slotGap * (cols - 1)) / cols);
  const slotHeight = Math.floor(
    (workHeight - panelInnerPad * 2 - slotGap * (rows - 1)) / rows
  );
  const borderRadius = clampNumber(
    options.slotBorderRadius ?? 32,
    0,
    Math.min(slotWidth, slotHeight)
  );
  const usedHeight =
    panelInnerPad * 2 + rows * slotHeight + slotGap * (rows - 1);
  const panelAlign = options.panelAlign || "center"; // 'top' | 'center' | 'bottom'

  const slots = [];
  let panelY;
  if (panelAlign === "top") {
    panelY = Math.max(0, outerPad);
  } else if (panelAlign === "bottom") {
    panelY = Math.max(0, workHeight - usedHeight - outerPad);
  } else {
    panelY = Math.round((workHeight - usedHeight) / 2);
  }
  for (let panel = 0; panel < 2; panel += 1) {
    const panelX = outerPad + panel * (panelWidth + panelGap);
    for (let r = 0; r < rows; r += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (slots.length >= c) break;
        const x = panelX + panelInnerPad + col * (slotWidth + slotGap);
        const y = panelY + panelInnerPad + r * (slotHeight + slotGap);
        slots.push({
          x,
          y,
          width: slotWidth,
          height: slotHeight,
          rotation: 0,
          borderRadius,
        });
      }
    }
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
  const preferTemplatePanel =
    layout === "dual3x2" && customization?.preferTemplatePanel !== false;
  const respectTemplateOverride = customization?.respectTemplateSlots === true;
  const hasTemplateSlots =
    templateSlots.length >= count &&
    (customization?.autoLayout !== true ||
      preferTemplatePanel ||
      respectTemplateOverride);
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
  if (layout === "dual3x2") {
    return generateDual3x2Layout(
      count,
      outputWidth,
      outputHeight,
      customization || {}
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

// Create a new session (restored)
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

// Get session details with photos (restored)
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

    const debugMode =
      customization &&
      (customization.debug === true ||
        (process.env.NODE_ENV === "development" &&
          customization.debug !== false));
    if (debugMode) {
      console.log(
        "[PHOTOSTRIP][DEBUG] Request layout=%s selected=%d output=%dx%d templateSlots=%d autoLayout=%s",
        layout,
        selectedPhotoIds.length,
        outputWidth,
        outputHeight,
        Array.isArray(template.photoSlots) ? template.photoSlots.length : 0,
        customization?.autoLayout
      );
    }

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

      // Debug: log file stats
      if (debugMode) {
        try {
          const st = await fs.stat(absolutePhotoPath);
          console.log(
            "[PHOTOSTRIP][DEBUG] Photo file %s %s %dB",
            photoId,
            absolutePhotoPath,
            st.size
          );
        } catch (e) {
          console.log(
            "[PHOTOSTRIP][DEBUG] Photo stat failed %s %s %s",
            photoId,
            absolutePhotoPath,
            e.message
          );
        }
      }

      // Sample average luminance to auto-correct dark images
      let avgLuma = null;
      try {
        const tiny = await sharp(absolutePhotoPath)
          .resize(8, 8, { fit: "cover" })
          .removeAlpha()
          .raw()
          .toBuffer();
        let sum = 0;
        for (let i = 0; i < tiny.length; i += 3) {
          const r = tiny[i];
          const g = tiny[i + 1];
          const b = tiny[i + 2];
          sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        avgLuma = sum / (tiny.length / 3);
      } catch (e) {
        if (debugMode) {
          console.log(
            "[PHOTOSTRIP][DEBUG] Total overlays=%d slots=%d",
            overlays.length,
            slotDefinitions.length
          );
          if (!overlays.length) {
            console.log(
              "[PHOTOSTRIP][DEBUG] WARNING: No overlays produced. First slot definition (if any):",
              slotDefinitions[0]
            );
          } else {
            try {
              const firstBuf = overlays[0].input;
              const hexSnippet = firstBuf.subarray(0, 32).toString("hex");
              console.log(
                "[PHOTOSTRIP][DEBUG] First overlay head bytes (32):",
                hexSnippet
              );
            } catch (e) {
              console.log(
                "[PHOTOSTRIP][DEBUG] Could not print first overlay hex",
                e.message
              );
            }
          }
        }

        // Optional override: ignore computed overlays and directly draw FIRST photo raw for visibility test
        if (customization.forceFirstPhotoRaw && selectedPhotoIds.length > 0) {
          try {
            const firstId = selectedPhotoIds[0];
            const doc = await Photo.findById(firstId);
            if (doc) {
              const abs = path.join(PHOTO_UPLOAD_DIR, doc.filename);
              const testResizeW = Math.min(
                outputWidth,
                Math.round(outputWidth / 2)
              );
              const testResizeH = Math.min(
                outputHeight,
                Math.round(outputHeight / 2)
              );
              const rawBuf = await sharp(abs)
                .resize({
                  width: testResizeW,
                  height: testResizeH,
                  fit: "cover",
                })
                .jpeg({ quality: 85 })
                .toBuffer();
              overlays.splice(0, overlays.length); // clear
              overlays.push({ input: rawBuf, left: 10, top: 10 });
              if (debugMode)
                console.log(
                  "[PHOTOSTRIP][DEBUG] forceFirstPhotoRaw placed test image",
                  { w: testResizeW, h: testResizeH }
                );
            } else if (debugMode) {
              console.log(
                "[PHOTOSTRIP][DEBUG] forceFirstPhotoRaw could not load first photo doc"
              );
            }
          } catch (e) {
            if (debugMode)
              console.log(
                "[PHOTOSTRIP][DEBUG] forceFirstPhotoRaw failed",
                e.message
              );
          }
        }
      }

      let pipeline = sharp(absolutePhotoPath);
      const filters = photo.filters || {};
      const modulateOptions = {};
      const rawCompositeMode = customization.rawCompositeMode === true;

      if (!rawCompositeMode) {
        if (Number.isFinite(filters.brightness) && filters.brightness !== 100) {
          modulateOptions.brightness = Math.max(0.1, filters.brightness / 100);
        }
        if (Number.isFinite(filters.saturation) && filters.saturation !== 100) {
          modulateOptions.saturation = Math.max(0, filters.saturation / 100);
        }
        if (Object.keys(modulateOptions).length > 0) {
          pipeline = pipeline.modulate(modulateOptions);
        }
        if (avgLuma != null) {
          const boost =
            avgLuma < 20 ? 1.35 : avgLuma < 30 ? 1.25 : avgLuma < 40 ? 1.15 : 1;
          if (boost > 1) {
            if (debugMode)
              console.log(
                "[PHOTOSTRIP][DEBUG] Brightness boost %s avgLuma=%s factor=%s",
                photoId,
                avgLuma.toFixed(1),
                boost
              );
            pipeline = pipeline.modulate({ brightness: boost });
          } else if (debugMode) {
            console.log(
              "[PHOTOSTRIP][DEBUG] Brightness OK %s avgLuma=%s",
              photoId,
              avgLuma.toFixed(1)
            );
          }
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
        if (filters.grayscale) pipeline = pipeline.grayscale();
        if (filters.sepia) {
          pipeline = pipeline.recomb([
            [0.3588, 0.7044, 0.1368],
            [0.299, 0.587, 0.114],
            [0.2392, 0.4696, 0.0912],
          ]);
        }
        if (filters.vintage)
          pipeline = pipeline.tint({ r: 230, g: 198, b: 158 });
      } else if (debugMode) {
        console.log(
          "[PHOTOSTRIP][DEBUG] rawCompositeMode active for %s",
          photoId
        );
      }

      let resized = await pipeline
        .rotate(slot.rotation || 0, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .resize(Math.max(slot.width, 1), Math.max(slot.height, 1), {
          fit: "cover",
        })
        .toBuffer();

      // Flatten against a solid background if requested to avoid semi-transparent appearance
      const bgHex = customization?.photoBackground || "#000000";
      if (bgHex && /^#?[0-9a-fA-F]{3,8}$/.test(bgHex)) {
        try {
          const norm = bgHex.startsWith("#") ? bgHex.slice(1) : bgHex;
          const parseChannel = (hex) => parseInt(hex, 16);
          const expand = (h) => (h.length === 1 ? h + h : h);
          let r = 0,
            g = 0,
            b = 0;
          if (norm.length === 3 || norm.length === 4) {
            r = parseChannel(expand(norm[0]));
            g = parseChannel(expand(norm[1]));
            b = parseChannel(expand(norm[2]));
          } else if (norm.length >= 6) {
            r = parseChannel(norm.slice(0, 2));
            g = parseChannel(norm.slice(2, 4));
            b = parseChannel(norm.slice(4, 6));
          }
          resized = await sharp(resized)
            .flatten({ background: { r, g, b } })
            .toBuffer();
        } catch (e) {
          if (debugMode)
            console.log(
              "[PHOTOSTRIP][DEBUG] Flatten background failed",
              e.message
            );
        }
      }

      const forceRawNoMask = customization.forceRawNoMask === true;
      let overlayBuffer = resized;
      if (!rawCompositeMode && !forceRawNoMask && slot.borderRadius > 0) {
        const radius = Math.min(
          slot.borderRadius,
          Math.min(slot.width, slot.height) / 2
        );
        const maskSvg = createRoundedMaskSvg(slot.width, slot.height, radius);
        overlayBuffer = await sharp(resized)
          .composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
          .toBuffer();
      }

      if (debugMode && customization.debugPixelStats) {
        try {
          const { data, info } = await sharp(overlayBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const w = info.width,
            h = info.height,
            ch = info.channels;
          const pts = 16; // sample 16 points
          let rSum = 0,
            gSum = 0,
            bSum = 0,
            lMin = 255,
            lMax = 0;
          let alphaAllZero = true;
          for (let i = 0; i < pts; i++) {
            const x = Math.floor(Math.random() * w);
            const y = Math.floor(Math.random() * h);
            const idx = (y * w + x) * ch;
            const r = data[idx],
              g = data[idx + 1],
              b = data[idx + 2];
            const a = ch > 3 ? data[idx + 3] : 255;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            lMin = Math.min(lMin, lum);
            lMax = Math.max(lMax, lum);
            rSum += r;
            gSum += g;
            bSum += b;
            if (a !== 0) alphaAllZero = false;
          }
          console.log(
            "[PHOTOSTRIP][DEBUG] PixelStats %s avgRGB=(%d,%d,%d) lumRange=%.1f-%.1f",
            photoId,
            Math.round(rSum / pts),
            Math.round(gSum / pts),
            Math.round(bSum / pts),
            lMin,
            lMax
          );
          if (alphaAllZero) {
            console.log(
              "[PHOTOSTRIP][DEBUG] Overlay appears fully transparent (alpha=0). Retrying without mask."
            );
            overlayBuffer = await sharp(resized).ensureAlpha().toBuffer();
          }
        } catch (e) {
          console.log(
            "[PHOTOSTRIP][DEBUG] PixelStats failed %s %s",
            photoId,
            e.message
          );
        }
      }

      const overlayEntry = {
        input: overlayBuffer,
        top: Math.round(slot.y),
        left: Math.round(slot.x),
      };
      overlays.push(overlayEntry);
      // Save each overlay if requested
      if (debugMode && customization.debugSaveAllOverlays) {
        try {
          const eachPath = path.join(
            PHOTOSTRIP_DIR,
            `overlay-${index}-${Date.now()}.jpg`
          );
          await fs.writeFile(eachPath, overlayBuffer);
          console.log(
            "[PHOTOSTRIP][DEBUG] Saved overlay %d -> %s",
            index,
            eachPath
          );
        } catch (e) {
          console.log(
            "[PHOTOSTRIP][DEBUG] Failed saving overlay %d %s",
            index,
            e.message
          );
        }
      }
      // Save first overlay sample for inspection
      if (debugMode && index === 0) {
        try {
          const samplePath = path.join(
            PHOTOSTRIP_DIR,
            `overlay-sample-${Date.now()}.jpg`
          );
          await fs.writeFile(samplePath, overlayBuffer);
          console.log(
            "[PHOTOSTRIP][DEBUG] Wrote first overlay sample",
            samplePath
          );
        } catch (e) {
          console.log(
            "[PHOTOSTRIP][DEBUG] Could not write overlay sample",
            e.message
          );
        }
      }
      if (debugMode && index < 24) {
        const within =
          slot.x >= 0 &&
          slot.y >= 0 &&
          slot.x + slot.width <= outputWidth &&
          slot.y + slot.height <= outputHeight;
        console.log(
          "[PHOTOSTRIP][DEBUG] Overlay %d id=%s box=(%d,%d %dx%d) inBounds=%s buf=%dB",
          index,
          photoId,
          Math.round(slot.x),
          Math.round(slot.y),
          slot.width,
          slot.height,
          within,
          overlayBuffer.length
        );
      }
    }

    if (overlays.length === 0) {
      return res.status(400).json({
        error: "No valid photos were available to generate the photostrip",
      });
    }

    // Optional duplication (twin strip): mirror first strip to the right.
    if (
      layout === "dual3x2" &&
      overlays.length <= 6 &&
      customization?.duplicatePanels !== false
    ) {
      try {
        const slotSubset = slotDefinitions.slice(0, overlays.length);
        if (slotSubset.length) {
          const distinctX = Array.from(
            new Set(slotSubset.map((s) => s.x))
          ).sort((a, b) => a - b);
          const minX = Math.min(...slotSubset.map((s) => s.x));
          const maxRight = Math.max(...slotSubset.map((s) => s.x + s.width));
          const boundingWidth = maxRight - minX; // width of original panel (1 or 2 cols)
          if (distinctX.length === 1) {
            // Single column authored template; place duplicate flush right with same left margin.
            const marginLeft = minX;
            const shiftLeft = outputWidth - marginLeft - boundingWidth; // new panel's left
            if (shiftLeft > minX + boundingWidth / 2) {
              const duplicate = overlays.map((ov) => ({
                input: ov.input,
                top: ov.top,
                left: ov.left + (shiftLeft - minX),
              }));
              overlays.push(...duplicate);
              if (debugMode)
                console.log(
                  "[PHOTOSTRIP][DEBUG] Duplicated (1-col) marginLeft=%d panelWidth=%d newLeft=%d",
                  marginLeft,
                  boundingWidth,
                  shiftLeft
                );
            } else if (debugMode) {
              console.log(
                "[PHOTOSTRIP][DEBUG] Skip duplication (1-col) shiftLeft=%d panelWidth=%d",
                shiftLeft,
                boundingWidth
              );
            }
          } else if (distinctX.length >= 2) {
            // Two column panel; treat columns as cohesive block and mirror.
            const panelWidth = boundingWidth;
            const gapBetween =
              distinctX[1] -
              (distinctX[0] +
                slotSubset.find((s) => s.x === distinctX[0]).width);
            const panelLeft = minX;
            const secondPanelLeft = outputWidth - panelLeft - panelWidth;
            if (secondPanelLeft > panelLeft + panelWidth / 3) {
              const offset = secondPanelLeft - panelLeft;
              const duplicate = overlays.map((ov) => ({
                input: ov.input,
                top: ov.top,
                left: ov.left + offset,
              }));
              overlays.push(...duplicate);
              if (debugMode)
                console.log(
                  "[PHOTOSTRIP][DEBUG] Duplicated (2-col) panelWidth=%d offset=%d gapBetween=%d",
                  panelWidth,
                  offset,
                  gapBetween
                );
            } else if (debugMode) {
              console.log(
                "[PHOTOSTRIP][DEBUG] Skip duplication (2-col) secondLeft=%d panelWidth=%d",
                secondPanelLeft,
                panelWidth
              );
            }
          }
        }
      } catch (e) {
        if (debugMode)
          console.log("[PHOTOSTRIP][DEBUG] Duplication error", e.message);
      }
    }

    const outputFilename = `photostrip-${sessionId}-${Date.now()}.jpg`;
    const outputPath = path.join(PHOTOSTRIP_DIR, outputFilename);

    // Begin base image pipeline
    const templateSharp = sharp(absoluteTemplatePath)
      .resize(outputWidth, outputHeight, { fit: "cover" })
      .ensureAlpha();
    const templateOverPhotos = customization?.templateOverPhotos === true;
    let baseImage = templateOverPhotos
      ? sharp({
          create: {
            width: outputWidth,
            height: outputHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
      : templateSharp.clone();

    // Footer overlay generation (optional)
    const footer = customization.footer;
    const needsFooter = footer && (footer.hashtag || footer.date);
    let footerComposite = null;
    if (needsFooter) {
      const accentColor = footer.accentColor || "#D4AF37";
      const textColor = footer.textColor || "#FFFFFF";
      const fontScale = clampNumber(footer.fontScale ?? 1, 0.5, 3);
      const footerRatio = clampNumber(
        customization.footerRatio ?? 0.14,
        0.05,
        0.3
      );
      const footerHeight = Math.round(outputHeight * footerRatio);
      const panelGap = Math.round(outputWidth * 0.04);
      const outerPad = Math.round(outputWidth * 0.03);
      const panelWidth = Math.floor(
        (outputWidth - outerPad * 2 - panelGap) / 2
      );
      const baselineY = Math.round(footerHeight * 0.45);
      const dateBaselineY = Math.round(footerHeight * 0.75);
      const hashtag = footer.hashtag || "";
      const dateText = footer.date || "";
      const fontSizeHash = Math.round(footerHeight * 0.28 * fontScale);
      const fontSizeDate = Math.round(footerHeight * 0.22 * fontScale);
      const underlineY = Math.round(footerHeight * 0.82);
      const underlineWidth = Math.round(panelWidth * 0.7);
      const underlineXOffset = Math.round((panelWidth - underlineWidth) / 2);
      // Build SVG for both panels
      const buildPanelGroup = (panelIndex) => {
        const panelX = outerPad + panelIndex * (panelWidth + panelGap);
        return `
          <g transform="translate(${panelX},0)">
            <text x="${
              panelWidth / 2
            }" y="${baselineY}" text-anchor="middle" fill="${textColor}" font-size="${fontSizeHash}" font-family="sans-serif" font-weight="500">${escapeXml(
          hashtag
        )}</text>
            <text x="${
              panelWidth / 2
            }" y="${dateBaselineY}" text-anchor="middle" fill="${textColor}" font-size="${fontSizeDate}" font-family="sans-serif" font-weight="400">${escapeXml(
          dateText
        )}</text>
            <rect x="${underlineXOffset}" y="${underlineY}" width="${underlineWidth}" height="${Math.max(
          2,
          Math.round(fontSizeDate * 0.08)
        )}" fill="${accentColor}" rx="1" />
          </g>`;
      };
      const svg = `<svg width="${outputWidth}" height="${footerHeight}" viewBox="0 0 ${outputWidth} ${footerHeight}" xmlns="http://www.w3.org/2000/svg">${buildPanelGroup(
        0
      )}${buildPanelGroup(1)}</svg>`;
      footerComposite = {
        input: Buffer.from(svg),
        top: outputHeight - footerHeight,
        left: 0,
      };
    }

    // Optionally override template usage (debugNoTemplate) and/or solid background color
    if (customization.debugNoTemplate) {
      if (debugMode)
        console.log(
          "[PHOTOSTRIP][DEBUG] debugNoTemplate=true skipping template base entirely"
        );
      // Start from a blank (transparent) or solid color base
      const bg =
        customization.baseBackground ||
        customization.debugBaseBackground ||
        null;
      if (bg) {
        if (debugMode)
          console.log("[PHOTOSTRIP][DEBUG] Using solid base background", bg);
        baseImage = sharp({
          create: {
            width: outputWidth,
            height: outputHeight,
            channels: 4,
            background: bg,
          },
        });
      } else {
        baseImage = sharp({
          create: {
            width: outputWidth,
            height: outputHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        });
      }
    } else if (customization.baseBackground && !templateSharp) {
      // If no template but a baseBackground provided, honor it
      if (debugMode)
        console.log(
          "[PHOTOSTRIP][DEBUG] baseBackground without template:",
          customization.baseBackground
        );
      baseImage = sharp({
        create: {
          width: outputWidth,
          height: outputHeight,
          channels: 4,
          background: customization.baseBackground,
        },
      });
    }

    // Compose photo overlays on current base (template or blank)
    if (debugMode) {
      console.log(
        "[PHOTOSTRIP][DEBUG] Total overlays=%d slots=%d",
        overlays.length,
        slotDefinitions.length
      );
      if (!overlays.length) {
        console.log(
          "[PHOTOSTRIP][DEBUG] WARNING: No overlays produced. First slot definition (if any):",
          slotDefinitions[0]
        );
      }
    }
    // Optionally choose a minimal composite fallback that places each photo raw, ignoring blends
    if (customization.forceSimpleComposite) {
      if (debugMode)
        console.log(
          "[PHOTOSTRIP][DEBUG] forceSimpleComposite active: using single shot composite"
        );
      const blankBg = customization.baseBackground || "#ffffff";
      baseImage = sharp({
        create: {
          width: outputWidth,
          height: outputHeight,
          channels: 4,
          background: blankBg,
        },
      });
      for (const ov of overlays) {
        baseImage = baseImage.composite([
          { input: ov.input, top: ov.top, left: ov.left, blend: "over" },
        ]);
      }
    } else {
      // Ensure blend over for each overlay to avoid accidental erase / default behaviors
      const normalized = overlays.map((o) => ({ ...o, blend: "over" }));
      baseImage = baseImage.composite(normalized);
    }

    // Optional export of each overlay as positioned single-layer image for extreme debugging
    if (debugMode && customization.debugSavePositionedOverlays) {
      for (let i = 0; i < overlays.length; i++) {
        const ov = overlays[i];
        try {
          const single = sharp({
            create: {
              width: outputWidth,
              height: outputHeight,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
          }).composite([{ input: ov.input, top: ov.top, left: ov.left }]);
          const outPath = path.join(
            PHOTOSTRIP_DIR,
            `pos-overlay-${i}-${sessionId}-${Date.now()}.png`
          );
          await single.png().toFile(outPath);
          console.log(
            "[PHOTOSTRIP][DEBUG] Wrote positioned overlay",
            i,
            outPath
          );
        } catch (e) {
          console.log(
            "[PHOTOSTRIP][DEBUG] Could not write positioned overlay",
            i,
            e.message
          );
        }
      }
    }

    // Write a photos-only diagnostic image before adding template or footer
    let photosOnlyPathRef = null;
    if (debugMode) {
      try {
        photosOnlyPathRef = path.join(
          PHOTOSTRIP_DIR,
          `photostrip-photos-only-${sessionId}-${Date.now()}.jpg`
        );
        await baseImage.clone().jpeg({ quality: 85 }).toFile(photosOnlyPathRef);
        console.log(
          "[PHOTOSTRIP][DEBUG] Wrote photos-only composite",
          photosOnlyPathRef
        );
      } catch (e) {
        console.log(
          "[PHOTOSTRIP][DEBUG] Could not write photos-only composite",
          e.message
        );
      }
    }

    // If template should overlay (e.g., frame artwork), composite it now (then optionally test coverage)
    if (templateOverPhotos) {
      const templateBuf = await templateSharp.png().ensureAlpha().toBuffer();
      baseImage = baseImage.composite([
        { input: templateBuf, top: 0, left: 0 },
      ]);
      if (debugMode && customization.detectTemplateCoverage) {
        try {
          // Sample center of each slot from the template buffer to detect if it's opaque near-white
          const tmplMeta = await sharp(templateBuf)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const { data: tData, info: tInfo } = tmplMeta;
          let opaqueCount = 0;
          for (const s of slotDefinitions.slice(0, 20)) {
            const cx = Math.min(
              tInfo.width - 1,
              Math.max(0, Math.round(s.x + s.width / 2))
            );
            const cy = Math.min(
              tInfo.height - 1,
              Math.max(0, Math.round(s.y + s.height / 2))
            );
            const idx = (cy * tInfo.width + cx) * tInfo.channels;
            const r = tData[idx],
              g = tData[idx + 1],
              b = tData[idx + 2],
              a = tInfo.channels > 3 ? tData[idx + 3] : 255;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const nearWhite = lum > 240 && r > 230 && g > 230 && b > 230;
            const opaque = a > 240;
            if (nearWhite && opaque) opaqueCount++;
            console.log("[PHOTOSTRIP][DEBUG] TemplateSample slotCenter", {
              cx,
              cy,
              r,
              g,
              b,
              a,
              lum: lum.toFixed(1),
              nearWhite,
              opaque,
            });
          }
          if (opaqueCount >= Math.min(3, slotDefinitions.length)) {
            console.log(
              "[PHOTOSTRIP][DEBUG] Template appears to be solid/opaque over slots; auto re-layering photos above template"
            );
            baseImage = baseImage.composite(
              overlays.map((o) => ({ ...o, blend: "over" }))
            );
          }
        } catch (e) {
          console.log(
            "[PHOTOSTRIP][DEBUG] Template coverage detection failed",
            e.message
          );
        }
      }
    }

    // Force photos above template if explicitly requested (re-layer)
    if (customization.forcePhotoAboveTemplate) {
      baseImage = baseImage.composite(overlays);
      if (debugMode)
        console.log(
          "[PHOTOSTRIP][DEBUG] Re-applied photo overlays above template"
        );
    }
    if (footerComposite) {
      baseImage = baseImage.composite([footerComposite]);
    }

    // Optional slot outline debug overlay (after photos, before write)
    if (debugMode && customization.debugSlots !== false) {
      const outlineSvgParts = slotDefinitions.slice(0, 50).map((s, i) => {
        const color = [
          "#FF3B30",
          "#34C759",
          "#FF9500",
          "#AF52DE",
          "#0A84FF",
          "#30B0C7",
        ][i % 6];
        return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${
          s.height
        }" fill="none" stroke="${color}" stroke-width="${Math.max(
          2,
          Math.round(outputWidth * 0.002)
        )}" />`;
      });
      const outlineSvg = `<svg width="${outputWidth}" height="${outputHeight}" xmlns="http://www.w3.org/2000/svg">${outlineSvgParts.join(
        ""
      )}</svg>`;
      baseImage = baseImage.composite([
        { input: Buffer.from(outlineSvg), top: 0, left: 0 },
      ]);
    }
    // Final safety: flatten onto opaque white so hidden alpha becomes visible (unless skipped)
    if (!customization.skipFinalFlatten) {
      try {
        baseImage = baseImage.flatten({
          background: customization.finalFlattenBackground || "#ffffff",
        });
        if (debugMode)
          console.log("[PHOTOSTRIP][DEBUG] Applied final flatten background");
      } catch (e) {
        if (debugMode)
          console.log("[PHOTOSTRIP][DEBUG] Final flatten failed", e.message);
      }
    } else if (debugMode) {
      console.log("[PHOTOSTRIP][DEBUG] skipFinalFlatten=true");
    }
    const finalPipeline = baseImage.jpeg({
      quality: clampNumber(customization.quality ?? 90, 40, 100),
    });
    await finalPipeline.toFile(outputPath);
    if (debugMode) {
      const debugOut = outputPath.replace(/\.jpg$/i, "-debug.jpg");
      try {
        await sharp(outputPath)
          .composite([])
          .jpeg({ quality: 80 })
          .toFile(debugOut);
        console.log("[PHOTOSTRIP][DEBUG] Wrote debug duplicate", debugOut);
      } catch (e) {
        console.log(
          "[PHOTOSTRIP][DEBUG] Could not write debug duplicate",
          e.message
        );
      }
    }

    if (customization.debugReturnPhotosOnly && photosOnlyPathRef) {
      session.photostripPath = `/uploads/photostrips/${path.basename(
        photosOnlyPathRef
      )}`;
      if (debugMode)
        console.log("[PHOTOSTRIP][DEBUG] Returning photos-only path to client");
    } else {
      session.photostripPath = `/uploads/photostrips/${outputFilename}`;
    }
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
        layout: layout || (hasTemplateSlots ? "templateSlots" : "auto"),
        photosOnlyPath: photosOnlyPathRef
          ? `/uploads/photostrips/${path.basename(photosOnlyPathRef)}`
          : undefined,
        finalCompositePath: `/uploads/photostrips/${outputFilename}`,
        debug: debugMode
          ? {
              overlays: overlays.length,
              slots: slotDefinitions.length,
              footer: !!footerComposite,
              returnedPhotosOnly: customization.debugReturnPhotosOnly || false,
            }
          : undefined,
      },
      session: {
        id: session.sessionId,
        status: session.status,
        photostripPath: session.photostripPath,
        photosOnlyPath: photosOnlyPathRef
          ? `/uploads/photostrips/${path.basename(photosOnlyPathRef)}`
          : undefined,
        finalCompositePath: `/uploads/photostrips/${outputFilename}`,
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
