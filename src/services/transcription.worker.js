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

async function runTranscriptionAttempts(rawPcm, options = {}) {
  const pcm = normalizePcmForWhisper(rawPcm);
  const attempts = [
    {
      message: 'Transcribing spoken words with Whisper...',
      percent: 80,
      options: { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' }
    },
    {
      message: 'Retrying with phrase timestamps...',
      percent: 84,
      options: { return_timestamps: true, chunk_length_s: 20, stride_length_s: 4, task: 'transcribe' }
    },
    {
      message: 'Retrying plain transcript extraction...',
      percent: 88,
      options: { return_timestamps: false, chunk_length_s: 20, stride_length_s: 4, task: 'transcribe' }
    }
  ];

  let lastError = null;
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
      if (hasTranscriptText(result)) return result;
      lastError = new Error('Whisper returned an empty transcript for this attempt');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Whisper did not detect any transcript text in this video.');
}

self.addEventListener('message', async (e) => {
  const { type, rawPcm, modelId, options } = e.data || {};

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

      const result = await runTranscriptionAttempts(rawPcm, options);
      self.postMessage({ type: 'done', result });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message || String(err) });
    }
  }
});
