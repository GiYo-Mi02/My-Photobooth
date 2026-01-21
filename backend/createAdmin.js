import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";

dotenv.config();

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/photobooth", {
      dbName: process.env.MONGODB_DB_NAME || "photobooth",
    });
    console.log("✅ Connected to MongoDB");

    const email = process.env.ADMIN_EMAIL || "admin@local";
    const password = process.env.ADMIN_PASSWORD || "admin1234";
    const username = process.env.ADMIN_USERNAME || "admin";

    // Check if admin exists
    let admin = await User.findOne({ email });

    if (admin) {
      console.log("\n📋 Admin user already exists:");
      console.log("   Email:", admin.email);
      console.log("   Username:", admin.username);
      console.log("   Role:", admin.role);
      console.log("   Active:", admin.isActive);
      
      if (admin.role !== "admin") {
        console.log("\n⚠️  User exists but is not admin. Updating role...");
        admin.role = "admin";
        await admin.save();
        console.log("✅ Role updated to admin");
      }
    } else {
      console.log("\n🆕 Creating new admin user...");
      admin = new User({
        username,
        email,
        password,
        role: "admin",
        isActive: true,
      });
      await admin.save();
      console.log("✅ Admin user created successfully!");
      console.log("   Email:", email);
      console.log("   Username:", username);
      console.log("   Password:", password);
    }

    console.log("\n✅ You can now login with:");
    console.log("   Email:", email);
    console.log("   Password:", password);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createAdmin();
