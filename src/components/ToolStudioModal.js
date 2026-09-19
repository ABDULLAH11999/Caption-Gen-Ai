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
    this.activeFontTarget = 'normal'; // 'normal' | 'prominent'
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
                <div class="auto-pos-badge" id="auto-pos-badge">📍 Customizable 9-Point Grid & Sizing</div>
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
                💡 <strong>Auto Smart Typography</strong> applies dynamic prominence, contrast, and font styling automatically. You can freely adjust the <strong>Position</strong> and <strong>Font Size</strong> below!
              </div>
            </div>

            <!-- Universal Controls (Available in BOTH Auto Mode & Custom Mode) -->
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
            
            <!-- Custom Sections Wrapper (Hidden in Auto Mode) -->
            <div id="custom-sections-wrapper" class="custom-sections-wrapper" style="display: ${!isAuto ? 'flex' : 'none'}; flex-direction: column; gap: 22px;">

              <!-- 1. Dual Font Family Selection -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>1. Caption Fonts</span>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <span class="badge badge-cyan" id="selected-normal-font-name">Normal: Inter</span>
                    <span class="badge badge-purple" id="selected-prominent-font-name">Prominent: Playfair</span>
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
                
                <div class="font-picker-grid" id="font-picker-grid"></div>
              </div>

              <!-- 2. Text & Outline Colors + Time Intervals (Enterprise Redesign) -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>2. Colors & Stroke Styling</span>
                  <span class="badge badge-cyan">DUAL-COLOR PRO</span>
                </div>

                <div class="dual-styling-grid">
                  <!-- Card A: Normal Words Styling -->
                  <div class="sub-config-card">
                    <div class="sub-card-header">
                      <span class="sub-card-title">⚪ Normal Words</span>
                      <span class="badge badge-cyan" id="badge-normal-color">#FFFFFF</span>
                    </div>

                    <div style="font-size: 0.78rem; color: var(--text-muted);">Text Color Palette:</div>
                    <div class="color-swatches-row" id="normal-color-palette-row">
                      <button class="normal-color-swatch-btn selected" data-color="#FFFFFF" style="background: #FFFFFF;" title="Pure White"></button>
                      <button class="normal-color-swatch-btn" data-color="#FFE600" style="background: #FFE600;" title="Electric Yellow"></button>
                      <button class="normal-color-swatch-btn" data-color="#00F0FF" style="background: #00F0FF;" title="Cyber Cyan"></button>
                      <button class="normal-color-swatch-btn" data-color="#FF4DA6" style="background: #FF4DA6;" title="Neon Pink"></button>
                      <button class="normal-color-swatch-btn" data-color="#10B981" style="background: #10B981;" title="Emerald"></button>
                      <button class="normal-color-swatch-btn" data-color="#FF6B00" style="background: #FF6B00;" title="Vibrant Orange"></button>
                      <input type="color" id="custom-normal-color-input" class="color-input-native" value="#FFFFFF" title="Custom Normal Color">
                    </div>

                    <!-- Stroke controls -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                      <span style="font-size: 0.78rem; color: var(--text-muted);">Outline Stroke Width:</span>
                      <span id="normal-outline-width-val" style="font-size: 0.8rem; font-weight:700;">2px</span>
                    </div>
                    <input type="range" min="0" max="14" value="2" class="custom-range-slider" id="normal-outline-slider">

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                      <span style="font-size: 0.78rem; color: var(--text-muted);">Stroke Color:</span>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <button class="outline-color-btn active" data-target="normal" data-color="#000000" style="width:20px;height:20px;border-radius:50%;background:#000000;border:1px solid #fff;"></button>
                        <button class="outline-color-btn" data-target="normal" data-color="#FFFFFF" style="width:20px;height:20px;border-radius:50%;background:#FFFFFF;border:1px solid #000;"></button>
                        <input type="color" id="custom-normal-outline-color" class="color-input-native" value="#000000" style="width:22px;height:22px;" title="Custom Stroke Color">
                      </div>
                    </div>
                  </div>

                  <!-- Card B: Prominent Words Styling (Hero / Accent / Dates / Names) -->
                  <div class="sub-config-card" style="border-color: rgba(255, 77, 166, 0.35);">
                    <div class="sub-card-header">
                      <span class="sub-card-title" style="color: #FF4DA6;">✨ Prominent Words</span>
                      <span class="badge badge-purple" id="badge-prominent-color">#FF4DA6</span>
                    </div>

                    <div style="font-size: 0.78rem; color: var(--text-muted);">Accent Color Palette:</div>
                    <div class="color-swatches-row" id="prominent-color-palette-row">
                      <button class="prominent-color-swatch-btn selected" data-color="#FF4DA6" style="background: #FF4DA6;" title="Neon Pink (Ref Image 2)"></button>
                      <button class="prominent-color-swatch-btn" data-color="#FF6B00" style="background: #FF6B00;" title="Vibrant Orange"></button>
                      <button class="prominent-color-swatch-btn" data-color="#FFFFFF" style="background: #FFFFFF;" title="Pure White (Ref Image 1)"></button>
                      <button class="prominent-color-swatch-btn" data-color="#00F0FF" style="background: #00F0FF;" title="Cyber Cyan"></button>
                      <button class="prominent-color-swatch-btn" data-color="#FFE600" style="background: #FFE600;" title="Electric Yellow"></button>
                      <button class="prominent-color-swatch-btn" data-color="#10B981" style="background: #10B981;" title="Emerald"></button>
                      <input type="color" id="custom-prominent-color-input" class="color-input-native" value="#FF4DA6" title="Custom Prominent Color">
                    </div>

                    <!-- Stroke controls -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                      <span style="font-size: 0.78rem; color: var(--text-muted);">Outline Stroke Width:</span>
                      <span id="prominent-outline-width-val" style="font-size: 0.8rem; font-weight:700;">3px</span>
                    </div>
                    <input type="range" min="0" max="14" value="3" class="custom-range-slider" id="prominent-outline-slider">

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                      <span style="font-size: 0.78rem; color: var(--text-muted);">Stroke Color:</span>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <button class="outline-color-btn active" data-target="prominent" data-color="#000000" style="width:20px;height:20px;border-radius:50%;background:#000000;border:1px solid #fff;"></button>
                        <button class="outline-color-btn" data-target="prominent" data-color="#FFFFFF" style="width:20px;height:20px;border-radius:50%;background:#FFFFFF;border:1px solid #000;"></button>
                        <input type="color" id="custom-prominent-outline-color" class="color-input-native" value="#000000" style="width:22px;height:22px;" title="Custom Stroke Color">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Collapsible Advanced: Time-Interval Colors & Last Word Accent -->
                <details style="margin-top: 14px; background: rgba(9, 13, 22, 0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); padding: 10px 12px;">
                  <summary style="font-size: 0.8rem; font-weight: 700; color: var(--cyan-primary); cursor: pointer;">
                    ⏱️ Time-Interval Colors & Last Word Options
                  </summary>
                  <div style="margin-top: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <span style="font-size: 0.78rem; font-weight: 700; color: var(--yellow-accent);">Time Interval Colors:</span>
                      <button id="btn-add-interval" style="font-size: 0.74rem; padding: 3px 8px; background: rgba(255,230,0,0.15); color: var(--yellow-accent); border: 1px solid var(--yellow-accent); border-radius: var(--radius-full);">
                        + Add Interval
                      </button>
                    </div>
                    <div class="interval-list-container" id="interval-list-container"></div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; margin-bottom: 6px;">
                      <span style="font-size: 0.78rem; font-weight: 700;">Last Word of Line Highlight:</span>
                      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.74rem; cursor: pointer;">
                        <input type="checkbox" id="enable-last-word-toggle" style="accent-color: var(--cyan-primary);">
                        <span>Enable</span>
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
                </details>
              </div>

              <!-- 5. Caption Animation (22+ Styles) -->
              <div class="config-section-card">
                <div class="config-section-title">
                  <span>5. Caption Animation (22 Styles)</span>
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
    this.renderFontGrid();

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

    // 4. Populate Normal Words Controls
    const normalColor = config.textColor || '#FFFFFF';
    const badgeNormal = this.container.querySelector('#badge-normal-color');
    if (badgeNormal) badgeNormal.textContent = normalColor;

    this.container.querySelectorAll('.normal-color-swatch-btn').forEach(b => {
      if (b.getAttribute('data-color').toLowerCase() === normalColor.toLowerCase()) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });
    const normalColorInput = this.container.querySelector('#custom-normal-color-input');
    if (normalColorInput) normalColorInput.value = normalColor;

    const normalOutSlider = this.container.querySelector('#normal-outline-slider');
    const normalOutVal = this.container.querySelector('#normal-outline-width-val');
    const normalOutWidth = config.normalOutlineWidth !== undefined ? config.normalOutlineWidth : (config.outlineWidth || 2);
    if (normalOutSlider) normalOutSlider.value = normalOutWidth;
    if (normalOutVal) normalOutVal.textContent = `${normalOutWidth}px`;

    const normalOutColor = config.normalOutlineColor || config.outlineColor || '#000000';
    this.container.querySelectorAll('.outline-color-btn[data-target="normal"]').forEach(btn => {
      if (btn.getAttribute('data-color').toLowerCase() === normalOutColor.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    const normalOutColorInput = this.container.querySelector('#custom-normal-outline-color');
    if (normalOutColorInput) normalOutColorInput.value = normalOutColor;

    // 4B. Populate Prominent Words Controls
    const prominentColor = config.prominentColor || '#FF4DA6';
    const badgeProminent = this.container.querySelector('#badge-prominent-color');
    if (badgeProminent) badgeProminent.textContent = prominentColor;

    this.container.querySelectorAll('.prominent-color-swatch-btn').forEach(b => {
      if (b.getAttribute('data-color').toLowerCase() === prominentColor.toLowerCase()) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });
    const prominentColorInput = this.container.querySelector('#custom-prominent-color-input');
    if (prominentColorInput) prominentColorInput.value = prominentColor;

    const prominentOutSlider = this.container.querySelector('#prominent-outline-slider');
    const prominentOutVal = this.container.querySelector('#prominent-outline-width-val');
    const prominentOutWidth = config.prominentOutlineWidth !== undefined ? config.prominentOutlineWidth : 3;
    if (prominentOutSlider) prominentOutSlider.value = prominentOutWidth;
    if (prominentOutVal) prominentOutVal.textContent = `${prominentOutWidth}px`;

    const prominentOutColor = config.prominentOutlineColor || '#000000';
    this.container.querySelectorAll('.outline-color-btn[data-target="prominent"]').forEach(btn => {
      if (btn.getAttribute('data-color').toLowerCase() === prominentOutColor.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    const prominentOutColorInput = this.container.querySelector('#custom-prominent-outline-color');
    if (prominentOutColorInput) prominentOutColorInput.value = prominentOutColor;

    // 4C. Populate Last Word Accent Color
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

    // 6. Populate Animations (22 styles)
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

  renderFontGrid() {
    const config = this.getActiveConfig();
    const fontGrid = this.container?.querySelector('#font-picker-grid');
    if (!fontGrid) return;

    const isNormalTarget = this.activeFontTarget === 'normal';
    const activeFontId = isNormalTarget
      ? (config.normalFontFamily || config.fontFamily || 'Inter')
      : (config.prominentFontFamily || 'PlayfairDisplay');

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
      const fObj = FONTS.find(f => f.id === (config.prominentFontFamily || 'PlayfairDisplay')) || FONTS[0];
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

    // Clicks on interactive elements
    this.container.addEventListener('click', (e) => {
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
        const badge = this.container.querySelector('#selected-pos-name');
        if (badge) badge.textContent = posId.toUpperCase();
        this.setActiveConfig({ position: posId });
        return;
      }

      // Normal Color swatches
      const normalSwatch = e.target.closest('.normal-color-swatch-btn');
      if (normalSwatch) {
        soundFx.playKeyBeep(650);
        const color = normalSwatch.getAttribute('data-color');
        this.container.querySelectorAll('.normal-color-swatch-btn').forEach(b => b.classList.remove('selected'));
        normalSwatch.classList.add('selected');
        const badge = this.container.querySelector('#badge-normal-color');
        if (badge) badge.textContent = color;
        this.setActiveConfig({ textColor: color });
        return;
      }

      // Prominent Color swatches (Pink, Orange, White, Cyan, Yellow, Emerald)
      const prominentSwatch = e.target.closest('.prominent-color-swatch-btn');
      if (prominentSwatch) {
        soundFx.playKeyBeep(660);
        const color = prominentSwatch.getAttribute('data-color');
        this.container.querySelectorAll('.prominent-color-swatch-btn').forEach(b => b.classList.remove('selected'));
        prominentSwatch.classList.add('selected');
        const badge = this.container.querySelector('#badge-prominent-color');
        if (badge) badge.textContent = color;
        this.setActiveConfig({ prominentColor: color });
        return;
      }

      // Outline Stroke color buttons (Normal vs Prominent)
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

      // Last Word Accent Color Swatches
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
        const badge = this.container.querySelector('#selected-anim-name');
        if (badge && animMeta) badge.textContent = animMeta.name;
        this.setActiveConfig({ animation: animId });
        return;
      }
    });

    // Custom Normal Color Picker
    this.container.querySelector('#custom-normal-color-input')?.addEventListener('input', (e) => {
      const color = e.target.value;
      const badge = this.container.querySelector('#badge-normal-color');
      if (badge) badge.textContent = color;
      this.setActiveConfig({ textColor: color });
    });

    // Custom Prominent Color Picker
    this.container.querySelector('#custom-prominent-color-input')?.addEventListener('input', (e) => {
      const color = e.target.value;
      const badge = this.container.querySelector('#badge-prominent-color');
      if (badge) badge.textContent = color;
      this.setActiveConfig({ prominentColor: color });
    });

    // Custom Normal Outline Color Picker
    this.container.querySelector('#custom-normal-outline-color')?.addEventListener('input', (e) => {
      this.setActiveConfig({ normalOutlineColor: e.target.value, outlineColor: e.target.value });
    });

    // Custom Prominent Outline Color Picker
    this.container.querySelector('#custom-prominent-outline-color')?.addEventListener('input', (e) => {
      this.setActiveConfig({ prominentOutlineColor: e.target.value });
    });

    // Normal Outline Width Slider
    const normalOutSlider = this.container.querySelector('#normal-outline-slider');
    normalOutSlider?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      this.container.querySelector('#normal-outline-width-val').textContent = `${val}px`;
      this.setActiveConfig({ normalOutlineWidth: val, outlineWidth: val });
    });

    // Prominent Outline Width Slider
    const prominentOutSlider = this.container.querySelector('#prominent-outline-slider');
    prominentOutSlider?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      this.container.querySelector('#prominent-outline-width-val').textContent = `${val}px`;
      this.setActiveConfig({ prominentOutlineWidth: val });
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

    // Position preview text based on user selected position (defaults to middle-left for Auto, bottom-center for Custom)
    const positionId = config.position || (isAuto ? 'middle-left' : 'bottom-center');
    const pos = CAPTION_POSITIONS.find(p => p.id === positionId) || CAPTION_POSITIONS[3];
    previewText.style.top = pos.y;
    previewText.style.left = pos.x;
    previewText.style.transform = pos.transform;
    previewText.style.textAlign = pos.align;
    previewText.style.webkitTextStroke = 'none';
    previewText.style.textShadow = 'none';

    // Update auto-pos-badge in header
    const autoBadge = this.container?.querySelector('#auto-pos-badge');
    if (autoBadge && isAuto) {
      const posName = pos.name || 'Middle Left';
      const sizeVal = config.fontSize !== undefined ? config.fontSize : 30;
      autoBadge.textContent = `📍 ${posName} • Size ${sizeVal}`;
    }

    // Render phrase with dual normal & prominent styling
    this.renderPreviewPhrase(this.previewPhrases[this.phraseIdx]);

    // Trigger Live Animation
    this.triggerPreviewAnimation(config.animation);
  }

  renderPreviewPhrase(phrase) {
    const previewText = this.container?.querySelector('#preview-caption-text');
    if (!previewText) return;
    const config = this.getActiveConfig();

    // Analyze phrase using dual word-importance logic & config
    const analysis = autoTypographyEngine.analyzeSentence({ text: phrase }, false, config);
    const baseFontSize = Math.max(16, Math.round((config.fontSize || 30) * 0.95));

    const wordsHtml = analysis.words.map((w) => {
      const fontSizePx = Math.round(baseFontSize * (w.fontSizeMultiplier || 1.0));
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
          margin: 0 3px;
        ">
          ${w.word}
        </span>
      `;
    }).join(' ');

    previewText.innerHTML = `
      <div class="preview-caption-flow" style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 6px; line-height: 1.15;">
        ${wordsHtml}
      </div>
    `;
  }

  triggerPreviewAnimation(animOverride = null) {
    const previewText = this.container?.querySelector('#preview-caption-text');
    if (!previewText) return;

    const config = this.getActiveConfig();
    const activeAnimId = animOverride || config.animation || 'anim-fade';
    const animMeta = CAPTION_ANIMATIONS.find(a => a.id === activeAnimId);
    const cssClass = animMeta ? animMeta.cssClass : 'anim-fade';

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
