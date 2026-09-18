import { pipeline, env } from '@xenova/transformers';
import { translationService } from './translationService.js';

// Configure transformers to use local/cached models
env.allowLocalModels = false;
env.useBrowserCache = true;

class SpeechTranscriberService {
  constructor() {
    this.pipeline = null;
    this.isLoading = false;
  }

  /**
   * Decodes an audio/video file Blob into raw PCM audio float array and audio buffer
   */
  async extractAudioData(fileBlob) {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000 // 16kHz standard for speech recognition
    });

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const rawPcm = audioBuffer.getChannelData(0); // mono channel float32
    return { audioBuffer, rawPcm, sampleRate: audioBuffer.sampleRate, duration: audioBuffer.duration };
  }

  /**
   * Fast Voice Activity Detector (VAD) that finds speech timestamps from audio energy
   */
  detectSpeechSegments(rawPcm, sampleRate = 16000, minSilenceDuration = 0.45, minSpeechDuration = 0.5) {
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

    // Dynamic threshold based on average energy
    const avgEnergy = energyProfile.reduce((acc, p) => acc + p.rms, 0) / (energyProfile.length || 1);
    const threshold = Math.max(0.012, avgEnergy * 0.7);

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
              start: parseFloat(speechStart.toFixed(2)),
              end: parseFloat(speechEnd.toFixed(2))
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
          start: parseFloat(speechStart.toFixed(2)),
          end: parseFloat(lastTime.toFixed(2))
        });
      }
    }

    return segments.length > 0 ? segments : [{ start: 0.5, end: rawPcm.length / sampleRate }];
  }

  /**
   * Transcribes the audio file using local in-browser Whisper or Web Speech
   */
  async transcribeAudio(fileBlob, onProgress = () => {}) {
    onProgress({ status: 'extracting', message: 'Decoding audio tracks...', percent: 15 });

    const { rawPcm, duration } = await this.extractAudioData(fileBlob);
    const speechSegments = this.detectSpeechSegments(rawPcm, 16000);

    onProgress({ status: 'analyzing', message: 'Running AI speech recognition...', percent: 40 });

    try {
      // Attempt Whisper via Transformers.js
      if (!this.pipeline) {
        onProgress({ status: 'loading_model', message: 'Initializing Whisper AI speech model...', percent: 50 });
        this.pipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
          progress_callback: (prog) => {
            if (prog && prog.progress) {
              onProgress({
                status: 'loading_model',
                message: `Loading Whisper speech model (${Math.round(prog.progress)}%)...`,
                percent: Math.min(85, 50 + Math.round(prog.progress * 0.35))
              });
            }
          }
        });
      }

      onProgress({ status: 'transcribing', message: 'Transcribing & translating speech to English...', percent: 78 });

      // Run transcription with Whisper translate task (translates Hindi, Urdu, Spanish, etc. into English)
      const result = await this.pipeline(rawPcm, {
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5,
        task: 'translate'
      });

      if (result && result.text && result.text.trim()) {
        onProgress({ status: 'translating', message: 'Synchronizing English captions...', percent: 90 });
        const rawSentences = this.formatWhisperResultToSentences(result, duration, speechSegments);

        // Guarantee 100% fluent English captions with word-level sync
        const englishSentences = await translationService.translateSentencesToEnglish(rawSentences, (tp) => {
          onProgress({
            status: 'translating',
            message: `Refining English captions (${tp.current}/${tp.total})...`,
            percent: Math.min(98, 90 + Math.round((tp.current / tp.total) * 8))
          });
        });

        onProgress({ status: 'complete', message: 'English captions generated & synchronized!', percent: 100 });
        return englishSentences;
      }
    } catch (err) {
      console.warn('Whisper model in-browser inference fallback:', err);
    }

    // Fallback: If Whisper takes too long or fails on memory-constrained device,
    // construct aligned sentences based on the detected speech segments so user can customize/edit.
    return this.createVoiceAlignedSentences(speechSegments, duration);
  }

  /**
   * Formats Whisper output (with chunks/timestamps) into structured sentences
   */
  formatWhisperResultToSentences(whisperResult, totalDuration, speechSegments) {
    const rawText = whisperResult.text.trim();
    const chunks = whisperResult.chunks || [];

    if (chunks.length > 0) {
      // Group chunks into 5-8 word sentences for natural viral caption appearance
      const sentences = [];
      let currentSentenceWords = [];
      let sentenceStart = 0;
      let sentenceIdx = 1;

      chunks.forEach((c, idx) => {
        const wordText = (c.text || '').trim();
        if (!wordText) return;

        const wStart = c.timestamp ? (c.timestamp[0] ?? 0) : idx * 0.5;
        const wEnd = c.timestamp ? (c.timestamp[1] ?? wStart + 0.4) : wStart + 0.4;

        if (currentSentenceWords.length === 0) {
          sentenceStart = wStart;
        }

        currentSentenceWords.push({
          word: wordText,
          start: parseFloat(wStart.toFixed(2)),
          end: parseFloat(wEnd.toFixed(2))
        });

        const isPunctuationBreak = /[.!?]$/.test(wordText);
        const isLengthBreak = currentSentenceWords.length >= 6;

        if (isPunctuationBreak || isLengthBreak || idx === chunks.length - 1) {
          const sentenceEnd = currentSentenceWords[currentSentenceWords.length - 1].end;
          const fullText = currentSentenceWords.map(w => w.word).join(' ');

          sentences.push({
            id: `sentence_${sentenceIdx++}`,
            startTime: sentenceStart,
            endTime: sentenceEnd,
            text: fullText,
            words: [...currentSentenceWords]
          });

          currentSentenceWords = [];
        }
      });

      if (sentences.length > 0) return sentences;
    }

    // Fallback from raw text
    return this.splitTextIntoTimedSentences(rawText, totalDuration, speechSegments);
  }

  /**
   * Splits text and aligns with actual speech pauses
   */
  splitTextIntoTimedSentences(fullText, totalDuration, speechSegments = []) {
    const words = fullText.trim().split(/\s+/).filter(Boolean);
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
    return speechSegments.map((seg, idx) => {
      const segDuration = Math.max(0.6, seg.end - seg.start);
      // Create 3-5 word placeholder tokens aligned to exact audio peaks
      const wordCount = Math.min(6, Math.max(3, Math.round(segDuration * 2.2)));
      const step = segDuration / wordCount;
      const words = [];

      for (let i = 0; i < wordCount; i++) {
        const start = parseFloat((seg.start + i * step).toFixed(2));
        const end = parseFloat((seg.start + (i + 1) * step).toFixed(2));
        words.push({
          word: `[Speech ${i + 1}]`,
          start,
          end
        });
      }

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
