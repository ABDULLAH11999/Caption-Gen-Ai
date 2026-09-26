export class BetaTopBar {
  constructor() {
    this.container = null;
    this.timer = null;
    this.storageKey = 'zen_beta_topbar_dismissed';
    this.durationMs = 10000; // 10 seconds
  }

  render(parentElement) {
    // Show only one time
    try {
      if (localStorage.getItem(this.storageKey)) {
        return null;
      }
    } catch {
      // Ignore storage access errors
    }

    this.container = document.createElement('div');
    this.container.className = 'beta-topbar-banner';
    this.container.id = 'beta-topbar-banner';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');

    this.container.innerHTML = `
      <div class="beta-topbar-inner">
        <span class="beta-topbar-tag">BETA</span>
        <span class="beta-topbar-text">
          This project is currently in <strong class="beta-topbar-highlight">Beta Version</strong> &mdash; more <strong class="beta-topbar-highlight">features, updates, and improvements</strong> are actively in progress!
        </span>
        <button class="beta-topbar-close" id="btn-beta-topbar-close" title="Dismiss" aria-label="Dismiss">&times;</button>
      </div>
    `;

    parentElement.appendChild(this.container);

    const dismiss = () => {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      if (!this.container) return;

      try {
        localStorage.setItem(this.storageKey, 'true');
      } catch {
        // Ignore storage errors
      }

      this.container.classList.add('hide');
      setTimeout(() => {
        this.container?.remove();
        this.container = null;
      }, 400);
    };

    // Auto-dismiss after exactly 10 seconds
    this.timer = setTimeout(dismiss, this.durationMs);

    // Optional manual close
    this.container.querySelector('#btn-beta-topbar-close')?.addEventListener('click', dismiss);

    return this.container;
  }
}
