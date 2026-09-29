// Google reCAPTCHA Service for Contact and Purchase Request Forms
// Handles dynamic enabled/disabled toggle from backend configuration

class RecaptchaService {
  constructor() {
    this.config = null;
    this.scriptLoaded = false;
    this.scriptLoadingPromise = null;
  }

  async getConfig() {
    if (this.config) return this.config;
    try {
      const resp = await fetch('/api/public/recaptcha-config');
      if (resp.ok) {
        this.config = await resp.json();
      } else {
        this.config = { enabled: false, siteKey: '' };
      }
    } catch {
      this.config = { enabled: false, siteKey: '' };
    }
    return this.config;
  }

  loadScript() {
    if (this.scriptLoaded && window.grecaptcha) {
      return Promise.resolve(window.grecaptcha);
    }
    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = new Promise((resolve, reject) => {
      if (window.grecaptcha && window.grecaptcha.render) {
        this.scriptLoaded = true;
        return resolve(window.grecaptcha);
      }

      const callbackName = '__onRecaptchaLoaded_' + Math.random().toString(36).substring(7);
      window[callbackName] = () => {
        this.scriptLoaded = true;
        delete window[callbackName];
        resolve(window.grecaptcha);
      };

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit`;
      script.async = true;
      script.defer = true;
      script.onerror = (err) => {
        delete window[callbackName];
        this.scriptLoadingPromise = null;
        reject(err);
      };
      document.head.appendChild(script);
    });

    return this.scriptLoadingPromise;
  }

  /**
   * Attaches reCAPTCHA to a form with a container element and submit button.
   * If reCAPTCHA is disabled (status=false), does nothing and keeps button active.
   * If reCAPTCHA is enabled (status=true), disables submit button until solved.
   */
  async attach({ containerEl, submitBtn, onVerified = null, onExpired = null }) {
    const config = await this.getConfig();
    if (!config || !config.enabled || !config.siteKey) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('recaptcha-pending');
      }
      return {
        enabled: false,
        getToken: () => null,
        reset: () => {}
      };
    }

    // reCAPTCHA is enabled -> lock submit button until solved
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('recaptcha-pending');
    }

    if (!containerEl) {
      return {
        enabled: true,
        getToken: () => null,
        reset: () => {}
      };
    }

    containerEl.innerHTML = `
      <div class="recaptcha-holder" style="margin: 14px 0 10px 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 78px;">
        <div class="recaptcha-widget-target"></div>
      </div>
    `;

    const widgetTarget = containerEl.querySelector('.recaptcha-widget-target');
    let currentToken = null;
    let widgetId = null;

    try {
      const grecaptcha = await this.loadScript();
      widgetId = grecaptcha.render(widgetTarget, {
        sitekey: config.siteKey,
        theme: 'light',
        callback: (token) => {
          currentToken = token;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('recaptcha-pending');
          }
          if (onVerified) onVerified(token);
        },
        'expired-callback': () => {
          currentToken = null;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('recaptcha-pending');
          }
          if (onExpired) onExpired();
        },
        'error-callback': () => {
          currentToken = null;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('recaptcha-pending');
          }
          if (onExpired) onExpired();
        }
      });
    } catch (err) {
      console.warn('[reCAPTCHA] Failed to render widget:', err);
    }

    return {
      enabled: true,
      getToken: () => currentToken,
      reset: () => {
        currentToken = null;
        if (widgetId !== null && window.grecaptcha && window.grecaptcha.reset) {
          try {
            window.grecaptcha.reset(widgetId);
          } catch {}
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.classList.add('recaptcha-pending');
        }
      }
    };
  }
}

export const recaptchaService = new RecaptchaService();
