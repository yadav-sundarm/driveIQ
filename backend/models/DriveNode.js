import mongoose from "mongoose";

const driveNodeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    nodeId: { type: String, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    parentId: { type: String, default: null },
    children: [{ type: String }],
    isLoaded: { type: Boolean, default: false },
    lastFetched: { type: Date },
  },
  { timestamps: true },
);

driveNodeSchema.index({ userId: 1, nodeId: 1 }, { unique: true });

const DriveNode = mongoose.model("DriveNode", driveNodeSchema);
export default DriveNode;
