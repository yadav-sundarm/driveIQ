import { google } from "googleapis";
import User from "../models/User.js";
import FileAction from "../models/FileAction.js";
import axios from "axios";

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

// Get or create a folder in Drive
export const getOrCreateFolder = async (drive, folderName, parentId = null) => {
  const query = parentId
    ? `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await drive.files.list({ q: query, fields: "files(id, name)" });

  if (res.data.files.length > 0) return res.data.files[0].id;

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId && { parents: [parentId] }),
    },
    fields: "id",
  });
  return folder.data.id;
};

// Move a file to a folder
export const moveFile = async (drive, fileId, folderId) => {
  const file = await drive.files.get({ fileId, fields: "parents" });
  const previousParents = (file.data.parents || []).join(",");

  await drive.files.update({
    fileId,
    addParents: folderId,
    ...(previousParents && { removeParents: previousParents }),
    fields: "id, parents",
  });
};

// Classify file via ML service
export const classifyFile = async (fileName, mimeType) => {
  try {
    const response = await axios.post("http://localhost:8000/classify", {
      file_name: fileName,
      mime_type: mimeType,
    });
    return response.data;
  } catch (error) {
    console.error("ML service error:", error.message);
    return { category: "Miscellaneous", confidence: 0, keywords: [] };
  }
};

// Main function — process a file (skips if already tracked)
export const processNewFile = async (userId, fileId, fileName, mimeType) => {
  try {
    const existing = await FileAction.findOne({ fileId, userId });
    if (existing) return null; // already have a record for this file

    const classification = await classifyFile(fileName, mimeType);

    const action = await FileAction.create({
      userId,
      fileName,
      fileId,
      category: classification.category,
      confidence: classification.confidence,
      status: "pending",
    });

    return action;
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
};

// Scan the user's entire Drive and queue anything not yet tracked
export const scanExistingFiles = async (userId) => {
  const user = await User.findById(userId);
  const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

  let pageToken = null;
  let queuedCount = 0;

  do {
    const response = await drive.files.list({
      q: "trashed=false",
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 100,
      pageToken,
    });

    const files = response.data.files || [];

    for (const file of files) {
      if (file.mimeType.startsWith("application/vnd.google-apps")) continue;

      const action = await processNewFile(
        userId,
        file.id,
        file.name,
        file.mimeType,
      );
      if (action) queuedCount++;
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return queuedCount;
};

// Execute confirmed move
export const executeMove = async (userId, actionId) => {
  try {
    const user = await User.findById(userId);
    const drive = getDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
    );
    const action = await FileAction.findById(actionId);

    // Get or create the category folder
    const folderId = await getOrCreateFolder(drive, action.category);

    // Move the file
    await moveFile(drive, action.fileId, folderId);

    // Update action
    action.toFolder = action.category;
    action.status = "confirmed";
    await action.save();

    return action;
  } catch (error) {
    console.error("Error executing move:", error);
    throw error;
  }
};
