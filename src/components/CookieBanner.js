export class CookieBanner {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.container = null;
  }

  render(parentElement) {
    if (localStorage.getItem('zen_cookie_consent') === 'accepted') {
      return null;
    }

    this.container = document.createElement('div');
    this.container.className = 'saas-cookie-banner';
    this.container.id = 'saas-cookie-banner';
    this.container.innerHTML = `
      <div class="cookie-banner-content">
        <div class="cookie-icon-badge">🍪</div>
        <div class="cookie-text">
          <span>We use cookies to improve your experience.</span>
          <a href="/cookies" class="cookie-policy-link" id="btn-cookie-policy">Cookie Policy</a>
        </div>
      </div>
      <div class="cookie-banner-actions">
        <button class="btn-cookie-accept" id="btn-cookie-accept">Accept</button>
        <button class="cookie-close-btn" id="btn-cookie-dismiss" title="Dismiss" aria-label="Dismiss">&times;</button>
      </div>
    `;

    parentElement.appendChild(this.container);

    const dismiss = () => {
      localStorage.setItem('zen_cookie_consent', 'accepted');
      this.container.classList.add('hide');
      setTimeout(() => this.container?.remove(), 300);
    };

    this.container.querySelector('#btn-cookie-accept')?.addEventListener('click', dismiss);
    this.container.querySelector('#btn-cookie-dismiss')?.addEventListener('click', dismiss);
    this.container.querySelector('#btn-cookie-policy')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.onNavigate('cookies');
    });

    return this.container;
  }
}
