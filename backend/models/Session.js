import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        return `session_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Allow anonymous sessions
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
    totalPhotos: {
      type: Number,
      default: 0,
      max: 10,
    },
    selectedPhotos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Photo",
      },
    ],
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      default: null,
    },
    photostripPath: {
      type: String,
      default: null,
    },
    settings: {
      photoInterval: {
        type: Number,
        default: 15000, // 15 seconds in milliseconds
      },
      maxPhotos: {
        type: Number,
        default: 10,
      },
      autoAdvance: {
        type: Boolean,
        default: true,
      },
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
      startTime: {
        type: Date,
        default: Date.now,
      },
      endTime: Date,
      duration: Number, // in milliseconds
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
sessionSchema.index({ userId: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ createdAt: -1 });

export default mongoose.model("Session", sessionSchema);
