// src/services/mailer.js
const nodemailer = require('nodemailer');

// ── Transporter — built once, reused for every send ────────────
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = SMTP_PORT === 465; // 465 = implicit TLS, 587 = STARTTLS

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // 20s is plenty. Nodemailer default is 120s which blocks Render dynos.
  connectionTimeout: 20_000,
  greetingTimeout: 20_000,
  socketTimeout: 30_000,
});

// Verify once at startup so you see SMTP failures immediately in Render logs.
transporter.verify()
  .then(() => console.log('✅ [MAILER] SMTP connection verified'))
  .catch((err) => console.error('❌ [MAILER] SMTP verification FAILED:', err.message));

// ── Small retry wrapper for transient SMTP hiccups ─────────────
async function sendWithRetry(mailOptions, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      lastError = err;
      const transient = ['ECONNRESET', 'ETIMEDOUT', 'EENVELOPE', 'ESOCKET'].includes(err.code);
      if (!transient || i === attempts) throw err;
      console.warn(`⚠️ [MAILER] Attempt ${i} failed (${err.code}), retrying…`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastError;
}

// ── Welcome / onboarding email ─────────────────────────────────
// NOTE: `adminUsername` is passed by the caller. No password is sent
// because the current onboarding flow has the admin choose their own
// password at registration.
async function sendWelcomeEmail({ to, adminName, hospitalName, hospitalSlug, adminUsername }) {
  if (!to) throw new Error('sendWelcomeEmail: recipient `to` is required');

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const staffLoginUrl = `${baseUrl}/h/${hospitalSlug}/login`;
  const patientPortalUrl = `${baseUrl}/patient-login?h=${hospitalSlug}`;

  const fromName = process.env.SMTP_FROM_NAME || 'NexGen EMR';
  const fromAddr = process.env.SMTP_USER;

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

  const info = await sendWithRetry({
    from: `"${fromName}" <${fromAddr}>`,
    to,
    subject: `Welcome to NexGen EMR - ${hospitalName}`,
    html,
  });

  console.log(
    `📧 [MAILER] Welcome email sent | to=${to} | accepted=${JSON.stringify(info.accepted)} | rejected=${JSON.stringify(info.rejected)} | id=${info.messageId}`
  );

  return info;
}

module.exports = { sendWelcomeEmail, transporter };