import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Authentication middleware
export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: "Invalid token. User not found or inactive." });
    }

    req.user = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired." });
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Server error during authentication." });
  }
};

// Admin authorization middleware
export const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Access denied. Admin privileges required.",
    });
  }
  next();
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");

      if (user && user.isActive) {
        req.user = {
          userId: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};
