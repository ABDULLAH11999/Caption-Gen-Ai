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
    this.maskPixelBuffer = null;
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
          outputConfidenceMasks: false,
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
            outputConfidenceMasks: false,
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
   * Generates the foreground person cutout on this.cutoutCanvas from the categoryMask
   */
  applyMaskAndCutout(mask, video, width, height) {
    const maskW = mask.width;
    const maskH = mask.height;

    if (this.maskCanvas.width !== maskW || this.maskCanvas.height !== maskH) {
      this.maskCanvas.width = maskW;
      this.maskCanvas.height = maskH;
      this.maskImageData = this.maskCtx.createImageData(maskW, maskH);
      this.maskPixelBuffer = new Uint32Array(this.maskImageData.data.buffer);
    }

    const maskArray = mask.getAsUint8Array();
    const pixels = this.maskPixelBuffer;
    const total = maskArray.length;
    for (let i = 0; i < total; i++) {
      // Category > 0 is foreground person (0xFFFFFFFF = full opacity white), category 0 is background
      pixels[i] = maskArray[i] > 0 ? 0xFFFFFFFF : 0x00000000;
    }
    this.maskCtx.putImageData(this.maskImageData, 0, 0);

    const cutoutCtx = this.cutoutCtx;
    cutoutCtx.clearRect(0, 0, width, height);

    // 1. Draw scaled binary mask
    cutoutCtx.imageSmoothingEnabled = true;
    cutoutCtx.drawImage(this.maskCanvas, 0, 0, width, height);

    // 2. Retain source pixels only where mask exists (foreground person)
    cutoutCtx.globalCompositeOperation = "source-in";
    cutoutCtx.drawImage(video, 0, 0, width, height);
    cutoutCtx.globalCompositeOperation = "source-over"; // Reset blend mode
  }

  /**
   * Renders the foreground cutout (person) onto a live display canvas
   */
  renderCutout(video, targetCanvas) {
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
        const mask = result.categoryMask;
        if (!mask) return;

        this.applyMaskAndCutout(mask, video, width, height);

        // 3. Composite cutout over target canvas
        targetCtx.clearRect(0, 0, width, height);
        targetCtx.drawImage(this.cutoutCanvas, 0, 0, width, height);

        mask.close(); // Prevent memory leak
      });
    } catch (err) {
      console.error('Rotoscoping render error:', err);
    }
  }

  /**
   * Draws the foreground cutout directly onto an export canvas context
   */
  drawCutoutToContext(video, ctx, canvasWidth, canvasHeight) {
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
        const mask = result.categoryMask;
        if (!mask) return;

        this.applyMaskAndCutout(mask, video, width, height);

        ctx.drawImage(this.cutoutCanvas, 0, 0, width, height);
        mask.close();
      });
    } catch (e) {
      console.error('drawCutoutToContext error:', e);
    }
  }
}

export const selfieSegmenterService = new SelfieSegmenterService();
