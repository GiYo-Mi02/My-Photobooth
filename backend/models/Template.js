import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
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
    thumbnailPath: {
      type: String,
    },
    size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    dimensions: {
      width: {
        type: Number,
        required: true,
      },
      height: {
        type: Number,
        required: true,
      },
    },
    photoSlots: [
      {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        rotation: { type: Number, default: 0 },
        borderRadius: { type: Number, default: 0 },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      enum: ["classic", "modern", "fun", "elegant", "holiday", "custom"],
      default: "custom",
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    metadata: {
      colorMode: String,
      dpi: Number,
      format: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
templateSchema.index({ isActive: 1, category: 1 });
templateSchema.index({ uploadedBy: 1 });
templateSchema.index({ usageCount: -1 });

// Update usage count when template is used
templateSchema.methods.incrementUsage = function () {
  this.usageCount += 1;
  return this.save();
};

export default mongoose.model("Template", templateSchema);
