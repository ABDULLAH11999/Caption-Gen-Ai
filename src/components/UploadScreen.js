// Screen 2: Video Upload, Multi-Language Identification & Progressive YouTube Caption Workspace
import { APP_CONFIG, CAPTION_POSITIONS, FONTS } from '../config.js';
import { soundFx } from '../services/soundFx.js';
import { storage } from '../services/storageService.js';
import { languageIdentifier } from '../services/languageIdentifier.js';
import { captionEngine } from '../services/captionEngine.js';
import { videoRenderer } from '../services/videoRenderer.js';
import { speechTranscriber } from '../services/speechTranscriber.js';
import { generateDemoVideoBlob } from '../utils/sampleVideoGenerator.js';

export class UploadScreen {
  constructor(options = {}) {
    this.onOpenStyleStudio = options.onOpenStyleStudio || (() => {});
    this.onLockGate = options.onLockGate || (() => {});
    this.showToast = options.showToast || (() => {});

    this.currentMode = 'landscape'; // 'landscape' | 'portrait'
    this.activeConfig = null;
    this.videoBlob = null;
    this.videoDuration = 0;
    this.videoElement = null;
    this.isPlaying = false;
    this.container = null;
  }

  setConfig(config, mode) {
    this.activeConfig = config;
    if (mode) {
      this.currentMode = mode;
      this.updateOrientationView();
    }
    this.updateCaptionOverlay();
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'studio-main';
    this.container.id = 'upload-screen';

    this.container.innerHTML = `
      <!-- Top Navigation & Status Bar -->
      <header class="studio-header">
        <div class="brand-section">
          <div class="brand-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4z"></path>
            </svg>
          </div>
          <div class="brand-info">
            <h1>${APP_CONFIG.APP_TITLE}</h1>
            <p>OFFLINE MULTILINGUAL ENGINE • PROGRESSIVE YOUTUBE CAPTIONS</p>
          </div>
        </div>

        <div class="header-actions">
          <!-- Orientation Pill (Landscape / Portrait) -->
          <div class="mode-toggle-group">
            <button class="mode-btn ${this.currentMode === 'landscape' ? 'active' : ''}" id="btn-mode-landscape">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect></svg>
              Landscape
            </button>
            <button class="mode-btn ${this.currentMode === 'portrait' ? 'active' : ''}" id="btn-mode-portrait">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"></rect></svg>
              Portrait
            </button>
          </div>

          <!-- Tool Style Studio Trigger (Opens Screen 3) -->
          <button class="btn-open-style-studio" id="btn-open-style-studio">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Caption Style Studio
          </button>

          <!-- Lock Screen Button -->
          <button class="btn-lock-site" id="btn-lock-gate" title="Lock Gate & Return to Screen 1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Lock
          </button>
        </div>
      </header>

      <!-- Video Upload Dropzone Area -->
      <section class="upload-card" id="drop-zone">
        <input type="file" id="file-input" accept="video/mp4,video/webm,video/ogg,video/quicktime" style="display: none;">
        
        <div class="upload-icon-wrapper">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>

        <h2>UPLOAD VIDEO FOR AI CAPTIONING</h2>
        <p>Drop your video here or browse. Supports multi-language speech with YouTube-style word-by-word streaming captions.</p>

        <!-- Configurable Env Limits Display -->
        <div class="upload-limits-row">
          <span class="badge badge-cyan">MAX SIZE: ${APP_CONFIG.MAX_FILE_SIZE_MB} MB</span>
          <span class="badge badge-purple">MAX DURATION: ${Math.floor(APP_CONFIG.MAX_DURATION_SEC / 60)} MINUTES</span>
          <span class="badge badge-yellow">MULTI-LANGUAGE: 1 - 3 LANGUAGES</span>
          <span class="badge badge-green">100% LOCAL & OFFLINE</span>
        </div>

        <div class="upload-btn-group">
          <button class="btn-browse" id="btn-browse-file">
            📁 Browse Video File
          </button>
        </div>
      </section>

      <!-- Main Video Workspace (Hidden until video loaded) -->
      <section class="workspace-grid" id="workspace-grid" style="display: none;">
        
        <!-- Left: Video Player with Real-Time YouTube Captions -->
        <div class="video-player-card">
          <div class="video-container landscape" id="video-wrapper">
            <video class="studio-video-element" id="main-video" playsinline></video>
            
            <!-- Real-Time YouTube-Style Progressive Caption Overlay -->
            <div class="caption-live-overlay" id="caption-live-overlay"></div>
          </div>

          <!-- Player Controls & Waveform Scrubber -->
          <div class="player-controls">
            <div class="timeline-scrubber-wrapper">
              <input type="range" class="timeline-scrubber" id="timeline-scrubber" min="0" max="100" value="0" step="0.1">
              <span class="timestamp-indicator" id="time-display">00:00 / 00:00</span>
            </div>

            <div class="control-buttons-row">
              <div class="playback-buttons">
                <button class="btn-ctrl btn-play-pause" id="btn-play-pause">▶</button>
                <button class="btn-ctrl" id="btn-rewind" title="Rewind 5s">↺ 5s</button>
                <button class="btn-ctrl" id="btn-forward" title="Forward 5s">5s ↻</button>
                <button class="btn-ctrl" id="btn-mute">🔊</button>
              </div>

              <!-- Export Controls -->
              <div style="display: flex; gap: 8px;">
                <button class="btn-export-sub" id="btn-export-srt" title="Download SubRip Subtitles">.SRT</button>
                <button class="btn-export-sub" id="btn-export-vtt" title="Download WebVTT Subtitles">.VTT</button>
                <button class="btn-export-video" id="btn-burn-video">
                  🎥 Burn Captions (Lossless Export)
                </button>
              </div>
            </div>

            <!-- Export Progress Indicator (Hidden by default) -->
            <div id="export-progress-container" style="display: none; margin-top: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 4px;">
                <span style="color: var(--cyan-primary);">Burning captions at source quality...</span>
                <span id="export-percent">0%</span>
              </div>
              <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                <div id="export-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--cyan-primary), var(--purple-accent)); transition: width 0.1s linear;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Multi-Language Identifier & Interactive Transcript Sidebar -->
        <aside class="transcript-sidebar">
          
          <!-- 1. Language Identifier Card -->
          <div class="lang-identifier-card">
            <div class="lang-header">
              <div class="lang-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                Multi-Language Identifier
              </div>
              <span class="badge badge-cyan" id="multilang-status-badge">Detecting...</span>
            </div>

            <!-- Visual Multi-Language Distribution Bar -->
            <div class="multilang-bar-container" id="multilang-bar">
              <div class="multilang-bar-segment" style="width: 50%; background: var(--cyan-primary);"></div>
              <div class="multilang-bar-segment" style="width: 30%; background: var(--purple-accent);"></div>
              <div class="multilang-bar-segment" style="width: 20%; background: var(--yellow-accent);"></div>
            </div>

            <div class="detected-langs-list" id="detected-langs-chips"></div>
          </div>

          <!-- 2. Transcript & Word-by-Word Timeline -->
          <div class="transcript-card">
            <div class="transcript-header">
              <div>
                <span class="transcript-title">LIVE WORDS & TIMELINE</span>
                <span class="badge badge-purple" id="sentences-count-badge" style="margin-left: 6px;">0 Sentences</span>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="badge badge-cyan" id="btn-open-script-editor" style="cursor: pointer;" title="Edit Spoken Script">✏️ Edit Script</button>
                <button class="badge badge-yellow" id="btn-add-line" style="cursor: pointer;" title="Add Caption Line">+ Add Line</button>
              </div>
            </div>

            <div class="transcript-scroll-area" id="transcript-scroll-list"></div>
          </div>

        </aside>

      </section>

      <!-- AI Speech Transcription Progress Modal -->
      <div class="transcription-modal-overlay" id="transcription-modal" style="display: none;">
        <div class="transcription-box">
          <div class="transcription-spinner"></div>
          <h3 class="transcription-title">AI SPEECH TRANSCRIBER</h3>
          <p class="transcription-status-msg" id="transcription-msg">Extracting real audio & detecting spoken words...</p>
          <div class="transcription-progress-track">
            <div class="transcription-progress-fill" id="transcription-fill"></div>
          </div>
          <span style="font-size: 0.76rem; color: var(--text-dim);">Listening to actual audio track in video. No dummy text will be used.</span>
        </div>
      </div>

      <!-- Script & Words Editor Modal -->
      <div class="script-editor-modal-overlay" id="script-editor-modal" style="display: none;">
        <div class="script-editor-card">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit Video Spoken Script
          </h3>
          <p style="font-size: 0.82rem; color: var(--text-muted);">
            Type or paste the exact words spoken in your video (supports any language: English, Urdu, Hindi, Punjabi, etc.). Each paragraph or line will become a synchronized caption block.
          </p>
          <textarea class="script-textarea" id="script-editor-textarea" placeholder="Enter your video's exact spoken words here..."></textarea>
          <div class="script-editor-actions">
            <button class="btn-export-sub" id="btn-close-script-editor">Cancel</button>
            <button class="btn-browse" id="btn-save-script">⚡ Auto-Align to Speech & Apply</button>
          </div>
        </div>
      </div>
    `;

    parentElement.appendChild(this.container);
    this.videoElement = this.container.querySelector('#main-video');
    this.bindEvents();
  }

  bindEvents() {
    const fileInput = this.container.querySelector('#file-input');
    const dropZone = this.container.querySelector('#drop-zone');

    // Browse Button
    this.container.querySelector('#btn-browse-file')?.addEventListener('click', () => {
      soundFx.playKeyBeep(520);
      fileInput.click();
    });

    // File Input change
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFileUpload(e.target.files[0]);
      }
    });

    // Drag and Drop
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    // Script Editor Modal Trigger & Actions
    this.container.querySelector('#btn-open-script-editor')?.addEventListener('click', () => {
      soundFx.playKeyBeep(560);
      this.openScriptEditor();
    });

    this.container.querySelector('#btn-close-script-editor')?.addEventListener('click', () => {
      this.container.querySelector('#script-editor-modal').style.display = 'none';
    });

    this.container.querySelector('#btn-save-script')?.addEventListener('click', () => {
      this.applyEditedScript();
    });

    // Add Line Button
    this.container.querySelector('#btn-add-line')?.addEventListener('click', () => {
      this.addNewSentenceLine();
    });

    // Orientation buttons
    this.container.querySelector('#btn-mode-landscape')?.addEventListener('click', () => {
      this.switchOrientation('landscape');
    });
    this.container.querySelector('#btn-mode-portrait')?.addEventListener('click', () => {
      this.switchOrientation('portrait');
    });

    // Open Style Studio Button
    this.container.querySelector('#btn-open-style-studio')?.addEventListener('click', () => {
      this.onOpenStyleStudio(this.currentMode);
    });

    // Lock site
    this.container.querySelector('#btn-lock-gate')?.addEventListener('click', () => {
      if (this.videoElement) this.videoElement.pause();
      this.onLockGate();
    });

    // Video Player controls
    const playPauseBtn = this.container.querySelector('#btn-play-pause');
    playPauseBtn?.addEventListener('click', () => this.togglePlay());

    this.videoElement?.addEventListener('play', () => {
      this.isPlaying = true;
      if (playPauseBtn) playPauseBtn.textContent = '❚❚';
    });

    this.videoElement?.addEventListener('pause', () => {
      this.isPlaying = false;
      if (playPauseBtn) playPauseBtn.textContent = '▶';
    });

    // Time update (Word by word sync)
    this.videoElement?.addEventListener('timeupdate', () => {
      this.onVideoTimeUpdate();
    });

    // Scrubber
    const scrubber = this.container.querySelector('#timeline-scrubber');
    scrubber?.addEventListener('input', (e) => {
      if (this.videoElement && this.videoDuration) {
        const targetTime = (Number(e.target.value) / 100) * this.videoDuration;
        this.videoElement.currentTime = targetTime;
      }
    });

    // Rewind / Forward
    this.container.querySelector('#btn-rewind')?.addEventListener('click', () => {
      if (this.videoElement) this.videoElement.currentTime = Math.max(0, this.videoElement.currentTime - 5);
    });
    this.container.querySelector('#btn-forward')?.addEventListener('click', () => {
      if (this.videoElement) this.videoElement.currentTime = Math.min(this.videoDuration, this.videoElement.currentTime + 5);
    });

    // Mute toggle
    const muteBtn = this.container.querySelector('#btn-mute');
    muteBtn?.addEventListener('click', () => {
      if (this.videoElement) {
        this.videoElement.muted = !this.videoElement.muted;
        muteBtn.textContent = this.videoElement.muted ? '🔇' : '🔊';
      }
    });

    // Subtitle Exports
    this.container.querySelector('#btn-export-srt')?.addEventListener('click', () => {
      this.downloadFile(captionEngine.exportToSRT(), 'captions.srt', 'text/plain');
      this.showToast('Exported captions.srt successfully!', 'success');
    });

    this.container.querySelector('#btn-export-vtt')?.addEventListener('click', () => {
      this.downloadFile(captionEngine.exportToVTT(), 'captions.vtt', 'text/vtt');
      this.showToast('Exported captions.vtt successfully!', 'success');
    });

    // Burn Captions Video Export
    this.container.querySelector('#btn-burn-video')?.addEventListener('click', () => {
      this.startVideoExport();
    });
  }

  switchOrientation(mode) {
    soundFx.playKeyBeep(520);
    this.currentMode = mode;
    this.container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    this.container.querySelector(`#btn-mode-${mode}`)?.classList.add('active');
    this.updateOrientationView();
  }

  updateOrientationView() {
    const wrapper = this.container.querySelector('#video-wrapper');
    if (wrapper) {
      wrapper.className = `video-container ${this.currentMode}`;
    }
  }

  togglePlay() {
    if (!this.videoElement) return;
    if (this.videoElement.paused) {
      this.videoElement.play();
    } else {
      this.videoElement.pause();
    }
  }

  // Handle uploaded video file with strict ENV limit validations
  async handleFileUpload(file) {
    soundFx.playKeyBeep(540);

    // 1. Validate File Size (< 100 MB configurable)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > APP_CONFIG.MAX_FILE_SIZE_MB) {
      soundFx.playErrorSound();
      this.showToast(
        `FILE REJECTED: Size is ${fileSizeMB.toFixed(1)} MB. Maximum allowed is ${APP_CONFIG.MAX_FILE_SIZE_MB} MB.`,
        'error'
      );
      return;
    }

    // 2. Validate Video Duration (< 5 minutes / 300s configurable)
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    const tempUrl = URL.createObjectURL(file);
    tempVideo.src = tempUrl;

    tempVideo.onloadedmetadata = () => {
      const duration = tempVideo.duration;
      if (duration > APP_CONFIG.MAX_DURATION_SEC) {
        soundFx.playErrorSound();
        URL.revokeObjectURL(tempUrl);
        this.showToast(
          `VIDEO TOO LONG: Duration is ${(duration / 60).toFixed(1)} min. Maximum allowed is ${(APP_CONFIG.MAX_DURATION_SEC / 60)} minutes.`,
          'error'
        );
        return;
      }

      // Auto-detect orientation: Landscape if aspect ratio >= 1, Portrait if vertical
      const isPortrait = tempVideo.videoHeight > tempVideo.videoWidth;
      this.switchOrientation(isPortrait ? 'portrait' : 'landscape');

      // isDemo = false for real user upload!
      this.loadVideoBlob(file, file.name, duration, false);
    };

    tempVideo.onerror = () => {
      this.showToast('Invalid or corrupted video file format.', 'error');
    };
  }

  async loadVideoBlob(blob, filename = 'video.mp4', knownDuration = 0, isDemo = false) {
    this.videoBlob = blob;
    const videoUrl = URL.createObjectURL(blob);
    this.videoElement.src = videoUrl;

    // Show workspace
    this.container.querySelector('#workspace-grid').style.display = 'grid';

    this.videoElement.onloadedmetadata = async () => {
      this.videoDuration = knownDuration || this.videoElement.duration || 30;
      this.updateTimeDisplay(0, this.videoDuration);

      if (isDemo) {
        // ONLY for demo stream: load multilingual test sentences
        const sentences = captionEngine.generateSampleTranscript(this.videoDuration);
        const langProfile = await languageIdentifier.identifyLanguages(this.videoDuration, sentences);
        this.renderLanguageProfile(langProfile);
        this.renderTranscriptSidebar(sentences);
        this.showToast('Demo video loaded with sample multi-language captions', 'info');
      } else {
        // FOR REAL USER UPLOADED VIDEOS:
        // Run speech recognition and extract real spoken words from audio!
        await this.runRealAudioTranscription(blob, filename);
      }
    };
  }

  async runRealAudioTranscription(blob, filename) {
    const modal = this.container.querySelector('#transcription-modal');
    const msg = this.container.querySelector('#transcription-msg');
    const fill = this.container.querySelector('#transcription-fill');
    if (modal) {
      modal.style.display = 'flex';
      if (fill) fill.style.width = '10%';
    }

    try {
      this.showToast('Analyzing video audio and recognizing spoken speech...', 'info');

      const sentences = await speechTranscriber.transcribeAudio(blob, (p) => {
        if (msg) msg.textContent = p.message;
        if (fill) fill.style.width = `${p.percent}%`;
      });

      if (modal) modal.style.display = 'none';

      captionEngine.setSentences(sentences);
      const langProfile = await languageIdentifier.identifyLanguages(this.videoDuration, sentences);

      this.renderLanguageProfile(langProfile);
      this.renderTranscriptSidebar(sentences);

      if (sentences.length > 0) {
        this.showToast(`AI transcribed ${sentences.length} speech segments. Use "✏️ Edit Script" to fine-tune!`, 'success');
      } else {
        this.showToast('Audio parsed. Click "✏️ Edit Script" to add your video words.', 'info');
      }

      storage.saveCurrentProject({
        filename,
        duration: this.videoDuration,
        orientation: this.currentMode,
        sentences
      });
    } catch (err) {
      if (modal) modal.style.display = 'none';
      console.error('Audio transcription error:', err);
      this.showToast('Audio extracted. Use "✏️ Edit Script" to add/adjust captions.', 'warning');
      const fallbackSentences = [];
      captionEngine.setSentences(fallbackSentences);
      this.renderTranscriptSidebar(fallbackSentences);
    }
  }

  openScriptEditor() {
    const modal = this.container.querySelector('#script-editor-modal');
    const textarea = this.container.querySelector('#script-editor-textarea');
    if (!modal || !textarea) return;

    // Prefill with current sentence texts
    const currentText = (captionEngine.sentences || []).map(s => s.text).join('\n');
    textarea.value = currentText;
    modal.style.display = 'flex';
  }

  applyEditedScript() {
    const textarea = this.container.querySelector('#script-editor-textarea');
    const modal = this.container.querySelector('#script-editor-modal');
    if (!textarea) return;

    const rawText = textarea.value.trim();
    if (!rawText) {
      captionEngine.setSentences([]);
      this.renderTranscriptSidebar([]);
      if (modal) modal.style.display = 'none';
      return;
    }

    // Split paragraphs / lines into timed sentences
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const duration = this.videoDuration || 30;
    const lineDuration = duration / Math.max(1, lines.length);

    const newSentences = lines.map((line, idx) => {
      const start = parseFloat((idx * lineDuration).toFixed(2));
      const end = parseFloat(((idx + 1) * lineDuration).toFixed(2));
      const lang = languageIdentifier.detectTextLanguage(line);
      const words = captionEngine.createWordLevelTimestamps(line, start, end, lang);
      return {
        id: `sentence_${idx + 1}`,
        startTime: start,
        endTime: end,
        text: line,
        language: lang,
        words
      };
    });

    captionEngine.setSentences(newSentences);
    const langProfile = languageIdentifier.identifyLanguages(this.videoDuration, newSentences);
    this.renderLanguageProfile(langProfile);
    this.renderTranscriptSidebar(newSentences);

    if (modal) modal.style.display = 'none';
    this.showToast('Captions updated with your exact script words!', 'success');
    this.updateCaptionOverlay();
  }

  addNewSentenceLine() {
    const curTime = this.videoElement ? parseFloat(this.videoElement.currentTime.toFixed(2)) : 0;
    const text = prompt('Enter spoken words for new caption line:', 'New caption line');
    if (!text || !text.trim()) return;

    const endTime = Math.min(this.videoDuration || 30, parseFloat((curTime + 3).toFixed(2)));
    captionEngine.addSentence(curTime, endTime, text.trim());
    this.renderTranscriptSidebar(captionEngine.sentences);
    this.showToast('Added caption line at ' + curTime + 's', 'success');
    this.updateCaptionOverlay();
  }

  onVideoTimeUpdate() {
    if (!this.videoElement) return;
    const curTime = this.videoElement.currentTime;
    const duration = this.videoDuration || this.videoElement.duration || 1;

    // Update scrubber
    const scrubber = this.container.querySelector('#timeline-scrubber');
    if (scrubber) {
      scrubber.value = (curTime / duration) * 100;
    }
    this.updateTimeDisplay(curTime, duration);

    // Update YouTube Live Captions
    this.updateCaptionOverlay(curTime);

    // Highlight active sentence and word in the transcript sidebar
    this.highlightActiveTranscriptItems(curTime);
  }

  updateTimeDisplay(cur, total) {
    const timeDisplay = this.container.querySelector('#time-display');
    if (!timeDisplay) return;
    const fmt = (s) => {
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    timeDisplay.textContent = `${fmt(cur)} / ${fmt(total)}`;
  }

  /**
   * Updates the live YouTube-style progressive caption overlay
   */
  updateCaptionOverlay(currentTime) {
    const overlay = this.container.querySelector('#caption-live-overlay');
    if (!overlay || !this.videoElement) return;

    const time = currentTime !== undefined ? currentTime : this.videoElement.currentTime;
    const config = this.activeConfig || {};
    const captionState = captionEngine.getActiveCaptionState(time, config);

    if (!captionState || !captionState.visibleWords || captionState.visibleWords.length === 0) {
      overlay.innerHTML = '';
      overlay.style.display = 'none';
      return;
    }

    overlay.style.display = 'flex';

    // 1. Apply 9 Positions (including Middle Left & Middle Right)
    const pos = CAPTION_POSITIONS.find(p => p.id === config.position) || CAPTION_POSITIONS[1];
    overlay.style.top = pos.y;
    overlay.style.left = pos.x;
    overlay.style.transform = pos.transform;
    overlay.style.textAlign = pos.align;
    overlay.style.justifyContent = pos.align === 'left' ? 'flex-start' : pos.align === 'right' ? 'flex-end' : 'center';

    // 2. Responsive Font Size relative to actual visible video width (keeps inside screen)
    const vWidth = this.videoElement ? (this.videoElement.clientWidth || 640) : 640;
    const scaleFactor = Math.min(1.1, Math.max(0.52, vWidth / 560));
    const responsiveFontSize = Math.round((config.fontSize || 30) * scaleFactor);
    const fontMeta = FONTS.find(f => f.id === config.fontFamily) || FONTS[0];
    overlay.style.fontFamily = fontMeta.family;
    overlay.style.fontSize = `${Math.max(13, Math.min(42, responsiveFontSize))}px`;
    overlay.style.fontWeight = '900';

    // 3. Black Outline (Default Black Outline)
    const strokeWidth = config.outlineWidth || 4;
    overlay.style.webkitTextStroke = `${strokeWidth}px ${config.outlineColor || '#000000'}`;
    overlay.style.textShadow = `0 4px ${config.shadowBlur || 8}px ${config.shadowColor || 'rgba(0,0,0,0.9)'}`;

    // 4. Render progressive words (YouTube style: appear in exact time sequence as spoken)
    overlay.innerHTML = captionState.visibleWords.map((w, idx) => {
      const isCurrentWord = w.isCurrent;
      const wordColor = isCurrentWord && config.animation === 'anim-karaoke-glow'
        ? (config.karaokeHighlightColor || '#00F0FF')
        : w.color;

      return `
        <span class="caption-word-token ${isCurrentWord ? 'current' : ''}" style="color: ${wordColor};">
          ${w.word}
        </span>
      `;
    }).join(' ');

    // 5. Apply Animation Class
    overlay.className = `caption-live-overlay ${config.animation || 'anim-pop'}`;
  }

  renderLanguageProfile(profile) {
    const chipsContainer = this.container.querySelector('#detected-langs-chips');
    const barContainer = this.container.querySelector('#multilang-bar');
    const badge = this.container.querySelector('#multilang-status-badge');

    if (!chipsContainer || !barContainer) return;

    badge.textContent = `${profile.languages.length} LANGUAGES DETECTED`;

    // Colors for multilingual bar
    const colors = ['#00F0FF', '#A855F7', '#FFE600', '#FF007A', '#10B981'];

    // Render bar segments
    barContainer.innerHTML = profile.languages.map((l, i) => `
      <div class="multilang-bar-segment" style="width: ${l.percentage}%; background: ${colors[i % colors.length]};" title="${l.name} (${l.percentage}%)"></div>
    `).join('');

    // Render chips
    chipsContainer.innerHTML = profile.languages.map((l, i) => `
      <div class="lang-chip" style="border-left: 3px solid ${colors[i % colors.length]};">
        <span>${l.flag || '🌐'}</span>
        <strong>${l.name}</strong>
        <span style="color: var(--cyan-primary);">${l.percentage}%</span>
      </div>
    `).join('');
  }

  renderTranscriptSidebar(sentences) {
    const list = this.container.querySelector('#transcript-scroll-list');
    const badge = this.container.querySelector('#sentences-count-badge');
    if (!list) return;

    badge.textContent = `${sentences.length} Sentences`;

    list.innerHTML = sentences.map((s, sIdx) => {
      const fmt = (sec) => {
        const m = Math.floor(sec / 60);
        const secRem = Math.floor(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(secRem).padStart(2, '0')}`;
      };

      return `
        <div class="sentence-block" data-sidx="${sIdx}" data-start="${s.startTime}">
          <div class="sentence-meta-row">
            <span class="badge badge-cyan">${(s.language || 'EN').toUpperCase()}</span>
            <span>${fmt(s.startTime)} ➔ ${fmt(s.endTime)}</span>
            <div class="sentence-edit-controls">
              <button class="btn-icon-tiny btn-edit-sentence" data-sidx="${sIdx}" title="Edit this line">✏️</button>
              <button class="btn-icon-tiny del btn-del-sentence" data-sidx="${sIdx}" title="Delete this line">🗑️</button>
            </div>
          </div>
          <div class="sentence-words-flow">
            ${s.words.map((w, wIdx) => `
              <span class="interactive-word" data-sidx="${sIdx}" data-widx="${wIdx}" data-wstart="${w.start}" title="Click to seek, double click to edit">
                ${w.word}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Edit sentence button
    list.querySelectorAll('.btn-edit-sentence').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sIdx = Number(btn.getAttribute('data-sidx'));
        const s = captionEngine.sentences[sIdx];
        if (!s) return;
        const updated = prompt('Edit caption line text:', s.text);
        if (updated !== null && updated.trim()) {
          captionEngine.updateSentenceText(s.id, updated.trim());
          this.renderTranscriptSidebar(captionEngine.sentences);
          this.updateCaptionOverlay();
          this.showToast('Line updated!', 'success');
        }
      });
    });

    // Delete sentence button
    list.querySelectorAll('.btn-del-sentence').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sIdx = Number(btn.getAttribute('data-sidx'));
        const s = captionEngine.sentences[sIdx];
        if (!s) return;
        captionEngine.deleteSentence(s.id);
        this.renderTranscriptSidebar(captionEngine.sentences);
        this.updateCaptionOverlay();
        this.showToast('Line deleted!', 'info');
      });
    });

    // Double-click word to edit specific word
    list.querySelectorAll('.interactive-word').forEach(wEl => {
      wEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const sIdx = Number(wEl.getAttribute('data-sidx'));
        const wIdx = Number(wEl.getAttribute('data-widx'));
        const s = captionEngine.sentences[sIdx];
        if (!s || !s.words[wIdx]) return;
        const newWord = prompt('Edit word:', s.words[wIdx].word);
        if (newWord !== null && newWord.trim()) {
          captionEngine.updateWordText(s.id, wIdx, newWord.trim());
          this.renderTranscriptSidebar(captionEngine.sentences);
          this.updateCaptionOverlay();
        }
      });

      // Click word to seek
      wEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const start = Number(wEl.getAttribute('data-wstart'));
        if (this.videoElement) {
          this.videoElement.currentTime = start;
          this.videoElement.play();
        }
      });
    });

    list.querySelectorAll('.sentence-block').forEach(sEl => {
      sEl.addEventListener('click', () => {
        const start = Number(sEl.getAttribute('data-start'));
        if (this.videoElement) {
          this.videoElement.currentTime = start;
          this.videoElement.play();
        }
      });
    });
  }

  highlightActiveTranscriptItems(time) {
    const list = this.container.querySelector('#transcript-scroll-list');
    if (!list) return;

    captionEngine.sentences.forEach((s, idx) => {
      const block = list.querySelector(`.sentence-block[data-sidx="${idx}"]`);
      if (block) {
        if (time >= s.startTime && time <= s.endTime) {
          block.classList.add('active');
        } else {
          block.classList.remove('active');
        }
      }
    });

    // Highlight current word
    list.querySelectorAll('.interactive-word').forEach(wEl => {
      const start = Number(wEl.getAttribute('data-wstart'));
      if (Math.abs(time - start) < 0.35) {
        wEl.classList.add('current');
      } else {
        wEl.classList.remove('current');
      }
    });
  }

  async startVideoExport() {
    if (!this.videoElement) return;

    const progressBox = this.container.querySelector('#export-progress-container');
    const progressBar = this.container.querySelector('#export-bar');
    const progressPercent = this.container.querySelector('#export-percent');
    progressBox.style.display = 'block';

    this.showToast('Rendering high-bitrate video with burned-in captions...', 'info');

    try {
      const blob = await videoRenderer.exportVideo(
        this.videoElement,
        captionEngine,
        this.activeConfig,
        (percent) => {
          progressBar.style.width = `${percent}%`;
          progressPercent.textContent = `${percent}%`;
        }
      );

      progressBox.style.display = 'none';
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      this.downloadBlob(blob, `Zen_Captioned_Video.${ext}`);
      this.showToast('Lossless video export finished and downloaded!', 'success');
      soundFx.playUnlockChime();
    } catch (err) {
      progressBox.style.display = 'none';
      this.showToast('Export failed: ' + err.message, 'error');
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    this.downloadBlob(blob, filename);
  }
}
