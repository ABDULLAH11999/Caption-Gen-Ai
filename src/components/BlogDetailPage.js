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
      .replace(/^### (.*$)/gim, '<h3 class="blog-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="blog-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="display: none;">$1</h1>')
      .replace(/^> (.*$)/gim, '<blockquote class="blog-quote-box"><p>$1</p></blockquote>')
      .replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="blog-list-item numbered">$1</li>')
      .replace(/^\s*[-*]\s+(.*$)/gim, '<li class="blog-list-item">$1</li>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="blog-strong">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '</p><p class="blog-paragraph">');

    return `<p class="blog-paragraph">${html}</p>`;
  }

  renderContent() {
    if (!this.container || !this.blog) return;

    const b = this.blog;
    const dateStr = new Date(b.published_at || Date.now()).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const keywords = (b.keywords || '').split(',').filter(Boolean);

    // Calculate reading time roughly from word count
    const wordCount = (b.content || '').split(/\s+/).length;
    const readTimeMin = Math.max(3, Math.round(wordCount / 180));

    this.container.innerHTML = `
      <div class="blog-detail-container">
        <!-- Top Nav & Breadcrumb -->
        <nav class="blog-detail-breadcrumb" aria-label="Breadcrumb">
          <button class="btn btn-outline btn-sm btn-pill" id="btn-back-to-list">
            <span>&larr; Back to Creator Guides</span>
          </button>
          <div class="breadcrumb-trail">
            <span>Home</span>
            <span class="breadcrumb-sep">/</span>
            <span>Guides</span>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">${b.slug}</span>
          </div>
        </nav>

        <!-- Article Hero Header -->
        <header class="blog-article-header">
          <div class="blog-header-badge-row">
            <span class="badge badge-purple">✨ Creator Playbook &amp; Strategy</span>
            <span class="blog-views-pill">👁️ ${(b.views || 0) + 128} Reads</span>
          </div>

          <h1 class="blog-article-title">
            ${b.title}
          </h1>

          <div class="blog-author-bar">
            <div class="blog-author-info">
              <span class="blog-author-name">Zen AI Creator Lab</span>
              <div class="blog-meta-subline">
                <span>📅 Published on ${dateStr}</span>
                <span class="meta-dot">&bull;</span>
                <span>⏱️ ${readTimeMin} min read</span>
                <span class="meta-dot">&bull;</span>
                <span class="badge badge-success" style="font-size: 10px; padding: 2px 7px;">Verified Strategy</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Reading Card (Frosted Glass Container) -->
        <main class="blog-glass-reading-card">
          <div class="blog-body-markdown">
            ${this.formatMarkdown(b.content)}
          </div>

          <!-- Bottom Article Metadata & Tags -->
          <footer class="blog-article-footer">
            <div class="blog-tags-label">Related SEO Keywords &amp; Topics</div>
            <div class="blog-keywords-flex">
              ${keywords.map(kw => `<span class="blog-tag-badge">#${kw.trim()}</span>`).join('')}
            </div>

            <!-- Share Bar -->
            <div class="blog-share-row">
              <span class="share-label">Share this playbook:</span>
              <button type="button" class="btn btn-outline btn-sm" id="btn-copy-article-link">
                <span>🔗 Copy Link</span>
              </button>
            </div>
          </footer>
        </main>

        <!-- High-Conversion Bottom CTA Banner -->
        <section class="blog-cta-banner">
          <div class="cta-glow-orb"></div>
          <span class="badge badge-purple" style="margin-bottom: 14px;">Instant Creator Studio</span>
          <h2 class="blog-cta-title">Apply Viral Subtitles in 3 Clicks</h2>
          <p class="blog-cta-desc">
            Transform raw video into viral TikTok, Reel, and YouTube Shorts clips with automatic Whisper transcription, 16+ aesthetic presets, and 60 FPS lossless export.
          </p>
          <button class="btn btn-black btn-lg" id="btn-blog-cta-launch">
            <span>⚡ Launch Free Studio Now</span>
          </button>
        </section>
      </div>
    `;

    this.container.querySelector('#btn-back-to-list')?.addEventListener('click', () => this.onNavigate('blog'));
    this.container.querySelector('#btn-blog-cta-launch')?.addEventListener('click', () => this.onNavigate('app'));
    
    // Copy link helper
    this.container.querySelector('#btn-copy-article-link')?.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        const btn = this.container.querySelector('#btn-copy-article-link span');
        if (btn) btn.textContent = '✓ Copied to Clipboard!';
        setTimeout(() => {
          if (btn) btn.textContent = '🔗 Copy Link';
        }, 2500);
      }
    });
  }
}
