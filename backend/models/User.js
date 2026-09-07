import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    avatar: { type: String },
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
    notificationPreference: {
      type: String,
      enum: ["email", "app", "both"],
      default: "both",
    },
    confidenceThreshold: { type: Number, default: 0.8, min: 0, max: 1 },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
export default User;
