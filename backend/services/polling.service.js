import { google } from "googleapis";
import User from "../models/User.js";
import FileAction from "../models/FileAction.js";
import { processNewFile } from "./drive.service.js";
import { sendNotificationEmail } from "./notification.service.js";

const processedFiles = new Set();
const activePolls = new Map(); // userId -> intervalId

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

// Run one poll cycle for a user and return what happened (used by both
// the automatic interval and the manual "Check Now" trigger)
export const pollOnce = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const response = await drive.files.list({
    q: `modifiedTime > '${fiveMinutesAgo}' and trashed=false`,
    fields: "files(id, name, mimeType, modifiedTime, parents)",
    orderBy: "modifiedTime desc",
    pageSize: 20,
  });

  const files = response.data.files || [];
  const detected = [];

  for (const file of files) {
    if (processedFiles.has(file.id)) continue;
    processedFiles.add(file.id);

    if (file.mimeType.startsWith("application/vnd.google-apps")) continue;

    console.log(`New file detected: ${file.name}`);

    const action = await processNewFile(
      userId,
      file.id,
      file.name,
      file.mimeType,
    );
    if (!action) continue; // already tracked

    detected.push({ fileName: file.name, category: action.category });

    if (
      user.notificationPreference === "email" ||
      user.notificationPreference === "both"
    ) {
      await sendNotificationEmail(
        user.email,
        file.name,
        action.category,
        action._id,
      );
    }
  }

  return {
    filesFoundInWindow: files.length,
    queuedCount: detected.length,
    detected,
  };
};

export const startPolling = async (userId) => {
  // Prevent duplicate intervals if the user logs in again while already polling
  if (activePolls.has(userId)) {
    clearInterval(activePolls.get(userId));
  }

  console.log(`Starting Drive polling for user ${userId}`);

  const poll = async () => {
    try {
      const result = await pollOnce(userId);
      console.log(`Poll result for ${userId}:`, result);
    } catch (error) {
      console.error("Polling error:", error.message);
    }
  };

  poll();
  const intervalId = setInterval(poll, 2 * 60 * 1000);
  activePolls.set(userId, intervalId);
  return intervalId;
};

export const stopPolling = (intervalId) => {
  clearInterval(intervalId);
  console.log("Polling stopped");
};
