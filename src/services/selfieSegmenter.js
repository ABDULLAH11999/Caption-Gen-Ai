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
    this.segmentCanvas = document.createElement('canvas');
    this.segmentCtx = this.segmentCanvas.getContext('2d', { alpha: false });
    this.maskImageData = null;
    this.lastTimestamp = -1;
    this.isSegmenting = false;
    this.lastSegmentVideoTime = -Infinity;
    this.lastSegmentWallTime = 0;
    this.lastCutoutWidth = 0;
    this.lastCutoutHeight = 0;
    this.exportCutoutCache = [];
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

  resetCache() {
    this.isSegmenting = false;
    this.lastSegmentVideoTime = -Infinity;
    this.lastSegmentWallTime = 0;
    this.lastCutoutWidth = 0;
    this.lastCutoutHeight = 0;
    this.exportCutoutCache = [];
    if (this.cutoutCtx && this.cutoutCanvas.width && this.cutoutCanvas.height) {
      this.cutoutCtx.clearRect(0, 0, this.cutoutCanvas.width, this.cutoutCanvas.height);
    }
  }

  clearExportCutoutCache() {
    this.exportCutoutCache = [];
  }

  setExportCutoutCache(cache) {
    this.exportCutoutCache = Array.isArray(cache)
      ? cache.filter(item => item && Number.isFinite(item.time) && item.canvas)
          .sort((a, b) => a.time - b.time)
      : [];
  }

  drawExportCutoutForTime(ctx, time, width, height, maxDistance = 0.45) {
    if (!ctx || !this.exportCutoutCache || this.exportCutoutCache.length === 0) return false;

    const cache = this.exportCutoutCache;
    let lo = 0;
    let hi = cache.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cache[mid].time < time) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const after = cache[Math.min(lo, cache.length - 1)];
    const before = cache[Math.max(0, lo - 1)];
    const beforeDiff = before ? Math.abs(before.time - time) : Infinity;
    const afterDiff = after ? Math.abs(after.time - time) : Infinity;
    const best = beforeDiff <= afterDiff ? before : after;
    const bestDiff = Math.min(beforeDiff, afterDiff);

    if (!best || bestDiff > maxDistance) return false;
    ctx.drawImage(best.canvas, 0, 0, width, height);
    return true;
  }

  drawCachedCutout(ctx, width, height) {
    if (!ctx || !this.lastCutoutWidth || !this.lastCutoutHeight) return false;
    ctx.drawImage(this.cutoutCanvas, 0, 0, width, height);
    return true;
  }

  getSegmentationSource(video, width, height, maxSide = 384) {
    const longestSide = Math.max(width, height);
    if (!this.segmentCtx || longestSide <= maxSide) return video;

    const scale = maxSide / longestSide;
    const segW = Math.max(1, Math.round(width * scale));
    const segH = Math.max(1, Math.round(height * scale));

    if (this.segmentCanvas.width !== segW || this.segmentCanvas.height !== segH) {
      this.segmentCanvas.width = segW;
      this.segmentCanvas.height = segH;
    }

    this.segmentCtx.imageSmoothingEnabled = true;
    this.segmentCtx.imageSmoothingQuality = 'high';
    this.segmentCtx.drawImage(video, 0, 0, segW, segH);
    return this.segmentCanvas;
  }

  shouldSegment(video, fps = 12) {
    const videoTime = Number(video?.currentTime || 0);
    const now = performance.now();
    const minVideoDelta = 1 / Math.max(1, fps);
    const minWallDelta = 1000 / Math.max(1, fps);

    if (this.isSegmenting) return false;
    if (Math.abs(videoTime - this.lastSegmentVideoTime) < minVideoDelta && (now - this.lastSegmentWallTime) < minWallDelta) {
      return false;
    }

    this.lastSegmentVideoTime = videoTime;
    this.lastSegmentWallTime = now;
    return true;
  }

  /**
   * Generates the foreground person cutout on this.cutoutCanvas from maskObj
   * Person pixels are preserved with original video content; background pixels are made 100% transparent.
   * Tight confidence threshold eliminates edge contour ghosting and background bleed.
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
      const isPersonMask = maskObj.isPersonMask !== false;

      for (let i = 0; i < totalPixels; i++) {
        let conf = floatArr[i];
        if (!isPersonMask) conf = 1.0 - conf;

        // Natural, full-coverage boundary:
        // conf < 0.25 = 100% background
        // conf >= 0.52 = 100% solid subject (covers full hair, cap, arms, clothes)
        // Smoothstep between 0.25 and 0.52 for subpixel anti-aliased edge
        let alpha = 0;
        if (conf >= 0.52) {
          alpha = 255;
        } else if (conf > 0.25) {
          const t = (conf - 0.25) / 0.27;
          alpha = Math.round((3 * t * t - 2 * t * t * t) * 255);
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
    cutoutCtx.save();
    cutoutCtx.globalCompositeOperation = 'copy';
    cutoutCtx.clearRect(0, 0, width, height);
    cutoutCtx.restore();
    cutoutCtx.globalCompositeOperation = 'source-over';

    // Draw source frame first, then apply the mask as alpha. This keeps all
    // non-subject pixels genuinely transparent instead of black-filled.
    if (enhanceQuality) {
      cutoutCtx.filter = 'contrast(1.18) saturate(1.28) brightness(1.02)';
    } else {
      cutoutCtx.filter = 'none';
    }
    cutoutCtx.drawImage(video, 0, 0, width, height);
    cutoutCtx.filter = 'none';
    cutoutCtx.globalCompositeOperation = "destination-in";
    cutoutCtx.imageSmoothingEnabled = true;
    cutoutCtx.imageSmoothingQuality = 'high';
    cutoutCtx.drawImage(this.maskCanvas, 0, 0, width, height);
    cutoutCtx.globalCompositeOperation = "source-over"; // Reset blend mode
  }

  async captureCutoutFrame(video, width, height, enhanceQuality = false) {
    if (!this.segmenter || !video || video.readyState < 2) return null;

    if (this.cutoutCanvas.width !== width || this.cutoutCanvas.height !== height) {
      this.cutoutCanvas.width = width;
      this.cutoutCanvas.height = height;
    }

    const segmentSource = this.getSegmentationSource(video, width, height, Math.min(384, Math.max(width, height)));
    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (canvas) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.isSegmenting = false;
        resolve(canvas);
      };

      const timer = setTimeout(() => finish(null), 2500);

      try {
        this.isSegmenting = true;
        this.segmenter.segmentForVideo(segmentSource, timestamp, (result) => {
          try {
            let mask = null;
            if (result.confidenceMasks && result.confidenceMasks.length > 0) {
              mask = result.confidenceMasks.length >= 2 ? result.confidenceMasks[1] : result.confidenceMasks[0];
              if (mask && result.confidenceMasks.length >= 2) {
                mask.isPersonMask = true;
              }
            } else if (result.categoryMask) {
              mask = result.categoryMask;
            }

            if (!mask) {
              finish(null);
              return;
            }

            this.applyMaskAndCutout(mask, video, width, height, enhanceQuality);
            this.lastCutoutWidth = width;
            this.lastCutoutHeight = height;

            const snapshot = document.createElement('canvas');
            snapshot.width = width;
            snapshot.height = height;
            const snapshotCtx = snapshot.getContext('2d');
            snapshotCtx.drawImage(this.cutoutCanvas, 0, 0, width, height);
            finish(snapshot);
          } finally {
            if (result.confidenceMasks) {
              result.confidenceMasks.forEach(m => { try { m.close(); } catch (_) {} });
            }
            if (result.categoryMask) {
              try { result.categoryMask.close(); } catch (_) {}
            }
          }
        });
      } catch (err) {
        console.error('captureCutoutFrame error:', err);
        finish(null);
      }
    });
  }

  /**
   * Pre-bakes cutout frames for segments marked with behind = true
   * Produces buttery smooth 60 FPS preview and eliminates runtime video playback stutter.
   */
  async prebakeCutoutsForSegments(videoElement, sentences, onProgress = () => {}, enhanceQuality = false) {
    const behindSegments = (sentences || [])
      .filter(s => s.behind)
      .map(s => ({
        start: Math.max(0, Number(s.start ?? s.startTime ?? 0)),
        end: Math.max(0, Number(s.end ?? s.endTime ?? 0))
      }))
      .filter(seg => Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.end > seg.start);

    if (behindSegments.length === 0 || !this.isReady() || !videoElement) return [];

    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // Smooth behind-caption playback cache. Dense enough for 60 FPS interpolation without mobile memory blowups.
    const sampleStep = isMobile ? 0.033 : 0.02;
    const samples = [];
    const seen = new Set();

    behindSegments.forEach((seg) => {
      const padStart = Math.max(0, seg.start - 0.05);
      const padEnd = seg.end + 0.10;
      for (let t = padStart; t <= padEnd + 0.001; t += sampleStep) {
        const sample = Math.round(t * 1000) / 1000;
        if (!seen.has(sample)) {
          seen.add(sample);
          samples.push(sample);
        }
      }
      const endSample = Math.round(padEnd * 1000) / 1000;
      if (!seen.has(endSample)) {
        seen.add(endSample);
        samples.push(endSample);
      }
    });

    samples.sort((a, b) => a - b);
    const width = videoElement.videoWidth || 1280;
    const height = videoElement.videoHeight || 720;
    const cache = [];

    const seekTo = (v, t) => new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        v.removeEventListener('seeked', onSeeked);
        if (timer) clearTimeout(timer);
        resolve();
      };
      const onSeeked = () => {
        requestAnimationFrame(() => setTimeout(finish, 15));
      };
      v.addEventListener('seeked', onSeeked, { once: true });
      try {
        v.currentTime = t;
      } catch (_) {
        finish();
        return;
      }
      timer = setTimeout(finish, 350);
    });

    for (let i = 0; i < samples.length; i++) {
      const t = samples[i];
      try {
        await seekTo(videoElement, t);
        const canvas = await this.captureCutoutFrame(videoElement, width, height, enhanceQuality);
        if (canvas) {
          cache.push({ time: t, canvas });
        }
      } catch (err) {
        console.warn('Pre-bake frame skip:', err.message);
      }

      if (typeof onProgress === 'function') {
        const pct = Math.round(((i + 1) / samples.length) * 100);
        onProgress(pct, `Pre-baking cutout layer (${i + 1}/${samples.length})...`);
      }
    }

    this.setExportCutoutCache(cache);
    return cache;
  }

  /**
   * Renders the foreground cutout (person) onto a live display canvas
   * Uses cached pre-baked frames whenever possible for zero-latency 60 FPS playback.
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

    const targetCtx = targetCanvas.getContext('2d');
    const currentTime = Number(video.currentTime || 0);

    targetCtx.save();
    targetCtx.globalCompositeOperation = 'copy';
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.restore();
    targetCtx.globalCompositeOperation = 'source-over';

    // Fast Path: Try pre-baked cutout cache (0ms GPU draw, zero neural inference overhead)
    if (this.drawExportCutoutForTime(targetCtx, currentTime, width, height, 0.18)) {
      return;
    }

    // Secondary Path: Cached still frame
    if (this.drawCachedCutout(targetCtx, width, height)) {
      if (!this.shouldSegment(video, 4)) return;
    } else {
      if (!this.shouldSegment(video, 6)) return;
    }

    if (this.cutoutCanvas.width !== width || this.cutoutCanvas.height !== height) {
      this.cutoutCanvas.width = width;
      this.cutoutCanvas.height = height;
    }

    const previewMaskSize = (video.paused || video.seeking) ? 384 : 256;
    const segmentSource = this.getSegmentationSource(video, width, height, previewMaskSize);

    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    try {
      this.isSegmenting = true;
      this.segmenter.segmentForVideo(segmentSource, timestamp, (result) => {
        try {
          let mask = null;
          if (result.confidenceMasks && result.confidenceMasks.length > 0) {
            mask = result.confidenceMasks.length >= 2 ? result.confidenceMasks[1] : result.confidenceMasks[0];
            if (mask && result.confidenceMasks.length >= 2) {
              mask.isPersonMask = true;
            }
          } else if (result.categoryMask) {
            mask = result.categoryMask;
          }

          if (!mask) return;

          this.applyMaskAndCutout(mask, video, width, height, enhanceQuality);
          this.lastCutoutWidth = width;
          this.lastCutoutHeight = height;

          // Composite person cutout over target canvas (Layer 3 over Layer 2 captions)
          targetCtx.save();
          targetCtx.globalCompositeOperation = 'copy';
          targetCtx.clearRect(0, 0, width, height);
          targetCtx.restore();
          targetCtx.globalCompositeOperation = 'source-over';
          targetCtx.drawImage(this.cutoutCanvas, 0, 0, width, height);
        } finally {
          this.isSegmenting = false;
          if (result.confidenceMasks) {
            result.confidenceMasks.forEach(m => { try { m.close(); } catch (_) {} });
          }
          if (result.categoryMask) {
            try { result.categoryMask.close(); } catch (_) {}
          }
        }
      });
    } catch (err) {
      this.isSegmenting = false;
      console.error('Rotoscoping render error:', err);
    }
  }

  /**
   * Draws the foreground cutout directly onto an export canvas context
   */
  drawCutoutToContext(video, ctx, canvasWidth, canvasHeight, enhanceQuality = false, options = {}) {
    if (!this.segmenter || !video || video.readyState < 2) return;

    const width = canvasWidth;
    const height = canvasHeight;
    const time = Number(options.time ?? video.currentTime ?? 0);

    if (this.drawExportCutoutForTime(ctx, time, width, height, options.useExportCache ? 0.035 : 0.18)) {
      return;
    }

    if (options.useExportCache) {
      return;
    }

    if (this.cutoutCanvas.width !== width || this.cutoutCanvas.height !== height) {
      this.cutoutCanvas.width = width;
      this.cutoutCanvas.height = height;
    }

    if (!options.disableStaleCutout && this.lastCutoutWidth && this.lastCutoutHeight) {
      ctx.drawImage(this.cutoutCanvas, 0, 0, width, height);
    }
    if (!this.shouldSegment(video, 8)) return;
    const segmentSource = this.getSegmentationSource(video, width, height, 384);

    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    try {
      this.isSegmenting = true;
      this.segmenter.segmentForVideo(segmentSource, timestamp, (result) => {
        try {
          let mask = null;
          if (result.confidenceMasks && result.confidenceMasks.length > 0) {
            mask = result.confidenceMasks.length >= 2 ? result.confidenceMasks[1] : result.confidenceMasks[0];
            if (mask && result.confidenceMasks.length >= 2) {
              mask.isPersonMask = true;
            }
          } else if (result.categoryMask) {
            mask = result.categoryMask;
          }

          if (!mask) return;

          this.applyMaskAndCutout(mask, video, width, height, enhanceQuality);
          this.lastCutoutWidth = width;
          this.lastCutoutHeight = height;

          ctx.drawImage(this.cutoutCanvas, 0, 0, width, height);
        } finally {
          this.isSegmenting = false;
          if (result.confidenceMasks) {
            result.confidenceMasks.forEach(m => { try { m.close(); } catch (_) {} });
          }
          if (result.categoryMask) {
            try { result.categoryMask.close(); } catch (_) {}
          }
        }
      });
    } catch (e) {
      this.isSegmenting = false;
      console.error('drawCutoutToContext error:', e);
    }
  }
}

export const selfieSegmenterService = new SelfieSegmenterService();
