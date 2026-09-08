import express from "express";
import {
  getThreshold,
  updateThreshold,
} from "../controllers/user.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/me/threshold", authMiddleware, getThreshold);
router.patch("/me/threshold", authMiddleware, updateThreshold);

export default router;
