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

const NON_ORGANIZABLE_TYPES = [
  "application/vnd.google-apps.folder",
  "application/vnd.google-apps.shortcut",
];

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

export const classifyFile = async (fileName, mimeType, userName = "") => {
  try {
    const response = await axios.post("http://localhost:8000/classify", {
      file_name: fileName,
      mime_type: mimeType,
      user_name: userName,
    });
    return response.data;
  } catch (error) {
    console.error("ML service error:", error.message);
    return {
      category: "Miscellaneous",
      confidence: 0,
      keywords: [],
      subject: null,
    };
  }
};

export const processNewFile = async (userId, fileId, fileName, mimeType) => {
  try {
    const existing = await FileAction.findOne({ fileId, userId });
    if (existing) return null;

    const user = await User.findById(userId);
    const classification = await classifyFile(
      fileName,
      mimeType,
      user?.name || "",
    );

    const action = await FileAction.create({
      userId,
      fileName,
      fileId,
      category: classification.category,
      subject: classification.subject || null,
      confidence: classification.confidence,
      status: "pending",
    });

    return action;
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
};

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
      if (NON_ORGANIZABLE_TYPES.includes(file.mimeType)) continue;

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

export const verifyOrganization = async (userId) => {
  const user = await User.findById(userId);
  const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

  const actions = await FileAction.find({
    userId,
    status: { $in: ["pending", "confirmed", "rejected"] },
  });

  let checked = 0;
  let misplacedCount = 0;
  let reclassifiedCount = 0;
  let reconsideredCount = 0;

  for (const action of actions) {
    try {
      const file = await drive.files.get({
        fileId: action.fileId,
        fields: "parents, mimeType, name",
      });

      const classification = await classifyFile(
        file.data.name,
        file.data.mimeType,
        user?.name || "",
      );
      const changed =
        classification.subject !== action.subject ||
        classification.category !== action.category;

      if (changed) {
        action.category = classification.category;
        action.subject = classification.subject || null;
        reclassifiedCount++;
      }

      checked++;

      if (action.status === "rejected") {
        if (changed) {
          action.status = "pending";
          reconsideredCount++;
        }
      } else if (action.status === "confirmed") {
        const parentId = (file.data.parents || [])[0];
        let actualFolderName = null;
        if (parentId) {
          const folder = await drive.files.get({
            fileId: parentId,
            fields: "name",
          });
          actualFolderName = folder.data.name;
        }

        const expectedFolderName = action.subject || action.category;
        if (actualFolderName !== expectedFolderName) {
          action.status = "pending";
          misplacedCount++;
        }
      }

      await action.save();
    } catch (error) {
      console.error(`Error verifying file ${action.fileId}:`, error.message);
    }
  }

  return { checked, misplacedCount, reclassifiedCount, reconsideredCount };
};

export const executeMove = async (userId, actionId) => {
  try {
    const user = await User.findById(userId);
    const drive = getDriveClient(
      user.googleAccessToken,
      user.googleRefreshToken,
    );
    const action = await FileAction.findById(actionId);

    const categoryFolderId = await getOrCreateFolder(drive, action.category);

    let targetFolderId = categoryFolderId;
    let toFolderLabel = action.category;

    if (action.subject) {
      targetFolderId = await getOrCreateFolder(
        drive,
        action.subject,
        categoryFolderId,
      );
      toFolderLabel = `${action.category}/${action.subject}`;
    }

    await moveFile(drive, action.fileId, targetFolderId);

    action.toFolder = toFolderLabel;
    action.status = "confirmed";
    await action.save();

    return action;
  } catch (error) {
    console.error("Error executing move:", error);
    throw error;
  }
};
