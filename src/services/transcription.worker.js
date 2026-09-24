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

      self.postMessage({
        type: 'progress',
        status: 'transcribing',
        message: 'Transcribing spoken words with Whisper…',
        percent: 80
      });

      let result;
      try {
        result = await transcriberPipeline(rawPcm, {
          return_timestamps: 'word',
          chunk_length_s: 30,
          stride_length_s: 5,
          task: 'transcribe',
          ...(options || {})
        });
      } catch (wordTsErr) {
        self.postMessage({
          type: 'progress',
          status: 'transcribing',
          message: 'Retrying transcription…',
          percent: 82
        });
        result = await transcriberPipeline(rawPcm, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
          task: 'transcribe',
          ...(options || {})
        });
      }

      self.postMessage({ type: 'done', result });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message || String(err) });
    }
  }
});
