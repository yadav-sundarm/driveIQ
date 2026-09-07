import express from "express";
import {
  getNodeChildren,
  refreshNode,
  createFolder,
  deleteNode,
  renameNode,
  moveNode,
} from "../controllers/driveTree.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/:nodeId/children", authMiddleware, getNodeChildren);
router.post("/:nodeId/refresh", authMiddleware, refreshNode);
router.post("/:nodeId/folder", authMiddleware, createFolder);
router.delete("/:nodeId", authMiddleware, deleteNode);
router.patch("/:nodeId/rename", authMiddleware, renameNode);
router.patch("/:nodeId/move", authMiddleware, moveNode);
export default router;
