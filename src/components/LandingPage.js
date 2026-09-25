import { api } from '../services/apiClient.js';
import { CAPTION_TEMPLATES } from '../config.js';

export class LandingPage {
  constructor({ onNavigate, onOpenAuth, showToast }) {
    this.onNavigate = onNavigate;
    this.onOpenAuth = onOpenAuth;
    this.showToast = showToast || console.log;
    this.container = null;
    this.plans = [];
    this.selectedPlanForPurchase = null;
    this.activeCompareMode = 'split'; // 'split' | 'before' | 'after'
  }

  async init() {
    try {
      const res = await api.getPlans();
      this.plans = res.plans || [];
      this.renderPlans();
    } catch (e) {
      console.warn('Could not load plans:', e);
    }
  }

  render(parentElement) {
    this.container = document.createElement('main');
    this.container.className = 'saas-landing-page';
    this.container.innerHTML = `
      <!-- Ambient Ethereal Glow Mesh -->
      <div class="landing-bg-glow glow-top-center"></div>
      <div class="landing-bg-glow glow-middle-right"></div>
      <div class="landing-bg-glow glow-bottom-left"></div>

      <!-- 1. HERO BANNER WITH OUTLINES BOX AROUND '+' UPLOADER -->
      <section class="hero-section">
        <div class="hero-pill-tag">
          <span class="hero-pill-sparkle">✨</span>
          <span>100% Free &bull; No Watermark &bull; Auto Subtitles for TikTok, Reels &amp; Shorts</span>
        </div>

        <h1 class="hero-title">
          Free Caption Generator Video Tool - Auto Subtitles in <span class="gradient-text-purple">Seconds</span>.
        </h1>

        <p class="hero-subtitle">
          Add accurate captions to videos for free with our Auto Subtitle Generator. Automatically transcribe speech to text with Whisper AI, generate viral kinetic subtitles for TikTok, Instagram Reels &amp; YouTube Shorts with zero watermarks.
        </p>

        <!-- OUTLINES BOX AROUND '+' UPLOADER (Captions.ai Inspired) -->
        <div class="hero-upload-card" id="hero-drop-zone">
          <input type="file" id="hero-file-input" accept="video/mp4,video/webm,video/quicktime,video/mov" class="hero-file-hidden" />
          
          <div class="upload-plus-outline-box" id="btn-hero-upload-trigger" title="Click to add video">
            <div class="upload-plus-symbol">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            <span class="upload-plus-tag">Click to add video</span>
          </div>

          <div class="upload-copy-group">
            <h3 class="upload-main-title">Click to add video or drag &amp; drop here</h3>
            <p class="upload-sub-title">MP4, WebM or MOV up to 500 MB &bull; Client-side Whisper AI &bull; 100% Free &amp; Private</p>
          </div>

          <div class="upload-actions-bar">
            <button type="button" class="btn btn-black btn-sm" id="btn-hero-browse">
              <span>📁 Select Video File</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-hero-launch-direct">
              <span>⚡ Open Studio</span>
            </button>
          </div>
        </div>

        <div class="hero-rating-badge">
          <div class="hero-stars">★★★★★</div>
          <span class="hero-score">4.9/5</span>
          <span class="hero-reviews">(134 reviews)</span>
          <span class="hero-dot"></span>
          <span class="badge badge-success">100% Free Tool</span>
        </div>
      </section>

      <!-- 2. BEFORE & AFTER INTERACTIVE COMPARISON SECTION -->
      <section class="section-wrap" id="compare">
        <div class="section-header-center">
          <span class="badge badge-purple" style="margin-bottom: 12px;">Visual Impact</span>
          <h2 class="section-heading">Retention That Stops The Scroll</h2>
          <p class="section-subheading">See how dynamic dual-font styling, glowing keyword emphasis, and subject rotoscoping skyrocket audience watch time.</p>
        </div>

        <!-- Interactive Comparison Container -->
        <div class="compare-container">
          <!-- Control Toggle Bar -->
          <div class="compare-toggle-bar">
            <button type="button" class="compare-toggle-btn active" data-mode="split">
              <span>⚡ Side-by-Side</span>
            </button>
            <button type="button" class="compare-toggle-btn" data-mode="before">
              <span>Raw Footage (Before)</span>
            </button>
            <button type="button" class="compare-toggle-btn" data-mode="after">
              <span>Zen Captions AI (After)</span>
            </button>
          </div>

          <!-- Cards Grid -->
          <div class="compare-cards-grid" id="compare-grid">
            
            <!-- Card 1: Before (Raw Video) -->
            <div class="compare-card compare-card-before">
              <div class="compare-card-header">
                <div class="compare-badge-pill pill-red">
                  <span class="dot-indicator red"></span>
                  <span>BEFORE: RAW FOOTAGE</span>
                </div>
                <span class="compare-stat-pill red">&minus;58% Completion Rate</span>
              </div>

              <!-- Dummy Media Frame -->
              <div class="compare-screen-frame">
                <div class="dummy-media-placeholder before-placeholder">
                  <div class="dummy-video-scrim"></div>
                  <div class="dummy-inner-content">
                    <span class="dummy-icon">🔇</span>
                    <span class="dummy-title">Silent / Uncaptioned Video</span>
                    <span class="dummy-desc">[ DUMMY IMAGE PLACEHOLDER ]<br/>User can drop raw video screenshot or thumbnail here</span>
                  </div>
                  <div class="dummy-subtitle-simulation none">
                    <span>(No subtitles &bull; 85% of viewers scroll past muted clips)</span>
                  </div>
                </div>
              </div>

              <div class="compare-card-footer">
                <ul class="compare-features-list">
                  <li class="negative">✕ Viewer drops off within first 3 seconds</li>
                  <li class="negative">✕ Muted autoplay ignored on TikTok &amp; Reels feed</li>
                  <li class="negative">✕ Zero keyword retention or visual anchors</li>
                </ul>
              </div>
            </div>

            <!-- Card 2: After (Zen Captions Studio) -->
            <div class="compare-card compare-card-after">
              <div class="compare-card-header">
                <div class="compare-badge-pill pill-purple">
                  <span class="dot-indicator purple"></span>
                  <span>AFTER: ZEN CAPTIONS AI</span>
                </div>
                <span class="compare-stat-pill green">+84% Watch Time</span>
              </div>

              <!-- Dummy Media Frame with Live Kinetic Overlay -->
              <div class="compare-screen-frame">
                <div class="dummy-media-placeholder after-placeholder">
                  <div class="dummy-video-scrim after-scrim"></div>
                  <div class="dummy-inner-content">
                    <span class="dummy-icon">⚡</span>
                    <span class="dummy-title">Dual-Font Viral Subtitles</span>
                    <span class="dummy-desc">[ DUMMY IMAGE PLACEHOLDER ]<br/>User can drop captioned video screenshot or demo GIF here</span>
                  </div>
                  
                  <!-- Simulated Live Kinetic Caption Overlay -->
                  <div class="dummy-subtitle-simulation active-kinetic">
                    <div class="sim-caption-box">
                      <span class="sim-word normal">MAKE</span>
                      <span class="sim-word hero-keyword">VIRAL</span>
                      <span class="sim-word hero-glow">REELS</span>
                    </div>
                  </div>

                  <div class="dummy-rotoscoping-badge">
                    <span>👤 Subtitles Rendered Behind Subject</span>
                  </div>
                </div>
              </div>

              <div class="compare-card-footer">
                <ul class="compare-features-list">
                  <li class="positive">✓ 99.2% Whisper AI transcription accuracy</li>
                  <li class="positive">✓ High-impact dual font &amp; glowing neon keyword colors</li>
                  <li class="positive">✓ Auto subject cutout renders text behind creators</li>
                  <li class="positive">✓ Buttery-smooth 60 FPS broadcast export</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

      <!-- 3. HOW IT WORKS / ARCHITECTURE SECTION -->
      <section class="section-wrap" id="how-it-works">
        <div class="section-header-center">
          <span class="badge badge-purple" style="margin-bottom: 12px;">Architecture</span>
          <h2 class="section-heading">How Zen Captions Powers Viral Retention</h2>
          <p class="section-subheading">A modern client-edge AI engine designed to keep viewers hooked from the very first frame.</p>
        </div>

        <div class="how-it-works-grid">
          <div class="how-steps-list" id="how-steps-container">
            <div class="how-step-item active" data-step="1">
              <div class="how-step-icon">🎙️</div>
              <div class="how-step-content">
                <span class="how-step-badge">STEP 01</span>
                <h3>16kHz Studio Audio Resampling</h3>
                <p>Smartphone audio is resampled to 16,000Hz mono via hardware OfflineAudioContext, eliminating pitch distortion and achieving 99%+ speech recognition accuracy.</p>
              </div>
            </div>

            <div class="how-step-item" data-step="2">
              <div class="how-step-icon">✨</div>
              <div class="how-step-content">
                <span class="how-step-badge">STEP 02</span>
                <h3>Dual-Font Hero Highlighting</h3>
                <p>Clean sans-serif fonts for normal words paired with bold display fonts for high-impact keywords. Automatically formatted with deep outlines and luminous drop shadows.</p>
              </div>
            </div>

            <div class="how-step-item" data-step="3">
              <div class="how-step-icon">👤</div>
              <div class="how-step-content">
                <span class="how-step-badge">STEP 03</span>
                <h3>AI Subject Rotoscoping (Behind Text)</h3>
                <p>Advanced neural segmentation separates the speaker from the background so animated subtitles gracefully float behind them for professional polish.</p>
              </div>
            </div>

            <div class="how-step-item" data-step="4">
              <div class="how-step-icon">🚀</div>
              <div class="how-step-content">
                <span class="how-step-badge">STEP 04</span>
                <h3>Zero-Lag 60 FPS Lossless Export</h3>
                <p>Direct3D and WebGL canvas shaders render in under 0.02ms per frame, producing silky-smooth 60 FPS video exports ready for Instagram, TikTok, and YouTube.</p>
              </div>
            </div>
          </div>

          <!-- Right Showcase Mockup Preview: Full Image in Natural Ratio & Full Size -->
          <div class="mockup-preview-container">
            <div class="mockup-header-bar">
              <div class="mockup-dots">
                <div class="mockup-dot red"></div>
                <div class="mockup-dot yellow"></div>
                <div class="mockup-dot green"></div>
              </div>
              <div class="mockup-tag">LIVE PREVIEW &bull; FULL 1080p CANVAS</div>
            </div>

            <div class="mockup-screen-area">
              <img class="mockup-preview-image" src="/img-1.png" alt="Video Preview - Full Aspect Ratio" onerror="this.style.display='none'" />

              <div class="mockup-controls-overlay">
                <span style="font-size: 12px; color: #ffffff; font-weight: 700;">00:03 / 00:13</span>
                <div class="mockup-timeline-track">
                  <div class="mockup-timeline-progress"></div>
                </div>
                <span class="badge badge-purple" style="font-size: 11px;">1080p HD &bull; 60 FPS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. TEMPLATES & PRESETS SHOWCASE (SPLIT LAYOUT: 16+ PRESETS TEXT ON LEFT, 3 POPULAR ON RIGHT) -->
      <section class="section-wrap" id="templates">
        <div class="presets-split-container">
          <!-- LEFT SIDE: 16+ Creator Presets Headline, Description, Perks, & Studio Trigger -->
          <div class="presets-split-left">
            <div class="presets-badge-row">
              <span class="badge badge-purple">✨ Preset Library</span>
              <span class="presets-count-badge">16 Total Styles</span>
            </div>

            <h2 class="presets-split-heading">16+ Ready-Made Creator Presets &amp; Customizable Styles</h2>
            
            <p class="presets-split-subheading">
              A 100% free captions generator customizable for TikTok, YouTube Shorts, Real Estate, and Instagram Reels. Every template is engineered for maximum retention, instant virality, and crisp mobile viewing.
            </p>

            <div class="presets-split-cta-group">
              <button class="btn btn-black" id="btn-hero-launch-studio">
                <span>⚡ Open Studio Presets</span>
              </button>
              <button class="btn btn-outline" id="btn-toggle-all-templates">
                <span id="btn-toggle-templates-label">Explore All 16 Presets ↓</span>
              </button>
            </div>
          </div>

          <!-- RIGHT SIDE: Feature Perks List -->
          <div class="presets-split-right">
            <div class="presets-perks-list">
              <div class="presets-perk-item">
                <div class="perk-icon-circle">⚡</div>
                <div class="perk-text">
                  <h4>Dual-Font Kinetic Pairings</h4>
                  <p>Hand-tuned typography pairings combining punchy keywords with readable body text.</p>
                </div>
              </div>

              <div class="presets-perk-item">
                <div class="perk-icon-circle">🎨</div>
                <div class="perk-text">
                  <h4>Full Granular Customization</h4>
                  <p>Fine-tune colors, word highlight timing, safe zones, drop shadows, and 22+ animations.</p>
                </div>
              </div>

              <div class="presets-perk-item">
                <div class="perk-icon-circle">🔒</div>
                <div class="perk-text">
                  <h4>100% Client-Side &amp; Zero Watermark</h4>
                  <p>Your video never leaves your browser. Private, ultra-fast 60 FPS GPU rendering.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- COLLAPSIBLE FULL 16 PRESETS DRAWER -->
        <div class="all-presets-drawer" id="all-presets-drawer" style="display: none;">
          <div class="all-presets-drawer-header">
            <div>
              <h3 class="all-presets-drawer-title">All 16+ Creator Presets &amp; Aesthetic Styles</h3>
              <p class="all-presets-drawer-sub">Select any preset below to immediately load into Caption Studio</p>
            </div>
            <button class="btn btn-outline btn-sm" id="btn-close-all-templates">
              <span>✕ Hide Full Library</span>
            </button>
          </div>

          <div class="templates-showcase-grid" id="templates-grid">
            <!-- Full 16 presets grid -->
          </div>
        </div>
      </section>

      <!-- 5. FAQ ACCORDION SECTION -->
      <section class="section-wrap" id="faq">
        <div class="section-header-center">
          <span class="badge badge-purple" style="margin-bottom: 12px;">Frequently Asked Questions</span>
          <h2 class="section-heading">Everything About Zen Caption Tool</h2>
          <p class="section-subheading">Common questions about the 100% free AI video caption generator and subtitle maker.</p>
        </div>

        <div class="faq-accordion-list">
          <div class="faq-item is-open">
            <button type="button" class="faq-trigger" aria-expanded="true">
              <span class="faq-question">What is Zen Caption Tool?</span>
              <div class="faq-chevron-wrap">
                <svg class="faq-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </button>
            <div class="faq-body-collapse">
              <div class="faq-body-inner">
                <p>Zen Caption Tool is a 100% free web-based AI video caption generator and subtitle maker. It transcribes spoken video audio using local Whisper AI models and automatically burns viral dual-font kinetic captions (Hormozi, MrBeast, TikTok style) with zero watermarks directly in your browser.</p>
              </div>
            </div>
          </div>

          <div class="faq-item">
            <button type="button" class="faq-trigger" aria-expanded="false">
              <span class="faq-question">Is Zen Caption Tool completely free?</span>
              <div class="faq-chevron-wrap">
                <svg class="faq-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </button>
            <div class="faq-body-collapse">
              <div class="faq-body-inner">
                <p>Yes! Zen Caption Tool provides 100% free video captioning with no watermarks, no mandatory credit card, and smooth 60 FPS high-definition video export.</p>
              </div>
            </div>
          </div>

          <div class="faq-item">
            <button type="button" class="faq-trigger" aria-expanded="false">
              <span class="faq-question">Can I use Zen Caption as a Free AI Instagram Caption Generator for Real Estate?</span>
              <div class="faq-chevron-wrap">
                <svg class="faq-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </button>
            <div class="faq-body-collapse">
              <div class="faq-body-inner">
                <p>Yes! Zen Caption is the premier free AI Instagram caption generator for real estate agents and property creators. Easily customize elegant luxury fonts, highlight property features, add neighborhood price callouts, and burn high-contrast subtitles into Instagram Reels, TikTok walkthroughs, and YouTube Shorts with zero watermark.</p>
              </div>
            </div>
          </div>

          <div class="faq-item">
            <button type="button" class="faq-trigger" aria-expanded="false">
              <span class="faq-question">Is Zen Caption a customizable free captions generator?</span>
              <div class="faq-chevron-wrap">
                <svg class="faq-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </button>
            <div class="faq-body-collapse">
              <div class="faq-body-inner">
                <p>Yes. Zen Caption is a 100% free captions generator customizable for any video style. You can customize font families, colors, outline strokes, shadow glow, word-by-word highlight colors, safe-zone positioning, and 22+ kinetic animations.</p>
              </div>
            </div>
          </div>

          <div class="faq-item">
            <button type="button" class="faq-trigger" aria-expanded="false">
              <span class="faq-question">Does Zen Caption Tool upload my video to a remote server?</span>
              <div class="faq-chevron-wrap">
                <svg class="faq-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </button>
            <div class="faq-body-collapse">
              <div class="faq-body-inner">
                <p>No. Zen Caption Tool operates 100% client-side inside your web browser using WebAssembly and WebGPU. Your video files, transcripts, and exports remain private on your device.</p>
              </div>
            </div>
          </div>

          <div class="faq-item">
            <button type="button" class="faq-trigger" aria-expanded="false">
              <span class="faq-question">Which caption animations and presets does Zen Caption Tool support?</span>
              <div class="faq-chevron-wrap">
                <svg class="faq-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </button>
            <div class="faq-body-collapse">
              <div class="faq-body-inner">
                <p>Zen Caption Tool includes 16+ production-ready creator presets (September Pop, Viral Reel Hormozi, Cyberpunk Neon, Beast Mode, Luxury Vogue) and 22+ kinetic animations including TikTok Pop, Bounce Drop, 3D Tilt, Neon Shimmer, and Karaoke Highlights.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. PRICING & PLANS SECTION -->
      <section class="section-wrap" id="pricing">
        <div class="section-header-center">
          <span class="badge badge-purple" style="margin-bottom: 12px;">Flexible Plans</span>
          <h2 class="section-heading">Transparent Pricing for Every Creator</h2>
          <p class="section-subheading">Start free immediately with no credit card required. Upgrade anytime for higher quotas.</p>
        </div>

        <div class="pricing-grid" id="pricing-grid">
          <!-- Populated by renderPlans() -->
        </div>
      </section>

      <!-- PURCHASE REQUEST MODAL DIALOG -->
      <div class="saas-modal-backdrop" id="purchase-modal-backdrop">
        <div class="saas-modal-dialog">
          <div class="saas-modal-header">
            <h3 class="saas-modal-title" id="purchase-modal-title">Submit Purchase Request</h3>
            <button class="saas-modal-close" id="btn-close-purchase">&times;</button>
          </div>

          <div class="card" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong id="modal-plan-name" style="font-size: 18px; color: #000000;">Creator Pro</strong>
                <div style="font-size: 13px; color: #64748b;" id="modal-plan-desc">For high-volume video editors and creators.</div>
              </div>
              <div style="font-size: 24px; font-weight: 900; color: #0a0a0e;" id="modal-plan-price">$19 / mo</div>
            </div>
          </div>

          <form id="form-purchase-request">
            <div class="form-group">
              <label class="form-label" for="purchase-name">Full Name</label>
              <input type="text" class="form-control" id="purchase-name" required placeholder="Your full name">
            </div>

            <div class="form-group">
              <label class="form-label" for="purchase-email">Email Address</label>
              <input type="email" class="form-control" id="purchase-email" required placeholder="you@example.com">
            </div>

            <div class="form-group">
              <label class="form-label" for="purchase-phone">Phone / WhatsApp (Optional)</label>
              <input type="tel" class="form-control" id="purchase-phone" placeholder="+1 (555) 000-0000">
            </div>

            <div class="form-group">
              <label class="form-label" for="purchase-notes">Special Instructions or Notes</label>
              <textarea class="form-control" id="purchase-notes" rows="3" placeholder="Tell us about your team size, custom presets or API requirements..."></textarea>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
              <button type="button" class="btn btn-outline" id="btn-cancel-purchase">Cancel</button>
              <button type="submit" class="btn btn-black" id="btn-submit-purchase">
                <span>Submit Request</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.renderTemplatesShowcase();
    this.bindEvents();
    return this.container;
  }

  renderTemplatesShowcase() {
    const popularContainer = this.container.querySelector('#popular-presets-container');
    const fullGrid = this.container.querySelector('#templates-grid');
    if (!fullGrid) return;

    if (popularContainer) {
      popularContainer.innerHTML = '';
      const popularTemplates = CAPTION_TEMPLATES.slice(0, 3);
      popularTemplates.forEach((tmpl, idx) => {
        const card = this.createTemplateCard(tmpl, true, idx + 1);
        popularContainer.appendChild(card);
      });
    }

    fullGrid.innerHTML = '';

    // All 16 Presets for Expandable Drawer
    CAPTION_TEMPLATES.forEach(tmpl => {
      const card = this.createTemplateCard(tmpl, false);
      fullGrid.appendChild(card);
    });

    // Drawer Toggle Events
    const toggleBtn = this.container.querySelector('#btn-toggle-all-templates');
    const closeBtn = this.container.querySelector('#btn-close-all-templates');
    const drawer = this.container.querySelector('#all-presets-drawer');
    const toggleLabel = this.container.querySelector('#btn-toggle-templates-label');

    const toggleDrawer = () => {
      const isHidden = drawer.style.display === 'none';
      if (isHidden) {
        drawer.style.display = 'block';
        if (toggleLabel) toggleLabel.textContent = '✕ Hide Full Library';
        drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        drawer.style.display = 'none';
        if (toggleLabel) toggleLabel.textContent = 'Explore All 16 Presets ↓';
      }
    };

    toggleBtn?.addEventListener('click', toggleDrawer);
    closeBtn?.addEventListener('click', () => {
      drawer.style.display = 'none';
      if (toggleLabel) toggleLabel.textContent = 'Explore All 16 Presets ↓';
    });

    this.container.querySelector('#btn-hero-launch-studio')?.addEventListener('click', () => {
      this.onNavigate('app');
    });
  }

  createTemplateCard(tmpl, isPopular = false, rank = 1) {
    const card = document.createElement('div');
    if (isPopular) {
      card.className = 'template-showcase-card popular-card';
      card.innerHTML = `
        <div class="tpl-card-info">
          <div class="tpl-card-title-row">
            <span class="tpl-icon">${tmpl.icon || '⚡'}</span>
            <h4 class="tpl-name">${tmpl.name}</h4>
          </div>
          <p class="tpl-scope">${tmpl.scope || 'Viral TikTok and Instagram Reels typography preset.'}</p>
          
          <button class="btn btn-black btn-sm btn-block btn-try-template" data-tpl-id="${tmpl.id}">
            <span>⚡ Use Preset in Studio</span>
          </button>
        </div>
      `;
    } else {
      card.className = 'template-showcase-card template-drawer-item';
      card.setAttribute('data-tpl-id', tmpl.id);
      card.innerHTML = `
        <div class="tpl-drawer-inner">
          <div class="tpl-drawer-left">
            <span class="tpl-icon">${tmpl.icon || '⚡'}</span>
            <span class="tpl-drawer-name">${tmpl.name}</span>
          </div>
          <button class="btn btn-black btn-sm btn-try-template" data-tpl-id="${tmpl.id}">
            <span>⚡ Use</span>
          </button>
        </div>
      `;
    }

    card.querySelector('.btn-try-template')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onNavigate('app', `template=${tmpl.id}`);
    });

    if (!isPopular) {
      card.addEventListener('click', () => {
        this.onNavigate('app', `template=${tmpl.id}`);
      });
    }

    return card;
  }

  renderPlans() {
    const grid = this.container.querySelector('#pricing-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const defaultPlans = [
      {
        id: 'free',
        name: 'Free Starter',
        price: '$0',
        billing: 'forever',
        description: 'Perfect for casual creators testing viral video subtitles.',
        is_popular: false,
        features: [
          '3 Video captions per day',
          'All 16+ Viral & Luxury Presets',
          'Whisper AI speech recognition',
          '60 FPS GPU lossless export',
          'AI Video Quality Enhancement',
          'Full Granular Customizer Studio'
        ],
        btn_text: 'Start Free Now',
        btn_action: 'start'
      },
      {
        id: 'creator',
        name: 'Creator Pro',
        price: '$19',
        billing: 'per month',
        description: 'For YouTubers, TikTokers & agencies seeking maximum watch time.',
        is_popular: true,
        features: [
          '50 Video captions per day',
          'All 16+ Viral & Luxury Presets',
          'Full Granular Customizer Studio',
          'Buttery Smooth 60 FPS 1080p Export',
          'AI Video Quality Enhancement (HD+)',
          'Priority Processing Speed'
        ],
        btn_text: 'Get Creator Pro',
        btn_action: 'request'
      },
      {
        id: 'agency',
        name: 'Agency Elite',
        price: '$49',
        billing: 'per month',
        description: 'High-volume production powerhouse for video editors & teams.',
        is_popular: false,
        features: [
          'Unlimited Video Captions',
          'All Presets + Custom Brand Font Uploads',
          'Lossless 4K & 1080p 60 FPS Export',
          'Multi-Language Translation (90+ Languages)',
          'Team Account & Custom API Access',
          '24/7 Priority Support & VIP Onboarding'
        ],
        btn_text: 'Get Agency Elite',
        btn_action: 'request'
      }
    ];

    const displayPlans = this.plans.length > 0 ? this.plans : defaultPlans;

    displayPlans.forEach(plan => {
      const isPopular = plan.is_popular || plan.id === 'creator-pro' || plan.id === 'creator';
      const card = document.createElement('div');
      card.className = `pricing-card ${isPopular ? 'is-popular' : ''}`;
      
      let rawFeatures = plan.features;
      if (typeof rawFeatures === 'string') {
        try { rawFeatures = JSON.parse(rawFeatures); } catch (e) { rawFeatures = []; }
      }
      if (!Array.isArray(rawFeatures)) rawFeatures = [];

      const featuresList = rawFeatures.map(f => {
        const text = typeof f === 'object' && f !== null ? (f.text || f.name || '') : String(f || '');
        const included = typeof f === 'object' && f !== null ? (f.included !== false) : true;
        if (!text) return '';
        return `
          <li class="pricing-feature-item ${included ? '' : 'not-included'}">
            <svg class="feature-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>${text}</span>
          </li>
        `;
      }).filter(Boolean).join('');

      const priceDisplay = typeof plan.price === 'number'
        ? `$${plan.price}`
        : (String(plan.price || '$0').startsWith('$') ? plan.price : `$${plan.price}`);

      const billingDisplay = plan.billing || (plan.billing_cycle === 'month' ? 'mo' : plan.billing_cycle) || 'mo';
      const descriptionDisplay = plan.description || plan.short_desc || '';
      const isFree = plan.id === 'free' || plan.is_default_free || plan.price === 0 || plan.price === '$0';
      const btnText = plan.btn_text || (isFree ? 'Start Free Now' : `Get ${plan.name}`);
      const btnAction = plan.btn_action || (isFree ? 'start' : 'request');

      card.innerHTML = `
        ${isPopular ? `<div class="popular-ribbon"><span>MOST POPULAR</span></div>` : ''}
        
        <div class="pricing-card-header">
          <h3 class="plan-name">${plan.name}</h3>
          <p class="plan-desc">${descriptionDisplay}</p>
          <div class="plan-price-row">
            <span class="plan-price">${priceDisplay}</span>
            <span class="plan-billing">/ ${billingDisplay}</span>
          </div>
        </div>

        <ul class="pricing-features">
          ${featuresList}
        </ul>

        <button class="btn btn-black btn-block btn-select-plan" data-plan-id="${plan.id}" data-action="${btnAction}">
          <span>${btnText}</span>
        </button>
      `;

      card.querySelector('.btn-select-plan')?.addEventListener('click', () => {
        if (isFree || btnAction === 'start') {
          this.onNavigate('app');
        } else {
          this.openPurchaseModal({ ...plan, name: plan.name, price: priceDisplay });
        }
      });

      grid.appendChild(card);
    });
  }

  bindEvents() {
    // 1. Direct Studio Navigation Buttons
    this.container.querySelector('#btn-hero-launch-direct')?.addEventListener('click', () => {
      this.onNavigate('app');
    });

    // 2. Upload Box with Outline Around '+' and Direct Studio Progress Handoff
    const dropZone = this.container.querySelector('#hero-drop-zone');
    const fileInput = this.container.querySelector('#hero-file-input');
    const plusBox = this.container.querySelector('#btn-hero-upload-trigger');
    const browseBtn = this.container.querySelector('#btn-hero-browse');

    const handleSelectedFile = (file) => {
      if (!file) return;
      if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
        this.showToast('Please select a valid video file (MP4, WebM, MOV).', 'warning');
        return;
      }
      this.showToast(`Loading "${file.name}" into Caption Studio...`, 'info');
      // Pass the file directly to the app route to start progress automatically!
      this.onNavigate('app', { file });
    };

    plusBox?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });

    dropZone?.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleSelectedFile(file);
    });

    // Drag and drop listeners on hero uploader
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('is-dragover');
      });
    });

    dropZone?.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleSelectedFile(file);
    });

    // 3. Before & After Toggle Buttons
    this.container.querySelectorAll('.compare-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        this.activeCompareMode = mode;
        this.container.querySelectorAll('.compare-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const grid = this.container.querySelector('#compare-grid');
        if (grid) {
          grid.classList.remove('show-before-only', 'show-after-only');
          if (mode === 'before') grid.classList.add('show-before-only');
          else if (mode === 'after') grid.classList.add('show-after-only');
        }
      });
    });

    // 4. Architecture Step Items Interactive Switching
    this.container.querySelectorAll('.how-step-item').forEach(stepItem => {
      stepItem.addEventListener('click', () => {
        this.container.querySelectorAll('.how-step-item').forEach(s => s.classList.remove('active'));
        stepItem.classList.add('active');
      });
    });

    // 5. Smooth FAQ Accordion Toggle
    this.container.querySelectorAll('.faq-item').forEach(item => {
      const trigger = item.querySelector('.faq-trigger');
      trigger?.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        this.container.querySelectorAll('.faq-item.is-open').forEach(openItem => {
          if (openItem !== item) {
            openItem.classList.remove('is-open');
            openItem.querySelector('.faq-trigger')?.setAttribute('aria-expanded', 'false');
          }
        });
        item.classList.toggle('is-open', !isOpen);
        trigger.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
      });
    });

    // 5. Purchase Modal Events
    const modal = this.container.querySelector('#purchase-modal-backdrop');
    const closeBtn = this.container.querySelector('#btn-close-purchase');
    const cancelBtn = this.container.querySelector('#btn-cancel-purchase');
    const purchaseForm = this.container.querySelector('#form-purchase-request');

    const closeModal = () => {
      modal?.classList.remove('open');
      this.selectedPlanForPurchase = null;
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    purchaseForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.container.querySelector('#purchase-name')?.value;
      const email = this.container.querySelector('#purchase-email')?.value;
      const phone = this.container.querySelector('#purchase-phone')?.value;
      const notes = this.container.querySelector('#purchase-notes')?.value;

      try {
        await api.submitPurchaseRequest({
          planId: this.selectedPlanForPurchase?.id || 'creator',
          planName: this.selectedPlanForPurchase?.name || 'Creator Pro',
          name,
          email,
          phone,
          notes
        });
        this.showToast('Purchase request received! Our team will contact you shortly.', 'success');
        closeModal();
      } catch (err) {
        this.showToast('Failed to submit purchase request: ' + err.message, 'error');
      }
    });
  }

  openPurchaseModal(plan) {
    this.selectedPlanForPurchase = plan;
    const modal = this.container.querySelector('#purchase-modal-backdrop');
    const nameEl = this.container.querySelector('#modal-plan-name');
    const descEl = this.container.querySelector('#modal-plan-desc');
    const priceEl = this.container.querySelector('#modal-plan-price');

    if (nameEl) nameEl.textContent = plan.name;
    if (descEl) descEl.textContent = plan.description || 'Full creator access';
    if (priceEl) priceEl.textContent = `${plan.price} / ${plan.billing || 'mo'}`;

    if (modal) modal.classList.add('open');
  }
}
