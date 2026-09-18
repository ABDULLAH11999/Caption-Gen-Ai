// Main Application Bootstrapper
import './styles/main.css';
import './styles/gate-screen.css';
import './styles/upload-screen.css';
import './styles/tool-modal.css';
import './styles/captions.css';

import { APP_CONFIG } from './config.js';
import { GateScreen } from './components/GateScreen.js';
import { UploadScreen } from './components/UploadScreen.js';
import { ToolStudioModal } from './components/ToolStudioModal.js';
import { storage } from './services/storageService.js';

class ZenApp {
  constructor() {
    this.appRoot = null;
    this.gateScreen = null;
    this.uploadScreen = null;
    this.toolStudio = null;
    this.toastContainer = null;
  }

  async init() {
    this.appRoot = document.getElementById('app') || document.body;
    this.setupToastContainer();

    try {
      // 1. Initialize Tool Studio (Screen 3)
      this.toolStudio = new ToolStudioModal({
        onConfigChanged: (config, mode) => {
          if (this.uploadScreen) {
            this.uploadScreen.setConfig(config, mode);
          }
        }
      });
      await this.toolStudio.initConfigs();
      this.toolStudio.render(this.appRoot);

      // 2. Initialize Upload & Caption Workspace (Screen 2)
      this.uploadScreen = new UploadScreen({
        onOpenStyleStudio: (currentMode) => {
          this.toolStudio.open(currentMode);
        },
        onLockGate: () => {
          sessionStorage.removeItem('zen_unlocked');
          this.gateScreen.lockGate();
          this.showToast('Security gate locked.', 'warning');
        },
        showToast: (msg, type) => this.showToast(msg, type)
      });
      this.uploadScreen.render(this.appRoot);
      this.uploadScreen.setConfig(this.toolStudio.getActiveConfig(), this.toolStudio.currentMode);

      // 3. Initialize Passcode Security Gate (Screen 1)
      this.gateScreen = new GateScreen({
        passcode: APP_CONFIG.SITE_PASSCODE,
        onUnlocked: () => {
          sessionStorage.setItem('zen_unlocked', 'true');
          this.showToast('Access Authorized: Welcome to Zen Caption AI Studio', 'success');
        }
      });
      this.gateScreen.render(this.appRoot);

      // Check if user was already unlocked in this session
      const unlockedSession = sessionStorage.getItem('zen_unlocked');
      if (unlockedSession === 'true') {
        this.gateScreen.container.classList.add('open', 'unlocked');
        this.gateScreen.container.style.display = 'none';
        this.gateScreen.isUnlocked = true;
      }

      this.initOfflineService();
    } catch (err) {
      console.error('[ZenApp] Critical initialization error:', err);
      if (this.appRoot) {
        const errorCard = document.createElement('div');
        errorCard.style.cssText = 'padding: 40px 20px; text-align: center; color: #fff; font-family: sans-serif;';
        errorCard.innerHTML = `
          <h2 style="color: #00F0FF; margin-bottom: 12px;">Zen AI Caption Studio</h2>
          <p style="color: #ef4444; margin-bottom: 16px;">Failed to initialize interface. Retrying...</p>
          <button onclick="window.location.reload(true)" style="padding: 10px 20px; background: #00F0FF; color: #000; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
            Reload Studio
          </button>
        `;
        this.appRoot.appendChild(errorCard);
      }
    }
  }

  setupToastContainer() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    document.body.appendChild(this.toastContainer);
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span style="font-weight: 800; font-size: 1.1rem;">${icon}</span>
      <span>${message}</span>
    `;

    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4200);
  }

  initOfflineService() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration:', err.message);
      });
    }
  }
}

// Resilient Bootstrapper (handles both pre-DOM and post-DOM evaluation)
function bootstrapZenApp() {
  const app = new ZenApp();
  app.init().catch(err => {
    console.error('[ZenApp] Boot error:', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapZenApp);
} else {
  bootstrapZenApp();
}
