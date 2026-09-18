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
      // Segment 2: Spanish (14s - 26s)
      {
        lang: 'es',
        text: "Ahora cambiamos de idioma con detección multilingüe instantánea",
        start: 13.0,
        words: [
          { word: "Ahora", start: 13.0, end: 13.6 },
          { word: "cambiamos", start: 13.6, end: 14.3 },
          { word: "de", start: 14.3, end: 14.6 },
          { word: "idioma", start: 14.6, end: 15.2 },
          { word: "con", start: 15.2, end: 15.5 },
          { word: "detección", start: 15.5, end: 16.2 },
          { word: "multilingüe", start: 16.2, end: 17.1 },
          { word: "instantánea", start: 17.1, end: 18.0 }
        ]
      },
      {
        lang: 'es',
        text: "Subtítulos dinámicos con animación y colores personalizados",
        start: 19.2,
        words: [
          { word: "Subtítulos", start: 19.2, end: 20.0 },
          { word: "dinámicos", start: 20.0, end: 20.8 },
          { word: "con", start: 20.8, end: 21.1 },
          { word: "animación", start: 21.1, end: 22.0 },
          { word: "y", start: 22.0, end: 22.3 },
          { word: "colores", start: 22.3, end: 23.0 },
          { word: "personalizados", start: 23.0, end: 24.2 }
        ]
      },
      // Segment 3: Hindi (27s - 42s)
      {
        lang: 'hi',
        text: "यह सिस्टम पूरी तरह से ऑफ़लाइन काम करता है",
        start: 26.5,
        words: [
          { word: "यह", start: 26.5, end: 27.0 },
          { word: "सिस्टम", start: 27.0, end: 27.7 },
          { word: "पूरी", start: 27.7, end: 28.2 },
          { word: "तरह", start: 28.2, end: 28.7 },
          { word: "से", start: 28.7, end: 29.1 },
          { word: "ऑफ़लाइन", start: 29.1, end: 29.9 },
          { word: "काम", start: 29.9, end: 30.4 },
          { word: "करता", start: 30.4, end: 30.9 },
          { word: "है", start: 30.9, end: 31.5 }
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
