import DriveNode from "../models/DriveNode.js";
import User from "../models/User.js";
import { google } from "googleapis";
import FileAction from "../models/FileAction.js";

const getDriveClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.drive({ version: "v3", auth });
};

// Get or fetch children of a node
export const getNodeChildren = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nodeId } = req.params; // "root" or a folder ID

    // Check DB first
    const cached = await DriveNode.findOne({ userId, nodeId });
    if (cached && cached.isLoaded) {
      // Fetch all children from DB
      const children = await DriveNode.find({
        userId,
        nodeId: { $in: cached.children },
      });
      return res.status(200).json({ children, fromCache: true });
    }

    // Not cached — hit Drive API
    const user = await User.findById(userId);
    const drive = getDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
    );

    const query =
      nodeId === "root"
        ? "'root' in parents and trashed=false"
        : `'${nodeId}' in parents and trashed=false`;

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType, parents)",
      pageSize: 100,
      orderBy: "folder,name",
    });

    const files = response.data.files || [];

    // Save each child to DB
    const childIds = [];
    for (const file of files) {
      await DriveNode.findOneAndUpdate(
        { userId, nodeId: file.id },
        {
          userId,
          nodeId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          parentId: nodeId,
          isLoaded: false,
          lastFetched: new Date(),
        },
        { upsert: true, new: true },
      );
      childIds.push(file.id);
    }

    // Mark parent as loaded
    await DriveNode.findOneAndUpdate(
      { userId, nodeId },
      {
        userId,
        nodeId,
        name: nodeId === "root" ? "My Drive" : cached?.name || "Folder",
        mimeType: "application/vnd.google-apps.folder",
        parentId: null,
        children: childIds,
        isLoaded: true,
        lastFetched: new Date(),
      },
      { upsert: true, new: true },
    );

    const children = await DriveNode.find({
      userId,
      nodeId: { $in: childIds },
    });
    res.status(200).json({ children, fromCache: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Force refresh a node — reset isLoaded, next expand re-fetches from Drive
export const refreshNode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nodeId } = req.params;

    await DriveNode.findOneAndUpdate({ userId, nodeId }, { isLoaded: false });

    res
      .status(200)
      .json({ message: "Node reset, will refresh on next expand" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nodeId } = req.params;
    const { name } = req.body;

    const user = await User.findById(userId);
    const drive = getDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
    );

    // Create in Drive
    const folder = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [nodeId === "root" ? "root" : nodeId],
      },
      fields: "id, name, mimeType",
    });

    const newNodeId = folder.data.id;

    // Save to DB
    await DriveNode.create({
      userId,
      nodeId: newNodeId,
      name,
      mimeType: "application/vnd.google-apps.folder",
      parentId: nodeId,
      isLoaded: true,
      children: [],
      lastFetched: new Date(),
    });

    // Update parent's children array in DB
    await DriveNode.findOneAndUpdate(
      { userId, nodeId },
      { $push: { children: newNodeId } },
    );

    res
      .status(201)
      .json({ nodeId: newNodeId, name, mimeType: folder.data.mimeType });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteNode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nodeId } = req.params;

    const user = await User.findById(userId);
    const drive = getDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
    );

    // Delete from Drive (moves to trash)
    await drive.files.delete({ fileId: nodeId });

    // Remove from DB
    const node = await DriveNode.findOneAndDelete({ userId, nodeId });

    // Remove from parent's children array
    if (node?.parentId) {
      await DriveNode.findOneAndUpdate(
        { userId, nodeId: node.parentId },
        { $pull: { children: nodeId } },
      );
    }

    // Also clean up FileAction if exists
    await FileAction.findOneAndUpdate(
      { userId, fileId: nodeId },
      { status: "rejected" },
    );

    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const renameNode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nodeId } = req.params;
    const { name } = req.body;

    const user = await User.findById(userId);
    const drive = getDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
    );

    // Rename in Drive
    await drive.files.update({
      fileId: nodeId,
      requestBody: { name },
    });

    // Update in DB
    await DriveNode.findOneAndUpdate({ userId, nodeId }, { name });

    res.status(200).json({ message: "Renamed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
