import DriveNode from "../models/DriveNode.js";
import User from "../models/User.js";
import FileAction from "../models/FileAction.js";
import { getDriveClient, moveFile } from "../services/drive.service.js";

// Walk parentId links upward from newParentId looking for nodeId — if we
// find it, newParentId is (or is inside) one of nodeId's own subfolders,
// which would create a cycle. Capped depth as a guard against bad data.
const wouldCreateCycle = async (userId, nodeId, newParentId) => {
  let currentId = newParentId;
  let depth = 0;
  while (currentId && depth < 100) {
    if (currentId === nodeId) return true;
    const current = await DriveNode.findOne({ userId, nodeId: currentId });
    currentId = current?.parentId;
    depth++;
  }
  return false;
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
        parentId: nodeId === "root" ? null : (cached?.parentId ?? null),
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

    // Move to Drive's Trash — reversible, matches what Drive's own UI
    // calls "delete". files.delete() would be a *permanent* delete instead.
    await drive.files.update({
      fileId: nodeId,
      requestBody: { trashed: true },
    });

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

export const moveNode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nodeId } = req.params;
    const { newParentId } = req.body;

    if (!newParentId) {
      return res.status(400).json({ message: "newParentId is required" });
    }
    if (newParentId === nodeId) {
      return res
        .status(400)
        .json({ message: "Can't move an item into itself" });
    }
    if (await wouldCreateCycle(userId, nodeId, newParentId)) {
      return res.status(400).json({
        message: "Can't move a folder into one of its own subfolders",
      });
    }

    const user = await User.findById(userId);
    const drive = getDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
    );

    // Read the cache's current understanding of the parent *before*
    // moving, so we know which old-parent children array to pull from.
    const node = await DriveNode.findOne({ userId, nodeId });
    const oldParentId = node?.parentId;

    // Reuses the same moveFile() executeMove() already relies on for
    // confirmed suggestions, so both paths handle the parents swap (and
    // the same "multiple parents" Drive error) identically.
    await moveFile(drive, nodeId, newParentId);

    await DriveNode.findOneAndUpdate(
      { userId, nodeId },
      { parentId: newParentId },
    );

    if (oldParentId) {
      await DriveNode.findOneAndUpdate(
        { userId, nodeId: oldParentId },
        { $pull: { children: nodeId } },
      );
    }

    // $addToSet, not $push — if the destination was never cached this is a
    // no-op (findOneAndUpdate on a non-existent doc just matches nothing),
    // and it won't double-add if this node is somehow already listed.
    await DriveNode.findOneAndUpdate(
      { userId, nodeId: newParentId },
      { $addToSet: { children: nodeId } },
    );

    res.status(200).json({ message: "Moved" });
  } catch (error) {
    // Same graceful handling confirmAction() already uses for this case.
    if (error.message?.includes("Increasing the number of parents")) {
      return res.status(422).json({
        message:
          "This item can't be moved automatically — it may be shared with you and have multiple parents you don't fully own.",
        code: "UNMOVABLE_FILE",
      });
    }
    res.status(500).json({ message: error.message });
  }
};
