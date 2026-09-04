import express from "express";
import {
  googleAuth,
  googleCallback,
  getMe,
} from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);
router.get("/me", authMiddleware, getMe);

export default router;
