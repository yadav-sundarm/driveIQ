import FileAction from "../models/FileAction.js";
import {
  executeMove,
  scanExistingFiles,
  verifyOrganization,
  sendTrainingSample,
} from "../services/drive.service.js";
import { pollOnce } from "../services/polling.service.js";

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

export const getNeedsReview = async (req, res) => {
  try {
    const actions = await FileAction.find({
      userId: req.user.id,
      status: "needs_review",
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

    // Lets needs_review items (or any manual override) specify the
    // category/subject to move into, instead of trusting the weak
    // guess that got it flagged in the first place
    const { category, subject } = req.body || {};
    if (category) action.category = category;
    if (subject !== undefined) action.subject = subject || null;
    if (category || subject !== undefined) await action.save();

    const updatedAction = await executeMove(req.user.id, req.params.id);

    // Every successful move — routine or a manual correction — feeds
    // back into the ML models
    await sendTrainingSample(req.user.id, updatedAction);

    res.status(200).json(updatedAction);
  } catch (error) {
    if (error.message?.includes("Increasing the number of parents")) {
      await FileAction.findByIdAndUpdate(req.params.id, {
        status: "failed",
        failReason:
          "File cannot be moved — it may be shared or have multiple parents",
      });
      return res.status(422).json({
        message:
          "This file cannot be moved automatically. It may be a shared file.",
        code: "UNMOVABLE_FILE",
      });
    }
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
      status: { $in: ["confirmed", "auto_confirmed", "rejected", "failed"] },
    })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(actions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const scanExisting = async (req, res) => {
  try {
    const queuedCount = await scanExistingFiles(req.user.id);
    res.status(200).json({ message: "Scan complete", queuedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const triggerPoll = async (req, res) => {
  try {
    const result = await pollOnce(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Manual poll error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const verifyFiles = async (req, res) => {
  try {
    const result = await verifyOrganization(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({ message: error.message });
  }
};
