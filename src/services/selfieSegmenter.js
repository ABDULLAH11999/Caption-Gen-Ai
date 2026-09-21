// Client-Side Video Rotoscoping Engine via MediaPipe Image Segmenter
// Enables "Captions Behind Subject/Person" via 3-Layer Sandwich Compositing
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

class SelfieSegmenterService {
  constructor() {
    this.segmenter = null;
    this.isLoading = false;
    this.isInitialized = false;
    this.initPromise = null;
    this.cutoutCanvas = document.createElement('canvas');
    this.cutoutCtx = this.cutoutCanvas.getContext('2d');
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');
    this.maskImageData = null;
    this.lastTimestamp = -1;
  }

  /**
   * Initializes the MediaPipe vision task and loads the selfie segmenter model (~250 KB)
   */
  async init(onProgress) {
    if (this.isInitialized && this.segmenter) {
      if (onProgress) onProgress(100, 'Rotoscoping AI Ready');
      return this.segmenter;
    }
    if (this.initPromise) return this.initPromise;

    this.isLoading = true;
    this.initPromise = (async () => {
      try {
        if (onProgress) onProgress(25, 'Loading Vision WASM modules...');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        if (onProgress) onProgress(60, 'Loading Selfie Segmenter TFLite model...');
        this.segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          outputConfidenceMasks: true,
          outputCategoryMask: true
        });

        if (onProgress) onProgress(100, 'GPU Rotoscoping Pipeline Ready!');
        this.isInitialized = true;
        this.isLoading = false;
        return this.segmenter;
      } catch (err) {
        console.warn('GPU delegate failed or initial load issue, falling back to CPU delegate:', err);
        try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
          this.segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            outputConfidenceMasks: true,
            outputCategoryMask: true
          });
          this.isInitialized = true;
          this.isLoading = false;
          if (onProgress) onProgress(100, 'CPU Rotoscoping Pipeline Ready!');
          return this.segmenter;
        } catch (fallbackErr) {
          this.isLoading = false;
          this.initPromise = null;
          console.error('Failed to initialize Selfie Segmenter:', fallbackErr);
          throw fallbackErr;
        }
      }
    })();

    return this.initPromise;
  }

  isReady() {
    return this.isInitialized && !!this.segmenter;
  }

  /**
   * Generates the foreground person cutout on this.cutoutCanvas from maskObj
   * Person pixels are preserved with original video content; background pixels are made 100% transparent.
   */
  applyMaskAndCutout(maskObj, video, width, height, enhanceQuality = false) {
    const maskW = maskObj.width;
    const maskH = maskObj.height;

    if (this.maskCanvas.width !== maskW || this.maskCanvas.height !== maskH) {
      this.maskCanvas.width = maskW;
      this.maskCanvas.height = maskH;
      this.maskImageData = this.maskCtx.createImageData(maskW, maskH);
    }

    const data = this.maskImageData.data;
    const totalPixels = maskW * maskH;

    // Check if maskObj is Float32 (Confidence Mask) or Uint8 (Category Mask)
    if (typeof maskObj.getAsFloat32Array === 'function') {
      const floatArr = maskObj.getAsFloat32Array();
      // Sample top corners to identify background value baseline
      const cornerAvg = (floatArr[0] + floatArr[Math.max(0, maskW - 1)]) / 2;
      const invert = cornerAvg > 0.5;

      for (let i = 0; i < totalPixels; i++) {
        let conf = floatArr[i];
        if (invert) conf = 1.0 - conf;

        // Clean alpha ramp: Solid person (alpha 255), smooth edges, transparent background
        let alpha = 0;
        if (conf >= 0.45) {
          alpha = 255;
        } else if (conf > 0.12) {
          alpha = Math.round(((conf - 0.12) / 0.33) * 255);
        }

        const idx = i * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = alpha;
      }
    } else if (typeof maskObj.getAsUint8Array === 'function') {
      const uintArr = maskObj.getAsUint8Array();
      // Background category is present in the corner pixel
      const bgCat = uintArr[0];

      for (let i = 0; i < totalPixels; i++) {
        const isPerson = (uintArr[i] !== bgCat);
        const idx = i * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = isPerson ? 255 : 0;
      }
    }

    this.maskCtx.putImageData(this.maskImageData, 0, 0);

    const cutoutCtx = this.cutoutCtx;
    cutoutCtx.clearRect(0, 0, width, height);

    // 1. Draw scaled person mask (White on person, Transparent on background)
    cutoutCtx.imageSmoothingEnabled = true;
    cutoutCtx.drawImage(this.maskCanvas, 0, 0, width, height);

    // 2. Retain source pixels only where person mask exists
    cutoutCtx.globalCompositeOperation = "source-in";
    cutoutCtx.filter = enhanceQuality ? 'contrast(115%) saturate(130%) brightness(96%)' : 'none';
    cutoutCtx.drawImage(video, 0, 0, width, height);
    cutoutCtx.filter = 'none';
    cutoutCtx.globalCompositeOperation = "source-over"; // Reset blend mode
  }

  /**
   * Renders the foreground cutout (person) onto a live display canvas
   */
  renderCutout(video, targetCanvas, enhanceQuality = false) {
    if (!this.segmenter || !video || video.readyState < 2) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (width === 0 || height === 0) return;

    if (targetCanvas.width !== width || targetCanvas.height !== height) {
      targetCanvas.width = width;
      targetCanvas.height = height;
    }
    if (this.cutoutCanvas.width !== width || this.cutoutCanvas.height !== height) {
      this.cutoutCanvas.width = width;
      this.cutoutCanvas.height = height;
    }

    const targetCtx = targetCanvas.getContext('2d');

    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    try {
      this.segmenter.segmentForVideo(video, timestamp, (result) => {
        let mask = null;
        if (result.confidenceMasks && result.confidenceMasks.length > 0) {
          mask = result.confidenceMasks.length >= 2 ? result.confidenceMasks[1] : result.confidenceMasks[0];
        } else if (result.categoryMask) {
          mask = result.categoryMask;
        }

        if (!mask) return;

        this.applyMaskAndCutout(mask, video, width, height, enhanceQuality);

        // Composite person cutout over target canvas (Layer 3 over Layer 2 captions)
        targetCtx.clearRect(0, 0, width, height);
        targetCtx.drawImage(this.cutoutCanvas, 0, 0, width, height);

        // Free mask memory immediately
        if (result.confidenceMasks) {
          result.confidenceMasks.forEach(m => { try { m.close(); } catch (_) {} });
        }
        if (result.categoryMask) {
          try { result.categoryMask.close(); } catch (_) {}
        }
      });
    } catch (err) {
      console.error('Rotoscoping render error:', err);
    }
  }

  /**
   * Draws the foreground cutout directly onto an export canvas context
   */
  drawCutoutToContext(video, ctx, canvasWidth, canvasHeight, enhanceQuality = false) {
    if (!this.segmenter || !video || video.readyState < 2) return;

    const width = canvasWidth;
    const height = canvasHeight;

    if (this.cutoutCanvas.width !== width || this.cutoutCanvas.height !== height) {
      this.cutoutCanvas.width = width;
      this.cutoutCanvas.height = height;
    }

    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    try {
      this.segmenter.segmentForVideo(video, timestamp, (result) => {
        let mask = null;
        if (result.confidenceMasks && result.confidenceMasks.length > 0) {
          mask = result.confidenceMasks.length >= 2 ? result.confidenceMasks[1] : result.confidenceMasks[0];
        } else if (result.categoryMask) {
          mask = result.categoryMask;
        }

        if (!mask) return;

        this.applyMaskAndCutout(mask, video, width, height, enhanceQuality);

        ctx.drawImage(this.cutoutCanvas, 0, 0, width, height);

        if (result.confidenceMasks) {
          result.confidenceMasks.forEach(m => { try { m.close(); } catch (_) {} });
        }
        if (result.categoryMask) {
          try { result.categoryMask.close(); } catch (_) {}
        }
      });
    } catch (e) {
      console.error('drawCutoutToContext error:', e);
    }
  }
}

export const selfieSegmenterService = new SelfieSegmenterService();
