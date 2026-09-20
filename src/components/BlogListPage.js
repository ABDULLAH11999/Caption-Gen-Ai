import { api } from '../services/apiClient.js';

export class BlogListPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.container = null;
    this.blogs = [];
    this.filteredBlogs = [];
  }

  async init() {
    try {
      const res = await api.getBlogs();
      this.blogs = res.blogs || [];
      this.filteredBlogs = [...this.blogs];
      this.renderBlogs();
    } catch (e) {
      console.warn('Failed to load blogs:', e);
    }
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'section-wrap blog-list-page';
    this.container.innerHTML = `
      <div class="section-header-center">
        <span class="badge badge-coral" style="margin-bottom: 12px;">Creator Guides &amp; SEO Insights</span>
        <h1 class="section-heading">The Viral Video Playbook</h1>
        <p class="section-subheading">In-depth guides on AI captions, typography psychology, and short-form video retention strategies.</p>
        
        <div style="max-width: 480px; margin: 30px auto 0 auto; position: relative;">
          <input type="text" class="form-control" id="blog-search-input" placeholder="🔍 Search guides by keyword or topic..." style="padding-left: 20px; border-radius: 999px; height: 50px;">
        </div>
      </div>

      <div class="blog-grid" id="blog-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 28px; margin-top: 40px;">
        <!-- Populated by renderBlogs() -->
      </div>
    `;

    parentElement.appendChild(this.container);
    this.bindEvents();
    this.init();
    return this.container;
  }

  renderBlogs() {
    const grid = this.container?.querySelector('#blog-cards-grid');
    if (!grid) return;

    if (this.filteredBlogs.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #64748b;">
          <h3>No articles found matching your search.</h3>
          <p>Try searching for "Hormozi", "60 FPS", or "Reels".</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.filteredBlogs.map(b => {
      const dateStr = new Date(b.published_at || Date.now()).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const keywords = (b.keywords || '').split(',').slice(0, 3);

      return `
        <article class="card blog-card" data-slug="${b.slug}" style="cursor: pointer; padding: 0; overflow: hidden; display: flex; flex-direction: column;">
          <div style="height: 190px; background: #ffffff url('${b.featured_image || '/default-blog-cover.jpg'}') center/cover no-repeat; border-bottom: 1px solid var(--border-color);"></div>
          
          <div style="padding: 24px; display: flex; flex-direction: column; flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 12px; color: #94a3b8; font-weight: 700;">
              <span>${dateStr}</span>
              <span>${b.views || 0} views</span>
            </div>

            <h3 style="font-size: 18px; font-weight: 800; color: #0c0c0e; line-height: 1.35; margin-bottom: 10px;">${b.title}</h3>
            <p style="font-size: 14px; color: #64748b; line-height: 1.55; margin-bottom: 18px; flex: 1;">${b.excerpt || ''}</p>

            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${keywords.map(kw => `<span class="badge" style="background: #f1f5f9; color: #475569; font-size: 11px;">#${kw.trim()}</span>`).join('')}
            </div>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('.blog-card').forEach(card => {
      card.addEventListener('click', () => {
        const slug = card.getAttribute('data-slug');
        this.onNavigate('blog-detail', `slug=${slug}`);
      });
    });
  }

  bindEvents() {
    const searchInput = this.container.querySelector('#blog-search-input');
    searchInput?.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      this.filteredBlogs = this.blogs.filter(b => 
        b.title.toLowerCase().includes(q) || 
        (b.excerpt && b.excerpt.toLowerCase().includes(q)) || 
        (b.keywords && b.keywords.toLowerCase().includes(q))
      );
      this.renderBlogs();
    });
  }
}
