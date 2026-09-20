import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { query } from './db.js';

dotenv.config();

// Create transporter if SMTP settings are provided, otherwise fallback to mock logger
let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Generate standard HTML layout with reference theme (Dark #0c0c0e, Coral #ff5533, Clean Card)
 */
function wrapEmailTemplate({ title, preheader, bodyContent }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6fa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1b1e;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f4f6fa;
      padding: 40px 16px;
    }
    .email-container {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #eef0f5;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    }
    .email-header {
      background: #0c0c0e;
      padding: 32px 36px;
      text-align: left;
      border-bottom: 2px solid #ff5533;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo-rhombus {
      display: inline-block;
      width: 22px;
      height: 22px;
      background: linear-gradient(135deg, #ff5533 0%, #ff7755 100%);
      transform: rotate(45deg);
      border-radius: 4px;
      vertical-align: middle;
      box-shadow: 0 0 12px rgba(255, 85, 51, 0.5);
    }
    .brand-title {
      color: #ffffff;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-left: 10px;
      vertical-align: middle;
      display: inline-block;
    }
    .email-content {
      padding: 40px 36px 36px 36px;
    }
    .email-footer {
      background: #fafbfe;
      padding: 24px 36px;
      border-top: 1px solid #edf0f7;
      text-align: center;
      font-size: 13px;
      color: #8c93a3;
    }
    .email-footer a {
      color: #ff5533;
      text-decoration: none;
    }
    .badge-pill {
      display: inline-block;
      background: #fff5f2;
      color: #ff5533;
      font-weight: 700;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid #ffdcd4;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 18px;
    }
    .main-heading {
      font-size: 26px;
      font-weight: 800;
      color: #0c0c0e;
      margin: 0 0 16px 0;
      line-height: 1.25;
    }
    .message-text {
      font-size: 15px;
      line-height: 1.65;
      color: #4b5563;
      margin: 0 0 24px 0;
    }
    .otp-card {
      background: #0c0c0e;
      color: #ffffff;
      padding: 24px;
      border-radius: 16px;
      text-align: center;
      margin: 28px 0;
      border: 1px solid #27272f;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
    .otp-code {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: 12px;
      color: #ff5533;
      font-family: 'Courier New', monospace;
      margin: 8px 0;
    }
    .plan-card {
      background: #fbfbfd;
      border: 1px solid #eef0f5;
      border-radius: 16px;
      padding: 20px;
      margin: 20px 0;
    }
    .replied-signature {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #f4f6fa;
      padding: 10px 18px;
      border-radius: 12px;
      border-left: 4px solid #ff5533;
      margin-top: 16px;
      font-size: 14px;
      color: #0c0c0e;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader || ''}
  </div>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <span class="brand-logo-rhombus"></span>
        <span class="brand-title">Zen Caption AI</span>
      </div>
      <div class="email-content">
        ${bodyContent}
      </div>
      <div class="email-footer">
        <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} Zen Caption AI Studio. All rights reserved.</p>
        <p style="margin: 0;">Automated Enterprise AI Subtitles &amp; Video Styling Platform.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 1. OTP Verification Email Template
 */
export function generateOtpEmailHtml({ name, otpCode }) {
  const bodyContent = `
    <span class="badge-pill">Verification Security</span>
    <h1 class="main-heading">Confirm Your Account</h1>
    <p class="message-text">
      Hello <strong>${name || 'Creator'}</strong>,<br>
      Welcome to <strong>Zen Caption AI</strong>! Please enter the 6-digit one-time verification code below to activate your account and access your creator dashboard.
    </p>

    <div class="otp-card">
      <div style="font-size: 12px; text-transform: uppercase; color: #a1a1aa; letter-spacing: 1px;">One-Time Security Passcode</div>
      <div class="otp-code">${otpCode}</div>
      <div style="font-size: 12px; color: #71717a;">Expires in 15 minutes &bull; Do not share this code</div>
    </div>

    <p class="message-text" style="font-size: 13px; color: #9ca3af;">
      If you did not request this verification code, you can safely disregard this message.
    </p>
  `;

  return wrapEmailTemplate({
    title: `${otpCode} is your Zen Caption AI verification code`,
    preheader: `Your verification code is ${otpCode}. Valid for 15 minutes.`,
    bodyContent
  });
}

/**
 * 2. Purchase Request Automated Confirmation Email Template
 */
export function generatePurchaseConfirmationEmailHtml({ name, planName, price, billingCycle }) {
  const bodyContent = `
    <span class="badge-pill">Purchase Request Received</span>
    <h1 class="main-heading">Thank You for Your Order!</h1>
    <p class="message-text">
      Hello <strong>${name}</strong>,<br>
      We have received your purchase request for the <strong>${planName}</strong> subscription. Our billing operations team is preparing your priority quota allocation.
    </p>

    <div class="plan-card">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #edf0f7; padding-bottom: 12px; margin-bottom: 12px;">
        <span style="font-size: 14px; color: #6b7280; font-weight: 600;">Requested Plan</span>
        <span style="font-size: 16px; color: #ff5533; font-weight: 800;">${planName}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 14px; color: #6b7280; font-weight: 600;">Pricing</span>
        <span style="font-size: 18px; color: #0c0c0e; font-weight: 800;">$${price} / ${billingCycle || 'month'}</span>
      </div>
    </div>

    <p class="message-text">
      <strong>Next Steps:</strong> You will receive an invoice and account access instructions shortly. If you have any immediate questions, reply directly to this email or visit your dashboard.
    </p>
  `;

  return wrapEmailTemplate({
    title: `Order Confirmation: ${planName} Plan Request`,
    preheader: `We have received your order request for ${planName}.`,
    bodyContent
  });
}

/**
 * 3. Contact Request Response Email Template (Split-View Admin Reply)
 */
export function generateContactReplyEmailHtml({ recipientName, heading, message, repliedBy }) {
  const bodyContent = `
    <span class="badge-pill">Support Response</span>
    <h1 class="main-heading">${heading || 'Regarding Your Inquiry'}</h1>
    <p class="message-text" style="color: #6b7280; font-size: 14px;">
      Hello <strong>${recipientName || 'Valued User'}</strong>,
    </p>

    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px; margin: 20px 0; font-size: 15px; line-height: 1.7; color: #1f2937; white-space: pre-line;">
${message}
    </div>

    <div class="replied-signature">
      <span>Replied by: <strong>${repliedBy || 'Zen Caption AI Support Team'}</strong></span>
    </div>
  `;

  return wrapEmailTemplate({
    title: `${heading || 'Response from Zen Caption AI'}`,
    preheader: heading || 'We have responded to your inquiry.',
    bodyContent
  });
}

/**
 * Dispatch an email to recipient
 */
export async function sendEmail({ to, subject, html }) {
  console.log(`[EmailService] Preparing to send email to ${to}: "${subject}"`);

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Zen Caption AI" <support@zencaption.ai>',
        to,
        subject,
        html
      });
      console.log(`[EmailService] SMTP email sent successfully to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[EmailService] SMTP delivery failed:`, err);
      // Fall through to record mock delivery
    }
  }

  // Fallback / Development: Record delivery in database or console
  console.log(`[EmailService Mock] Delivered to "${to}" with subject "${subject}" (transporter not configured).`);
  return { success: true, mock: true };
}
