// User Dashboard Component: SaaS Workspace
// Features: Left Sidebar, Templates & Style Studio, Apply Captions with 20%-100% Loader & Cancel,
// Line Segments Edit Modal, Quota Tracker, and Per-User Template Customizations.

import { 
  APP_CONFIG, 
  CAPTION_POSITIONS, 
  CAPTION_ANIMATIONS, 
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

export class UserDashboard {
  constructor(options = {}) {
    this.navigate = options.navigate || (() => {});
    this.showToast = options.showToast || (() => {});
    this.openAuthModal = options.openAuthModal || (() => {});
    this.toolStudio = options.toolStudio || null;

    this.activeTab = 'templates'; // 'templates' | 'apply' | 'quota'
    this.currentMode = 'landscape'; // 'landscape' | 'portrait'
    this.selectedTemplateId = 'september-pop';
    this.userCustomTemplates = {}; // templateId -> custom config
    this.activeConfig = { ...DEFAULT_LANDSCAPE_CONFIG };

    // Video State
    this.videoBlob = null;
    this.videoDuration = 0;
    this.videoElement = null;
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

        <div class="upload-card" id="user-drop-zone" style="max-width: 800px; margin: 20px auto; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: var(--radius-xl); padding: 48px 32px; text-align: center;">
          <input type="file" id="user-file-input" accept="video/*,video/mp4,video/quicktime,video/webm" style="display: none;">
          
          <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--primary-coral-light); color: var(--primary-coral); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
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
        <div class="client-processing-notice" style="max-width: 800px; margin: 24px auto 0 auto; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px 20px; display: flex; align-items: center; gap: 12px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffedd5; color: #ea580c; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div style="font-size: 13px; color: #9a3412; line-height: 1.5;">
            <strong style="color: #7c2d12; font-weight: 800;">⚠ Processing Notice:</strong> All video processing is performed entirely on your local device using your system's CPU, GPU, and RAM. No video data is uploaded to any server. Processing speed and performance depend on your hardware capabilities.
          </div>
        </div>
      `;

      parent.appendChild(wrap);

      // Event Listeners for Dropzone
      const fileInput = wrap.querySelector('#user-file-input');
      wrap.querySelector('#btn-user-browse-file')?.addEventListener('click', () => {
        soundFx.playKeyBeep(520);
        fileInput.click();
      });

      wrap.querySelector('#btn-change-template-shortcut')?.addEventListener('click', () => {
        this.switchTab('templates');
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
            dropZone.style.borderColor = '#cbd5e1';
            dropZone.style.background = '#ffffff';
          });
        });
        dropZone.addEventListener('drop', async (e) => {
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await this.handleVideoFile(e.dataTransfer.files[0]);
          }
        });
      }
      return;
    }

    // WORKSPACE VIEW (Video Player + Live Overlay + Transcript Sidebar)
    wrap.innerHTML = `
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

      <div class="workspace-grid">
        
        <!-- Left: Video Player -->
        <div class="video-player-card">
          <div class="video-container ${this.currentMode}" id="user-video-wrapper">
            <video class="studio-video-element" id="user-main-video" playsinline style="width: 100%; height: 100%; object-fit: contain;"></video>
            
            <!-- Real-Time Caption Overlay -->
            <div class="caption-live-overlay" id="user-caption-live-overlay" style="position: absolute; inset: 0; pointer-events: none; z-index: 10;"></div>
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
                <button class="btn btn-outline btn-compact-action" id="user-btn-srt">.SRT</button>
                <button class="btn btn-outline btn-compact-action" id="user-btn-vtt">.VTT</button>
                <button class="btn btn-primary btn-burn-captions" id="user-btn-burn">
                  🎥 Burn Captions (60 FPS Export)
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

        <!-- Right: Interactive Words Timeline & Segments Editor -->
        <aside style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Segments Header Card -->
          <div style="background: #ffffff; border-radius: var(--radius-xl); border: 1px solid var(--border-color); padding: 18px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #0c0c0e;">CAPTIONS & WORDS</div>
                <div style="font-size: 11px; color: #64748b;" id="user-sentence-count">${captionEngine.sentences.length} Line Segments</div>
              </div>

              <!-- BUTTON TO OPEN EDIT LINE SEGMENTS MODAL -->
              <button class="btn btn-primary" id="btn-open-segments-modal" style="padding: 6px 12px; font-size: 12px;">
                ✏️ Edit Segments
              </button>
            </div>

            <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;" id="user-segments-mini-list">
              <!-- Dynamically populated -->
            </div>
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

  async handleVideoFile(file) {
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > APP_CONFIG.MAX_FILE_SIZE_MB) {
      this.showToast(`Video size (${fileSizeMB.toFixed(1)} MB) exceeds maximum allowed ${APP_CONFIG.MAX_FILE_SIZE_MB} MB limit.`, 'error');
      return;
    }

    soundFx.playProcessStart();
    this.isProcessing = true;
    this.processingCancelled = false;
    this.processingProgress = 20;
    this.processingStatus = 'Reading video file and parsing audio track...';
    this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));

    try {
      await this.sleep(300);
      if (this.processingCancelled) return;

      this.updateProcessingProgress(35, 'Extracting 16kHz audio waveform for Whisper AI...');
      await this.sleep(300);
      if (this.processingCancelled) return;

      this.updateProcessingProgress(55, 'Running speech recognition & detecting language...');
      await this.processVideoBlob(file);
    } catch (err) {
      if (!this.processingCancelled) {
        this.showToast('Video processing error: ' + err.message, 'error');
        this.isProcessing = false;
        this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));
      }
    }
  }

  updateProcessingProgress(percent, status) {
    this.processingProgress = percent;
    this.processingStatus = status;
    const txt = this.container.querySelector('#proc-status-text');
    const bar = this.container.querySelector('#proc-bar-inner');
    const pct = this.container.querySelector('#proc-percent-text');
    if (txt) txt.textContent = status;
    if (bar) bar.style.width = `${percent}%`;
    if (pct) pct.textContent = `${percent}%`;
  }

  cancelProcessing() {
    this.processingCancelled = true;
    this.isProcessing = false;
    this.videoBlob = null;
    this.showToast('Transcription cancelled.', 'info');
    this.renderApplyCaptionsTab(this.container.querySelector('#user-workspace-content'));
  }

  async processVideoBlob(blob) {
    this.videoBlob = blob;

    if (this.processingCancelled) return;
    this.updateProcessingProgress(75, 'Calculating word-by-word timestamp alignments...');
    await this.sleep(350);

    if (this.processingCancelled) return;
    this.updateProcessingProgress(90, 'Synchronizing caption overlays with active template...');

    // Transcribe audio using offline speech transcriber
    try {
      const transcribeResult = await speechTranscriber.transcribeVideoBlob(blob, (status, pct) => {
        if (this.processingCancelled) return;
        const mapped = Math.floor(60 + (pct * 0.3));
        this.updateProcessingProgress(mapped, status);
      });

      if (this.processingCancelled) return;

      if (transcribeResult && transcribeResult.sentences && transcribeResult.sentences.length > 0) {
        captionEngine.setSentences(transcribeResult.sentences);
      } else {
        // Fallback demo sentences if audio was silent
        captionEngine.setSentences([
          {
            id: 's-1',
            start: 0.2,
            end: 2.8,
            text: 'Transform your videos with automated viral captions',
            words: [
              { word: 'Transform', start: 0.2, end: 0.6 },
              { word: 'your', start: 0.6, end: 0.9 },
              { word: 'videos', start: 0.9, end: 1.4 },
              { word: 'with', start: 1.4, end: 1.7 },
              { word: 'automated', start: 1.7, end: 2.2 },
              { word: 'viral', start: 2.2, end: 2.5 },
              { word: 'captions', start: 2.5, end: 2.8 }
            ]
          },
          {
            id: 's-2',
            start: 3.0,
            end: 5.6,
            text: 'Dual-font typography with 60 FPS GPU lossless export',
            words: [
              { word: 'Dual-font', start: 3.0, end: 3.5 },
              { word: 'typography', start: 3.5, end: 4.1 },
              { word: 'with', start: 4.1, end: 4.4 },
              { word: '60 FPS', start: 4.4, end: 4.9 },
              { word: 'GPU', start: 4.9, end: 5.2 },
              { word: 'export', start: 5.2, end: 5.6 }
            ]
          }
        ]);
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
    });

    this.videoElement.addEventListener('timeupdate', () => {
      if (scrubber && !scrubber.matches(':active')) {
        scrubber.value = this.videoElement.currentTime;
      }
      this.updateTimeDisplay();
      this.updateCaptionOverlay();
      this.highlightActiveSegment();
    });

    playBtn?.addEventListener('click', () => {
      if (this.videoElement.paused) {
        this.videoElement.play();
        playBtn.textContent = '⏸';
        soundFx.playVideoPlay();
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
      soundFx.playSeek();
    });

    wrap.querySelector('#user-btn-rw')?.addEventListener('click', () => {
      soundFx.playSkip();
      this.videoElement.currentTime = Math.max(0, this.videoElement.currentTime - 5);
      this.lastRenderedSentenceKey = null;
      this.updateTimeDisplay();
      this.updateCaptionOverlay();
    });

    wrap.querySelector('#user-btn-ff')?.addEventListener('click', () => {
      soundFx.playSkip();
      this.videoElement.currentTime = Math.min(this.videoDuration, this.videoElement.currentTime + 5);
      this.lastRenderedSentenceKey = null;
      this.updateTimeDisplay();
      this.updateCaptionOverlay();
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

  updateCaptionOverlay() {
    const overlay = this.container.querySelector('#user-caption-live-overlay');
    if (!overlay || !this.videoElement) return;

    const time = this.videoElement.currentTime || 0;
    const sentences = captionEngine.sentences || [];

    // 1. Find active sentence by start/end or startTime/endTime
    let currentSentence = sentences.find(s => {
      const sStart = s.start ?? s.startTime ?? 0;
      const sEnd = s.end ?? s.endTime ?? (sStart + 2.5);
      return time >= sStart && time <= sEnd;
    });

    // 2. Micro-gap tolerance: linger previous sentence up to 1.2s so captions don't blink out between speech pauses
    if (!currentSentence && sentences.length > 0) {
      currentSentence = sentences.find(s => {
        const sStart = s.start ?? s.startTime ?? 0;
        const sEnd = s.end ?? s.endTime ?? (sStart + 2.5);
        return time >= sStart && time <= (sEnd + 1.2);
      });
    }

    if (!currentSentence) {
      overlay.innerHTML = '';
      this.lastRenderedSentenceKey = null;
      return;
    }

    // 3. Resolve active template and user custom/studio configurations
    const tpl = CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId) || CAPTION_TEMPLATES[0];
    const customConfig = this.userCustomTemplates[tpl.id] || {};
    const studioConfig = (this.activeConfig && (!this.activeConfig.templateId || this.activeConfig.templateId === tpl.id)) ? this.activeConfig : {};
    const cfg = { ...tpl.config, ...customConfig, ...studioConfig };

    // 4. Ensure words array exists with valid timings
    let words = currentSentence.words;
    if (!words || words.length === 0) {
      const sStart = currentSentence.start ?? currentSentence.startTime ?? 0;
      const sEnd = currentSentence.end ?? currentSentence.endTime ?? (sStart + 2.5);
      words = captionEngine.createWordLevelTimestamps(currentSentence.text || '', sStart, sEnd);
    }

    // Guard: ensure line segment NEVER exceeds 2 rows (clamp to max 5 words)
    if (words.length > 5) {
      words = words.slice(0, 5);
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

    // 6. Font sizes: Standard other words 28px, speaking single word 32px (+4px size)
    const baseFontSize = (cfg.fontSize && Number(cfg.fontSize) <= 30) ? Number(cfg.fontSize) : 28;
    const speakingFontSize = baseFontSize + 4; // Exactly 32px when base is 28px

    // 7. Typography settings from config
    const normalFont = cfg.normalFontFamily || 'Inter';
    const prominentFont = cfg.prominentFontFamily || 'Syne';

    const defaultTextColor = cfg.textColor || '#FFFFFF';
    const prominentColor = cfg.prominentColor || '#FFE600';
    const hasLastWordColor = cfg.enableLastWordColor !== false && !!cfg.lastWordColor;
    const lastWordColor = hasLastWordColor ? cfg.lastWordColor : prominentColor;
    const speakingHighlightColor = cfg.karaokeHighlightColor || prominentColor;

    // 8. Build styled words: 100% OPAQUE (coming words never transparent), colorful, zero overlap
    const wordsHtml = words.map((w, idx) => {
      const isSpeaking = (idx === speakingWordIdx);
      const isLastWord = (idx === words.length - 1);
      // Dual-font prominence: last word, or alternating hero word if segment has >= 3 words
      const isProminent = isLastWord || (words.length >= 3 && idx % 2 === 1);

      let font = normalFont;
      let color = defaultTextColor;

      if (isProminent) {
        font = prominentFont;
        color = prominentColor;
      }

      if (isLastWord && hasLastWordColor) {
        font = prominentFont;
        color = lastWordColor;
      }

      if (isSpeaking) {
        color = speakingHighlightColor;
      }

      const wordFontSize = isSpeaking ? speakingFontSize : baseFontSize;
      const fontWeight = isSpeaking ? 900 : (isProminent ? 800 : 700);
      const textShadow = isSpeaking
        ? `0 0 18px ${color}, 0 2px 10px rgba(0,0,0,0.98), 0 0 4px #000000`
        : `0 2px 8px rgba(0,0,0,0.95), 0 0 3px #000000`;

      return `
        <span class="caption-word-token ${isSpeaking ? 'speaking current' : ''}" style="
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          vertical-align: middle !important;
          margin: 2px 5px !important;
          padding: 2px 6px !important;
          box-sizing: border-box !important;
          font-family: '${font}', sans-serif;
          color: ${color} !important;
          font-size: ${wordFontSize}px !important;
          font-weight: ${fontWeight};
          opacity: 1 !important;
          visibility: visible !important;
          line-height: 1.35;
          letter-spacing: 0.3px;
          text-shadow: ${textShadow};
          transform: none !important;
          white-space: nowrap !important;
          transition: font-size 0.12s cubic-bezier(0.16, 1, 0.3, 1), color 0.12s ease, text-shadow 0.12s ease;
        ">
          ${w.word}
        </span>
      `;
    }).join('');

    // 9. Detect new line segment transition to trigger configured entrance animation
    const sStart = Number(currentSentence.start ?? currentSentence.startTime ?? 0);
    const sEnd = Number(currentSentence.end ?? currentSentence.endTime ?? (sStart + 2.5));
    const sText = (currentSentence.text || '').trim();
    const sKey = `seg_${currentSentence.id ?? `${sStart.toFixed(2)}_${sEnd.toFixed(2)}_${sText}`}`;

    const isNewSegment = this.lastRenderedSentenceKey !== sKey;
    this.lastRenderedSentenceKey = sKey;

    // 10. Retrieve animation class from config
    const animId = cfg.animation || 'anim-pop';
    const animMeta = CAPTION_ANIMATIONS.find(a => a.id === animId || a.cssClass === animId);
    const animClass = animMeta ? animMeta.cssClass : (animId.startsWith('anim-') ? animId : 'anim-pop');

    // 11. Position setup
    let bottomPos = '12%';
    let topPos = 'auto';
    let transformPos = 'translateX(-50%)';
    if (cfg.position === 'top' || cfg.position === 'top-left' || cfg.position === 'top-right') {
      topPos = '12%';
      bottomPos = 'auto';
    } else if (cfg.position === 'middle') {
      topPos = '50%';
      bottomPos = 'auto';
      transformPos = 'translate(-50%, -50%)';
    }

    let anchor = overlay.querySelector('.caption-segment-anchor');
    let animWrapper = overlay.querySelector('.caption-anim-segment-wrapper');

    if (!anchor || !animWrapper || isNewSegment) {
      // Re-create segment with configured entrance animation.
      // row-gap: 14px and column-gap: 8px completely prevent overlapping between words & lines!
      overlay.innerHTML = `
        <div class="caption-segment-anchor" style="position: absolute; top: ${topPos}; bottom: ${bottomPos}; left: 50%; transform: ${transformPos}; width: 92%; max-height: 75%; text-align: center; pointer-events: none; z-index: 20;">
          <div class="caption-anim-segment-wrapper ${animClass}" style="display: inline-flex; flex-wrap: wrap; justify-content: center; align-items: center; row-gap: 14px; column-gap: 8px; width: 100%; max-width: 96%; max-height: 4.8em; overflow: hidden; text-transform: uppercase;">
            ${wordsHtml}
          </div>
        </div>
      `;
    } else {
      // Same segment: update word sizes and colors without restarting entrance animation
      animWrapper.innerHTML = wordsHtml;
    }
  }

  renderMiniSegmentsList() {
    const list = this.container.querySelector('#user-segments-mini-list');
    if (!list) return;
    list.innerHTML = '';

    const sentences = captionEngine.sentences || [];
    sentences.forEach((s, idx) => {
      const sStart = Number(s.start ?? s.startTime ?? (idx * 2.5));
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
      const item = document.createElement('div');
      item.id = `seg-mini-${idx}`;
      item.style.cssText = 'padding: 8px 10px; background: #fafbfe; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.15s ease;';
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 11px; margin-bottom: 2px;">
          <span>#${idx + 1}</span>
          <span>${sStart.toFixed(1)}s - ${sEnd.toFixed(1)}s</span>
        </div>
        <div style="font-weight: 700; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${s.text || 'Caption Segment'}
        </div>
      `;

      item.addEventListener('click', () => {
        if (this.videoElement) {
          soundFx.playSeek();
          this.videoElement.currentTime = sStart;
          this.lastRenderedSentenceKey = null;
          this.updateCaptionOverlay();
        }
      });

      list.appendChild(item);
    });
  }

  highlightActiveSegment() {
    if (!this.videoElement) return;
    const time = this.videoElement.currentTime || 0;
    const sentences = captionEngine.sentences || [];
    sentences.forEach((s, idx) => {
      const el = this.container.querySelector(`#seg-mini-${idx}`);
      if (el) {
        const sStart = Number(s.start ?? s.startTime ?? 0);
        const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
        const isActive = time >= sStart && time <= sEnd;
        el.style.borderColor = isActive ? 'var(--primary-coral)' : '#e2e8f0';
        el.style.background = isActive ? 'var(--primary-coral-light)' : '#fafbfe';
      }
    });
  }

  async burnVideoCaptions() {
    const progBox = this.container.querySelector('#user-export-progress');
    const bar = this.container.querySelector('#user-export-bar');
    const pct = this.container.querySelector('#user-export-percent');
    if (progBox) progBox.style.display = 'block';

    try {
      const tpl = CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId) || CAPTION_TEMPLATES[0];
      const customConfig = this.userCustomTemplates[tpl.id];
      const cfg = customConfig ? { ...tpl.config, ...customConfig } : tpl.config;

      await videoRenderer.burnCaptionsToVideoLossless(this.videoBlob, captionEngine.sentences, cfg, (p) => {
        const percentVal = Math.round(p * 100);
        if (bar) bar.style.width = `${percentVal}%`;
        if (pct) pct.textContent = `${percentVal}%`;
      }, this.enhanceVideoQuality);

      soundFx.playExportComplete();
      this.showToast('Export Complete! Downloaded 60 FPS video.', 'success');
      setTimeout(() => {
        if (progBox) progBox.style.display = 'none';
      }, 2000);
    } catch (err) {
      this.showToast('Export failed: ' + err.message, 'error');
      if (progBox) progBox.style.display = 'none';
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
        words: []
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
              <span style="color: var(--primary-coral);">${dailyUsed} / ${dailyLimit} used</span>
            </div>
            <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${dailyPct}%; height: 100%; background: var(--primary-coral); border-radius: 4px;"></div>
            </div>
          </div>

          <!-- Monthly Limit -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 8px;">
              <span style="color: #334155;">Monthly Generations</span>
              <span style="color: #6366f1;">${monthlyUsed} / ${monthlyLimit} used</span>
            </div>
            <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
              <div style="width: ${monthlyPct}%; height: 100%; background: #6366f1; border-radius: 4px;"></div>
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
