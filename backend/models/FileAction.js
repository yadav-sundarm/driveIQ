import mongoose from "mongoose";

const fileActionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: { type: String, required: true },
    fileId: { type: String, required: true },
    fromFolder: { type: String },
    toFolder: { type: String },
    category: { type: String },
    subject: { type: String },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected"],
      default: "pending",
    },
    confidence: { type: Number },
  },
  { timestamps: true },
);

const FileAction = mongoose.model("FileAction", fileActionSchema);
export default FileAction;