import express from "express";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Register
router.post(
  "/register",
  [
    body("username").isLength({ min: 3, max: 30 }).trim(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, role = "user" } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        return res.status(400).json({
          error: "User with this email or username already exists",
        });
      }

      // Create new user
      const user = new User({
        username,
        email,
        password,
        role: role === "admin" ? "admin" : "user", // Only allow admin if explicitly set
      });

      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        message: "User created successfully",
        token,
        user,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Server error during registration" });
    }
  }
);

// Login
router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").exists()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        message: "Login successful",
        token,
        user,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Server error during login" });
    }
  }
);

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update user profile
router.put(
  "/profile",
  authMiddleware,
  [
    body("username").optional().isLength({ min: 3, max: 30 }).trim(),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email } = req.body;
      const userId = req.user.userId;

      // Check for duplicate username/email
      if (username || email) {
        const existingUser = await User.findOne({
          _id: { $ne: userId },
          $or: [
            ...(username ? [{ username }] : []),
            ...(email ? [{ email }] : []),
          ],
        });

        if (existingUser) {
          return res.status(400).json({
            error: "Username or email already taken",
          });
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { ...(username && { username }), ...(email && { email }) },
        { new: true, runValidators: true }
      );

      res.json({
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Server error during profile update" });
    }
  }
);

// Get all users (admin only)
router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;

    const query = search
      ? {
          $or: [
            { username: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const users = await User.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

// Dev-only: create a default admin user for seeding tasks
if (process.env.NODE_ENV !== "production") {
  router.post("/dev/seed-admin", async (req, res) => {
    try {
      const {
        email = "admin@local",
        username = "admin",
        password = "admin1234",
        reset = false,
      } = req.body || {};

      let user = await User.findOne({ email });
      if (user) {
        let updated = false;
        if (user.role !== "admin") {
          user.role = "admin";
          updated = true;
        }
        if (reset) {
          user.password = password; // will be hashed by pre-save
          updated = true;
        }
        if (updated) await user.save();
        return res.json({
          message: updated ? "Admin updated" : "Admin already exists",
          user,
        });
      }

      user = new User({
        username,
        email,
        password,
        role: "admin",
        isActive: true,
      });
      await user.save();
      return res.status(201).json({ message: "Admin created", user });
    } catch (e) {
      console.error("Seed admin error:", e);
      return res.status(500).json({ error: "Failed to seed admin" });
    }
  });
}
