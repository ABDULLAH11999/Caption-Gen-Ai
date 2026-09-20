// Client-safe Theme Email Preview Generator
// Used by Admin Dashboard Split-View Live Preview

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
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo-rhombus {
      width: 22px;
      height: 22px;
      background: #ff5533;
      transform: rotate(45deg);
      border-radius: 5px;
      display: inline-block;
      margin-right: 12px;
    }
    .brand-title {
      color: #ffffff;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
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
    .main-heading {
      font-size: 22px;
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
