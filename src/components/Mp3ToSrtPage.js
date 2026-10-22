import { APP_CONFIG } from '../config.js';
import { speechTranscriber } from '../services/speechTranscriber.js';

const MAX_AUDIO_DURATION_SECONDS = 120 * 60;
const MAX_GROQ_UPLOAD_BYTES = APP_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
const GROQ_TRANSCRIPTION_ENABLED = import.meta.env?.VITE_GROQ_TRANSCRIPTION_ENABLED === 'true';
const MAX_SRT_WORDS_PER_SEGMENT = 8;
// Some download tools save normal MP3 audio with an extra `.mpeg` extension
// (for example, `song.mp3.mpeg`). Treat those files as supported audio.
const AUDIO_EXTENSIONS = /\.(mp3|mp2|mpga|mpeg|wav|m4a|aac|ogg|oga|flac|webm)$/i;
const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mpg', 'audio/x-mpeg', 'audio/mp2',
  'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/aac',
  'audio/ogg', 'audio/flac', 'audio/webm', 'video/mpeg'
]);

const LANGUAGES = {
  en: { label: 'English', native: 'English', hint: 'english', icon: 'EN', description: 'Create English subtitles' },
  hi: { label: 'Hindi', native: 'हिन्दी', hint: 'hindi', icon: 'हि', description: 'Create subtitles in Hindi script' },
  ur: { label: 'Urdu', native: 'اردو', hint: 'urdu', icon: 'اردو', description: 'Create subtitles in Urdu script' }
};

const formatSrtTime = (seconds) => {
  const totalMilliseconds = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const secs = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
};

const splitSentenceForSrt = (sentence) => {
  const text = String(sentence?.text || '').trim();
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const start = Number(sentence.startTime ?? sentence.start ?? 0) || 0;
  const end = Math.max(Number(sentence.endTime ?? sentence.end ?? 0) || 0, start + 0.05);
  const parts = [];

  for (let index = 0; index < words.length; index += MAX_SRT_WORDS_PER_SEGMENT) {
    parts.push(words.slice(index, index + MAX_SRT_WORDS_PER_SEGMENT));
  }

  return parts.map((part, index) => {
    const partStart = start + ((end - start) * index / parts.length);
    const partEnd = index === parts.length - 1
      ? end
      : start + ((end - start) * (index + 1) / parts.length);
    return { start: partStart, end: Math.max(partEnd, partStart + 0.05), text: part.join(' ') };
  });
};

export const createSrt = (sentences = []) => sentences
  .flatMap(splitSentenceForSrt)
  .map((sentence, index) => {
    return `${index + 1}\n${formatSrtTime(sentence.start)} --> ${formatSrtTime(sentence.end)}\n${sentence.text}`;
  })
  .join('\n\n');

export class Mp3ToSrtPage {
  constructor({ showToast = () => {}, onNavigate = () => {} } = {}) {
    this.showToast = showToast;
    this.onNavigate = onNavigate;
    this.container = null;
    this.selectedLanguage = null;
    this.selectedFile = null;
    this.srtText = '';
    this.isProcessing = false;
  }

  render(parentElement) {
    this.container = document.createElement('section');
    this.container.className = 'mp3-srt-page';
    this.container.innerHTML = `
      <div class="mp3-srt-hero">
        <div class="mp3-srt-eyebrow">Audio subtitle tool</div>
        <h1>MP3 to SRT</h1>
        <p>Choose the spoken language, upload your audio, and download a timestamped subtitle file.</p>
      </div>

      <div class="mp3-srt-card" aria-live="polite">
        <div class="mp3-srt-step-title"><span>1</span><div><h2>Select audio language</h2><p>Your selection guides transcription and keeps the SRT in the selected language.</p></div></div>
        <div class="mp3-srt-language-grid" role="radiogroup" aria-label="Audio language">
          ${Object.entries(LANGUAGES).map(([code, language]) => `
            <button type="button" class="mp3-srt-language" data-language="${code}" role="radio" aria-checked="false">
              <span class="mp3-srt-language-icon ${code === 'ur' ? 'urdu' : ''}">${language.icon}</span>
              <span><strong>${language.label}</strong><small>${language.native} · ${language.description}</small></span>
              <span class="mp3-srt-check" aria-hidden="true">✓</span>
            </button>
          `).join('')}
        </div>

        <div class="mp3-srt-divider"></div>
        <div class="mp3-srt-step-title"><span>2</span><div><h2>Upload audio</h2><p>MP3, WAV, M4A, AAC, OGG, FLAC, or WebM audio.</p></div></div>
        <input id="mp3-srt-file-input" type="file" accept="audio/*,.mp3,.mp2,.mpga,.mpeg,.wav,.m4a,.aac,.ogg,.oga,.flac,.webm" hidden>
        <button type="button" class="mp3-srt-upload" id="mp3-srt-upload" disabled>
          <span class="mp3-srt-upload-icon">⇧</span>
          <span><strong>Select a language first</strong><small>Maximum ${APP_CONFIG.MAX_FILE_SIZE_MB} MB · maximum 120 minutes</small></span>
        </button>
        <div class="mp3-srt-file" id="mp3-srt-file" hidden></div>

        <div class="mp3-srt-progress" id="mp3-srt-progress" hidden>
          <div class="mp3-srt-progress-heading"><strong id="mp3-srt-progress-message">Preparing your audio…</strong><span id="mp3-srt-progress-percent">0%</span></div>
          <div class="mp3-srt-progress-track"><div id="mp3-srt-progress-bar"></div></div>
          <p>Keep this page open while the SRT is being created.</p>
        </div>

        <div class="mp3-srt-complete" id="mp3-srt-complete" hidden>
          <div><span class="mp3-srt-success-icon">✓</span><span><strong>Your SRT is ready</strong><small id="mp3-srt-complete-text">Your subtitle file was created successfully.</small></span></div>
          <button type="button" id="mp3-srt-download">Download SRT</button>
        </div>
      </div>

      <div class="mp3-srt-notes">
        <span>Private browser processing</span><span>•</span><span>Language guided transcription</span><span>•</span><span>Standard .srt output</span>
      </div>
      <div class="mp3-srt-error-backdrop" id="mp3-srt-error" hidden role="alertdialog" aria-modal="true" aria-labelledby="mp3-srt-error-title">
        <div class="mp3-srt-error-dialog">
          <div class="mp3-srt-error-symbol">!</div>
          <h2 id="mp3-srt-error-title">We couldn’t create the SRT</h2>
          <p id="mp3-srt-error-message">Please try again.</p>
          <button type="button" id="mp3-srt-error-close">Try another file</button>
        </div>
      </div>
    `;
    parentElement.appendChild(this.container);
    this.bindEvents();
  }

  init() {
    // Transcription, metadata, and download errors are handled by their own
    // guarded flows. Listening to global page errors here made unrelated site
    // errors appear as a failed SRT conversion when the route first opened.
  }

  bindEvents() {
    this.container.querySelectorAll('[data-language]').forEach(button => {
      button.addEventListener('click', () => this.selectLanguage(button.dataset.language));
    });
    this.container.querySelector('#mp3-srt-upload')?.addEventListener('click', () => {
      if (this.selectedLanguage && !this.isProcessing) this.container.querySelector('#mp3-srt-file-input')?.click();
    });
    this.container.querySelector('#mp3-srt-file-input')?.addEventListener('change', event => {
      const [file] = event.target.files || [];
      if (file) this.handleFile(file);
      event.target.value = '';
    });
    this.container.querySelector('#mp3-srt-download')?.addEventListener('click', () => this.downloadSrt());
    this.container.querySelector('#mp3-srt-error-close')?.addEventListener('click', () => this.hideError());
  }

  selectLanguage(code) {
    if (this.isProcessing || !LANGUAGES[code]) return;
    this.selectedLanguage = code;
    this.container.querySelectorAll('[data-language]').forEach(button => {
      const selected = button.dataset.language === code;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    const upload = this.container.querySelector('#mp3-srt-upload');
    upload.disabled = false;
    upload.querySelector('strong').textContent = `Browse ${LANGUAGES[code].label} audio`;
  }

  async handleFile(file) {
    try {
      this.validateFile(file);
      const duration = await this.getAudioDuration(file);
      if (duration > MAX_AUDIO_DURATION_SECONDS) {
        throw new Error(`This audio is ${(duration / 60).toFixed(1)} minutes long. The maximum duration is 120 minutes.`);
      }
      this.selectedFile = file;
      this.showSelectedFile(file, duration);
      await this.transcribe(file);
    } catch (error) {
      this.showError(error?.message || 'The audio file could not be read.');
    }
  }

  validateFile(file) {
    if (!this.selectedLanguage) throw new Error('Select English, Hindi, or Urdu before uploading audio.');
    const mimeType = String(file?.type || '').toLowerCase();
    const hasSupportedExtension = AUDIO_EXTENSIONS.test(file?.name || '');
    const hasSupportedMime = mimeType.startsWith('audio/') || AUDIO_MIME_TYPES.has(mimeType);
    if (!file || (!hasSupportedMime && !hasSupportedExtension)) {
      throw new Error('Please choose a supported audio file.');
    }
    const limit = APP_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > limit) {
      throw new Error(`This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum allowed size is ${APP_CONFIG.MAX_FILE_SIZE_MB} MB.`);
    }
  }

  getAudioDuration(file) {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(file);
      const cleanup = () => {
        URL.revokeObjectURL(url);
        audio.removeAttribute('src');
      };
      const onLoaded = () => {
        const duration = audio.duration;
        cleanup();
        if (!Number.isFinite(duration) || duration <= 0) reject(new Error('Could not read the audio duration. Please choose another audio file.'));
        else resolve(duration);
      };
      audio.addEventListener('loadedmetadata', onLoaded, { once: true });
      audio.addEventListener('error', () => { cleanup(); reject(new Error('This audio format is not supported by your browser.')); }, { once: true });
      audio.src = url;
      audio.load();
    });
  }

  showSelectedFile(file, duration) {
    const fileEl = this.container.querySelector('#mp3-srt-file');
    fileEl.hidden = false;
    fileEl.innerHTML = `<span>♫</span><span><strong>${this.escapeHtml(file.name)}</strong><small>${(file.size / 1024 / 1024).toFixed(1)} MB · ${this.formatDuration(duration)}</small></span>`;
  }

  async transcribe(file) {
    this.isProcessing = true;
    this.srtText = '';
    this.hideError();
    this.setProgress(2, 'Preparing audio…');
    const language = LANGUAGES[this.selectedLanguage];
    // The filename hint is consumed by the established transcription engine; File wraps the same Blob data.
    const extension = (file.name.match(/\.[^.]+$/)?.[0] || '.audio');
    const hintedFile = new File([file], `${language.hint}-srt${extension}`, { type: file.type, lastModified: file.lastModified });

    try {
      let sentences;
      try {
        if (!GROQ_TRANSCRIPTION_ENABLED) throw new Error('Fast cloud transcription is not enabled for this deployment.');
        this.setProgress(8, 'Uploading audio to secure transcription…');
        let serverProgress = 8;
        const serverProgressTimer = window.setInterval(() => {
          serverProgress = Math.min(92, serverProgress + (serverProgress < 55 ? 4 : 1));
          this.setProgress(serverProgress, `Transcribing ${language.label} audio securely…`);
        }, 1500);
        try {
          sentences = await this.transcribeWithGroq(file, this.selectedLanguage);
        } finally {
          window.clearInterval(serverProgressTimer);
        }
        this.setProgress(96, 'Creating timestamped SRT…');
      } catch (groqError) {
        if (GROQ_TRANSCRIPTION_ENABLED) {
          console.warn('[MP3 to SRT] Fast transcription unavailable; using local Whisper:', groqError.message);
        }
        this.setProgress(
          12,
          GROQ_TRANSCRIPTION_ENABLED
            ? 'Fast service unavailable. Switching to on-device transcription…'
            : 'Using on-device transcription…'
        );
        const options = this.selectedLanguage === 'en'
          ? { scriptMode: 'english', languagePreference: 'en', failOnTranslationError: true }
          : {
              scriptMode: 'native',
              languagePreference: language.hint,
              preserveTranscriptionLanguage: true,
              // The selected SRT language is handled by local multilingual
              // Whisper; do not retry the suspended Gemini integration.
              skipGeminiTranscription: true
            };
        sentences = await speechTranscriber.transcribeAudio(hintedFile, progress => {
          this.setProgress(progress?.percent, progress?.message || 'Transcribing audio…');
        }, options);
      }
      const srt = createSrt(sentences);
      if (!srt) throw new Error('No spoken words were detected in this audio. Please try a clearer recording.');
      this.srtText = srt;
      this.setProgress(100, 'SRT complete');
      this.container.querySelector('#mp3-srt-complete').hidden = false;
      this.container.querySelector('#mp3-srt-complete-text').textContent = `${language.label} subtitles are ready to download.`;
      this.showToast('Your SRT file is ready.', 'success');
    } catch (error) {
      this.showError(error?.message || 'Transcription failed.');
    } finally {
      this.isProcessing = false;
    }
  }

  async transcribeWithGroq(file, language) {
    if (file.size > MAX_GROQ_UPLOAD_BYTES) {
      throw new Error('This file is larger than the fast-transcription limit.');
    }
    const data = new FormData();
    data.append('audio', file, file.name);
    data.append('language', language);
    const response = await fetch('/api/ai/transcribe-groq', { method: 'POST', body: data });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success || !Array.isArray(result.sentences)) {
      throw new Error(result?.error || 'Fast transcription could not be completed.');
    }
    return result.sentences;
  }

  setProgress(percent = 0, message = 'Processing…') {
    const progress = this.container.querySelector('#mp3-srt-progress');
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    progress.hidden = false;
    this.container.querySelector('#mp3-srt-progress-message').textContent = message;
    this.container.querySelector('#mp3-srt-progress-percent').textContent = `${value}%`;
    this.container.querySelector('#mp3-srt-progress-bar').style.width = `${value}%`;
  }

  async downloadSrt() {
    if (!this.srtText || !this.selectedFile) return;
    const name = `${this.selectedFile.name.replace(/\.[^/.]+$/, '')}_${this.selectedLanguage}.srt`;
    const file = new File([this.srtText], name, { type: 'application/x-subrip;charset=utf-8' });
    try {
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  showError(message) {
    this.isProcessing = false;
    const dialog = this.container?.querySelector('#mp3-srt-error');
    if (!dialog) return;
    this.container.querySelector('#mp3-srt-error-message').textContent = message;
    dialog.hidden = false;
    this.showToast(message, 'error');
  }

  hideError() {
    const dialog = this.container?.querySelector('#mp3-srt-error');
    if (dialog) dialog.hidden = true;
  }

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  escapeHtml(value) {
    const node = document.createElement('span');
    node.textContent = value;
    return node.innerHTML;
  }
}
