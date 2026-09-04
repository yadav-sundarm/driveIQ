import { google } from "googleapis";
import User from "../models/User.js";
import FileAction from "../models/FileAction.js";
import { processNewFile } from "./drive.service.js";
import { sendNotificationEmail } from "./notification.service.js";

const processedFiles = new Set();

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

export const startPolling = async (userId) => {
  console.log(`Starting Drive polling for user ${userId}`);

  const poll = async () => {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const drive = getDriveClient(
        user.googleAccessToken,
        user.googleRefreshToken,
      );

      // Get files modified in last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const response = await drive.files.list({
        q: `modifiedTime > '${fiveMinutesAgo}' and trashed=false`,
        fields: "files(id, name, mimeType, modifiedTime, parents)",
        orderBy: "modifiedTime desc",
        pageSize: 20,
      });

      const files = response.data.files || [];

      for (const file of files) {
        // Skip if already processed
        if (processedFiles.has(file.id)) continue;
        processedFiles.add(file.id);

        // Skip Google Docs/Sheets/Slides — only process uploaded files
        if (file.mimeType.startsWith("application/vnd.google-apps")) continue;

        // Check if already have a pending action for this file
        const existing = await FileAction.findOne({ fileId: file.id, userId });
        if (existing) continue;

        console.log(`New file detected: ${file.name}`);

        // Process and classify
        const action = await processNewFile(
          userId,
          file.id,
          file.name,
          file.mimeType,
        );

        // Send notification based on user preference
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
    } catch (error) {
      console.error("Polling error:", error.message);
    }
  };

  // Poll every 2 minutes
  poll();
  return setInterval(poll, 2 * 60 * 1000);
};

export const stopPolling = (intervalId) => {
  clearInterval(intervalId);
  console.log("Polling stopped");
};
