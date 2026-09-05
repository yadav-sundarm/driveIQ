import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import connectDB from "./db/db.js";
import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import fileActionRoutes from "./routes/fileAction.routes.js";
import User from "./models/User.js";
import { startPolling } from "./services/polling.service.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Resume polling for every already-authenticated user on boot
    const usersWithDrive = await User.find({
      googleRefreshToken: { $exists: true, $ne: null },
    });
    usersWithDrive.forEach((user) => startPolling(user._id.toString()));

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
  }
};

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/files", fileActionRoutes);

startServer();
