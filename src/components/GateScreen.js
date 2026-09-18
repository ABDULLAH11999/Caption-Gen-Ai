// Screen 1: Security Passcode Gate Screen with Split-Door 3D Animation
import { soundFx } from '../services/soundFx.js';

export class GateScreen {
  constructor(options = {}) {
    this.correctPasscode = options.passcode || '7940';
    this.onUnlocked = options.onUnlocked || (() => {});
    this.currentInput = '';
    this.isUnlocked = false;
    this.container = null;
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'gate-screen';
    this.container.id = 'gate-screen';

    this.container.innerHTML = `
      <!-- Left Split Gate Panel -->
      <div class="gate-door-left">
        <div class="gate-panel-decor"></div>
      </div>

      <!-- Central Laser Seam -->
      <div class="gate-seam-laser" id="gate-seam"></div>

      <!-- Right Split Gate Panel -->
      <div class="gate-door-right">
        <div class="gate-panel-decor"></div>
      </div>

      <!-- Center Holographic Passcode Terminal -->
      <div class="gate-terminal-container" id="gate-terminal">
        <div class="terminal-header">
          <div class="terminal-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 class="terminal-title">SECURITY GATE</h2>
          <p class="terminal-subtitle">ENTER ACCESS AUTHORIZATION CODE</p>
        </div>

        <div class="pin-display-wrapper">
          <div class="pin-display" id="pin-slots">
            <div class="pin-digit-slot" data-index="0">-</div>
            <div class="pin-digit-slot" data-index="1">-</div>
            <div class="pin-digit-slot" data-index="2">-</div>
            <div class="pin-digit-slot" data-index="3">-</div>
          </div>
          <div class="pin-error-feedback" id="pin-feedback">ACCESS DENIED - INVALID PASSCODE</div>
        </div>

        <!-- Numeric Keypad -->
        <div class="keypad-grid">
          <button class="keypad-btn" data-key="1">1</button>
          <button class="keypad-btn" data-key="2">2</button>
          <button class="keypad-btn" data-key="3">3</button>
          <button class="keypad-btn" data-key="4">4</button>
          <button class="keypad-btn" data-key="5">5</button>
          <button class="keypad-btn" data-key="6">6</button>
          <button class="keypad-btn" data-key="7">7</button>
          <button class="keypad-btn" data-key="8">8</button>
          <button class="keypad-btn" data-key="9">9</button>
          <button class="keypad-btn action-btn" data-action="clear">CLR</button>
          <button class="keypad-btn" data-key="0">0</button>
          <button class="keypad-btn action-btn" data-action="backspace">⌫</button>
        </div>

        <div style="margin-top: 14px;">
          <button class="keypad-btn unlock-btn" id="btn-submit-unlock" style="width: 100%;">
            UNLOCK GATE
          </button>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.bindEvents();
    this.updateSlots();
  }

  bindEvents() {
    // Click on keypad buttons
    this.container.querySelectorAll('.keypad-btn[data-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFx.playKeyBeep(640);
        this.appendDigit(btn.getAttribute('data-key'));
      });
    });

    // Clear
    this.container.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
      soundFx.playKeyBeep(420);
      this.clearInput();
    });

    // Backspace
    this.container.querySelector('[data-action="backspace"]')?.addEventListener('click', () => {
      soundFx.playKeyBeep(480);
      this.popDigit();
    });

    // Submit Unlock Button
    this.container.querySelector('#btn-submit-unlock')?.addEventListener('click', () => {
      this.validateCode();
    });

    // Physical Keyboard Listener
    window.addEventListener('keydown', (e) => {
      if (this.isUnlocked) return;
      if (/^[0-9]$/.test(e.key)) {
        soundFx.playKeyBeep(640);
        this.appendDigit(e.key);
      } else if (e.key === 'Backspace') {
        soundFx.playKeyBeep(480);
        this.popDigit();
      } else if (e.key === 'Enter') {
        this.validateCode();
      } else if (e.key === 'Escape') {
        this.clearInput();
      }
    });
  }

  appendDigit(digit) {
    if (this.currentInput.length < 4) {
      this.currentInput += digit;
      this.updateSlots();
      if (this.currentInput.length === 4) {
        setTimeout(() => this.validateCode(), 120);
      }
    }
  }

  popDigit() {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
      this.updateSlots();
    }
  }

  clearInput() {
    this.currentInput = '';
    this.updateSlots();
    const feedback = this.container.querySelector('#pin-feedback');
    if (feedback) feedback.classList.remove('visible');
  }

  updateSlots() {
    const slots = this.container.querySelectorAll('.pin-digit-slot');
    slots.forEach((slot, idx) => {
      if (idx < this.currentInput.length) {
        slot.textContent = '•'; // Masked or this.currentInput[idx]
        slot.classList.add('filled');
        slot.classList.remove('active');
      } else if (idx === this.currentInput.length) {
        slot.textContent = '_';
        slot.classList.remove('filled');
        slot.classList.add('active');
      } else {
        slot.textContent = '-';
        slot.classList.remove('filled');
        slot.classList.remove('active');
      }
    });
  }

  validateCode() {
    const feedback = this.container.querySelector('#pin-feedback');
    const terminal = this.container.querySelector('#gate-terminal');

    if (this.currentInput === this.correctPasscode) {
      // SUCCESS: Access Granted
      this.isUnlocked = true;
      soundFx.playUnlockChime();

      // First ignite center laser seam on valid password
      this.container.classList.add('opening');

      setTimeout(() => {
        // Trigger hydraulic sound and split doors
        soundFx.playGateOpenSound();
        this.container.classList.add('open');
      }, 350);

      setTimeout(() => {
        this.container.classList.add('unlocked');
        this.container.style.display = 'none';
        if (this.onUnlocked) this.onUnlocked();
      }, 1400);

    } else {
      // FAILURE: Access Denied
      soundFx.playErrorSound();
      if (feedback) {
        feedback.textContent = 'ACCESS DENIED - INCORRECT PASSCODE';
        feedback.classList.add('visible');
      }
      if (terminal) {
        terminal.classList.add('shake-gate');
        setTimeout(() => {
          terminal.classList.remove('shake-gate');
          this.clearInput();
        }, 500);
      }
    }
  }

  lockGate() {
    this.isUnlocked = false;
    this.currentInput = '';
    this.container.style.display = '';
    this.container.classList.remove('opening', 'open', 'unlocked');
    this.updateSlots();
    soundFx.playGateOpenSound();
  }
}
