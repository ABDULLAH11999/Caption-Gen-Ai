export class Footer {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.container = null;
  }

  render(parentElement) {
    this.container = document.createElement('footer');
    this.container.className = 'saas-footer';
    this.container.innerHTML = `
      <div class="saas-footer-inner">
        <div class="footer-col footer-brand-col">
          <div class="footer-brand">
            <span class="brand-rhombus"></span>
            <span class="brand-name">Zen Caption AI</span>
          </div>
          <p class="footer-desc">
            Next-generation in-browser AI caption studio. Automatic 16kHz speech recognition, dual-font viral typography, and buttery-smooth 60 FPS lossless video export.
          </p>
          <div class="footer-status-pill">
            <span class="status-dot"></span>
            <span>All Systems Operational (Client Edge AI)</span>
          </div>
        </div>

        <div class="footer-col">
          <h4 class="footer-heading">Product</h4>
          <ul class="footer-links">
            <li><a href="/" data-route="home">Home</a></li>
            <li><a href="/#how-it-works" data-route="how-it-works">How It Works</a></li>
            <li><a href="/#templates" data-route="templates">16+ Viral Templates</a></li>
            <li><a href="/#pricing" data-route="pricing">Pricing Plans</a></li>
            <li><a href="/app" data-route="app">Launch App</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4 class="footer-heading">Company</h4>
          <ul class="footer-links">
            <li><a href="/about" data-route="about">About Us</a></li>
            <li><a href="/contact" data-route="contact">Contact Support</a></li>
            <li><a href="/terms" data-route="terms">Terms of Service</a></li>
            <li><a href="/cookies" data-route="cookies">Cookie Policy</a></li>
            <li><a href="/sitemap.xml" target="_blank">Sitemap</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4 class="footer-heading">SEO &amp; Resources</h4>
          <ul class="footer-links">
            <li><a href="/blog" data-route="blog">Creator Blog &amp; Guides</a></li>
            <li><a href="/blog/how-to-add-hormozi-style-captions-to-tiktoks-and-reels-in-2026" data-route="blog-detail">Hormozi Captions Guide</a></li>
            <li><a href="/blog/top-10-video-caption-generators-for-viral-social-media-growth" data-route="blog-detail">Top 10 Caption Tools</a></li>
            <li><a href="/blog/exporting-60-fps-captioned-videos-without-lag-or-stutter" data-route="blog-detail">60 FPS Video Export</a></li>
          </ul>
        </div>
      </div>

      <div class="saas-footer-bottom">
        <div class="footer-bottom-inner">
          <p>&copy; ${new Date().getFullYear()} Zen Caption AI Studio. Built for high-growth video creators and agencies.</p>
          <div class="footer-bottom-tags">
            <span>Client-Side Privacy</span>
            <span>&bull;</span>
            <span>Zero Server Latency</span>
            <span>&bull;</span>
            <span>Direct3D GPU Accelerated</span>
          </div>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.bindEvents();
    return this.container;
  }

  bindEvents() {
    this.container.querySelectorAll('a[data-route]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('/#') || href.startsWith('/blog/')) {
          return; // Allow native navigation
        }
        e.preventDefault();
        const route = link.getAttribute('data-route');
        this.onNavigate(route);
      });
    });
  }
}
