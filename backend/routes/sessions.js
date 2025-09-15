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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

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
    const { status, templateId, selectedPhotos } = req.body;
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (status) session.status = status;
    if (templateId) session.templateId = templateId;
    if (selectedPhotos) session.selectedPhotos = selectedPhotos;
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
      },
    });
  } catch (error) {
    console.error("Update session error:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
});

// Generate photostrip (stub, actual image generation logic needed)
router.post("/:sessionId/photostrip", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      templateId,
      selectedPhotoIds,
      targetWidth,
      targetHeight,
      forceOrientation,
      customization,
    } = req.body;
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    // Here you would generate the photostrip image using selected photos and template
    // For now, just simulate
    session.photostripPath = `/uploads/photostrips/photostrip-${sessionId}.jpg`;
    session.status = "completed";
    await session.save();
    res.json({
      photostrip: {
        path: session.photostripPath,
        url: session.photostripPath,
        template: templateId,
        photosUsed: selectedPhotoIds?.length || 0,
      },
      session: {
        id: session.sessionId,
        status: session.status,
        photostripPath: session.photostripPath,
      },
      message: "Photostrip generated (stub)",
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
