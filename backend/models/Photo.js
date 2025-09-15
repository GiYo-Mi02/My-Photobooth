import mongoose from "mongoose";

const photoSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    photoNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
    filters: {
      brightness: { type: Number, default: 100 },
      contrast: { type: Number, default: 100 },
      saturation: { type: Number, default: 100 },
      blur: { type: Number, default: 0 },
      grayscale: { type: Boolean, default: false },
      sepia: { type: Boolean, default: false },
      vintage: { type: Boolean, default: false },
    },
    metadata: {
      width: Number,
      height: Number,
      format: String,
      colorSpace: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
photoSchema.index({ sessionId: 1, photoNumber: 1 });
photoSchema.index({ sessionId: 1, isSelected: 1 });

export default mongoose.model("Photo", photoSchema);
