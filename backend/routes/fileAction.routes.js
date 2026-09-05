import express from "express";
import {
  getPendingActions,
  confirmAction,
  rejectAction,
  getFileHistory,
  scanExisting,
  triggerPoll,
} from "../controllers/fileAction.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/pending", authMiddleware, getPendingActions);
router.get("/history", authMiddleware, getFileHistory);
router.post("/scan", authMiddleware, scanExisting);
router.post("/poll-now", authMiddleware, triggerPoll);
router.patch("/:id/confirm", authMiddleware, confirmAction);
router.patch("/:id/reject", authMiddleware, rejectAction);

export default router;
