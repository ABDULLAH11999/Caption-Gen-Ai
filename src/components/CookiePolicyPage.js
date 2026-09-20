export class CookiePolicyPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.container = null;
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'section-wrap static-content-page';
    this.container.innerHTML = `
      <div class="section-header-center">
        <span class="badge badge-coral" style="margin-bottom: 12px;">Privacy &amp; Data</span>
        <h1 class="section-heading">Cookie Policy</h1>
        <p class="section-subheading">How Zen Caption AI uses local storage and cookies to provide a zero-lag experience.</p>
      </div>

      <div class="card" style="max-width: 860px; margin: 0 auto 40px auto; padding: 40px; line-height: 1.8;">
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 12px; color: #0c0c0e;">1. What Are Cookies and Local Storage?</h2>
        <p style="color: #4b5563; margin-bottom: 20px;">
          Cookies and HTML5 Local Storage are small text data elements saved on your device to remember user preferences, session tokens, and cached model states.
        </p>

        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 12px; color: #0c0c0e;">2. How We Use Them</h2>
        <ul style="color: #4b5563; margin-left: 24px; margin-bottom: 20px;">
          <li><strong>Essential Sessions:</strong> To keep you authenticated across browser tabs for multi-month sessions.</li>
          <li><strong>Template Customizations:</strong> To persist your personalized dual-font and color customizations.</li>
          <li><strong>Quota State:</strong> To track daily generation usage.</li>
        </ul>

        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 12px; color: #0c0c0e;">3. No Third-Party Tracking Pixels</h2>
        <p style="color: #4b5563; margin-bottom: 24px;">
          We do not sell your data or deploy invasive advertising pixels. You can clear your browser storage at any time in your browser settings.
        </p>
      </div>
    `;

    parentElement.appendChild(this.container);
    return this.container;
  }
}
