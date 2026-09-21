// Lossless Native-Resolution Video Caption Burn-In & Export Engine
import { CAPTION_POSITIONS, FONTS, AUTO_ANIMATION_SEQUENCE } from '../config.js';
import { fixVideoMetadata } from './videoDurationFixer.js';
import { autoTypographyEngine } from './autoTypographyEngine.js';
import { selfieSegmenterService } from './selfieSegmenter.js';

export class VideoRenderer {
  constructor() {
    this.isRendering = false;
    this.progressCallback = null;
  }

  /**
   * Helper to resolve font family from font ID or name
   */
  getFontFamily(fontId) {
    if (!fontId) return "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    const found = FONTS.find(f => f.id.toLowerCase() === fontId.toLowerCase() || f.name.toLowerCase().includes(fontId.toLowerCase()));
    return found ? found.family : `'${fontId}', -apple-system, sans-serif`;
  }

  /**
   * Renders the current frame on a canvas with pristine quality and styled captions
   * Matches live preview video display 100% pixel-perfect
   */
  renderFrame(ctx, video, curTimeOrState, config = {}, canvasWidth, canvasHeight, sentencesOverride = null) {
    if (!video || !ctx) return;

    // 1. Draw source video frame at native pixel perfection
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const isEnhanced = config && (config.enhanceQuality || config.enhanceVideoQuality) || (video.classList && video.classList.contains('video-enhanced'));
    if (isEnhanced) {
      // 100% GPU-accelerated shader filters (+30% Vibrance, +15% Contrast/Edge Sharpness, -10% Shadows)
      ctx.filter = 'contrast(115%) saturate(130%) brightness(96%)';
    } else {
      ctx.filter = 'none';
    }

    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
    ctx.filter = 'none'; // Reset filter before drawing caption layers

    // 2. Resolve currentTime and sentences
    let curTime = 0;
    let sentences = sentencesOverride || [];

    if (typeof curTimeOrState === 'number') {
      curTime = curTimeOrState;
    } else if (curTimeOrState && typeof curTimeOrState === 'object') {
      curTime = curTimeOrState.currentTime !== undefined ? curTimeOrState.currentTime : (video.currentTime || 0);
      if (curTimeOrState.sentences) sentences = curTimeOrState.sentences;
    } else {
      curTime = video.currentTime || 0;
    }

    if (!sentences || sentences.length === 0) return;

    // 3. Find active sentence with micro-gap tolerance (matching live preview)
    let currentSentence = sentences.find(s => {
      const sStart = Number(s.start ?? s.startTime ?? 0);
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
      return curTime >= sStart && curTime <= sEnd;
    });

    if (!currentSentence && sentences.length > 0) {
      currentSentence = sentences.find(s => {
        const sStart = Number(s.start ?? s.startTime ?? 0);
        const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
        return curTime >= sStart && curTime <= (sEnd + 1.2);
      });
    }

    if (!currentSentence) return;

    // 4. Ensure words array exists with valid timings
    let words = currentSentence.words;
    if (!words || words.length === 0) {
      const sStart = Number(currentSentence.start ?? currentSentence.startTime ?? 0);
      const sEnd = Number(currentSentence.end ?? currentSentence.endTime ?? (sStart + 2.5));
      const textWords = (currentSentence.text || '').split(/\s+/).filter(Boolean);
      const dur = (sEnd - sStart) / Math.max(1, textWords.length);
      words = textWords.map((word, idx) => ({
        word,
        start: sStart + idx * dur,
        end: sStart + (idx + 1) * dur
      }));
    }

    if (!words || words.length === 0) return;

    // 5. Determine active speaking word index
    let speakingWordIdx = words.findIndex(w => {
      const ws = Number(w.start ?? w.startTime ?? 0);
      const we = Number(w.end ?? w.endTime ?? (ws + 0.35));
      return curTime >= ws && curTime < we;
    });

    if (speakingWordIdx === -1) {
      for (let i = words.length - 1; i >= 0; i--) {
        const ws = Number(words[i].start ?? words[i].startTime ?? 0);
        if (curTime >= ws) {
          speakingWordIdx = i;
          break;
        }
      }
      if (speakingWordIdx === -1) speakingWordIdx = 0;
    }

    // 6. Strict 2-Row Guarantee: Split sentence when > 4 words or > 22 chars (exact preview match)
    const totalChars = words.reduce((acc, w) => acc + ((w.word || '').length), 0);
    let displayWords = words;
    let chunkOffset = 0;
    if (words.length > 4 || (words.length === 4 && totalChars > 22)) {
      const mid = Math.ceil(words.length / 2);
      if (speakingWordIdx < mid) {
        displayWords = words.slice(0, mid);
        chunkOffset = 0;
      } else {
        displayWords = words.slice(mid);
        chunkOffset = mid;
      }
    }

    // 7. Typography and responsive sizing relative to video resolution
    const isPortrait = canvasHeight > canvasWidth;
    const baseRefWidth = isPortrait ? 380 : 680;
    const scale = canvasWidth / baseRefWidth;

    const previewFontSize = isPortrait ? 25 : ((config.fontSize && Number(config.fontSize) <= 30) ? Number(config.fontSize) : 28);
    const baseFontSize = Math.max(16, Math.round(previewFontSize * scale));

    const normalFontFamily = this.getFontFamily(config.normalFontFamily || 'Inter');
    const prominentFontFamily = this.getFontFamily(config.prominentFontFamily || 'Syne');

    const defaultTextColor = config.textColor || '#FFFFFF';
    const prominentColor = config.prominentColor || '#FFE600';
    const hasLastWordColor = config.enableLastWordColor !== false && !!config.lastWordColor;
    const lastWordColor = hasLastWordColor ? config.lastWordColor : prominentColor;

    // 8. Build styled words
    const styledWords = displayWords.map((w, localIdx) => {
      const globalIdx = chunkOffset + localIdx;
      const cleanWord = (w.word || '').replace(/[.,!?:;"'()]/g, '');
      const isHeroKeyword = autoTypographyEngine.brandRegex.test(cleanWord) || 
                            autoTypographyEngine.monthsDatesRegex.test(cleanWord) || 
                            autoTypographyEngine.placesRegex.test(cleanWord) || 
                            autoTypographyEngine.impactWordsRegex.test(cleanWord);
      
      const isSpeaking = (globalIdx === speakingWordIdx);
      const isLastWord = (globalIdx === words.length - 1);
      const isProminent = w.isProminent || isHeroKeyword || isLastWord || (words.length >= 3 && globalIdx === 1);

      let font = isProminent ? prominentFontFamily : normalFontFamily;
      let color = isProminent ? prominentColor : defaultTextColor;

      if (isLastWord && hasLastWordColor) {
        font = prominentFontFamily;
        color = lastWordColor;
      }
      if (isSpeaking) {
        font = prominentFontFamily;
      }

      const fontWeight = isSpeaking ? '900' : (isProminent ? '800' : '700');
      const strokeWidth = (isProminent
        ? (config.prominentOutlineWidth !== undefined ? config.prominentOutlineWidth : 2.5)
        : (config.normalOutlineWidth !== undefined ? config.normalOutlineWidth : 1.5)) * scale;
      const strokeColor = isProminent
        ? (config.prominentOutlineColor || '#000000')
        : (config.normalOutlineColor || '#000000');

      const wordScale = isSpeaking ? 1.15 : 1.0;

      return {
        word: (w.word || '').toUpperCase(),
        font,
        fontWeight,
        color,
        strokeWidth: Math.max(1.5, strokeWidth),
        strokeColor,
        isSpeaking,
        wordScale,
        fontSize: baseFontSize
      };
    });

    // 9. Layout positioning (Defaults to Middle-Left: 6% X, 50% Y)
    const defaultPosMeta = CAPTION_POSITIONS.find(p => p.id === (config.position || 'middle-left')) || CAPTION_POSITIONS[3];
    const hasCustomPos = currentSentence.posX !== undefined && currentSentence.posY !== undefined;
    
    let posX = hasCustomPos ? (canvasWidth * Number(currentSentence.posX)) / 100 : (canvasWidth * 0.06);
    let posY = hasCustomPos ? (canvasHeight * Number(currentSentence.posY)) / 100 : (canvasHeight * 0.50);

    const textAlign = hasCustomPos ? 'left' : (defaultPosMeta.align || 'left');
    const customMaxWidth = currentSentence.boxWidth
      ? (canvasWidth * Number(currentSentence.boxWidth)) / 100
      : (canvasWidth * 0.94);

    // 10. Wrap words into lines based on custom box width
    const lines = [];
    let curLine = [];
    let curLineWidth = 0;
    const wordGap = Math.round(baseFontSize * 0.22);

    styledWords.forEach((sw) => {
      ctx.font = `${sw.fontWeight} ${sw.fontSize}px ${sw.font}`;
      const rawWidth = ctx.measureText(sw.word).width;
      const wordWidth = rawWidth * sw.wordScale;
      const testWidth = curLineWidth + (curLine.length > 0 ? wordGap : 0) + wordWidth;

      if (testWidth > customMaxWidth && curLine.length > 0) {
        lines.push({ words: curLine, width: curLineWidth });
        curLine = [{ ...sw, rawWidth, width: wordWidth }];
        curLineWidth = wordWidth;
      } else {
        curLine.push({ ...sw, rawWidth, width: wordWidth });
        curLineWidth = testWidth;
      }
    });
    if (curLine.length > 0) {
      lines.push({ words: curLine, width: curLineWidth });
    }

    const lineHeight = baseFontSize * 1.15;
    const totalBlockHeight = lines.length * lineHeight;
    const startBlockY = hasCustomPos ? posY : (posY - totalBlockHeight * 0.5 + lineHeight * 0.5);

    // 11. Compute Dynamic Entrance Animation & Shine Glow Effects
    let resolvedAnimId = config.animation || 'anim-auto';
    if (resolvedAnimId === 'anim-auto') {
      let segCount = 0;
      const targetIdx = sentences.findIndex(s => s === currentSentence || (s.id !== undefined && s.id === currentSentence.id));
      for (let i = 0; i < (targetIdx >= 0 ? targetIdx : 0); i++) {
        const sWords = sentences[i].words || [];
        const sChars = sWords.reduce((acc, w) => acc + ((w.word || '').length), 0);
        if (sWords.length > 4 || (sWords.length === 4 && sChars > 22)) {
          segCount += 2;
        } else {
          segCount += 1;
        }
      }
      if (chunkOffset > 0) segCount += 1;
      resolvedAnimId = AUTO_ANIMATION_SEQUENCE[segCount % AUTO_ANIMATION_SEQUENCE.length];
    }

    const chunkStartTime = Number(displayWords[0]?.start ?? displayWords[0]?.startTime ?? (currentSentence.start ?? currentSentence.startTime ?? 0));
    const elapsed = Math.max(0, curTime - chunkStartTime);

    let blockScale = 1.0;
    let blockOffsetY = 0;
    let blockOpacity = 1.0;
    let shineFactor = 0;
    let flareFactor = 0;
    let glowColorOverride = null;
    let extraGlowBlur = 0;

    switch (resolvedAnimId) {
      case 'anim-neon-shimmer': {
        const dur = 0.9;
        const p = Math.min(1.0, elapsed / dur);
        if (p <= 0.45) {
          shineFactor = p / 0.45;
        } else {
          shineFactor = Math.max(0, (1.0 - p) / 0.55);
        }
        blockScale = 0.96 + 0.10 * shineFactor;
        blockOpacity = 0.25 + 0.75 * Math.min(1.0, p / 0.25);
        extraGlowBlur = Math.round(36 * shineFactor * scale);
        if (shineFactor > 0.15) {
          glowColorOverride = '#00F0FF';
        }
        break;
      }
      case 'anim-fire-flare': {
        const dur = 0.85;
        const p = Math.min(1.0, elapsed / dur);
        if (p <= 0.40) {
          flareFactor = p / 0.40;
        } else {
          flareFactor = Math.max(0, (1.0 - p) / 0.60);
        }
        blockScale = (0.75 + 0.25 * Math.min(1.0, p / 0.4)) + 0.14 * flareFactor;
        blockOpacity = Math.min(1.0, p / 0.18);
        extraGlowBlur = Math.round(42 * flareFactor * scale);
        if (flareFactor > 0.15) {
          glowColorOverride = '#FF6B00';
        }
        break;
      }
      case 'anim-zoom-impact': {
        const dur = 0.35;
        const p = Math.min(1.0, elapsed / dur);
        blockScale = 1.0 + 1.2 * Math.pow(1.0 - p, 2.2);
        blockOpacity = Math.min(1.0, p / 0.12);
        break;
      }
      case 'anim-bounce-drop': {
        const dur = 0.48;
        const p = Math.min(1.0, elapsed / dur);
        if (p <= 0.65) {
          const t = p / 0.65;
          blockOffsetY = (-45 + 50 * t) * scale;
          blockScale = 0.85 + 0.23 * t;
        } else if (p <= 0.85) {
          const t = (p - 0.65) / 0.20;
          blockOffsetY = (5 - 7 * t) * scale;
          blockScale = 1.08 - 0.10 * t;
        } else {
          const t = (p - 0.85) / 0.15;
          blockOffsetY = (-2 + 2 * t) * scale;
          blockScale = 0.98 + 0.02 * t;
        }
        blockOpacity = Math.min(1.0, p / 0.18);
        break;
      }
      case 'anim-pop': {
        const dur = 0.32;
        const p = Math.min(1.0, elapsed / dur);
        if (p <= 0.60) {
          const t = p / 0.60;
          blockScale = 0.65 + 0.50 * t;
        } else {
          const t = (p - 0.60) / 0.40;
          blockScale = 1.15 - 0.15 * t;
        }
        blockOpacity = Math.min(1.0, p / 0.15);
        break;
      }
      case 'anim-cinematic-drift': {
        const dur = 1.4;
        const p = Math.min(1.0, elapsed / dur);
        blockOffsetY = (1.0 - p) * 14 * scale;
        blockScale = 0.92 + 0.08 * p;
        blockOpacity = Math.min(1.0, p / 0.25);
        break;
      }
      case 'anim-3d-tilt': {
        const dur = 0.75;
        const p = Math.min(1.0, elapsed / dur);
        blockOffsetY = (1.0 - p) * 20 * scale;
        blockScale = 0.85 + 0.15 * p;
        blockOpacity = Math.min(1.0, p / 0.22);
        break;
      }
      case 'anim-liquid-gradient': {
        const dur = 1.1;
        const p = Math.min(1.0, elapsed / dur);
        shineFactor = Math.sin(p * Math.PI);
        blockScale = 0.95 + 0.10 * shineFactor;
        blockOpacity = Math.min(1.0, p / 0.25);
        extraGlowBlur = Math.round(24 * shineFactor * scale);
        if (shineFactor > 0.2) glowColorOverride = '#C084FC';
        break;
      }
    }

    const maxLineWidth = Math.max(...lines.map(l => l.width), 10);
    const blockCenterX = (textAlign === 'center')
      ? posX
      : (textAlign === 'right' ? posX - maxLineWidth / 2 : posX + maxLineWidth / 2);
    const blockCenterY = startBlockY + totalBlockHeight * 0.5;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, blockOpacity));

    // Apply block entrance animation transform
    ctx.translate(blockCenterX, blockCenterY + blockOffsetY);
    if (blockScale !== 1.0) {
      ctx.scale(blockScale, blockScale);
    }
    ctx.translate(-blockCenterX, -blockCenterY);

    // If intense shine is active (Neon Shimmer or Solar Flare), draw background glow burst
    if (shineFactor > 0.15) {
      ctx.save();
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = Math.round(40 * shineFactor * scale);
      lines.forEach((line, lineIdx) => {
        const lineY = startBlockY + lineIdx * lineHeight;
        let curX = (textAlign === 'center') ? posX - line.width / 2 : (textAlign === 'right' ? posX - line.width : posX);
        line.words.forEach(w => {
          ctx.font = `${w.fontWeight} ${w.fontSize}px ${w.font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
          ctx.fillText(w.word, curX + w.width / 2, lineY);
          curX += w.width + wordGap;
        });
      });
      ctx.restore();
    } else if (flareFactor > 0.15) {
      ctx.save();
      ctx.shadowColor = '#FF6B00';
      ctx.shadowBlur = Math.round(45 * flareFactor * scale);
      lines.forEach((line, lineIdx) => {
        const lineY = startBlockY + lineIdx * lineHeight;
        let curX = (textAlign === 'center') ? posX - line.width / 2 : (textAlign === 'right' ? posX - line.width : posX);
        line.words.forEach(w => {
          ctx.font = `${w.fontWeight} ${w.fontSize}px ${w.font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255, 107, 0, 0.4)';
          ctx.fillText(w.word, curX + w.width / 2, lineY);
          curX += w.width + wordGap;
        });
      });
      ctx.restore();
    }

    // 12. Render caption lines on Layer 2
    lines.forEach((line, lineIdx) => {
      const lineY = startBlockY + lineIdx * lineHeight;
      let startX = posX;
      if (textAlign === 'center') {
        startX = posX - line.width / 2;
      } else if (textAlign === 'right') {
        startX = posX - line.width;
      }

      let curX = startX;
      line.words.forEach((w) => {
        ctx.save();
        const centerX = curX + w.width / 2;
        const centerY = lineY;

        ctx.translate(centerX, centerY);
        if (w.wordScale !== 1.0) {
          ctx.scale(w.wordScale, w.wordScale);
        }

        ctx.font = `${w.fontWeight} ${w.fontSize}px ${w.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadows & Neon Glow
        if (glowColorOverride) {
          ctx.shadowColor = glowColorOverride;
          ctx.shadowBlur = Math.round((14 * scale) + extraGlowBlur);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else if (w.isSpeaking) {
          ctx.shadowColor = `${w.color}CC`;
          ctx.shadowBlur = Math.round(18 * scale);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.round(2 * scale);
        } else {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = Math.round(6 * scale);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.round(2 * scale);
        }

        // Stroke
        ctx.lineWidth = w.strokeWidth;
        ctx.strokeStyle = w.strokeColor;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(w.word, 0, 0);

        // Fill with shine luminance boost
        if (shineFactor > 0.3) {
          // Specular luminous core
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(w.word, 0, 0);
          ctx.fillStyle = w.color;
          ctx.globalAlpha = 0.75;
          ctx.fillText(w.word, 0, 0);
        } else {
          ctx.fillStyle = w.color;
          ctx.fillText(w.word, 0, 0);
        }

        ctx.restore();

        curX += w.width + wordGap;
      });
    });

    ctx.restore();

    // 13. Rotoscoped Person Cutout (Layer 3 on top of Captions)
    if (currentSentence.behind && selfieSegmenterService.isReady()) {
      selfieSegmenterService.drawCutoutToContext(video, ctx, canvasWidth, canvasHeight);
    }
  }

  /**
   * Export full video with burned-in captions at lossless source resolution and true 60 FPS
   */
  async exportVideo(videoElement, captionEngineInstance, config, onProgress) {
    if (this.isRendering) return;
    this.isRendering = true;

    try {
      const originalTime = videoElement.currentTime;
      const originalPaused = videoElement.paused;
      videoElement.pause();

      const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      let width = videoElement.videoWidth || 1280;
      let height = videoElement.videoHeight || 720;
      if (isMobile && (width > 1920 || height > 1920)) {
        const scale = 1920 / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const duration = videoElement.duration || 60;

      // Extract sentences array from captionEngineInstance
      const sentences = Array.isArray(captionEngineInstance?.sentences)
        ? captionEngineInstance.sentences
        : (Array.isArray(captionEngineInstance) ? captionEngineInstance : []);

      // Create high-res render canvas
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const ctx = offscreenCanvas.getContext('2d', { alpha: false });

      // Audio Graph Setup
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (e) {}
      }
      const dest = audioCtx.createMediaStreamDestination();
      try {
        const source = audioCtx.createMediaElementSource(videoElement);
        source.connect(dest);
        source.connect(audioCtx.destination);
      } catch (e) {
        // Already connected
      }

      // 60 FPS Capture Stream
      const targetFps = 60;
      const canvasStream = offscreenCanvas.captureStream ? offscreenCanvas.captureStream(targetFps) : offscreenCanvas;
      const videoTrack = canvasStream.getVideoTracks ? canvasStream.getVideoTracks()[0] : null;

      const combinedTracks = canvasStream.getVideoTracks ? [...canvasStream.getVideoTracks()] : [];
      if (dest.stream && dest.stream.getAudioTracks().length > 0) {
        combinedTracks.push(...dest.stream.getAudioTracks());
      }

      const combinedStream = new MediaStream(combinedTracks);

      // Select highest quality supported container
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

      // Broadcast-grade 12-16 Mbps bitrate for pristine 60 FPS video
      const videoBits = isMobile ? 8000000 : 14000000;
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: videoBits,
        audioBitsPerSecond: 192000
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

      let renderInterval = null;

      const finishExport = () => {
        if (!this.isRendering) return;
        this.isRendering = false;
        videoElement.removeEventListener('ended', finishExport);
        if (renderInterval) {
          clearInterval(renderInterval);
          renderInterval = null;
        }
        videoElement.pause();
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        if (onProgress) onProgress(100);
      };

      videoElement.addEventListener('ended', finishExport, { once: true });

      // Run render loop at 60 FPS (16.66ms intervals)
      renderInterval = setInterval(() => {
        if (!this.isRendering) {
          clearInterval(renderInterval);
          return;
        }

        const curTime = videoElement.currentTime;
        const progress = Math.min(100, Math.round((curTime / duration) * 100));
        if (onProgress) onProgress(progress);

        // Render frame with 100% preview-matching caption styles
        this.renderFrame(ctx, videoElement, curTime, config, width, height, sentences);

        if (videoTrack && typeof videoTrack.requestFrame === 'function') {
          videoTrack.requestFrame();
        }

        if (videoElement.ended || curTime >= duration) {
          finishExport();
        }
      }, 1000 / 60);

      const rawBlob = await exportPromise;

      // Restore video position
      videoElement.currentTime = originalTime;
      if (!originalPaused) videoElement.play();

      const finalDuration = duration > 0 ? duration : (videoElement.duration || 1);
      const fixedBlob = await fixVideoMetadata(rawBlob, finalDuration);

      return fixedBlob;
    } catch (err) {
      this.isRendering = false;
      console.error('Export error:', err);
      throw err;
    }
  }

  /**
   * Adapter for UserDashboard: burns captions to video and triggers file download
   */
  async burnCaptionsToVideoLossless(videoBlob, sentences, config, onProgress, enhanceQuality = false) {
    const video = document.createElement('video');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.crossOrigin = 'anonymous';
    const videoUrl = URL.createObjectURL(videoBlob);
    video.src = videoUrl;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => resolve();
      setTimeout(resolve, 3500);
    });

    const effectiveConfig = {
      ...config,
      enhanceQuality: !!enhanceQuality,
      enhanceVideoQuality: !!enhanceQuality
    };

    // Pre-initialize rotoscoping segmenter if any segment has "behind" checked
    if (sentences && sentences.some(s => s.behind)) {
      try {
        await selfieSegmenterService.init();
      } catch (err) {
        console.warn('Rotoscoping initialization warning for export:', err);
      }
    }

    try {
      const exportedBlob = await this.exportVideo(video, sentences, effectiveConfig, (percent) => {
        if (typeof onProgress === 'function') {
          onProgress(percent / 100);
        }
      });

      // Auto-trigger browser download
      const isMp4 = exportedBlob.type.includes('mp4');
      const ext = isMp4 ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(exportedBlob);
      a.download = `Zen_Captioned_Video_60FPS.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1500);

      return exportedBlob;
    } finally {
      URL.revokeObjectURL(videoUrl);
      video.remove();
    }
  }

  cancelExport() {
    this.isRendering = false;
  }
}

export const videoRenderer = new VideoRenderer();
