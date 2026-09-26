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

  seekVideoTo(video, time) {
    return new Promise((resolve) => {
      if (!video) {
        resolve();
        return;
      }

      let settled = false;
      let timer = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('seeked', onSeeked);
        if (timer) clearTimeout(timer);
        resolve();
      };

      const onSeeked = () => {
        requestAnimationFrame(() => setTimeout(finish, 15));
      };

      video.addEventListener('seeked', onSeeked, { once: true });
      try {
        video.currentTime = Math.max(0, time || 0);
      } catch (_) {
        finish();
        return;
      }
      timer = setTimeout(finish, 350);
    });
  }

  /**
   * Helper to resolve font family from font ID or name
   */
  getFontFamily(fontId) {
    if (!fontId) return "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    const found = FONTS.find(f => f.id.toLowerCase() === fontId.toLowerCase() || f.name.toLowerCase().includes(fontId.toLowerCase()));
    return found ? found.family : `'${fontId}', -apple-system, sans-serif`;
  }

  getSupportedRecordingMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    if (typeof MediaRecorder.isTypeSupported !== 'function') return '';

    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];

    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  getAnimationFrameState(animId, elapsed, scale) {
    const aliases = {
      'anim-left-right': 'anim-slide-left-right',
      'anim-right-left': 'anim-slide-right-left',
      'anim-top-bottom': 'anim-slide-top-bottom',
      'anim-bottom-top': 'anim-slide-bottom-top'
    };
    animId = aliases[animId] || animId;

    const state = {
      blockScale: 1,
      blockOffsetX: 0,
      blockOffsetY: 0,
      blockOpacity: 1,
      blockRotation: 0,
      blur: 0,
      brightness: 1,
      glow: 0,
      glowColor: null,
      shine: 0,
      shimmerX: null,
      waveRotation: 0,
      glitchX: 0,
      glitchY: 0,
      typewriterProgress: 1
    };

    const clamp = (v) => Math.max(0, Math.min(1, v));

    switch (animId) {
      case 'anim-slide-left-right': {
        const p = clamp(elapsed / 0.5);
        state.blockOffsetX = (1 - p) * -52 * scale;
        state.blockOpacity = p;
        break;
      }
      case 'anim-slide-right-left': {
        const p = clamp(elapsed / 0.5);
        state.blockOffsetX = (1 - p) * 52 * scale;
        state.blockOpacity = p;
        break;
      }
      case 'anim-slide-top-bottom': {
        const p = clamp(elapsed / 0.48);
        state.blockOffsetY = (1 - p) * -42 * scale;
        state.blockOpacity = p;
        break;
      }
      case 'anim-slide-bottom-top': {
        const p = clamp(elapsed / 0.48);
        state.blockOffsetY = (1 - p) * 42 * scale;
        state.blockOpacity = p;
        break;
      }
      case 'anim-blink': {
        const p = clamp(elapsed / 0.7);
        const pulse = Math.abs(Math.sin(p * Math.PI * 2));
        state.blockOpacity = elapsed < 0.7 ? Math.max(0.35, pulse) : 1;
        break;
      }
      case 'anim-typewriter': {
        state.typewriterProgress = clamp(elapsed / 0.4);
        state.blockOpacity = 0.5 + 0.5 * state.typewriterProgress;
        break;
      }
      case 'anim-karaoke-glow': {
        break;
      }
      case 'anim-wave': {
        const p = clamp(elapsed / 0.5);
        state.waveRotation = Math.sin(p * Math.PI * 2) * 4 * (1 - p);
        break;
      }
      case 'anim-fade': {
        state.blockOpacity = clamp(elapsed / 0.4);
        break;
      }
      case 'anim-blur': {
        const p = clamp(elapsed / 0.4);
        state.blockOpacity = p;
        break;
      }
      case 'anim-neon-pulse': {
        break;
      }
      case 'anim-glitch': {
        const phase = Math.floor(elapsed * 18) % 4;
        state.glitchX = ([0, -2, 2, -1][phase] || 0) * scale;
        state.glitchY = ([0, 1, -1, -1][phase] || 0) * scale;
        break;
      }
      case 'anim-flip3d': {
        const p = clamp(elapsed / 0.5);
        state.blockOpacity = p;
        state.blockScale = 0.82 + 0.18 * this.easeOutBack(p);
        state.blockOffsetY = (1 - p) * 8 * scale;
        break;
      }
      case 'anim-neon-shimmer': {
        const p = clamp(elapsed / 0.9);
        state.blockScale = 0.96 + 0.08 * (p <= 0.5 ? p / 0.5 : (1 - p) / 0.5);
        state.blockOpacity = Math.min(1, p / 0.2);
        state.brightness = p < 0.45 ? 0.6 + 1.6 * (p / 0.45) : 2.2 - 1.2 * ((p - 0.45) / 0.55);
        state.glow = Math.sin(Math.min(1, p) * Math.PI);
        state.shine = Math.min(1, p);
        state.shimmerX = p;
        break;
      }
      case 'anim-fire-flare': {
        const p = clamp(elapsed / 0.85);
        const flare = p <= 0.4 ? p / 0.4 : Math.max(0, (1 - p) / 0.6);
        state.blockScale = 0.85 + 0.15 * Math.min(1, p / 0.4);
        state.blockOpacity = Math.min(1, p / 0.18);
        state.glow = flare;
        state.shine = flare;
        state.shimmerX = Math.min(1, p * 1.25);
        break;
      }
      case 'anim-zoom-impact': {
        const p = clamp(elapsed / 0.35);
        state.blockScale = 1 + 1.2 * Math.pow(1 - p, 2.2);
        state.blockOpacity = Math.min(1, p / 0.12);
        break;
      }
      case 'anim-bounce-drop': {
        const p = clamp(elapsed / 0.48);
        if (p <= 0.65) {
          const t = p / 0.65;
          state.blockOffsetY = (-45 + 50 * t) * scale;
          state.blockScale = 0.85 + 0.23 * t;
        } else if (p <= 0.85) {
          const t = (p - 0.65) / 0.2;
          state.blockOffsetY = (5 - 7 * t) * scale;
          state.blockScale = 1.08 - 0.10 * t;
        } else {
          const t = (p - 0.85) / 0.15;
          state.blockOffsetY = (-2 + 2 * t) * scale;
          state.blockScale = 0.98 + 0.02 * t;
        }
        state.blockOpacity = Math.min(1, p / 0.18);
        break;
      }
      case 'anim-pop': {
        const p = clamp(elapsed / 0.4);
        if (p <= 0.6) state.blockScale = 0.65 + 0.5 * (p / 0.6);
        else state.blockScale = 1.15 - 0.15 * ((p - 0.6) / 0.4);
        state.blockOpacity = Math.min(1, p / 0.15);
        break;
      }
      case 'anim-cinematic-drift': {
        const p = clamp(elapsed / 1.4);
        state.blockOffsetY = (1 - p) * 14 * scale;
        state.blockScale = 0.92 + 0.08 * p;
        state.blockOpacity = Math.min(1, p / 0.25);
        break;
      }
      case 'anim-3d-tilt': {
        const p = clamp(elapsed / 0.75);
        state.blockOffsetY = (1 - p) * 20 * scale;
        state.blockRotation = (1 - p) * -6;
        state.blockScale = 0.85 + 0.15 * p;
        state.blockOpacity = Math.min(1, p / 0.22);
        break;
      }
      case 'anim-elastic-snap': {
        const p = clamp(elapsed / 0.7);
        if (p <= 0.65) {
          state.blockScale = 0.35 + 0.8 * this.easeOutBack(p / 0.65);
          state.blockRotation = -8 + 10 * (p / 0.65);
        } else if (p <= 0.85) {
          const t = (p - 0.65) / 0.2;
          state.blockScale = 1.15 - 0.18 * t;
          state.blockRotation = 2 - 3 * t;
        } else {
          const t = (p - 0.85) / 0.15;
          state.blockScale = 0.97 + 0.03 * t;
          state.blockRotation = -1 + t;
        }
        state.blockOpacity = Math.min(1, p / 0.18);
        break;
      }
      case 'anim-liquid-gradient': {
        const p = clamp(elapsed / 1.1);
        const shine = Math.sin(p * Math.PI);
        state.blockScale = 0.95 + 0.08 * shine;
        state.blockOpacity = Math.min(1, p / 0.25);
        state.glow = shine;
        state.shine = shine;
        state.shimmerX = p;
        break;
      }
    }

    return state;
  }

  renderSentence(ctx, sentence, curTime, config, canvasWidth, canvasHeight, sentences, scale) {
    if (!sentence) return;

    let words = sentence.words;
    if (!words || words.length === 0) {
      const sStart = Number(sentence.start ?? sentence.startTime ?? 0);
      const sEnd = Number(sentence.end ?? sentence.endTime ?? (sStart + 2.5));
      const textWords = (sentence.text || '').split(/\s+/).filter(Boolean);
      const dur = (sEnd - sStart) / Math.max(1, textWords.length);
      words = textWords.map((word, idx) => ({
        word,
        start: sStart + idx * dur,
        end: sStart + (idx + 1) * dur
      }));
    }

    if (!words || words.length === 0) return;

    // Determine active speaking word index
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

    const isPortrait = canvasHeight > canvasWidth;
    const previewFontSize = (sentence.fontSize !== undefined && sentence.fontSize !== null && sentence.fontSize > 0)
      ? Number(sentence.fontSize)
      : (isPortrait ? 25 : ((config.fontSize && Number(config.fontSize) <= 30) ? Number(config.fontSize) : 28));
    const baseFontSize = Math.max(16, Math.round(previewFontSize * scale));

    const normalFontFamily = this.getFontFamily(config.normalFontFamily || 'Inter');
    const prominentFontFamily = this.getFontFamily(config.prominentFontFamily || 'Syne');
    const segmentFontFamily = sentence.fontFamily ? this.getFontFamily(sentence.fontFamily) : null;

    const defaultTextColor = sentence.textColor || config.textColor || '#FFFFFF';
    const prominentColor = sentence.prominentColor || config.prominentColor || '#FFE600';
    const hasLastWordColor = !sentence.prominentColor && (config.enableLastWordColor !== false && !!config.lastWordColor);
    const lastWordColor = hasLastWordColor ? config.lastWordColor : prominentColor;

    const strokeEnabled = sentence.strokeEnabled !== false;
    const customStrokeColor = sentence.strokeColor;
    const hasGlow = sentence.glowColor && sentence.glowColor !== 'transparent' && sentence.glowColor !== '';
    const glowColor = hasGlow ? sentence.glowColor : null;

    const styledWords = words.map((w, localIdx) => {
      const cleanWord = (w.word || '').replace(/[.,!?:;"'()]/g, '');
      const isHeroKeyword = autoTypographyEngine.brandRegex.test(cleanWord) || 
                            autoTypographyEngine.monthsDatesRegex.test(cleanWord) || 
                            autoTypographyEngine.placesRegex.test(cleanWord) || 
                            autoTypographyEngine.impactWordsRegex.test(cleanWord);
      
      const isSpeaking = (localIdx === speakingWordIdx);
      const isLastWord = (localIdx === words.length - 1);
      const isProminent = w.isProminent || isHeroKeyword || isLastWord || (words.length >= 3 && localIdx === 1);

      let font = segmentFontFamily || (isProminent ? prominentFontFamily : normalFontFamily);
      let color = isProminent ? prominentColor : defaultTextColor;

      if (isLastWord && hasLastWordColor) {
        font = segmentFontFamily || prominentFontFamily;
        color = lastWordColor;
      }
      if (isSpeaking) {
        font = segmentFontFamily || prominentFontFamily;
      }

      const fontWeight = isSpeaking ? '900' : (isProminent ? '800' : '700');
      const strokeWidth = strokeEnabled
        ? ((isProminent
            ? (config.prominentOutlineWidth !== undefined ? config.prominentOutlineWidth : 2.5)
            : (config.normalOutlineWidth !== undefined ? config.normalOutlineWidth : 1.5)) * scale)
        : 0;
      const strokeColor = strokeEnabled
        ? (customStrokeColor || (isProminent ? (config.prominentOutlineColor || '#000000') : (config.normalOutlineColor || '#000000')))
        : 'transparent';

      const wordScale = isSpeaking ? 1.15 : 1.0;

      return {
        word: (w.word || '').toUpperCase(),
        font,
        fontWeight,
        color,
        strokeWidth: Math.max(0, strokeWidth),
        strokeColor,
        isSpeaking,
        wordScale,
        fontSize: baseFontSize
      };
    });

    const defaultPosMeta = CAPTION_POSITIONS.find(p => p.id === 'middle-left') || CAPTION_POSITIONS[3];
    const hasCustomPos = sentence.posX !== undefined && sentence.posY !== undefined;
    
    let posX = hasCustomPos ? (canvasWidth * Number(sentence.posX)) / 100 : (canvasWidth * 0.06);
    let posY = hasCustomPos ? (canvasHeight * Number(sentence.posY)) / 100 : (canvasHeight * 0.50);

    const textAlign = hasCustomPos ? 'left' : (defaultPosMeta.align || 'left');
    const segmentBoxWidth = Number(sentence.boxWidth || sentence.width || 0);
    const availableWidthPct = hasCustomPos ? Math.max(10, 98 - Number(sentence.posX)) : 94;
    const customMaxWidth = segmentBoxWidth > 0
      ? (canvasWidth * segmentBoxWidth) / 100 + Math.round(baseFontSize * 0.4)
      : (canvasWidth * (availableWidthPct / 100));

    const lines = [];
    let curLine = [];
    let curLineWidth = 0;
    const wordGap = Math.max(3, Math.round(baseFontSize * 0.20));

    styledWords.forEach((sw) => {
      ctx.font = `${sw.fontWeight} ${sw.fontSize}px ${sw.font}`;
      const rawWidth = ctx.measureText(sw.word).width;
      const wordWidth = rawWidth;
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

    const lineHeight = baseFontSize * 1.12;
    const totalBlockHeight = lines.length * lineHeight;
    const startBlockY = hasCustomPos ? posY : (posY - totalBlockHeight * 0.5);

    let resolvedAnimId = sentence.animation || config.animation || 'anim-auto';
    if (resolvedAnimId === 'anim-auto') {
      const targetIdx = sentences.findIndex(s => s === sentence || (s.id !== undefined && s.id === sentence.id));
      resolvedAnimId = AUTO_ANIMATION_SEQUENCE[Math.max(0, targetIdx) % AUTO_ANIMATION_SEQUENCE.length];
    }

    const segStartTime = Number(sentence.start ?? sentence.startTime ?? 0);
    const animElapsed = Math.max(0, curTime - segStartTime);
    const animState = this.getAnimationFrameState(resolvedAnimId, animElapsed, scale);

    const maxLineWidth = Math.max(...lines.map(l => l.width), 10);
    const blockCenterX = (textAlign === 'center')
      ? posX
      : (textAlign === 'right' ? posX - maxLineWidth / 2 : posX + maxLineWidth / 2);
    const blockCenterY = startBlockY + totalBlockHeight * 0.5;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, animState.blockOpacity));
    ctx.filter = 'none';

    // Apply block entrance animation transform
    ctx.translate(blockCenterX + animState.blockOffsetX, blockCenterY + animState.blockOffsetY);
    if (animState.blockRotation) {
      ctx.rotate((animState.blockRotation * Math.PI) / 180);
    }
    if (animState.blockScale !== 1.0) {
      ctx.scale(animState.blockScale, animState.blockScale);
    }
    ctx.translate(-blockCenterX, -blockCenterY);

    if (animState.typewriterProgress < 1) {
      const clipLeft = textAlign === 'center'
        ? blockCenterX - maxLineWidth / 2
        : (textAlign === 'right' ? posX - maxLineWidth : posX);
      ctx.beginPath();
      ctx.rect(clipLeft - 4 * scale, startBlockY - lineHeight, (maxLineWidth + 8 * scale) * animState.typewriterProgress, totalBlockHeight + lineHeight * 1.4);
      ctx.clip();
    }

    lines.forEach((line, lineIdx) => {
      const lineTop = startBlockY + lineIdx * lineHeight;
      const lineY = lineTop + lineHeight * 0.5;
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
        if (animState.waveRotation) {
          ctx.rotate((animState.waveRotation * Math.PI) / 180);
        }
        if (w.wordScale !== 1.0) {
          ctx.scale(w.wordScale, w.wordScale);
        }

        ctx.font = `${w.fontWeight} ${w.fontSize}px ${w.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const animationGlow = animState.glow > 0 ? animState.glow : 0;
        if ((hasGlow && glowColor) || animationGlow > 0) {
          ctx.shadowColor = glowColor || (resolvedAnimId === 'anim-fire-flare' ? '#ff6b00' : '#00F0FF');
          ctx.shadowBlur = Math.round((hasGlow ? 18 : 24) * scale * Math.max(0.45, animationGlow || 1));
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        if (resolvedAnimId === 'anim-glitch') {
          ctx.save();
          ctx.globalAlpha = 0.65;
          ctx.fillStyle = '#00F0FF';
          ctx.fillText(w.word, -2 * scale + animState.glitchX, animState.glitchY);
          ctx.fillStyle = '#FF4DA6';
          ctx.fillText(w.word, 2 * scale + animState.glitchX, -animState.glitchY);
          ctx.restore();
        }

        // Crisp Outline Stroke
        if (strokeEnabled && w.strokeWidth > 0 && w.strokeColor !== 'transparent') {
          ctx.lineWidth = w.strokeWidth;
          ctx.strokeStyle = w.strokeColor;
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.strokeText(w.word, 0, 0);
        }

        ctx.fillStyle = w.color;
        ctx.fillText(w.word, 0, 0);

        if (animState.shine > 0) {
          const shimmerX = Number.isFinite(animState.shimmerX) ? animState.shimmerX : animState.shine;
          const sweepWidth = Math.max(w.width * 1.8, baseFontSize * 4);
          const sweepCenter = -w.width + sweepWidth * shimmerX;
          const gradient = ctx.createLinearGradient(sweepCenter - sweepWidth * 0.35, 0, sweepCenter + sweepWidth * 0.35, 0);
          const accentA = resolvedAnimId === 'anim-fire-flare' ? '#ff6b00' : '#00F0FF';
          const accentB = resolvedAnimId === 'anim-liquid-gradient' ? '#FF4DA6' : '#FFFFFF';
          gradient.addColorStop(0, 'rgba(255,255,255,0)');
          gradient.addColorStop(0.32, accentA);
          gradient.addColorStop(0.5, accentB);
          gradient.addColorStop(0.68, accentA);
          gradient.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.save();
          ctx.globalAlpha = Math.min(0.72, 0.18 + animState.shine * 0.54);
          ctx.fillStyle = gradient;
          ctx.fillText(w.word, 0, 0);
          ctx.restore();
        }

        ctx.restore();
        curX += w.width + wordGap;
      });
    });

    ctx.restore();
  }

  renderFrame(ctx, video, curTimeOrState, config = {}, canvasWidth, canvasHeight, sentencesOverride = null) {
    if (!ctx || !video) return;

    let sentences = sentencesOverride || [];
    let curTime = 0;

    if (typeof curTimeOrState === 'number') {
      curTime = curTimeOrState;
    } else if (curTimeOrState && typeof curTimeOrState === 'object') {
      curTime = curTimeOrState.currentTime !== undefined ? curTimeOrState.currentTime : (video.currentTime || 0);
      if (curTimeOrState.sentences) sentences = curTimeOrState.sentences;
    } else {
      curTime = video.currentTime || 0;
    }

    const isEnhanced = !!(config.enhanceQuality || config.enhanceVideoQuality);
    if (isEnhanced) {
      ctx.filter = 'contrast(1.18) saturate(1.28) brightness(1.02)';
    } else {
      ctx.filter = 'none';
    }

    // Layer 1: Background Video
    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
    ctx.filter = 'none';

    if (!sentences || sentences.length === 0) return;

    // Find all active segments at curTime
    const matchingSentences = [];
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      const sStart = Number(s.start ?? s.startTime ?? 0);
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
      const isLast = (i === sentences.length - 1);
      if (curTime >= sStart && (isLast ? curTime <= sEnd : curTime < sEnd)) {
        matchingSentences.push(s);
      }
    }

    if (matchingSentences.length === 0) {
      for (let i = sentences.length - 1; i >= 0; i--) {
        const s = sentences[i];
        const sStart = Number(s.start ?? s.startTime ?? 0);
        const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
        if (curTime >= sStart && curTime <= (sEnd + 0.35)) {
          const nextS = sentences[i + 1];
          const nextStart = nextS ? Number(nextS.start ?? nextS.startTime ?? Infinity) : Infinity;
          if (curTime < nextStart) {
            matchingSentences.push(s);
            break;
          }
        }
      }
    }

    if (matchingSentences.length === 0) return;

    const isPortrait = canvasHeight > canvasWidth;
    const previewDisplayWidth = Number(config.previewDisplayWidth || 0);
    const fallbackRefWidth = isPortrait ? 360 : 640;
    const refWidth = Number.isFinite(previewDisplayWidth) && previewDisplayWidth > 80
      ? previewDisplayWidth
      : fallbackRefWidth;
    const scale = Math.max(0.65, Math.min(8.0, canvasWidth / refWidth));

    const behindSentences = matchingSentences.filter(s => s.behind);
    const frontSentences = matchingSentences.filter(s => !s.behind);

    // Layer 2: Behind Captions
    behindSentences.forEach((s) => {
      this.renderSentence(ctx, s, curTime, config, canvasWidth, canvasHeight, sentences, scale);
    });

    // Layer 3: Rotoscoped Person Cutout (draw over Behind Captions)
    if (behindSentences.length > 0 && selfieSegmenterService.isReady()) {
      selfieSegmenterService.drawCutoutToContext(video, ctx, canvasWidth, canvasHeight, isEnhanced, {
        time: curTime,
        useExportCache: config.useExportCutoutCache === true,
        disableStaleCutout: true
      });
    }

    // Layer 4: Front Captions (draw in front of Person Cutout)
    frontSentences.forEach((s) => {
      this.renderSentence(ctx, s, curTime, config, canvasWidth, canvasHeight, sentences, scale);
    });
  }

  /**
   * Export full video with burned-in captions at lossless source resolution and true 60 FPS
   */
  async prepareExportCutoutCache(videoElement, sentences, width, height, enhanceQuality, onProgress) {
    const behindSegments = (sentences || [])
      .filter(s => s.behind)
      .map(s => ({
        start: Math.max(0, Number(s.start ?? s.startTime ?? 0)),
        end: Math.max(0, Number(s.end ?? s.endTime ?? 0))
      }))
      .filter(seg => Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.end > seg.start);

    selfieSegmenterService.clearExportCutoutCache();
    if (behindSegments.length === 0 || !selfieSegmenterService.isReady()) return;

    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // Keep the person layer light enough that recording stays smooth. The final
    // canvas remains source-resolution; only the pre-baked mask layer is capped.
    const cacheMaxSide = isMobile ? 720 : 960;
    const cacheScale = Math.min(1, cacheMaxSide / Math.max(width, height));
    const cacheWidth = Math.max(1, Math.round(width * cacheScale));
    const cacheHeight = Math.max(1, Math.round(height * cacheScale));
    const sampleStep = isMobile ? 1 / 24 : 1 / 30;
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
    const cache = [];

    for (let i = 0; i < samples.length; i++) {
      const t = samples[i];
      try {
        await this.seekVideoTo(videoElement, t);
        const canvas = await selfieSegmenterService.captureCutoutFrame(videoElement, cacheWidth, cacheHeight, enhanceQuality);
        if (canvas) {
          const decodedTime = Number(videoElement.currentTime);
          cache.push({ time: Number.isFinite(decodedTime) ? decodedTime : t, requestedTime: t, canvas });
        }
      } catch (err) {
        console.warn('Export cutout cache frame skipped:', err.message);
      }

      if (onProgress && samples.length > 0) {
        const prebakePercent = Math.min(15, Math.max(1, Math.round(((i + 1) / samples.length) * 15)));
        onProgress(prebakePercent);
      }
    }

    selfieSegmenterService.setExportCutoutCache(cache);
  }

  async exportVideo(videoElement, captionEngineInstance, config, onProgress) {
    if (this.isRendering) return;
    this.isRendering = true;

    try {
      if (typeof selfieSegmenterService.resetCache === 'function') {
        selfieSegmenterService.resetCache();
      }

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

      if (typeof document !== 'undefined' && document.fonts?.ready) {
        try { await document.fonts.ready; } catch (_) {}
      }

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
        // Do not connect to audioCtx.destination to prevent speaker echo during export
      } catch (e) {
        // Already connected
      }

      // 60 FPS Capture Stream
      const targetFps = 60;
      if (!offscreenCanvas.captureStream || typeof MediaRecorder === 'undefined') {
        throw new Error('This browser cannot export burned captions because MediaRecorder/canvas capture is unavailable. Please use current Chrome, Edge, Safari, or Firefox.');
      }

      const canvasStream = offscreenCanvas.captureStream(targetFps);

      const combinedTracks = canvasStream.getVideoTracks ? [...canvasStream.getVideoTracks()] : [];
      if (dest.stream && dest.stream.getAudioTracks().length > 0) {
        combinedTracks.push(...dest.stream.getAudioTracks());
      }

      const combinedStream = new MediaStream(combinedTracks);

      // Select highest quality supported container, preferring Safari/iPhone friendly MP4.
      const mimeType = this.getSupportedRecordingMimeType();

      // Broadcast-grade 8 Mbps bitrate for pristine, lag-free 60 FPS video
      const videoBits = isMobile ? 6000000 : 8000000;
      const recorderOptions = {
        videoBitsPerSecond: videoBits,
        audioBitsPerSecond: 192000
      };
      if (mimeType) recorderOptions.mimeType = mimeType;
      const recorder = new MediaRecorder(combinedStream, recorderOptions);

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const exportPromise = new Promise((resolve, reject) => {
        recorder.onstop = () => {
          const blobType = recorder.mimeType || mimeType || chunks[0]?.type || 'video/webm';
          const blob = new Blob(chunks, { type: blobType });
          resolve(blob);
        };
        recorder.onerror = reject;
      });

      const hasBehindCaptions = sentences.some(s => s.behind);
      if (hasBehindCaptions && selfieSegmenterService.isReady()) {
        await this.prepareExportCutoutCache(
          videoElement,
          sentences,
          width,
          height,
          !!(config.enhanceQuality || config.enhanceVideoQuality),
          onProgress
        );
        config.useExportCutoutCache = true;
      }

      // Reset video to start
      await this.seekVideoTo(videoElement, 0);

      const renderCapturedFrame = (time) => {
        const safeTime = Math.max(0, Math.min(duration, Number(time) || 0));
        this.renderFrame(ctx, videoElement, safeTime, config, width, height, sentences);
      };

      // Prime captureStream with an enhanced first frame before recording starts.
      renderCapturedFrame(0);

      recorder.start(100);

      // Record an immediate frame at t=0 so enhancement never begins late.
      renderCapturedFrame(0);

      videoElement.playbackRate = 1.0;
      await videoElement.play();

      let isExportActive = true;
      let animId = null;
      let videoFrameCallbackId = null;
      let lastRenderedTime = -1;

      const finishExport = () => {
        if (!this.isRendering) return;
        this.isRendering = false;
        isExportActive = false;
        videoElement.removeEventListener('ended', finishExport);
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
        if (videoFrameCallbackId && typeof videoElement.cancelVideoFrameCallback === 'function') {
          videoElement.cancelVideoFrameCallback(videoFrameCallbackId);
          videoFrameCallbackId = null;
        }
        renderCapturedFrame(Math.min(duration, videoElement.currentTime || duration));
        videoElement.pause();
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        if (onProgress) onProgress(100);
      };

      videoElement.addEventListener('ended', finishExport, { once: true });

      const updateProgress = (curTime) => {
        const baseOffset = hasBehindCaptions ? 15 : 0;
        const scaleFactor = hasBehindCaptions ? 0.85 : 1.0;
        const progress = Math.min(100, Math.round(baseOffset + (curTime / duration) * (100 * scaleFactor)));
        if (onProgress) onProgress(progress);
      };

      const renderAtTime = (time) => {
        const curTime = Math.max(0, Math.min(duration, Number(time) || 0));
        if (curTime === lastRenderedTime) return;
        lastRenderedTime = curTime;
        updateProgress(curTime);
        renderCapturedFrame(curTime);
      };

      // Sync to decoded video frames when available, falling back to rAF.
      const renderLoop = (_now, metadata) => {
        if (!isExportActive || !this.isRendering) return;

        const curTime = metadata && Number.isFinite(metadata.mediaTime)
          ? metadata.mediaTime
          : videoElement.currentTime;
        renderAtTime(curTime);

        if (videoElement.ended || curTime >= duration) {
          finishExport();
          return;
        }

        if (typeof videoElement.requestVideoFrameCallback === 'function') {
          videoFrameCallbackId = videoElement.requestVideoFrameCallback(renderLoop);
        } else {
          animId = requestAnimationFrame(renderLoop);
        }
      };

      if (typeof videoElement.requestVideoFrameCallback === 'function') {
        videoFrameCallbackId = videoElement.requestVideoFrameCallback(renderLoop);
      } else {
        animId = requestAnimationFrame(renderLoop);
      }

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
    video.preload = 'auto';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.crossOrigin = 'anonymous';
    video.muted = false;
    video.volume = 1.0;
    video.classList.toggle('video-enhanced', !!enhanceQuality);
    // Use full opacity in viewport bounds with z-index: -999 to guarantee Chromium gives full GPU priority without occlusion throttling
    video.style.cssText = 'position:fixed;bottom:0;right:0;width:320px;height:180px;opacity:1;pointer-events:none;z-index:-999;object-fit:cover;';
    document.body.appendChild(video);

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
      video.pause();
      video.remove();
    }
  }

  cancelExport() {
    this.isRendering = false;
  }
}

export const videoRenderer = new VideoRenderer();
