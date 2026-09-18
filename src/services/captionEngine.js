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

  setSentences(sentences) {
    this.sentences = sentences || [];
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
    const newId = `sentence_${Date.now()}`;
    const words = this.createWordLevelTimestamps(text, startTime, endTime, language);
    this.sentences.push({
      id: newId,
      startTime,
      endTime,
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
    const rawWords = text.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return [];

    const duration = Math.max(0.5, endTime - startTime);
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
   * Exact YouTube Caption behavior:
   * - Shows current sentence.
   * - Indicates which words have been spoken so far (visible: true),
   *   which word is actively being spoken right now (isCurrent: true),
   *   and which words are upcoming (visible: false or dimmer depending on style).
   */
  getActiveCaptionState(currentTime, config = {}) {
    if (!this.sentences || this.sentences.length === 0) {
      return null;
    }

    // Find sentence active at currentTime (or with a small lead-in)
    const activeSentence = this.sentences.find(s => currentTime >= s.startTime && currentTime <= s.endTime);

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
      activeWordIndex: currentWordIndex
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
