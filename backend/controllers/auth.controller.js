import { google } from "googleapis";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// Step 1 — redirect user to Google
export const googleAuth = (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "consent",
  });
  res.redirect(url);
};

// Step 2 — Google redirects back with code
export const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Save or update user in DB
    let user = await User.findOne({ email: data.email });
    if (!user) {
      user = await User.create({
        email: data.email,
        name: data.name,
        avatar: data.picture,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
      });
    } else {
      user.googleAccessToken = tokens.access_token;
      if (tokens.refresh_token) user.googleRefreshToken = tokens.refresh_token;
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Redirect to frontend with token
    res.redirect(`http://localhost:5173/dashboard?token=${token}`);
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-googleAccessToken -googleRefreshToken",
    );
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
