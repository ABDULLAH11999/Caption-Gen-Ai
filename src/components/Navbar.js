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
          <button class="btn btn-dark btn-sm" id="btn-nav-admin">
            <span>🛡️ Admin Panel</span>
          </button>
        ` : ''}
        <button class="btn btn-primary btn-sm" id="btn-nav-app">
          <span>⚡ Launch App</span>
        </button>
        <div class="nav-user-pill">
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
        <button class="btn btn-outline btn-sm" id="btn-nav-signin">Sign In</button>
        <button class="btn btn-primary btn-sm" id="btn-nav-signup">Get Started Free</button>
      `;

      actions.querySelector('#btn-nav-signin')?.addEventListener('click', () => this.onOpenAuth('signin'));
      actions.querySelector('#btn-nav-signup')?.addEventListener('click', () => this.onOpenAuth('signup'));
    }
  }

  bindEvents() {
    this.container.querySelector('#nav-brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
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
      dropdown?.classList.toggle('open');
    });
  }

  setActive(route) {
    this.container?.querySelectorAll('.nav-item').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-route') === route);
    });
  }
}
