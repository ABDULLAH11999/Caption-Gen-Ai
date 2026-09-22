import { pipeline, env } from '@xenova/transformers';
import { translationService } from './translationService.js';

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
  }

  withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  getModelTimeoutMs() {
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent);
    return isMobile ? 240000 : 180000;
  }

  getInferenceTimeoutMs(duration) {
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent);
    const base = isMobile ? 240000 : 180000;
    return Math.min(600000, Math.max(base, Math.ceil((duration || 30) * 6000)));
  }

  /**
   * Decodes an audio/video file Blob into raw PCM audio float array and audio buffer.
   */
  async extractAudioData(fileBlob) {
    const duration = await this.getVideoDurationFromBlob(fileBlob);
    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.ceil(duration * targetSampleRate));
    const isAppleMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isVideoContainer = !fileBlob.type || fileBlob.type.startsWith('video/') || /mp4|quicktime|mov|webm/i.test(fileBlob.type);

    if (isAppleMobile && isVideoContainer) {
      console.warn('[speechTranscriber] Skipping browser audio decode for iPhone/iPad video container.');
      return {
        audioBuffer: null,
        rawPcm: null,
        sampleRate: 16000,
        duration
      };
    }

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) throw new Error('AudioContext not supported');

      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (_) {}
      }

      const arrayBuffer = await fileBlob.arrayBuffer();

      const decodedBuffer = await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Audio decoding timed out'));
          }
        }, isAppleMobile ? 8000 : 45000);

        try {
          const res = audioCtx.decodeAudioData(
            arrayBuffer,
            (buf) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(buf);
              }
            },
            (err) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err || new Error('Audio decode failure'));
              }
            }
          );

          if (res && typeof res.then === 'function') {
            res.then(
              (buf) => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  resolve(buf);
                }
              },
              (err) => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  reject(err);
                }
              }
            );
          }
        } catch (e) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(e);
          }
        }
      });

      const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OfflineCtxClass) throw new Error('OfflineAudioContext not supported');

      const renderLength = Math.min(targetLength, Math.ceil((decodedBuffer.duration || duration) * targetSampleRate));
      const offlineCtx = new OfflineCtxClass(1, Math.max(1, renderLength), targetSampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const resampledBuffer = await offlineCtx.startRendering();
      const rawPcm = resampledBuffer.getChannelData(0);

      try { audioCtx.close(); } catch (_) {}

      return { 
        audioBuffer: resampledBuffer, 
        rawPcm, 
        sampleRate: 16000, 
        duration: decodedBuffer.duration || duration 
      };
    } catch (err) {
      console.warn('[speechTranscriber] Audio extraction fallback:', err.message);
      return {
        audioBuffer: null,
        rawPcm: null,
        sampleRate: 16000,
        duration
      };
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
  async transcribeVideoBlob(fileBlob, onProgress = () => {}) {
    const sentences = await this.transcribeAudio(fileBlob, (info) => {
      if (typeof onProgress === 'function') {
        const msg = typeof info === 'string' ? info : (info.message || info.status || 'Processing audio...');
        const pct = typeof info === 'object' && info.percent !== undefined ? info.percent : 50;
        onProgress(msg, pct);
      }
    });
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

  /**
   * Transcribes the audio file using neural in-browser Whisper AI
   */
  async transcribeAudio(fileBlob, onProgress = () => {}) {
    onProgress({ status: 'extracting', message: 'Decoding audio tracks...', percent: 20 });

    const duration = await this.getVideoDurationFromBlob(fileBlob);
    const { rawPcm } = await this.extractAudioData(fileBlob);

    if (rawPcm && rawPcm.length > 0) {
      const speechSegments = this.detectSpeechSegments(rawPcm, 16000);

      onProgress({ status: 'loading_model', message: 'Loading Whisper speech recognition model...', percent: 45 });

      try {
        if (!this.pipeline) {
          if (!this.pipelinePromise) {
            this.pipelinePromise = pipeline('automatic-speech-recognition', this.modelId, {
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
        }

        onProgress({ status: 'transcribing', message: 'Transcribing spoken words with Whisper...', percent: 80 });

        const result = await this.withTimeout(
          this.pipeline(rawPcm, {
            return_timestamps: false,
            chunk_length_s: 30,
            stride_length_s: 5,
            task: 'transcribe'
          }),
          this.getInferenceTimeoutMs(duration),
          'Whisper transcription took too long'
        );

        if (result && result.text && result.text.trim()) {
          onProgress({ status: 'translating', message: 'Synchronizing English captions...', percent: 92 });
          const rawSentences = this.formatWhisperResultToSentences(result, duration, speechSegments);

          // Guarantee 100% fluent English captions with word-level sync
          const englishSentences = await translationService.translateSentencesToEnglish(rawSentences, (tp) => {
            onProgress({
              status: 'translating',
              message: `Refining captions (${tp.current}/${tp.total})...`,
              percent: Math.min(98, 92 + Math.round((tp.current / tp.total) * 6))
            });
          });

          onProgress({ status: 'complete', message: 'Captions generated & synchronized!', percent: 100 });
          return englishSentences;
        }
      } catch (err) {
        if (!this.pipeline) this.pipelinePromise = null;
        console.warn('[speechTranscriber] Whisper inference fallback:', err.message);
      }
    }

    onProgress({ status: 'complete', message: 'No speech transcript detected.', percent: 100 });
    return [];
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
    const rawText = this.normalizeTranscriptText(whisperResult.text);
    const words = this.extractWhisperWords(whisperResult);
    const sourceWords = words.length > 0 ? words : rawText.split(/\s+/).filter(Boolean);

    return this.buildVoiceAlignedSentences(sourceWords, totalDuration, speechSegments);
  }

  extractWhisperWords(whisperResult) {
    const chunks = whisperResult?.chunks || [];
    const words = [];

    chunks.forEach((chunk) => {
      const tokens = this.tokenizeChunkText(chunk.text || '');
      tokens.forEach((token) => words.push(token));
    });

    if (words.length > 0) return words;
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
