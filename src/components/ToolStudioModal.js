// Screen 3: Tool Style Studio Modal with Ready-Made Templates & Granular Customizer
import { 
  FONTS, 
  CAPTION_POSITIONS, 
  CAPTION_ANIMATIONS, 
  CAPTION_TEMPLATES,
  DEFAULT_LANDSCAPE_CONFIG, 
  DEFAULT_PORTRAIT_CONFIG 
} from '../config.js';
import { soundFx } from '../services/soundFx.js';
import { storage } from '../services/storageService.js';
import { autoTypographyEngine } from '../services/autoTypographyEngine.js';

export class ToolStudioModal {
  constructor(options = {}) {
    this.onConfigChanged = options.onConfigChanged || (() => {});
    this.currentMode = 'landscape'; // 'landscape' | 'portrait'
    this.landscapeConfig = { ...DEFAULT_LANDSCAPE_CONFIG };
    this.portraitConfig = { ...DEFAULT_PORTRAIT_CONFIG };
    this.container = null;
    this.introAnimElement = null;
    this.isOpen = false;
    this.animLoopTimer = null;
    this.previewPhrases = [
      'this is Emily',
      'for September',
      'welcome to California',
      'creating Viral Reels'
    ];
    this.phraseIdx = 0;
    this.activeFontTarget = 'normal'; // 'normal' | 'prominent'
    this.activeModalTab = 'templates'; // 'templates' | 'customize'
    this.selectedTemplateId = 'september-pop';
    this.templateFilterCategory = 'all';
  }

  async initConfigs() {
    const v5Migrated = await storage.getSetting('config_templates_v5');
    if (!v5Migrated) {
      this.landscapeConfig = { ...DEFAULT_LANDSCAPE_CONFIG };
      this.portraitConfig = { ...DEFAULT_PORTRAIT_CONFIG };
      await storage.saveSetting('config_landscape', this.landscapeConfig);
      await storage.saveSetting('config_portrait', this.portraitConfig);
      await storage.saveSetting('config_templates_v5', true);
    } else {
      const savedLandscape = await storage.getSetting('config_landscape');
      const savedPortrait = await storage.getSetting('config_portrait');
      if (savedLandscape) this.landscapeConfig = { ...this.landscapeConfig, ...savedLandscape };
      if (savedPortrait) this.portraitConfig = { ...this.portraitConfig, ...savedPortrait };
    }

    if (!this.landscapeConfig.templateId) this.landscapeConfig.templateId = 'september-pop';
    if (!this.portraitConfig.templateId) this.portraitConfig.templateId = 'september-pop';
    this.selectedTemplateId = this.getActiveConfig().templateId || 'september-pop';
  }

  getActiveConfig() {
    return this.currentMode === 'landscape' ? this.landscapeConfig : this.portraitConfig;
  }

  setActiveConfig(newConfig) {
    if (this.currentMode === 'landscape') {
      this.landscapeConfig = { ...this.landscapeConfig, ...newConfig };
      storage.saveSetting('config_landscape', this.landscapeConfig);
    } else {
      this.portraitConfig = { ...this.portraitConfig, ...newConfig };
      storage.saveSetting('config_portrait', this.portraitConfig);
    }
    this.onConfigChanged(this.getActiveConfig(), this.currentMode);
    this.updatePreview();
  }

  setOrientation(mode) {
    if (!mode) return;
    this.currentMode = mode;
    if (this.container) {
      this.container.querySelectorAll('.orient-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-mode') === mode);
      });
      const previewBox = this.container.querySelector('#preview-screen-box');
      if (previewBox) {
        previewBox.className = `preview-screen-box preview-${this.currentMode}`;
      }
      this.populateControls();
    }
    if (typeof this.onConfigChanged === 'function') {
      this.onConfigChanged(this.getActiveConfig(), this.currentMode);
    }
  }

  render(parentElement) {
    // 1. Center Holographic Tool Animation Element
    this.introAnimElement = document.createElement('div');
    this.introAnimElement.className = 'tool-center-intro-anim';
    this.introAnimElement.innerHTML = `
      <div class="tool-hologram-gear"></div>
      <div class="tool-hologram-core">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </div>
    `;
    parentElement.appendChild(this.introAnimElement);

    // 2. Main Studio Modal Backdrop
    this.container = document.createElement('div');
    this.container.className = 'tool-modal-backdrop';
    this.container.id = 'tool-modal-backdrop';

    this.container.innerHTML = `
      <div class="tool-studio-modal" id="tool-studio-modal">
        <!-- Header -->
        <div class="tool-modal-header">
          <div class="tool-modal-title-group">
            <div class="tool-modal-badge-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </div>
            <div>
              <h2>CAPTION STYLE ENGINE</h2>
              <p>16 READY-MADE TEMPLATES & DEEP GRANULAR STUDIO CUSTOMIZER</p>
            </div>
          </div>

          <div class="tool-header-controls">
            <!-- Landscape vs Portrait Mode Tabs -->
            <div class="orientation-tab-pill">
              <button class="orient-btn ${this.currentMode === 'landscape' ? 'active' : ''}" data-mode="landscape">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect></svg>
                Landscape
              </button>
              <button class="orient-btn ${this.currentMode === 'portrait' ? 'active' : ''}" data-mode="portrait">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"></rect></svg>
                Portrait
              </button>
            </div>

            <button class="btn-close-modal" id="btn-close-tool-modal" title="Close Studio">✕</button>
          </div>
        </div>

        <!-- Body Grid -->
        <div class="tool-modal-body">
          <!-- Left Column: Controls & Views -->
          <div class="tool-config-column">

            <!-- Navigation Switcher: Top customize tab hidden as requested -->
            <div class="studio-view-nav" style="display: none;">
              <button type="button" class="view-nav-tab ${this.activeModalTab === 'templates' ? 'active' : ''}" id="tab-nav-templates">
                <span class="nav-tab-icon">🎨</span>
                <span>Ready-Made Templates (16)</span>
              </button>
              <button type="button" class="view-nav-tab ${this.activeModalTab === 'customize' ? 'active' : ''}" id="tab-nav-customize" style="display: none;">
                <span class="nav-tab-icon">⚙️</span>
                <span>Customize Template</span>
              </button>
            </div>

            <!-- VIEW 1: Ready-Made Templates Gallery -->
            <div class="templates-gallery-container" id="view-templates-gallery" style="display: ${this.activeModalTab === 'templates' ? 'flex' : 'none'};">
              <div class="templates-gallery-header">
                <div class="templates-gallery-title">
                  <h3>✨ 16 Professional Caption Templates</h3>
                  <p>Choose a pre-designed aesthetic crafted for your video's niche, or customize any template.</p>
                </div>
              </div>

              <!-- Category Filter Pills -->
              <div class="template-category-pills" id="template-category-pills">
                <button type="button" class="template-cat-pill active" data-cat="all">All (16)</button>
                <button type="button" class="template-cat-pill" data-cat="viral">🔥 Viral Reels</button>
                <button type="button" class="template-cat-pill" data-cat="luxury">✨ Luxury Vogue</button>
                <button type="button" class="template-cat-pill" data-cat="tech">⚡ Cyber & Tech</button>
                <button type="button" class="template-cat-pill" data-cat="cinema">🎬 Cinema</button>
                <button type="button" class="template-cat-pill" data-cat="business">📈 Finance</button>
                <button type="button" class="template-cat-pill" data-cat="entertainment">💥 Entertainment</button>
                <button type="button" class="template-cat-pill" data-cat="music">🎤 Music / Studio</button>
              </div>

              <!-- 16 Templates Cards Grid -->
              <div class="templates-cards-grid" id="templates-gallery-grid">
                <!-- Dynamically populated via renderTemplatesGallery() -->
              </div>

              <!-- Bottom Action Bar -->
              <div class="gallery-bottom-action-bar">
                <div class="gallery-action-info">
                  <span class="info-title" id="gallery-selected-name">Active: Viral Reel (Hormozi / Ref)</span>
                  <span class="info-sub">Selected style is active on your video. Click Customize to tweak fonts & colors.</span>
                </div>
                <div class="gallery-action-buttons">
                  <button type="button" class="btn-primary-customize" id="btn-gallery-customize">
                    <span>⚙️ Customize Template</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- VIEW 2: Customize Template Studio -->
            <div id="view-customize-studio" style="display: ${this.activeModalTab === 'customize' ? 'flex' : 'none'}; flex-direction: column; gap: 20px;">
              <!-- Customize View Header Banner -->
              <div class="customize-studio-banner">
                <button type="button" class="btn-back-to-templates" id="btn-back-to-templates">
                  <span>← Back to Templates Gallery</span>
                </button>
                <div class="customizing-badge-wrap">
                  <span class="customizing-label">Customizing:</span>
                  <span class="customizing-template-badge" id="customizing-template-badge">Viral Reel (Hormozi / Ref)</span>
                </div>
                <button type="button" class="btn-reset-template-preset" id="btn-reset-template-preset" title="Reset this template to default preset">
                  ↺ Reset Template
                </button>
              </div>

              <!-- 0. Video Quality Enhancement Option -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>✨ Video Quality Enhancement</span>
                  <span class="badge badge-coral" id="modal-enhance-badge">OFF</span>
                </div>
                <label class="enhance-quality-toggle-label" style="cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #fff5f2; border-radius: 8px; border: 1px solid rgba(255, 85, 51, 0.2);">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="chk-modal-enhance-quality" class="enhance-quality-input">
                    <span class="enhance-custom-checkbox">
                      <svg class="enhance-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </span>
                    <span style="font-size: 0.88rem; font-weight: 700; color: var(--primary-coral);">Enhance Video Quality</span>
                  </div>
                </label>
              </div>

              <!-- 1. Caption Position (9 Locations) -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>📍 Caption Position (9 Locations)</span>
                  <span class="badge badge-purple" id="selected-pos-name">Middle Left</span>
                </div>
                <div class="position-grid-7" id="position-grid-7">
                  <!-- Row 1: Top Left, Top, Top Right -->
                  <button class="pos-btn" data-pos="top-left">Top Left</button>
                  <button class="pos-btn" data-pos="top">Top</button>
                  <button class="pos-btn" data-pos="top-right">Top Right</button>

                  <!-- Row 2: Middle Left, Middle, Middle Right -->
                  <button class="pos-btn" data-pos="middle-left">Mid Left</button>
                  <button class="pos-btn" data-pos="middle">Middle</button>
                  <button class="pos-btn" data-pos="middle-right">Mid Right</button>

                  <!-- Row 3: Bottom Left, Bottom, Bottom Right -->
                  <button class="pos-btn" data-pos="bottom-left">Bottom Left</button>
                  <button class="pos-btn" data-pos="bottom">Bottom</button>
                  <button class="pos-btn" data-pos="bottom-right">Bottom Right</button>
                </div>
              </div>

              <!-- 2. Caption Size (1 - 100, default 30) -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>🔤 Caption Size (Scale 1 - 100)</span>
                  <span class="slider-value-tag" id="caption-size-value">30</span>
                </div>
                <div class="slider-control-group">
                  <div class="slider-label-row">
                    <span>Small (1)</span>
                    <span>Default (30)</span>
                    <span>Huge (100)</span>
                  </div>
                  <input type="range" min="1" max="100" value="30" class="custom-range-slider" id="caption-size-slider">
                </div>
              </div>

              <!-- 3. Dual Font Family Selection -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>3. Caption Fonts</span>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <span class="badge badge-cyan" id="selected-normal-font-name">Normal: Inter</span>
                    <span class="badge badge-purple" id="selected-prominent-font-name">Prominent: Syne</span>
                  </div>
                </div>
                
                <div class="font-tab-group">
                  <button class="font-tab-btn active" data-font-target="normal" id="tab-font-normal">
                    Normal Text Font
                  </button>
                  <button class="font-tab-btn" data-font-target="prominent" id="tab-font-prominent">
                    Prominent Words Font (Hero/Accent)
                  </button>
                </div>

                <div class="font-picker-grid" id="font-picker-grid">
                  <!-- Injected via renderFontGrid() -->
                </div>
              </div>

              <!-- 4. Modern Dual Color & Stroke Pro Grid -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>4. Colors & Stroke Styling</span>
                  <span class="badge badge-coral">Pro Dual Typography</span>
                </div>

                <div class="dual-color-pro-grid">
                  <!-- Left Card: Normal Words -->
                  <div class="color-pro-subcard subcard-normal">
                    <div class="subcard-header">
                      <div class="subcard-title-wrap">
                        <span class="subcard-indicator normal-dot"></span>
                        <strong class="subcard-title">Normal Words Text</strong>
                      </div>
                      <span class="badge badge-coral" id="badge-normal-color">#FFFFFF</span>
                    </div>
                    
                    <div class="control-subblock">
                      <div class="subblock-header-row">
                        <span class="subblock-label">Text Color:</span>
                        <label class="compact-color-picker-btn" for="custom-normal-color-input" title="Choose normal text color">
                          <span class="color-preview-circle" id="preview-swatch-normal-color" style="background: #FFFFFF;"></span>
                          <span class="color-hex-text" id="hex-text-normal-color">#FFFFFF</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                          <input type="color" value="#FFFFFF" class="color-picker-native-hidden" id="custom-normal-color-input">
                        </label>
                      </div>
                    </div>

                    <div class="control-subblock">
                      <div class="subblock-header-row">
                        <span class="subblock-label">Stroke Outline Width:</span>
                        <span class="slider-value-tag" id="normal-outline-width-val">2px</span>
                      </div>
                      <input type="range" min="0" max="14" step="0.5" value="2" class="custom-range-slider" id="normal-outline-slider">
                    </div>

                    <div class="control-subblock">
                      <div class="subblock-header-row">
                        <span class="subblock-label">Stroke Outline Color:</span>
                        <label class="compact-color-picker-btn" for="custom-normal-outline-color" title="Choose normal stroke outline color">
                          <span class="color-preview-circle" id="preview-swatch-normal-outline" style="background: #000000;"></span>
                          <span class="color-hex-text" id="hex-text-normal-outline">#000000</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                          <input type="color" value="#000000" class="color-picker-native-hidden" id="custom-normal-outline-color">
                        </label>
                      </div>
                    </div>
                  </div>

                  <!-- Right Card: Prominent Words -->
                  <div class="color-pro-subcard subcard-prominent">
                    <div class="subcard-header">
                      <div class="subcard-title-wrap">
                        <span class="subcard-indicator prominent-dot"></span>
                        <strong class="subcard-title">Prominent Words (Hero Accent)</strong>
                      </div>
                      <span class="badge badge-purple" id="badge-prominent-color">#FFE600</span>
                    </div>

                    <div class="control-subblock">
                      <div class="subblock-header-row">
                        <span class="subblock-label">Accent Hero Color:</span>
                        <label class="compact-color-picker-btn" for="custom-prominent-color-input" title="Choose hero accent color">
                          <span class="color-preview-circle" id="preview-swatch-prominent-color" style="background: #FFE600;"></span>
                          <span class="color-hex-text" id="hex-text-prominent-color">#FFE600</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                          <input type="color" value="#FFE600" class="color-picker-native-hidden" id="custom-prominent-color-input">
                        </label>
                      </div>
                    </div>

                    <div class="control-subblock">
                      <div class="subblock-header-row">
                        <span class="subblock-label">Stroke Outline Width:</span>
                        <span class="slider-value-tag" id="prominent-outline-width-val">3px</span>
                      </div>
                      <input type="range" min="0" max="14" step="0.5" value="3" class="custom-range-slider" id="prominent-outline-slider">
                    </div>

                    <div class="control-subblock">
                      <div class="subblock-header-row">
                        <span class="subblock-label">Stroke Outline Color:</span>
                        <label class="compact-color-picker-btn" for="custom-prominent-outline-color" title="Choose hero stroke outline color">
                          <span class="color-preview-circle" id="preview-swatch-prominent-outline" style="background: #000000;"></span>
                          <span class="color-hex-text" id="hex-text-prominent-outline">#000000</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                          <input type="color" value="#000000" class="color-picker-native-hidden" id="custom-prominent-outline-color">
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Last Word Accent Option -->
                <div class="last-word-accent-block">
                  <div class="accent-toggle-row">
                    <label class="accent-toggle-label">
                      <input type="checkbox" id="enable-last-word-toggle" checked style="accent-color: var(--primary-coral);">
                      <span>Accent Last Spoken Word of Each Line</span>
                    </label>
                    <label class="compact-color-picker-btn" for="custom-last-word-input" title="Choose last word accent color">
                      <span class="color-preview-circle" id="preview-swatch-last-word" style="background: #FFE600;"></span>
                      <span class="color-hex-text" id="hex-text-last-word">#FFE600</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                      <input type="color" value="#FFE600" class="color-picker-native-hidden" id="custom-last-word-input">
                    </label>
                  </div>
                </div>
              </div>

              <!-- 5. Caption Animations (22 styles) -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>5. Caption Animations (22 Styles)</span>
                  <span class="badge badge-purple" id="selected-anim-name">Pop & Bounce</span>
                </div>
                <div class="animation-cards-grid" id="animation-cards-grid">
                  <!-- Injected via populateControls() -->
                </div>
              </div>

              <!-- 6. Advanced Time Interval Coloring -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>6. Dynamic Time-Interval Color Changes</span>
                  <button class="btn-add-interval" id="btn-add-interval">+ Add Phase</button>
                </div>
                <div class="interval-list-container" id="interval-list-container">
                  <!-- Injected via renderIntervalsList() -->
                </div>
              </div>
            </div>

          </div>

          <!-- Right Column: Interactive Phone Preview Mockup -->
          <div class="tool-preview-column">
            <div class="preview-header-bar">
              <span class="preview-col-title" id="preview-col-mode-title">LIVE PREVIEW</span>
              <span class="preview-profile-badge" id="preview-profile-badge">16:9 Landscape</span>
            </div>

            <div class="preview-screen-box preview-${this.currentMode}" id="preview-screen-box">
              <div class="preview-phone-notch"></div>
              
              <!-- Video Simulation Background -->
              <div class="preview-video-mockup">
                <div class="preview-mockup-light-glow"></div>
                <div class="preview-grid-lines"></div>
              </div>

              <!-- Live Caption Overlay Preview -->
              <div class="preview-caption-anchor preview-caption-text" id="preview-caption-anchor">
                <div class="preview-caption-anim-wrapper" id="preview-caption-anim-wrapper">
                  <div class="preview-caption-flow" id="preview-caption-flow">
                    <!-- Injected live -->
                  </div>
                </div>
              </div>
            </div>

            <!-- Preview Controls Bar -->
            <div class="preview-footer-controls">
              <button class="btn-preview-step" id="btn-prev-phrase" title="Previous Test Line">◀ Prev Line</button>
              <span class="phrase-indicator" id="preview-phrase-num">Sample 1/4</span>
              <button class="btn-preview-step" id="btn-next-phrase" title="Next Test Line">Next Line ▶</button>
            </div>
          </div>
        </div>

        <!-- Footer Actions Bar -->
        <div class="tool-modal-footer">
          <button class="btn-reset-defaults" id="btn-reset-defaults">RESTORE SYSTEM DEFAULTS</button>
          <button class="btn-apply-settings" id="btn-apply-tool-modal">APPLY & RETURN TO STUDIO</button>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.bindEvents();
    this.populateControls();
  }

  populateControls() {
    this.renderTemplatesGallery();
    this.renderFontGrid();
    this.populateCustomizeControls();
    this.updatePreview();
  }

  renderTemplatesGallery() {
    const grid = this.container?.querySelector('#templates-gallery-grid');
    if (!grid) return;

    const filtered = this.templateFilterCategory === 'all'
      ? CAPTION_TEMPLATES
      : CAPTION_TEMPLATES.filter(t => t.category === this.templateFilterCategory || (this.templateFilterCategory === 'music' && (t.category === 'music' || t.category === 'podcast')));

    grid.innerHTML = filtered.map(tmpl => {
      const isSelected = tmpl.id === this.selectedTemplateId;
      const c = tmpl.config;
      const normalStroke = Math.min(1.4, Math.max(0.6, (c.normalOutlineWidth || 2) * 0.45));
      const prominentStroke = Math.min(2.0, Math.max(1.0, (c.prominentOutlineWidth || 3.5) * 0.45));
      const sampleNormal = tmpl.sampleNormal || 'result of';
      const sampleProminent = tmpl.sampleProminent || 'Zen AI';

      return `
        <div class="template-card ${isSelected ? 'active' : ''}" data-template-id="${tmpl.id}">
          <div class="template-card-header">
            <div class="template-card-title-wrap">
              <span class="template-card-icon">${tmpl.icon}</span>
              <span class="template-card-name">${tmpl.name}</span>
            </div>
            <span class="template-card-badge badge ${isSelected ? 'badge-cyan' : 'badge-purple'}">${tmpl.badge}</span>
          </div>

          <!-- Large High-Definition Typography Preview Box -->
          <div class="template-card-preview-box" style="background: ${tmpl.previewBg};">
            <span class="template-preview-normal" style="
              color: ${c.textColor || '#FFFFFF'};
              font-family: ${this.getFontFamily(c.normalFontFamily)};
              -webkit-text-stroke: ${normalStroke}px ${c.normalOutlineColor || '#000000'};
              paint-order: stroke fill;
              -webkit-paint-order: stroke fill;
              text-shadow: 0 2px 6px rgba(0,0,0,0.85);
            ">${sampleNormal}</span>
            <span class="template-preview-prominent" style="
              color: ${c.prominentColor || '#FFE600'};
              font-family: ${this.getFontFamily(c.prominentFontFamily)};
              -webkit-text-stroke: ${prominentStroke}px ${c.prominentOutlineColor || '#000000'};
              paint-order: stroke fill;
              -webkit-paint-order: stroke fill;
              text-shadow: 0 0 16px ${c.prominentColor}aa, 0 2px 6px rgba(0,0,0,0.95);
            ">${sampleProminent}</span>
          </div>

          <p class="template-card-scope">${tmpl.scope}</p>

          <div class="template-card-actions">
            ${isSelected ? `
              <span class="template-active-indicator">
                <span class="dot"></span> ACTIVE ON VIDEO
              </span>
            ` : `
              <span style="font-size: 0.74rem; color: var(--text-muted);">Click to apply</span>
            `}
            <button type="button" class="btn-card-customize" data-customize-id="${tmpl.id}">
              <span>⚙️ Customize</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Update bottom action bar info
    const activeTmpl = CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId) || CAPTION_TEMPLATES[0];
    const nameEl = this.container.querySelector('#gallery-selected-name');
    if (nameEl) nameEl.textContent = `Active: ${activeTmpl.name}`;
  }

  getFontFamily(fontId) {
    const f = FONTS.find(item => item.id === fontId);
    return f ? f.family : "'Inter', sans-serif";
  }

  selectTemplate(templateId) {
    const tmpl = CAPTION_TEMPLATES.find(t => t.id === templateId) || CAPTION_TEMPLATES[0];
    this.selectedTemplateId = tmpl.id;

    const current = this.getActiveConfig();
    const updated = {
      ...current,
      ...tmpl.config,
      position: 'middle-left', // Always show left-middle in the config page when selecting any template
      templateId: tmpl.id
    };

    this.setActiveConfig(updated);
    this.renderTemplatesGallery();
    this.populateCustomizeControls();
    this.updatePreview();
  }

  switchModalTab(tab) {
    this.activeModalTab = tab;
    const galleryView = this.container.querySelector('#view-templates-gallery');
    const customView = this.container.querySelector('#view-customize-studio');
    const tabTemplates = this.container.querySelector('#tab-nav-templates');
    const tabCustomize = this.container.querySelector('#tab-nav-customize');

    if (tab === 'templates') {
      if (galleryView) galleryView.style.display = 'flex';
      if (customView) customView.style.display = 'none';
      if (tabTemplates) tabTemplates.classList.add('active');
      if (tabCustomize) tabCustomize.classList.remove('active');
    } else {
      if (galleryView) galleryView.style.display = 'none';
      if (customView) customView.style.display = 'flex';
      if (tabTemplates) tabTemplates.classList.remove('active');
      if (tabCustomize) tabCustomize.classList.add('active');
      this.populateCustomizeControls();
    }
  }

  populateCustomizeControls() {
    const config = this.getActiveConfig();
    const activeTmpl = CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId) || CAPTION_TEMPLATES[0];

    // Header badge
    const badge = this.container.querySelector('#customizing-template-badge');
    if (badge) badge.textContent = activeTmpl.name;

    // Video Enhancement Status
    const chkEnhance = this.container.querySelector('#chk-modal-enhance-quality');
    const badgeEnhance = this.container.querySelector('#modal-enhance-badge');
    const isEnhanced = !!config.enhanceQuality;
    if (chkEnhance) chkEnhance.checked = isEnhanced;
    if (badgeEnhance) {
      badgeEnhance.textContent = isEnhanced ? 'ACTIVE (HD+)' : 'OFF';
      badgeEnhance.className = `badge ${isEnhanced ? 'badge-green' : 'badge-cyan'}`;
    }

    // Position Grid
    this.container.querySelectorAll('.pos-btn[data-pos]').forEach(btn => {
      if (btn.getAttribute('data-pos') === config.position) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
    const posName = this.container.querySelector('#selected-pos-name');
    if (posName) posName.textContent = (config.position || 'middle-left').toUpperCase();

    // Size Slider
    const sizeSlider = this.container.querySelector('#caption-size-slider');
    const sizeVal = this.container.querySelector('#caption-size-value');
    if (sizeSlider) sizeSlider.value = config.fontSize || 30;
    if (sizeVal) sizeVal.textContent = config.fontSize || 30;

    // Fonts
    this.renderFontGrid();

    // Normal Color
    const normalColor = config.textColor || '#FFFFFF';
    const badgeNormal = this.container.querySelector('#badge-normal-color');
    if (badgeNormal) badgeNormal.textContent = normalColor.toUpperCase();
    const normalInput = this.container.querySelector('#custom-normal-color-input');
    if (normalInput) normalInput.value = normalColor;
    const swatchNormal = this.container.querySelector('#preview-swatch-normal-color');
    if (swatchNormal) swatchNormal.style.background = normalColor;
    const hexNormal = this.container.querySelector('#hex-text-normal-color');
    if (hexNormal) hexNormal.textContent = normalColor.toUpperCase();

    // Normal Outline
    const normalOutWidth = config.normalOutlineWidth !== undefined ? config.normalOutlineWidth : 2;
    const normalOutSlider = this.container.querySelector('#normal-outline-slider');
    const normalOutVal = this.container.querySelector('#normal-outline-width-val');
    if (normalOutSlider) normalOutSlider.value = normalOutWidth;
    if (normalOutVal) normalOutVal.textContent = `${normalOutWidth}px`;

    const normalOutColor = config.normalOutlineColor || '#000000';
    const normalOutInput = this.container.querySelector('#custom-normal-outline-color');
    if (normalOutInput) normalOutInput.value = normalOutColor;
    const swatchNormalOut = this.container.querySelector('#preview-swatch-normal-outline');
    if (swatchNormalOut) swatchNormalOut.style.background = normalOutColor;
    const hexNormalOut = this.container.querySelector('#hex-text-normal-outline');
    if (hexNormalOut) hexNormalOut.textContent = normalOutColor.toUpperCase();

    // Prominent Color
    const prominentColor = config.prominentColor || '#FFE600';
    const badgeProminent = this.container.querySelector('#badge-prominent-color');
    if (badgeProminent) badgeProminent.textContent = prominentColor.toUpperCase();
    const prominentInput = this.container.querySelector('#custom-prominent-color-input');
    if (prominentInput) prominentInput.value = prominentColor;
    const swatchProminent = this.container.querySelector('#preview-swatch-prominent-color');
    if (swatchProminent) swatchProminent.style.background = prominentColor;
    const hexProminent = this.container.querySelector('#hex-text-prominent-color');
    if (hexProminent) hexProminent.textContent = prominentColor.toUpperCase();

    // Prominent Outline
    const prominentOutWidth = config.prominentOutlineWidth !== undefined ? config.prominentOutlineWidth : 3;
    const prominentOutSlider = this.container.querySelector('#prominent-outline-slider');
    const prominentOutVal = this.container.querySelector('#prominent-outline-width-val');
    if (prominentOutSlider) prominentOutSlider.value = prominentOutWidth;
    if (prominentOutVal) prominentOutVal.textContent = `${prominentOutWidth}px`;

    const prominentOutColor = config.prominentOutlineColor || '#000000';
    const prominentOutInput = this.container.querySelector('#custom-prominent-outline-color');
    if (prominentOutInput) prominentOutInput.value = prominentOutColor;
    const swatchProminentOut = this.container.querySelector('#preview-swatch-prominent-outline');
    if (swatchProminentOut) swatchProminentOut.style.background = prominentOutColor;
    const hexProminentOut = this.container.querySelector('#hex-text-prominent-outline');
    if (hexProminentOut) hexProminentOut.textContent = prominentOutColor.toUpperCase();

    // Last Word Accent
    const lwToggle = this.container.querySelector('#enable-last-word-toggle');
    if (lwToggle) lwToggle.checked = config.enableLastWordColor !== false;
    const lwColor = config.lastWordColor || '#FFE600';
    const lwInput = this.container.querySelector('#custom-last-word-input');
    if (lwInput) lwInput.value = lwColor;
    const swatchLw = this.container.querySelector('#preview-swatch-last-word');
    if (swatchLw) swatchLw.style.background = lwColor;
    const hexLw = this.container.querySelector('#hex-text-last-word');
    if (hexLw) hexLw.textContent = lwColor.toUpperCase();

    // Animations (22 styles)
    const animGrid = this.container.querySelector('#animation-cards-grid');
    if (animGrid) {
      animGrid.innerHTML = CAPTION_ANIMATIONS.map(a => `
        <button class="anim-card-btn ${config.animation === a.id ? 'selected' : ''}" data-anim="${a.id}">
          <div class="anim-card-name">${a.name}</div>
          <div class="anim-card-desc">${a.description}</div>
        </button>
      `).join('');

      animGrid.querySelectorAll('.anim-card-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          const animId = btn.getAttribute('data-anim');
          const animMeta = CAPTION_ANIMATIONS.find(a => a.id === animId);
          const b = this.container.querySelector('#selected-anim-name');
          if (b && animMeta) b.textContent = `▶ ${animMeta.name}`;
          this.triggerPreviewAnimation(animId);
        });

        btn.addEventListener('mouseleave', () => {
          const cur = this.getActiveConfig();
          const animMeta = CAPTION_ANIMATIONS.find(a => a.id === cur.animation);
          const b = this.container.querySelector('#selected-anim-name');
          if (b && animMeta) b.textContent = animMeta.name;
          this.triggerPreviewAnimation(cur.animation);
        });
      });
    }

    const curAnim = CAPTION_ANIMATIONS.find(a => a.id === config.animation);
    const badgeAnim = this.container.querySelector('#selected-anim-name');
    if (badgeAnim && curAnim) badgeAnim.textContent = curAnim.name;

    this.renderIntervalsList();
  }

  renderFontGrid() {
    const config = this.getActiveConfig();
    const fontGrid = this.container?.querySelector('#font-picker-grid');
    if (!fontGrid) return;

    const isNormalTarget = this.activeFontTarget === 'normal';
    const activeFontId = isNormalTarget
      ? (config.normalFontFamily || config.fontFamily || 'Inter')
      : (config.prominentFontFamily || 'Syne');

    fontGrid.innerHTML = FONTS.map(f => `
      <button class="font-option-btn ${activeFontId === f.id ? 'selected' : ''}" data-font="${f.id}" style="font-family: ${f.family}">
        ${f.name.split(' (')[0]}
      </button>
    `).join('');

    const normalBadge = this.container.querySelector('#selected-normal-font-name');
    if (normalBadge) {
      const fObj = FONTS.find(f => f.id === (config.normalFontFamily || config.fontFamily)) || FONTS[8];
      normalBadge.textContent = `Normal: ${fObj.name.split(' (')[0]}`;
    }

    const prominentBadge = this.container.querySelector('#selected-prominent-font-name');
    if (prominentBadge) {
      const fObj = FONTS.find(f => f.id === (config.prominentFontFamily || 'Syne')) || FONTS[0];
      prominentBadge.textContent = `Prominent: ${fObj.name.split(' (')[0]}`;
    }
  }

  renderIntervalsList() {
    const config = this.getActiveConfig();
    const container = this.container.querySelector('#interval-list-container');
    if (!container) return;

    container.innerHTML = (config.timeIntervalColors || []).map((interval, idx) => `
      <div class="interval-item-row">
        <span class="interval-range-label">${interval.label || `${interval.start}s - ${interval.end}s`}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="color" value="${interval.color}" class="interval-color-picker" data-idx="${idx}" style="width:24px;height:24px;border:none;background:none;cursor:pointer;">
          <button class="btn-del-interval" data-idx="${idx}" style="color: var(--red-error); font-size: 0.9rem;">✕</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.interval-color-picker').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(input.getAttribute('data-idx'));
        config.timeIntervalColors[idx].color = e.target.value;
        this.setActiveConfig({ timeIntervalColors: config.timeIntervalColors });
      });
    });

    container.querySelectorAll('.btn-del-interval').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        config.timeIntervalColors.splice(idx, 1);
        this.setActiveConfig({ timeIntervalColors: config.timeIntervalColors });
        this.renderIntervalsList();
      });
    });
  }

  bindEvents() {
    // Orientation switcher (Landscape vs Portrait)
    this.container.querySelectorAll('.orient-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFx.playKeyBeep(520);
        const mode = btn.getAttribute('data-mode');
        this.setOrientation(mode);
      });
    });

    // Top View Navigation Tabs (Templates vs Customize)
    this.container.querySelector('#tab-nav-templates')?.addEventListener('click', () => {
      soundFx.playKeyBeep(500);
      this.switchModalTab('templates');
    });

    this.container.querySelector('#tab-nav-customize')?.addEventListener('click', () => {
      soundFx.playKeyBeep(550);
      this.switchModalTab('customize');
    });

    this.container.querySelector('#btn-gallery-customize')?.addEventListener('click', () => {
      soundFx.playKeyBeep(600);
      this.switchModalTab('customize');
    });

    this.container.querySelector('#btn-back-to-templates')?.addEventListener('click', () => {
      soundFx.playKeyBeep(450);
      this.switchModalTab('templates');
    });

    // Category Filter Pills
    this.container.querySelector('#template-category-pills')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.template-cat-pill');
      if (!pill) return;
      soundFx.playKeyBeep(600);
      this.container.querySelectorAll('.template-cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      this.templateFilterCategory = pill.getAttribute('data-cat');
      this.renderTemplatesGallery();
    });

    // Reset current template to preset defaults
    this.container.querySelector('#btn-reset-template-preset')?.addEventListener('click', () => {
      soundFx.playKeyBeep(400);
      const tmpl = CAPTION_TEMPLATES.find(t => t.id === this.selectedTemplateId) || CAPTION_TEMPLATES[0];
      this.setActiveConfig({ ...tmpl.config });
      this.populateCustomizeControls();
      this.updatePreview();
    });

    // Font target tabs (Normal Text Font vs Prominent Words Font)
    this.container.querySelector('#tab-font-normal')?.addEventListener('click', () => {
      soundFx.playKeyBeep(550);
      this.activeFontTarget = 'normal';
      this.container.querySelector('#tab-font-normal').classList.add('active');
      this.container.querySelector('#tab-font-prominent').classList.remove('active');
      this.renderFontGrid();
    });

    this.container.querySelector('#tab-font-prominent')?.addEventListener('click', () => {
      soundFx.playKeyBeep(550);
      this.activeFontTarget = 'prominent';
      this.container.querySelector('#tab-font-prominent').classList.add('active');
      this.container.querySelector('#tab-font-normal').classList.remove('active');
      this.renderFontGrid();
    });

    // Video Enhancement Checkbox Toggle in Modal
    this.container.querySelector('#chk-modal-enhance-quality')?.addEventListener('change', (e) => {
      const isEnhanced = e.target.checked;
      soundFx.playKeyBeep(isEnhanced ? 680 : 380);
      this.setActiveConfig({ enhanceQuality: isEnhanced, enhanceVideoQuality: isEnhanced });
      this.populateCustomizeControls();
      this.updatePreview();
    });

    // Global Click Listener
    this.container.addEventListener('click', (e) => {
      // Template Card Click (Selection)
      const card = e.target.closest('.template-card');
      const custBtn = e.target.closest('.btn-card-customize');

      if (custBtn) {
        e.stopPropagation();
        soundFx.playKeyBeep(650);
        const tmplId = custBtn.getAttribute('data-customize-id');
        this.selectTemplate(tmplId);
        this.switchModalTab('customize');
        return;
      }

      if (card) {
        soundFx.playKeyBeep(620);
        const tmplId = card.getAttribute('data-template-id');
        this.selectTemplate(tmplId);
        return;
      }

      // Font selection
      const fontBtn = e.target.closest('.font-option-btn');
      if (fontBtn) {
        soundFx.playKeyBeep(600);
        const fontId = fontBtn.getAttribute('data-font');
        if (this.activeFontTarget === 'normal') {
          this.setActiveConfig({ normalFontFamily: fontId, fontFamily: fontId });
        } else {
          this.setActiveConfig({ prominentFontFamily: fontId });
        }
        this.renderFontGrid();
        this.updatePreview();
        return;
      }

      // Position selection
      const posBtn = e.target.closest('.pos-btn[data-pos]');
      if (posBtn) {
        soundFx.playKeyBeep(620);
        const posId = posBtn.getAttribute('data-pos');
        this.container.querySelectorAll('.pos-btn[data-pos]').forEach(b => b.classList.remove('selected'));
        posBtn.classList.add('selected');
        const b = this.container.querySelector('#selected-pos-name');
        if (b) b.textContent = posId.toUpperCase();
        this.setActiveConfig({ position: posId });
        return;
      }

      // Normal Color Swatches
      const normalSwatch = e.target.closest('.normal-color-swatch-btn');
      if (normalSwatch) {
        soundFx.playKeyBeep(650);
        const color = normalSwatch.getAttribute('data-color');
        this.container.querySelectorAll('.normal-color-swatch-btn').forEach(b => b.classList.remove('selected'));
        normalSwatch.classList.add('selected');
        const b = this.container.querySelector('#badge-normal-color');
        if (b) b.textContent = color;
        this.setActiveConfig({ textColor: color });
        return;
      }

      // Prominent Color Swatches
      const prominentSwatch = e.target.closest('.prominent-color-swatch-btn');
      if (prominentSwatch) {
        soundFx.playKeyBeep(660);
        const color = prominentSwatch.getAttribute('data-color');
        this.container.querySelectorAll('.prominent-color-swatch-btn').forEach(b => b.classList.remove('selected'));
        prominentSwatch.classList.add('selected');
        const b = this.container.querySelector('#badge-prominent-color');
        if (b) b.textContent = color;
        this.setActiveConfig({ prominentColor: color });
        return;
      }

      // Outline Stroke color buttons
      const outlineBtn = e.target.closest('.outline-color-btn');
      if (outlineBtn) {
        soundFx.playKeyBeep(640);
        const target = outlineBtn.getAttribute('data-target');
        const color = outlineBtn.getAttribute('data-color');
        this.container.querySelectorAll(`.outline-color-btn[data-target="${target}"]`).forEach(b => b.classList.remove('active'));
        outlineBtn.classList.add('active');

        if (target === 'normal') {
          this.setActiveConfig({ normalOutlineColor: color, outlineColor: color });
        } else {
          this.setActiveConfig({ prominentOutlineColor: color });
        }
        return;
      }

      // Last Word Swatches
      const lwSwatch = e.target.closest('.last-word-swatch-btn');
      if (lwSwatch) {
        soundFx.playKeyBeep(670);
        const color = lwSwatch.getAttribute('data-color');
        this.container.querySelectorAll('.last-word-swatch-btn').forEach(b => b.classList.remove('selected'));
        lwSwatch.classList.add('selected');
        this.setActiveConfig({ lastWordColor: color });
        return;
      }

      // Animation selection
      const animBtn = e.target.closest('.anim-card-btn');
      if (animBtn) {
        soundFx.playKeyBeep(700);
        const animId = animBtn.getAttribute('data-anim');
        this.container.querySelectorAll('.anim-card-btn').forEach(b => b.classList.remove('selected'));
        animBtn.classList.add('selected');
        const animMeta = CAPTION_ANIMATIONS.find(a => a.id === animId);
        const b = this.container.querySelector('#selected-anim-name');
        if (b && animMeta) b.textContent = animMeta.name;
        this.setActiveConfig({ animation: animId });
        return;
      }
    });

    // Custom Color Pickers
    this.container.querySelector('#custom-normal-color-input')?.addEventListener('input', (e) => {
      const color = e.target.value;
      const b = this.container.querySelector('#badge-normal-color');
      if (b) b.textContent = color.toUpperCase();
      const sw = this.container.querySelector('#preview-swatch-normal-color');
      if (sw) sw.style.background = color;
      const hx = this.container.querySelector('#hex-text-normal-color');
      if (hx) hx.textContent = color.toUpperCase();
      this.setActiveConfig({ textColor: color });
    });

    this.container.querySelector('#custom-prominent-color-input')?.addEventListener('input', (e) => {
      const color = e.target.value;
      const b = this.container.querySelector('#badge-prominent-color');
      if (b) b.textContent = color.toUpperCase();
      const sw = this.container.querySelector('#preview-swatch-prominent-color');
      if (sw) sw.style.background = color;
      const hx = this.container.querySelector('#hex-text-prominent-color');
      if (hx) hx.textContent = color.toUpperCase();
      this.setActiveConfig({ prominentColor: color });
    });

    this.container.querySelector('#custom-normal-outline-color')?.addEventListener('input', (e) => {
      const color = e.target.value;
      const sw = this.container.querySelector('#preview-swatch-normal-outline');
      if (sw) sw.style.background = color;
      const hx = this.container.querySelector('#hex-text-normal-outline');
      if (hx) hx.textContent = color.toUpperCase();
      this.setActiveConfig({ normalOutlineColor: color, outlineColor: color });
    });

    this.container.querySelector('#custom-prominent-outline-color')?.addEventListener('input', (e) => {
      const color = e.target.value;
      const sw = this.container.querySelector('#preview-swatch-prominent-outline');
      if (sw) sw.style.background = color;
      const hx = this.container.querySelector('#hex-text-prominent-outline');
      if (hx) hx.textContent = color.toUpperCase();
      this.setActiveConfig({ prominentOutlineColor: color });
    });

    // Outline Width Sliders
    this.container.querySelector('#normal-outline-slider')?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      this.container.querySelector('#normal-outline-width-val').textContent = `${val}px`;
      this.setActiveConfig({ normalOutlineWidth: val, outlineWidth: val });
    });

    this.container.querySelector('#prominent-outline-slider')?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      this.container.querySelector('#prominent-outline-width-val').textContent = `${val}px`;
      this.setActiveConfig({ prominentOutlineWidth: val });
    });

    // Caption Size Slider
    this.container.querySelector('#caption-size-slider')?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      this.container.querySelector('#caption-size-value').textContent = val;
      this.setActiveConfig({ fontSize: val });
    });

    // Last Word Accent Toggle & Picker
    this.container.querySelector('#enable-last-word-toggle')?.addEventListener('change', (e) => {
      this.setActiveConfig({ enableLastWordColor: e.target.checked });
    });

    this.container.querySelector('#custom-last-word-input')?.addEventListener('input', (e) => {
      const color = e.target.value;
      const sw = this.container.querySelector('#preview-swatch-last-word');
      if (sw) sw.style.background = color;
      const hx = this.container.querySelector('#hex-text-last-word');
      if (hx) hx.textContent = color.toUpperCase();
      this.setActiveConfig({ lastWordColor: color });
    });

    // Add Interval button
    this.container.querySelector('#btn-add-interval')?.addEventListener('click', () => {
      soundFx.playKeyBeep(580);
      const config = this.getActiveConfig();
      const nextStart = config.timeIntervalColors.length > 0 
        ? config.timeIntervalColors[config.timeIntervalColors.length - 1].end
        : 0;
      const nextEnd = nextStart + 20;

      config.timeIntervalColors.push({
        start: nextStart,
        end: nextEnd,
        color: '#FF4DA6',
        label: `${nextStart}s - ${nextEnd}s`
      });

      this.setActiveConfig({ timeIntervalColors: config.timeIntervalColors });
      this.renderIntervalsList();
    });

    // Preview Step buttons
    this.container.querySelector('#btn-prev-phrase')?.addEventListener('click', () => {
      soundFx.playKeyBeep(520);
      this.phraseIdx = (this.phraseIdx - 1 + this.previewPhrases.length) % this.previewPhrases.length;
      this.updatePreview();
      const pNum = this.container.querySelector('#preview-phrase-num');
      if (pNum) pNum.textContent = `Sample ${this.phraseIdx + 1}/${this.previewPhrases.length}`;
    });

    this.container.querySelector('#btn-next-phrase')?.addEventListener('click', () => {
      soundFx.playKeyBeep(520);
      this.phraseIdx = (this.phraseIdx + 1) % this.previewPhrases.length;
      this.updatePreview();
      const pNum = this.container.querySelector('#preview-phrase-num');
      if (pNum) pNum.textContent = `Sample ${this.phraseIdx + 1}/${this.previewPhrases.length}`;
    });

    // Reset Defaults
    this.container.querySelector('#btn-reset-defaults')?.addEventListener('click', () => {
      soundFx.playKeyBeep(350);
      if (this.currentMode === 'landscape') {
        this.landscapeConfig = { ...DEFAULT_LANDSCAPE_CONFIG };
      } else {
        this.portraitConfig = { ...DEFAULT_PORTRAIT_CONFIG };
      }
      this.selectedTemplateId = 'september-pop';
      this.populateControls();
      this.setActiveConfig(this.getActiveConfig());
    });

    // Close & Apply Buttons
    this.container.querySelector('#btn-close-tool-modal')?.addEventListener('click', () => this.close());
    this.container.querySelector('#btn-apply-tool-modal')?.addEventListener('click', () => this.close());
  }

  updatePreview() {
    const config = this.getActiveConfig();
    const anchor = this.container.querySelector('#preview-caption-anchor') || this.container.querySelector('#preview-caption-text');
    if (!anchor) return;

    // Apply Mode Title and Profile Badge
    const titleSpan = this.container.querySelector('#preview-col-mode-title');
    if (titleSpan) titleSpan.textContent = `LIVE PREVIEW (${this.currentMode.toUpperCase()})`;
    const profileBadge = this.container.querySelector('#preview-profile-badge');
    if (profileBadge) profileBadge.textContent = this.currentMode === 'landscape' ? '16:9 Landscape' : '9:16 Portrait';

    // Toggle video-enhanced on preview mockup
    const previewBox = this.container.querySelector('#preview-screen-box');
    if (previewBox) {
      previewBox.classList.toggle('video-enhanced', !!config.enhanceQuality);
    }

    // Position preview anchor based on user selected position
    const positionId = config.position || 'middle-left';
    const pos = CAPTION_POSITIONS.find(p => p.id === positionId) || CAPTION_POSITIONS[3];
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    let posX = pos.x;
    let posY = pos.y;
    let transformStr = pos.transform;

    // On mobile viewports, apply safe margins so captions don't touch or clip preview boundaries
    if (isMobile) {
      if (pos.id.includes('top')) posY = '18%';
      else if (pos.id.includes('bottom')) posY = '80%';
      if (pos.id.includes('left')) posX = '8%';
      else if (pos.id.includes('right')) posX = '92%';
    }

    anchor.style.top = posY;
    anchor.style.left = posX;
    anchor.style.transform = transformStr;
    anchor.style.textAlign = pos.align;
    anchor.style.webkitTextStroke = 'none';
    anchor.style.textShadow = 'none';

    // Render phrase with dual normal & prominent styling
    this.renderPreviewPhrase(this.previewPhrases[this.phraseIdx]);

    // Trigger Live Animation on the inner animation wrapper (so anchor transform is preserved)
    this.triggerPreviewAnimation(config.animation);
  }

  renderPreviewPhrase(phrase) {
    const flowContainer = this.container?.querySelector('#preview-caption-flow');
    const legacyTarget = this.container?.querySelector('#preview-caption-text');
    if (!flowContainer && !legacyTarget) return;

    const config = this.getActiveConfig();
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const isPortrait = this.currentMode === 'portrait';

    // Proportional preview scaling factor based on orientation and mobile view
    let scaleMultiplier = 0.88;
    if (isPortrait) {
      scaleMultiplier = isMobile ? 0.44 : 0.60;
    } else if (isMobile) {
      scaleMultiplier = 0.64;
    }

    const rawFontSize = config.fontSize || 30;
    let baseFontSize = Math.max(12, Math.round(rawFontSize * scaleMultiplier));
    if (isMobile) {
      baseFontSize = Math.min(baseFontSize, isPortrait ? 16 : 22);
    }

    // Analyze phrase using dual word-importance logic & config
    const analysis = autoTypographyEngine.analyzeSentence({ text: phrase }, false, config);
    const positionId = config.position || 'middle-left';
    const pos = CAPTION_POSITIONS.find(p => p.id === positionId) || CAPTION_POSITIONS[3];
    const justifyAlign = pos.align === 'left' ? 'flex-start' : (pos.align === 'right' ? 'flex-end' : 'center');

    const wordsHtml = analysis.words.map((w) => {
      const fontSizePx = Math.max(10, Math.round(baseFontSize * (w.fontSizeMultiplier || 1.0)));
      return `
        <span class="caption-word-token ${w.isProminent ? 'prominent-word' : 'normal-word'}" style="
          color: ${w.color};
          font-family: ${w.fontFamily};
          font-size: ${fontSizePx}px;
          font-style: ${w.fontStyle};
          font-weight: ${w.fontWeight};
          letter-spacing: ${w.letterSpacing};
          text-shadow: ${w.shadow};
          -webkit-text-stroke: ${w.stroke};
          paint-order: stroke fill;
          display: inline-block;
          margin: 0 2px;
          word-break: break-word;
          line-height: 1.15;
        ">
          ${w.word}
        </span>
      `;
    }).join(' ');

    if (flowContainer) {
      flowContainer.style.justifyContent = justifyAlign;
      flowContainer.style.textAlign = pos.align;
      flowContainer.innerHTML = wordsHtml;
    } else if (legacyTarget) {
      legacyTarget.innerHTML = `
        <div class="preview-caption-flow" style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 6px; line-height: 1.15; justify-content: ${justifyAlign}; text-align: ${pos.align};">
          ${wordsHtml}
        </div>
      `;
    }
  }

  triggerPreviewAnimation(animOverride = null) {
    const animTarget = this.container?.querySelector('#preview-caption-anim-wrapper') || this.container?.querySelector('#preview-caption-text');
    if (!animTarget) return;

    const config = this.getActiveConfig();
    const activeAnimId = animOverride || config.animation || 'anim-pop';
    const animMeta = CAPTION_ANIMATIONS.find(a => a.id === activeAnimId);
    const cssClass = animMeta ? animMeta.cssClass : 'anim-pop';

    CAPTION_ANIMATIONS.forEach(a => animTarget.classList.remove(a.cssClass));
    void animTarget.offsetWidth;
    animTarget.classList.add(cssClass);
  }

  startAnimationLoop() {
    this.stopAnimationLoop();
    this.animLoopTimer = setInterval(() => {
      if (!this.isOpen) return;
      const anchor = this.container?.querySelector('#preview-caption-anchor') || this.container?.querySelector('#preview-caption-text');
      if (!anchor) return;

      this.phraseIdx = (this.phraseIdx + 1) % this.previewPhrases.length;
      this.renderPreviewPhrase(this.previewPhrases[this.phraseIdx]);
      this.triggerPreviewAnimation();
      const pNum = this.container.querySelector('#preview-phrase-num');
      if (pNum) pNum.textContent = `Sample ${this.phraseIdx + 1}/${this.previewPhrases.length}`;
    }, 2400);
  }

  stopAnimationLoop() {
    if (this.animLoopTimer) {
      clearInterval(this.animLoopTimer);
      this.animLoopTimer = null;
    }
  }

  open(orientationMode = 'landscape') {
    if (this.isOpen) return;
    this.isOpen = true;

    soundFx.playToolWhoosh();
    this.introAnimElement.classList.add('animating');

    setTimeout(() => {
      this.introAnimElement.classList.remove('animating');
      this.container.classList.add('active');
      this.setOrientation(orientationMode || this.currentMode);
      this.startAnimationLoop();
    }, 450);
  }

  close() {
    soundFx.playKeyBeep(450);
    this.stopAnimationLoop();
    this.container.classList.remove('active');
    this.isOpen = false;
  }
}
