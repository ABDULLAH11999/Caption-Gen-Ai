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
      <!-- 1. HERO BANNER -->
      <section class="hero-section">
        <div class="hero-pill-tag">
          <span>⚡ Whisper AI &bull; Dual-Font Typography &bull; 60 FPS Export</span>
        </div>

        <h1 class="hero-title">
          Generate Viral Captions for Reels &amp; TikToks in <span class="gradient-text">Seconds</span>.
        </h1>

        <p class="hero-subtitle">
          Transform ordinary videos into high-retention short-form hits. Automated 16kHz speech recognition, Hormozi-style prominent words, and 16+ viral presets. 100% in your browser.
        </p>

        <div class="hero-cta-row">
          <button class="btn btn-primary btn-lg" id="btn-hero-launch">
            <span>⚡ Launch Caption Studio</span>
          </button>
          <a href="#how-it-works" class="btn btn-outline btn-lg" id="btn-hero-learn">
            <span>See How It Works</span>
          </a>
        </div>

        <!-- Flowchart Style Process Banner (Landscape Arrows) -->
        <div class="flowchart-banner-wrap">
          <div class="flowchart-banner-title">Simple 3-Step Instant Creation Flow</div>
          <div class="flowchart-steps-row">
            <div class="flowchart-step-card">
              <div class="step-num-badge">1</div>
              <div class="step-text">
                <h4>Select Video File</h4>
                <p>Drag &amp; drop any MP4 or WebM video. Instant local decoding.</p>
              </div>
            </div>

            <div class="flowchart-arrow">&rarr;</div>

            <div class="flowchart-step-card">
              <div class="step-num-badge">2</div>
              <div class="step-text">
                <h4>AI Auto-Transcription</h4>
                <p>Whisper AI detects speech and applies dual-font keyword colors.</p>
              </div>
            </div>

            <div class="flowchart-arrow">&rarr;</div>

            <div class="flowchart-step-card">
              <div class="step-num-badge">3</div>
              <div class="step-text">
                <h4>Export 60 FPS Video</h4>
                <p>Download broadcast-quality 1080p video with zero lag.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. HOW IT WORKS SECTION -->
      <section class="section-wrap" id="how-it-works">
        <div class="section-header-center">
          <span class="badge badge-coral" style="margin-bottom: 12px;">Architecture</span>
          <h2 class="section-heading">How Zen Caption AI Powers Your Retention</h2>
          <p class="section-subheading">A modern client-edge AI engine designed to keep viewers hooked from the very first frame.</p>
        </div>

        <div class="how-it-works-grid">
          <div class="how-steps-list">
            <div class="how-step-item active">
              <div class="how-step-icon">🎙️</div>
              <div class="how-step-content">
                <h3>16kHz Studio Audio Resampling</h3>
                <p>Smartphone audio is resampled to 16,000Hz mono via hardware OfflineAudioContext, eliminating pitch distortion and achieving 99%+ speech recognition accuracy.</p>
              </div>
            </div>

            <div class="how-step-item">
              <div class="how-step-icon">✨</div>
              <div class="how-step-content">
                <h3>Dual-Font Hero Highlighting</h3>
                <p>Clean sans-serif fonts for normal words paired with bold display fonts for high-impact keywords. Automatically formatted with deep outlines and luminous drop shadows.</p>
              </div>
            </div>

            <div class="how-step-item">
              <div class="how-step-icon">🚀</div>
              <div class="how-step-content">
                <h3>Zero-Lag GPU Video Rendering</h3>
                <p>Direct3D and OpenGL canvas shaders render in under 0.02ms per frame, producing silky-smooth 60 FPS exported videos ready for WhatsApp, Instagram, and TikTok.</p>
              </div>
            </div>
          </div>

          <!-- Right Showcase Mockup Preview -->
          <div class="mockup-preview-container">
            <div class="mockup-header-bar">
              <div class="mockup-dots">
                <div class="mockup-dot red"></div>
                <div class="mockup-dot yellow"></div>
                <div class="mockup-dot green"></div>
              </div>
              <div class="mockup-tag">LIVE PREVIEW 9:16 PORTRAIT</div>
            </div>

            <div class="mockup-screen-area">
              <div class="mockup-caption-line">
                <span class="mockup-word-normal">creating</span>
                <span class="mockup-word-prominent">Viral</span>
                <span class="mockup-word-prominent">Reels</span>
              </div>

              <div class="mockup-controls-overlay">
                <span style="font-size: 12px; color: #a1a1aa; font-weight: 700;">00:03 / 00:13</span>
                <div class="mockup-timeline-track">
                  <div class="mockup-timeline-progress"></div>
                </div>
                <span class="badge badge-coral" style="font-size: 11px;">60 FPS HD+</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. TEMPLATES SHOWCASE SECTION -->
      <section class="section-wrap" id="templates">
        <div class="section-header-center">
          <span class="badge badge-coral" style="margin-bottom: 12px;">Preset Library</span>
          <h2 class="section-heading">16+ Ready-Made Creator Presets</h2>
          <p class="section-subheading">One click to apply proven typographic styles crafted for YouTube Shorts, Reels, and TikTok.</p>
        </div>

        <div class="templates-showcase-grid" id="templates-grid">
          <!-- Populated from CAPTION_TEMPLATES -->
        </div>
      </section>

      <!-- 4. PRICING & PLANS SECTION -->
      <section class="section-wrap" id="pricing">
        <div class="section-header-center">
          <span class="badge badge-coral" style="margin-bottom: 12px;">Flexible Plans</span>
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

          <div class="plan-card" style="margin-top: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong id="modal-plan-name" style="font-size: 18px; color: var(--primary-coral);">Creator Pro</strong>
                <div style="font-size: 13px; color: #64748b;" id="modal-plan-desc">For high-volume video editors and creators.</div>
              </div>
              <div style="font-size: 24px; font-weight: 900; color: #0c0c0e;" id="modal-plan-price">$19 / mo</div>
            </div>
          </div>

          <form id="form-purchase-request">
            <div class="form-group">
              <label class="form-label" for="purchase-name">Full Name</label>
              <input type="text" class="form-control" id="purchase-name" required placeholder="Your full name">
            </div>

            <div class="form-group">
              <label class="form-label" for="purchase-email">Email Address</label>
              <input type="email" class="form-control" id="purchase-email" required placeholder="Where to send invoice & confirmation">
            </div>

            <div class="form-group">
              <label class="form-label" for="purchase-phone">Phone Number <span style="font-weight: 400; color: #94a3b8;">(Optional)</span></label>
              <input type="tel" class="form-control" id="purchase-phone" placeholder="e.g. +1 (555) 019-2834">
            </div>

            <div id="purchase-error" class="auth-error-box" style="display: none;"></div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-submit-purchase" style="margin-top: 20px;">
              <span>Submit Purchase Request</span>
            </button>
          </form>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.renderTemplates();
    this.bindEvents();
    return this.container;
  }

  renderTemplates() {
    const grid = this.container?.querySelector('#templates-grid');
    if (!grid) return;

    grid.innerHTML = CAPTION_TEMPLATES.slice(0, 8).map(tpl => `
      <div class="showcase-tpl-card" data-template-id="${tpl.id}">
        <div class="showcase-tpl-preview" style="background: ${tpl.previewBg};">
          <span style="color: ${tpl.config.textColor}; font-family: ${tpl.config.normalFontFamily}; margin-right: 6px;">${tpl.sampleNormal}</span>
          <span style="color: ${tpl.config.prominentColor}; font-family: ${tpl.config.prominentFontFamily};">${tpl.sampleProminent}</span>
        </div>
        <div class="showcase-tpl-meta">
          <span class="showcase-tpl-title">${tpl.icon} ${tpl.name}</span>
          <span class="badge badge-coral" style="font-size: 10px;">${tpl.badge}</span>
        </div>
        <p class="showcase-tpl-desc">${tpl.scope}</p>
      </div>
    `).join('');

    grid.querySelectorAll('.showcase-tpl-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-template-id');
        this.onNavigate('app', `template=${id}`);
      });
    });
  }

  renderPlans() {
    const grid = this.container?.querySelector('#pricing-grid');
    if (!grid) return;

    const plansToRender = this.plans.length > 0 ? this.plans : [
      { id: 'free', name: 'Free Starter', price: 0, billing_cycle: 'month', short_desc: 'Full 60 FPS studio with AI video enhancement. 3 video exports per day.', features: [{ text: '3 Video captions per day', included: true }, { text: 'All 16 viral presets', included: true }, { text: 'Whisper AI transcription', included: true }, { text: '60 FPS GPU lossless export', included: true }, { text: 'AI Video Quality Enhancement (HD+)', included: true }, { text: 'Full Granular Customizer Studio', included: true }] },
      { id: 'creator-pro', name: 'Creator Pro', price: 19, billing_cycle: 'month', short_desc: 'For YouTubers, TikTokers & agencies seeking maximum watch time.', features: [{ text: '50 Video captions per day', included: true }, { text: 'All 16 Viral & Luxury Presets', included: true }, { text: 'Full Customizer Studio', included: true }, { text: 'Smooth 60 FPS 1080p Export', included: true }, { text: 'AI Video Quality Enhancement (HD+)', included: true }] },
      { id: 'agency-elite', name: 'Agency Elite', price: 49, billing_cycle: 'month', short_desc: 'High-volume production powerhouse for video editors & social agencies.', features: [{ text: 'Unlimited Video Captions', included: true }, { text: 'Custom Brand Font Uploads', included: true }, { text: 'Lossless 4K & 1080p Export', included: true }, { text: '24/7 Priority VIP Support', included: true }] }
    ];

    grid.innerHTML = plansToRender.map(plan => {
      const isFree = Number(plan.price) === 0;
      const isFeatured = plan.id === 'creator-pro';
      const features = Array.isArray(plan.features) ? plan.features : (typeof plan.features === 'string' ? JSON.parse(plan.features || '[]') : []);

      return `
        <div class="pricing-card ${isFeatured ? 'featured' : ''}">
          ${isFeatured ? `<div class="pricing-featured-badge">Most Popular</div>` : ''}
          <div class="pricing-card-header">
            <h3 class="plan-name">${plan.name}</h3>
            <p class="plan-desc">${plan.short_desc || ''}</p>
            <div class="plan-price-row">
              <span class="plan-price">$${Number(plan.price).toFixed(0)}</span>
              <span class="plan-cycle">/ ${plan.billing_cycle || 'month'}</span>
            </div>
          </div>

          <ul class="plan-features-list">
            ${features.map(f => `
              <li class="${f.included ? 'included' : 'not-included'}">${f.text}</li>
            `).join('')}
          </ul>

          <button class="btn ${isFeatured ? 'btn-primary' : (isFree ? 'btn-dark' : 'btn-outline')} btn-plan-action" data-plan-id="${plan.id}">
            <span>${isFree ? 'Start Free Now' : 'Purchase Request'}</span>
          </button>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.btn-plan-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const planId = btn.getAttribute('data-plan-id');
        const plan = plansToRender.find(p => p.id === planId);
        if (!plan) return;

        if (Number(plan.price) === 0) {
          this.onNavigate('app');
        } else {
          this.openPurchaseModal(plan);
        }
      });
    });
  }

  openPurchaseModal(plan) {
    this.selectedPlanForPurchase = plan;
    const modal = this.container?.querySelector('#purchase-modal-backdrop');
    if (!modal) return;

    modal.querySelector('#modal-plan-name').textContent = plan.name;
    modal.querySelector('#modal-plan-desc').textContent = plan.short_desc || 'Priority creator quota';
    modal.querySelector('#modal-plan-price').textContent = `$${Number(plan.price).toFixed(0)} / ${plan.billing_cycle || 'month'}`;

    // Prefill user data if logged in
    const user = api.currentUser;
    const nameInput = modal.querySelector('#purchase-name');
    const emailInput = modal.querySelector('#purchase-email');
    if (user) {
      if (nameInput) nameInput.value = user.name || '';
      if (emailInput) emailInput.value = user.email || '';
    }

    modal.classList.add('open');
  }

  closePurchaseModal() {
    this.container?.querySelector('#purchase-modal-backdrop')?.classList.remove('open');
  }

  bindEvents() {
    this.container.querySelector('#btn-hero-launch')?.addEventListener('click', () => this.onNavigate('app'));

    const purchaseModal = this.container.querySelector('#purchase-modal-backdrop');
    purchaseModal?.querySelector('#btn-close-purchase')?.addEventListener('click', () => this.closePurchaseModal());
    purchaseModal?.addEventListener('click', (e) => {
      if (e.target === purchaseModal) this.closePurchaseModal();
    });

    const purchaseForm = this.container.querySelector('#form-purchase-request');
    purchaseForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.selectedPlanForPurchase) return;

      const name = purchaseModal.querySelector('#purchase-name').value.trim();
      const email = purchaseModal.querySelector('#purchase-email').value.trim();
      const phone = purchaseModal.querySelector('#purchase-phone').value.trim();
      const errorBox = purchaseModal.querySelector('#purchase-error');
      const submitBtn = purchaseModal.querySelector('#btn-submit-purchase');

      errorBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Submitting Request...</span>';

      try {
        await api.submitPurchase({
          name,
          email,
          phone,
          planId: this.selectedPlanForPurchase.id
        });

        this.showToast(`Order received for ${this.selectedPlanForPurchase.name}! Check your email for details.`, 'success');
        this.closePurchaseModal();
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Submit Purchase Request</span>';
      }
    });
  }
}
