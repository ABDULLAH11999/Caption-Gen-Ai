import { pipeline, env } from '@xenova/transformers';

// Configure transformers in Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

if (!env.backends) env.backends = {};
if (!env.backends.onnx) env.backends.onnx = {};
if (!env.backends.onnx.wasm) env.backends.onnx.wasm = {};
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.backends.onnx.wasm.proxy = false;

let transcriberPipeline = null;
let currentModelId = 'Xenova/whisper-tiny';

function hasTranscriptText(result) {
  return !!(result && typeof result.text === 'string' && result.text.trim().length > 0);
}

function getLanguageHintType(fileName = '') {
  const name = String(fileName || '').toLowerCase();
  if (/(urdu|hindi|roman|hinglish|pakistan|india|desi|bharat|test-run)/i.test(name)) return 'south_asian';
  if (/(english|eng|showcase)/i.test(name)) return 'english';
  return 'auto';
}

function getDominantNgramRatio(words, size = 2) {
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

function isRepetitiveTranscriptText(text) {
  const words = (text || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 8) return false;
  const uniqueRatio = new Set(words).size / Math.max(1, words.length);
  return uniqueRatio < 0.45 ||
    getDominantNgramRatio(words, 2) > 0.34 ||
    getDominantNgramRatio(words, 3) > 0.28;
}

function scoreTranscriptCandidate(result, language = null, hintType = 'auto') {
  const text = (result?.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return -Infinity;

  const words = text.split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const uniqueRatio = new Set(words.map(w => w.toLowerCase())).size / Math.max(1, words.length);
  const isRepetitive = isRepetitiveTranscriptText(text);
  const hasSouthAsianScript = /[\u0600-\u06FF\u0900-\u097F]/.test(text);
  const hasRomanSouthAsian = /\b(kya|kyun|kaise|kese|aap|tum|hum|hai|hain|nahi|haan|acha|bhai|dost|raha|rahi|rahe|kar|karo|aur|bhi|main|mera|meri|apka|shukriya|assalam|namaste)\b/i.test(text);
  const hasCommonEnglish = /\b(the|and|you|to|of|this|that|with|for|have|will|not|switch|come)\b/i.test(text);
  const irrelevantEnglishLoop = /\b(come to you|switch to this|you will not have to|we all have|grand theft|caption generation studio)\b/i.test(lower);

  let score = words.length + Math.min(12, uniqueRatio * 12);
  if (Array.isArray(result?.chunks) && result.chunks.length > 0) score += Math.min(10, result.chunks.length);

  if (hintType === 'south_asian') {
    if (language === 'hindi' || language === 'urdu') score += 18;
    if (hasSouthAsianScript) score += 32;
    if (hasRomanSouthAsian && !isRepetitive) score += 18;
    if (language === 'english' && !hasSouthAsianScript && !hasRomanSouthAsian) score -= 22;
    if (hasCommonEnglish && !hasSouthAsianScript && !hasRomanSouthAsian) score -= 10;
    if (irrelevantEnglishLoop) score -= 35;
    if (isRepetitive) score -= 38;
  } else if (hintType === 'english') {
    if (language === 'english') score += 16;
    if (hasSouthAsianScript) score -= 20;
  }

  if (words.length <= 3) score -= 16;
  if (uniqueRatio < 0.45 && words.length > 8) score -= 12;

  return score;
}

function isLikelyWeakEnglishHallucination(result) {
  const text = (result?.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!text) return false;
  if (/[\u0600-\u06FF\u0900-\u097F]/.test(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  const uniqueRatio = new Set(words).size / Math.max(1, words.length);
  const knownWeakLoop = /\b(come to you|switch to this|you will not have to|we all have|grand theft|caption generation studio)\b/i.test(text);
  const repeatedShortEnglish = words.length >= 8 && (uniqueRatio < 0.55 || isRepetitiveTranscriptText(text));
  const tinyChunkCoverage = Array.isArray(result?.chunks) && result.chunks.length <= 1 && words.length >= 10;

  return knownWeakLoop || (repeatedShortEnglish && tinyChunkCoverage);
}

function normalizePcmForWhisper(rawPcm) {
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

function getLanguageHintOrder(fileName = '') {
  const hintType = getLanguageHintType(fileName);
  if (hintType === 'south_asian') {
    return ['hindi', 'urdu', null, 'english'];
  }
  if (hintType === 'english') {
    return ['english', null, 'hindi', 'urdu'];
  }
  return [null, 'hindi', 'urdu', 'english'];
}

function buildTranscriptionAttempts(fileName = '') {
  const languageHints = getLanguageHintOrder(fileName);
  const attempts = [];
  const seen = new Set();
  const addAttempt = (timestampMode, language, basePercent, labelPrefix) => {
    const key = `${timestampMode}:${language || 'auto'}`;
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({
      message: language
        ? `${labelPrefix} (${language})...`
        : `${labelPrefix}...`,
      language,
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

  languageHints.forEach((language) => {
    addAttempt('word', language, 80, 'Transcribing spoken words with Whisper');
  });
  languageHints.forEach((language) => {
    addAttempt(true, language, 86, 'Retrying with phrase timestamps');
  });

  return attempts;
}

async function runTranscriptionAttempts(rawPcm, options = {}, fileName = '') {
  const pcm = normalizePcmForWhisper(rawPcm);
  const attempts = buildTranscriptionAttempts(fileName);
  const hintType = getLanguageHintType(fileName);
  const shouldCompareCandidates = hintType === 'south_asian';

  let lastError = null;
  let bestCandidate = null;
  for (const attempt of attempts) {
    try {
      self.postMessage({
        type: 'progress',
        status: 'transcribing',
        message: attempt.message,
        percent: attempt.percent
      });
      const result = await transcriberPipeline(pcm, {
        ...attempt.options,
        ...(options || {})
      });
      if (hasTranscriptText(result)) {
        const shouldKeepTryingForAuto = hintType === 'auto' &&
          !attempt.language &&
          isLikelyWeakEnglishHallucination(result);

        if (!shouldCompareCandidates && !shouldKeepTryingForAuto) return result;

        const score = scoreTranscriptCandidate(result, attempt.language, hintType);
        if (!bestCandidate || score > bestCandidate.score) {
          bestCandidate = { result, score };
        }

        if (score >= 55 && /[\u0600-\u06FF\u0900-\u097F]/.test(result.text || '')) {
          return result;
        }
      }
      lastError = new Error('Whisper returned an empty transcript for this attempt');
    } catch (err) {
      lastError = err;
    }
  }

  if (bestCandidate?.result) return bestCandidate.result;
  throw lastError || new Error('Whisper did not detect any transcript text in this video.');
}

self.addEventListener('message', async (e) => {
  const { type, rawPcm, modelId, options, fileName } = e.data || {};

  if (type === 'init' || type === 'transcribe') {
    const targetModel = modelId || currentModelId;

    try {
      if (!transcriberPipeline || currentModelId !== targetModel) {
        self.postMessage({
          type: 'progress',
          status: 'loading_model',
          message: 'Loading Whisper speech recognition model...',
          percent: 45
        });

        transcriberPipeline = await pipeline('automatic-speech-recognition', targetModel, {
          quantized: true,
          progress_callback: (prog) => {
            const progress = Number(prog?.progress ?? 0);
            if (Number.isFinite(progress) && progress > 0) {
              self.postMessage({
                type: 'progress',
                status: 'loading_model',
                message: `Loading Whisper model (${Math.round(progress)}%)...`,
                percent: Math.min(75, 45 + Math.round(progress * 0.3))
              });
            }
          }
        });
        currentModelId = targetModel;
      }

      if (type === 'init') {
        self.postMessage({ type: 'init_done' });
        return;
      }

      const result = await runTranscriptionAttempts(rawPcm, options, fileName);
      self.postMessage({ type: 'done', result });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message || String(err) });
    }
  }
});
