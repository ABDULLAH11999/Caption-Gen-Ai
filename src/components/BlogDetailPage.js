import { api } from '../services/apiClient.js';

export class BlogDetailPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.container = null;
    this.blog = null;
  }

  async loadSlug(slug) {
    try {
      const res = await api.getBlogBySlug(slug);
      this.blog = res.blog;
      if (this.blog?.title) {
        document.title = `${this.blog.title} - Zen Caption AI Free Caption Tool`;
      }
      const desc = this.blog?.meta_desc || this.blog?.excerpt;
      if (desc) {
        const descEl = document.querySelector('meta[name="description"]');
        if (descEl) descEl.content = desc;
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.content = desc;
      }
      const kwEl = document.querySelector('meta[name="keywords"]');
      if (kwEl) {
        kwEl.content = `free caption tool, free caption video, ${this.blog?.keywords || 'video subtitles, auto caption'}`;
      }
      this.renderContent();
    } catch (err) {
      if (this.container) {
        this.container.innerHTML = `
          <div style="text-align: center; padding: 100px 20px;">
            <h2>Article Not Found</h2>
            <p style="color: #64748b; margin: 16px 0;">The requested article could not be located.</p>
            <button class="btn btn-dark" id="btn-back-blogs">Back to Articles</button>
          </div>
        `;
        this.container.querySelector('#btn-back-blogs')?.addEventListener('click', () => this.onNavigate('blog'));
      }
    }
  }

  render(parentElement, slug) {
    this.container = document.createElement('article');
    this.container.className = 'section-wrap blog-detail-page';
    this.container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <p>Loading article...</p>
      </div>
    `;

    parentElement.appendChild(this.container);
    if (slug) {
      this.loadSlug(slug);
    }
    return this.container;
  }

  formatMarkdown(content) {
    if (!content) return '';
    let html = content
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 19px; font-weight: 800; color: #0c0c0e; margin: 24px 0 10px 0;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 24px; font-weight: 800; color: #0c0c0e; margin: 32px 0 14px 0; border-bottom: 1px solid #edf0f7; padding-bottom: 8px;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="display: none;">$1</h1>')
      .replace(/^\s*\d+\.\s+(.*$)/gim, '<li style="margin-bottom: 8px; color: #374151;">$1</li>')
      .replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-bottom: 8px; color: #374151;">$1</li>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '</p><p style="color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 18px;">');

    return `<p style="color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 18px;">${html}</p>`;
  }

  renderContent() {
    if (!this.container || !this.blog) return;

    const b = this.blog;
    const dateStr = new Date(b.published_at || Date.now()).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const keywords = (b.keywords || '').split(',');

    this.container.innerHTML = `
      <div style="max-width: 840px; margin: 0 auto;">
        <button class="btn btn-outline btn-sm" id="btn-back-to-list" style="margin-bottom: 24px;">
          <span>&larr; Back to Guides</span>
        </button>

        <div style="margin-bottom: 28px;">
          <span class="badge badge-coral" style="margin-bottom: 14px;">Creator Guide</span>
          <h1 style="font-size: clamp(30px, 4vw, 44px); font-weight: 900; line-height: 1.18; color: #0c0c0e; letter-spacing: -0.5px; margin-bottom: 18px;">
            ${b.title}
          </h1>

          <div style="display: flex; align-items: center; gap: 16px; color: #94a3b8; font-size: 13px; font-weight: 700;">
            <span>📅 ${dateStr}</span>
            <span>&bull;</span>
            <span>⏱️ 5 min read</span>
            <span>&bull;</span>
            <span>👁️ ${b.views || 1} reads</span>
          </div>
        </div>

        ${b.featured_image ? `
          <div style="border-radius: var(--radius-xl); overflow: hidden; margin-bottom: 36px; border: 1px solid var(--border-color); max-height: 420px;">
            <img src="${b.featured_image}" alt="${b.title}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        ` : ''}

        <div class="card" style="padding: 44px; margin-bottom: 40px; box-shadow: var(--shadow-sm);">
          <div class="blog-body-markdown">
            ${this.formatMarkdown(b.content)}
          </div>

          <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #edf0f7;">
            <div style="font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px;">Related Keywords</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${keywords.map(kw => `<span class="badge" style="background: #f1f5f9; color: #334155; font-size: 12px;">#${kw.trim()}</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- High-Conversion Bottom CTA Banner -->
        <div class="card card-peach" style="padding: 36px; text-align: center; border-radius: var(--radius-xl);">
          <span class="badge badge-coral" style="margin-bottom: 12px;">Ready to Elevate Your Content?</span>
          <h2 style="font-size: 26px; font-weight: 800; color: #0c0c0e; margin-bottom: 10px;">Apply Viral Captions in 3 Clicks</h2>
          <p style="color: #64748b; max-width: 520px; margin: 0 auto 24px auto; font-size: 15px;">
            Experience 16+ viral templates, automatic Whisper speech recognition, and 60 FPS lossless video export directly in your browser.
          </p>
          <button class="btn btn-primary btn-lg" id="btn-blog-cta-launch">
            <span>⚡ Launch Free Studio</span>
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-back-to-list')?.addEventListener('click', () => this.onNavigate('blog'));
    this.container.querySelector('#btn-blog-cta-launch')?.addEventListener('click', () => this.onNavigate('app'));
  }
}
