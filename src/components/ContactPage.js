import { api } from '../services/apiClient.js';
import { recaptchaService } from '../utils/recaptchaService.js';

export class ContactPage {
  constructor({ onNavigate, showToast }) {
    this.onNavigate = onNavigate;
    this.showToast = showToast || console.log;
    this.container = null;
    this.recaptchaInstance = null;
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'section-wrap static-content-page';
    this.container.innerHTML = `
      <div class="section-header-center">
        <span class="badge badge-coral" style="margin-bottom: 12px;">Get In Touch</span>
        <h1 class="section-heading">Contact Support &amp; Partnerships</h1>
        <p class="section-subheading">Have questions about plans, custom fonts, or high-volume agency accounts? Send us a message.</p>
      </div>

      <div class="card" style="max-width: 680px; margin: 0 auto 40px auto; padding: 40px;">
        <form id="form-contact">
          <div class="form-group">
            <label class="form-label" for="contact-name">Your Name</label>
            <input type="text" class="form-control" id="contact-name" placeholder="Full name" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="contact-email">Email Address</label>
            <input type="email" class="form-control" id="contact-email" placeholder="name@example.com" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="contact-subject">Subject</label>
            <input type="text" class="form-control" id="contact-subject" placeholder="What can we help you with?">
          </div>

          <div class="form-group">
            <label class="form-label" for="contact-message">Message</label>
            <textarea class="form-control" id="contact-message" placeholder="Type your message here..." required></textarea>
          </div>

          <div id="contact-msg-box" class="auth-error-box" style="display: none;"></div>

          <div id="contact-recaptcha-container"></div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-submit-contact" style="margin-top: 16px;">
            <span>Send Message</span>
          </button>
        </form>
      </div>
    `;

    parentElement.appendChild(this.container);

    const form = this.container.querySelector('#form-contact');
    const submitBtn = this.container.querySelector('#btn-submit-contact');
    const recaptchaContainer = this.container.querySelector('#contact-recaptcha-container');

    recaptchaService.attach({
      containerEl: recaptchaContainer,
      submitBtn
    }).then(inst => {
      this.recaptchaInstance = inst;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.container.querySelector('#contact-name').value.trim();
      const email = this.container.querySelector('#contact-email').value.trim();
      const subject = this.container.querySelector('#contact-subject').value.trim();
      const message = this.container.querySelector('#contact-message').value.trim();

      const recaptchaToken = this.recaptchaInstance?.getToken?.() || null;
      if (this.recaptchaInstance?.enabled && !recaptchaToken) {
        this.showToast('Please verify the reCAPTCHA checkbox before submitting.', 'error');
        if (submitBtn) submitBtn.disabled = true;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Sending message...</span>';

      try {
        await api.submitContact({ name, email, subject, message, recaptchaToken });
        form.reset();
        this.recaptchaInstance?.reset?.();
        this.openContactSuccessModal({ name, email });
      } catch (err) {
        this.showToast(err.message, 'error');
        if (!this.recaptchaInstance?.enabled) {
          submitBtn.disabled = false;
        }
      } finally {
        if (!this.recaptchaInstance?.enabled || this.recaptchaInstance?.getToken?.()) {
          submitBtn.disabled = false;
        }
        submitBtn.innerHTML = '<span>Send Message</span>';
      }
    });

    return this.container;
  }

  openContactSuccessModal({ name, email }) {
    let modal = document.getElementById('contact-success-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'saas-modal-backdrop';
      modal.id = 'contact-success-modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="saas-modal-dialog" style="max-width: 480px; text-align: center; padding: 36px 28px;">
        <div style="width: 64px; height: 64px; margin: 0 auto 20px auto; border-radius: 50%; background: #ecfdf5; border: 2px solid #a7f3d0; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.2);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h3 style="font-size: 24px; font-weight: 800; color: #0c0c0e; margin: 0 0 10px 0; letter-spacing: -0.5px;">
          Message Sent Successfully!
        </h3>

        <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
          Thank you, <strong>${name || 'there'}</strong>! We have received your inquiry.
        </p>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 16px; margin-bottom: 24px; text-align: left; display: flex; gap: 14px; align-items: center;">
          <span style="font-size: 26px;">📬</span>
          <div style="font-size: 13px; color: #9a3412; line-height: 1.55;">
            <strong>Support SLA:</strong> Our team will review your message and contact you <strong>within 24 hours via email</strong> at <strong>${email}</strong>.
          </div>
        </div>

        <button type="button" class="btn btn-primary btn-block btn-lg" id="btn-close-contact-success" style="width: 100%; justify-content: center;">
          Done
        </button>
      </div>
    `;

    const close = () => modal.classList.remove('open');
    modal.querySelector('#btn-close-contact-success')?.addEventListener('click', close);
    modal.onclick = (e) => { if (e.target === modal) close(); };
    requestAnimationFrame(() => modal.classList.add('open'));
  }
}

