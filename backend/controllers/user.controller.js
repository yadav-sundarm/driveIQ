import User from "../models/User.js";
import axios from "axios";

export const getTrainingStatus = async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:8000/training-status/${req.user.id}`,
    );
    res.status(200).json(response.data);
  } catch (error) {
    // ML service might be down — return a safe default
    res.status(200).json({
      trained: false,
      reason: "ml_service_unavailable",
      detail: "ML service is not reachable.",
    });
  }
};

export const getThreshold = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("confidenceThreshold");
    res
      .status(200)
      .json({ confidenceThreshold: user?.confidenceThreshold ?? 0.8 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateThreshold = async (req, res) => {
  try {
    const { confidenceThreshold } = req.body;

    if (
      typeof confidenceThreshold !== "number" ||
      confidenceThreshold < 0 ||
      confidenceThreshold > 1
    ) {
      return res.status(400).json({
        message: "confidenceThreshold must be a number between 0 and 1",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { confidenceThreshold },
      { new: true },
    ).select("confidenceThreshold");

    res.status(200).json({ confidenceThreshold: user.confidenceThreshold });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
