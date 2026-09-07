import { google } from "googleapis";
import User from "../models/User.js";
import FileAction from "../models/FileAction.js";
import axios from "axios";
import Category from "../models/Category.js";

export const getDriveClient = (accessToken, refreshToken) => {
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

const HINT_STOPWORDS = new Set([
  "of",
  "the",
  "a",
  "an",
  "in",
  "on",
  "at",
  "to",
  "for",
  "and",
  "or",
  "is",
  "it",
  "by",
  "as",
  "be",
  "was",
  "were",
  "this",
  "that",
  "pdf",
  "docx",
  "doc",
  "jpg",
  "jpeg",
  "png",
  "zip",
]);

const extractSimpleKeywords = (fileName) => {
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  return nameWithoutExt
    .split(/[_\-\s]+/)
    .map((t) => t.replace(/[^A-Za-z0-9]/g, "").toLowerCase())
    .filter(
      (t) => t && t.length >= 2 && !/^\d+$/.test(t) && !HINT_STOPWORDS.has(t),
    );
};

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

export const classifyFile = async (
  fileName,
  mimeType,
  userName = "",
  knownSubjects = {},
  userId = null,
) => {
  try {
    const response = await axios.post("http://localhost:8000/classify", {
      file_name: fileName,
      mime_type: mimeType,
      user_name: userName,
      known_subjects: knownSubjects,
      user_id: userId,
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

// Sends a confirmed (category, subject) decision back to the ML service
// so both the per-user TF-IDF model and the embedding index learn from
// it — called after any successful move, whether it was a manual
// confirm or an automatic one.
export const sendTrainingSample = async (userId, action) => {
  try {
    await axios.post("http://localhost:8000/add-sample", {
      user_id: userId.toString(),
      file_name: action.fileName,
      category: action.category,
      subject: action.subject,
    });
  } catch (error) {
    console.error("Failed to send training sample:", error.message);
  }
};

export const discoverExistingOrganization = async (drive) => {
  const folders = [];
  let pageToken = null;

  do {
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "nextPageToken, files(id, name, parents)",
      pageSize: 100,
      pageToken,
    });

    for (const f of response.data.files || []) {
      folders.push({
        id: f.id,
        name: f.name,
        parentId: (f.parents || [])[0] || null,
      });
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  const folderIds = new Set(folders.map((f) => f.id));

  const topLevelFolders = folders.filter(
    (f) => !f.parentId || !folderIds.has(f.parentId),
  );

  const subjectFolders = folders.filter(
    (f) => f.parentId && topLevelFolders.some((t) => t.id === f.parentId),
  );

  const knownSubjects = {};

  for (const subjectFolder of subjectFolders) {
    const keywordCounts = {};
    let filePageToken = null;

    do {
      const filesRes = await drive.files.list({
        q: `'${subjectFolder.id}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`,
        fields: "nextPageToken, files(name)",
        pageSize: 100,
        pageToken: filePageToken,
      });

      for (const file of filesRes.data.files || []) {
        for (const kw of extractSimpleKeywords(file.name)) {
          keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
        }
      }

      filePageToken = filesRes.data.nextPageToken;
    } while (filePageToken);

    const learnedKeywords = Object.entries(keywordCounts)
      .filter(([, count]) => count > 1)
      .map(([kw]) => kw);

    knownSubjects[subjectFolder.name] = learnedKeywords;
  }

  return knownSubjects;
};

// Shared move logic — creates the category (and subject) folder and
// re-parents the file. Returns the toFolder label. Used by both the
// manual-confirm path and the new confidence-based auto-confirm path,
// so a future fix to move logic only needs to happen in one place.
const performDriveMove = async (drive, action) => {
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
  return toFolderLabel;
};

export const processNewFile = async (
  userId,
  fileId,
  fileName,
  mimeType,
  knownSubjects = {},
) => {
  try {
    const existing = await FileAction.findOne({ fileId, userId });
    if (existing) return null;

    const user = await User.findById(userId);

    const userCategories = await Category.find({ userId });
    const mergedSubjects = { ...knownSubjects };
    userCategories.forEach((cat) => {
      mergedSubjects[cat.name] = cat.keywords;
    });

    const classification = await classifyFile(
      fileName,
      mimeType,
      user?.name || "",
      mergedSubjects,
      userId,
    );

    const threshold = user?.confidenceThreshold ?? 0.8;

    // Confidence routing: high enough -> auto-move; middling -> normal
    // confirmation queue (existing behavior); low -> flag for the user
    // to pick a category manually rather than trust a weak guess
    let plannedStatus = "pending";
    if (classification.confidence >= threshold) {
      plannedStatus = "auto_confirmed";
    } else if (classification.confidence < 0.5) {
      plannedStatus = "needs_review";
    }

    const action = await FileAction.create({
      userId,
      fileName,
      fileId,
      category: classification.category,
      subject: classification.subject || null,
      confidence: classification.confidence,
      status: plannedStatus === "auto_confirmed" ? "pending" : plannedStatus,
    });

    if (plannedStatus === "auto_confirmed") {
      try {
        const drive = getDriveClient(
          user.googleAccessToken,
          user.googleRefreshToken,
        );
        action.toFolder = await performDriveMove(drive, action);
        action.status = "auto_confirmed";
        await action.save();

        await sendTrainingSample(userId, action);
      } catch (moveError) {
        if (moveError.message?.includes("Increasing the number of parents")) {
          action.status = "failed";
          action.failReason =
            "File cannot be moved automatically — it may be shared or have multiple parents";
        } else {
          console.error(
            "Auto-move failed, leaving pending:",
            moveError.message,
          );
          action.status = "pending"; // fall back to a normal confirmation instead of losing the file action
        }
        await action.save();
      }
    }

    return action;
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
};

export const scanExistingFiles = async (userId) => {
  const user = await User.findById(userId);
  const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

  const knownSubjects = await discoverExistingOrganization(drive);

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
        knownSubjects,
      );
      if (action) queuedCount++;
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  // Feed existing confirmed history into BOTH ongoing-learning models —
  // embeddings (semantic similarity) and TF-IDF (per-category training)
  // — so they have signal from before this upgrade existed, instead of
  // only learning one file at a time from future confirms
  try {
    const confirmedActions = await FileAction.find({
      userId,
      status: { $in: ["confirmed", "auto_confirmed"] },
    });

    if (confirmedActions.length > 0) {
      await axios.post("http://localhost:8000/embed-bulk", {
        user_id: userId.toString(),
        samples: confirmedActions.map((a) => ({
          file_name: a.fileName,
          category: a.category,
          subject: a.subject,
        })),
      });

      await axios.post("http://localhost:8000/train", {
        user_id: userId.toString(),
        samples: confirmedActions.map((a) => ({
          file_name: a.fileName,
          category: a.category,
        })),
      });
    }
  } catch (error) {
    console.error("Bulk embed/train failed:", error.message);
  }

  return queuedCount;
};

export const verifyOrganization = async (userId) => {
  const user = await User.findById(userId);
  const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

  const knownSubjects = await discoverExistingOrganization(drive);

  const actions = await FileAction.find({
    userId,
    status: { $in: ["pending", "confirmed", "auto_confirmed", "rejected"] },
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
        knownSubjects,
        userId,
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
      } else if (
        action.status === "confirmed" ||
        action.status === "auto_confirmed"
      ) {
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

    action.toFolder = await performDriveMove(drive, action);
    action.status = "confirmed";
    await action.save();

    return action;
  } catch (error) {
    console.error("Error executing move:", error);
    throw error;
  }
};
