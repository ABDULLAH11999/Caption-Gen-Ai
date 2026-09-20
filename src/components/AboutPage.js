export class AboutPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.container = null;
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'section-wrap static-content-page';
    this.container.innerHTML = `
      <div class="section-header-center">
        <span class="badge badge-coral" style="margin-bottom: 12px;">Our Mission</span>
        <h1 class="section-heading">About Zen Caption AI</h1>
        <p class="section-subheading">Empowering short-form creators with zero-latency, private, client-side AI captioning.</p>
      </div>

      <div class="card" style="max-width: 860px; margin: 0 auto 40px auto; padding: 40px; line-height: 1.8;">
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 14px; color: #0c0c0e;">The Story Behind Zen Caption AI</h2>
        <p style="color: #4b5563; margin-bottom: 20px;">
          Zen Caption AI was founded with a singular purpose: to free creators from exorbitant cloud subscription fees, invasive watermarks, and slow cloud rendering queues. Traditional captioning services upload your private personal footage to remote server farms, incurring huge compute costs and latency.
        </p>

        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 14px; color: #0c0c0e;">Edge AI &amp; Total Privacy</h2>
        <p style="color: #4b5563; margin-bottom: 20px;">
          By leveraging state-of-the-art WebAssembly (WASM), Web Audio API, and Direct3D GPU shaders, Zen Caption AI runs the entire speech-to-text pipeline directly in your web browser. Your video files never leave your device. Your data remains 100% private, and your exports complete at buttery-smooth 60 FPS speeds.
        </p>

        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 14px; color: #0c0c0e;">Engineered for High-Retention Growth</h2>
        <p style="color: #4b5563; margin-bottom: 24px;">
          Our algorithms analyze spoken cadences to dynamically apply dual-font visual contrast, prominent hero word highlights, and kinetic entrance animations modeled after top-performing TikTok and Instagram Reel creators.
        </p>

        <div style="display: flex; gap: 16px; justify-content: center; margin-top: 20px;">
          <button class="btn btn-primary btn-lg" id="btn-about-launch">
            <span>⚡ Try Zen Caption AI Now</span>
          </button>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.container.querySelector('#btn-about-launch')?.addEventListener('click', () => this.onNavigate('app'));
    return this.container;
  }
}
