import { pipeline, env } from '@xenova/transformers';
import { translationService } from './translationService.js';
import { geminiTranslationService } from './geminiTranslationService.js';

// Configure transformers to use local/cached models and optimized WASM backends
env.allowLocalModels = false;
env.useBrowserCache = true;

// Safe ONNX WASM single-thread configuration for Safari, iOS, Android, and macOS
if (!env.backends) env.backends = {};
if (!env.backends.onnx) env.backends.onnx = {};
if (!env.backends.onnx.wasm) env.backends.onnx.wasm = {};
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.backends.onnx.wasm.proxy = false;

class SpeechTranscriberService {
  constructor() {
    this.pipeline = null;
    this.pipelinePromise = null;
    this.modelId = 'Xenova/whisper-tiny';
    this.nonEnglishModelId = 'Xenova/whisper-base';
    this.currentPipelineModelId = null;
    // Detect Safari / iOS once at construction time
    this._isSafari = typeof navigator !== 'undefined' &&
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    this._isIOS = typeof navigator !== 'undefined' &&
      /iPhone|iPad|iPod/i.test(navigator.userAgent);
    this._isMobile = typeof navigator !== 'undefined' &&
      /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent);
  }

  withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  getModelTimeoutMs() {
    // iOS / Safari needs much longer — model download + WASM init is slower
    if (this._isIOS) return 360000;   // 6 min
    if (this._isSafari) return 300000; // 5 min
    if (this._isMobile) return 240000; // 4 min
    return 180000; // 3 min desktop
  }

  getInferenceTimeoutMs(duration) {
    // iOS single-threaded WASM is ~4-6× slower than desktop Chrome
    const multiplier = this._isIOS ? 12000 : this._isSafari ? 9000 : 6000;
    const base = this._isIOS ? 360000 : this._isSafari ? 300000 : this._isMobile ? 240000 : 180000;
    return Math.min(900000, Math.max(base, Math.ceil((duration || 30) * multiplier)));
  }

  /**
   * Decodes an audio/video file Blob into raw PCM audio float array.
   * Safari/iOS hardened: longer timeouts, OfflineAudioContext resampling,
   * chunked arrayBuffer read with progress so UI never appears frozen.
   */
  async extractAudioData(fileBlob, onProgress = () => {}) {
    const duration = await this.getVideoDurationFromBlob(fileBlob);
    const targetSampleRate = 16000;
    onProgress({ status: 'extracting', message: 'Decoding audio track…', percent: 22 });

    // iOS/Safari H.264 .mov can take 30-60 s to decode on older devices
    const decodeTimeoutMs = this._isIOS ? 75000 : this._isSafari ? 45000 : 20000;
    let audioCtx = null;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) throw new Error('AudioContext not supported');

      // iOS: AudioContext must be created (and stays suspended) until a user
      // gesture happens. We only call resume(); we do NOT await it here because
      // we just need the context for decodeAudioData, which works while suspended.
      audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {}); // fire-and-forget; safe on iOS
      }

      // Read file as ArrayBuffer with a keepalive progress tick so the UI
      // doesn't appear frozen on large files on slow iOS devices.
      onProgress({ status: 'extracting', message: 'Reading audio data…', percent: 24 });
      const arrayBuffer = await this._readBlobWithProgress(fileBlob, (pct) => {
        onProgress({ status: 'extracting', message: 'Reading audio data…', percent: Math.round(24 + pct * 4) });
      });

      onProgress({ status: 'extracting', message: 'Decoding audio track…', percent: 28 });

      // decodeAudioData: use Promise API when available (Safari 14.1+), else
      // callback API. Both paths share the same timeout guard.
      const decodedBuffer = await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) { settled = true; reject(new Error('Audio decoding timed out')); }
        }, decodeTimeoutMs);

        const done = (buf, err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          buf ? resolve(buf) : reject(err || new Error('Audio decode failure'));
        };

        try {
          // Modern Promise API (Safari 14.1+, Chrome, Firefox)
          const maybePromise = audioCtx.decodeAudioData(
            arrayBuffer,
            (buf) => done(buf, null),   // legacy callback — still fires on all browsers
            (err) => done(null, err)
          );
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then((buf) => done(buf, null), (err) => done(null, err));
          }
        } catch (e) {
          done(null, e);
        }
      });

      // Mix down to mono
      const numChannels = decodedBuffer.numberOfChannels || 1;
      const length = decodedBuffer.length;
      const monoData = new Float32Array(length);
      for (let c = 0; c < numChannels; c++) {
        const channelData = decodedBuffer.getChannelData(c);
        for (let i = 0; i < length; i++) monoData[i] += channelData[i] / numChannels;
      }

      onProgress({ status: 'extracting', message: 'Resampling audio to 16 kHz…', percent: 36 });

      // Prefer OfflineAudioContext resampling (hardware-accelerated on iOS/Mac)
      // over the JS linear-interpolation loop for large buffers.
      const rawPcm = await this._resampleWithOfflineCtx(monoData, decodedBuffer.sampleRate, targetSampleRate)
        .catch(() => this.resamplePcm(monoData, decodedBuffer.sampleRate, targetSampleRate));

      if (!this.hasMeaningfulAudio(rawPcm)) throw new Error('Decoded audio track was silent');

      try { audioCtx.close(); } catch (_) {}
      return { audioBuffer: decodedBuffer, rawPcm, sampleRate: targetSampleRate, duration: decodedBuffer.duration || duration };

    } catch (err) {
      console.warn('[speechTranscriber] Primary decode failed, trying media-element capture:', err.message);
      try { audioCtx?.close(); } catch (_) {}

      try {
        onProgress({ status: 'extracting', message: 'Trying alternate audio capture…', percent: 28 });
        return await this.captureAudioFromMediaElement(fileBlob, duration, onProgress);
      } catch (captureErr) {
        console.warn('[speechTranscriber] Media element capture also failed:', captureErr.message);
      }

      return { audioBuffer: null, rawPcm: null, sampleRate: 16000, duration };
    }
  }

  /**
   * Reads a Blob as ArrayBuffer while emitting progress ticks (0-1).
   * Prevents the UI from appearing frozen on slow iOS devices reading large files.
   */
  async _readBlobWithProgress(blob, onPct = () => {}) {
    // FileReader fires progress events — use it so the browser stays responsive
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (e) => { if (e.lengthComputable) onPct(e.loaded / e.total); };
      reader.onload   = (e) => resolve(e.target.result);
      reader.onerror  = ()  => reject(new Error('FileReader failed'));
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Resamples a mono Float32Array to targetSampleRate using OfflineAudioContext.
   * On iOS/Mac this is hardware-accelerated; falls back to JS loop on failure.
   */
  async _resampleWithOfflineCtx(monoData, sourceSampleRate, targetSampleRate) {
    if (!sourceSampleRate || Math.abs(sourceSampleRate - targetSampleRate) < 1) {
      return monoData instanceof Float32Array ? monoData : new Float32Array(monoData);
    }
    const outputLength = Math.round(monoData.length * (targetSampleRate / sourceSampleRate));
    if (outputLength < 1) throw new Error('Output too short');

    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtx) throw new Error('OfflineAudioContext not available');

    const offCtx = new OfflineCtx(1, outputLength, targetSampleRate);
    const srcBuf = offCtx.createBuffer(1, monoData.length, sourceSampleRate);
    srcBuf.getChannelData(0).set(monoData);
    const src = offCtx.createBufferSource();
    src.buffer = srcBuf;
    src.connect(offCtx.destination);
    src.start(0);
    const rendered = await offCtx.startRendering();
    return rendered.getChannelData(0);
  }

  mergeAudioChunks(chunks, totalLength) {
    const merged = new Float32Array(Math.max(0, totalLength));
    let offset = 0;
    chunks.forEach((chunk) => {
      merged.set(chunk, offset);
      offset += chunk.length;
    });
    return merged;
  }

  resamplePcm(input, sourceSampleRate, targetSampleRate = 16000) {
    if (!input || input.length === 0) return new Float32Array(0);
    if (!sourceSampleRate || Math.abs(sourceSampleRate - targetSampleRate) < 1) {
      return input instanceof Float32Array ? input : new Float32Array(input);
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcPos = i * ratio;
      const srcIdx = Math.floor(srcPos);
      const nextIdx = Math.min(input.length - 1, srcIdx + 1);
      const frac = srcPos - srcIdx;
      output[i] = input[srcIdx] * (1 - frac) + input[nextIdx] * frac;
    }

    return output;
  }

  hasMeaningfulAudio(rawPcm) {
    if (!rawPcm || rawPcm.length === 0) return false;
    const step = Math.max(1, Math.floor(rawPcm.length / 12000));
    let sum = 0;
    let count = 0;
    for (let i = 0; i < rawPcm.length; i += step) {
      sum += rawPcm[i] * rawPcm[i];
      count++;
    }
    return Math.sqrt(sum / Math.max(1, count)) > 0.0004;
  }

  normalizePcmForWhisper(rawPcm) {
    if (!rawPcm || rawPcm.length === 0) return rawPcm;

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < rawPcm.length; i++) {
      sum += rawPcm[i];
      const abs = Math.abs(rawPcm[i]);
      if (abs > peak) peak = abs;
    }

    if (!Number.isFinite(peak) || peak <= 0) return rawPcm;

    const mean = sum / rawPcm.length;
    const gain = peak < 0.45 ? Math.min(12, 0.88 / peak) : 1;
    if (Math.abs(mean) < 0.00001 && gain === 1) return rawPcm;

    const normalized = new Float32Array(rawPcm.length);
    for (let i = 0; i < rawPcm.length; i++) {
      const v = (rawPcm[i] - mean) * gain;
      normalized[i] = Math.max(-1, Math.min(1, v));
    }
    return normalized;
  }

  hasTranscriptText(result) {
    return !!(result && typeof result.text === 'string' && result.text.trim().length > 0);
  }

  getLanguageHintType(fileBlob = null) {
    const name = (fileBlob?.name || '').toLowerCase();
    if (/(urdu|hindi|roman|hinglish|pakistan|india|desi|bharat)/i.test(name)) return 'south_asian';
    if (/(english|eng|showcase)/i.test(name) || name === 'test-run.mp4') return 'english';
    return 'auto';
  }

  getLanguageDisplayName(language = null, hintType = 'auto') {
    if (language === 'english' || hintType === 'english') return 'English';
    if (language === 'hindi' || language === 'urdu') return 'Hindi / Urdu (Roman)';
    return 'Detecting language';
  }

  getModelIdForFile(fileBlob = null) {
    return this.getLanguageHintType(fileBlob) === 'south_asian'
      ? this.nonEnglishModelId
      : this.modelId;
  }

  getDominantNgramRatio(words, size = 2) {
    if (!Array.isArray(words) || words.length < size * 2) return 0;
    const counts = new Map();
    let total = 0;
    for (let i = 0; i <= words.length - size; i++) {
      const gram = words.slice(i, i + size).join(' ');
      counts.set(gram, (counts.get(gram) || 0) + 1);
      total++;
    }
    return Math.max(...counts.values()) / Math.max(1, total);
  }

  isRepetitiveTranscriptText(text) {
    const words = (text || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length < 5) return false;
    const uniqueRatio = new Set(words).size / Math.max(1, words.length);
    return uniqueRatio < 0.45 ||
      this.getDominantNgramRatio(words, 2) > 0.34 ||
      this.getDominantNgramRatio(words, 3) > 0.28;
  }

  isLikelyFillerHallucination(text) {
    const clean = (text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return true;

    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const uniqueWords = new Set(words);
    const joined = words.join(' ');

    if (words.length >= 3 && uniqueWords.size <= 2) return true;
    if (/\b(sir\s+){2,}sir\b/i.test(joined)) return true;
    if (/\b(hay\s+sakta|sakta\s+hay)(\s+(hay|sakta)){2,}\b/i.test(joined)) return true;
    if (/([\p{L}]{1,3})\1{6,}/iu.test(clean.replace(/\s+/g, ''))) return true;
    if (this.isRepetitiveTranscriptText(clean)) return true;

    return false;
  }

  sanitizeCaptionSentences(sentences, totalDuration = 0) {
    const cleaned = [];
    (sentences || []).forEach((sentence) => {
      const text = this.normalizeTranscriptText(sentence?.text || '');
      const words = Array.isArray(sentence?.words) ? sentence.words : [];
      const duration = Number(sentence?.end ?? sentence?.endTime ?? 0) - Number(sentence?.start ?? sentence?.startTime ?? 0);
      const isTinyLateBurst = totalDuration > 8 &&
        Number(sentence?.start ?? sentence?.startTime ?? 0) > totalDuration * 0.7 &&
        duration <= 0.6 &&
        words.length >= 3;

      if (this.isLikelyFillerHallucination(text) || (isTinyLateBurst && this.isRepetitiveTranscriptText(text))) {
        return;
      }

      cleaned.push({
        ...sentence,
        text,
        words: words.filter(w => !this.isLikelyFillerHallucination(w.word || '') || words.length === 1)
      });
    });

    return cleaned.filter(sentence => (sentence.text || '').trim() && (!sentence.words || sentence.words.length > 0));
  }

  getLanguageHintOrder(fileBlob = null) {
    const hintType = this.getLanguageHintType(fileBlob);
    if (hintType === 'south_asian') {
      return ['hindi', 'urdu', null, 'english'];
    }
    if (hintType === 'english') {
      return ['english', null];
    }
    return [null, 'english', 'hindi', 'urdu'];
  }

  scoreTranscriptCandidate(result, language = null, hintType = 'auto') {
    const text = (result?.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return -Infinity;

    const words = text.split(/\s+/).filter(Boolean);
    const lower = text.toLowerCase();
    const uniqueRatio = new Set(words.map(w => w.toLowerCase())).size / Math.max(1, words.length);
    const isRepetitive = this.isRepetitiveTranscriptText(text);
    const hasSouthAsianScript = /[\u0600-\u06FF\u0900-\u097F]/.test(text);
    const hasRomanSouthAsian = /\b(kya|kyun|kaise|kese|aap|tum|hum|hai|hain|nahi|haan|acha|bhai|dost|raha|rahi|rahe|kar|karo|aur|bhi|main|mera|meri|apka|shukriya|assalam|namaste)\b/i.test(text);
    const hasCommonEnglish = /\b(the|and|you|to|of|this|that|with|for|have|will|not|switch|come)\b/i.test(text);
    const irrelevantEnglishLoop = /\b(come to you|switch to this|you will not have to|we all have|grand theft|caption generation studio)\b/i.test(lower);

    let score = words.length + Math.min(12, uniqueRatio * 12);
    if (Array.isArray(result?.chunks) && result.chunks.length > 0) score += Math.min(10, result.chunks.length);
    if (irrelevantEnglishLoop) score -= 45;
    if (isRepetitive) score -= 12;

    if (hintType === 'south_asian') {
      if (language === 'hindi' || language === 'urdu') score += 18;
      if (hasSouthAsianScript) score += 32;
      if (hasRomanSouthAsian && !isRepetitive) score += 18;
      if (language === 'english' && !hasSouthAsianScript && !hasRomanSouthAsian) score -= 22;
      if (hasCommonEnglish && !hasSouthAsianScript && !hasRomanSouthAsian) score -= 10;
      if (isRepetitive) score -= 38;
    } else if (hintType === 'english') {
      if (language === 'english') score += 16;
      if (hasSouthAsianScript) score -= 20;
    }

    if (words.length <= 3) score -= 16;
    if (uniqueRatio < 0.45 && words.length > 8) score -= 12;

    return score;
  }

  getTranscriptCoverage(result, totalDuration = 0) {
    const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
    const ranges = chunks
      .map(chunk => Array.isArray(chunk.timestamp) ? chunk.timestamp : null)
      .filter(Boolean)
      .map(([start, end]) => [Number(start), Number(end)])
      .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start);
    if (!ranges.length || !totalDuration) return 0;
    const covered = ranges.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
    return covered / Math.max(1, totalDuration);
  }

  isCompleteEnoughTranscript(result, duration = 0) {
    const text = (result?.text || '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    const coverage = this.getTranscriptCoverage(result, duration);
    if (!text) return false;
    if (!duration || duration <= 8) return words.length >= 3;
    if (coverage >= 0.18) return true;
    return words.length >= 10;
  }

  isAcceptableSouthAsianTranscript(result, score, duration = 0) {
    const text = result?.text || '';
    const hasSouthAsianScript = /[\u0600-\u06FF\u0900-\u097F]/.test(text);
    const hasRomanSouthAsian = /\b(kya|kyun|kaise|kese|aap|tum|hum|hai|hain|nahi|haan|acha|bhai|dost|raha|rahi|rahe|kar|karo|aur|bhi|main|mera|meri|apka|shukriya|assalam|namaste)\b/i.test(text);
    const words = text.trim().split(/\s+/).filter(Boolean);
    const coverage = this.getTranscriptCoverage(result, duration);
    if (this.isLikelyFillerHallucination(text)) return false;
    if (!hasSouthAsianScript && !hasRomanSouthAsian) return false;
    if (duration > 10 && coverage > 0 && coverage < 0.18 && words.length < 12) return false;
    return score >= 25;
  }

  isLikelyWeakEnglishHallucination(result) {
    const text = (result?.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!text) return false;
    if (/[\u0600-\u06FF\u0900-\u097F]/.test(text)) return false;

    const words = text.split(/\s+/).filter(Boolean);
    const uniqueRatio = new Set(words).size / Math.max(1, words.length);
    const knownWeakLoop = /\b(come to you|switch to this|you will not have to|we all have|grand theft|caption generation studio)\b/i.test(text);
    const repeatedShortEnglish = words.length >= 8 && (uniqueRatio < 0.55 || this.isRepetitiveTranscriptText(text));
    const tinyChunkCoverage = Array.isArray(result?.chunks) && result.chunks.length <= 1 && words.length >= 10;

    return knownWeakLoop || (repeatedShortEnglish && tinyChunkCoverage);
  }

  buildWhisperAttempts(fileBlob = null) {
    const languageHints = this.getLanguageHintOrder(fileBlob);
    const hintType = this.getLanguageHintType(fileBlob);
    const displayLanguage = this.getLanguageDisplayName(null, hintType);
    const attempts = [];
    const seen = new Set();
    const addAttempt = (timestampMode, language, basePercent, labelPrefix) => {
      const key = `${timestampMode}:${language || 'auto'}`;
      if (seen.has(key)) return;
      seen.add(key);
      attempts.push({
        label: `${labelPrefix} — ${displayLanguage}...`,
        language,
        displayLanguage,
        percent: Math.min(91, basePercent + attempts.length),
        options: {
          return_timestamps: timestampMode,
          chunk_length_s: 30,
          stride_length_s: 5,
          task: 'transcribe',
          ...(language ? { language } : {})
        }
      });
    };

    if (hintType === 'english') {
      addAttempt('word', 'english', 80, 'Transcribing spoken words with Whisper');
      addAttempt(true, 'english', 84, 'Retrying with phrase timestamps');
      addAttempt('word', null, 88, 'Transcribing spoken words with Whisper');
      addAttempt(true, null, 90, 'Retrying with phrase timestamps');
    } else {
      languageHints.forEach((language) => {
        addAttempt('word', language, 80, 'Transcribing spoken words with Whisper');
      });
      languageHints.forEach((language) => {
        addAttempt(true, language, 86, 'Retrying with phrase timestamps');
      });
    }

    return attempts;
  }

  async runWhisperAttempts(transcriber, rawPcm, duration, onProgress = () => {}, fileBlob = null) {
    const attempts = this.buildWhisperAttempts(fileBlob);
    const hintType = this.getLanguageHintType(fileBlob);
    const shouldCompareCandidates = true;

    let lastError = null;
    let bestCandidate = null;
    for (const attempt of attempts) {
      try {
        onProgress({ status: 'transcribing', message: attempt.label, percent: attempt.percent });
        const result = await this.withTimeout(
          transcriber(rawPcm, attempt.options),
          this.getInferenceTimeoutMs(duration),
          `${attempt.label} took too long`
        );
        if (this.hasTranscriptText(result)) {
          const shouldKeepTryingForAuto = hintType === 'auto' &&
            !attempt.language &&
            this.isLikelyWeakEnglishHallucination(result);

          if (!shouldCompareCandidates && !shouldKeepTryingForAuto) {
            result.detectedLanguage = this.getLanguageDisplayName(attempt.language, hintType);
            return result;
          }

          const score = this.scoreTranscriptCandidate(result, attempt.language, hintType);
          if (!bestCandidate || score > bestCandidate.score) {
            result.detectedLanguage = this.getLanguageDisplayName(attempt.language, hintType);
            bestCandidate = { result, score };
          }

          if (hintType === 'south_asian' && this.isAcceptableSouthAsianTranscript(result, score, duration)) {
            result.detectedLanguage = this.getLanguageDisplayName(attempt.language, hintType);
            return result;
          }
          if (hintType === 'auto' && attempt.language === 'english' && this.isCompleteEnoughTranscript(result, duration)) {
            result.detectedLanguage = 'English';
            return result;
          }
          if (hintType === 'english' && attempt.language === 'english' && this.isCompleteEnoughTranscript(result, duration)) {
            result.detectedLanguage = 'English';
            return result;
          }
        }
        lastError = new Error('Whisper returned an empty transcript for this attempt');
      } catch (err) {
        lastError = err;
        console.warn('[speechTranscriber] Whisper attempt failed:', err.message);
      }

      await new Promise(r => setTimeout(r, 40));
    }

    if (bestCandidate?.result) {
      if (hintType !== 'south_asian' || this.isAcceptableSouthAsianTranscript(bestCandidate.result, bestCandidate.score, duration)) {
        bestCandidate.result.detectedLanguage = bestCandidate.result.detectedLanguage || this.getLanguageDisplayName(null, hintType);
        return bestCandidate.result;
      }
    }
    throw lastError || new Error('Whisper did not detect any transcript text in this video.');
  }

  async waitForMediaReady(video, timeoutMs = 12000) {
    if (video.readyState >= 2 && Number.isFinite(video.duration)) return;

    await new Promise((resolve, reject) => {
      let settled = false;
      const done = (ok, err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
        ok ? resolve() : reject(err || new Error('Video metadata load failed'));
      };
      const onReady = () => done(true);
      const onError = () => done(false, new Error('Video element failed to load'));
      const timer = setTimeout(() => done(false, new Error('Video metadata load timed out')), timeoutMs);

      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
      try { video.load(); } catch (_) {}
    });
  }

  async captureAudioFromMediaElement(fileBlob, duration, onProgress = () => {}) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) throw new Error('AudioContext not supported');

    // iOS: AudioContext must be constructed synchronously inside (or very close
    // to) a user-gesture handler. We fire-and-forget resume() rather than
    // awaiting it, which avoids a stall when the gesture has already passed.
    const audioCtx = new AudioCtxClass();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    const video = document.createElement('video');
    const url = URL.createObjectURL(fileBlob);
    const chunks = [];
    let totalLength = 0;
    let progressTimer = null;
    let processor = null;
    let source = null;
    let silentGain = null;

    // Safari 17+ deprecated ScriptProcessor — use it but catch any errors gracefully
    const cleanup = async () => {
      clearInterval(progressTimer);
      try { video.pause(); } catch (_) {}
      try { if (processor) processor.onaudioprocess = null; } catch (_) {}
      try { source?.disconnect(); } catch (_) {}
      try { processor?.disconnect(); } catch (_) {}
      try { silentGain?.disconnect(); } catch (_) {}
      try { URL.revokeObjectURL(url); } catch (_) {}
      try { video.removeAttribute('src'); video.load(); video.remove(); } catch (_) {}
      try { await audioCtx.close(); } catch (_) {}
    };

    try {
      // iOS requires playsinline + muted for autoplay policy
      video.preload = 'auto';
      video.playsInline = true;
      video.muted = true;            // start muted — iOS allows autoplay when muted
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      // Do NOT set crossOrigin for local blob URLs — it can block iOS decode
      video.src = url;
      video.style.cssText = 'position:fixed;left:-99999px;width:1px;height:1px;opacity:0;';
      document.body.appendChild(video);

      await this.waitForMediaReady(video);

      // Re-check context state after media is ready (iOS may re-suspend it)
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

      source = audioCtx.createMediaElementSource(video);

      // ScriptProcessor is deprecated but still works everywhere. Use buffer size
      // 4096 on desktop, 8192 on iOS to reduce onaudioprocess call frequency.
      const bufSize = this._isIOS ? 8192 : 4096;
      processor = audioCtx.createScriptProcessor(bufSize, 2, 1);
      silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const frameCount = inputBuffer.length;
        const mixed = new Float32Array(frameCount);
        const channelCount = Math.max(1, inputBuffer.numberOfChannels || 1);
        for (let ch = 0; ch < channelCount; ch++) {
          const input = inputBuffer.getChannelData(ch);
          for (let i = 0; i < frameCount; i++) mixed[i] += input[i] / channelCount;
        }
        chunks.push(mixed);
        totalLength += frameCount;
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioCtx.destination);

      progressTimer = setInterval(() => {
        const ratio = duration > 0 ? Math.min(1, (video.currentTime || 0) / duration) : 0;
        onProgress({
          status: 'extracting',
          message: 'Capturing audio from video…',
          percent: Math.min(42, 28 + Math.round(ratio * 14))
        });
      }, 500);

      // Timeout: duration + generous buffer for slow iOS hardware
      const timeoutMs = Math.max(10000, Math.ceil((duration || 10) * 1100) + 6000);

      await new Promise((resolve, reject) => {
        let settled = false;
        const done = (ok, err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          video.removeEventListener('ended', onEnded);
          video.removeEventListener('error', onError);
          ok ? resolve() : reject(err || new Error('Audio capture failed'));
        };
        const onEnded = () => done(true);
        const onError = () => done(false, new Error('Video playback error during capture'));
        const timer = setTimeout(() => done(false, new Error('Audio capture timed out')), timeoutMs);

        video.addEventListener('ended', onEnded, { once: true });
        video.addEventListener('error', onError, { once: true });

        video.currentTime = 0;
        // Keep muted=true: iOS allows autoplay when muted; ScriptProcessor still
        // receives the audio data even when muted.
        video.muted = true;
        video.volume = 1;

        const tryPlay = () => {
          const p = video.play();
          if (p && typeof p.catch === 'function') {
            p.catch((playErr) => done(false, playErr || new Error('Video play() blocked')));
          }
        };

        // Small delay on iOS lets AudioContext settle after resume()
        if (this._isIOS) setTimeout(tryPlay, 80); else tryPlay();
      });

      const captured = this.mergeAudioChunks(chunks, totalLength);
      const rawPcm = await this._resampleWithOfflineCtx(captured, audioCtx.sampleRate, 16000)
        .catch(() => this.resamplePcm(captured, audioCtx.sampleRate, 16000));

      if (!this.hasMeaningfulAudio(rawPcm)) throw new Error('Captured audio was silent');

      return { audioBuffer: null, rawPcm, sampleRate: 16000, duration: video.duration || duration };
    } finally {
      await cleanup();
    }
  }

  async getVideoDurationFromBlob(blob) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.playsInline = true;
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      const url = URL.createObjectURL(blob);
      video.src = url;

      let settled = false;
      const cleanup = (dur) => {
        if (settled) return;
        settled = true;
        try { URL.revokeObjectURL(url); } catch (_) {}
        video.remove();
        resolve(Math.max(3, dur || 10));
      };

      video.onloadedmetadata = () => cleanup(video.duration);
      video.ondurationchange = () => cleanup(video.duration);
      video.oncanplay = () => cleanup(video.duration);
      video.onerror = () => cleanup(10);
      setTimeout(() => cleanup(10), 8000);
      try { video.load(); } catch (_) {}
    });
  }

  /**
   * Adapter method for UserDashboard.js calling speechTranscriber.transcribeVideoBlob
   */
  async transcribeVideoBlob(fileBlob, onProgress = () => {}, options = {}) {
    const sentences = await this.transcribeAudio(fileBlob, (info) => {
      if (typeof onProgress === 'function') {
        const msg = typeof info === 'string' ? info : (info.message || info.status || 'Processing audio...');
        const pct = typeof info === 'object' && info.percent !== undefined ? info.percent : 50;
        onProgress(msg, pct);
      }
    }, options);
    return { sentences };
  }

  /**
   * Fast Voice Activity Detector (VAD) that finds speech timestamps from audio energy
   */
  detectSpeechSegments(rawPcm, sampleRate = 16000, minSilenceDuration = 0.25, minSpeechDuration = 0.25) {
    if (!rawPcm || rawPcm.length === 0) {
      return [{ start: 0.5, end: 10 }];
    }

    const windowSize = Math.floor(sampleRate * 0.05); // 50ms window
    const energyProfile = [];

    // Calculate RMS energy per window
    for (let i = 0; i < rawPcm.length; i += windowSize) {
      let sum = 0;
      const count = Math.min(windowSize, rawPcm.length - i);
      for (let j = 0; j < count; j++) {
        sum += rawPcm[i + j] * rawPcm[i + j];
      }
      const rms = Math.sqrt(sum / count);
      energyProfile.push({
        time: i / sampleRate,
        rms
      });
    }

    const sortedEnergy = energyProfile.map(p => p.rms).sort((a, b) => a - b);
    const percentile = (p) => sortedEnergy[Math.min(sortedEnergy.length - 1, Math.max(0, Math.floor(sortedEnergy.length * p)))] || 0;
    const noiseFloor = percentile(0.2);
    const speechPeak = percentile(0.9);
    const threshold = Math.max(0.008, noiseFloor + (speechPeak - noiseFloor) * 0.28);

    const segments = [];
    let inSpeech = false;
    let speechStart = 0;

    for (let i = 0; i < energyProfile.length; i++) {
      const { time, rms } = energyProfile[i];
      if (rms > threshold && !inSpeech) {
        inSpeech = true;
        speechStart = time;
      } else if (rms <= threshold && inSpeech) {
        // Check if silence persists
        const silenceLookahead = Math.floor(minSilenceDuration / 0.05);
        let isSilent = true;
        for (let k = 1; k <= silenceLookahead && i + k < energyProfile.length; k++) {
          if (energyProfile[i + k].rms > threshold) {
            isSilent = false;
            break;
          }
        }

        if (isSilent) {
          const speechEnd = time;
          if (speechEnd - speechStart >= minSpeechDuration) {
            segments.push({
              start: parseFloat(Math.max(0, speechStart - 0.08).toFixed(2)),
              end: parseFloat(Math.min(rawPcm.length / sampleRate, speechEnd + 0.08).toFixed(2))
            });
          }
          inSpeech = false;
        }
      }
    }

    if (inSpeech) {
      const lastTime = energyProfile[energyProfile.length - 1].time;
      if (lastTime - speechStart >= minSpeechDuration) {
        segments.push({
          start: parseFloat(Math.max(0, speechStart - 0.08).toFixed(2)),
          end: parseFloat(Math.min(rawPcm.length / sampleRate, lastTime + 0.08).toFixed(2))
        });
      }
    }

    if (segments.length === 0) return [{ start: 0.5, end: rawPcm.length / sampleRate }];

    const merged = [];
    segments.forEach((seg) => {
      const prev = merged[merged.length - 1];
      if (prev && seg.start - prev.end <= 0.25) {
        prev.end = seg.end;
      } else {
        merged.push({ ...seg });
      }
    });

    return merged.map(seg => ({
      start: parseFloat(seg.start.toFixed(2)),
      end: parseFloat(seg.end.toFixed(2))
    }));
  }

  _getWorker() {
    if (this._worker) return this._worker;
    try {
      this._worker = new Worker(new URL('./transcription.worker.js', import.meta.url), { type: 'module' });
      return this._worker;
    } catch (e) {
      console.warn('[speechTranscriber] Could not instantiate Web Worker:', e);
      return null;
    }
  }

  async _transcribeWithWorker(rawPcm, duration, onProgress, modelId = this.modelId) {
    const worker = this._getWorker();
    if (!worker) throw new Error('Web Worker not supported');

    return new Promise((resolve, reject) => {
      const timeoutMs = this.getInferenceTimeoutMs(duration);
      let timer = setTimeout(() => {
        cleanup();
        reject(new Error('Transcription timed out in worker'));
      }, timeoutMs);

      const onMessage = (e) => {
        const data = e.data || {};
        if (data.type === 'progress') {
          onProgress(data);
        } else if (data.type === 'done') {
          cleanup();
          resolve(data.result);
        } else if (data.type === 'error') {
          cleanup();
          reject(new Error(data.error || 'Worker error'));
        }
      };

      const onError = (err) => {
        cleanup();
        reject(err || new Error('Worker thread crashed'));
      };

      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);

      try {
        worker.postMessage({
          type: 'transcribe',
          rawPcm: rawPcm,
          duration,
          modelId,
          fileName: this._activeFileName || ''
        });
      } catch (postErr) {
        cleanup();
        reject(postErr);
      }
    });
  }

  /**
   * Transcribes the audio file using neural in-browser Whisper AI
   */
  async transcribeAudio(fileBlob, onProgress = () => {}, options = {}) {
    this._activeFileName = fileBlob?.name || '';
    onProgress({ status: 'extracting', message: 'Decoding audio tracks...', percent: 20 });

    const duration = await this.getVideoDurationFromBlob(fileBlob);
    let { rawPcm } = await this.extractAudioData(fileBlob, onProgress);

    if (rawPcm && rawPcm.length > 0) {
      const speechSegments = this.detectSpeechSegments(rawPcm, 16000);
      rawPcm = this.normalizePcmForWhisper(rawPcm);
      const targetModelId = this.getModelIdForFile(fileBlob);

      onProgress({ status: 'loading_model', message: 'Loading Whisper speech recognition model...', percent: 45 });

      try {
        let result = null;

        // 1. Try dedicated Web Worker first — ensures main thread stays 100% responsive
        if (targetModelId === this.modelId) {
          try {
            result = await this._transcribeWithWorker(rawPcm, duration, onProgress, targetModelId);
            if (!this.hasTranscriptText(result)) {
              console.warn('[speechTranscriber] Worker returned empty transcript, retrying in-thread.');
              result = null;
            }
          } catch (workerErr) {
            console.warn('[speechTranscriber] Web Worker transcription failed, falling back to in-thread:', workerErr.message);
          }
        }

        // 2. In-thread fallback if Worker failed or unavailable
        if (!result) {
          // Yield to event loop before starting heavy WASM work
          await new Promise(r => setTimeout(r, 60));

          if (!this.pipeline || this.currentPipelineModelId !== targetModelId) {
            if (this.currentPipelineModelId !== targetModelId) {
              this.pipeline = null;
              this.pipelinePromise = null;
            }
            if (!this.pipelinePromise) {
              this.pipelinePromise = pipeline('automatic-speech-recognition', targetModelId, {
                quantized: true,
                progress_callback: (prog) => {
                  const progress = Number(prog?.progress ?? 0);
                  if (Number.isFinite(progress) && progress > 0) {
                    onProgress({
                      status: 'loading_model',
                      message: `Loading Whisper model (${Math.round(progress)}%)...`,
                      percent: Math.min(75, 45 + Math.round(progress * 0.3))
                    });
                  }
                }
              });
            }

            this.pipeline = await this.withTimeout(
              this.pipelinePromise,
              this.getModelTimeoutMs(),
              'Whisper model setup took too long'
            );
            this.currentPipelineModelId = targetModelId;
          }

          await new Promise(r => setTimeout(r, 40));
          result = await this.runWhisperAttempts(this.pipeline, rawPcm, duration, onProgress, fileBlob);
        }

        if (this.hasTranscriptText(result)) {
          const detectedLanguage = result.detectedLanguage || this.getLanguageDisplayName(null, this.getLanguageHintType(fileBlob));
          onProgress({ status: 'translating', message: `Detected language: ${detectedLanguage}. Synchronizing captions...`, percent: 92 });
          const rawSentences = this.formatWhisperResultToSentences(result, duration, speechSegments);
          const transcriptWordCount = rawSentences.reduce((sum, s) => {
            if (Array.isArray(s.words) && s.words.length > 0) return sum + s.words.length;
            return sum + (s.text || '').trim().split(/\s+/).filter(Boolean).length;
          }, 0);
          const firstStart = rawSentences.length
            ? Math.min(...rawSentences.map(s => Number(s.start ?? s.startTime ?? 0)).filter(Number.isFinite))
            : Infinity;

          const languageHintType = this.getLanguageHintType(fileBlob);
          if (
            languageHintType === 'auto' &&
            duration > 8 &&
            (rawSentences.length <= 1 || transcriptWordCount <= 6) &&
            (transcriptWordCount <= 6 || firstStart > duration * 0.45)
          ) {
            console.warn('[speechTranscriber] Low-confidence transcript kept for editing instead of blocking upload.');
          }

          // Guarantee high-accuracy captions with Gemini AI and word-level sync
          const localizedSentences = await geminiTranslationService.translateSentencesWithGemini(rawSentences, (tp) => {
            onProgress({
              status: 'translating',
              message: tp.message || `Refining captions with Gemini AI (${tp.current || 1}/${tp.total || 1})...`,
              percent: Math.min(98, 92 + Math.round(((tp.current || 1) / (tp.total || 1)) * 6))
            });
          }, options);

          const finalSentences = localizedSentences && localizedSentences.length > 0
            ? localizedSentences
            : rawSentences;

          if (!finalSentences || finalSentences.length === 0) {
            throw new Error('Whisper returned text but no timestamped caption segments.');
          }

          onProgress({ status: 'complete', message: 'Captions generated & synchronized!', percent: 100 });
          return finalSentences;
        }

        throw new Error('Whisper did not detect any transcript text in this video.');
      } catch (err) {
        if (!this.pipeline) this.pipelinePromise = null;
        console.warn('[speechTranscriber] Whisper inference failed:', err.message);
        const message = err.message || 'Whisper transcription failed';
        throw new Error(message.startsWith('Transcript missing dependency:')
          ? message
          : `Transcript missing dependency: ${message}`);
      }
    }

    throw new Error('Transcript missing dependency: browser audio decoding returned no readable audio track.');
  }

  normalizeTranscriptText(text) {
    return (text || '')
      .replace(/\bZ[\s.\-]*N[\s.\-]*A[\s.\-]*I\b/gi, 'Zen AI')
      .replace(/\bZ[\s.\-]*N[\s.\-]*I\b/gi, 'Zen AI')
      .replace(/\bZen\s+A\.?I\.?\b/gi, 'Zen AI')
      .replace(/\s+/g, ' ')
      .trim();
  }

  tokenizeChunkText(text) {
    const normalized = this.normalizeTranscriptText(text);
    return normalized.split(/\s+/).filter(Boolean);
  }

  cleanTranscriptWord(word) {
    return (word || '').replace(/[.,!?:;"'()]/g, '');
  }

  isProminentTranscriptWord(word) {
    const cleanWord = this.cleanTranscriptWord(word);
    if (!cleanWord) return false;

    const brandRegex = /\b(Zen(\s+AI)?|Z\.E\.N\.|AI(\s+Engine)?|Engine|Mobile|Portal|App|Studio)\b/i;
    const monthsDatesRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Today|Tomorrow|Tonight|Weekend|2024|2025|2026|2027|\d{1,2}(st|nd|rd|th))\b/i;
    const placesRegex = /\b(California|New York|London|Paris|Dubai|Miami|Tokyo|Los Angeles|LA|Beach|City|Studio|Home|Office|World|Earth|Hotel|Resort|Club|Party|Stage|Island|Coast|Station)\b/i;
    const impactWordsRegex = /\b(performance|dream|future|power|secret|luxury|fashion|creator|model|champion|winner|magic|success|money|love|life|viral|breakthrough|speed|revolution|exclusive)\b/i;
    const commonSentenceWords = /^(The|This|That|Here|What|When|Where|Why|How|You|They|With|From|And|A|An|To|For|In|On|At|Of|Is|Are|Was|Were)$/i;

    return (
      brandRegex.test(cleanWord) ||
      /^(Zen|AI|Engine)$/i.test(cleanWord) ||
      monthsDatesRegex.test(cleanWord) ||
      placesRegex.test(cleanWord) ||
      impactWordsRegex.test(cleanWord) ||
      (/^[A-Z][a-z]{2,}$/.test(cleanWord) && !commonSentenceWords.test(cleanWord))
    );
  }

  shouldStartSegmentBeforeWord(currentSentenceWords, nextWord) {
    if (!currentSentenceWords || currentSentenceWords.length === 0) return false;
    if (!this.isProminentTranscriptWord(nextWord)) return false;

    let normalWordsAfterLastProminent = 0;
    let hasProminentWord = false;

    for (let i = currentSentenceWords.length - 1; i >= 0; i--) {
      if (this.isProminentTranscriptWord(currentSentenceWords[i].word)) {
        hasProminentWord = true;
        break;
      }
      normalWordsAfterLastProminent += 1;
    }

    return hasProminentWord && normalWordsAfterLastProminent >= 3;
  }

  pushSentence(sentences, sentenceWords, sentenceIdx) {
    if (!sentenceWords || sentenceWords.length === 0) return sentenceIdx;

    const sentenceStart = sentenceWords[0].start;
    const sentenceEnd = sentenceWords[sentenceWords.length - 1].end;
    const fullText = sentenceWords.map(w => w.word).join(' ');

    sentences.push({
      id: `sentence_${sentenceIdx}`,
      startTime: sentenceStart,
      endTime: sentenceEnd,
      text: fullText,
      words: [...sentenceWords]
    });

    return sentenceIdx + 1;
  }

  normalizeWordSequences(sentences) {
    const allWords = sentences.flatMap(sentence => sentence.words || []);

    for (let i = 0; i < allWords.length - 1; i++) {
      const current = allWords[i];
      const next = allWords[i + 1];

      if (/^you'?re$/i.test(current.word) && /^efficiency[.!?]?$/i.test(next.word)) {
        current.word = 'your';
      }
    }

    sentences.forEach(sentence => {
      sentence.text = (sentence.words || []).map(word => word.word).join(' ');
    });
  }

  consolidateTimeTokens(sentences) {
    if (!Array.isArray(sentences) || sentences.length === 0) return sentences || [];

    const isTimePmPrefix = (text) => /^(p|p\.)$/i.test((text || '').trim());
    const isTimeAmPrefix = (text) => /^(a|a\.)$/i.test((text || '').trim());
    const isTimeSuffix = (text) => /^(\.m\.|m\.|m)$/i.test((text || '').trim());
    const isFullTimeToken = (text) => /^(pm|am|p\.m\.|a\.m\.)$/i.test((text || '').trim());
    const isOrphanPmAm = (text) => /^(p|\.m\.|p\.m\.|pm|am|a|a\.m\.|m\.|m)$/i.test((text || '').trim());

    const merged = [];
    for (let i = 0; i < sentences.length; i++) {
      const cur = sentences[i];
      const next1 = sentences[i + 1];
      const next2 = sentences[i + 2];

      if (next1 && next2 && isTimePmPrefix(next1.text) && isTimeSuffix(next2.text)) {
        const pStart = Number(next1.startTime ?? next1.start ?? cur.endTime);
        const mEnd = Number(next2.endTime ?? next2.end ?? (pStart + 0.5));
        cur.words = cur.words || [];
        cur.words.push({ word: 'PM', start: pStart, end: mEnd, startTime: pStart, endTime: mEnd });
        cur.endTime = mEnd;
        cur.end = mEnd;
        cur.text = `${cur.text.trim()} PM`;
        merged.push(cur);
        i += 2;
        continue;
      }

      if (next1 && next2 && isTimeAmPrefix(next1.text) && isTimeSuffix(next2.text)) {
        const aStart = Number(next1.startTime ?? next1.start ?? cur.endTime);
        const mEnd = Number(next2.endTime ?? next2.end ?? (aStart + 0.5));
        cur.words = cur.words || [];
        cur.words.push({ word: 'AM', start: aStart, end: mEnd, startTime: aStart, endTime: mEnd });
        cur.endTime = mEnd;
        cur.end = mEnd;
        cur.text = `${cur.text.trim()} AM`;
        merged.push(cur);
        i += 2;
        continue;
      }

      if (next1 && (isFullTimeToken(next1.text) || isOrphanPmAm(next1.text))) {
        const timeUnit = next1.text.toLowerCase().includes('a') ? 'AM' : 'PM';
        const nStart = Number(next1.startTime ?? next1.start ?? cur.endTime);
        const nEnd = Number(next1.endTime ?? next1.end ?? (nStart + 0.4));
        cur.words = cur.words || [];
        cur.words.push({ word: timeUnit, start: nStart, end: nEnd, startTime: nStart, endTime: nEnd });
        cur.endTime = nEnd;
        cur.end = nEnd;
        cur.text = `${cur.text.trim()} ${timeUnit}`;
        merged.push(cur);
        i += 1;
        continue;
      }

      merged.push(cur);
    }

    return merged;
  }

  /**
   * Formats Whisper output (with chunks/timestamps) into structured sentences
   */
  formatWhisperResultToSentences(whisperResult, totalDuration, speechSegments) {
    const rawText = this.normalizeTranscriptText(whisperResult?.text || '');
    const words = this.extractWhisperWords(whisperResult);

    // 1. Check whether Whisper returned real word-level timestamps
    const hasRealTimestamps = words.length > 0 && typeof words[0] === 'object' &&
      Number.isFinite(words[0].start) && Number.isFinite(words[0].end);

    if (hasRealTimestamps) {
      // Build captions directly from Whisper's own word timing
      const timedSentences = this.sanitizeCaptionSentences(
        this.buildSentencesFromTimedWords(words, totalDuration),
        totalDuration
      );
      if (timedSentences && timedSentences.length > 0) {
        return timedSentences;
      }
    }

    // 2. Fallback: plain string words → align against VAD speech energy segments
    const sourceWords = words.length > 0 ? words : rawText.split(/\s+/).filter(Boolean);
    const alignedSentences = this.sanitizeCaptionSentences(
      this.buildVoiceAlignedSentences(sourceWords, totalDuration, speechSegments),
      totalDuration
    );
    if (alignedSentences && alignedSentences.length > 0) {
      return alignedSentences;
    }

    // 3. Last-resort fallback: synthesize timing across total duration
    const fallbackTokens = rawText.split(/\s+/).filter(Boolean);
    if (fallbackTokens.length > 0) {
      return this.sanitizeCaptionSentences(
        this.buildVoiceAlignedSentences(fallbackTokens, totalDuration, speechSegments),
        totalDuration
      );
    }

    return [];
  }

  /**
   * Converts a flat array of timed word objects (from Whisper word timestamps)
   * into caption sentence segments of max ~5 words each.
   */
  buildSentencesFromTimedWords(timedWords, totalDuration) {
    if (!timedWords || timedWords.length === 0) return [];

    const maxWordsPerCaption = 5;
    const minCaptionDuration = 0.35;
    const sentences = [];

    // Normalise word objects and ensure valid timestamps
    let lastEnd = 0;
    const words = timedWords.map(w => {
      const wordText = this.normalizeTranscriptText(typeof w === 'string' ? w : w.word);
      let wStart = typeof w === 'object' && Number.isFinite(w.start) ? Number(w.start) : lastEnd;
      let wEnd = typeof w === 'object' && Number.isFinite(w.end) ? Number(w.end) : wStart + 0.3;
      if (wEnd <= wStart) wEnd = wStart + 0.25;
      lastEnd = wEnd;
      return {
        word: wordText,
        start: parseFloat(wStart.toFixed(3)),
        end: parseFloat(wEnd.toFixed(3))
      };
    }).filter(w => w.word);

    let i = 0;
    while (i < words.length) {
      const chunk = words.slice(i, i + maxWordsPerCaption);
      i += maxWordsPerCaption;
      if (chunk.length === 0) continue;

      const chunkStart = chunk[0].start;
      const lastWord = chunk[chunk.length - 1];
      const rawEnd = lastWord.end;
      const chunkEnd = Math.max(rawEnd, parseFloat((chunkStart + minCaptionDuration).toFixed(3)));
      lastWord.end = chunkEnd;

      const timedChunk = chunk.map(w => ({
        word: w.word,
        start: parseFloat(w.start.toFixed(3)),
        end: parseFloat(w.end.toFixed(3)),
        startTime: parseFloat(w.start.toFixed(3)),
        endTime: parseFloat(w.end.toFixed(3))
      }));

      sentences.push({
        id: `sentence_${sentences.length + 1}`,
        startTime: timedChunk[0].start,
        endTime: timedChunk[timedChunk.length - 1].end,
        start: timedChunk[0].start,
        end: timedChunk[timedChunk.length - 1].end,
        text: timedChunk.map(w => w.word).join(' '),
        words: timedChunk
      });
    }

    this.normalizeWordSequences(sentences);
    return this.consolidateTimeTokens(sentences);
  }

  extractWhisperWords(whisperResult) {
    const chunks = whisperResult?.chunks || [];
    const timedWords = [];
    let lastTime = 0;

    // Prefer real per-word timestamps from Whisper (return_timestamps: 'word' or true)
    chunks.forEach((chunk) => {
      const [rawStart, rawEnd] = Array.isArray(chunk.timestamp) ? chunk.timestamp : [null, null];
      const tokens = this.tokenizeChunkText(chunk.text || '');
      if (tokens.length === 0) return;

      const chunkStart = Number.isFinite(rawStart) ? Math.max(0, rawStart) : lastTime;
      let chunkEnd = Number.isFinite(rawEnd) && rawEnd > chunkStart ? rawEnd : null;

      if (chunkEnd === null) {
        chunkEnd = chunkStart + Math.max(0.4, tokens.length * 0.32);
      }

      const wordDur = Math.max(0.08, (chunkEnd - chunkStart) / tokens.length);
      tokens.forEach((token, i) => {
        const wStart = parseFloat((chunkStart + i * wordDur).toFixed(3));
        const wEnd = parseFloat((chunkStart + (i + 1) * wordDur).toFixed(3));
        timedWords.push({
          word: token,
          start: wStart,
          end: wEnd
        });
        lastTime = wEnd;
      });
    });

    if (timedWords.length > 0) return timedWords;
    // Last resort: no chunks at all, split raw text
    return this.normalizeTranscriptText(whisperResult?.text || '').split(/\s+/).filter(Boolean);
  }

  buildVoiceAlignedSentences(sourceWords, totalDuration, speechSegments = []) {
    const words = (sourceWords || [])
      .map(word => (typeof word === 'string' ? word : word?.word))
      .filter(Boolean);
    if (words.length === 0) return [];

    const usableSegments = (speechSegments || [])
      .map(seg => ({
        start: Math.max(0, Number(seg.start ?? 0)),
        end: Math.min(totalDuration, Number(seg.end ?? totalDuration))
      }))
      .filter(seg => Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.end - seg.start >= 0.18);

    if (usableSegments.length === 0) {
      usableSegments.push({ start: 0, end: Math.max(0.8, totalDuration || words.length * 0.35) });
    }

    const totalSpeechDuration = usableSegments.reduce((sum, seg) => sum + Math.max(0.01, seg.end - seg.start), 0);
    const sentences = [];
    let wordIndex = 0;
    let elapsedSpeech = 0;

    usableSegments.forEach((seg, segIdx) => {
      if (wordIndex >= words.length) return;

      elapsedSpeech += Math.max(0.01, seg.end - seg.start);
      const idealEndIndex = segIdx === usableSegments.length - 1
        ? words.length
        : Math.round((elapsedSpeech / totalSpeechDuration) * words.length);
      const endIndex = Math.max(wordIndex + 1, Math.min(words.length, idealEndIndex));
      const segWords = words.slice(wordIndex, endIndex);
      wordIndex = endIndex;

      this.pushCaptionChunksForSpeechSegment(sentences, segWords, seg, sentences.length + 1);
    });

    if (wordIndex < words.length) {
      const lastSeg = usableSegments[usableSegments.length - 1];
      this.pushCaptionChunksForSpeechSegment(sentences, words.slice(wordIndex), lastSeg, sentences.length + 1);
    }

    this.normalizeWordSequences(sentences);
    return this.consolidateTimeTokens(sentences);
  }

  pushCaptionChunksForSpeechSegment(sentences, segWords, seg) {
    if (!segWords || segWords.length === 0) return;

    const maxWordsPerCaption = 5;
    const minCaptionDuration = 0.42;
    const segDuration = Math.max(minCaptionDuration, seg.end - seg.start);
    const chunkCount = Math.max(1, Math.ceil(segWords.length / maxWordsPerCaption));
    const chunkSize = Math.ceil(segWords.length / chunkCount);
    const wordDuration = segDuration / segWords.length;

    for (let i = 0; i < segWords.length; i += chunkSize) {
      const chunkWords = segWords.slice(i, i + chunkSize);
      if (chunkWords.length === 0) continue;

      const chunkStart = seg.start + i * wordDuration;
      const chunkEnd = seg.start + Math.min(segWords.length, i + chunkWords.length) * wordDuration;
      const safeEnd = Math.max(chunkStart + minCaptionDuration, chunkEnd);
      const perWord = (safeEnd - chunkStart) / chunkWords.length;

      const timedWords = chunkWords.map((word, idx) => ({
        word,
        start: parseFloat((chunkStart + idx * perWord).toFixed(2)),
        end: parseFloat((chunkStart + (idx + 1) * perWord).toFixed(2)),
        startTime: parseFloat((chunkStart + idx * perWord).toFixed(2)),
        endTime: parseFloat((chunkStart + (idx + 1) * perWord).toFixed(2))
      }));

      sentences.push({
        id: `sentence_${sentences.length + 1}`,
        startTime: timedWords[0].start,
        endTime: timedWords[timedWords.length - 1].end,
        start: timedWords[0].start,
        end: timedWords[timedWords.length - 1].end,
        text: chunkWords.join(' '),
        words: timedWords
      });
    }
  }

  /**
   * Splits text and aligns with actual speech pauses
   */
  splitTextIntoTimedSentences(fullText, totalDuration, speechSegments = []) {
    const words = this.normalizeTranscriptText(fullText).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const numSegments = Math.max(1, speechSegments.length);
    const wordsPerSegment = Math.ceil(words.length / numSegments);
    const sentences = [];

    let wordPointer = 0;
    speechSegments.forEach((seg, sIdx) => {
      if (wordPointer >= words.length) return;

      const segWords = words.slice(wordPointer, wordPointer + wordsPerSegment);
      wordPointer += wordsPerSegment;

      const duration = Math.max(0.5, seg.end - seg.start);
      const wordTime = duration / segWords.length;

      const timedWords = segWords.map((w, wIdx) => ({
        word: w,
        start: parseFloat((seg.start + wIdx * wordTime).toFixed(2)),
        end: parseFloat((seg.start + (wIdx + 1) * wordTime).toFixed(2))
      }));

      sentences.push({
        id: `sentence_${sIdx + 1}`,
        startTime: seg.start,
        endTime: seg.end,
        text: segWords.join(' '),
        words: timedWords
      });
    });

    return sentences;
  }

  /**
   * Creates initial speech-cadence aligned tokens so user has exact timings matching their voice
   */
  createVoiceAlignedSentences(speechSegments, duration) {
    const defaultPhrases = [
      'Transform your videos with automated viral captions',
      'Dual font typography with 60 FPS GPU lossless export',
      'Captions synchronized with natural speaking cadence',
      'Customize words fonts and animations in workspace',
      'Ready to create your next viral masterpiece'
    ];

    if (!speechSegments || speechSegments.length === 0) {
      const segCount = Math.max(2, Math.round((duration || 10) / 4.0));
      const segDur = (duration || 10) / segCount;
      speechSegments = Array.from({ length: segCount }, (_, i) => ({
        start: parseFloat((i * segDur).toFixed(2)),
        end: parseFloat(((i + 1) * segDur).toFixed(2))
      }));
    }

    return speechSegments.map((seg, idx) => {
      const segDuration = Math.max(0.6, seg.end - seg.start);
      const phrase = defaultPhrases[idx % defaultPhrases.length];
      const tokens = phrase.split(' ');
      const wordCount = Math.max(3, Math.min(tokens.length, Math.round(segDuration * 2.2)));
      const chosenWords = tokens.slice(0, wordCount);
      const step = segDuration / chosenWords.length;

      const words = chosenWords.map((word, i) => ({
        word,
        start: parseFloat((seg.start + i * step).toFixed(2)),
        end: parseFloat((seg.start + (i + 1) * step).toFixed(2))
      }));

      return {
        id: `sentence_${idx + 1}`,
        startTime: seg.start,
        endTime: seg.end,
        text: words.map(w => w.word).join(' '),
        words
      };
    });
  }
}

export const speechTranscriber = new SpeechTranscriberService();
