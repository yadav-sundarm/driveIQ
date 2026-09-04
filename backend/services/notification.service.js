import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendNotificationEmail = async (
  toEmail,
  fileName,
  category,
  actionId,
) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: `DriveIQ — New file detected: ${fileName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">DriveIQ File Organizer</h2>
          <p>A new file was detected in your Google Drive:</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>File:</strong> ${fileName}</p>
            <p><strong>Suggested category:</strong> ${category}</p>
          </div>
          <p>Open DriveIQ to confirm or reject this action.</p>
          <a href="http://localhost:5173/confirmations" 
             style="background: #4F46E5; color: white; padding: 12px 24px; 
                    border-radius: 6px; text-decoration: none; display: inline-block;">
            Review Now
          </a>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${toEmail}`);
  } catch (error) {
    console.error("Email error:", error);
  }
};
