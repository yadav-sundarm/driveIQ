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
) => {
  try {
    const response = await axios.post("http://localhost:8000/classify", {
      file_name: fileName,
      mime_type: mimeType,
      user_name: userName,
      known_subjects: knownSubjects,
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

// Look at the user's existing Drive folder structure and learn from it:
// folders sitting directly inside another folder are treated as "subject"
// folders (matching the Category/Subject shape DriveIQ itself creates),
// and files already inside each one contribute keyword hints. Only run
// from Scan/Verify — this does a full folder walk, too heavy for the
// 2-minute background poll.
export const discoverExistingOrganization = async (drive) => {
  const folders = []; // { id, name, parentId }
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

  // Top-level = parent is Drive's root, not another folder we tracked
  const topLevelFolders = folders.filter(
    (f) => !f.parentId || !folderIds.has(f.parentId),
  );

  // Candidate "subject" folders = one level directly inside a top-level folder
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

    // A keyword needs to show up more than once to count as a pattern —
    // one stray word in a single filename isn't a reliable signal
    const learnedKeywords = Object.entries(keywordCounts)
      .filter(([, count]) => count > 1)
      .map(([kw]) => kw);

    knownSubjects[subjectFolder.name] = learnedKeywords;
  }

  return knownSubjects;
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

    // Fetch user's custom categories and merge into knownSubjects
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

  return queuedCount;
};

export const verifyOrganization = async (userId) => {
  const user = await User.findById(userId);
  const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

  const knownSubjects = await discoverExistingOrganization(drive);

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
        knownSubjects,
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
