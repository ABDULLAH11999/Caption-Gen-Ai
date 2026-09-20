import { api } from '../services/apiClient.js';

export class Navbar {
  constructor({ onNavigate, onOpenAuth }) {
    this.onNavigate = onNavigate;
    this.onOpenAuth = onOpenAuth;
    this.container = null;
    this.settings = null;
  }

  async init(settings) {
    this.settings = settings;
    api.onAuthChange(() => this.updateAuthButtons());
  }

  render(parentElement) {
    this.container = document.createElement('header');
    this.container.className = 'saas-navbar-header';
    this.container.innerHTML = `
      <div class="saas-nav-inner">
        <a href="/" class="saas-nav-brand" id="nav-brand-link">
          <span class="brand-rhombus"></span>
          <span class="brand-name" id="nav-brand-name">${this.settings?.site_name || 'Zen Caption AI'}</span>
        </a>

        <nav class="saas-nav-links">
          <a href="/" class="nav-item active" data-route="home">Home</a>
          <a href="/#how-it-works" class="nav-item" data-route="how-it-works">How It Works</a>
          <a href="/#templates" class="nav-item" data-route="templates">Templates</a>
          <a href="/#pricing" class="nav-item" data-route="pricing">Pricing</a>
          <a href="/blog" class="nav-item" data-route="blog">Blog</a>
          <a href="/about" class="nav-item" data-route="about">About</a>
          <a href="/contact" class="nav-item" data-route="contact">Contact</a>
        </nav>

        <div class="saas-nav-actions" id="nav-actions-container">
          <!-- Populated by updateAuthButtons() -->
        </div>

        <button class="mobile-menu-toggle" id="btn-mobile-menu" aria-label="Toggle Navigation">
          <span></span><span></span><span></span>
        </button>
      </div>
      <div class="mobile-nav-dropdown" id="mobile-nav-dropdown"></div>
    `;

    parentElement.appendChild(this.container);
    this.bindEvents();
    this.updateAuthButtons();
    return this.container;
  }

  updateAuthButtons() {
    const actions = this.container?.querySelector('#nav-actions-container');
    if (!actions) return;

    const user = api.currentUser;
    if (user) {
      const isAdmin = user.role === 'admin';
      actions.innerHTML = `
        ${isAdmin ? `
          <button class="btn btn-dark btn-sm desktop-nav-action" id="btn-nav-admin">
            <span>🛡️ Admin Panel</span>
          </button>
        ` : ''}
        <button class="btn btn-primary btn-sm desktop-nav-action" id="btn-nav-app">
          <span>⚡ Launch App</span>
        </button>
        <div class="nav-user-pill desktop-nav-action">
          <span class="nav-user-avatar">${user.name.charAt(0).toUpperCase()}</span>
          <span class="nav-user-name">${user.name}</span>
          <button class="nav-user-logout" id="btn-nav-logout" title="Sign Out">✕</button>
        </div>
      `;

      actions.querySelector('#btn-nav-admin')?.addEventListener('click', () => this.onNavigate('admin'));
      actions.querySelector('#btn-nav-app')?.addEventListener('click', () => this.onNavigate('app'));
      actions.querySelector('#btn-nav-logout')?.addEventListener('click', async () => {
        await api.logout();
        this.onNavigate('home');
      });
    } else {
      actions.innerHTML = `
        <button class="btn btn-outline btn-sm desktop-nav-action" id="btn-nav-signin">Sign In</button>
        <button class="btn btn-primary btn-sm desktop-nav-action" id="btn-nav-signup">Get Started Free</button>
      `;

      actions.querySelector('#btn-nav-signin')?.addEventListener('click', () => this.onOpenAuth('signin'));
      actions.querySelector('#btn-nav-signup')?.addEventListener('click', () => this.onOpenAuth('signup'));
    }

    this.updateMobileMenu();
  }

  updateMobileMenu() {
    const dropdown = this.container?.querySelector('#mobile-nav-dropdown');
    if (!dropdown) return;

    const user = api.currentUser;
    const isAdmin = user && user.role === 'admin';

    dropdown.innerHTML = `
      <div class="mobile-nav-links">
        <a href="/" class="mobile-nav-item" data-route="home">
          <span>🏠</span><span>Home</span>
        </a>
        <a href="/#how-it-works" class="mobile-nav-item" data-route="how-it-works">
          <span>⚙️</span><span>How It Works</span>
        </a>
        <a href="/#templates" class="mobile-nav-item" data-route="templates">
          <span>🎨</span><span>Templates &amp; Styles</span>
        </a>
        <a href="/#pricing" class="mobile-nav-item" data-route="pricing">
          <span>💳</span><span>Pricing Plans</span>
        </a>
        <a href="/blog" class="mobile-nav-item" data-route="blog">
          <span>📝</span><span>Creator Blog</span>
        </a>
        <a href="/about" class="mobile-nav-item" data-route="about">
          <span>ℹ️</span><span>About Us</span>
        </a>
        <a href="/contact" class="mobile-nav-item" data-route="contact">
          <span>💬</span><span>Contact Support</span>
        </a>
      </div>

      <div class="mobile-nav-divider"></div>

      <div class="mobile-nav-auth">
        ${user ? `
          <div class="mobile-user-profile">
            <span class="nav-user-avatar">${user.name.charAt(0).toUpperCase()}</span>
            <div class="mobile-user-info">
              <span class="mobile-user-name">${user.name}</span>
              <span class="mobile-user-role">${isAdmin ? '🛡️ Administrator' : '✨ Creator Account'}</span>
            </div>
          </div>
          
          <div class="mobile-auth-btn-stack">
            <button class="btn btn-primary btn-block" id="mobile-btn-app" style="margin-bottom: 8px;">
              ⚡ Launch Caption Studio
            </button>
            ${isAdmin ? `
              <button class="btn btn-dark btn-block" id="mobile-btn-admin" style="margin-bottom: 8px;">
                🛡️ Admin Dashboard
              </button>
            ` : ''}
            <button class="btn btn-outline btn-block" id="mobile-btn-logout" style="color: #ef4444; border-color: #fca5a5;">
              Sign Out
            </button>
          </div>
        ` : `
          <div class="mobile-auth-btn-stack">
            <button class="btn btn-outline btn-block" id="mobile-btn-signin" style="margin-bottom: 10px;">
              Sign In
            </button>
            <button class="btn btn-primary btn-block" id="mobile-btn-signup">
              Get Started Free
            </button>
          </div>
        `}
      </div>
    `;

    // Bind mobile menu link events
    dropdown.querySelectorAll('.mobile-nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        this.closeMobileMenu();

        if (href.startsWith('/#')) {
          if (window.location.pathname !== '/') {
            this.onNavigate('home', href.substring(2));
          } else {
            const el = document.getElementById(href.substring(2));
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }
          return;
        }

        e.preventDefault();
        const route = link.getAttribute('data-route');
        this.onNavigate(route);
      });
    });

    // Bind mobile auth events
    dropdown.querySelector('#mobile-btn-app')?.addEventListener('click', () => {
      this.closeMobileMenu();
      this.onNavigate('app');
    });

    dropdown.querySelector('#mobile-btn-admin')?.addEventListener('click', () => {
      this.closeMobileMenu();
      this.onNavigate('admin');
    });

    dropdown.querySelector('#mobile-btn-logout')?.addEventListener('click', async () => {
      this.closeMobileMenu();
      await api.logout();
      this.onNavigate('home');
    });

    dropdown.querySelector('#mobile-btn-signin')?.addEventListener('click', () => {
      this.closeMobileMenu();
      this.onOpenAuth('signin');
    });

    dropdown.querySelector('#mobile-btn-signup')?.addEventListener('click', () => {
      this.closeMobileMenu();
      this.onOpenAuth('signup');
    });
  }

  closeMobileMenu() {
    const dropdown = this.container?.querySelector('#mobile-nav-dropdown');
    const toggle = this.container?.querySelector('#btn-mobile-menu');
    dropdown?.classList.remove('open');
    toggle?.classList.remove('active');
  }

  bindEvents() {
    this.container.querySelector('#nav-brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeMobileMenu();
      this.onNavigate('home');
    });

    this.container.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('/#')) {
          // Scroll to anchor on home
          if (window.location.pathname !== '/') {
            this.onNavigate('home', href.substring(2));
          } else {
            const el = document.getElementById(href.substring(2));
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }
          return;
        }

        e.preventDefault();
        const route = link.getAttribute('data-route');
        this.onNavigate(route);
      });
    });

    const toggle = this.container.querySelector('#btn-mobile-menu');
    const dropdown = this.container.querySelector('#mobile-nav-dropdown');
    toggle?.addEventListener('click', () => {
      const isOpen = dropdown?.classList.toggle('open');
      toggle.classList.toggle('active', isOpen);
    });
  }

  setActive(route) {
    this.container?.querySelectorAll('.nav-item').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-route') === route);
    });
    this.container?.querySelectorAll('.mobile-nav-item').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-route') === route);
    });
  }
}
