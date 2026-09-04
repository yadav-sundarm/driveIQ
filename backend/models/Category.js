import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    keywords: { type: [String], required: true },
    driveFolderId: { type: String },
    color: { type: String, default: "#4F46E5" },
  },
  { timestamps: true },
);

const Category = mongoose.model("Category", categorySchema);
export default Category;
