import express from "express";
import {
  getPendingActions,
  confirmAction,
  rejectAction,
  getFileHistory,
} from "../controllers/fileAction.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/pending", authMiddleware, getPendingActions);
router.get("/history", authMiddleware, getFileHistory);
router.patch("/:id/confirm", authMiddleware, confirmAction);
router.patch("/:id/reject", authMiddleware, rejectAction);

export default router;
