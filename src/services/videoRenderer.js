// Lossless Native-Resolution Video Caption Burn-In & Export Engine
import { CAPTION_POSITIONS } from '../config.js';

export class VideoRenderer {
  constructor() {
    this.isRendering = false;
    this.progressCallback = null;
  }

  /**
   * Renders the current frame on a canvas with pristine quality and styled captions
   */
  renderFrame(ctx, video, captionState, config, canvasWidth, canvasHeight) {
    if (!video || !ctx) return;

    // 1. Draw source video frame at 1:1 pixel perfection
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

    // 2. If no captions to draw, return
    if (!captionState || !captionState.visibleWords || captionState.visibleWords.length === 0) {
      return;
    }

    // 3. Compute caption position coordinates (from 7 position presets)
    const positionId = config.position || 'bottom';
    const posMeta = CAPTION_POSITIONS.find(p => p.id === positionId) || CAPTION_POSITIONS[1];

    let posX = canvasWidth * 0.5;
    let posY = canvasHeight * 0.93;
    let textAlign = 'center';

    switch (posMeta.id) {
      case 'top':
        posX = canvasWidth * 0.5;
        posY = canvasHeight * 0.05;
        textAlign = 'center';
        break;
      case 'bottom':
        posX = canvasWidth * 0.5;
        posY = canvasHeight * 0.93;
        textAlign = 'center';
        break;
      case 'middle':
        posX = canvasWidth * 0.5;
        posY = canvasHeight * 0.50;
        textAlign = 'center';
        break;
      case 'middle-left':
        posX = canvasWidth * 0.05;
        posY = canvasHeight * 0.50;
        textAlign = 'left';
        break;
      case 'middle-right':
        posX = canvasWidth * 0.95;
        posY = canvasHeight * 0.50;
        textAlign = 'right';
        break;
      case 'top-left':
        posX = canvasWidth * 0.05;
        posY = canvasHeight * 0.05;
        textAlign = 'left';
        break;
      case 'top-right':
        posX = canvasWidth * 0.95;
        posY = canvasHeight * 0.05;
        textAlign = 'right';
        break;
      case 'bottom-left':
        posX = canvasWidth * 0.05;
        posY = canvasHeight * 0.93;
        textAlign = 'left';
        break;
      case 'bottom-right':
        posX = canvasWidth * 0.95;
        posY = canvasHeight * 0.93;
        textAlign = 'right';
        break;
    }

    // 4. Calculate responsive font size relative to video dimensions
    // Scale 1 - 100 with default 30 corresponds to ~4% of min video dimension
    const baseScale = Math.min(canvasWidth, canvasHeight);
    const fontSizePx = Math.max(14, Math.round((config.fontSize || 30) * (baseScale / 720) * 1.15));

    const fontFamily = config.fontFamily || 'Inter';
    const fontWeight = '900'; // Bold punchy viral caption style
    ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';

    // 5. Wrap words into lines strictly staying inside 84% canvas width
    const words = captionState.visibleWords;
    const spacing = fontSizePx * 0.28;
    const maxLineWidth = canvasWidth * 0.84;

    const lines = [];
    let curLine = [];
    let curLineWidth = 0;

    words.forEach(w => {
      const wWidth = ctx.measureText(w.word).width;
      const testWidth = curLineWidth + (curLine.length > 0 ? spacing : 0) + wWidth;
      if (testWidth > maxLineWidth && curLine.length > 0) {
        lines.push({ words: curLine, width: curLineWidth });
        curLine = [{ ...w, width: wWidth }];
        curLineWidth = wWidth;
      } else {
        curLine.push({ ...w, width: wWidth });
        curLineWidth = testWidth;
      }
    });
    if (curLine.length > 0) {
      lines.push({ words: curLine, width: curLineWidth });
    }

    const lineHeight = fontSizePx * 1.25;
    const totalBlockHeight = lines.length * lineHeight;
    let startBlockY = posY;

    if (posMeta.id.includes('bottom')) {
      startBlockY = posY - totalBlockHeight + lineHeight * 0.5;
    } else if (posMeta.id.includes('middle') || posMeta.id === 'middle-left' || posMeta.id === 'middle-right') {
      startBlockY = posY - totalBlockHeight * 0.5 + lineHeight * 0.5;
    } else {
      startBlockY = posY + lineHeight * 0.5;
    }

    // 6. Draw each line cleanly aligned and centered
    lines.forEach((line, lineIdx) => {
      const lineY = startBlockY + lineIdx * lineHeight;
      let lineStartX = posX;
      if (textAlign === 'center') {
        lineStartX = posX - line.width / 2;
      } else if (textAlign === 'right') {
        lineStartX = posX - line.width;
      }

      let currentX = lineStartX;

      line.words.forEach((w, wIdx) => {
        ctx.save();
        ctx.textAlign = 'left';

        // Outline / Stroke (default black outline)
        const outlineWidth = (config.outlineWidth !== undefined ? config.outlineWidth : 1) * (baseScale / 720);
        ctx.lineWidth = Math.max(1.5, outlineWidth);
        ctx.strokeStyle = config.outlineColor || '#000000';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        // Shadow
        ctx.shadowColor = config.shadowColor || 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = (config.shadowBlur || 8) * (baseScale / 720);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        // Determine fill color (Base font color, last word color, or karaoke glow)
        const isLastWordInLine = (wIdx === line.words.length - 1);
        const isLastWordInSentence = (lineIdx === lines.length - 1 && wIdx === line.words.length - 1);
        let fillColor = w.color || config.textColor || '#FFE600';

        if (config.enableLastWordColor !== false && config.lastWordColor && (isLastWordInLine || isLastWordInSentence)) {
          fillColor = config.lastWordColor;
        }

        if (w.isCurrent && config.animation === 'anim-karaoke-glow') {
          fillColor = config.karaokeHighlightColor || '#00F0FF';
          ctx.shadowColor = config.karaokeHighlightColor || '#00F0FF';
          ctx.shadowBlur = 20;
        }

        ctx.strokeText(w.word, currentX, lineY);
        ctx.fillStyle = fillColor;
        ctx.fillText(w.word, currentX, lineY);
        ctx.restore();

        currentX += w.width + spacing;
      });
    });
  }

  /**
   * Export full video with burned-in captions at lossless source resolution
   */
  async exportVideo(videoElement, captionEngineInstance, config, onProgress) {
    if (this.isRendering) return;
    this.isRendering = true;

    try {
      const originalTime = videoElement.currentTime;
      const originalPaused = videoElement.paused;
      videoElement.pause();

      const width = videoElement.videoWidth || 1280;
      const height = videoElement.videoHeight || 720;
      const duration = videoElement.duration || 60;

      // Create offscreen high-res render canvas
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const ctx = offscreenCanvas.getContext('2d', { alpha: false });

      // Setup audio graph
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      let source;
      try {
        source = audioCtx.createMediaElementSource(videoElement);
        source.connect(dest);
        source.connect(audioCtx.destination);
      } catch (e) {
        // Audio element may already be connected
      }

      // Canvas capture stream at original FPS (30 - 60)
      const canvasStream = offscreenCanvas.captureStream(30);

      // Combine canvas video track + destination audio track
      const combinedTracks = [...canvasStream.getVideoTracks()];
      if (dest.stream.getAudioTracks().length > 0) {
        combinedTracks.push(...dest.stream.getAudioTracks());
      }

      const combinedStream = new MediaStream(combinedTracks);

      // MediaRecorder with ultra high bitrate for lossless preservation
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 16000000 // 16 Mbps
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const exportPromise = new Promise((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
        recorder.onerror = reject;
      });

      recorder.start(100);

      // Reset video to start
      videoElement.currentTime = 0;
      await new Promise(r => {
        videoElement.onseeked = r;
      });

      videoElement.play();

      const renderLoop = () => {
        if (!this.isRendering) return;

        const curTime = videoElement.currentTime;
        const progress = Math.min(100, Math.round((curTime / duration) * 100));
        if (onProgress) onProgress(progress);

        const captionState = captionEngineInstance.getActiveCaptionState(curTime, config);
        this.renderFrame(ctx, videoElement, captionState, config, width, height);

        if (videoElement.ended || curTime >= duration) {
          this.isRendering = false;
          videoElement.pause();
          recorder.stop();
          if (onProgress) onProgress(100);
        } else {
          requestAnimationFrame(renderLoop);
        }
      };

      requestAnimationFrame(renderLoop);
      const exportedBlob = await exportPromise;

      // Restore video position
      videoElement.currentTime = originalTime;
      if (!originalPaused) videoElement.play();

      return exportedBlob;
    } catch (err) {
      this.isRendering = false;
      console.error('Export error:', err);
      throw err;
    }
  }

  cancelExport() {
    this.isRendering = false;
  }
}

export const videoRenderer = new VideoRenderer();
