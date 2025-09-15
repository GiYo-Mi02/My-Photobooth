import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import User from "./models/User.js";

// Import routes
import authRoutes from "./routes/auth.js";
import photoRoutes from "./routes/photos.js";
import templateRoutes from "./routes/templates.js";
import sessionRoutes from "./routes/sessions.js";
import adminRoutes from "./routes/admin.js";

// ES6 __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Rate limiting (softer in development)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "production" ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-domain.com"]
        : ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Ensure uploads subfolders exist
import fs from "fs";
const ensureDirs = [
  path.join(__dirname, "../uploads"),
  path.join(__dirname, "../uploads/templates"),
  path.join(__dirname, "../uploads/photostrips"),
  path.join(__dirname, "../uploads/photos"),
];
ensureDirs.forEach((p) => {
  try {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    console.warn("Failed to ensure dir:", p, e.message);
  }
});

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/photobooth", {
    dbName: process.env.MONGODB_DB_NAME || "photobooth",
  })
  .then(async () => {
    console.log("MongoDB connected successfully");
    await ensureAdminUser();
  })
  .catch((err) => console.error("MongoDB connection error:", err.message));

// Ensure an admin account exists if ENV vars are set
async function ensureAdminUser() {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return; // no seeding requested

    const username = process.env.ADMIN_USERNAME || email.split("@")[0];
    let user = await User.findOne({ email });
    if (user) {
      if (user.role !== "admin") {
        user.role = "admin";
        await user.save();
      }
      return;
    }

    user = new User({
      username,
      email,
      password,
      role: "admin",
      isActive: true,
    });
    await user.save();
    if (process.env.NODE_ENV !== "production") {
      console.log("Admin user ensured (dev)");
    }
  } catch (e) {
    console.error("Failed to ensure admin user:", e.message);
  }
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/admin", adminRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
