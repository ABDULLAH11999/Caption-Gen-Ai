// Client-safe Theme Email Preview Generator
// Used by Admin Dashboard Split-View Live Preview and Email Previews

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
      padding: 32px 16px;
      box-sizing: border-box;
    }
    .email-container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
      border: 1px solid #edf0f7;
    }
    .email-header {
      background-color: #0c0c0e;
      padding: 24px 32px;
      border-bottom: 2px solid #ff5533;
    }
    .brand-logo-rhombus {
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #ff5533 0%, #ff7755 100%);
      transform: rotate(45deg);
      border-radius: 4px;
      display: inline-block;
      margin-right: 10px;
      vertical-align: middle;
      box-shadow: 0 0 10px rgba(255, 85, 51, 0.5);
    }
    .brand-title {
      color: #ffffff;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
      vertical-align: middle;
    }
    .brand-subtitle {
      display: block;
      color: #a1a1aa;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
      margin-left: 30px;
    }
    .email-content {
      padding: 36px 32px;
    }
    .email-footer {
      background-color: #fafbfe;
      padding: 24px 32px;
      border-top: 1px solid #edf0f7;
      text-align: center;
      font-size: 12px;
      color: #71717a;
      line-height: 1.6;
    }
    .email-footer a {
      color: #ff5533;
      text-decoration: none;
      font-weight: 600;
    }
    .main-heading {
      font-size: 24px;
      font-weight: 800;
      color: #0c0c0e;
      margin: 0 0 14px 0;
      line-height: 1.3;
    }
    .message-text {
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
      margin: 0 0 18px 0;
    }
    .badge-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      background: #fff0ed;
      color: #ff5533;
      margin-bottom: 16px;
      border: 1px solid #ffdcd4;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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
    .otp-card {
      background: #0c0c0e;
      color: #ffffff;
      padding: 24px;
      border-radius: 16px;
      text-align: center;
      margin: 24px 0;
      border: 1px solid #27272f;
    }
    .otp-code {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 10px;
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
        <p style="margin: 0 0 8px 0; font-weight: 600;">&copy; ${new Date().getFullYear()} Zen Caption AI Studio. All rights reserved.</p>
        <p style="margin: 0 0 8px 0;">Automated Enterprise AI Subtitles &amp; Video Styling Platform.</p>
        <p style="margin: 0;">
          <a href="https://zencaption.online" target="_blank">Studio Web App</a> &bull; 
          <a href="https://zencaption.online/#pricing" target="_blank">Plans &amp; Pricing</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

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

export function generateOtpEmailHtml({ name, otpCode }) {
  const bodyContent = `
    <span class="badge-pill">Zen Caption Security</span>
    <h1 class="main-heading">Verify Your Creator Account</h1>
    <p class="message-text">
      Hello <strong>${name || 'Creator'}</strong>,<br>
      Use the one-time code below to finish signing in to <strong>Zen Caption AI</strong>.
    </p>

    <div class="otp-card">
      <div style="font-size: 12px; text-transform: uppercase; color: #a1a1aa; letter-spacing: 1px;">One-Time Verification Code</div>
      <div class="otp-code">${otpCode}</div>
      <div style="font-size: 12px; color: #d4d4d8;">Expires in 15 minutes &bull; Do not share this code</div>
    </div>
  `;

  return wrapEmailTemplate({
    title: `${otpCode} is your Zen Caption AI verification code`,
    preheader: `Your verification code is ${otpCode}. Valid for 15 minutes.`,
    bodyContent
  });
}

export function generateWelcomeEmailHtml({ name, username }) {
  const displayName = name || username || 'Creator';
  const bodyContent = `
    <span class="badge-pill">Account Verified &bull; Welcome</span>
    <h1 class="main-heading">Welcome to Zen Caption AI Studio! 🎬</h1>
    <p class="message-text">
      Hello <strong>${displayName}</strong>,<br>
      Your account has been successfully verified! You're now equipped with state-of-the-art AI caption generation, automatic speech recognition, and viral video subtitle styling.
    </p>
  `;

  return wrapEmailTemplate({
    title: `Welcome to Zen Caption AI Studio!`,
    preheader: `Your account is verified. Start creating viral captions today.`,
    bodyContent
  });
}
