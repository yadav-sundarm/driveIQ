import FileAction from "../models/FileAction.js";
import { executeMove } from "../services/drive.service.js";

export const getPendingActions = async (req, res) => {
  try {
    const actions = await FileAction.find({
      userId: req.user.id,
      status: "pending",
    }).sort({ createdAt: -1 });
    res.status(200).json(actions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const confirmAction = async (req, res) => {
  try {
    const action = await FileAction.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!action) return res.status(404).json({ message: "Action not found" });

    const updatedAction = await executeMove(req.user.id, req.params.id);
    res.status(200).json(updatedAction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectAction = async (req, res) => {
  try {
    const action = await FileAction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { status: "rejected" },
      { new: true },
    );
    if (!action) return res.status(404).json({ message: "Action not found" });
    res.status(200).json(action);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getFileHistory = async (req, res) => {
  try {
    const actions = await FileAction.find({
      userId: req.user.id,
      status: { $in: ["confirmed", "rejected"] },
    })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(actions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
