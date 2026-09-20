// Main Application Bootstrapper & Client Router
// SaaS Platform: Public Landing, Sub-pages, 30 SEO Blogs, User Studio Dashboard & Admin Console

import './styles/theme.css';
import './styles/landing.css';
import './styles/user-dashboard.css';
import './styles/admin.css';
import './styles/tool-modal.css';
import './styles/captions.css';

import { api } from './services/apiClient.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { CookieBanner } from './components/CookieBanner.js';
import { AuthModal } from './components/AuthModal.js';
import { LandingPage } from './components/LandingPage.js';
import { AboutPage } from './components/AboutPage.js';
import { ContactPage } from './components/ContactPage.js';
import { TermsPage } from './components/TermsPage.js';
import { CookiePolicyPage } from './components/CookiePolicyPage.js';
import { BlogListPage } from './components/BlogListPage.js';
import { BlogDetailPage } from './components/BlogDetailPage.js';
import { UserDashboard } from './components/UserDashboard.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { ToolStudioModal } from './components/ToolStudioModal.js';

class ZenSaaSApp {
  constructor() {
    this.appRoot = null;
    this.currentRoute = 'home';
    this.routeParams = {};
    this.settings = {};

    // Components
    this.navbar = null;
    this.footer = null;
    this.cookieBanner = null;
    this.authModal = null;
    this.toolStudio = null;
    this.userDashboard = null;
    this.adminDashboard = null;

    this.mainContainer = null;
    this.toastContainer = null;
  }

  async init() {
    this.appRoot = document.getElementById('app') || document.body;
    this.appRoot.innerHTML = '';
    this.setupToastContainer();

    try {
      // 1. Check existing session and load site settings
      await api.checkMe();
      await this.loadSiteSettings();

      // 2. Initialize Tool Studio Modal (Reusable across dashboard)
      this.toolStudio = new ToolStudioModal({
        onConfigChanged: (config) => {
          if (this.userDashboard) {
            this.userDashboard.activeConfig = config;
            this.userDashboard.lastRenderedSentenceKey = null;
            this.userDashboard.updateCaptionOverlay();
          }
        }
      });
      await this.toolStudio.initConfigs();
      this.toolStudio.render(this.appRoot);

      // 3. Initialize Auth Modal
      this.authModal = new AuthModal({
        onSuccess: (user) => {
          this.showToast(`Welcome back, ${user.name}!`, 'success');
          if (this.navbar) this.navbar.updateAuthButtons();
          if (this.currentRoute === 'home') {
            this.navigate('app');
          } else {
            this.renderRoute(this.currentRoute, this.routeParams);
          }
        },
        showToast: (msg, type) => this.showToast(msg, type)
      });
      this.authModal.render(this.appRoot);

      // 4. Initialize Navbar
      this.navbar = new Navbar({
        onNavigate: (route, params) => this.navigate(route, params),
        onOpenAuth: (mode) => this.authModal.open(mode)
      });
      await this.navbar.init(this.settings);
      this.navbar.render(this.appRoot);

      // 5. Main Content Area
      this.mainContainer = document.createElement('div');
      this.mainContainer.id = 'page-content-host';
      this.mainContainer.className = 'page-content-host';
      this.appRoot.appendChild(this.mainContainer);

      // 6. Initialize Footer
      this.footer = new Footer({
        onNavigate: (route, params) => this.navigate(route, params)
      });
      this.footer.render(this.appRoot);

      // 7. Initialize Cookie Consent Banner
      this.cookieBanner = new CookieBanner({
        onNavigate: (route) => this.navigate(route)
      });
      this.cookieBanner.render(this.appRoot);

      // 8. Handle browser back/forward and initial path
      window.addEventListener('popstate', () => this.handleLocationChange());
      this.handleLocationChange();

    } catch (err) {
      console.error('[ZenSaaSApp] Initialization error:', err);
      this.showToast('Failed to initialize platform: ' + err.message, 'error');
    }
  }

  async loadSiteSettings() {
    try {
      const res = await api.getSettings();
      if (res && res.settings) {
        this.settings = res.settings;
        this.applySiteMeta(this.settings);
      }
    } catch (e) {
      console.warn('Could not load site settings:', e.message);
    }
  }

  applySiteMeta(s) {
    if (s.site_title) document.title = s.site_title;
    
    // Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    if (s.meta_description) metaDesc.content = s.meta_description;

    // Meta Keywords
    let metaKw = document.querySelector('meta[name="keywords"]');
    if (!metaKw) {
      metaKw = document.createElement('meta');
      metaKw.name = 'keywords';
      document.head.appendChild(metaKw);
    }
    if (s.meta_keywords) metaKw.content = s.meta_keywords;

    // OpenGraph Tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && s.og_title) ogTitle.content = s.og_title;
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && s.og_description) ogDesc.content = s.og_description;
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg && s.og_image) ogImg.content = s.og_image;

    // Favicon
    const favicon = s.favicon_url || s.site_favicon || '/favicon.svg';
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favicon;

    // JSON-LD Schema
    if (s.json_ld_schema) {
      let script = document.getElementById('site-json-ld');
      if (!script) {
        script = document.createElement('script');
        script.id = 'site-json-ld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.text = s.json_ld_schema;
    }

    // Header scripts
    if (s.header_scripts) {
      const headerScriptContainer = document.getElementById('custom-header-scripts') || document.createElement('div');
      headerScriptContainer.id = 'custom-header-scripts';
      headerScriptContainer.innerHTML = s.header_scripts;
      document.head.appendChild(headerScriptContainer);
    }

    // Footer scripts
    if (s.footer_scripts) {
      const footerScriptContainer = document.getElementById('custom-footer-scripts') || document.createElement('div');
      footerScriptContainer.id = 'custom-footer-scripts';
      footerScriptContainer.innerHTML = s.footer_scripts;
      document.body.appendChild(footerScriptContainer);
    }
  }

  handleLocationChange() {
    const path = window.location.pathname;
    const hash = window.location.hash;

    if (path.startsWith('/blog/')) {
      const slug = path.replace('/blog/', '').trim();
      this.navigate('blog-detail', { slug }, false);
    } else if (path === '/blog') {
      this.navigate('blog', {}, false);
    } else if (path === '/about') {
      this.navigate('about', {}, false);
    } else if (path === '/contact') {
      this.navigate('contact', {}, false);
    } else if (path === '/terms') {
      this.navigate('terms', {}, false);
    } else if (path === '/cookies') {
      this.navigate('cookies', {}, false);
    } else if (path === '/app') {
      this.navigate('app', {}, false);
    } else if (path === '/admin') {
      this.navigate('admin', {}, false);
    } else {
      this.navigate('home', {}, false);
      if (hash) {
        setTimeout(() => {
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    }
  }

  navigate(route, params = {}, pushState = true) {
    this.currentRoute = route;
    this.routeParams = params;

    let targetUrl = '/';
    if (route === 'blog') targetUrl = '/blog';
    else if (route === 'blog-detail' && params.slug) targetUrl = `/blog/${params.slug}`;
    else if (route === 'about') targetUrl = '/about';
    else if (route === 'contact') targetUrl = '/contact';
    else if (route === 'terms') targetUrl = '/terms';
    else if (route === 'cookies') targetUrl = '/cookies';
    else if (route === 'app') targetUrl = '/app';
    else if (route === 'admin') targetUrl = '/admin';

    if (pushState && window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }

    // Update page title, meta description, and keywords per route
    this.updateRouteMeta(route, params, targetUrl);

    window.scrollTo({ top: 0, behavior: 'instant' });
    
    // Automatically track visitor telemetry
    try {
      api.trackVisit({ landedUrl: targetUrl });
    } catch (e) {}

    this.renderRoute(route, params);
  }

  updateRouteMeta(route, params, targetUrl) {
    const metaConfig = {
      home: {
        title: 'Free Caption Generator Video Tool | Auto Subtitle Maker Online - Zen Caption',
        desc: 'Zen Caption is the #1 100% free caption generator video tool and auto subtitle generator online. Automatically generate, transcribe and add viral dual-font captions, Hormozi-style subtitles, and kinetic animations to TikTok, Instagram Reels, YouTube Shorts, and videos for free with zero watermarks. Fast, accurate Whisper AI speech to text.',
        keywords: 'free caption generator video tool, free caption generator tool, auto subtitle generator online, free video caption tool, free subtitle maker no watermark, free caption generator, free caption video, free video subtitle generator, auto caption generator free, add captions to video free, no watermark caption generator, free subtitles generator for video, AI caption generator free, free auto subtitles, Hormozi captions free, viral reels captions free, tiktok subtitles generator free, instagram reels captions generator, youtube shorts auto subtitle, speech to text video subtitle, automatic subtitle generator online free, free closed caption tool, video subtitle maker free, transcribe video free, online video captioner, whisper ai captions free, dynamic word highlight captions, dual font video subtitles, client side video captioning, 60 fps subtitle export, caption video online free no watermark, kapwing alternative free, veed alternative free, auto subtitle generator 99% accurate, ai caption generator for video free, hardcode subtitles to video free, burned in captions generator, mp4 subtitle generator online, mov caption generator free, zen caption tool, zen caption, zen caption ai, zencaption, free caption tool'
      },
      app: {
        title: 'Free Caption Generator Video Tool Studio - Zen Caption',
        desc: 'Zen Caption free caption generator video tool and auto subtitle studio online. 100% Free caption tool and video subtitle generator online. Upload video, transcribe speech accurately with Whisper AI, customize animated fonts, and export 60 FPS lossless video with no watermark.',
        keywords: 'free caption generator video tool, free caption generator tool, auto subtitle generator online, free video caption tool, zen caption tool, zen caption, zen caption ai, free caption tool, free caption video, free video subtitle generator, online subtitle maker, free auto captions, client side video editor, no watermark subtitles, generate captions online, caption studio, free subtitle tool'
      },
      blog: {
        title: 'Creator Guides & Viral Caption Tips - Zen Caption AI Free Caption Tool',
        desc: 'Learn how to add viral captions, boost video retention by 80%, master Hormozi subtitle styles, and rank higher on TikTok & Reels with our free caption tool guides.',
        keywords: 'free caption tool, caption video tips, video retention subtitles, tiktok seo captions, viral reels font guide, subtitle generator tutorials, how to caption video free'
      },
      about: {
        title: 'About Us - Free Client-Side Video Caption Tool | Zen Caption AI',
        desc: 'Learn about Zen Caption AI: a fast, private, 100% free video caption generator that runs modern Whisper AI speech-to-text models directly in your web browser with zero server lag.',
        keywords: 'free caption tool, about zen caption ai, private video subtitle generator, browser ai captions, client side captioning'
      },
      contact: {
        title: 'Contact Support - Zen Caption AI Free Caption Tool',
        desc: 'Have questions about our free video caption tool or need creator support? Get in touch with the Zen Caption AI team.',
        keywords: 'free caption tool, contact support, zen caption ai contact, video subtitle help'
      },
      terms: {
        title: 'Terms of Service - Zen Caption AI Free Caption Tool',
        desc: 'Terms of service and acceptable usage policies for the Zen Caption AI free video caption generator.',
        keywords: 'free caption tool, terms of service, legal terms'
      },
      cookies: {
        title: 'Cookie Policy - Zen Caption AI',
        desc: 'Cookie and privacy policy for Zen Caption AI.',
        keywords: 'free caption tool, cookie policy, privacy policy'
      },
      admin: {
        title: 'Admin Dashboard - Zen Caption AI',
        desc: 'Administrative control panel for Zen Caption AI.',
        keywords: 'admin dashboard'
      }
    };

    if (route !== 'blog-detail') {
      const cfg = metaConfig[route] || metaConfig.home;
      document.title = cfg.title;

      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.content = cfg.desc;
      const ogDescEl = document.querySelector('meta[property="og:description"]');
      if (ogDescEl) ogDescEl.content = cfg.desc;
      const twDescEl = document.querySelector('meta[name="twitter:description"]');
      if (twDescEl) twDescEl.content = cfg.desc;

      const kwEl = document.querySelector('meta[name="keywords"]');
      if (kwEl) kwEl.content = cfg.keywords;

      const ogTitleEl = document.querySelector('meta[property="og:title"]');
      if (ogTitleEl) ogTitleEl.content = cfg.title;
      const twTitleEl = document.querySelector('meta[name="twitter:title"]');
      if (twTitleEl) twTitleEl.content = cfg.title;

      const canonicalEl = document.querySelector('link[rel="canonical"]');
      if (canonicalEl) canonicalEl.href = `https://zencaption.online${targetUrl === '/' ? '' : targetUrl}`;
    }
  }

  renderRoute(route, params = {}) {
    if (!this.mainContainer) return;
    this.mainContainer.innerHTML = '';

    // Handle Navbar and Footer visibility:
    // Dashboard and Admin panels have their own standalone sidebar workspace layout
    const isStudioOrAdmin = route === 'app' || route === 'admin';
    if (this.navbar?.container) {
      this.navbar.container.style.display = isStudioOrAdmin ? 'none' : 'block';
    }
    if (this.footer?.container) {
      this.footer.container.style.display = isStudioOrAdmin ? 'none' : 'block';
    }

    switch (route) {
      case 'home': {
        const page = new LandingPage({
          onNavigate: (r, p) => this.navigate(r, p),
          onOpenAuth: (m) => this.authModal.open(m),
          showToast: (msg, t) => this.showToast(msg, t)
        });
        page.render(this.mainContainer);
        page.init();
        break;
      }

      case 'about': {
        const page = new AboutPage({
          onNavigate: (r) => this.navigate(r)
        });
        page.render(this.mainContainer);
        break;
      }

      case 'contact': {
        const page = new ContactPage({
          onNavigate: (r) => this.navigate(r),
          showToast: (msg, t) => this.showToast(msg, t)
        });
        page.render(this.mainContainer);
        break;
      }

      case 'terms': {
        const page = new TermsPage({
          onNavigate: (r) => this.navigate(r)
        });
        page.render(this.mainContainer);
        break;
      }

      case 'cookies': {
        const page = new CookiePolicyPage({
          onNavigate: (r) => this.navigate(r)
        });
        page.render(this.mainContainer);
        break;
      }

      case 'blog': {
        const page = new BlogListPage({
          onNavigate: (r, p) => this.navigate(r, p)
        });
        page.render(this.mainContainer);
        break;
      }

      case 'blog-detail': {
        const page = new BlogDetailPage({
          onNavigate: (r, p) => this.navigate(r, p)
        });
        page.render(this.mainContainer, params.slug);
        break;
      }

      case 'app': {
        this.userDashboard = new UserDashboard({
          navigate: (r, p) => this.navigate(r, p),
          showToast: (msg, t) => this.showToast(msg, t),
          openAuthModal: (m) => this.authModal.open(m),
          toolStudio: this.toolStudio
        });
        this.userDashboard.render(this.mainContainer);
        this.userDashboard.init();
        break;
      }

      case 'admin': {
        // Enforce admin role
        if (!api.currentUser || api.currentUser.role !== 'admin') {
          this.showToast('Admin authorization required. Please sign in as an administrator.', 'warning');
          this.authModal.open('signin');
          this.navigate('home');
          return;
        }

        this.adminDashboard = new AdminDashboard({
          onNavigate: (r, p) => this.navigate(r, p),
          showToast: (msg, t) => this.showToast(msg, t)
        });
        this.adminDashboard.render(this.mainContainer);
        this.adminDashboard.init();
        break;
      }

      default: {
        this.navigate('home');
        break;
      }
    }
  }

  setupToastContainer() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    document.body.appendChild(this.toastContainer);
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span style="font-weight: 800; font-size: 1.1rem;">${icon}</span>
      <span>${message}</span>
    `;

    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4200);
  }
}

function bootstrapZenSaaS() {
  const app = new ZenSaaSApp();
  app.init().catch(err => {
    console.error('[ZenSaaSApp] Boot error:', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapZenSaaS);
} else {
  bootstrapZenSaaS();
}
