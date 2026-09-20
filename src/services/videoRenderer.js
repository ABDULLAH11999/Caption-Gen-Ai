// Lossless Native-Resolution Video Caption Burn-In & Export Engine
import { CAPTION_POSITIONS } from '../config.js';
import { fixVideoMetadata } from './videoDurationFixer.js';
import { autoTypographyEngine } from './autoTypographyEngine.js';

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

    const isEnhanced = config && (config.enhanceQuality || config.enhanceVideoQuality) || (video.classList && video.classList.contains('video-enhanced'));
    if (isEnhanced) {
      // Hardware-accelerated +30% Vibrance, +10% Contrast, -10% Shadows, +20% Sharpness
      ctx.filter = 'url(#video-enhance-filter) saturate(130%) contrast(110%) brightness(96%)';
    } else {
      ctx.filter = 'none';
    }

    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
    ctx.filter = 'none'; // Reset filter before drawing caption layers

    // 2. If no captions to draw, return
    if (!captionState || !captionState.visibleWords || captionState.visibleWords.length === 0) {
      return;
    }

    const isAuto = config.styleMode !== 'custom';
    if (isAuto) {
      // 1. Position from config.position in Auto Mode (default: middle-left)
      const positionId = config.position || 'middle-left';
      let posX = canvasWidth * 0.06;
      let posY = canvasHeight * 0.50;
      let textAlign = 'left';

      switch (positionId) {
        case 'top':
          posX = canvasWidth * 0.5;
          posY = canvasHeight * 0.14;
          textAlign = 'center';
          break;
        case 'bottom':
          posX = canvasWidth * 0.5;
          posY = canvasHeight * 0.82;
          textAlign = 'center';
          break;
        case 'middle':
          posX = canvasWidth * 0.5;
          posY = canvasHeight * 0.50;
          textAlign = 'center';
          break;
        case 'middle-left':
          posX = canvasWidth * 0.06;
          posY = canvasHeight * 0.50;
          textAlign = 'left';
          break;
        case 'middle-right':
          posX = canvasWidth * 0.94;
          posY = canvasHeight * 0.50;
          textAlign = 'right';
          break;
        case 'top-left':
          posX = canvasWidth * 0.06;
          posY = canvasHeight * 0.14;
          textAlign = 'left';
          break;
        case 'top-right':
          posX = canvasWidth * 0.94;
          posY = canvasHeight * 0.14;
          textAlign = 'right';
          break;
        case 'bottom-left':
          posX = canvasWidth * 0.06;
          posY = canvasHeight * 0.82;
          textAlign = 'left';
          break;
        case 'bottom-right':
          posX = canvasWidth * 0.94;
          posY = canvasHeight * 0.82;
          textAlign = 'right';
          break;
      }

      let isLightBackground = false;
      try {
        const sampleW = Math.min(160, Math.floor(canvasWidth * 0.4));
        const sampleH = Math.min(100, Math.floor(canvasHeight * 0.2));
        const sampleImg = ctx.getImageData(Math.floor(posX), Math.floor(posY - sampleH * 0.5), sampleW, sampleH);
        let lumSum = 0;
        const pCount = sampleImg.data.length / 4;
        for (let i = 0; i < sampleImg.data.length; i += 4) {
          lumSum += 0.299 * sampleImg.data[i] + 0.587 * sampleImg.data[i + 1] + 0.114 * sampleImg.data[i + 2];
        }
        isLightBackground = (lumSum / (pCount || 1)) > 130;
      } catch (e) {
        isLightBackground = false;
      }

      // 2. Analyze sentence for token-level word importance with dual typography
      const analysis = autoTypographyEngine.analyzeSentence(captionState, isLightBackground, config);

      const baseScale = Math.min(canvasWidth, canvasHeight);
      const userFontSize = config.fontSize !== undefined ? config.fontSize : 30;
      const baseFontSize = Math.max(16, Math.round(userFontSize * (baseScale / 720) * 1.15));
      const maxLineWidth = canvasWidth * 0.86;

      // 3. Layout words into lines
      const lines = [];
      let curLine = [];
      let curLineWidth = 0;

      analysis.words.forEach((w) => {
        const wordFontSize = Math.round(baseFontSize * (w.fontSizeMultiplier || 1.0));
        const pItalic = w.fontStyle === 'italic' ? 'italic' : 'normal';
        const pWeight = w.fontWeight || '800';
        const pFamily = w.fontFamily || "'Inter', -apple-system, sans-serif";

        ctx.font = `${pItalic} ${pWeight} ${wordFontSize}px ${pFamily}`;
        const wWidth = ctx.measureText(w.word).width;
        const spacing = wordFontSize * 0.24;
        const testWidth = curLineWidth + (curLine.length > 0 ? spacing : 0) + wWidth;

        if (testWidth > maxLineWidth && curLine.length > 0) {
          lines.push({ words: curLine, width: curLineWidth });
          curLine = [{ ...w, width: wWidth, spacing, font: `${pItalic} ${pWeight} ${wordFontSize}px ${pFamily}`, fontSize: wordFontSize }];
          curLineWidth = wWidth;
        } else {
          curLine.push({ ...w, width: wWidth, spacing, font: `${pItalic} ${pWeight} ${wordFontSize}px ${pFamily}`, fontSize: wordFontSize });
          curLineWidth = testWidth;
        }
      });
      if (curLine.length > 0) {
        lines.push({ words: curLine, width: curLineWidth });
      }

      const lineHeight = baseFontSize * 1.35;
      const totalBlockHeight = lines.length * lineHeight;
      const startBlockY = posY - totalBlockHeight * 0.5 + lineHeight * 0.4;
      const maxBlockWidth = Math.max(...lines.map(l => l.width), 100);

      // 4. If light background, draw dark glass backing pill
      if (isLightBackground) {
        ctx.save();
        ctx.fillStyle = 'rgba(4, 8, 16, 0.62)';
        ctx.beginPath();
        const padX = 20;
        const padY = 14;
        let pillX = posX - padX * 0.5;
        if (textAlign === 'center') {
          pillX = posX - maxBlockWidth * 0.5 - padX * 0.5;
        } else if (textAlign === 'right') {
          pillX = posX - maxBlockWidth - padX * 0.5;
        }
        const pillY = posY - totalBlockHeight * 0.5 - padY * 0.5;
        const pillW = maxBlockWidth + padX;
        const pillH = totalBlockHeight + padY;

        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillW, pillH, 12);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fill();
        ctx.restore();
      }

      // 5. Draw words
      lines.forEach((line, lineIdx) => {
        const lineY = startBlockY + lineIdx * lineHeight;
        let curX = posX;
        if (textAlign === 'center') {
          curX = posX - line.width / 2;
        } else if (textAlign === 'right') {
          curX = posX - line.width;
        }

        line.words.forEach((w) => {
          ctx.save();
          ctx.font = w.font;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          // Stroke & Outline
          const rawStrokeWidth = w.isProminent 
            ? (config?.prominentOutlineWidth !== undefined ? config.prominentOutlineWidth : 3.0)
            : (config?.normalOutlineWidth !== undefined ? config.normalOutlineWidth : (isLightBackground ? 2.5 : 1.2));
          ctx.lineWidth = Math.max(1.0, rawStrokeWidth * (baseScale / 720));
          ctx.strokeStyle = w.isProminent 
            ? (config?.prominentOutlineColor || '#000000')
            : (config?.normalOutlineColor || '#000000');
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;

          // Shadows & Neon Glows
          if (w.category === 'brand') {
            ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
            ctx.shadowBlur = Math.round(18 * (baseScale / 720));
          } else if (w.category === 'date') {
            ctx.shadowColor = 'rgba(255, 77, 166, 0.85)';
            ctx.shadowBlur = Math.round(20 * (baseScale / 720));
          } else if (w.category === 'impact') {
            ctx.shadowColor = 'rgba(255, 230, 0, 0.8)';
            ctx.shadowBlur = Math.round(16 * (baseScale / 720));
          } else {
            ctx.shadowColor = isLightBackground ? 'rgba(0,0,0,0.95)' : 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = Math.round(8 * (baseScale / 720));
          }
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.round(2 * (baseScale / 720));

          // Draw stroke then fill
          ctx.strokeText(w.word, curX, lineY);
          ctx.fillStyle = w.color || '#FFFFFF';
          ctx.fillText(w.word, curX, lineY);
          ctx.restore();

          curX += w.width + (w.spacing || 6);
        });
      });

      return;
    }

    // 3. Custom Mode: Compute caption position coordinates (from 9 position presets)
    const positionId = config.position || 'bottom';
    const posMeta = CAPTION_POSITIONS.find(p => p.id === positionId) || CAPTION_POSITIONS[1];

    let posX = canvasWidth * 0.5;
    let posY = canvasHeight * 0.82;
    let textAlign = 'center';

    switch (posMeta.id) {
      case 'top':
        posX = canvasWidth * 0.5;
        posY = canvasHeight * 0.14;
        textAlign = 'center';
        break;
      case 'bottom':
        posX = canvasWidth * 0.5;
        posY = canvasHeight * 0.82;
        textAlign = 'center';
        break;
      case 'middle':
        posX = canvasWidth * 0.5;
        posY = canvasHeight * 0.50;
        textAlign = 'center';
        break;
      case 'middle-left':
        posX = canvasWidth * 0.06;
        posY = canvasHeight * 0.50;
        textAlign = 'left';
        break;
      case 'middle-right':
        posX = canvasWidth * 0.94;
        posY = canvasHeight * 0.50;
        textAlign = 'right';
        break;
      case 'top-left':
        posX = canvasWidth * 0.06;
        posY = canvasHeight * 0.14;
        textAlign = 'left';
        break;
      case 'top-right':
        posX = canvasWidth * 0.94;
        posY = canvasHeight * 0.14;
        textAlign = 'right';
        break;
      case 'bottom-left':
        posX = canvasWidth * 0.06;
        posY = canvasHeight * 0.82;
        textAlign = 'left';
        break;
      case 'bottom-right':
        posX = canvasWidth * 0.94;
        posY = canvasHeight * 0.82;
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
    const startBlockY = posY - totalBlockHeight * 0.5 + lineHeight * 0.5;

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

      // Select best format supported by browser with WhatsApp & media player compatibility
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
        mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
      } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4;codecs=avc1';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      }

      // 5 Mbps video + 128 kbps audio: pristine 1080p/720p clarity, fast encoding, fits WhatsApp limits
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 128000
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
      const rawBlob = await exportPromise;

      // Restore video position
      videoElement.currentTime = originalTime;
      if (!originalPaused) videoElement.play();

      // Fix missing duration and container metadata for media players and WhatsApp sharing
      const finalDuration = duration > 0 ? duration : (videoElement.duration || 1);
      const fixedBlob = await fixVideoMetadata(rawBlob, finalDuration);

      return fixedBlob;
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
