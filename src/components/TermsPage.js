export class TermsPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.container = null;
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'section-wrap static-content-page';
    this.container.innerHTML = `
      <div class="section-header-center">
        <span class="badge badge-coral" style="margin-bottom: 12px;">Legal Agreement</span>
        <h1 class="section-heading">Terms &amp; Conditions</h1>
        <p class="section-subheading">Effective Date: January 1, 2026</p>
      </div>

      <div class="card" style="max-width: 860px; margin: 0 auto 40px auto; padding: 40px; line-height: 1.8;">
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 12px; color: #0c0c0e;">1. Acceptance of Terms</h2>
        <p style="color: #4b5563; margin-bottom: 20px;">
          By accessing or using Zen Caption AI, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
        </p>

        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 12px; color: #0c0c0e;">2. User Content &amp; Ownership</h2>
        <p style="color: #4b5563; margin-bottom: 20px;">
          You retain full ownership of all video and audio files you process with Zen Caption AI. Because processing occurs on your client device, we do not store, copy, or claim rights to your media files.
        </p>

        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 12px; color: #0c0c0e;">3. Usage Quotas and Subscriptions</h2>
        <p style="color: #4b5563; margin-bottom: 20px;">
          Access to higher caption generation quotas is governed by selected plans. Any attempt to abuse automated endpoints or bypass quotas is prohibited.
        </p>

        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 12px; color: #0c0c0e;">4. Limitation of Liability</h2>
        <p style="color: #4b5563; margin-bottom: 24px;">
          Zen Caption AI is provided on an "as is" and "as available" basis without warranties of any kind.
        </p>
      </div>
    `;

    parentElement.appendChild(this.container);
    return this.container;
  }
}
