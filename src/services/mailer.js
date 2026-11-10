// src/services/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendWelcomeEmail({ to, adminName, hospitalName, hospitalSlug, adminUsername }) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const staffLoginUrl = `${baseUrl}/h/${hospitalSlug}/login`;
  const patientPortalUrl = `${baseUrl}/patient-login?h=${hospitalSlug}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2>Welcome to NexGen EMR, ${adminName}!</h2>
      <p>Your hospital, <strong>${hospitalName}</strong>, is now active.</p>
      
      <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0f3460;">🩺 Staff Login</h3>
        <p>Use this link to log in to your hospital dashboard:</p>
        <p><a href="${staffLoginUrl}">${staffLoginUrl}</a></p>
        <p><strong>Username:</strong> ${adminUsername}</p>
        <p><em>(Use the password you chose during registration)</em></p>
      </div>

      <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #065f46;">🚑 Patient Portal</h3>
        <p>Share this link with your patients. They will use their Patient ID to log in:</p>
        <p><a href="${patientPortalUrl}">${patientPortalUrl}</a></p>
      </div>

      <p style="font-size: 12px; color: #888;">If you have any questions, contact platform support.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"NexGen EMR" <${process.env.SMTP_USER}>`,
    to,
    subject: `Welcome to NexGen EMR - ${hospitalName}`,
    html,
  });
}

module.exports = { sendWelcomeEmail };