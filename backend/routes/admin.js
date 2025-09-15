import express from "express";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import User from "../models/User.js";
import Session from "../models/Session.js";
import Template from "../models/Template.js";
import Photo from "../models/Photo.js";

const router = express.Router();

// Admin: consolidated stats for dashboard
router.get("/stats", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [totalUsers, totalSessions, totalTemplates, totalPhotos] =
      await Promise.all([
        User.countDocuments({}),
        Session.countDocuments({}),
        Template.countDocuments({ isActive: true }),
        Photo.countDocuments({}),
      ]);

    // Sessions by status
    const statusAgg = await Session.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const sessionsByStatus = statusAgg.reduce((acc, cur) => {
      acc[cur._id || "unknown"] = cur.count;
      return acc;
    }, {});

    // Top templates by usage
    const topTemplates = await Template.find({ isActive: true })
      .sort({ usageCount: -1 })
      .limit(5)
      .select("name usageCount category thumbnailPath path");

    // Sessions in last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 6); // include today
    const dailyAgg = await Session.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    ]);

    res.json({
      totals: { totalUsers, totalSessions, totalTemplates, totalPhotos },
      sessionsByStatus,
      topTemplates,
      dailySessions: dailyAgg.map((x) => ({
        date: new Date(x._id.y, x._id.m - 1, x._id.d),
        count: x.count,
      })),
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

export default router;
