import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import fs from "fs/promises";
import Photo from "../models/Photo.js";
import Session from "../models/Session.js";
import { authMiddleware } from "../middleware/auth.js";
import { isCloudinaryConfigured, uploadImageBuffer } from "../lib/cloudinary.js";

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
    fileSize: 30 * 1024 * 1024, // 30MB
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "livePhoto") {
      const allowedVideoTypes = /webm|mp4|quicktime|ogg/;
      const extname = allowedVideoTypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = allowedVideoTypes.test(file.mimetype);
      if (mimetype && extname) {
        return cb(null, true);
      }
      return cb(new Error("Only video files are allowed for livePhoto!"));
    }

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
router.post(
  "/upload",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "livePhoto", maxCount: 1 },
  ]),
  async (req, res) => {
  try {
    const { sessionId, photoNumber, base64Data } = req.body;

    if (process.env.NODE_ENV !== "production") {
      console.log("[UPLOAD] incoming body keys:", Object.keys(req.body || {}));
      if (base64Data) {
        console.log(
          "[UPLOAD] base64 length:",
          base64Data.length,
          "startsWith(data:image:)",
          base64Data.startsWith("data:image")
        );
      }
    }

    if (!sessionId || !photoNumber) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[UPLOAD] Missing required fields. sessionId:",
          sessionId,
          "photoNumber:",
          photoNumber
        );
      }
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

    // Enforce max photos per session dynamically (default to 6) using atomic increment
    // Attempt to increment; if already at limit, reject
    const maxPhotos = session.settings?.maxPhotos || 6;
    const updatedSession = await Session.findOneAndUpdate(
      { _id: session._id, totalPhotos: { $lt: maxPhotos } },
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
        if (process.env.NODE_ENV !== "production") {
          console.warn("[UPLOAD] Invalid base64 header/pattern");
        }
        return res.status(400).json({ error: "Invalid base64 data" });
      }

      mimeType = matches[1];
      const imageBuffer = Buffer.from(matches[2], "base64");

      filename = `photo-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      const photosDir = path.join(__dirname, "..", "..", "uploads", "photos");
      await fs.mkdir(photosDir, { recursive: true });
      photoPath = path.join(photosDir, filename);
      originalName = `photo-${photoNumber}.jpg`;

      // Process and save the image
      await sharp(imageBuffer).jpeg({ quality: 85 }).toFile(photoPath);

      fileSize = imageBuffer.length;
    }
    // Handle file upload
    else if (req.files && req.files.photo && req.files.photo[0]) {
      const photoFile = req.files.photo[0];
      filename = photoFile.filename;
      photoPath = photoFile.path;
      originalName = photoFile.originalname;
      fileSize = photoFile.size;
      mimeType = photoFile.mimetype;
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[UPLOAD] No base64Data and no file present");
      }
      return res.status(400).json({
        error: "No photo data provided",
      });
    }

    let livePhotoPath = null;
    if (req.files && req.files.livePhoto && req.files.livePhoto[0]) {
      livePhotoPath = `/uploads/photos/${req.files.livePhoto[0].filename}`;
    }

    // Upload to Cloudinary if configured
    let cloudinaryData = null;
    let cloudinaryLiveUrl = null;
    const cloudinaryEnabled = isCloudinaryConfigured();

    if (cloudinaryEnabled) {
      try {
        const photoBuf = await fs.readFile(photoPath);
        const uploadRes = await uploadImageBuffer(photoBuf, {
          folder: `giopix/sessions/${sessionId}/photos`,
          public_id: `photo-${assignedPhotoNumber}-${Date.now()}`,
          format: "jpg",
        });
        cloudinaryData = {
          publicId: uploadRes.public_id,
          version: uploadRes.version,
          secureUrl: uploadRes.secure_url,
        };
      } catch (err) {
        console.warn("[UPLOAD] Cloudinary photo upload failed, using local fallback:", err.message);
      }

      if (req.files && req.files.livePhoto && req.files.livePhoto[0]) {
        try {
          const liveFile = req.files.livePhoto[0];
          const liveBuf = await fs.readFile(liveFile.path);
          const uploadRes = await uploadImageBuffer(liveBuf, {
            resource_type: "video",
            folder: `giopix/sessions/${sessionId}/live-photos`,
            public_id: `live-${assignedPhotoNumber}-${Date.now()}`,
          });
          cloudinaryLiveUrl = uploadRes.secure_url;
        } catch (err) {
          console.warn("[UPLOAD] Cloudinary live video upload failed, using local fallback:", err.message);
        }
      }
    }

    // Get image metadata
    const metadata = await sharp(photoPath).metadata();

    // Create photo document
    const photo = new Photo({
      sessionId: session._id,
      filename,
      originalName,
      path: cloudinaryData?.secureUrl || `/uploads/photos/${filename}`,
      livePhotoPath: cloudinaryLiveUrl || livePhotoPath,
      storageProvider: cloudinaryData ? "cloudinary" : "local",
      cloudinary: cloudinaryData || undefined,
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

    // Update session status/timestamps if reached limit
    if (updatedSession.totalPhotos >= maxPhotos) {
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
