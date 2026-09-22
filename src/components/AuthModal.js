import { api } from '../services/apiClient.js';

export class AuthModal {
  constructor({ onAuthSuccess, showToast }) {
    this.onAuthSuccess = onAuthSuccess;
    this.showToast = showToast || console.log;
    this.container = null;
    this.currentTab = 'signin'; // 'signin' | 'signup' | 'otp'
    this.signupData = null; // { name, username, email, password }
    this.checkDebounce = null;
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'saas-modal-backdrop';
    this.container.id = 'auth-modal-backdrop';
    this.container.innerHTML = `
      <div class="saas-modal-dialog auth-modal-dialog">
        <div class="saas-modal-header">
          <div class="auth-brand-badge">
            <span class="brand-rhombus"></span>
            <span class="auth-brand-text">Zen Caption AI</span>
          </div>
          <button class="saas-modal-close" id="btn-close-auth" aria-label="Close">&times;</button>
        </div>

        <div class="auth-tabs" id="auth-tab-bar">
          <button type="button" class="auth-tab-btn active" data-tab="signin" id="tab-signin">Sign In</button>
          <button type="button" class="auth-tab-btn" data-tab="signup" id="tab-signup">Sign Up</button>
        </div>

        <!-- 1. SIGN IN FORM -->
        <div class="auth-form-view" id="view-signin">
          <h2 class="auth-heading">Welcome Back</h2>
          <p class="auth-subheading">Access your saved templates and high-FPS video studio.</p>

          <form id="form-signin" class="auth-form">
            <div class="form-group">
              <label class="form-label" for="signin-id">Username or Email</label>
              <input type="text" class="form-control" id="signin-id" placeholder="e.g. alex or alex@example.com" required autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label" for="signin-pass">Password</label>
              <input type="password" class="form-control" id="signin-pass" placeholder="Enter your password" required autocomplete="current-password">
            </div>
            <div id="signin-error" class="auth-error-box" style="display: none;"></div>
            <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-submit-signin">
              <span>Sign In to Dashboard</span>
            </button>
          </form>

          <div class="auth-footer-prompt">
            <span>Don't have an account?</span>
            <button type="button" class="btn-link" id="link-goto-signup">Create one in 10 seconds</button>
          </div>
        </div>

        <!-- 2. SIGN UP FORM -->
        <div class="auth-form-view" id="view-signup" style="display: none;">
          <h2 class="auth-heading">Create Free Account</h2>
          <p class="auth-subheading">Generate viral subtitles with zero watermarks.</p>

          <form id="form-signup" class="auth-form">
            <div class="form-group">
              <label class="form-label" for="signup-name">Full Name</label>
              <input type="text" class="form-control" id="signup-name" placeholder="e.g. Alex Hormozi" required>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" for="signup-username" style="margin-bottom: 0;">Username</label>
                <span class="username-status-badge" id="username-status" style="display: none;"></span>
              </div>
              <input type="text" class="form-control" id="signup-username" placeholder="Choose a username" required autocomplete="username">
              
              <div class="suggested-usernames-box" id="suggested-usernames-box" style="display: none;">
                <span class="suggest-label">Suggested:</span>
                <div class="suggest-pills" id="suggest-pills-list"></div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="signup-email">Email Address</label>
              <input type="email" class="form-control" id="signup-email" placeholder="name@example.com" required autocomplete="email">
            </div>

            <div class="form-group">
              <label class="form-label" for="signup-pass">Password</label>
              <input type="password" class="form-control" id="signup-pass" placeholder="Create a strong password" required autocomplete="new-password">
            </div>

            <div id="signup-error" class="auth-error-box" style="display: none;"></div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-submit-signup">
              <span>Continue &amp; Get Code</span>
            </button>
          </form>

          <div class="auth-footer-prompt">
            <span>Already registered?</span>
            <button type="button" class="btn-link" id="link-goto-signin">Sign in</button>
          </div>
        </div>

        <!-- 3. OTP VERIFICATION FORM -->
        <div class="auth-form-view" id="view-otp" style="display: none;">
          <div class="otp-badge-icon">🔐</div>
          <h2 class="auth-heading">Enter Verification Code</h2>
          <p class="auth-subheading" id="otp-subheading">We sent a 6-digit security code to your email.</p>

          <form id="form-otp" class="auth-form">
            <div class="form-group" style="text-align: center;">
              <input type="text" class="form-control otp-input-field" id="otp-code-input" maxlength="6" placeholder="000000" autocomplete="one-time-code" required>
              <span class="otp-hint-text">Check your inbox or spam folder for your Zen Caption code</span>
            </div>

            <div id="otp-error" class="auth-error-box" style="display: none;"></div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-submit-otp">
              <span>Verify &amp; Enter Studio</span>
            </button>
          </form>

          <div class="auth-footer-prompt" style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px;">
            <button type="button" class="btn-link" id="link-back-to-signup">&larr; Change Email</button>
            <button type="button" class="btn-link" id="btn-resend-otp" style="color: var(--primary-coral); font-weight: 700;">Resend Code</button>
          </div>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.bindEvents();
    return this.container;
  }

  open(initialTab = 'signin') {
    this.currentTab = initialTab;
    this.switchView(initialTab);
    this.container.classList.add('open');

    if (initialTab === 'signup') {
      this.loadSuggestedUsernames('creator');
    }
  }

  close() {
    this.container.classList.remove('open');
  }

  switchView(tab) {
    this.currentTab = tab;
    const viewSignin = this.container.querySelector('#view-signin');
    const viewSignup = this.container.querySelector('#view-signup');
    const viewOtp = this.container.querySelector('#view-otp');
    const tabBar = this.container.querySelector('#auth-tab-bar');

    viewSignin.style.display = tab === 'signin' ? 'block' : 'none';
    viewSignup.style.display = tab === 'signup' ? 'block' : 'none';
    viewOtp.style.display = tab === 'otp' ? 'block' : 'none';

    tabBar.style.display = tab === 'otp' ? 'none' : 'flex';

    this.container.querySelector('#tab-signin')?.classList.toggle('active', tab === 'signin');
    this.container.querySelector('#tab-signup')?.classList.toggle('active', tab === 'signup');
  }

  async loadSuggestedUsernames(name) {
    try {
      const res = await api.getSuggestedUsernames(name);
      const suggestions = res.suggestedUsernames || res.suggestions || [];
      const pillsContainer = this.container.querySelector('#suggest-pills-list');
      const box = this.container.querySelector('#suggested-usernames-box');

      if (pillsContainer && suggestions.length > 0) {
        pillsContainer.innerHTML = suggestions.map(s => `
          <button type="button" class="username-pill-btn" data-username="${s}">${s}</button>
        `).join('');

        if (box) box.style.display = 'flex';

        pillsContainer.querySelectorAll('.username-pill-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const uInput = this.container.querySelector('#signup-username');
            if (uInput) {
              uInput.value = btn.getAttribute('data-username');
              this.checkUsername(uInput.value);
            }
          });
        });

        // Pre-fill first suggestion if input is currently blank
        const uInput = this.container.querySelector('#signup-username');
        if (uInput && !uInput.value && suggestions[0]) {
          uInput.value = suggestions[0];
          this.checkUsername(suggestions[0]);
        }
      } else if (box) {
        box.style.display = 'none';
      }
    } catch (e) {}
  }

  async checkUsername(username) {
    const statusEl = this.container.querySelector('#username-status');
    if (!statusEl) return;

    if (!username) {
      statusEl.style.display = 'none';
      return;
    }

    statusEl.style.display = 'inline-block';

    if (username.length < 3) {
      statusEl.textContent = 'Too short';
      statusEl.className = 'username-status-badge invalid';
      return;
    }

    try {
      const res = await api.checkUsernameAvailable(username);
      if (res.available) {
        statusEl.textContent = '✓ Available';
        statusEl.className = 'username-status-badge available';
      } else {
        statusEl.textContent = '✕ Taken';
        statusEl.className = 'username-status-badge taken';
      }
    } catch (e) {}
  }

  bindEvents() {
    this.container.querySelector('#btn-close-auth')?.addEventListener('click', () => this.close());
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) this.close();
    });

    // Tab switching
    this.container.querySelector('#tab-signin')?.addEventListener('click', () => this.switchView('signin'));
    this.container.querySelector('#tab-signup')?.addEventListener('click', () => this.switchView('signup'));
    this.container.querySelector('#link-goto-signup')?.addEventListener('click', () => this.switchView('signup'));
    this.container.querySelector('#link-goto-signin')?.addEventListener('click', () => this.switchView('signin'));
    this.container.querySelector('#link-back-to-signup')?.addEventListener('click', () => this.switchView('signup'));

    // Dynamic username suggestions based on Name input
    const nameInput = this.container.querySelector('#signup-name');
    nameInput?.addEventListener('input', () => {
      clearTimeout(this.checkDebounce);
      this.checkDebounce = setTimeout(() => {
        if (nameInput.value.trim().length > 1) {
          this.loadSuggestedUsernames(nameInput.value.trim());
        }
      }, 350);
    });

    // Real-time username check on input
    const usernameInput = this.container.querySelector('#signup-username');
    usernameInput?.addEventListener('input', () => {
      clearTimeout(this.checkDebounce);
      this.checkDebounce = setTimeout(() => {
        this.checkUsername(usernameInput.value.trim());
      }, 300);
    });

    // Submit Sign In
    const signinForm = this.container.querySelector('#form-signin');
    signinForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = this.container.querySelector('#signin-id').value.trim();
      const password = this.container.querySelector('#signin-pass').value.trim();
      const errorBox = this.container.querySelector('#signin-error');
      const submitBtn = this.container.querySelector('#btn-submit-signin');

      errorBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Signing in...</span>';

      try {
        const res = await api.signin({ identifier, password });
        this.showToast(`Welcome back, ${res.user.name}!`, 'success');
        this.close();
        this.onAuthSuccess(res.user);
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In to Dashboard</span>';
      }
    });

    // Submit Sign Up (sends OTP)
    const signupForm = this.container.querySelector('#form-signup');
    signupForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.container.querySelector('#signup-name').value.trim();
      const username = this.container.querySelector('#signup-username').value.trim();
      const email = this.container.querySelector('#signup-email').value.trim();
      const password = this.container.querySelector('#signup-pass').value.trim();
      const errorBox = this.container.querySelector('#signup-error');
      const submitBtn = this.container.querySelector('#btn-submit-signup');

      errorBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Sending code...</span>';

      try {
        const res = await api.signup({ name, username, email, password });
        this.signupData = { name, username, email, password };
        const subheading = this.container.querySelector('#otp-subheading');
        if (subheading) {
          subheading.textContent = res.emailDelivered
            ? `We sent a 6-digit security code to ${email}`
            : `Email delivery failed, so we filled the backup code for you.`;
        }
        this.switchView('otp');
        if (res && res.devCode) {
          const otpInput = this.container.querySelector('#otp-code-input');
          if (otpInput) otpInput.value = res.devCode;
          this.showToast(`Email failed, backup code filled automatically.`, 'info');
        } else {
          this.showToast('Verification code sent to your email!', 'info');
        }
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Continue &amp; Get Code</span>';
      }
    });

    // Resend OTP handler
    this.container.querySelector('#btn-resend-otp')?.addEventListener('click', async () => {
      if (!this.signupData?.email) return;
      const resendBtn = this.container.querySelector('#btn-resend-otp');
      resendBtn.disabled = true;
      resendBtn.textContent = 'Resending...';
      try {
        const res = await api.request('/auth/resend-otp', {
          method: 'POST',
          body: { email: this.signupData.email, name: this.signupData.name }
        });
        if (res && res.devCode) {
          const otpInput = this.container.querySelector('#otp-code-input');
          if (otpInput) otpInput.value = res.devCode;
          this.showToast('Email failed, new backup code filled automatically.', 'info');
        } else {
          this.showToast('New verification code sent to your email!', 'info');
        }
      } catch (err) {
        this.showToast(err.message, 'error');
      } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Code';
      }
    });

    // Submit OTP
    const otpForm = this.container.querySelector('#form-otp');
    otpForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = this.container.querySelector('#otp-code-input').value.trim();
      const errorBox = this.container.querySelector('#otp-error');
      const submitBtn = this.container.querySelector('#btn-submit-otp');

      if (!this.signupData) {
        this.switchView('signup');
        return;
      }

      errorBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Verifying code...</span>';

      try {
        const res = await api.verifyOtp({
          email: this.signupData.email,
          code,
          name: this.signupData.name,
          username: this.signupData.username,
          password: this.signupData.password
        });

        this.showToast(`Account verified! Welcome, ${res.user.name}`, 'success');
        this.close();
        this.onAuthSuccess(res.user);
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Verify &amp; Enter Studio</span>';
      }
    });
  }
}
