import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  getThreshold,
  updateThreshold,
  getTrainingStatus,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me/threshold", authMiddleware, getThreshold);
router.patch("/me/threshold", authMiddleware, updateThreshold);
router.get("/me/training-status", authMiddleware, getTrainingStatus);
export default router;
