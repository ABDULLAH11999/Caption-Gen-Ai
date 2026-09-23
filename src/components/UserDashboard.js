// User Dashboard Component: SaaS Workspace
// Features: Left Sidebar, Templates & Style Studio, Apply Captions with 20%-100% Loader & Cancel,
// Line Segments Edit Modal, Quota Tracker, and Per-User Template Customizations.

import { 
  APP_CONFIG, 
  CAPTION_POSITIONS, 
  CAPTION_ANIMATIONS, 
  AUTO_ANIMATION_SEQUENCE,
  CAPTION_TEMPLATES,
  DEFAULT_LANDSCAPE_CONFIG, 
  DEFAULT_PORTRAIT_CONFIG,
  FONTS
} from '../config.js';
import { api } from '../services/apiClient.js';
import { soundFx } from '../services/soundFx.js';
import { storage } from '../services/storageService.js';
import { captionEngine } from '../services/captionEngine.js';
import { videoRenderer } from '../services/videoRenderer.js';
import { speechTranscriber } from '../services/speechTranscriber.js';
import { languageIdentifier } from '../services/languageIdentifier.js';
import { translationService } from '../services/translationService.js';
import { generateDemoVideoBlob } from '../utils/sampleVideoGenerator.js';
import { autoTypographyEngine } from '../services/autoTypographyEngine.js';
import { videoColorAnalyzer } from '../services/videoColorAnalyzer.js';
import { selfieSegmenterService } from '../services/selfieSegmenter.js';

export class UserDashboard {
  constructor(options = {}) {
    this.navigate = options.navigate || (() => {});
    this.showToast = options.showToast || (() => {});
    this.openAuthModal = options.openAuthModal || (() => {});
    this.toolStudio = options.toolStudio || null;

    this.activeTab = 'apply'; // 'templates' | 'apply' | 'quota'
    this.currentMode = 'landscape'; // 'landscape' | 'portrait'
    this.selectedTemplateId = 'september-pop';
    this.userCustomTemplates = {}; // templateId -> custom config
    this.activeConfig = { ...DEFAULT_LANDSCAPE_CONFIG };

    // Video State
    this.videoBlob = null;
    this.videoDuration = 0;
    this.videoElement = null;
    this.cutoutCanvas = null;
    this.rotoscopingLoopRunning = false;
    this.isPlaying = false;
    this.enhanceVideoQuality = true; // default enabled
    this.isProcessing = false;
    this.processingProgress = 20;
    this.processingStatus = 'Initializing...';
    this.processingCancelled = false;

    // Line Segments
    this.segments = [];

    // Quota State
    this.quotaInfo = {
      planName: 'Free Starter',
      dailyLimit: 3,
      dailyUsed: 0,
      monthlyLimit: 15,
      monthlyUsed: 0,
      isGuest: true
    };

    this.container = null;
    this.lastRenderedSentenceKey = null;
  }

  async init() {
    await this.loadUserData();
    await this.loadQuotaData();
  }

  getSystemRequirementsProfile() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const ua = nav.userAgent || '';
    const platform = nav.platform || '';
    const isTouchMac = /Macintosh/i.test(ua) && Number(nav.maxTouchPoints || 0) > 1;

    if (/Android/i.test(ua)) {
      return {
        badge: 'Android detected',
        title: 'Android Requirements',
        sub: 'Best for short MP4/WebM clips in Chrome or Samsung Internet.',
        minimum: [
          'Android 10 or newer',
          'Chrome 110+ / Samsung Internet 20+',
          '6 GB RAM or more',
          'Snapdragon 730 / Dimensity 800 class chip',
          'Use 720p or short 1080p videos for smoother export'
        ],
        recommended: [
          'Android 13 or newer',
          'Latest Chrome with hardware acceleration',
          '8 GB RAM or more',
          'Snapdragon 8 Gen / Dimensity 9000 class chip',
          'Keep 3 GB free storage and close heavy apps'
        ]
      };
    }

    if (/iPhone|iPad|iPod/i.test(ua) || isTouchMac) {
      return {
        badge: 'iPhone/iPad detected',
        title: 'iPhone Requirements',
        sub: 'Safari works best for Apple mobile video files and portrait clips.',
        minimum: [
          'iPhone XS / XR or newer',
          'iOS 16 or newer',
          'Safari or Chrome latest version',
          'Use MP4/MOV clips under the upload limit',
          'Keep Low Power Mode off while exporting'
        ],
        recommended: [
          'iPhone 13 or newer',
          'iOS 17 or newer',
          'Latest Safari with enough free storage',
          '1080p clips for fastest caption preview',
          'Keep the screen awake during 60 FPS export'
        ]
      };
    }

    if (/Windows NT|Win32|Win64|WOW64/i.test(ua + platform)) {
      return {
        badge: 'Windows PC detected',
        title: 'Windows Requirements',
        sub: 'Chrome or Edge gives the most reliable AI caption and 60 FPS export path.',
        minimum: [
          'Windows 10 or newer',
          'Chrome 110+ / Edge 110+',
          '4-core CPU, 2.0 GHz+',
          '8 GB RAM',
          'Integrated GPU with hardware acceleration enabled'
        ],
        recommended: [
          'Windows 11',
          'Latest Chrome or Edge',
          '6-core or 8-core CPU',
          '16 GB RAM or more',
          'Dedicated NVIDIA / AMD / Intel Arc GPU'
        ]
      };
    }

    if (/Macintosh|Mac OS X|MacIntel/i.test(ua + platform)) {
      return {
        badge: 'Mac detected',
        title: 'Mac Requirements',
        sub: 'Apple Silicon Macs are recommended for fastest local AI processing.',
        minimum: [
          'macOS 12 Monterey or newer',
          'Safari 16+ / Chrome 110+',
          'Apple M1 or Intel i5 4-core',
          '8 GB unified memory / RAM',
          'Use 1080p clips for best browser stability'
        ],
        recommended: [
          'macOS 14 Sonoma or newer',
          'Apple M1/M2/M3/M4 or better',
          '16 GB unified memory or more',
          'Latest Safari or Chrome',
          'Plenty of free storage for exported video'
        ]
      };
    }

    return {
      badge: 'Browser detected',
      title: 'Device Requirements',
      sub: 'Fallback requirements for modern phones, tablets, laptops, and desktops.',
      minimum: [
        'Modern browser from 2023 or newer',
        '4-core CPU or recent mobile chip',
        '8 GB RAM if available',
        'Hardware video decoding support',
        'Use short 720p or 1080p clips first'
      ],
      recommended: [
        'Latest Chrome, Edge, or Safari',
        '8-core CPU or recent flagship mobile chip',
        '16 GB RAM on desktop / 8 GB on mobile',
        'GPU acceleration enabled',
        'Stable power and 3 GB free storage'
      ]
    };
  }

  renderSystemRequirementsModal() {
    const profile = this.getSystemRequirementsProfile();
    const list = (items) => items.map(item => `<li>${item}</li>`).join('');

    return `
      <div id="sysreq-modal-backdrop" class="sysreq-modal-backdrop" aria-hidden="true">
        <div class="sysreq-modal-inner" role="dialog" aria-modal="true" aria-labelledby="sysreq-title">
          <button id="btn-sysreq-close" class="sysreq-close-btn" aria-label="Close system requirements">x</button>
          <div class="sysreq-header">
            <div class="sysreq-icon">i</div>
            <div>
              <div class="sysreq-badge">${profile.badge}</div>
              <h2 id="sysreq-title">${profile.title}</h2>
              <p>${profile.sub}</p>
            </div>
          </div>
          <div class="sysreq-grid">
            <section class="sysreq-card sysreq-card-min">
              <span class="sysreq-card-label">Minimum</span>
              <ul>${list(profile.minimum)}</ul>
            </section>
            <section class="sysreq-card sysreq-card-rec">
              <span class="sysreq-card-label">Recommended</span>
              <ul>${list(profile.recommended)}</ul>
            </section>
          </div>
          <div class="sysreq-note">
            All captioning, preview, and export work runs locally on this device. Faster CPU/GPU/RAM gives smoother preview and quicker 60 FPS export.
          </div>
        </div>
      </div>
    `;
  }

  async loadUserData() {
    try {
      if (api.token) {
        const res = await api.getUserTemplates();
        if (res && res.templates) {
          this.userCustomTemplates = res.templates;
        }
      } else {
        // Fallback to local storage for guest
        const saved = localStorage.getItem('zen_guest_custom_templates');
        if (saved) {
          try { this.userCustomTemplates = JSON.parse(saved); } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('[UserDashboard] Could not load user templates:', err.message);
    }
  }

  async loadQuotaData() {
    try {
      const res = await api.checkQuota();
      if (res) {
        this.quotaInfo = {
          planName: res.planName || 'Free Starter',
          dailyLimit: res.dailyLimit ?? 3,
          dailyUsed: res.dailyUsed ?? 0,
          monthlyLimit: res.monthlyLimit ?? 15,
          monthlyUsed: res.monthlyUsed ?? 0,
          isGuest: !api.currentUser
        };
      }
    } catch (err) {
      console.warn('[UserDashboard] Quota check failed:', err.message);
    }
  }

  async checkQuotaBeforeAction() {
    await this.loadQuotaData();
    const { dailyLimit, dailyUsed, monthlyLimit, monthlyUsed } = this.quotaInfo;
    if (dailyUsed >= dailyLimit || monthlyUsed >= monthlyLimit) {
      this.showQuotaExceededModal();
      return false;
    }
    return true;
  }

  showQuotaExceededModal() {
    const existing = document.getElementById('user-quota-exceeded-modal');
    if (existing) existing.remove();

    soundFx.playKeyBeep?.(320);

    const { planName, dailyLimit, dailyUsed, monthlyLimit, monthlyUsed, isGuest } = this.quotaInfo;
    const modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'user-quota-exceeded-modal';
    modalBackdrop.className = 'quota-modal-backdrop is-open';
    modalBackdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(12, 12, 14, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: modalFadeIn 0.2s ease-out;
    `;

    modalBackdrop.innerHTML = `
      <div class="quota-modal-card" style="
        background: #ffffff;
        border-radius: 20px;
        max-width: 480px;
        width: 100%;
        padding: 32px 28px;
        text-align: center;
        box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.35);
        position: relative;
        font-family: inherit;
        animation: modalPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <button id="btn-close-quota-modal" style="
          position: absolute;
          top: 16px;
          right: 18px;
          background: none;
          border: none;
          font-size: 20px;
          line-height: 1;
          color: #94a3b8;
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          transition: all 0.15s ease;
        ">✕</button>

        <div style="
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #fef2f2;
          border: 2px solid #fee2e2;
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin: 0 auto 16px auto;
        ">⚡</div>

        <div style="
          display: inline-block;
          background: #fee2e2;
          color: #991b1b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 20px;
          margin-bottom: 10px;
        ">Daily Limit Reached</div>

        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0;">
          Generation Quota Exceeded
        </h2>

        <p style="font-size: 13.5px; color: #64748b; line-height: 1.5; margin: 0 0 20px 0;">
          You have reached your daily generation limit of <strong style="color: #0f172a;">${dailyLimit} / ${dailyLimit} videos</strong> on the <strong style="color: var(--primary-coral);">${planName}</strong> plan.
        </p>

        <!-- Usage progress bar -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 22px; text-align: left;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px;">
            <span>Daily Generations</span>
            <span style="color: #ef4444; font-weight: 800;">${dailyUsed} / ${dailyLimit} Used (100%)</span>
          </div>
          <div style="height: 8px; background: #e2e8f0; border-radius: 6px; overflow: hidden;">
            <div style="height: 100%; width: 100%; background: #ef4444; border-radius: 6px;"></div>
          </div>
          <p style="font-size: 11px; color: #94a3b8; margin: 8px 0 0 0;">
            💡 Quotas reset every 24 hours at 00:00 UTC.
          </p>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-modal-view-quota" class="btn btn-primary" style="
            width: 100%;
            height: 44px;
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
          ">
            <span>📊</span>
            <span>View My Plan &amp; Quota</span>
          </button>

          <button id="btn-modal-request-upgrade" class="btn btn-outline" style="
            width: 100%;
            height: 40px;
            font-size: 13px;
            font-weight: 700;
            color: var(--primary-coral);
            border-color: var(--primary-coral);
            cursor: pointer;
          ">
            ⚡ Request Higher Limit Plan
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    const closeModal = () => {
      modalBackdrop.remove();
    };

    modalBackdrop.querySelector('#btn-close-quota-modal')?.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    modalBackdrop.querySelector('#btn-modal-view-quota')?.addEventListener('click', () => {
      closeModal();
      this.switchTab('quota');
    });

    modalBackdrop.querySelector('#btn-modal-request-upgrade')?.addEventListener('click', () => {
      closeModal();
      this.switchTab('quota');
      setTimeout(() => {
        const upgradeBtn = this.container?.querySelector('#btn-quota-upgrade');
        if (upgradeBtn) upgradeBtn.click();
      }, 100);
    });
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'user-dashboard-layout';

    const user = api.currentUser;
    const userName = user ? user.name : 'Guest Creator';
    const userRole = user ? user.role : 'guest';
    const userPlan = this.quotaInfo.planName;
    const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'GC';

    this.container.innerHTML = `
      <!-- Left Sidebar (Matching Reference Image) -->
      <aside class="user-sidebar" id="user-sidebar-nav">
        <div class="user-sidebar-header">
          <div class="user-sidebar-brand-group">
            <span class="brand-rhombus" style="width: 22px; height: 22px;"></span>
            <div class="user-brand-title">Zen Caption AI</div>
          </div>
          <button class="user-sidebar-toggle" id="btn-user-sidebar-toggle" aria-label="Toggle navigation">
            <span></span><span></span><span></span>
          </button>
        </div>

        <div class="user-sidebar-drawer" id="user-sidebar-drawer">
          <ul class="user-sidebar-menu">
            <li class="user-menu-item ${this.activeTab === 'templates' ? 'active' : ''}" data-tab="templates" id="tab-btn-templates">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
              </svg>
              <span>Templates & Styles</span>
            </li>

            <li class="user-menu-item ${this.activeTab === 'apply' ? 'active' : ''}" data-tab="apply" id="tab-btn-apply">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <span>Apply Captions</span>
            </li>

            <li class="user-menu-item ${this.activeTab === 'quota' ? 'active' : ''}" data-tab="quota" id="tab-btn-quota">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"></path>
              </svg>
              <span>My Plan & Quota</span>
            </li>

            <li style="margin: 12px 0 6px 0; height: 1px; background: var(--sidebar-border);"></li>

            <li class="user-menu-item" id="btn-back-to-home" style="color: #94a3b8;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>Back to Home</span>
            </li>

            ${userRole === 'admin' ? `
            <li class="user-menu-item" id="btn-switch-admin" style="color: var(--primary-coral); font-weight: 800;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
              </svg>
              <span>Admin Panel</span>
            </li>
            ` : ''}
          </ul>

          <div class="user-sidebar-footer">
            <div class="user-profile-badge">
              <div class="user-avatar-circle">${userInitials}</div>
              <div class="user-info-text">
                <div class="user-info-name">${userName}</div>
                <div class="user-info-plan">${userPlan}</div>
              </div>
              ${user ? `
              <button id="btn-user-logout" title="Sign Out" style="background: none; border: none; color: #a1a1aa; cursor: pointer; padding: 4px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"></path>
                </svg>
              </button>
              ` : `
              <button id="btn-user-login-prompt" title="Sign In" style="background: var(--primary-coral); border: none; color: #fff; border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                Sign In
              </button>
              `}
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Workspace -->
      <main class="user-main-workspace" id="user-workspace-content">
        <!-- Tab Content dynamically injected -->
      </main>

      <!-- Line Segments Editor Modal Container -->
      <div id="segment-modal-host"></div>
    `;

    parentElement.appendChild(this.container);
    this.bindSidebarEvents();
    this.renderActiveTab();
  }

  closeSidebarDrawer() {
    const sidebar = this.container?.querySelector('#user-sidebar-nav');
    const toggle = this.container?.querySelector('#btn-user-sidebar-toggle');
    sidebar?.classList.remove('open');
    toggle?.classList.remove('active');
  }

  bindSidebarEvents() {
    const toggle = this.container.querySelector('#btn-user-sidebar-toggle');
    const sidebar = this.container.querySelector('#user-sidebar-nav');
    toggle?.addEventListener('click', () => {
      const isOpen = sidebar?.classList.toggle('open');
      toggle.classList.toggle('active', isOpen);
    });

    this.container.querySelectorAll('.user-menu-item[data-tab]').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.getAttribute('data-tab');
        this.closeSidebarDrawer();
        this.switchTab(tab);
      });
    });

    this.container.querySelector('#btn-back-to-home')?.addEventListener('click', () => {
      this.closeSidebarDrawer();
      this.navigate('home');
    });

    this.container.querySelector('#btn-switch-admin')?.addEventListener('click', () => {
      this.closeSidebarDrawer();
      this.navigate('admin');
    });

    this.container.querySelector('#btn-user-logout')?.addEventListener('click', async () => {
      this.closeSidebarDrawer();
      await api.logout();
      this.showToast('You have been signed out.', 'info');
      this.navigate('home');
    });

    this.container.querySelector('#btn-user-login-prompt')?.addEventListener('click', () => {
      this.closeSidebarDrawer();
      this.openAuthModal('signin');
    });
  }

  switchTab(tab) {
    if (this.activeTab !== tab) {
      soundFx.playTabSwitch();
    }
    this.activeTab = tab;
    if (tab === 'templates') {
      document.title = 'Templates & Styles - Zen Caption AI';
    } else if (tab === 'apply') {
      document.title = 'Apply Captions - Zen Caption AI';
    } else if (tab === 'quota') {
      document.title = 'My Plan & Quota - Zen Caption AI';
    }
    this.container.querySelectorAll('.user-menu-item[data-tab]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });
    this.renderActiveTab();
  }

  renderActiveTab() {
    const host = this.container.querySelector('#user-workspace-content');
    if (!host) return;
    host.innerHTML = '';

    const isStudioWorkspace = this.activeTab === 'apply' && !!this.videoBlob && !this.isProcessing;
    host.classList.toggle('studio-workspace-active', isStudioWorkspace);

    if (this.activeTab === 'templates') {
      this.renderTemplatesTab(host);
    } else if (this.activeTab === 'apply') {
      this.renderApplyCaptionsTab(host);
    } else if (this.activeTab === 'quota') {
      this.renderQuotaTab(host);
    }
  }

  // ==========================================================================
  // TAB 1: TEMPLATES & STYLE STUDIO
  // ==========================================================================
  renderTemplatesTab(parent) {
    parent.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="user-tab-header">
        <div>
          <h1 class="user-tab-title">16 Professional Caption Templates</h1>
        </div>

        <div class="user-tab-actions">
          <div class="mode-toggle-group">
            <button class="mode-btn ${this.currentMode === 'landscape' ? 'active' : ''}" id="user-mode-landscape" title="16:9 Widescreen Landscape">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="2.5"></rect><line x1="8" y1="12" x2="16" y2="12"></line></svg>
              <span>16:9 Landscape</span>
            </button>
            <button class="mode-btn ${this.currentMode === 'portrait' ? 'active' : ''}" id="user-mode-portrait" title="9:16 Shorts / Reels Portrait">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="2" width="12" height="20" rx="2.5"></rect><line x1="10" y1="18" x2="14" y2="18"></line></svg>
              <span>9:16 Portrait</span>
            </button>
          </div>
        </div>
      </div>

      <div class="user-templates-grid" id="user-templates-grid">
        <!-- Cards rendered below -->
      </div>
    `;

    parent.appendChild(wrap);

    // Orientation toggle
    wrap.querySelector('#user-mode-landscape')?.addEventListener('click', () => {
      this.currentMode = 'landscape';
      if (this.toolStudio) this.toolStudio.setOrientation('landscape');
      this.renderTemplatesTab(parent);
    });
    wrap.querySelector('#user-mode-portrait')?.addEventListener('click', () => {
      this.currentMode = 'portrait';
      if (this.toolStudio) this.toolStudio.setOrientation('portrait');
      this.renderTemplatesTab(parent);
    });



    const grid = wrap.querySelector('#user-templates-grid');
    CAPTION_TEMPLATES.forEach(tpl => {
      // Check if user has customized this template
      const customConfig = this.userCustomTemplates[tpl.id];
      const effectiveConfig = customConfig ? { ...tpl.config, ...customConfig } : tpl.config;
      const isSelected = this.selectedTemplateId === tpl.id;
      const isCustomized = !!customConfig;

      const card = document.createElement('div');
      card.className = `user-tpl-card ${isSelected ? 'selected' : ''}`;
      card.dataset.tplId = tpl.id;

      card.innerHTML = `
        <div class="user-tpl-preview-box" style="background: #000000;">
          <div class="user-tpl-preview-text" style="font-family: ${effectiveConfig.normalFontFamily || 'Inter'}, sans-serif; color: ${effectiveConfig.textColor || '#fff'}; font-size: 21px; font-weight: 800; text-align: center; line-height: 1.25; letter-spacing: -0.2px;">
            ${tpl.sampleNormal || 'Viral'} 
            <span style="font-family: ${effectiveConfig.prominentFontFamily || 'Syne'}, sans-serif; color: ${effectiveConfig.prominentColor || '#FFE600'}; font-weight: 900; text-transform: uppercase;">
              ${tpl.sampleProminent || 'Captions'}
            </span>
          </div>
        </div>

        <div class="user-tpl-card-header">
          <h3 class="user-tpl-title">${tpl.name}</h3>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${isSelected ? `<span class="badge badge-success" style="font-size: 10px; font-weight: 800; padding: 3px 7px;">ACTIVE</span>` : ''}
            ${isCustomized ? `<span class="badge badge-purple" style="font-size: 10px; padding: 3px 7px;">Edited</span>` : ''}
          </div>
        </div>

        <div class="user-tpl-card-actions">
          <button class="btn-tpl-customize" data-action="customize" data-tpl="${tpl.id}" title="Customize fonts, colors and styling for this template">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
            </svg>
            Customize
          </button>

          ${isCustomized ? `
          <button class="btn-tpl-revert" data-action="revert" data-tpl="${tpl.id}" title="Revert to original preset">
            ↺
          </button>
          ` : ''}
        </div>
      `;

      // Select template on card click
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.selectTemplate(tpl.id);
      });

      // Customize button
      card.querySelector('[data-action="customize"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectTemplate(tpl.id);
        this.openCustomizerForTemplate(tpl.id);
      });

      // Revert button
      card.querySelector('[data-action="revert"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.revertTemplate(tpl.id);
      });

      grid.appendChild(card);
    });
  }

  selectTemplate(tplId) {
    this.selectedTemplateId = tplId;
    this.lastRenderedSentenceKey = null; // Re-trigger entrance animation
    soundFx.playTemplateSelect();
    const tpl = CAPTION_TEMPLATES.find(t => t.id === tplId);
    if (tpl) {
      const customConfig = this.userCustomTemplates[tplId];
      this.activeConfig = customConfig ? { ...tpl.config, ...customConfig } : { ...tpl.config };
      if (this.toolStudio) {
        this.toolStudio.setActiveConfig(this.activeConfig);
      }
      this.showToast(`Selected "${tpl.name}" as active style.`, 'info');
      // Update UI cards
      this.container.querySelectorAll('.user-tpl-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.tplId === tplId);
      });
      this.updateCaptionOverlay();
    }
  }

  openCustomizerForTemplate(tplId) {
    if (!this.toolStudio) return;
    this.toolStudio.selectedTemplateId = tplId;
    if (typeof this.toolStudio.setOrientation === 'function') {
      this.toolStudio.setOrientation(this.currentMode);
    }
    const tpl = CAPTION_TEMPLATES.find(t => t.id === tplId);
    const customConfig = this.userCustomTemplates[tplId];
    const initialConfig = customConfig ? { ...tpl.config, ...customConfig } : { ...tpl.config };
    this.toolStudio.setActiveConfig(initialConfig);
    this.toolStudio.open(this.currentMode);
    this.toolStudio.switchModalTab('customize');

    // Attach hook when config changes in modal to persist to user profile
    this.toolStudio.onConfigChanged = async (cfg, mode) => {
      if (mode && mode !== this.currentMode) {
        this.currentMode = mode;
      }
      this.activeConfig = cfg;
      this.userCustomTemplates[tplId] = cfg;
      this.lastRenderedSentenceKey = null; // Re-trigger entrance animation with newly chosen anim
      if (api.token) {
        try {
          await api.saveUserTemplate(tplId, cfg);
        } catch (e) {
          console.warn('[UserDashboard] Auto-save template failed:', e.message);
        }
      } else {
        localStorage.setItem('zen_guest_custom_templates', JSON.stringify(this.userCustomTemplates));
      }
      // Re-render templates tab preview if open
      if (this.activeTab === 'templates') {
        this.renderTemplatesTab(this.container.querySelector('#user-workspace-content'));
      }
      this.updateCaptionOverlay();
    };
  }

  async revertTemplate(tplId) {
    delete this.userCustomTemplates[tplId];
    if (api.token) {
      try {
        await api.revertUserTemplate(tplId);
      } catch (e) {
        console.warn('Revert template API failed:', e.message);
      }
    } else {
      localStorage.setItem('zen_guest_custom_templates', JSON.stringify(this.userCustomTemplates));
    }
    this.selectTemplate(tplId);
    this.showToast('Template reverted to factory preset.', 'success');
    this.renderTemplatesTab(this.container.querySelector('#user-workspace-content'));
  }

  // ==========================================================================
  // TAB 2: APPLY CAPTIONS (With 20%-100% Loader & Cancel Button)
  // ==========================================================================
  renderApplyCaptionsTab(parent) {
    if (!parent) {
      parent = this.container?.querySelector('#user-workspace-content');
    }
    if (!parent) return;
    parent.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.id = 'apply-captions-workspace-wrap';

    if (this.isProcessing) {
      // PROCESSING VIEW (20% to 100% Loader + Cancel)
      wrap.innerHTML = `
        <div class="user-tab-header">
          <div>
            <h1 class="user-tab-title">Transcribing Audio & Generating Captions</h1>
            <p style="color: #64748b; font-size: 14px;">Offline AI engine running locally in your browser with zero server latency.</p>
          </div>
        </div>

        <div class="processing-progress-card">
          <div class="processing-spinner"></div>
          <div class="processing-status-text" id="proc-status-text">${this.processingStatus}</div>

          <div class="processing-bar-outer">
            <div class="processing-bar-inner" id="proc-bar-inner" style="width: ${this.processingProgress}%;"></div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 24px;">
            <span>Current Operation</span>
            <span id="proc-percent-text">${this.processingProgress}%</span>
          </div>

          <button class="btn btn-outline" id="btn-cancel-processing" style="border-color: #ef4444; color: #ef4444; padding: 10px 24px;">
            ✕ Cancel Transcription
          </button>
        </div>
      `;

      parent.appendChild(wrap);

      wrap.querySelector('#btn-cancel-processing')?.addEventListener('click', () => {
        this.cancelProcessing();
      });
      return;
    }

    if (!this.videoBlob) {
      // DROPZONE / VIDEO PICKER VIEW
      const isQuotaFull = this.quotaInfo && (this.quotaInfo.dailyUsed >= this.quotaInfo.dailyLimit || this.quotaInfo.monthlyUsed >= this.quotaInfo.monthlyLimit);

      wrap.innerHTML = `
        <div class="user-tab-header">
          <div>
            <h1 class="user-tab-title">Apply Captions to Video</h1>
            <p style="color: #64748b; font-size: 14px;">
              Active Template: <strong style="color: var(--primary-coral);">${CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId)?.name || 'Default'}</strong>
            </p>
          </div>

          <button class="btn btn-outline" id="btn-change-template-shortcut">
            🎨 Change Style
          </button>
        </div>

        ${isQuotaFull ? `
          <div class="quota-warning-banner" id="quota-warning-banner" style="max-width: 800px; margin: 0 auto 16px auto; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; color: #991b1b; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.08);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">⚡</span>
              <span><strong>Daily Quota Limit Reached (${this.quotaInfo.dailyUsed}/${this.quotaInfo.dailyLimit}):</strong> Upgrade your plan or view quota to unlock more generations.</span>
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-banner-view-quota" style="border-color: #dc2626; color: #dc2626; padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 8px; flex-shrink: 0; background: #fff; cursor: pointer;">
              📊 View Quota
            </button>
          </div>
        ` : ''}

        <div class="upload-card" id="user-drop-zone" style="max-width: 800px; margin: 20px auto; background: #ffffff; border: 2px dashed ${isQuotaFull ? '#fca5a5' : '#cbd5e1'}; border-radius: var(--radius-xl); padding: 48px 32px; text-align: center; cursor: pointer;">
          <input type="file" id="user-file-input" accept="video/*,video/mp4,video/quicktime,video/webm" style="display: none;">
          
          <div style="width: 64px; height: 64px; border-radius: 50%; background: ${isQuotaFull ? '#fef2f2' : 'var(--primary-coral-light)'}; color: ${isQuotaFull ? '#ef4444' : 'var(--primary-coral)'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>

          <h2 style="font-size: 22px; font-weight: 900; color: #0c0c0e; margin-bottom: 8px;">Upload Video to Add Captions</h2>
          <p style="color: #64748b; font-size: 14px; max-width: 480px; margin: 0 auto 24px auto;">
            Select any MP4, WebM or MOV video. The local Whisper engine will extract audio and align word-by-word timestamps.
          </p>

          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 28px;">
            <span class="badge badge-cyan">MAX SIZE: ${APP_CONFIG.MAX_FILE_SIZE_MB} MB</span>
            <span class="badge badge-purple">MAX DURATION: ${Math.floor(APP_CONFIG.MAX_DURATION_SEC / 60)} MIN</span>
            <span class="badge badge-success">100% LOCAL PROCESSING</span>
          </div>

          <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px;">
            <button class="btn btn-primary" id="btn-user-browse-file" style="padding: 12px 28px; font-size: 15px;">
              📁 Browse Video File
            </button>
          </div>

          <!-- Video Quality Enhancement Checkbox -->
          <div style="display: inline-flex; align-items: center; gap: 10px; background: #fafbfe; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 30px;">
            <input type="checkbox" id="user-enhance-quality" ${this.enhanceVideoQuality ? 'checked' : ''} style="accent-color: var(--primary-coral); cursor: pointer; width: 16px; height: 16px;">
            <label for="user-enhance-quality" style="font-size: 13px; font-weight: 700; color: #1e293b; cursor: pointer;">
              ✨ Enhance Video Quality
            </label>
          </div>
        </div>

        <!-- Important Notice regarding Client-Side Hardware Processing -->
        <div class="client-processing-notice" style="max-width: 800px; margin: 24px auto 0 auto; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px 16px; text-align: center; font-size: 13px; color: #9a3412; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>⚠ <strong style="color: #7c2d12;">100% Local:</strong> All processing runs on your device — speed depends on your system.</span>
          <button id="btn-sysreq-info" title="View System Requirements" style="background: none; border: 1.5px solid #ea580c; color: #ea580c; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1; padding: 0;">i</button>
        </div>

        <!-- System Requirements Modal -->
        <div id="sysreq-modal-backdrop-legacy" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; align-items:center; justify-content:center;">
          <style>
            @media (max-width: 600px) {
              #sysreq-modal-inner { padding: 24px 16px !important; }
              #sysreq-spec-grid { grid-template-columns: 1fr !important; }
            }
          </style>
          <div id="sysreq-modal-inner-legacy" style="background:#fff; border-radius:16px; padding:32px 28px; max-width:640px; width:92%; box-shadow:0 24px 60px rgba(0,0,0,0.22); position:relative; font-family:inherit; max-height:90vh; overflow-y:auto;">
            <button id="btn-sysreq-close-legacy" style="position:absolute; top:14px; right:16px; background:none; border:none; font-size:22px; cursor:pointer; color:#94a3b8; line-height:1;">×</button>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
              <div style="width:36px;height:36px;border-radius:10px;background:#fff7ed;display:flex;align-items:center;justify-content:center;font-size:18px;">💻</div>
              <div>
                <div style="font-size:16px;font-weight:800;color:#0f172a;">System Requirements</div>
                <div style="font-size:12px;color:#64748b;">For AI caption processing &amp; 60 FPS export</div>
              </div>
            </div>
            <div id="sysreq-spec-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">⚙️ Minimum</div>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:#334155;">
                  <div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:18px;height:18px;border-radius:50%;background:#e2e8f0;color:#475569;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">1</span><div><span style="font-weight:700;color:#0f172a;">CPU</span><br>4-core, 2.0 GHz+</div></div>
                  <div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:18px;height:18px;border-radius:50%;background:#e2e8f0;color:#475569;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">2</span><div><span style="font-weight:700;color:#0f172a;">RAM</span><br>8 GB</div></div>
                  <div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:18px;height:18px;border-radius:50%;background:#e2e8f0;color:#475569;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">3</span><div><span style="font-weight:700;color:#0f172a;">GPU</span><br>Integrated (basic export)</div></div>
                  <div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:18px;height:18px;border-radius:50%;background:#e2e8f0;color:#475569;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">4</span><div><span style="font-weight:700;color:#0f172a;">Browser</span><br>Chrome 110+ / Edge 110+</div></div>
                </div>
              </div>
              <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:12px;padding:16px;">
                <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">⚡ Recommended</div>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:#334155;">
                  <div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:18px;height:18px;border-radius:50%;background:#ede9fe;color:#7c3aed;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">1</span><div><span style="font-weight:700;color:#0f172a;">CPU</span><br>8-core, 3.0 GHz+ (Intel i7 / Ryzen 7)</div></div>
                  <div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:18px;height:18px;border-radius:50%;background:#ede9fe;color:#7c3aed;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">2</span><div><span style="font-weight:700;color:#0f172a;">RAM</span><br>16 GB+</div></div>
                  <div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:18px;height:18px;border-radius:50%;background:#ede9fe;color:#7c3aed;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">3</span><div><span style="font-weight:700;color:#0f172a;">GPU</span><br>Dedicated (NVIDIA / AMD) for 60 FPS</div></div>
                  <div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:18px;height:18px;border-radius:50%;background:#ede9fe;color:#7c3aed;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">4</span><div><span style="font-weight:700;color:#0f172a;">Browser</span><br>Chrome 120+ (GPU acceleration on)</div></div>
                </div>
              </div>
            </div>
            <div style="margin-top:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:12px;color:#166534;">
              💡 <strong>Tip:</strong> Enable GPU acceleration in your browser settings for best 60 FPS export performance.
            </div>
          </div>
        </div>
        ${this.renderSystemRequirementsModal()}
      `;

      parent.appendChild(wrap);

      // Event Listeners for Dropzone
      const fileInput = wrap.querySelector('#user-file-input');

      wrap.querySelector('#btn-banner-view-quota')?.addEventListener('click', () => {
        this.switchTab('quota');
      });

      wrap.querySelector('#btn-user-browse-file')?.addEventListener('click', async (e) => {
        soundFx.playKeyBeep(520);
        const isAllowed = await this.checkQuotaBeforeAction();
        if (!isAllowed) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        fileInput.click();
      });

      wrap.querySelector('#btn-change-template-shortcut')?.addEventListener('click', () => {
        this.switchTab('templates');
      });

      // System Requirements Info Modal
      const sysreqBackdrop = wrap.querySelector('#sysreq-modal-backdrop');
      const closeSysreqModal = () => {
        if (!sysreqBackdrop) return;
        sysreqBackdrop.classList.remove('is-open');
        sysreqBackdrop.setAttribute('aria-hidden', 'true');
      };
      wrap.querySelector('#btn-sysreq-info')?.addEventListener('click', () => {
        if (sysreqBackdrop) {
          soundFx.playKeyBeep(680);
          sysreqBackdrop.classList.add('is-open');
          sysreqBackdrop.setAttribute('aria-hidden', 'false');
        }
      });
      sysreqBackdrop?.querySelector('#btn-sysreq-close')?.addEventListener('click', () => {
        closeSysreqModal();
      });
      sysreqBackdrop?.addEventListener('click', (e) => {
        if (e.target === sysreqBackdrop) closeSysreqModal();
      });

      const enhanceChk = wrap.querySelector('#user-enhance-quality');
      if (enhanceChk) {
        enhanceChk.addEventListener('change', (e) => {
          this.enhanceVideoQuality = e.target.checked;
          soundFx.playEnhanceToggle(this.enhanceVideoQuality);
        });
      }

      fileInput?.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          const isAllowed = await this.checkQuotaBeforeAction();
          if (!isAllowed) return;
          await this.handleVideoFile(e.target.files[0]);
        }
      });

      // Drag & Drop
      const dropZone = wrap.querySelector('#user-drop-zone');
      if (dropZone) {
        ['dragenter', 'dragover'].forEach(name => {
          dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary-coral)';
            dropZone.style.background = 'var(--primary-coral-light)';
          });
        });
        ['dragleave', 'drop'].forEach(name => {
          dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            dropZone.style.borderColor = isQuotaFull ? '#fca5a5' : '#cbd5e1';
            dropZone.style.background = '#ffffff';
          });
        });
        dropZone.addEventListener('drop', async (e) => {
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const isAllowed = await this.checkQuotaBeforeAction();
            if (!isAllowed) return;
            await this.handleVideoFile(e.dataTransfer.files[0]);
          }
        });
      }
      return;
    }

    // WORKSPACE VIEW (Video Player + Live Overlay + Transcript Sidebar)
    wrap.innerHTML = `
      <div class="workspace-studio-layout">
        
        <!-- Left: Canvas & Video Player Panel -->
        <div class="studio-canvas-panel">
          <div class="user-tab-header" style="margin-bottom: 20px;">
            <div>
              <h1 class="user-tab-title">Video Caption Workspace</h1>
              <p style="color: #64748b; font-size: 13px;">
                Active Style: <strong>${CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId)?.name || 'Default'}</strong>
              </p>
            </div>

            <div class="user-tab-actions">
              <button class="btn btn-outline" id="btn-reselect-video" style="padding: 8px 16px; font-size: 13px;">
                🔄 New Video
              </button>
              <button class="btn btn-outline" id="btn-workspace-style" style="padding: 8px 16px; font-size: 13px;">
                🎨 Templates
              </button>
            </div>
          </div>

          <!-- Video Player Card -->
          <div class="video-player-card">
            <div class="video-container ${this.currentMode}" id="user-video-wrapper">
              <video class="studio-video-element" id="user-main-video" playsinline style="width: 100%; height: 100%; object-fit: contain;"></video>
              
              <!-- Real-Time Caption Overlay (Layer 2) -->
              <div class="caption-live-overlay" id="user-caption-live-overlay"></div>

              <!-- Foreground Rotoscoped Person Cutout (Layer 3) -->
              <canvas class="cutout-live-canvas" id="user-cutout-canvas" style="display: none;"></canvas>
            </div>

            <!-- Controls -->
            <div class="player-controls">
              <div class="timeline-scrubber-wrapper">
                <input type="range" class="timeline-scrubber" id="user-timeline-scrubber" min="0" max="100" value="0" step="0.1" style="flex: 1; accent-color: var(--primary-coral); cursor: pointer;">
                <span class="timestamp-indicator" id="user-time-display">00:00 / 00:00</span>
              </div>

              <!-- Enhancement Checkbox -->
              <div class="player-enhance-bar">
                <label class="player-enhance-label">
                  <input type="checkbox" id="user-player-enhance" ${this.enhanceVideoQuality ? 'checked' : ''} style="accent-color: var(--primary-coral);">
                  <span>✨ Enhance Video Quality</span>
                </label>
                <span class="badge badge-success" style="font-size: 10px;">60 FPS LOSSLESS</span>
              </div>

              <div class="player-action-controls">
                <div class="player-playback-btns">
                  <button class="btn btn-outline btn-play-circle" id="user-btn-play">▶</button>
                  <button class="btn btn-outline btn-compact-action" id="user-btn-rw">↺ 5s</button>
                  <button class="btn btn-outline btn-compact-action" id="user-btn-ff">5s ↻</button>
                  <button class="btn btn-outline btn-compact-action" id="user-btn-mute">🔊</button>
                </div>

                <div class="player-export-btns">
                  <div class="player-export-secondary-row">
                    <button class="btn btn-outline btn-compact-action" id="user-btn-srt">.SRT</button>
                    <button class="btn btn-outline btn-compact-action" id="user-btn-vtt">.VTT</button>
                  </div>
                  <button class="btn btn-primary btn-burn-captions" id="user-btn-burn">
                    <div class="burn-btn-content">
                      <span>🎥 Burn Captions (60 FPS Export)</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Export Progress Indicator -->
              <div id="user-export-progress" style="display: none; margin-top: 14px; background: #fafbfe; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 6px; color: var(--primary-coral);">
                  <span>Burning captions at source quality...</span>
                  <span id="user-export-percent">0%</span>
                </div>
                <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                  <div id="user-export-bar" style="width: 0%; height: 100%; background: var(--primary-coral); transition: width 0.1s linear;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Full-Height Studio Sidebar for Segments & Styling -->
        <aside class="studio-sidebar-right">
          <div class="studio-sidebar-right-header">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
              <div>
                <div style="font-size: 14px; font-weight: 800; color: #0c0c0e; letter-spacing: -0.2px;">CAPTIONS & WORDS</div>
                <div style="font-size: 11px; color: #64748b;" id="user-sentence-count">${captionEngine.sentences.length} Line Segments</div>
              </div>
            </div>

            <!-- ACTION BUTTONS: APPLY SIZE & POS TO ALL, PROCESS AGAIN & EDIT SEGMENTS -->
            <div class="segments-header-actions-stack">
              <button class="btn btn-seg-action btn-action-follow-pos" id="btn-header-apply-pos-all" title="Apply active segment sizing and position to ALL segments">
                <span>⚡ Apply Size & Pos to All</span>
              </button>
              <button class="btn btn-seg-action btn-behind-process" id="btn-process-behind-again" title="Apply Rotoscoping to render checked lines behind subject">
                <span>⚡ Process Again</span>
                <span id="behind-active-badge" class="behind-count-pill">0 Behind</span>
              </button>
              <button class="btn btn-seg-action btn-action-edit-seg" id="btn-open-segments-modal" title="Edit subtitle texts and timestamps">
                <span>✏️ Edit Segments</span>
              </button>
            </div>
          </div>

          <div class="studio-segments-list" id="user-segments-mini-list">
            <!-- Dynamically populated -->
          </div>
        </aside>

      </div>
    `;

    parent.appendChild(wrap);
    this.initVideoPlayer(wrap);
  }

  // ==========================================================================
  // PROCESSING & TRANSCRIBING FLOW (20% to 100% Loader with Cancel)
  // ==========================================================================
  async handleDemoVideoLoad() {
    const isAllowed = await this.checkQuotaBeforeAction();
    if (!isAllowed) return;

    soundFx.playProcessStart();
    this.isProcessing = true;
    this.processingCancelled = false;
    this.processingProgress = 20;
    this.processingStatus = 'Generating high-definition showcase demo stream...';
    this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));

    try {
      await this.sleep(400);
      if (this.processingCancelled) return;

      this.updateProcessingProgress(35, 'Extracting 16kHz audio waveform for Whisper AI...');
      const demoBlob = await generateDemoVideoBlob();
      if (this.processingCancelled) return;

      await this.sleep(400);
      this.updateProcessingProgress(55, 'Detecting spoken language and transcribing utterances...');

      await this.processVideoBlob(demoBlob);
    } catch (err) {
      if (!this.processingCancelled) {
        this.showToast('Failed to load showcase video: ' + err.message, 'error');
        this.isProcessing = false;
        this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));
      }
    }
  }

  updateProcessingProgress(percent, status) {
    const nextPercent = Math.max(this.processingProgress || 0, Math.round(percent));
    this.processingProgress = nextPercent;
    this.processingStatus = status;
    const txt = this.container.querySelector('#proc-status-text');
    const bar = this.container.querySelector('#proc-bar-inner');
    const pct = this.container.querySelector('#proc-percent-text');
    if (txt) txt.textContent = status;
    if (bar) bar.style.width = `${nextPercent}%`;
    if (pct) pct.textContent = `${nextPercent}%`;
  }

  cancelProcessing() {
    this.processingCancelled = true;
    this.isProcessing = false;
    this.videoBlob = null;
    this.showToast('Transcription cancelled.', 'info');
    this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));
  }

  async handleVideoFile(file) {
    if (!file) return;

    const isAllowed = await this.checkQuotaBeforeAction();
    if (!isAllowed) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > APP_CONFIG.MAX_FILE_SIZE_MB) {
      this.showToast(`Video size (${fileSizeMB.toFixed(1)} MB) exceeds maximum allowed ${APP_CONFIG.MAX_FILE_SIZE_MB} MB limit.`, 'error');
      return;
    }

    soundFx.playProcessStart();
    this.isProcessing = true;
    this.processingCancelled = false;
    this.processingProgress = 15;
    this.processingStatus = 'Reading video file & metadata...';
    this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));

    try {
      if (this.processingCancelled) return;

      await this.processVideoBlob(file);
    } catch (err) {
      if (!this.processingCancelled) {
        this.showToast('Video processing error: ' + err.message, 'error');
        this.isProcessing = false;
        this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));
      }
    }
  }

  async processVideoBlob(blob) {
    this.videoBlob = blob;

    if (this.processingCancelled) return;

    // Transcribe audio using offline speech transcriber
    try {
      const transcribeResult = await speechTranscriber.transcribeVideoBlob(blob, (status, pct) => {
        if (this.processingCancelled) return;
        const mapped = Math.min(96, Math.max(20, Math.round(pct)));
        this.updateProcessingProgress(mapped, status);
      });

      if (this.processingCancelled) return;

      this.updateProcessingProgress(98, 'Synchronizing typography with active template...');
      await this.sleep(200);

      if (transcribeResult && transcribeResult.sentences && transcribeResult.sentences.length > 0) {
        captionEngine.setSentences(transcribeResult.sentences);
      } else {
        captionEngine.setSentences([]);
        this.showToast('No speech transcript was detected. Use Edit Segments to add words manually.', 'info');
      }

      this.updateProcessingProgress(100, 'Transcription complete! Loading workspace...');
      await this.sleep(250);

      if (this.processingCancelled) return;

      // Consume quota in backend
      try {
        await api.consumeQuota();
        await this.loadQuotaData();
      } catch (e) {
        console.warn('Quota consume error:', e.message);
      }

      this.isProcessing = false;
      this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));
      soundFx.playOutputReady();
      this.showToast('Video processed successfully!', 'success');
    } catch (err) {
      if (!this.processingCancelled) {
        throw err;
      }
    }
  }

  // ==========================================================================
  // VIDEO PLAYER & TIMELINE LOGIC
  // ==========================================================================
  initVideoPlayer(wrap) {
    this.videoElement = wrap.querySelector('#user-main-video');
    this.cutoutCanvas = wrap.querySelector('#user-cutout-canvas');
    if (!this.videoElement || !this.videoBlob) return;

    const url = URL.createObjectURL(this.videoBlob);
    this.videoElement.playsInline = true;
    this.videoElement.setAttribute('playsinline', '');
    this.videoElement.setAttribute('webkit-playsinline', '');
    this.videoElement.src = url;

    // Apply video enhancement class immediately if enabled
    this.videoElement.classList.toggle('video-enhanced', !!this.enhanceVideoQuality);

    const scrubber = wrap.querySelector('#user-timeline-scrubber');
    const timeDisplay = wrap.querySelector('#user-time-display');
    const playBtn = wrap.querySelector('#user-btn-play');

    this.videoElement.addEventListener('loadedmetadata', () => {
      this.videoDuration = this.videoElement.duration || 0;
      const vw = this.videoElement.videoWidth || 1920;
      const vh = this.videoElement.videoHeight || 1080;
      const isPortrait = vh > vw;
      this.currentMode = isPortrait ? 'portrait' : 'landscape';
      if (this.toolStudio && typeof this.toolStudio.setOrientation === 'function') {
        this.toolStudio.setOrientation(this.currentMode);
      }
      const videoWrapper = wrap.querySelector('#user-video-wrapper');
      if (videoWrapper) {
        videoWrapper.className = `video-container ${this.currentMode}`;
        videoWrapper.style.aspectRatio = isPortrait ? '9/16' : '16/9';
      }
      if (scrubber) scrubber.max = this.videoDuration;
      this.updateTimeDisplay();
      this.renderMiniSegmentsList();
      this.updateCaptionOverlay();
      this.renderCutoutIfActiveBehind();
      this.startRotoscopingLoop();
    });

    this.videoElement.addEventListener('timeupdate', () => {
      if (scrubber && !scrubber.matches(':active')) {
        scrubber.value = this.videoElement.currentTime;
      }
      this.updateTimeDisplay();
      this.updateCaptionOverlay();
      this.renderCutoutIfActiveBehind();
      this.highlightActiveSegment();
    });

    playBtn?.addEventListener('click', () => {
      if (this.videoElement.paused) {
        this.videoElement.play();
        playBtn.textContent = '⏸';
        soundFx.playVideoPlay();
        this.startRotoscopingLoop();
      } else {
        this.videoElement.pause();
        playBtn.textContent = '▶';
        soundFx.playVideoPause();
      }
    });

    scrubber?.addEventListener('input', (e) => {
      this.videoElement.currentTime = Number(e.target.value);
      this.lastRenderedSentenceKey = null;
      this.updateTimeDisplay();
      this.updateCaptionOverlay();
      this.renderCutoutIfActiveBehind();
      soundFx.playSeek();
    });

    wrap.querySelector('#user-btn-rw')?.addEventListener('click', () => {
      soundFx.playSkip();
      this.videoElement.currentTime = Math.max(0, this.videoElement.currentTime - 5);
      this.lastRenderedSentenceKey = null;
      this.updateTimeDisplay();
      this.updateCaptionOverlay();
      this.renderCutoutIfActiveBehind();
    });

    wrap.querySelector('#user-btn-ff')?.addEventListener('click', () => {
      soundFx.playSkip();
      this.videoElement.currentTime = Math.min(this.videoDuration, this.videoElement.currentTime + 5);
      this.lastRenderedSentenceKey = null;
      this.updateTimeDisplay();
      this.updateCaptionOverlay();
      this.renderCutoutIfActiveBehind();
    });

    wrap.querySelector('#user-btn-mute')?.addEventListener('click', (e) => {
      this.videoElement.muted = !this.videoElement.muted;
      e.target.textContent = this.videoElement.muted ? '🔇' : '🔊';
      soundFx.playMuteToggle(this.videoElement.muted);
    });

    const enhanceToggle = wrap.querySelector('#user-player-enhance');
    if (enhanceToggle) {
      enhanceToggle.checked = !!this.enhanceVideoQuality;
      enhanceToggle.addEventListener('change', (e) => {
        this.enhanceVideoQuality = e.target.checked;
        this.videoElement.classList.toggle('video-enhanced', this.enhanceVideoQuality);
        this.renderCutoutIfActiveBehind();
        soundFx.playEnhanceToggle(this.enhanceVideoQuality);
        this.showToast(this.enhanceVideoQuality ? '✨ Video Enhancement Enabled (+30% Vibrance & Contrast)' : 'Video Enhancement Disabled', 'info');
      });
    }

    wrap.querySelector('#btn-reselect-video')?.addEventListener('click', () => {
      soundFx.playTabSwitch();
      this.videoBlob = null;
      this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));
    });

    wrap.querySelector('#btn-workspace-style')?.addEventListener('click', () => {
      this.switchTab('templates');
    });

    // Process Behind Again Button
    wrap.querySelector('#btn-process-behind-again')?.addEventListener('click', async () => {
      await this.handleProcessBehindAgain();
    });

    // SRT / VTT Exports
    wrap.querySelector('#user-btn-srt')?.addEventListener('click', () => {
      soundFx.playSaveSuccess();
      captionEngine.downloadSrt();
      this.showToast('Downloaded .SRT file', 'success');
    });

    wrap.querySelector('#user-btn-vtt')?.addEventListener('click', () => {
      soundFx.playSaveSuccess();
      captionEngine.downloadVtt();
      this.showToast('Downloaded .VTT file', 'success');
    });

    // 60 FPS GPU Lossless Burn Captions
    wrap.querySelector('#user-btn-burn')?.addEventListener('click', async () => {
      soundFx.playKeyBeep(640);
      await this.burnVideoCaptions();
    });

    // OPEN LINE SEGMENTS EDIT MODAL
    wrap.querySelector('#btn-open-segments-modal')?.addEventListener('click', () => {
      this.openLineSegmentsModal();
    });

    // Real-Time Draggable & Resizable Caption Setup
    this.setupCaptionDragAndResize(wrap);
  }

  updateTimeDisplay() {
    const el = this.container.querySelector('#user-time-display');
    if (!el || !this.videoElement) return;
    const cur = this.formatTime(this.videoElement.currentTime || 0);
    const dur = this.formatTime(this.videoDuration || 0);
    el.textContent = `${cur} / ${dur}`;
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }


  getFontFamily(fontId) {
    if (!fontId) return "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    const found = FONTS.find(f => f.id.toLowerCase() === fontId.toLowerCase() || f.name.toLowerCase().includes(fontId.toLowerCase()));
    return found ? found.family : `'${fontId}', -apple-system, sans-serif`;
  }

  updateCaptionOverlay(sentenceOverride = null) {
    const overlay = this.container.querySelector('#user-caption-live-overlay');
    if (!overlay || !this.videoElement) return;

    const time = sentenceOverride
      ? (Number(sentenceOverride.start ?? sentenceOverride.startTime ?? 0) + 0.05)
      : (this.videoElement.currentTime || 0);
    const sentences = captionEngine.sentences || [];

    // 1. Find active sentence strictly matching timeline (no backwards jumping to old segments)
    let currentSentence = sentenceOverride || sentences.find((s, i) => {
      const sStart = Number(s.start ?? s.startTime ?? 0);
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
      const isLast = (i === sentences.length - 1);
      return time >= sStart && (isLast ? time <= sEnd : time < sEnd);
    });

    if (!currentSentence && sentences.length > 0) {
      for (let i = sentences.length - 1; i >= 0; i--) {
        const s = sentences[i];
        const sStart = Number(s.start ?? s.startTime ?? 0);
        const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
        if (time >= sStart && time <= (sEnd + 0.35)) {
          const nextS = sentences[i + 1];
          const nextStart = nextS ? Number(nextS.start ?? nextS.startTime ?? Infinity) : Infinity;
          if (time < nextStart) {
            currentSentence = s;
            break;
          }
        }
      }
    }

    if (!currentSentence) {
      overlay.innerHTML = '';
      this.lastRenderedSentenceKey = null;
      return;
    }

    // 3. Resolve active template and user custom/studio configurations
    const tpl = CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId) || CAPTION_TEMPLATES[0];
    const customConfig = this.userCustomTemplates[tpl.id] || {};
    const studioConfig = this.activeConfig || {};
    const cfg = { ...tpl.config, ...customConfig, ...studioConfig };

    // 4. Ensure words array exists with valid timings
    let words = currentSentence.words;
    if (!words || words.length === 0) {
      const sStart = currentSentence.start ?? currentSentence.startTime ?? 0;
      const sEnd = currentSentence.end ?? currentSentence.endTime ?? (sStart + 2.5);
      words = captionEngine.createWordLevelTimestamps(currentSentence.text || '', sStart, sEnd);
    }

    // 5. Determine the current speaking single word index
    let speakingWordIdx = words.findIndex(w => {
      const ws = Number(w.start ?? w.startTime ?? 0);
      const we = Number(w.end ?? w.endTime ?? (ws + 0.35));
      return time >= ws && time < we;
    });

    if (speakingWordIdx === -1) {
      for (let i = words.length - 1; i >= 0; i--) {
        const ws = Number(words[i].start ?? words[i].startTime ?? 0);
        if (time >= ws) {
          speakingWordIdx = i;
          break;
        }
      }
      if (speakingWordIdx === -1) speakingWordIdx = 0;
    }

    // 6. Strict 2-Row Guarantee: Never make a 3rd row, while preserving 4-word phrases like "3 to 6 PM"
    const totalChars = words.reduce((acc, w) => acc + ((w.word || '').length), 0);
    let displayWords = words;
    let chunkOffset = 0;
    if (words.length > 4 || (words.length === 4 && totalChars > 22)) {
      const mid = Math.ceil(words.length / 2);
      if (speakingWordIdx < mid) {
        displayWords = words.slice(0, mid);
        chunkOffset = 0;
      } else {
        displayWords = words.slice(mid);
        chunkOffset = mid;
      }
    }

    // 7. Base font size: segment-specific size or default (25px portrait / 28px landscape)
    const isPortrait = this.currentMode === 'portrait';
    const defaultBaseFontSize = isPortrait ? 25 : ((cfg.fontSize && Number(cfg.fontSize) <= 30) ? Number(cfg.fontSize) : 28);
    const baseFontSize = (currentSentence.fontSize !== undefined && currentSentence.fontSize !== null && currentSentence.fontSize > 0)
      ? Number(currentSentence.fontSize)
      : defaultBaseFontSize;

    // 8. Typography settings from config with segment override
    const normalFontFamily = this.getFontFamily(cfg.normalFontFamily || 'Inter');
    const prominentFontFamily = this.getFontFamily(cfg.prominentFontFamily || 'Syne');
    const segmentFontFamily = currentSentence.fontFamily ? this.getFontFamily(currentSentence.fontFamily) : null;

    const defaultTextColor = currentSentence.textColor || cfg.textColor || '#FFFFFF';
    const prominentColor = currentSentence.prominentColor || cfg.prominentColor || '#FFE600';
    const hasLastWordColor = !currentSentence.prominentColor && (cfg.enableLastWordColor !== false && !!cfg.lastWordColor);
    const lastWordColor = hasLastWordColor ? cfg.lastWordColor : prominentColor;

    // Stroke & Glow settings (Matching Image 3 radiant neon style)
    const strokeEnabled = currentSentence.strokeEnabled !== false;
    const customStrokeColor = currentSentence.strokeColor;
    const hasGlow = currentSentence.glowColor && currentSentence.glowColor !== 'transparent' && currentSentence.glowColor !== '';
    const glowColor = hasGlow ? currentSentence.glowColor : null;
    const glowStyles = glowColor
      ? `text-shadow: 0 0 6px ${glowColor}, 0 0 16px ${glowColor}, 0 0 28px ${glowColor} !important; filter: drop-shadow(0 0 8px ${glowColor}) !important;`
      : 'text-shadow: none !important; filter: none !important;';

    // 9. Build styled words: Keep actual color of the word (NEVER apply separate color on speaking word)
    const wordsHtml = displayWords.map((w, localIdx) => {
      const globalIdx = chunkOffset + localIdx;
      const cleanWord = (w.word || '').replace(/[.,!?:;"'()]/g, '');
      const isHeroKeyword = autoTypographyEngine.brandRegex.test(cleanWord) || 
                            autoTypographyEngine.monthsDatesRegex.test(cleanWord) || 
                            autoTypographyEngine.placesRegex.test(cleanWord) || 
                            autoTypographyEngine.impactWordsRegex.test(cleanWord);
      
      const isSpeaking = (globalIdx === speakingWordIdx);
      const isLastWord = (globalIdx === words.length - 1);
      const isProminent = w.isProminent || isHeroKeyword || isLastWord || (words.length >= 3 && globalIdx === 1);

      let font = segmentFontFamily || (isProminent ? prominentFontFamily : normalFontFamily);
      let color = isProminent ? prominentColor : defaultTextColor;

      if (isLastWord && hasLastWordColor) {
        font = segmentFontFamily || prominentFontFamily;
        color = lastWordColor;
      }

      // Speaking word keeps its actual color; gets prominent font and smooth GPU scale bounce
      if (isSpeaking) {
        font = segmentFontFamily || prominentFontFamily;
      }

      const fontWeight = isSpeaking ? 900 : (isProminent ? 800 : 700);

      const strokeWidth = strokeEnabled
        ? (isProminent
            ? (cfg.prominentOutlineWidth !== undefined ? cfg.prominentOutlineWidth : 2.5)
            : (cfg.normalOutlineWidth !== undefined ? cfg.normalOutlineWidth : 1.5))
        : 0;
      const strokeColor = strokeEnabled
        ? (customStrokeColor || (isProminent ? (cfg.prominentOutlineColor || '#000000') : (cfg.normalOutlineColor || '#000000')))
        : 'transparent';

      const wordScale = isSpeaking ? 'scale(1.15)' : 'scale(1)';
      const wordZIndex = isSpeaking ? 5 : 1;
      const transitionTiming = isSpeaking
        ? 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease'
        : 'transform 0.18s ease-out';

      return `
        <span class="caption-word-token ${isSpeaking ? 'speaking current' : ''}" style="
          display: inline-block !important;
          vertical-align: baseline !important;
          margin: 1px 3px !important;
          padding: 0 1px !important;
          box-sizing: border-box !important;
          font-family: ${font} !important;
          color: ${color} !important;
          font-size: ${baseFontSize}px !important;
          font-weight: ${fontWeight};
          opacity: 1 !important;
          visibility: visible !important;
          line-height: 1.05;
          letter-spacing: 0.2px;
          ${glowStyles}
          -webkit-text-stroke: ${strokeWidth}px ${strokeColor};
          paint-order: stroke fill;
          -webkit-paint-order: stroke fill;
          transform: ${wordScale} !important;
          transform-origin: center bottom !important;
          z-index: ${wordZIndex} !important;
          white-space: nowrap !important;
          will-change: transform;
          transition: ${transitionTiming};
        ">
          ${w.word}
        </span>
      `;
    }).join('');

    // 10. Detect new line segment transition to trigger configured entrance animation
    const sStart = Number(currentSentence.start ?? currentSentence.startTime ?? 0);
    const sEnd = Number(currentSentence.end ?? currentSentence.endTime ?? (sStart + 2.5));
    const subChunkKey = displayWords.map(w => w.word).join('_');
    const animId = currentSentence.animation || cfg.animation || 'anim-auto';

    let resolvedAnimId = animId;
    if (animId === 'anim-auto') {
      // Deterministically cycle animations 1 to 6 on every segment
      let segCount = 0;
      const targetIdx = sentences.findIndex(s => s === currentSentence || (s.id !== undefined && s.id === currentSentence.id));
      for (let i = 0; i < targetIdx; i++) {
        const sWords = sentences[i].words || [];
        const sChars = sWords.reduce((acc, w) => acc + ((w.word || '').length), 0);
        if (sWords.length > 4 || (sWords.length === 4 && sChars > 22)) {
          segCount += 2;
        } else {
          segCount += 1;
        }
      }
      if (chunkOffset > 0) segCount += 1;
      resolvedAnimId = AUTO_ANIMATION_SEQUENCE[segCount % AUTO_ANIMATION_SEQUENCE.length];
    }

    const animMeta = CAPTION_ANIMATIONS.find(a => a.id === resolvedAnimId || a.cssClass === resolvedAnimId);
    const animClass = animMeta ? animMeta.cssClass : (resolvedAnimId.startsWith('anim-') ? resolvedAnimId : 'anim-pop');

    const sKey = `seg_${currentSentence.id ?? `${sStart.toFixed(2)}_${sEnd.toFixed(2)}`}_${subChunkKey}_${animClass}`;

    const isNewSegment = this.lastRenderedSentenceKey !== sKey;
    this.lastRenderedSentenceKey = sKey;

    // 11. Segment-Specific Custom Position & Sizing (Defaults to Middle-Left: 6%, 50%)
    const defaultPosMeta = CAPTION_POSITIONS.find(p => p.id === 'middle-left') || CAPTION_POSITIONS[3];
    const hasCustomPos = currentSentence.posX !== undefined && currentSentence.posY !== undefined;
    const posX = hasCustomPos ? `${currentSentence.posX}%` : (defaultPosMeta.x || '6%');
    const posY = hasCustomPos ? `${currentSentence.posY}%` : (defaultPosMeta.y || '50%');
    const posTransform = hasCustomPos ? 'translate(0, 0)' : (defaultPosMeta.transform || 'translate(0, -50%)');
    const textAlign = defaultPosMeta.align || 'left';
    const justifyAlign = (textAlign === 'left') ? 'flex-start' : (textAlign === 'right' ? 'flex-end' : 'center');

    // Segment-Specific Custom Box Width (Defaults to auto up to 94%)
    const customWidth = currentSentence.boxWidth ? `${currentSentence.boxWidth}%` : 'auto';
    const customMaxWidth = currentSentence.boxWidth ? `${currentSentence.boxWidth}%` : '94%';

    let anchor = overlay.querySelector('.caption-segment-anchor');
    let animWrapper = overlay.querySelector('.caption-anim-segment-wrapper');

    if (!anchor || !animWrapper || isNewSegment) {
      // Re-create segment with draggable handles and tight natural word spacing
      overlay.innerHTML = `
        <div class="caption-segment-anchor" data-sentence-id="${currentSentence.id || ''}" style="position: absolute; top: ${posY}; left: ${posX}; transform: ${posTransform}; width: ${customWidth}; max-width: ${customMaxWidth}; text-align: ${textAlign}; z-index: 20;">
          
          <!-- Floating Quick Action Toolbar -->
          <div class="caption-drag-toolbar" onclick="event.stopPropagation()">
            <span class="caption-toolbar-pill caption-drag-handle" title="Click and drag anywhere on video to position">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>
              <span>Move</span>
            </span>
            <button type="button" class="caption-toolbar-btn btn-follow-all" id="btn-follow-all-segments" title="Apply this position and width to ALL segments">
              <span>⚡ Apply to All</span>
            </button>
            <button type="button" class="caption-toolbar-btn btn-reset-pos" id="btn-reset-segment-pos" title="Reset this segment to default middle-left">
              <span>↺ Reset</span>
            </button>
          </div>

          <!-- Animated Words Container with dynamic word wrapping -->
          <div class="caption-anim-segment-wrapper ${animClass}" style="display: inline-flex; flex-wrap: wrap; justify-content: ${justifyAlign}; align-items: baseline; gap: 2px 5px; width: 100%; max-width: 100%; text-transform: uppercase; line-height: 1.05; transform-origin: center center; will-change: transform, opacity;">
            ${wordsHtml}
          </div>

          <!-- Resize Handles for Width & Line Management -->
          <div class="caption-resize-handle resize-right" title="Drag to adjust width and wrap lines">
            <div class="resize-grip-line"></div>
          </div>
          <div class="caption-resize-handle resize-corner" title="Drag corner to adjust box width">
            <div class="resize-grip-dot"></div>
          </div>
        </div>
      `;
      const freshWrapper = overlay.querySelector('.caption-anim-segment-wrapper');
      if (freshWrapper) {
        freshWrapper.classList.remove(animClass);
        void freshWrapper.offsetWidth;
        freshWrapper.classList.add(animClass);
      }
    } else {
      // Continuously enforce latest position & alignment coordinates even when paused
      anchor.style.top = posY;
      anchor.style.left = posX;
      anchor.style.transform = posTransform;
      anchor.style.width = customWidth;
      anchor.style.maxWidth = customMaxWidth;
      anchor.style.textAlign = textAlign;
      animWrapper.style.justifyContent = justifyAlign;
      animWrapper.innerHTML = wordsHtml;
    }
  }

  renderMiniSegmentsList() {
    const list = this.container.querySelector('#user-segments-mini-list');
    if (!list) return;
    list.innerHTML = '';

    const sentences = captionEngine.sentences || [];
    const cfg = this.activeConfig || {};
    const defaultNormalFont = cfg.normalFontFamily || 'Inter';
    const defaultFontSize = (this.currentMode === 'portrait' ? 25 : ((cfg.fontSize && Number(cfg.fontSize) <= 30) ? Number(cfg.fontSize) : 28));

    sentences.forEach((s, idx) => {
      const sStart = Number(s.start ?? s.startTime ?? (idx * 2.5));
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
      const curFont = s.fontFamily || defaultNormalFont;
      const curSize = s.fontSize !== undefined && s.fontSize !== null ? Number(s.fontSize) : defaultFontSize;
      const curColor = s.textColor || cfg.textColor || '#FFFFFF';
      const curProminentColor = s.prominentColor || cfg.prominentColor || '#FFE600';
      const strokeEnabled = s.strokeEnabled !== false;
      const curStrokeColor = s.strokeColor || cfg.prominentOutlineColor || '#000000';
      const hasGlow = s.glowColor && s.glowColor !== 'transparent' && s.glowColor !== '';
      const curGlowColor = hasGlow ? s.glowColor : '#ff2079';
      const curAnim = s.animation || cfg.animation || 'anim-auto';
      const curAnimMeta = CAPTION_ANIMATIONS.find(a => a.id === curAnim) || CAPTION_ANIMATIONS[0];

      const curFontMeta = FONTS.find(f => f.id === curFont || f.name === curFont) || FONTS[0];

      const item = document.createElement('div');
      item.id = `seg-mini-${idx}`;
      item.className = `seg-card-item ${s.behind ? 'has-behind' : ''}`;
      item.dataset.idx = idx;

      item.innerHTML = `
        <!-- 1. Header: Index, Time, Pos, Modern Behind Switch -->
        <div class="seg-card-header">
          <div class="seg-card-identity">
            <span class="seg-num-badge">#${idx + 1}</span>
            <span class="seg-time-tag">${sStart.toFixed(1)}s - ${sEnd.toFixed(1)}s</span>
          </div>
          <div class="seg-card-actions">
            <span class="seg-coords-pill" title="Position on video">${s.posX !== undefined && s.posY !== undefined ? `${s.posX}%, ${s.posY}%` : 'Mid-L'}</span>
            <label class="seg-behind-toggle" title="Render caption behind subject in video">
              <input type="checkbox" class="chk-segment-behind" data-idx="${idx}" ${s.behind ? 'checked' : ''} />
              <span class="behind-switch-track"><span class="behind-switch-thumb"></span></span>
              <span class="behind-switch-text">Behind</span>
            </label>
          </div>
        </div>

        <!-- 2. Text Context Banner -->
        <div class="seg-text-banner" title="Click to seek to this segment">
          <span class="seg-play-icon">▶</span>
          <span class="seg-text-string">${s.text || 'Caption Segment'}</span>
        </div>

        <!-- 3. Typography Bar: Custom Font Dropdown (Opens Strictly Below) + Size Stepper -->
        <div class="seg-typo-bar" onclick="event.stopPropagation()">
          <div class="seg-font-picker-wrap">
            <button type="button" class="seg-font-trigger" data-idx="${idx}" title="Select font for segment #${idx + 1}">
              <span class="seg-font-trigger-text" style="font-family: ${curFontMeta.family};">
                ${curFontMeta.name}
              </span>
              <svg class="seg-dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="seg-font-dropdown-menu" id="seg-font-menu-${idx}">
              ${FONTS.map(f => `
                <div class="seg-font-option ${curFontMeta.id === f.id ? 'is-selected' : ''}" data-idx="${idx}" data-font="${f.id}" style="font-family: ${f.family};">
                  <span class="opt-name">${f.name}</span>
                  ${f.id === 'Italiana' ? '<span class="opt-tag">Image 2</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="seg-stepper-box" title="Font size in pixels">
            <button type="button" class="btn-step btn-minus" data-idx="${idx}" title="Decrease font size">−</button>
            <div class="step-val-wrap">
              <input type="number" class="step-num-input" data-idx="${idx}" value="${curSize}" min="12" max="80">
              <span class="step-unit">px</span>
            </div>
            <button type="button" class="btn-step btn-plus" data-idx="${idx}" title="Increase font size">+</button>
          </div>
        </div>

        <!-- 4. Effects Bar: Text Color | Stroke | Radiant Neon Glow -->
        <div class="seg-effects-bar" onclick="event.stopPropagation()">
          
          <!-- Cell 1: Dual Colors (Base Text & Prominent Highlight Word) -->
          <div class="seg-effect-cell seg-colors-dual-cell" title="Base text & prominent highlight word colors">
            <span class="effect-label">Color</span>
            <div class="seg-color-swatches-group">
              <label class="color-swatch-wrap" title="Base text color">
                <input type="color" class="hidden-color-input seg-text-color-picker" data-idx="${idx}" value="${curColor}">
                <span class="color-swatch-circle" id="text-swatch-${idx}" style="background-color: ${curColor};"></span>
              </label>
              <label class="color-swatch-wrap" title="Prominent word highlight color">
                <input type="color" class="hidden-color-input seg-prominent-color-picker" data-idx="${idx}" value="${curProminentColor}">
                <span class="color-swatch-circle prominent-swatch" id="prominent-swatch-${idx}" style="background-color: ${curProminentColor};"></span>
              </label>
            </div>
          </div>

          <!-- Cell 2: Outline Stroke -->
          <div class="seg-effect-cell" title="Outline Stroke">
            <label class="effect-chk-label">
              <input type="checkbox" class="chk-seg-stroke" data-idx="${idx}" ${strokeEnabled ? 'checked' : ''}>
              <span class="effect-label">Stroke</span>
            </label>
            <label class="color-swatch-wrap ${!strokeEnabled ? 'is-disabled' : ''}">
              <input type="color" class="hidden-color-input seg-stroke-color-picker" data-idx="${idx}" value="${curStrokeColor}" ${!strokeEnabled ? 'disabled' : ''}>
              <span class="color-swatch-circle" id="stroke-swatch-${idx}" style="background-color: ${curStrokeColor};"></span>
            </label>
          </div>

          <!-- Cell 3: Radiant Neon Glow (Image 3 Parity) -->
          <div class="seg-effect-cell ${hasGlow ? 'glow-active' : ''}" title="Neon Outer Glow (Image 3)">
            <label class="effect-chk-label">
              <input type="checkbox" class="chk-seg-glow" data-idx="${idx}" ${hasGlow ? 'checked' : ''}>
              <span class="effect-label">Glow</span>
            </label>
            <label class="color-swatch-wrap ${!hasGlow ? 'is-disabled' : ''}">
              <input type="color" class="hidden-color-input seg-glow-color-picker" data-idx="${idx}" value="${curGlowColor}" ${!hasGlow ? 'disabled' : ''}>
              <span class="color-swatch-circle glow-preview" id="glow-swatch-${idx}" style="background-color: ${hasGlow ? curGlowColor : '#cbd5e1'}; ${hasGlow ? `box-shadow: 0 0 8px ${curGlowColor};` : ''}"></span>
            </label>
            ${hasGlow ? `<button type="button" class="btn-clear-glow-x" data-idx="${idx}" title="Turn off glow">✕</button>` : ''}
          </div>

        </div>

        <!-- 5. Animation Bar: Custom Segment Animation Dropdown -->
        <div class="seg-anim-bar" onclick="event.stopPropagation()">
          <div class="seg-anim-picker-wrap">
            <button type="button" class="seg-anim-trigger" data-idx="${idx}" title="Select animation for segment #${idx + 1}">
              <div class="seg-anim-lead">
                <span class="seg-anim-icon-tag">⚡ Anim</span>
                <span class="seg-anim-trigger-text">${curAnimMeta.name}</span>
              </div>
              <svg class="seg-dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="seg-anim-dropdown-menu" id="seg-anim-menu-${idx}">
              ${CAPTION_ANIMATIONS.map(a => `
                <div class="seg-anim-option ${curAnim === a.id ? 'is-selected' : ''}" data-idx="${idx}" data-anim="${a.id}">
                  <span class="anim-opt-name">${a.name}</span>
                  <span class="anim-opt-desc">${a.description}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      // Segment sync helper: seeks preview to this exact segment & updates overlay in real time
      const syncActiveSegment = () => {
        if (this.videoElement) {
          const targetTime = Math.max(0, sStart + 0.05);
          if (Math.abs(this.videoElement.currentTime - targetTime) > 0.05) {
            this.videoElement.currentTime = targetTime;
          }
        }
        this.lastRenderedSentenceKey = null;
        this.updateCaptionOverlay(s);
        this.renderCutoutIfActiveBehind(s);
        this.highlightActiveSegment(idx);
      };

      // Card-level click: focus & preview this segment, closing other segment dropdowns
      item.addEventListener('click', (e) => {
        list.querySelectorAll('.seg-font-dropdown-menu.is-open').forEach(m => {
          if (!item.contains(m)) m.classList.remove('is-open');
        });
        list.querySelectorAll('.seg-anim-dropdown-menu.is-open').forEach(m => {
          if (!item.contains(m)) m.classList.remove('is-open');
        });
        list.querySelectorAll('.seg-font-trigger.is-active').forEach(t => {
          if (!item.contains(t)) t.classList.remove('is-active');
        });
        list.querySelectorAll('.seg-anim-trigger.is-active').forEach(t => {
          if (!item.contains(t)) t.classList.remove('is-active');
        });
        syncActiveSegment();
      });

      // 1. Behind switch toggle
      const chkBehind = item.querySelector('.chk-segment-behind');
      chkBehind?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        s.behind = isChecked;
        soundFx.playKeyBeep(isChecked ? 680 : 440);
        item.classList.toggle('has-behind', isChecked);
        this.updateBehindCountBadge();
        syncActiveSegment();
      });

      // 2. Custom Font Dropdown (OPENS STRICTLY BELOW THAT!)
      const fontTrigger = item.querySelector('.seg-font-trigger');
      const fontMenu = item.querySelector('.seg-font-dropdown-menu');

      fontTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = fontMenu?.classList.contains('is-open');
        list.querySelectorAll('.seg-font-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
        list.querySelectorAll('.seg-font-trigger.is-active').forEach(t => t.classList.remove('is-active'));
        list.querySelectorAll('.seg-anim-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
        list.querySelectorAll('.seg-anim-trigger.is-active').forEach(t => t.classList.remove('is-active'));
        if (!isOpen && fontMenu) {
          fontMenu.classList.add('is-open');
          fontTrigger.classList.add('is-active');
        }
        syncActiveSegment();
      });

      fontMenu?.querySelectorAll('.seg-font-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const fontId = opt.getAttribute('data-font');
          s.fontFamily = fontId;
          const chosenFont = FONTS.find(f => f.id === fontId);
          const labelSpan = fontTrigger?.querySelector('.seg-font-trigger-text');
          if (labelSpan && chosenFont) {
            labelSpan.textContent = chosenFont.name;
            labelSpan.style.fontFamily = chosenFont.family;
          }
          fontMenu.querySelectorAll('.seg-font-option').forEach(o => {
            o.classList.toggle('is-selected', o.getAttribute('data-font') === fontId);
          });
          fontMenu.classList.remove('is-open');
          fontTrigger?.classList.remove('is-active');
          soundFx.playKeyBeep(600);
          syncActiveSegment();
        });
      });

      // 3. Sizing Stepper Controls
      const sizeInput = item.querySelector('.step-num-input');
      const btnMinus = item.querySelector('.btn-minus');
      const btnPlus = item.querySelector('.btn-plus');

      btnMinus?.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextVal = Math.max(12, (Number(s.fontSize || curSize) - 2));
        s.fontSize = nextVal;
        if (sizeInput) sizeInput.value = nextVal;
        soundFx.playKeyBeep(480);
        syncActiveSegment();
      });

      btnPlus?.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextVal = Math.min(80, (Number(s.fontSize || curSize) + 2));
        s.fontSize = nextVal;
        if (sizeInput) sizeInput.value = nextVal;
        soundFx.playKeyBeep(640);
        syncActiveSegment();
      });

      sizeInput?.addEventListener('change', (e) => {
        const val = Math.max(12, Math.min(80, Number(e.target.value) || 28));
        s.fontSize = val;
        e.target.value = val;
        syncActiveSegment();
      });

      // 4. Text Color Picker
      const textColorPicker = item.querySelector('.seg-text-color-picker');
      const textSwatch = item.querySelector(`#text-swatch-${idx}`);
      textColorPicker?.addEventListener('input', (e) => {
        s.textColor = e.target.value;
        if (textSwatch) textSwatch.style.backgroundColor = e.target.value;
        syncActiveSegment();
      });

      // 4b. Prominent Word Color Picker (Highlighted hero keyword)
      const prominentColorPicker = item.querySelector('.seg-prominent-color-picker');
      const prominentSwatch = item.querySelector(`#prominent-swatch-${idx}`);
      prominentColorPicker?.addEventListener('input', (e) => {
        s.prominentColor = e.target.value;
        if (prominentSwatch) prominentSwatch.style.backgroundColor = e.target.value;
        syncActiveSegment();
      });

      // 5. Stroke Controls
      const chkStroke = item.querySelector('.chk-seg-stroke');
      const strokeColorPicker = item.querySelector('.seg-stroke-color-picker');
      const strokeSwatch = item.querySelector(`#stroke-swatch-${idx}`);
      const strokeWrap = strokeColorPicker?.closest('.color-swatch-wrap');

      chkStroke?.addEventListener('change', (e) => {
        s.strokeEnabled = e.target.checked;
        if (strokeColorPicker) strokeColorPicker.disabled = !s.strokeEnabled;
        if (strokeWrap) strokeWrap.classList.toggle('is-disabled', !s.strokeEnabled);
        soundFx.playKeyBeep(s.strokeEnabled ? 620 : 440);
        syncActiveSegment();
      });

      strokeColorPicker?.addEventListener('input', (e) => {
        s.strokeColor = e.target.value;
        if (strokeSwatch) strokeSwatch.style.backgroundColor = e.target.value;
        syncActiveSegment();
      });

      // 6. Glow Controls (Image 3 Style)
      const chkGlow = item.querySelector('.chk-seg-glow');
      const glowColorPicker = item.querySelector('.seg-glow-color-picker');
      const glowSwatch = item.querySelector(`#glow-swatch-${idx}`);
      const glowWrap = glowColorPicker?.closest('.color-swatch-wrap');
      const clearGlowBtn = item.querySelector('.btn-clear-glow-x');

      chkGlow?.addEventListener('change', (e) => {
        if (e.target.checked) {
          s.glowColor = glowColorPicker ? glowColorPicker.value : '#ff2079';
          if (glowColorPicker) glowColorPicker.disabled = false;
          if (glowWrap) glowWrap.classList.remove('is-disabled');
          if (glowSwatch) {
            glowSwatch.style.backgroundColor = s.glowColor;
            glowSwatch.style.boxShadow = `0 0 8px ${s.glowColor}`;
          }
        } else {
          s.glowColor = 'transparent';
          if (glowColorPicker) glowColorPicker.disabled = true;
          if (glowWrap) glowWrap.classList.add('is-disabled');
          if (glowSwatch) {
            glowSwatch.style.backgroundColor = '#cbd5e1';
            glowSwatch.style.boxShadow = 'none';
          }
        }
        soundFx.playKeyBeep(s.glowColor !== 'transparent' ? 740 : 400);
        syncActiveSegment();
        this.renderMiniSegmentsList();
      });

      glowColorPicker?.addEventListener('input', (e) => {
        s.glowColor = e.target.value;
        if (glowSwatch) {
          glowSwatch.style.backgroundColor = e.target.value;
          glowSwatch.style.boxShadow = `0 0 8px ${e.target.value}`;
        }
        syncActiveSegment();
      });

      clearGlowBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        s.glowColor = 'transparent';
        soundFx.playKeyBeep(420);
        syncActiveSegment();
        this.renderMiniSegmentsList();
      });

      // 7. Animation Dropdown Controls
      const animTrigger = item.querySelector('.seg-anim-trigger');
      const animMenu = item.querySelector('.seg-anim-dropdown-menu');

      animTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = animMenu?.classList.contains('is-open');
        list.querySelectorAll('.seg-font-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
        list.querySelectorAll('.seg-font-trigger.is-active').forEach(t => t.classList.remove('is-active'));
        list.querySelectorAll('.seg-anim-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
        list.querySelectorAll('.seg-anim-trigger.is-active').forEach(t => t.classList.remove('is-active'));
        if (!isOpen && animMenu) {
          animMenu.classList.add('is-open');
          animTrigger.classList.add('is-active');
        }
        syncActiveSegment();
      });

      animMenu?.querySelectorAll('.seg-anim-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const animId = opt.getAttribute('data-anim');
          s.animation = animId;
          const chosenAnim = CAPTION_ANIMATIONS.find(a => a.id === animId) || CAPTION_ANIMATIONS[0];
          const labelSpan = animTrigger?.querySelector('.seg-anim-trigger-text');
          if (labelSpan && chosenAnim) {
            labelSpan.textContent = chosenAnim.name;
          }
          animMenu.querySelectorAll('.seg-anim-option').forEach(o => {
            o.classList.toggle('is-selected', o.getAttribute('data-anim') === animId);
          });
          animMenu.classList.remove('is-open');
          animTrigger?.classList.remove('is-active');
          soundFx.playKeyBeep(640);
          syncActiveSegment();
        });
      });

      // Seek on text banner click
      item.querySelector('.seg-text-banner')?.addEventListener('click', () => {
        soundFx.playSeek();
        syncActiveSegment();
      });

      list.appendChild(item);
    });

    // Close any font or animation dropdowns when clicking outside
    if (!this._hasSegDropdownOutsideHandler) {
      this._hasSegDropdownOutsideHandler = true;
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.seg-font-picker-wrap')) {
          document.querySelectorAll('.seg-font-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
          document.querySelectorAll('.seg-font-trigger.is-active').forEach(t => t.classList.remove('is-active'));
        }
        if (!e.target.closest('.seg-anim-picker-wrap')) {
          document.querySelectorAll('.seg-anim-dropdown-menu.is-open').forEach(m => m.classList.remove('is-open'));
          document.querySelectorAll('.seg-anim-trigger.is-active').forEach(t => t.classList.remove('is-active'));
        }
      });
    }

    this.updateBehindCountBadge();
  }

  highlightActiveSegment(activeIdxOverride = null) {
    if (!this.videoElement) return;
    const time = this.videoElement.currentTime || 0;
    const sentences = captionEngine.sentences || [];
    sentences.forEach((s, idx) => {
      const el = this.container.querySelector(`#seg-mini-${idx}`);
      if (el) {
        if (activeIdxOverride !== null && activeIdxOverride !== undefined) {
          el.classList.toggle('is-active', idx === activeIdxOverride);
        } else {
          const sStart = Number(s.start ?? s.startTime ?? 0);
          const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
          const isLast = (idx === sentences.length - 1);
          const isActive = time >= sStart && (isLast ? time <= sEnd : time < sEnd);
          el.classList.toggle('is-active', isActive);
        }
      }
    });
  }

  setupCaptionDragAndResize(wrap) {
    const videoWrapper = wrap.querySelector('#user-video-wrapper');
    const overlay = wrap.querySelector('#user-caption-live-overlay');
    if (!videoWrapper || !overlay) return;

    let isDragging = false;
    let isResizing = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let initialAnchorLeftPx = 0;
    let initialAnchorTopPx = 0;
    let initialWidthPx = 0;
    let activeSentence = null;
    let activeAnchor = null;

    // Pointer down for Dragging and Resizing
    overlay.addEventListener('pointerdown', (e) => {
      // Don't intercept button clicks inside toolbar
      if (e.target.closest('button')) return;

      const anchor = e.target.closest('.caption-segment-anchor');
      if (!anchor) return;

      const time = this.videoElement ? this.videoElement.currentTime : 0;
      const sentences = captionEngine.sentences || [];
      activeSentence = sentences.find(s => {
        const sStart = Number(s.start ?? s.startTime ?? 0);
        const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
        return time >= sStart && time <= sEnd;
      });

      if (!activeSentence && sentences.length > 0) {
        activeSentence = sentences[0];
      }
      if (!activeSentence) return;

      activeAnchor = anchor;
      const videoRect = videoWrapper.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();

      const isCornerResize = !!e.target.closest('.resize-corner');
      const isRightResize = !!e.target.closest('.resize-right');

      if (isCornerResize || isRightResize) {
        // Start resizing width
        isResizing = true;
        isDragging = false;
        startPointerX = e.clientX;
        initialWidthPx = anchorRect.width;
        anchor.classList.add('is-resizing');
        e.preventDefault();
        e.stopPropagation();
        if (anchor.setPointerCapture) {
          try { anchor.setPointerCapture(e.pointerId); } catch (_) {}
        }
      } else {
        // Start dragging
        isDragging = true;
        isResizing = false;
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        initialAnchorLeftPx = anchorRect.left - videoRect.left;
        initialAnchorTopPx = anchorRect.top - videoRect.top;
        anchor.classList.add('is-dragging');
        e.preventDefault();
        e.stopPropagation();
        if (anchor.setPointerCapture) {
          try { anchor.setPointerCapture(e.pointerId); } catch (_) {}
        }
      }

      const onPointerMove = (moveEvent) => {
        if (!activeSentence || !activeAnchor) return;
        if (!isDragging && !isResizing) return;
        
        moveEvent.preventDefault();
        moveEvent.stopPropagation();

        const currentVideoRect = videoWrapper.getBoundingClientRect();
        if (currentVideoRect.width <= 0 || currentVideoRect.height <= 0) return;

        if (isDragging) {
          const deltaX = moveEvent.clientX - startPointerX;
          const deltaY = moveEvent.clientY - startPointerY;

          let newLeftPx = initialAnchorLeftPx + deltaX;
          let newTopPx = initialAnchorTopPx + deltaY;

          // Clamping within video bounds
          newLeftPx = Math.max(0, Math.min(currentVideoRect.width - 60, newLeftPx));
          newTopPx = Math.max(0, Math.min(currentVideoRect.height - 40, newTopPx));

          const xPct = Math.round((newLeftPx / currentVideoRect.width) * 100);
          const yPct = Math.round((newTopPx / currentVideoRect.height) * 100);

          activeSentence.posX = Math.max(1, Math.min(88, xPct));
          activeSentence.posY = Math.max(2, Math.min(92, yPct));

          activeAnchor.style.left = `${activeSentence.posX}%`;
          activeAnchor.style.top = `${activeSentence.posY}%`;
          activeAnchor.style.transform = 'translate(0, 0)';
        } else if (isResizing) {
          const deltaX = moveEvent.clientX - startPointerX;
          const newWidthPx = Math.max(90, initialWidthPx + deltaX);
          let widthPct = Math.round((newWidthPx / currentVideoRect.width) * 100);
          widthPct = Math.max(15, Math.min(96, widthPct));

          activeSentence.boxWidth = widthPct;
          activeAnchor.style.width = `${widthPct}%`;
          activeAnchor.style.maxWidth = `${widthPct}%`;
        }
      };

      const onPointerUp = (upEvent) => {
        if (upEvent && upEvent.pointerId && activeAnchor && activeAnchor.releasePointerCapture) {
          try { activeAnchor.releasePointerCapture(upEvent.pointerId); } catch (_) {}
        }
        if (isDragging || isResizing) {
          soundFx.playKeyBeep(700);
          if (activeAnchor) {
            activeAnchor.classList.remove('is-dragging');
            activeAnchor.classList.remove('is-resizing');
          }
          this.renderMiniSegmentsList();
          isDragging = false;
          isResizing = false;
        }
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });

    // Helper to apply current active sizing (fontSize & boxWidth) & position (posX & posY) to ALL segments
    const applyCurrentPosToAll = (applyFontSize = false) => {
      const time = this.videoElement ? this.videoElement.currentTime : 0;
      const sentences = captionEngine.sentences || [];
      const currentSentence = sentences.find((s, i) => {
        const sStart = Number(s.start ?? s.startTime ?? 0);
        const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
        const isLast = (i === sentences.length - 1);
        return time >= sStart && (isLast ? time <= sEnd : time < sEnd);
      }) || sentences[0];

      if (!currentSentence) return;

      const targetPosX = currentSentence.posX !== undefined ? currentSentence.posX : 6;
      const targetPosY = currentSentence.posY !== undefined ? currentSentence.posY : 50;
      const targetBoxWidth = currentSentence.boxWidth || null;
      const targetFontSize = currentSentence.fontSize !== undefined ? currentSentence.fontSize : null;

      sentences.forEach(s => {
        s.posX = targetPosX;
        s.posY = targetPosY;
        s.boxWidth = targetBoxWidth;
        if (applyFontSize && targetFontSize) {
          s.fontSize = targetFontSize;
        }
      });

      soundFx.playSaveSuccess();
      if (applyFontSize && targetFontSize) {
        this.showToast(`⚡ Size (${targetFontSize}px) & Position (${targetPosX}%, ${targetPosY}%) applied to ALL segments!`, 'success');
      } else {
        this.showToast(`⚡ Position (${targetPosX}%, ${targetPosY}%) & width applied to ALL segments!`, 'success');
      }
      this.lastRenderedSentenceKey = null;
      this.updateCaptionOverlay(currentSentence);
      this.renderMiniSegmentsList();
    };

    // Overlay toolbar click actions
    overlay.addEventListener('click', (e) => {
      const followAllBtn = e.target.closest('#btn-follow-all-segments');
      const resetBtn = e.target.closest('#btn-reset-segment-pos');

      if (followAllBtn) {
        e.stopPropagation();
        e.preventDefault();
        applyCurrentPosToAll(false); // Only apply position & box width; preserve per-segment font sizes
        return;
      }

      if (resetBtn) {
        e.stopPropagation();
        e.preventDefault();
        const time = this.videoElement ? this.videoElement.currentTime : 0;
        const sentences = captionEngine.sentences || [];
        const currentSentence = sentences.find((s, i) => {
          const sStart = Number(s.start ?? s.startTime ?? 0);
          const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
          const isLast = (i === sentences.length - 1);
          return time >= sStart && (isLast ? time <= sEnd : time < sEnd);
        }) || sentences[0];

        if (currentSentence) {
          currentSentence.posX = 6;
          currentSentence.posY = 50;
          currentSentence.boxWidth = null;
          soundFx.playKeyBeep(450);
          this.showToast('Position reset to default Middle-Left.', 'info');
          this.lastRenderedSentenceKey = null;
          this.updateCaptionOverlay(currentSentence);
          this.renderMiniSegmentsList();
        }
      }
    });

    // Sidebar header apply size & pos to all button
    wrap.querySelector('#btn-header-apply-pos-all')?.addEventListener('click', () => {
      applyCurrentPosToAll(true);
    });
  }

  updateBehindCountBadge() {
    const btn = this.container?.querySelector('#btn-process-behind-again');
    const badge = this.container?.querySelector('#behind-active-badge');
    const sentences = captionEngine.sentences || [];
    const count = sentences.filter(s => s.behind).length;
    if (badge) {
      badge.textContent = `${count} Behind`;
    }
    if (btn) {
      if (count > 0 && !selfieSegmenterService.isReady()) {
        btn.classList.add('needs-process');
      } else {
        btn.classList.remove('needs-process');
      }
    }
  }

  startRotoscopingLoop() {
    if (this.rotoscopingLoopRunning) return;
    this.rotoscopingLoopRunning = true;

    const step = () => {
      if (!this.videoElement || !this.container?.isConnected) {
        this.rotoscopingLoopRunning = false;
        return;
      }

      if (!this.videoElement.paused && !this.videoElement.ended) {
        this.renderCutoutIfActiveBehind();
      }

      if ('requestVideoFrameCallback' in this.videoElement) {
        this.videoElement.requestVideoFrameCallback(step);
      } else {
        requestAnimationFrame(step);
      }
    };

    if ('requestVideoFrameCallback' in this.videoElement) {
      this.videoElement.requestVideoFrameCallback(step);
    } else {
      requestAnimationFrame(step);
    }
  }

  renderCutoutIfActiveBehind(sentenceOverride = null) {
    if (!this.videoElement) return;
    if (!this.cutoutCanvas) {
      this.cutoutCanvas = this.container?.querySelector('#user-cutout-canvas');
    }
    if (!this.cutoutCanvas) return;

    const time = sentenceOverride
      ? (Number(sentenceOverride.start ?? sentenceOverride.startTime ?? 0) + 0.05)
      : (this.videoElement.currentTime || 0);
    const sentences = captionEngine.sentences || [];
    let currentSentence = sentenceOverride || sentences.find((s, i) => {
      const sStart = Number(s.start ?? s.startTime ?? 0);
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
      const isLast = (i === sentences.length - 1);
      return time >= sStart && (isLast ? time <= sEnd : time < sEnd);
    });

    if (!currentSentence && sentences.length > 0) {
      for (let i = sentences.length - 1; i >= 0; i--) {
        const s = sentences[i];
        const sStart = Number(s.start ?? s.startTime ?? 0);
        const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
        if (time >= sStart && time <= (sEnd + 0.35)) {
          const nextS = sentences[i + 1];
          const nextStart = nextS ? Number(nextS.start ?? nextS.startTime ?? Infinity) : Infinity;
          if (time < nextStart) {
            currentSentence = s;
            break;
          }
        }
      }
    }

    if (currentSentence && currentSentence.behind && selfieSegmenterService.isReady()) {
      this.cutoutCanvas.style.display = 'block';
      selfieSegmenterService.renderCutout(this.videoElement, this.cutoutCanvas, this.enhanceVideoQuality);
    } else {
      if (this.cutoutCanvas.style.display !== 'none') {
        this.cutoutCanvas.style.display = 'none';
        const ctx = this.cutoutCanvas.getContext('2d');
        if (ctx && this.cutoutCanvas.width > 0 && this.cutoutCanvas.height > 0) {
          ctx.clearRect(0, 0, this.cutoutCanvas.width, this.cutoutCanvas.height);
        }
      }
    }
  }

  async handleProcessBehindAgain() {
    if (!this.videoElement) {
      this.showToast('Please upload or select a video first.', 'info');
      return;
    }

    const btn = this.container.querySelector('#btn-process-behind-again');
    const sentences = captionEngine.sentences || [];
    const behindCount = sentences.filter(s => s.behind).length;

    if (behindCount === 0) {
      this.showToast('Please check "Behind" on at least one caption segment first.', 'info');
      return;
    }

    // 1. Save video playback state
    const savedTime = this.videoElement.currentTime || 0;
    const wasPlaying = !this.videoElement.paused;
    if (wasPlaying) {
      this.videoElement.pause();
    }

    // 2. Button loading state
    if (btn) {
      btn.disabled = true;
      btn.classList.remove('needs-process');
      btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> Loading AI Rotoscoping...`;
    }
    soundFx.playProcessStart();

    try {
      // 3. Initialize Selfie Segmenter
      await selfieSegmenterService.init((pct, msg) => {
        if (btn) {
          btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> ${msg}`;
        }
      });
      selfieSegmenterService.resetCache();

      // 4. Pre-bake all behind segments for 60 FPS zero-lag playback on mobile & desktop
      if (btn) {
        btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> Pre-baking cutouts...`;
      }
      await selfieSegmenterService.prebakeCutoutsForSegments(this.videoElement, sentences, (pct, msg) => {
        if (btn) {
          btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> ${msg}`;
        }
      }, this.enhanceVideoQuality);

      // 5. Restore video playback state
      this.videoElement.currentTime = savedTime;
      if (wasPlaying) {
        await this.videoElement.play().catch(() => {});
      }

      // 6. Update UI, overlay, and render cutout for active frame
      this.lastRenderedSentenceKey = null;
      this.updateCaptionOverlay();
      this.renderCutoutIfActiveBehind();
      this.renderMiniSegmentsList();
      this.startRotoscopingLoop();

      soundFx.playSaveSuccess();
      this.showToast(`✨ Pre-rendered! ${behindCount} segment(s) will render behind the person with 60 FPS smoothness.`, 'success');
    } catch (err) {
      console.error('Process Behind error:', err);
      this.showToast('Rotoscoping initialization failed: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>⚡ Process Again</span> <span id="behind-active-badge" class="behind-count-pill">${behindCount} Behind</span>`;
        this.updateBehindCountBadge();
      }
    }
  }

  async burnVideoCaptions() {
    const burnBtn = this.container.querySelector('#user-btn-burn');
    const progBox = this.container.querySelector('#user-export-progress');
    const bar = this.container.querySelector('#user-export-bar');
    const pct = this.container.querySelector('#user-export-percent');
    if (progBox) progBox.style.display = 'block';

    const defaultBtnHtml = `
      <div class="burn-btn-content">
        <span>🎥 Burn Captions (60 FPS Export)</span>
      </div>
    `;

    if (burnBtn) {
      burnBtn.disabled = true;
      burnBtn.style.cursor = 'wait';
      burnBtn.innerHTML = `
        <div class="burn-progress-fill" style="width: 0%;"></div>
        <div class="burn-btn-content">
          <span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span>
          <span class="burn-status-label">Burning... <strong>0%</strong></span>
        </div>
      `;
    }

    try {
      const tpl = CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId) || CAPTION_TEMPLATES[0];
      const customConfig = this.userCustomTemplates[tpl.id] || {};
      const studioConfig = (this.activeConfig && (!this.activeConfig.templateId || this.activeConfig.templateId === tpl.id)) ? this.activeConfig : {};
      const cfg = { ...tpl.config, ...customConfig, ...studioConfig };

      await videoRenderer.burnCaptionsToVideoLossless(this.videoBlob, captionEngine.sentences, cfg, (p) => {
        const percentVal = Math.max(0, Math.min(100, Math.round(p * 100)));
        if (bar) bar.style.width = `${percentVal}%`;
        if (pct) pct.textContent = `${percentVal}%`;

        if (burnBtn) {
          const fill = burnBtn.querySelector('.burn-progress-fill');
          if (fill) fill.style.width = `${percentVal}%`;
          const statusLabel = burnBtn.querySelector('.burn-status-label');
          if (statusLabel) {
            statusLabel.innerHTML = `Burning... <strong>${percentVal}%</strong>`;
          }
        }
      }, this.enhanceVideoQuality);

      soundFx.playExportComplete();
      this.showToast('Export Complete! Downloaded 60 FPS video.', 'success');

      if (burnBtn) {
        burnBtn.innerHTML = `
          <div class="burn-progress-fill" style="width: 100%; background: rgba(16, 185, 129, 0.45);"></div>
          <div class="burn-btn-content">
            <span>✅ Complete! <strong>100%</strong></span>
          </div>
        `;
      }

      setTimeout(() => {
        if (progBox) progBox.style.display = 'none';
        if (burnBtn) {
          burnBtn.disabled = false;
          burnBtn.style.cursor = 'pointer';
          burnBtn.innerHTML = defaultBtnHtml;
        }
      }, 2500);
    } catch (err) {
      this.showToast('Export failed: ' + err.message, 'error');
      if (progBox) progBox.style.display = 'none';
      if (burnBtn) {
        burnBtn.disabled = false;
        burnBtn.style.cursor = 'pointer';
        burnBtn.innerHTML = defaultBtnHtml;
      }
    }
  }

  // ==========================================================================
  // EDIT LINE SEGMENTS MODAL (Add, Remove, Edit Timings & Text)
  // ==========================================================================
  openLineSegmentsModal() {
    const host = this.container.querySelector('#segment-modal-host') || document.body;
    if (!host) return;

    soundFx.playDrawerOpen();

    // Clone sentences for safe editing
    const tempSegments = JSON.parse(JSON.stringify(captionEngine.sentences));

    const drawer = document.createElement('div');
    drawer.className = 'edit-segments-drawer-overlay';
    drawer.innerHTML = `
      <div class="edit-segments-sidebar">
        <div class="edit-sidebar-header">
          <div>
            <h2 class="edit-sidebar-title">Manage Caption Line Segments</h2>
            <p class="edit-sidebar-subtitle">
              Fine-tune timestamps, edit words, or reorder lines. Changes live-sync with your video player.
            </p>
          </div>
          <button class="edit-sidebar-close-btn" id="btn-close-segments-drawer" title="Close Sidebar">✕</button>
        </div>

        <div class="edit-sidebar-body">
          <div class="segments-list-container" id="segments-editor-list">
            <!-- Dynamically populated rows -->
          </div>

          <button class="btn-add-segment-dashed" id="btn-add-new-segment">
            <span style="font-size: 16px;">+</span> Add New Caption Line Segment
          </button>
        </div>

        <div class="edit-sidebar-footer">
          <button class="btn btn-outline" id="btn-cancel-segments" style="padding: 10px 20px; font-size: 13px;">Cancel</button>
          <button class="btn btn-primary" id="btn-save-segments" style="padding: 10px 24px; font-size: 13px;">Save & Sync Timings</button>
        </div>
      </div>
    `;

    host.appendChild(drawer);

    // Trigger smooth slide-in animation via next frame
    requestAnimationFrame(() => {
      drawer.classList.add('active');
    });

    const closeDrawer = () => {
      soundFx.playDrawerClose();
      drawer.classList.remove('active');
      setTimeout(() => drawer.remove(), 340);
    };

    // Close on backdrop click
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) {
        closeDrawer();
      }
    });

    drawer.querySelector('#btn-close-segments-drawer')?.addEventListener('click', closeDrawer);
    drawer.querySelector('#btn-cancel-segments')?.addEventListener('click', closeDrawer);

    const renderRows = () => {
      const listEl = drawer.querySelector('#segments-editor-list');
      if (!listEl) return;
      listEl.innerHTML = '';

      tempSegments.forEach((seg, idx) => {
        const segStart = Number(seg.start ?? seg.startTime ?? 0);
        const segEnd = Number(seg.end ?? seg.endTime ?? (segStart + 2.5));

        const row = document.createElement('div');
        row.className = 'segment-item-card';
        row.innerHTML = `
          <div class="segment-badge-idx">
            #${idx + 1}
          </div>

          <label class="modal-behind-toggle" title="Render caption behind the person or main object in video" style="display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800; color: #4f46e5; cursor: pointer; background: #eef2ff; padding: 4px 8px; border-radius: 6px; border: 1px solid #c7d2fe; flex-shrink: 0;">
            <input type="checkbox" class="modal-chk-behind" data-idx="${idx}" ${seg.behind ? 'checked' : ''} style="cursor: pointer; accent-color: #4f46e5; margin: 0;">
            <span>Behind</span>
          </label>

          <div class="segment-editor-timing-row">
            <div class="segment-timing-inputs">
              <span>Start</span>
              <input type="number" step="0.1" min="0" class="segment-time-input" data-field="start" data-idx="${idx}" value="${segStart.toFixed(1)}">
              <span>s</span>
            </div>

            <div class="segment-timing-inputs">
              <span>End</span>
              <input type="number" step="0.1" min="0" class="segment-time-input" data-field="end" data-idx="${idx}" value="${segEnd.toFixed(1)}">
              <span>s</span>
            </div>
          </div>

          <input type="text" class="segment-text-input" data-field="text" data-idx="${idx}" value="${seg.text || ''}" placeholder="Caption line text...">

          <button class="btn-remove-segment" data-idx="${idx}" title="Delete Segment">
            ✕
          </button>
        `;

        // Input change handlers
        row.querySelectorAll('input').forEach(input => {
          input.addEventListener('input', (e) => {
            const f = e.target.dataset.field;
            const i = Number(e.target.dataset.idx);
            if (f === 'start' || f === 'end') {
              tempSegments[i][f] = parseFloat(e.target.value) || 0;
            } else if (f === 'text') {
              tempSegments[i][f] = e.target.value;
            }
          });
        });

        // Behind checkbox handler
        row.querySelector('.modal-chk-behind')?.addEventListener('change', (e) => {
          const i = Number(e.target.dataset.idx);
          if (tempSegments[i]) {
            tempSegments[i].behind = e.target.checked;
          }
        });

        // Delete row with unique sound
        row.querySelector('.btn-remove-segment')?.addEventListener('click', (e) => {
          soundFx.playSegmentDelete();
          const i = Number(e.currentTarget.dataset.idx);
          tempSegments.splice(i, 1);
          renderRows();
        });

        listEl.appendChild(row);
      });
    };

    renderRows();

    // Add row with unique sound
    drawer.querySelector('#btn-add-new-segment')?.addEventListener('click', () => {
      soundFx.playSegmentAdd();
      const last = tempSegments[tempSegments.length - 1];
      const lastEnd = last ? Number(last.end ?? last.endTime ?? 0) : 0.0;
      const start = Number((lastEnd + 0.2).toFixed(1));
      const end = Number((start + 2.5).toFixed(1));
      tempSegments.push({
        id: `s-${Date.now()}`,
        start,
        end,
        startTime: start,
        endTime: end,
        text: 'New caption line segment',
        words: [],
        behind: false
      });
      renderRows();

      // Scroll to bottom of list
      const body = drawer.querySelector('.edit-sidebar-body');
      if (body) body.scrollTop = body.scrollHeight;
    });

    // Save with unique harmonic confirmation chime
    drawer.querySelector('#btn-save-segments')?.addEventListener('click', () => {
      soundFx.playSaveSuccess();

      // Re-generate word timings from text
      tempSegments.forEach(seg => {
        const segStart = Number(seg.start ?? seg.startTime ?? 0);
        const segEnd = Number(seg.end ?? seg.endTime ?? (segStart + 2.5));
        const words = (seg.text || '').trim().split(/\s+/).filter(Boolean);
        const duration = Math.max(0.5, segEnd - segStart);
        const wordDuration = duration / Math.max(1, words.length);

        seg.words = words.map((w, wIdx) => ({
          word: w,
          start: Number((segStart + wIdx * wordDuration).toFixed(2)),
          end: Number((segStart + (wIdx + 1) * wordDuration).toFixed(2)),
          startTime: Number((segStart + wIdx * wordDuration).toFixed(2)),
          endTime: Number((segStart + (wIdx + 1) * wordDuration).toFixed(2))
        }));
      });

      captionEngine.setSentences(tempSegments);
      this.renderMiniSegmentsList();
      this.updateCaptionOverlay();
      this.renderCutoutIfActiveBehind();
      this.updateBehindCountBadge();
      const countBadge = this.container.querySelector('#user-sentence-count');
      if (countBadge) countBadge.textContent = `${captionEngine.sentences.length} Line Segments`;
      this.showToast('Line segments updated and synchronized!', 'success');
      closeDrawer();
    });
  }

  // ==========================================================================
  // TAB 3: MY PLAN & QUOTA
  // ==========================================================================
  renderQuotaTab(parent) {
    if (!parent) {
      parent = this.container?.querySelector('#user-workspace-content');
    }
    if (!parent) return;
    parent.innerHTML = '';
    const wrap = document.createElement('div');
    const { planName, dailyLimit, dailyUsed, monthlyLimit, monthlyUsed, isGuest } = this.quotaInfo;

    const dailyPct = Math.min(100, Math.round((dailyUsed / Math.max(1, dailyLimit)) * 100));
    const monthlyPct = Math.min(100, Math.round((monthlyUsed / Math.max(1, monthlyLimit)) * 100));

    wrap.innerHTML = `
      <div class="user-tab-header">
        <div>
          <h1 class="user-tab-title">My Plan & Quota Management</h1>
          <p style="color: #64748b; font-size: 14px;">Monitor your video generation limits and upgrade your package.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; max-width: 900px;">
        
        <!-- Current Plan Overview -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 28px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <span class="badge badge-cyan" style="font-size: 11px;">CURRENT SUBSCRIPTION</span>
              <h2 style="font-size: 24px; font-weight: 900; color: #0c0c0e; margin-top: 6px;">${planName}</h2>
            </div>
            <div style="width: 44px; height: 44px; border-radius: 12px; background: var(--primary-coral-light); color: var(--primary-coral); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              💎
            </div>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px;">
            ${isGuest ? 'You are currently on guest access. Sign in or request a paid plan to unlock higher limits and template cloud sync.' : 'Your plan gives you enterprise high-speed Whisper AI transcription and 60 FPS GPU lossless export.'}
          </p>

          <button class="btn btn-primary" id="btn-quota-upgrade" style="width: 100%; padding: 12px; font-size: 14px;">
            ⚡ Request Higher Limit Plan
          </button>
        </div>

        <!-- Quota Usage Stats -->
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 28px; box-shadow: var(--shadow-sm);">
          <h3 style="font-size: 16px; font-weight: 800; color: #0c0c0e; margin-bottom: 20px;">Usage & Quotas</h3>

          <!-- Daily Limit -->
          <div style="margin-bottom: 22px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 8px;">
              <span style="color: #334155;">Daily Generations</span>
              <span style="color: ${dailyUsed >= dailyLimit ? '#ef4444' : 'var(--primary-coral)'}; font-weight: 800;">
                ${dailyUsed} / ${dailyLimit} used ${dailyUsed >= dailyLimit ? '(Limit Reached)' : ''}
              </span>
            </div>
            <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${dailyPct}%; height: 100%; background: ${dailyUsed >= dailyLimit ? '#ef4444' : 'var(--primary-coral)'}; border-radius: 4px;"></div>
            </div>
          </div>

          <!-- Monthly Limit -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 8px;">
              <span style="color: #334155;">Monthly Generations</span>
              <span style="color: ${monthlyUsed >= monthlyLimit ? '#ef4444' : '#6366f1'}; font-weight: 800;">
                ${monthlyUsed} / ${monthlyLimit} used ${monthlyUsed >= monthlyLimit ? '(Limit Reached)' : ''}
              </span>
            </div>
            <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${monthlyPct}%; height: 100%; background: ${monthlyUsed >= monthlyLimit ? '#ef4444' : '#6366f1'}; border-radius: 4px;"></div>
            </div>
          </div>

          <div style="background: #fafbfe; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; color: #64748b;">
            💡 Quotas reset every 24 hours at 00:00 UTC. Unregistered guest usage is tracked by IP.
          </div>
        </div>

      </div>
    `;

    parent.appendChild(wrap);

    wrap.querySelector('#btn-quota-upgrade')?.addEventListener('click', () => {
      this.navigate('pricing');
    });
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
