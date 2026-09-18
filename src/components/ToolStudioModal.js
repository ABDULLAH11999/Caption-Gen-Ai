// Screen 3: Tool Style Studio Modal with Center Holographic Tool Animation
import { 
  FONTS, 
  CAPTION_POSITIONS, 
  CAPTION_ANIMATIONS, 
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
  }

  async initConfigs() {
    const v3Migrated = await storage.getSetting('config_defaults_v3');
    if (!v3Migrated) {
      // Set new system defaults: Auto AI Mode, Playfair Display, Middle-Left safe zone
      this.landscapeConfig = { ...DEFAULT_LANDSCAPE_CONFIG };
      this.portraitConfig = { ...DEFAULT_PORTRAIT_CONFIG };
      await storage.saveSetting('config_landscape', this.landscapeConfig);
      await storage.saveSetting('config_portrait', this.portraitConfig);
      await storage.saveSetting('config_defaults_v3', true);
    } else {
      const savedLandscape = await storage.getSetting('config_landscape');
      const savedPortrait = await storage.getSetting('config_portrait');
      if (savedLandscape) this.landscapeConfig = { ...this.landscapeConfig, ...savedLandscape };
      if (savedPortrait) this.portraitConfig = { ...this.portraitConfig, ...savedPortrait };
    }

    if (!this.landscapeConfig.styleMode) this.landscapeConfig.styleMode = 'auto';
    if (!this.portraitConfig.styleMode) this.portraitConfig.styleMode = 'auto';
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

    const curConfig = this.getActiveConfig();
    const isAuto = curConfig.styleMode !== 'custom';

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
              <p>VIRAL REELS AUTO TYPOGRAPHY & GRANULAR STUDIO CONTROLS</p>
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
          <!-- Left Column: Controls -->
          <div class="tool-config-column">

            <!-- Style Engine Mode Switcher Card -->
            <div class="config-mode-card">
              <div class="config-mode-header">
                <div>
                  <span class="config-mode-title">ENGINE MODE</span>
                  <p class="config-mode-desc">Auto AI analyzes each sentence dynamically; Custom lets you control every pixel.</p>
                </div>
                <span class="badge ${isAuto ? 'badge-cyan' : 'badge-purple'}" id="badge-active-mode">${isAuto ? 'AUTO AI' : 'CUSTOM'}</span>
              </div>
              <div class="style-mode-switcher-pills">
                <button type="button" class="style-mode-btn ${isAuto ? 'active' : ''}" id="btn-mode-auto" data-mode="auto">
                  <span class="mode-icon">⚡</span>
                  <div class="mode-text-wrap">
                    <strong class="mode-text-title">Auto AI Mode</strong>
                    <span class="mode-text-sub">Viral Reels & TikTok typography (Middle-Left)</span>
                  </div>
                </button>
                <button type="button" class="style-mode-btn ${!isAuto ? 'active' : ''}" id="btn-mode-custom" data-mode="custom">
                  <span class="mode-icon">⚙️</span>
                  <div class="mode-text-wrap">
                    <strong class="mode-text-title">Custom Studio</strong>
                    <span class="mode-text-sub">Manual font, colors, position & animations</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Auto AI Mode Info Showcase Card (Visible in Auto Mode) -->
            <div class="auto-mode-info-card" id="auto-mode-info-card" style="display: ${isAuto ? 'flex' : 'none'};">
              <div class="auto-info-header">
                <div class="auto-ai-chip">
                  <span class="pulse-dot">●</span> AUTO SMART TYPOGRAPHY ACTIVE
                </div>
                <div class="auto-pos-badge">📍 Locked to Middle-Left Safe Zone</div>
              </div>
              
              <div class="auto-feature-grid">
                <div class="auto-feature-item">
                  <div class="feature-icon">✨</div>
                  <div class="feature-content">
                    <strong>Dynamic Hierarchy</strong>
                    <p>Subtle connector words ("this is", "for") paired with massive punchy display keywords for maximum viral retention.</p>
                  </div>
                </div>
                <div class="auto-feature-item">
                  <div class="feature-icon">🔍</div>
                  <div class="feature-content">
                    <strong>Deep Entity Recognition</strong>
                    <p>Names (e.g. Emily), Months/Dates (e.g. September), Places (e.g. California) and Key Items get auto-accented.</p>
                  </div>
                </div>
              </div>

              <div class="auto-examples-preview">
                <div class="auto-example-label">LIVE REEL EXAMPLES:</div>
                <div class="auto-example-chips">
                  <div class="example-chip chip-emily">
                    <span class="chip-p">this is</span>
                    <span class="chip-h">Emily</span>
                    <span class="chip-tag">Luxury Serif</span>
                  </div>
                  <div class="example-chip chip-september">
                    <span class="chip-p">for</span>
                    <span class="chip-h">September</span>
                    <span class="chip-tag">Neon Pink</span>
                  </div>
                  <div class="example-chip chip-california">
                    <span class="chip-p">welcome to</span>
                    <span class="chip-h">California</span>
                    <span class="chip-tag">Cyan Glow</span>
                  </div>
                </div>
              </div>
              <div class="auto-switch-hint">
                💡 Need manual fonts or 9-point positions? Click <strong>Custom Studio</strong> above to unlock manual sliders and pickers.
              </div>
            </div>
            
            <!-- Custom Sections Wrapper (Hidden in Auto Mode) -->
            <div id="custom-sections-wrapper" class="custom-sections-wrapper" style="display: ${!isAuto ? 'flex' : 'none'}; flex-direction: column; gap: 22px;">

              <!-- 1. Font Family -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>1. Caption Font</span>
                  <span class="badge badge-cyan" id="selected-font-name">Playfair Display</span>
                </div>
                <div class="font-picker-grid" id="font-picker-grid"></div>
              </div>

              <!-- 2. Caption Size (1 - 100, default 30) -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>2. Caption Size (Scale 1 - 100)</span>
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

              <!-- 3. Caption Position (9 Options) -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>3. Caption Position (9 Locations)</span>
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

              <!-- 4. Text & Outline Colors + Time Intervals -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>4. Colors & Time-Interval Coloring</span>
                </div>
                
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">Base Font Color Palette:</div>
                <div class="color-swatches-row" id="color-palette-row">
                  <button class="color-swatch-btn" data-color="#FFFFFF" style="background: #FFFFFF;"></button>
                  <button class="color-swatch-btn" data-color="#FFE600" style="background: #FFE600;"></button>
                  <button class="color-swatch-btn" data-color="#00F0FF" style="background: #00F0FF;"></button>
                  <button class="color-swatch-btn" data-color="#FF4DA6" style="background: #FF4DA6;"></button>
                  <button class="color-swatch-btn" data-color="#10B981" style="background: #10B981;"></button>
                  <button class="color-swatch-btn" data-color="#FF6B00" style="background: #FF6B00;"></button>
                  <input type="color" id="custom-color-input" class="color-input-native" value="#FFFFFF" title="Choose Custom Color">
                </div>

                <!-- Black Outline Setting -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; margin-bottom: 8px;">
                  <span style="font-size: 0.82rem; font-weight: 600;">Default Outline Color:</span>
                  <span class="badge badge-cyan" id="outline-color-badge">Black (#000000)</span>
                </div>
                <div class="slider-control-group">
                  <div class="slider-label-row">
                    <span>Outline Stroke Width</span>
                    <span id="outline-width-val">1px</span>
                  </div>
                  <input type="range" min="0" max="14" value="1" class="custom-range-slider" id="outline-width-slider">
                </div>

                <!-- Time-Interval Coloring Section -->
                <div style="margin-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 0.82rem; font-weight: 700; color: var(--yellow-accent);">Time Interval Colors:</span>
                    <button id="btn-add-interval" style="font-size: 0.76rem; padding: 4px 10px; background: rgba(255,230,0,0.15); color: var(--yellow-accent); border: 1px solid var(--yellow-accent); border-radius: var(--radius-full);">
                      + Add Interval
                    </button>
                  </div>
                  <div class="interval-list-container" id="interval-list-container"></div>
                </div>

                <!-- Last Word Accent Color Section -->
                <div style="margin-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 0.82rem; font-weight: 700; color: var(--cyan-primary);">Last Word of Line Color:</span>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer; color: var(--text-main);">
                      <input type="checkbox" id="enable-last-word-toggle" style="accent-color: var(--cyan-primary); cursor: pointer;">
                      <span>Highlight Last Word</span>
                    </label>
                  </div>
                  <div class="color-swatches-row" id="last-word-palette-row">
                    <button class="last-word-swatch-btn" data-color="#FF4DA6" style="background: #FF4DA6;"></button>
                    <button class="last-word-swatch-btn" data-color="#00F0FF" style="background: #00F0FF;"></button>
                    <button class="last-word-swatch-btn" data-color="#FFE600" style="background: #FFE600;"></button>
                    <button class="last-word-swatch-btn" data-color="#10B981" style="background: #10B981;"></button>
                    <button class="last-word-swatch-btn" data-color="#FF6B00" style="background: #FF6B00;"></button>
                    <button class="last-word-swatch-btn" data-color="#FFFFFF" style="background: #FFFFFF;"></button>
                    <input type="color" id="custom-last-word-input" class="color-input-native" value="#FF4DA6" title="Choose Custom Last Word Color">
                  </div>
                </div>

              </div>

              <!-- 5. Caption Animation (15+ Styles) -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>5. Caption Animation (15 Styles)</span>
                  <span class="badge badge-purple" id="selected-anim-name">Smooth Fade</span>
                </div>
                <p style="font-size: 0.78rem; color: var(--text-muted); margin: -4px 0 14px 0; line-height: 1.4;">
                  Hover or click any animation style to watch it play live in the preview screen right beside.
                </p>
                <div class="animation-cards-grid" id="animation-cards-grid"></div>
              </div>

            </div>

          </div>

          <!-- Right Column: Live Synchronized Preview (Sticky) -->
          <div class="tool-preview-column">
            <div class="config-section-title">
              <span id="preview-col-mode-title">LIVE PREVIEW (${this.currentMode.toUpperCase()})</span>
              <span class="badge badge-green anim-live-indicator">● LIVE ANIMATION</span>
            </div>

            <div class="preview-screen-box preview-${this.currentMode}" id="preview-screen-box">
              <div class="preview-caption-text" id="preview-caption-text">
                this is Emily
              </div>
            </div>

            <div style="background: rgba(9, 13, 22, 0.7); padding: 14px; border-radius: var(--radius-md); font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; border: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 4px;">
                <strong style="color: var(--cyan-primary);">Active Profile:</strong>
                <span class="badge badge-cyan" id="preview-profile-badge">${this.currentMode === 'landscape' ? '16:9 Landscape' : '9:16 Portrait'}</span>
              </div>
              Captions render inside safe video margins. Changes are applied live to your studio video.
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="tool-modal-footer">
          <button class="btn-reset-defaults" id="btn-reset-defaults">Reset To Defaults</button>
          <button class="btn-apply-settings" id="btn-apply-tool-modal">APPLY & RETURN TO STUDIO</button>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.bindEvents();
    this.populateControls();
  }

  populateControls() {
    const config = this.getActiveConfig();
    const isAuto = config.styleMode !== 'custom';

    // 0. Update Engine Mode Buttons & Sections visibility
    const autoBtn = this.container.querySelector('#btn-mode-auto');
    const customBtn = this.container.querySelector('#btn-mode-custom');
    const badgeMode = this.container.querySelector('#badge-active-mode');
    const autoInfoCard = this.container.querySelector('#auto-mode-info-card');
    const customWrapper = this.container.querySelector('#custom-sections-wrapper');

    if (autoBtn && customBtn) {
      if (isAuto) {
        autoBtn.classList.add('active');
        customBtn.classList.remove('active');
        if (badgeMode) {
          badgeMode.textContent = 'AUTO AI';
          badgeMode.className = 'badge badge-cyan';
        }
        if (autoInfoCard) autoInfoCard.style.display = 'flex';
        if (customWrapper) customWrapper.style.display = 'none';
      } else {
        customBtn.classList.add('active');
        autoBtn.classList.remove('active');
        if (badgeMode) {
          badgeMode.textContent = 'CUSTOM';
          badgeMode.className = 'badge badge-purple';
        }
        if (autoInfoCard) autoInfoCard.style.display = 'none';
        if (customWrapper) customWrapper.style.display = 'flex';
      }
    }

    // 1. Populate Fonts
    const fontGrid = this.container.querySelector('#font-picker-grid');
    if (fontGrid) {
      fontGrid.innerHTML = FONTS.map(f => `
        <button class="font-option-btn ${config.fontFamily === f.id ? 'selected' : ''}" data-font="${f.id}" style="font-family: ${f.family}">
          ${f.name.split(' ')[0]}
        </button>
      `).join('');
    }
    const fontBadge = this.container.querySelector('#selected-font-name');
    if (fontBadge) {
      const activeF = FONTS.find(f => f.id === config.fontFamily) || FONTS[0];
      fontBadge.textContent = activeF.name.split(' ')[0];
    }

    // 2. Set Size Slider
    const sizeSlider = this.container.querySelector('#caption-size-slider');
    const sizeVal = this.container.querySelector('#caption-size-value');
    if (sizeSlider) sizeSlider.value = config.fontSize || 30;
    if (sizeVal) sizeVal.textContent = config.fontSize || 30;

    // 3. Set Position Grid
    this.container.querySelectorAll('.pos-btn[data-pos]').forEach(btn => {
      if (btn.getAttribute('data-pos') === config.position) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
    const posName = this.container.querySelector('#selected-pos-name');
    if (posName) posName.textContent = config.position?.toUpperCase() || 'MIDDLE LEFT';

    // 4. Set Outline Width Slider
    const outlineSlider = this.container.querySelector('#outline-width-slider');
    const outlineVal = this.container.querySelector('#outline-width-val');
    const outWidth = config.outlineWidth !== undefined ? config.outlineWidth : 1;
    if (outlineSlider) outlineSlider.value = outWidth;
    if (outlineVal) outlineVal.textContent = `${outWidth}px`;

    // 4B. Populate Last Word Accent Color
    const lwToggle = this.container.querySelector('#enable-last-word-toggle');
    if (lwToggle) lwToggle.checked = config.enableLastWordColor !== false;

    const lwInput = this.container.querySelector('#custom-last-word-input');
    if (lwInput) lwInput.value = config.lastWordColor || '#FF4DA6';

    this.container.querySelectorAll('.last-word-swatch-btn').forEach(b => {
      if (b.getAttribute('data-color') === config.lastWordColor) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });

    // 5. Populate Interval Colors
    this.renderIntervalsList();

    // 6. Populate Animations (15+ styles)
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
          const badge = this.container.querySelector('#selected-anim-name');
          if (badge && animMeta) badge.textContent = `▶ ${animMeta.name}`;
          this.triggerPreviewAnimation(animId);
        });

        btn.addEventListener('mouseleave', () => {
          const curConfig = this.getActiveConfig();
          const animMeta = CAPTION_ANIMATIONS.find(a => a.id === curConfig.animation);
          const badge = this.container.querySelector('#selected-anim-name');
          if (badge && animMeta) badge.textContent = animMeta.name;
          this.triggerPreviewAnimation(curConfig.animation);
        });
      });
    }

    const curAnim = CAPTION_ANIMATIONS.find(a => a.id === config.animation);
    const badge = this.container.querySelector('#selected-anim-name');
    if (badge && curAnim) badge.textContent = curAnim.name;

    this.updatePreview();
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

    // Interval color change
    container.querySelectorAll('.interval-color-picker').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(input.getAttribute('data-idx'));
        config.timeIntervalColors[idx].color = e.target.value;
        this.setActiveConfig({ timeIntervalColors: config.timeIntervalColors });
      });
    });

    // Delete interval
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
        this.container.querySelectorAll('.orient-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = btn.getAttribute('data-mode');

        const previewBox = this.container.querySelector('#preview-screen-box');
        if (previewBox) {
          previewBox.className = `preview-screen-box preview-${this.currentMode}`;
        }

        this.populateControls();
        this.onConfigChanged(this.getActiveConfig(), this.currentMode);
      });
    });

    // Engine Mode Toggle (Auto AI vs Custom)
    this.container.querySelectorAll('.style-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFx.playKeyBeep(650);
        const mode = btn.getAttribute('data-mode');
        this.setActiveConfig({ styleMode: mode });
        this.populateControls();
      });
    });

    // Font selection
    this.container.addEventListener('click', (e) => {
      const fontBtn = e.target.closest('.font-option-btn');
      if (fontBtn) {
        soundFx.playKeyBeep(600);
        const fontId = fontBtn.getAttribute('data-font');
        this.container.querySelectorAll('.font-option-btn').forEach(b => b.classList.remove('selected'));
        fontBtn.classList.add('selected');
        const badge = this.container.querySelector('#selected-font-name');
        if (badge) badge.textContent = fontId;
        this.setActiveConfig({ fontFamily: fontId });
      }

      // Position selection
      const posBtn = e.target.closest('.pos-btn[data-pos]');
      if (posBtn) {
        soundFx.playKeyBeep(620);
        const posId = posBtn.getAttribute('data-pos');
        this.container.querySelectorAll('.pos-btn[data-pos]').forEach(b => b.classList.remove('selected'));
        posBtn.classList.add('selected');
        const badge = this.container.querySelector('#selected-pos-name');
        if (badge) badge.textContent = posId.toUpperCase();
        this.setActiveConfig({ position: posId });
      }

      // Color swatches (Base Font)
      const swatch = e.target.closest('.color-swatch-btn');
      if (swatch) {
        soundFx.playKeyBeep(650);
        const color = swatch.getAttribute('data-color');
        this.container.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('selected'));
        swatch.classList.add('selected');
        this.setActiveConfig({ textColor: color });
      }

      // Last Word Accent Color Swatches
      const lwSwatch = e.target.closest('.last-word-swatch-btn');
      if (lwSwatch) {
        soundFx.playKeyBeep(670);
        const color = lwSwatch.getAttribute('data-color');
        this.container.querySelectorAll('.last-word-swatch-btn').forEach(b => b.classList.remove('selected'));
        lwSwatch.classList.add('selected');
        this.setActiveConfig({ lastWordColor: color });
      }

      // Animation selection
      const animBtn = e.target.closest('.anim-card-btn');
      if (animBtn) {
        soundFx.playKeyBeep(700);
        const animId = animBtn.getAttribute('data-anim');
        this.container.querySelectorAll('.anim-card-btn').forEach(b => b.classList.remove('selected'));
        animBtn.classList.add('selected');
        const animMeta = CAPTION_ANIMATIONS.find(a => a.id === animId);
        const badge = this.container.querySelector('#selected-anim-name');
        if (badge && animMeta) badge.textContent = animMeta.name;
        this.setActiveConfig({ animation: animId });
      }
    });

    // Native Color Picker (Base Font)
    this.container.querySelector('#custom-color-input')?.addEventListener('input', (e) => {
      this.setActiveConfig({ textColor: e.target.value });
    });

    // Custom Last Word Color Picker
    this.container.querySelector('#custom-last-word-input')?.addEventListener('input', (e) => {
      this.setActiveConfig({ lastWordColor: e.target.value });
    });

    // Enable/Disable Last Word Color Toggle
    this.container.querySelector('#enable-last-word-toggle')?.addEventListener('change', (e) => {
      this.setActiveConfig({ enableLastWordColor: e.target.checked });
    });

    // Caption Size Slider
    const sizeSlider = this.container.querySelector('#caption-size-slider');
    sizeSlider?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      this.container.querySelector('#caption-size-value').textContent = val;
      this.setActiveConfig({ fontSize: val });
    });

    // Outline Width Slider
    const outlineSlider = this.container.querySelector('#outline-width-slider');
    outlineSlider?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      this.container.querySelector('#outline-width-val').textContent = `${val}px`;
      this.setActiveConfig({ outlineWidth: val });
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

    // Reset Defaults
    this.container.querySelector('#btn-reset-defaults')?.addEventListener('click', () => {
      soundFx.playKeyBeep(350);
      if (this.currentMode === 'landscape') {
        this.landscapeConfig = { ...DEFAULT_LANDSCAPE_CONFIG };
      } else {
        this.portraitConfig = { ...DEFAULT_PORTRAIT_CONFIG };
      }
      this.populateControls();
      this.setActiveConfig(this.getActiveConfig());
    });

    // Close & Apply Buttons
    this.container.querySelector('#btn-close-tool-modal')?.addEventListener('click', () => this.close());
    this.container.querySelector('#btn-apply-tool-modal')?.addEventListener('click', () => this.close());
  }

  updatePreview() {
    const config = this.getActiveConfig();
    const previewText = this.container.querySelector('#preview-caption-text');
    if (!previewText) return;

    // Apply Mode Title and Profile Badge
    const titleSpan = this.container.querySelector('#preview-col-mode-title');
    if (titleSpan) titleSpan.textContent = `LIVE PREVIEW (${this.currentMode.toUpperCase()})`;
    const profileBadge = this.container.querySelector('#preview-profile-badge');
    if (profileBadge) profileBadge.textContent = this.currentMode === 'landscape' ? '16:9 Landscape' : '9:16 Portrait';

    const isAuto = config.styleMode !== 'custom';

    if (isAuto) {
      // Auto Mode: Middle-Left Position
      previewText.style.top = '50%';
      previewText.style.left = '7%';
      previewText.style.transform = 'translate(0, -50%)';
      previewText.style.textAlign = 'left';
      previewText.style.webkitTextStroke = 'none';
      previewText.style.textShadow = 'none';
      previewText.style.fontFamily = 'inherit';
    } else {
      // Custom Mode: Custom Position
      const pos = CAPTION_POSITIONS.find(p => p.id === config.position) || CAPTION_POSITIONS[1];
      previewText.style.top = pos.y;
      previewText.style.left = pos.x;
      previewText.style.transform = pos.transform;
      previewText.style.textAlign = pos.align;

      // Font & Size
      const fontMeta = FONTS.find(f => f.id === config.fontFamily) || FONTS[0];
      previewText.style.fontFamily = fontMeta.family;
      previewText.style.fontSize = `${Math.max(14, config.fontSize * 0.9)}px`;
      previewText.style.color = config.textColor || '#FFE600';

      // Outline
      const outWidth = config.outlineWidth !== undefined ? config.outlineWidth : 1;
      previewText.style.webkitTextStroke = `${outWidth}px ${config.outlineColor || '#000000'}`;
      previewText.style.textShadow = `0 4px ${config.shadowBlur || 8}px ${config.shadowColor || 'rgba(0,0,0,0.8)'}`;
    }

    // Render phrase with highlighted styling
    this.renderPreviewPhrase(this.previewPhrases[this.phraseIdx]);

    // Trigger Live Animation
    this.triggerPreviewAnimation(config.animation);
  }

  renderPreviewPhrase(phrase) {
    const previewText = this.container?.querySelector('#preview-caption-text');
    if (!previewText) return;
    const config = this.getActiveConfig();
    const isAuto = config.styleMode !== 'custom';

    if (isAuto) {
      // Auto AI Dynamic Typography
      const analysis = autoTypographyEngine.analyzeSentence({ text: phrase });
      const { theme } = analysis;

      previewText.innerHTML = `
        <div class="preview-auto-flow">
          ${analysis.prefixText ? `
            <div class="preview-auto-prefix" style="
              font-family: ${theme.prefixFontFamily};
              font-size: 15px;
              font-style: ${theme.prefixItalic ? 'italic' : 'normal'};
              font-weight: ${theme.prefixFontWeight};
              color: ${theme.prefixColor};
              text-shadow: 0 3px 10px rgba(0,0,0,0.9);
              letter-spacing: 0.5px;
              line-height: 1.2;
              margin-bottom: 2px;
            ">
              ${analysis.prefixText}
            </div>
          ` : ''}
          <div class="preview-auto-hero" style="
            font-family: ${theme.heroFontFamily};
            font-size: 34px;
            font-style: ${theme.heroItalic ? 'italic' : 'normal'};
            font-weight: ${theme.heroFontWeight};
            color: ${theme.heroColor};
            text-shadow: ${theme.heroShadow};
            letter-spacing: ${theme.heroLetterSpacing || 'normal'};
            line-height: 1.05;
          ">
            ${analysis.heroText}
          </div>
        </div>
      `;
      return;
    }

    // Custom mode manual rendering
    const words = phrase.split(' ');
    const lastWord = words.pop();
    const leadingText = words.join(' ');
    const lastWordColor = (config.enableLastWordColor !== false && config.lastWordColor)
      ? config.lastWordColor
      : (config.textColor || '#FFE600');

    previewText.innerHTML = `
      <span style="color: ${config.textColor || '#FFE600'};">${leadingText} </span><span style="color: ${lastWordColor}; font-weight: 900;">${lastWord}</span>
    `;
  }

  triggerPreviewAnimation(animOverride = null) {
    const previewText = this.container?.querySelector('#preview-caption-text');
    if (!previewText) return;

    const config = this.getActiveConfig();
    const activeAnimId = animOverride || config.animation || 'anim-blur';
    const animMeta = CAPTION_ANIMATIONS.find(a => a.id === activeAnimId);
    const cssClass = animMeta ? animMeta.cssClass : 'anim-blur';

    // Remove all animation classes
    CAPTION_ANIMATIONS.forEach(a => previewText.classList.remove(a.cssClass));

    // Force DOM reflow to restart CSS keyframe cleanly
    void previewText.offsetWidth;

    // Add selected animation class
    previewText.classList.add(cssClass);
  }

  startAnimationLoop() {
    this.stopAnimationLoop();
    this.animLoopTimer = setInterval(() => {
      if (!this.isOpen) return;
      const previewText = this.container?.querySelector('#preview-caption-text');
      if (!previewText) return;

      this.phraseIdx = (this.phraseIdx + 1) % this.previewPhrases.length;
      this.renderPreviewPhrase(this.previewPhrases[this.phraseIdx]);
      this.triggerPreviewAnimation();
    }, 2400);
  }

  stopAnimationLoop() {
    if (this.animLoopTimer) {
      clearInterval(this.animLoopTimer);
      this.animLoopTimer = null;
    }
  }

  // Open with center holographic tool animation
  open(orientationMode = 'landscape') {
    if (this.isOpen) return;
    this.isOpen = true;
    this.currentMode = orientationMode;

    // 1. Play holographic whoosh sound
    soundFx.playToolWhoosh();

    // 2. Play 3D tool animation in center of web page
    this.introAnimElement.classList.add('animating');

    // 3. After animation apex, morph into full studio modal
    setTimeout(() => {
      this.introAnimElement.classList.remove('animating');
      this.container.classList.add('active');
      this.populateControls();
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
