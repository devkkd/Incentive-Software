const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (toEmail, otp, purpose = 'password_change') => {
  const subjects = {
    password_change: 'FTC - Password Change OTP',
    email_change: 'FTC - Email Change Verification',
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8faff; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #2B3B8A; margin: 0;">Friends Trading Corporation</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0;">Incentive Management System</p>
      </div>
      <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
        <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Your verification code is:</p>
        <div style="background: #f0f4ff; border: 2px dashed #2B3B8A; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 20px;">
          <span style="font-size: 36px; font-weight: bold; color: #2B3B8A; letter-spacing: 12px;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px; margin: 0;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 16px 0 0;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: subjects[purpose] || 'FTC - Verification Code',
    html,
  });
};


/**
 * POINT 26 — email the nightly backup workbook as an attachment.
 *
 * Uses the mail account already configured for OTPs, so there is nothing new
 * to set up. Gmail allows 25MB attachments; these workbooks are far smaller.
 * The mailbox then becomes the archive, searchable by date.
 */
const sendBackupEmail = async ({ toEmail, filePath, fileName, generatedAt, counts }) => {
  const rows = Object.entries(counts || {})
    .map(([sheet, n]) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${sheet}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#111827;font-weight:600;text-align:right;">
          ${Number(n).toLocaleString('en-IN')}
        </td>
      </tr>`)
    .join('');

  const stamp = new Date(generatedAt).toLocaleString('en-IN', {
    dateStyle: 'full', timeStyle: 'short',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f8faff; border-radius: 16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="color:#2B3B8A;margin:0;">Friends Trading Corporation</h2>
        <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">Incentive Management &mdash; Daily Backup</p>
      </div>

      <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
        <p style="color:#374151;font-size:15px;margin:0 0 4px;">
          Attached is the data snapshot for <strong>${stamp}</strong>.
        </p>
        <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">
          Keep this email. If the system is ever unavailable, this spreadsheet
          holds the balances needed to keep trading.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">Sheet</th>
              <th style="text-align:right;padding:6px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">Rows</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">
        Generated automatically. If you stop receiving these, the backup has failed &mdash; please check.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: `FTC Daily Backup — ${new Date(generatedAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })}`,
    html,
    attachments: [{ filename: fileName, path: filePath }],
  });
};

module.exports = { sendOtpEmail, sendBackupEmail };
