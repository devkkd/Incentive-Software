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

module.exports = { sendOtpEmail };
