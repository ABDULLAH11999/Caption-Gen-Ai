// YouTube-Style Progressive Live Caption Engine
// Provides word-level timestamps and streaming display as words are spoken.

export class CaptionEngine {
  constructor() {
    this.sentences = [];
    this.activeSentenceIndex = -1;
    this.activeWordIndex = -1;
  }

  /**
   * Generates a sample multilingual transcript with precise word-level timestamps
   * for testing or demonstration.
   */
  generateSampleTranscript(duration = 60) {
    const rawSegments = [
      // Segment 1: English (0s - 14s)
      {
        lang: 'en',
        text: "Welcome to the future of AI caption generation studio",
        start: 1.0,
        words: [
          { word: "Welcome", start: 1.0, end: 1.5 },
          { word: "to", start: 1.5, end: 1.8 },
          { word: "the", start: 1.8, end: 2.1 },
          { word: "future", start: 2.1, end: 2.7 },
          { word: "of", start: 2.7, end: 3.0 },
          { word: "AI", start: 3.0, end: 3.5 },
          { word: "caption", start: 3.5, end: 4.1 },
          { word: "generation", start: 4.1, end: 4.8 },
          { word: "studio", start: 4.8, end: 5.6 }
        ]
      },
      {
        lang: 'en',
        text: "Every single word appears exactly as spoken just like YouTube",
        start: 6.2,
        words: [
          { word: "Every", start: 6.2, end: 6.7 },
          { word: "single", start: 6.7, end: 7.2 },
          { word: "word", start: 7.2, end: 7.7 },
          { word: "appears", start: 7.7, end: 8.3 },
          { word: "exactly", start: 8.3, end: 8.9 },
          { word: "as", start: 8.9, end: 9.2 },
          { word: "spoken", start: 9.2, end: 9.8 },
          { word: "just", start: 9.8, end: 10.2 },
          { word: "like", start: 10.2, end: 10.6 },
          { word: "YouTube", start: 10.6, end: 11.4 }
        ]
      },
      // Segment 2: Spanish (Translated to English, 13s - 25s)
      {
        lang: 'en',
        originalLanguage: 'es',
        text: "Now we switch language with instant multi-language detection",
        start: 13.0,
        words: [
          { word: "Now", start: 13.0, end: 13.5 },
          { word: "we", start: 13.5, end: 13.9 },
          { word: "switch", start: 13.9, end: 14.5 },
          { word: "language", start: 14.5, end: 15.2 },
          { word: "with", start: 15.2, end: 15.6 },
          { word: "instant", start: 15.6, end: 16.3 },
          { word: "multi-language", start: 16.3, end: 17.2 },
          { word: "detection", start: 17.2, end: 18.0 }
        ]
      },
      {
        lang: 'en',
        originalLanguage: 'es',
        text: "Dynamic captions with animations and custom styling colors",
        start: 19.2,
        words: [
          { word: "Dynamic", start: 19.2, end: 19.9 },
          { word: "captions", start: 19.9, end: 20.6 },
          { word: "with", start: 20.6, end: 21.0 },
          { word: "animations", start: 21.0, end: 21.9 },
          { word: "and", start: 21.9, end: 22.2 },
          { word: "custom", start: 22.2, end: 22.8 },
          { word: "styling", start: 22.8, end: 23.5 },
          { word: "colors", start: 23.5, end: 24.2 }
        ]
      },
      // Segment 3: Urdu / Hindi (Translated to English, 26s - 32s)
      {
        lang: 'en',
        originalLanguage: 'ur',
        text: "This system works completely offline with high performance",
        start: 26.5,
        words: [
          { word: "This", start: 26.5, end: 27.0 },
          { word: "system", start: 27.0, end: 27.7 },
          { word: "works", start: 27.7, end: 28.3 },
          { word: "completely", start: 28.3, end: 29.1 },
          { word: "offline", start: 29.1, end: 29.9 },
          { word: "with", start: 29.9, end: 30.3 },
          { word: "high", start: 30.3, end: 30.8 },
          { word: "performance", start: 30.8, end: 31.5 }
        ]
      },
      {
        lang: 'en',
        text: "Export high quality video with lossless captions and audio",
        start: 33.0,
        words: [
          { word: "Export", start: 33.0, end: 33.6 },
          { word: "high", start: 33.6, end: 34.0 },
          { word: "quality", start: 34.0, end: 34.6 },
          { word: "video", start: 34.6, end: 35.2 },
          { word: "with", start: 35.2, end: 35.5 },
          { word: "lossless", start: 35.5, end: 36.2 },
          { word: "captions", start: 36.2, end: 36.9 },
          { word: "and", start: 36.9, end: 37.2 },
          { word: "audio", start: 37.2, end: 38.0 }
        ]
      }
    ];

    // Filter segments based on total video duration
    const sentences = rawSegments
      .filter(s => s.start < duration)
      .map((seg, idx) => {
        const lastWord = seg.words[seg.words.length - 1];
        const endTime = Math.min(duration, lastWord.end + 0.4);
        return {
          id: `sentence_${idx + 1}`,
          language: seg.lang,
          startTime: seg.start,
          endTime: endTime,
          text: seg.text,
          words: seg.words.map(w => ({
            ...w,
            end: Math.min(duration, w.end)
          }))
        };
      });

    this.sentences = sentences;
    return sentences;
  }

  /**
   * Consolidates orphaned time suffixes (e.g. "3 to 6" followed by "p" and ".m.")
   * into clean, unified phrases ("3 to 6 PM") with extended end times.
   */
  consolidateTimeAndOrphanSegments(sentences) {
    if (!Array.isArray(sentences) || sentences.length === 0) return sentences || [];

    const isOrphanPmAm = (text) => {
      const clean = (text || '').trim().toLowerCase();
      return /^(p|\.m\.|p\.m\.|pm|am|a|a\.m\.|m\.|m)$/.test(clean);
    };

    const isTimePmPrefix = (text) => {
      const clean = (text || '').trim().toLowerCase();
      return /^(p|p\.)$/.test(clean);
    };

    const isTimeAmPrefix = (text) => {
      const clean = (text || '').trim().toLowerCase();
      return /^(a|a\.)$/.test(clean);
    };

    const isTimeSuffix = (text) => {
      const clean = (text || '').trim().toLowerCase();
      return /^(\.m\.|m\.|m)$/.test(clean);
    };

    const isFullTimeToken = (text) => {
      const clean = (text || '').trim().toLowerCase();
      return /^(pm|am|p\.m\.|a\.m\.)$/.test(clean);
    };

    // Step 1: Consolidate internal words in each sentence (e.g. word "p" + word ".m." -> word "PM")
    sentences.forEach(s => {
      if (!s.words || s.words.length <= 1) return;
      const newWords = [];
      for (let i = 0; i < s.words.length; i++) {
        const curW = s.words[i];
        const nextW = s.words[i + 1];

        if (nextW && isTimePmPrefix(curW.word) && isTimeSuffix(nextW.word)) {
          newWords.push({
            ...curW,
            word: 'PM',
            end: nextW.end ?? nextW.endTime ?? curW.end,
            endTime: nextW.end ?? nextW.endTime ?? curW.end
          });
          i++; // skip next
        } else if (nextW && isTimeAmPrefix(curW.word) && isTimeSuffix(nextW.word)) {
          newWords.push({
            ...curW,
            word: 'AM',
            end: nextW.end ?? nextW.endTime ?? curW.end,
            endTime: nextW.end ?? nextW.endTime ?? curW.end
          });
          i++;
        } else if (isFullTimeToken(curW.word)) {
          newWords.push({
            ...curW,
            word: curW.word.toLowerCase().startsWith('p') ? 'PM' : 'AM'
          });
        } else {
          newWords.push(curW);
        }
      }
      s.words = newWords;
      s.text = s.words.map(w => w.word).join(' ');
    });

    // Step 2: Merge orphaned consecutive segments into the previous segment
    const merged = [];
    for (let i = 0; i < sentences.length; i++) {
      const cur = sentences[i];
      const next1 = sentences[i + 1];
      const next2 = sentences[i + 2];

      // Check Case A: cur is "3 to 6", next1 is "p", next2 is ".m."
      if (next1 && next2 && isTimePmPrefix(next1.text) && isTimeSuffix(next2.text)) {
        const pStart = Number(next1.start ?? next1.startTime ?? cur.end);
        const mEnd = Number(next2.end ?? next2.endTime ?? (pStart + 0.5));
        cur.words = cur.words || [];
        cur.words.push({
          word: 'PM',
          start: pStart,
          end: mEnd,
          startTime: pStart,
          endTime: mEnd
        });
        cur.end = mEnd;
        cur.endTime = mEnd;
        cur.text = `${cur.text.trim()} PM`;
        merged.push(cur);
        i += 2; // skip next1 and next2
        continue;
      }

      // Check Case B: cur is "3 to 6", next1 is "a", next2 is ".m."
      if (next1 && next2 && isTimeAmPrefix(next1.text) && isTimeSuffix(next2.text)) {
        const aStart = Number(next1.start ?? next1.startTime ?? cur.end);
        const mEnd = Number(next2.end ?? next2.endTime ?? (aStart + 0.5));
        cur.words = cur.words || [];
        cur.words.push({
          word: 'AM',
          start: aStart,
          end: mEnd,
          startTime: aStart,
          endTime: mEnd
        });
        cur.end = mEnd;
        cur.endTime = mEnd;
        cur.text = `${cur.text.trim()} AM`;
        merged.push(cur);
        i += 2;
        continue;
      }

      // Check Case C: cur is "3 to 6", next1 is "pm" or "p.m." or "am" or "a.m."
      if (next1 && isFullTimeToken(next1.text)) {
        const timeUnit = next1.text.toLowerCase().startsWith('p') ? 'PM' : 'AM';
        const nStart = Number(next1.start ?? next1.startTime ?? cur.end);
        const nEnd = Number(next1.end ?? next1.endTime ?? (nStart + 0.4));
        cur.words = cur.words || [];
        cur.words.push({
          word: timeUnit,
          start: nStart,
          end: nEnd,
          startTime: nStart,
          endTime: nEnd
        });
        cur.end = nEnd;
        cur.endTime = nEnd;
        cur.text = `${cur.text.trim()} ${timeUnit}`;
        merged.push(cur);
        i += 1;
        continue;
      }

      // Check Case D: next1 is an orphaned token (e.g. lone "p" or lone ".m." or single dangling abbreviation)
      if (next1 && isOrphanPmAm(next1.text)) {
        const timeUnit = next1.text.toLowerCase().includes('a') ? 'AM' : 'PM';
        const nStart = Number(next1.start ?? next1.startTime ?? cur.end);
        const nEnd = Number(next1.end ?? next1.endTime ?? (nStart + 0.4));
        cur.words = cur.words || [];
        cur.words.push({
          word: timeUnit,
          start: nStart,
          end: nEnd,
          startTime: nStart,
          endTime: nEnd
        });
        cur.end = nEnd;
        cur.endTime = nEnd;
        cur.text = `${cur.text.trim()} ${timeUnit}`;
        merged.push(cur);
        i += 1;
        continue;
      }

      merged.push(cur);
    }

    return merged;
  }

  /**
   * Splits long sentences so line segments stay compact.
   * Keeps short voice chunks together so timing stays aligned with speech.
   */
  splitLongSegments(sentences, maxWords = 5) {
    const result = [];
    (sentences || []).forEach((s, sIdx) => {
      let words = s.words;
      const sStart = Number(s.start ?? s.startTime ?? 0);
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));

      if (!words || words.length === 0) {
        words = this.createWordLevelTimestamps(s.text || '', sStart, sEnd, s.language || 'en');
      }

      const totalChars = words.reduce((acc, w) => acc + (w.word ? w.word.length : 0), 0);

      // Keep short phrases together so the transcriber timing is not over-fragmented.
      if (words.length <= maxWords || totalChars <= 24) {
        result.push({
          ...s,
          start: parseFloat(sStart.toFixed(2)),
          end: parseFloat(sEnd.toFixed(2)),
          startTime: parseFloat(sStart.toFixed(2)),
          endTime: parseFloat(sEnd.toFixed(2)),
          text: (s.text || words.map(w => w.word).join(' ')).trim(),
          words
        });
        return;
      }

      // Break longer phrases into balanced 2-row segments
      const targetChunkSize = 3;
      const numChunks = Math.ceil(words.length / targetChunkSize);
      const chunkSize = Math.ceil(words.length / numChunks);

      for (let i = 0; i < words.length; i += chunkSize) {
        const chunkWords = words.slice(i, i + chunkSize);
        if (chunkWords.length === 0) continue;

        const cStart = Number(chunkWords[0].start ?? chunkWords[0].startTime ?? sStart);
        const cEnd = Number(chunkWords[chunkWords.length - 1].end ?? chunkWords[chunkWords.length - 1].endTime ?? sEnd);
        const cText = chunkWords.map(w => w.word).join(' ');

        result.push({
          id: `${s.id || 'seg'}_sub_${result.length + 1}`,
          language: s.language || 'en',
          start: parseFloat(cStart.toFixed(2)),
          end: parseFloat(cEnd.toFixed(2)),
          startTime: parseFloat(cStart.toFixed(2)),
          endTime: parseFloat(cEnd.toFixed(2)),
          text: cText,
          words: chunkWords,
          posX: s.posX !== undefined ? s.posX : (s.x !== undefined ? s.x : 6),
          posY: s.posY !== undefined ? s.posY : (s.y !== undefined ? s.y : 50),
          boxWidth: s.boxWidth || s.width || null,
          behind: !!s.behind,
          fontSize: s.fontSize,
          fontFamily: s.fontFamily,
          textColor: s.textColor,
          prominentColor: s.prominentColor,
          strokeEnabled: s.strokeEnabled,
          strokeColor: s.strokeColor,
          glowColor: s.glowColor,
          animation: s.animation
        });
      }
    });

    result.forEach((item, idx) => {
      item.id = `sentence_${idx + 1}`;
    });

    return result;
  }

  setSentences(sentences) {
    const normalized = (sentences || []).map((s, idx) => {
      let start = s.start !== undefined ? Number(s.start) : (s.startTime !== undefined ? Number(s.startTime) : idx * 3);
      let end = s.end !== undefined ? Number(s.end) : (s.endTime !== undefined ? Number(s.endTime) : start + 3);
      if (end <= start) {
        end = start + Math.max(2.2, ((s.words && s.words.length) || 4) * 0.5);
      }
      const words = (s.words && s.words.length > 0)
        ? s.words.map((w, wIdx) => {
            let wStart = w.start !== undefined ? Number(w.start) : (w.startTime !== undefined ? Number(w.startTime) : start + (wIdx * (end - start) / s.words.length));
            let wEnd = w.end !== undefined ? Number(w.end) : (w.endTime !== undefined ? Number(w.endTime) : start + ((wIdx + 1) * (end - start) / s.words.length));
            if (wEnd <= wStart) wEnd = wStart + 0.35;
            return {
              ...w,
              start: parseFloat(wStart.toFixed(2)),
              end: parseFloat(wEnd.toFixed(2)),
              startTime: parseFloat(wStart.toFixed(2)),
              endTime: parseFloat(wEnd.toFixed(2))
            };
          })
        : this.createWordLevelTimestamps(s.text || '', start, end, s.language || 'en');

      return {
        ...s,
        id: s.id || `sentence_${idx + 1}`,
        start: parseFloat(start.toFixed(2)),
        end: parseFloat(end.toFixed(2)),
        startTime: parseFloat(start.toFixed(2)),
        endTime: parseFloat(end.toFixed(2)),
        words,
        posX: s.posX !== undefined ? s.posX : (s.x !== undefined ? s.x : 6),
        posY: s.posY !== undefined ? s.posY : (s.y !== undefined ? s.y : 50),
        boxWidth: s.boxWidth || s.width || null,
        behind: !!s.behind,
        fontSize: s.fontSize,
        fontFamily: s.fontFamily,
        textColor: s.textColor,
        prominentColor: s.prominentColor,
        strokeEnabled: s.strokeEnabled,
        strokeColor: s.strokeColor,
        glowColor: s.glowColor,
        animation: s.animation
      };
    });

    // Consolidate fragmented PM / AM orphan tokens and time ranges
    const consolidated = this.consolidateTimeAndOrphanSegments(normalized);

    // Automatically format segments so no segment creates a 3rd row while preserving "3 to 6 PM"
    this.sentences = this.splitLongSegments(consolidated, 5);
    this.sentences.sort((a, b) => a.start - b.start);
  }

  updateSentenceText(sentenceId, newText) {
    const s = this.sentences.find(item => item.id === sentenceId);
    if (!s) return;
    s.text = newText;
    s.words = this.createWordLevelTimestamps(newText, s.startTime, s.endTime, s.language);
  }

  updateWordText(sentenceId, wordIdx, newWord) {
    const s = this.sentences.find(item => item.id === sentenceId);
    if (!s || !s.words[wordIdx]) return;
    s.words[wordIdx].word = newWord;
    s.text = s.words.map(w => w.word).join(' ');
  }

  deleteSentence(sentenceId) {
    this.sentences = this.sentences.filter(s => s.id !== sentenceId);
  }

  addSentence(startTime, endTime, text, language = 'en') {
    let start = parseFloat(Number(startTime).toFixed(2));
    let end = parseFloat(Number(endTime).toFixed(2));
    if (end <= start) {
      end = start + 3.0;
    }
    const newId = `sentence_${Date.now()}`;
    const words = this.createWordLevelTimestamps(text, start, end, language);
    this.sentences.push({
      id: newId,
      startTime: start,
      endTime: end,
      text,
      language,
      words
    });
    this.sentences.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Build progressive word timestamps for custom user-entered or speech-transcribed text
   */
  createWordLevelTimestamps(text, startTime, endTime, language = 'en') {
    const rawWords = (text || '').trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return [];

    let duration = endTime - startTime;
    if (duration <= 0.2) {
      duration = Math.max(2.0, rawWords.length * 0.45);
      endTime = startTime + duration;
    }
    const wordDuration = duration / rawWords.length;

    const words = rawWords.map((word, idx) => {
      const wStart = startTime + idx * wordDuration;
      const wEnd = startTime + (idx + 1) * wordDuration;
      return {
        word,
        start: parseFloat(wStart.toFixed(2)),
        end: parseFloat(wEnd.toFixed(2))
      };
    });

    return words;
  }

  /**
   * Get active sentence and active words at a given playback time (in seconds).
   * Exact YouTube Caption behavior with graceful persistence:
   * - Never returns null if sentences exist (shows current or nearest preview).
   * - Maintains displayed caption across small speech pauses.
   */
  getActiveCaptionState(currentTime, config = {}) {
    if (!this.sentences || this.sentences.length === 0) {
      return null;
    }

    const t = Number(currentTime);

    // 1. Check exact match
    let activeSentence = this.sentences.find(s => t >= s.startTime && t <= s.endTime);

    // 2. Check graceful hold: if within 1.5s after a sentence ended before the next starts
    if (!activeSentence) {
      activeSentence = this.sentences.find(s => t >= s.startTime && t <= s.endTime + 1.5);
    }

    // 3. Fallback: If paused or seeking, pick closest sentence so video NEVER has empty screen
    if (!activeSentence) {
      if (t < this.sentences[0].startTime) {
        // At beginning of video before first speech: preview first sentence
        activeSentence = this.sentences[0];
      } else {
        // Pick most recent sentence that completed
        const past = this.sentences.filter(s => t >= s.endTime);
        activeSentence = past.length > 0 ? past[past.length - 1] : this.sentences[0];
      }
    }

    if (!activeSentence) {
      return null;
    }

    const { words } = activeSentence;
    let currentWordIndex = -1;
    
    // Find active word
    for (let i = 0; i < words.length; i++) {
      if (currentTime >= words[i].start && currentTime <= words[i].end) {
        currentWordIndex = i;
        break;
      } else if (currentTime > words[i].end) {
        currentWordIndex = i; // keep last spoken word active
      }
    }

    // Format words with progressive state
    const processedWords = words.map((w, idx) => {
      const isSpoken = currentTime >= w.start;
      const isCurrent = currentTime >= w.start && currentTime <= w.end;
      const isUpcoming = currentTime < w.start;

      // Determine color based on time interval configuration
      const activeColor = this.resolveColorForTime(w.start, config);

      return {
        word: config.uppercase ? w.word.toUpperCase() : w.word,
        start: w.start,
        end: w.end,
        isSpoken,
        isCurrent,
        isUpcoming,
        color: activeColor
      };
    });

    // YouTube style: words that haven't been spoken yet can be hidden or dimmed
    const visibleWords = config.progressiveDisplay
      ? processedWords.filter(w => w.isSpoken)
      : processedWords;

    return {
      sentenceId: activeSentence.id,
      language: activeSentence.language,
      startTime: activeSentence.startTime,
      endTime: activeSentence.endTime,
      fullText: activeSentence.text,
      words: processedWords,
      visibleWords: visibleWords.length > 0 ? visibleWords : [processedWords[0]], // show at least first word at start
      activeWordIndex: currentWordIndex,
      behind: !!activeSentence.behind,
      posX: activeSentence.posX !== undefined ? activeSentence.posX : 6,
      posY: activeSentence.posY !== undefined ? activeSentence.posY : 50,
      boxWidth: activeSentence.boxWidth || null
    };
  }

  /**
   * Resolves the configured color for a specific timestamp (Time Interval Colors)
   */
  resolveColorForTime(time, config = {}) {
    if (!config.timeIntervalColors || config.timeIntervalColors.length === 0) {
      return config.textColor || '#FFFFFF';
    }

    const interval = config.timeIntervalColors.find(
      int => time >= int.start && time < int.end
    );

    return interval ? interval.color : (config.textColor || '#FFFFFF');
  }

  /**
   * Convert sentences to SRT subtitle format
   */
  exportToSRT() {
    return this.sentences.map((s, idx) => {
      const formatTime = (sec) => {
        const d = new Date(sec * 1000);
        const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');
        const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
        return `${hh}:${mm}:${ss},${ms}`;
      };

      return `${idx + 1}\n${formatTime(s.startTime)} --> ${formatTime(s.endTime)}\n[${s.language.toUpperCase()}] ${s.text}\n`;
    }).join('\n');
  }

  /**
   * Convert sentences to VTT format
   */
  exportToVTT() {
    const srt = this.exportToSRT();
    return `WEBVTT - Zen AI Caption Studio\n\n` + srt.replace(/,/g, '.');
  }
}

export const captionEngine = new CaptionEngine();
