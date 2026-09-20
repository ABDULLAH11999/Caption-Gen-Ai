import { api } from '../services/apiClient.js';

export class ContactPage {
  constructor({ onNavigate, showToast }) {
    this.onNavigate = onNavigate;
    this.showToast = showToast || console.log;
    this.container = null;
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

          <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-submit-contact" style="margin-top: 16px;">
            <span>Send Message</span>
          </button>
        </form>
      </div>
    `;

    parentElement.appendChild(this.container);

    const form = this.container.querySelector('#form-contact');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.container.querySelector('#contact-name').value.trim();
      const email = this.container.querySelector('#contact-email').value.trim();
      const subject = this.container.querySelector('#contact-subject').value.trim();
      const message = this.container.querySelector('#contact-message').value.trim();
      const submitBtn = this.container.querySelector('#btn-submit-contact');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Sending message...</span>';

      try {
        await api.submitContact({ name, email, subject, message });
        this.showToast('Your message has been sent! Our team will reply shortly.', 'success');
        form.reset();
      } catch (err) {
        this.showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Send Message</span>';
      }
    });

    return this.container;
  }
}
