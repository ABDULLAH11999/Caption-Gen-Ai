import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { query } from './db.js';

dotenv.config();

// Resend Email Service Configuration (Render-friendly HTTP API)
export function getResendApiKey() {
  return (
    process.env.RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    process.env.RESEND_APIKEY ||
    process.env.RESEND_TOKEN ||
    ''
  ).trim();
}

export function getResendFromAddress() {
  const envFrom = (process.env.RESEND_FROM || '').trim().replace(/^["']|["']$/g, '');
  if (envFrom && envFrom.includes('@')) {
    return envFrom;
  }
  const smtpFrom = (process.env.SMTP_FROM || '').trim().replace(/^["']|["']$/g, '');
  if (smtpFrom && smtpFrom.includes('@') && !smtpFrom.toLowerCase().includes('@gmail.com')) {
    return smtpFrom;
  }
  // Verified domain on Resend
  return 'Zen Caption AI <support@zencaption.online>';
}

export function getBusinessEmail() {
  const envBiz = (process.env.BUSINESS_EMAIL || process.env.ADMIN_EMAIL || '').trim().replace(/^["']|["']$/g, '');
  if (envBiz && envBiz.includes('@')) {
    return envBiz;
  }
  return 'allinoneg46@gmail.com';
}

// Optional SMTP Fallback transporter (if Resend is not configured)
let transporter = null;
const smtpHost = process.env.SMTP_HOST || (process.env.SMTP_USER?.includes('@gmail.com') ? 'smtp.gmail.com' : null);
const smtpUser = process.env.SMTP_USER;
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

if (smtpHost && smtpUser && smtpPass) {
  const isPort465 = process.env.SMTP_PORT === '465' || process.env.SMTP_SECURE === 'true';
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || (isPort465 ? '465' : '587')),
    secure: isPort465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    // Fast timeouts so blocked cloud ports fail fast in 3s rather than hanging for 60s
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 3000
  });
  console.log(`[EmailService] SMTP transporter initialized as fallback for ${smtpUser}`);
}

const activeResendKey = getResendApiKey();
if (activeResendKey) {
  console.log(`[EmailService] ✓ Resend HTTP API active as primary email provider (Sender: ${getResendFromAddress()}, Business: ${getBusinessEmail()})`);
} else {
  console.log(`[EmailService] Resend API key not detected in env yet; using SMTP fallback if needed.`);
}

/**
 * Generate standard HTML layout with reference theme (Dark #0c0c0e, Coral #ff5533, Clean Card)
 */
export function wrapEmailTemplate({ title, preheader, bodyContent }) {
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
    .brand-subtitle {
      display: block;
      color: #a1a1aa;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
      margin-left: 36px;
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
      line-height: 1.6;
    }
    .email-footer a {
      color: #ff5533;
      text-decoration: none;
      font-weight: 600;
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
      margin: 0 0 20px 0;
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
      margin: 10px 0;
    }
    .plan-card {
      background: #fbfbfd;
      border: 1px solid #eef0f5;
      border-radius: 16px;
      padding: 20px;
      margin: 20px 0;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
      font-size: 14px;
      line-height: 1.5;
      color: #374151;
    }
    .feature-bullet {
      color: #ff5533;
      font-size: 18px;
      line-height: 1;
      font-weight: bold;
    }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #ff5533 0%, #e04424 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(255, 85, 51, 0.35);
      margin: 16px 0;
      text-align: center;
    }
    .replied-signature {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #f4f6fa;
      padding: 12px 18px;
      border-radius: 12px;
      border-left: 4px solid #ff5533;
      margin-top: 18px;
      font-size: 14px;
      color: #0c0c0e;
      font-weight: 600;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .info-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #eef0f5;
      font-size: 14px;
    }
    .info-table td.label {
      color: #6b7280;
      font-weight: 600;
      width: 35%;
    }
    .info-table td.val {
      color: #111827;
      font-weight: 700;
    }
    .notice-box {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 14px;
      padding: 14px 16px;
      margin: 20px 0;
      color: #9a3412;
      font-size: 13px;
      line-height: 1.55;
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
        <div>
          <span class="brand-logo-rhombus"></span>
          <span class="brand-title">Zen Caption AI</span>
        </div>
        <span class="brand-subtitle">Studio &bull; Video Intelligence</span>
      </div>
      <div class="email-content">
        ${bodyContent}
      </div>
      <div class="email-footer">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #4b5563;">&copy; ${new Date().getFullYear()} Zen Caption AI Studio. All rights reserved.</p>
        <p style="margin: 0 0 10px 0;">Automated Enterprise AI Subtitles &amp; Video Styling Platform.</p>
        <p style="margin: 0;">
          <a href="https://zencaption.online" target="_blank">Studio Web App</a> &bull; 
          <a href="https://zencaption.online/#pricing" target="_blank">Plans &amp; Pricing</a> &bull; 
          <a href="https://zencaption.online/#contact" target="_blank">Support Center</a>
        </p>
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
    <span class="badge-pill">Zen Caption Security</span>
    <h1 class="main-heading">Verify Your Creator Account</h1>
    <p class="message-text">
      Hello <strong>${name || 'Creator'}</strong>,<br>
      Use the one-time code below to finish signing in to <strong>Zen Caption AI</strong>. Your captions, templates, exports, and account quota stay protected behind this verification step.
    </p>

    <div class="otp-card">
      <div style="font-size: 12px; text-transform: uppercase; color: #a1a1aa; letter-spacing: 1px;">One-Time Verification Code</div>
      <div class="otp-code">${otpCode}</div>
      <div style="font-size: 12px; color: #d4d4d8;">Expires in 15 minutes &bull; Do not share this code</div>
    </div>

    <div class="notice-box">
      <strong>Security notice:</strong> Zen Caption AI team members will never ask for your verification code in chat, email replies, or support messages.
    </div>

    <p class="message-text" style="font-size: 13px; color: #9ca3af; margin-bottom: 0;">
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
 * 2. Welcome Email Template (Sent after Account Verification)
 */
export function generateWelcomeEmailHtml({ name, username, email }) {
  const displayName = name || username || 'Creator';
  const bodyContent = `
    <span class="badge-pill">Account Verified &bull; Welcome</span>
    <h1 class="main-heading">Welcome to Zen Caption AI Studio! 🎬</h1>
    <p class="message-text">
      Hello <strong>${displayName}</strong>,<br>
      Your account has been successfully verified! You're now equipped with state-of-the-art AI caption generation, automatic speech recognition, and viral video subtitle styling.
    </p>

    <div style="background: #fbfbfd; border: 1px solid #eef0f5; border-radius: 16px; padding: 22px; margin: 24px 0;">
      <div style="font-size: 13px; font-weight: 800; color: #ff5533; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
        What you can do right now:
      </div>
      <div class="feature-item">
        <span class="feature-bullet">&bull;</span>
        <div><strong>99%+ Whisper AI Accuracy:</strong> Transcribe spoken dialogue into exact, timed subtitle blocks with zero watermark.</div>
      </div>
      <div class="feature-item">
        <span class="feature-bullet">&bull;</span>
        <div><strong>Viral Hormozi &amp; Dual-Font Presets:</strong> Apply kinetic pop animations, custom font pairings, and word-by-word highlight effects.</div>
      </div>
      <div class="feature-item">
        <span class="feature-bullet">&bull;</span>
        <div><strong>Instant Export in 1080p / 4K:</strong> Burn subtitles directly onto video or export standard SRT &amp; VTT captions.</div>
      </div>
      <div class="feature-item">
        <span class="feature-bullet">&bull;</span>
        <div><strong>Creator Dashboard:</strong> Track your quota, save custom presets, and manage your projects anytime.</div>
      </div>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="https://zencaption.online" class="cta-btn" target="_blank">Launch Creator Studio &rarr;</a>
    </div>

    <p class="message-text" style="font-size: 14px; color: #6b7280;">
      Need help or have questions? Our support team is here for you. Simply reply directly to this email or visit our contact page.
    </p>
  `;

  return wrapEmailTemplate({
    title: `Welcome to Zen Caption AI Studio!`,
    preheader: `Your account is verified. Start creating viral captions with 99%+ AI accuracy today.`,
    bodyContent
  });
}

/**
 * 3. Purchase Request Automated Confirmation Email to Customer
 */
export function generatePurchaseConfirmationEmailHtml({ name, planName, price, billingCycle }) {
  const bodyContent = `
    <span class="badge-pill">Purchase Request Received</span>
    <h1 class="main-heading">Thank You for Your Order!</h1>
    <p class="message-text">
      Hello <strong>${name}</strong>,<br>
      Your request for the <strong>${planName}</strong> plan has been sent! Our team has received your order and will contact you shortly <strong>within 24 hours via email</strong> to finalize your account setup and billing.
    </p>

    <div class="plan-card">
      <table class="info-table">
        <tr>
          <td class="label">Requested Plan</td>
          <td class="val" style="color: #ff5533;">${planName}</td>
        </tr>
        <tr>
          <td class="label">Plan Price</td>
          <td class="val">$${price} / ${billingCycle || 'month'}</td>
        </tr>
        <tr>
          <td class="label">Order Status</td>
          <td class="val" style="color: #10b981;">Received &bull; Processing</td>
        </tr>
        <tr>
          <td class="label">Estimated Contact</td>
          <td class="val">Within 24 Hours via Email</td>
        </tr>
      </table>
    </div>

    <div class="notice-box">
      <strong>What happens next:</strong> Our sales &amp; quota team will review your order requirements and send payment instructions along with your upgraded account access details.
    </div>

    <p class="message-text" style="font-size: 14px; color: #6b7280;">
      If you have custom requirements or urgent requests, simply reply directly to this email or reach us at <a href="mailto:${getBusinessEmail()}" style="color: #ff5533;">${getBusinessEmail()}</a>.
    </p>
  `;

  return wrapEmailTemplate({
    title: `Order Confirmation: ${planName} Plan Request`,
    preheader: `Your request for purchase plan has been sent. Our team will contact you shortly in 24 hours via email.`,
    bodyContent
  });
}

/**
 * 4. Purchase Request Notification Email to Business/Admin
 */
export function generateAdminPurchaseNotificationEmailHtml({ id, name, email, phone, planName, price, billingCycle, notes }) {
  const bodyContent = `
    <span class="badge-pill" style="background: #ecfdf5; color: #059669; border-color: #a7f3d0;">New Lead &bull; Purchase Plan</span>
    <h1 class="main-heading">New Plan Purchase Request</h1>
    <p class="message-text">
      A customer has submitted a new subscription purchase request on <strong>Zen Caption AI</strong>. Please review the details and reach out within 24 hours.
    </p>

    <div class="plan-card">
      <table class="info-table">
        ${id ? `<tr><td class="label">Order ID</td><td class="val">#${id}</td></tr>` : ''}
        <tr>
          <td class="label">Customer Name</td>
          <td class="val">${name}</td>
        </tr>
        <tr>
          <td class="label">Email Address</td>
          <td class="val"><a href="mailto:${email}" style="color: #ff5533;">${email}</a></td>
        </tr>
        <tr>
          <td class="label">Phone / WhatsApp</td>
          <td class="val">${phone || 'Not provided'}</td>
        </tr>
        <tr>
          <td class="label">Requested Plan</td>
          <td class="val" style="color: #ff5533;">${planName}</td>
        </tr>
        <tr>
          <td class="label">Pricing</td>
          <td class="val">$${price} / ${billingCycle || 'month'}</td>
        </tr>
        <tr>
          <td class="label">Received At</td>
          <td class="val">${new Date().toUTCString()}</td>
        </tr>
      </table>

      ${notes ? `
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #edf0f7;">
          <div style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 6px;">Customer Notes:</div>
          <div style="font-size: 14px; color: #1f2937; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${notes}</div>
        </div>
      ` : ''}
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="mailto:${email}?subject=Regarding%20Your%20${encodeURIComponent(planName)}%20Purchase%20Request%20-%20Zen%20Caption%20AI" class="cta-btn">
        Reply to Customer &rarr;
      </a>
    </div>
  `;

  return wrapEmailTemplate({
    title: `New Purchase Request: ${planName} from ${name}`,
    preheader: `Customer ${name} (${email}) requested ${planName} ($${price}).`,
    bodyContent
  });
}

/**
 * 5. Contact Us Confirmation to User
 */
export function generateContactConfirmationEmailHtml({ name, subject }) {
  const bodyContent = `
    <span class="badge-pill">Message Received</span>
    <h1 class="main-heading">We Received Your Message!</h1>
    <p class="message-text">
      Hello <strong>${name || 'there'}</strong>,<br>
      Thank you for contacting <strong>Zen Caption AI</strong>. We have successfully logged your inquiry regarding <strong>"${subject || 'General Inquiry'}"</strong>.
    </p>

    <div class="notice-box">
      <strong>Response timeline:</strong> Our support &amp; creator success team reviews every inquiry carefully. You can expect a personalized reply within 24 hours.
    </div>

    <p class="message-text" style="font-size: 14px; color: #6b7280;">
      If you have additional attachments or details to provide in the meantime, you can reply directly to this message.
    </p>
  `;

  return wrapEmailTemplate({
    title: `We Received Your Message: ${subject || 'Zen Caption AI Support'}`,
    preheader: `Thank you for contacting Zen Caption AI. Our team will contact you shortly within 24 hours.`,
    bodyContent
  });
}

/**
 * 6. Contact Us Notification to Business/Admin
 */
export function generateAdminContactNotificationEmailHtml({ id, name, email, subject, message }) {
  const bodyContent = `
    <span class="badge-pill">Incoming Contact Inquiry</span>
    <h1 class="main-heading">New Contact Message</h1>
    <p class="message-text">
      A user has sent an inquiry via the Zen Caption AI contact form.
    </p>

    <div class="plan-card">
      <table class="info-table">
        ${id ? `<tr><td class="label">Inquiry ID</td><td class="val">#${id}</td></tr>` : ''}
        <tr>
          <td class="label">From Name</td>
          <td class="val">${name}</td>
        </tr>
        <tr>
          <td class="label">Email Address</td>
          <td class="val"><a href="mailto:${email}" style="color: #ff5533;">${email}</a></td>
        </tr>
        <tr>
          <td class="label">Subject</td>
          <td class="val">${subject || 'General Inquiry'}</td>
        </tr>
        <tr>
          <td class="label">Timestamp</td>
          <td class="val">${new Date().toUTCString()}</td>
        </tr>
      </table>

      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #edf0f7;">
        <div style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 6px;">Message:</div>
        <div style="font-size: 14px; line-height: 1.6; color: #1f2937; background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${message}</div>
      </div>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="mailto:${email}?subject=Re:%20${encodeURIComponent(subject || 'Inquiry')}%20-%20Zen%20Caption%20AI" class="cta-btn">
        Reply to ${name} &rarr;
      </a>
    </div>
  `;

  return wrapEmailTemplate({
    title: `New Contact Inquiry: ${subject || 'Inquiry'} from ${name}`,
    preheader: `New message from ${name} (${email}): ${subject || 'Inquiry'}`,
    bodyContent
  });
}

/**
 * 7. Contact Request Response Email Template (Split-View Admin Reply)
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
 * 8. System Diagnostics / Test Email Template
 */
export function generateTestEmailHtml({ recipient, timestamp }) {
  const bodyContent = `
    <span class="badge-pill" style="background: #ecfdf5; color: #059669; border-color: #a7f3d0;">System Verified &bull; Active</span>
    <h1 class="main-heading">Email Delivery Test Successful! ✅</h1>
    <p class="message-text">
      This test message confirms that <strong>Zen Caption AI</strong> email dispatch is configured correctly and functioning in full production mode via the Resend API.
    </p>

    <div class="plan-card">
      <table class="info-table">
        <tr>
          <td class="label">Delivery Provider</td>
          <td class="val" style="color: #10b981;">Resend REST API (HTTPS/443)</td>
        </tr>
        <tr>
          <td class="label">Verified Sender</td>
          <td class="val">${getResendFromAddress()}</td>
        </tr>
        <tr>
          <td class="label">Recipient</td>
          <td class="val">${recipient}</td>
        </tr>
        <tr>
          <td class="label">Business Email</td>
          <td class="val">${getBusinessEmail()}</td>
        </tr>
        <tr>
          <td class="label">Dispatched At</td>
          <td class="val">${timestamp || new Date().toUTCString()}</td>
        </tr>
        <tr>
          <td class="label">Domain Status</td>
          <td class="val" style="color: #10b981;">zencaption.online (Verified)</td>
        </tr>
      </table>
    </div>

    <p class="message-text" style="font-size: 14px; color: #6b7280;">
      All automated emails (OTP verification codes, account welcome onboarding, purchase request notifications, and contact inquiries) are running with this branded layout.
    </p>
  `;

  return wrapEmailTemplate({
    title: `Zen Caption AI - Email System Health Verified`,
    preheader: `Test email dispatched to ${recipient}. Resend delivery confirmed.`,
    bodyContent
  });
}

/**
 * Dispatch an email to recipient via Resend API (Primary) with fallback to SMTP
 */
export async function sendEmail({ to, subject, html }) {
  console.log(`[EmailService] Preparing to dispatch email to ${to}: "${subject}"`);

  const resendApiKey = getResendApiKey();
  const recipients = Array.isArray(to) ? to : [to];

  // 1. PRIMARY: Resend REST API (Render-compatible over standard HTTPS port 443)
  if (resendApiKey) {
    try {
      const fromAddress = getResendFromAddress();
      console.log(`[EmailService] Dispatching via Resend API (From: "${fromAddress}") to: ${recipients.join(', ')}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: recipients,
          subject,
          html
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.id) {
        console.log(`[EmailService] ✓ Resend email successfully delivered to ${recipients.join(', ')} (Message ID: ${data.id})`);
        return { success: true, messageId: data.id, provider: 'resend' };
      }

      console.error(`[EmailService] ✕ Resend API error (${res.status}):`, data);
      if (data.message && data.message.includes('domain')) {
        console.warn(`[EmailService Tip] To send from custom domain in Resend, verify DNS records or set RESEND_FROM="Zen Caption AI <support@zencaption.online>"`);
      }
    } catch (resendErr) {
      console.error(`[EmailService] ✕ Resend HTTP request failed:`, resendErr.message);
    }
  } else {
    console.warn(`[EmailService] RESEND_API_KEY not found in environment. Checking SMTP fallback...`);
  }

  // 2. SECONDARY FALLBACK: SMTP Transporter (if configured and unblocked)
  if (transporter) {
    try {
      console.log(`[EmailService] Attempting SMTP delivery for ${recipients.join(', ')}...`);
      const info = await transporter.sendMail({
        from: getResendFromAddress(),
        to: recipients.join(', '),
        subject,
        html
      });
      console.log(`[EmailService] ✓ SMTP email sent successfully to ${recipients.join(', ')}: ${info.messageId}`);
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (smtpErr) {
      console.error(`[EmailService] ✕ SMTP delivery failed:`, smtpErr.message);
    }
  }

  // 3. No provider delivered the message.
  console.error(`[EmailService] No email provider delivered message to "${recipients.join(', ')}".`);
  return {
    success: false,
    provider: 'none',
    error: 'Email delivery failed. Configure a verified Resend sender/domain or valid SMTP credentials.'
  };
}
