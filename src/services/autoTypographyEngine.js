import { FONTS } from '../config.js';

// Auto AI Enterprise Dynamic Typography & Word-Importance Engine
// Recreates viral Instagram Reels & TikTok high-fashion dynamic captions (as in "this is Emily" and "for September")
// Automatically classifies word prominence (Brand: Zen AI, Dates: September, Names: Emily, Impact: performance)
// and handles adaptive light/dark background contrast with solid black strokes.

export class AutoTypographyEngine {
  constructor() {
    this.brandRegex = /\b(Zen(\s+AI)?|Z\.E\.N\.|AI(\s+Engine)?|Engine|Mobile|Portal|App|Studio)\b/i;
    this.monthsDatesRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Today|Tomorrow|Tonight|Weekend|2024|2025|2026|2027|\d{1,2}(st|nd|rd|th))\b/i;
    this.placesRegex = /\b(California|New York|London|Paris|Dubai|Miami|Tokyo|Los Angeles|LA|Beach|City|Studio|Home|Office|World|Earth|Hotel|Resort|Club|Party|Stage|Island|Coast|Station)\b/i;
    this.impactWordsRegex = /\b(performance|dream|future|power|secret|luxury|fashion|creator|model|champion|winner|magic|success|money|love|life|viral|breakthrough|speed|revolution|exclusive)\b/i;
    this.connectorsRegex = /^(this is|that is|it is|this was|for an|for the|for a|for|in the|at the|on the|welcome to|meet|here is|here are|we are|they are|look at|check out|with the|about the|and the|into the|out of|come to)\b/i;
  }

  getFontFamilyString(fontId, fallback) {
    if (!fontId) return fallback;
    const found = FONTS.find(f => f.id.toLowerCase() === fontId.toLowerCase() || f.name.toLowerCase().includes(fontId.toLowerCase()));
    return found ? found.family : fallback;
  }

  /**
   * Analyzes a caption sentence and produces word-by-word importance hierarchy
   * and styling tailored to video background luminance and active config.
   */
  analyzeSentence(sentence, isLightBackground = false, config = null) {
    if (!sentence) {
      return this.createFallbackAnalysis('', isLightBackground, config);
    }

    const rawText = (typeof sentence === 'string' ? sentence : (sentence.text || sentence.fullText || '')).trim();
    if (!rawText) {
      return this.createFallbackAnalysis('', isLightBackground, config);
    }

    const rawWords = sentence.words && sentence.words.length > 0
      ? sentence.words
      : rawText.split(/\s+/).filter(Boolean).map((w, i) => ({
          word: w,
          start: sentence.startTime || 0,
          end: sentence.endTime || 2
        }));

    // 1. Check for whole-sentence two-tier prefix (e.g. "this is Emily", "for September")
    const matchConnector = rawText.match(this.connectorsRegex);
    let prefixWordCount = 0;
    if (matchConnector) {
      prefixWordCount = matchConnector[0].trim().split(/\s+/).length;
    }

    // 2. Classify each word
    const analyzedWords = rawWords.map((item, idx) => {
      const cleanWord = (item.word || '').replace(/[.,!?:;"'()]/g, '');
      const isPrefixConnector = idx < prefixWordCount;

      let category = 'normal';
      let importance = 10;

      // Brand / AI Tool recognition (Highest Priority: Zen AI Engine)
      if (this.brandRegex.test(cleanWord) || /^(Zen|AI|Engine)$/i.test(cleanWord)) {
        category = 'brand';
        importance = 100;
      }
      // Month / Date recognition (Reference Image 2: "September")
      else if (this.monthsDatesRegex.test(cleanWord)) {
        category = 'date';
        importance = 90;
      }
      // Name recognition (Reference Image 1: "Emily")
      else if (/^[A-Z][a-z]{2,}$/.test(cleanWord) && !/^(The|This|That|Here|What|When|Where|Why|How|You|They|With|From|And)$/i.test(cleanWord)) {
        category = 'name';
        importance = 85;
      }
      // Place recognition
      else if (this.placesRegex.test(cleanWord)) {
        category = 'place';
        importance = 80;
      }
      // High-impact action word (e.g. "performance", "dream")
      else if (this.impactWordsRegex.test(cleanWord)) {
        category = 'impact';
        importance = 75;
      }

      const isProminent = category !== 'normal';

      // Determine styling based on category, background luminance, and user config
      const style = this.getStyleForWord(category, cleanWord, isPrefixConnector, isLightBackground, config);

      return {
        ...item,
        cleanWord,
        category,
        importance,
        isProminent,
        isPrefixConnector,
        ...style
      };
    });

    // Determine sentence-level primary entity
    const highestEntity = [...analyzedWords].sort((a, b) => b.importance - a.importance)[0];
    const primaryCategory = (highestEntity && highestEntity.importance > 50) ? highestEntity.category : 'general';

    return {
      text: rawText,
      category: primaryCategory,
      words: analyzedWords,
      isLightBackground,
      startTime: sentence.startTime || 0,
      endTime: sentence.endTime || 2
    };
  }

  getStyleForWord(category, wordText, isPrefixConnector, isLightBackground, config = null) {
    const isProminent = category !== 'normal';

    // Normal word font and stroke
    const normalFontFamily = this.getFontFamilyString(
      config?.normalFontFamily || config?.fontFamily,
      "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    );
    const normalStrokeWidth = config?.normalOutlineWidth !== undefined
      ? config.normalOutlineWidth
      : (isLightBackground ? 2.5 : 1.2);
    const normalStrokeColor = config?.normalOutlineColor || '#000000';
    const normalOutlineStroke = `${normalStrokeWidth}px ${normalStrokeColor}`;

    // Prominent word font and stroke
    const defaultProminentFontId = category === 'name' ? 'PlayfairDisplay' : (category === 'date' ? 'Righteous' : 'Syne');
    const prominentFontFamily = this.getFontFamilyString(
      config?.prominentFontFamily,
      this.getFontFamilyString(defaultProminentFontId, "'Playfair Display', Georgia, serif")
    );
    const prominentStrokeWidth = config?.prominentOutlineWidth !== undefined
      ? config.prominentOutlineWidth
      : (isLightBackground ? 3.0 : 2.0);
    const prominentStrokeColor = config?.prominentOutlineColor || '#000000';
    const prominentOutlineStroke = `${prominentStrokeWidth}px ${prominentStrokeColor}`;

    const darkShadow = isLightBackground
      ? '0 2px 10px rgba(0,0,0,0.95), 0 0 2px #000000'
      : '0 4px 16px rgba(0,0,0,0.9)';

    // 1. BRAND ENTITIES: Zen, Zen AI, AI, Engine
    if (category === 'brand') {
      const color = config?.prominentColor || '#00F0FF';
      return {
        color,
        fontFamily: prominentFontFamily,
        fontSizeMultiplier: 1.35,
        fontStyle: 'normal',
        fontWeight: '900',
        letterSpacing: '0px',
        shadow: isLightBackground 
          ? `0 0 14px ${color}, 0 2px 8px #000000` 
          : `0 0 22px ${color}, 0 6px 24px rgba(0, 0, 0, 0.95)`,
        stroke: prominentOutlineStroke,
        tag: 'Brand'
      };
    }

    // 2. MONTHS & DATES: September (Reference Image 2: Glowing Neon Pink / Magenta / User Color)
    if (category === 'date') {
      const color = config?.prominentColor || '#FF4DA6';
      return {
        color,
        fontFamily: prominentFontFamily,
        fontSizeMultiplier: 1.55,
        fontStyle: 'normal',
        fontWeight: '900',
        letterSpacing: '-0.5px',
        shadow: isLightBackground
          ? `0 0 16px ${color}, 0 2px 8px #000000`
          : `0 0 25px ${color}, 0 8px 30px rgba(0, 0, 0, 0.95)`,
        stroke: prominentOutlineStroke,
        tag: 'Date'
      };
    }

    // 3. NAMES: Emily (Reference Image 1: Luxury Editorial Serif)
    if (category === 'name') {
      // If user specified a prominent color, honor it; else default to elegant pure white
      const color = config?.prominentColor || '#FFFFFF';
      return {
        color,
        fontFamily: prominentFontFamily,
        fontSizeMultiplier: 1.6,
        fontStyle: 'italic',
        fontWeight: '900',
        letterSpacing: '-0.5px',
        shadow: isLightBackground
          ? '0 2px 10px #000000, 0 0 10px rgba(255,255,255,0.4)'
          : '0 6px 30px rgba(0, 0, 0, 0.95), 0 0 18px rgba(255, 255, 255, 0.35)',
        stroke: prominentOutlineStroke,
        tag: 'Name'
      };
    }

    // 4. PLACES: California
    if (category === 'place') {
      const color = config?.prominentColor || '#00F0FF';
      return {
        color,
        fontFamily: prominentFontFamily,
        fontSizeMultiplier: 1.45,
        fontStyle: 'italic',
        fontWeight: '900',
        letterSpacing: '0px',
        shadow: isLightBackground
          ? `0 0 14px ${color}, 0 2px 8px #000000`
          : `0 0 22px ${color}, 0 6px 24px rgba(0, 0, 0, 0.9)`,
        stroke: prominentOutlineStroke,
        tag: 'Place'
      };
    }

    // 5. HIGH-IMPACT WORDS: performance, dream, power
    if (category === 'impact') {
      const color = config?.prominentColor || '#FFE600';
      return {
        color,
        fontFamily: prominentFontFamily,
        fontSizeMultiplier: 1.25,
        fontStyle: 'normal',
        fontWeight: '900',
        letterSpacing: '0px',
        shadow: isLightBackground
          ? `0 0 14px ${color}, 0 2px 8px #000000`
          : `0 0 20px ${color}, 0 6px 24px rgba(0, 0, 0, 0.9)`,
        stroke: prominentOutlineStroke,
        tag: 'Impact'
      };
    }

    // 6. NORMAL CONNECTOR PREFIX (e.g. "this is", "for")
    if (isPrefixConnector) {
      return {
        color: config?.textColor || 'rgba(255, 255, 255, 0.92)',
        fontFamily: normalFontFamily,
        fontSizeMultiplier: 0.85,
        fontStyle: 'italic',
        fontWeight: '600',
        letterSpacing: '0.4px',
        shadow: darkShadow,
        stroke: normalOutlineStroke,
        tag: 'Prefix'
      };
    }

    // 7. NORMAL WORDS: The, you, see, is, the, result, of
    return {
      color: config?.textColor || '#FFFFFF',
      fontFamily: normalFontFamily,
      fontSizeMultiplier: 1.0,
      fontStyle: 'normal',
      fontWeight: '800',
      letterSpacing: '0px',
      shadow: darkShadow,
      stroke: normalOutlineStroke,
      tag: 'Normal'
    };
  }

  createFallbackAnalysis(rawText, isLightBackground, config = null) {
    const words = (rawText || '').split(/\s+/).filter(Boolean);
    return {
      text: rawText,
      category: 'general',
      words: words.map(w => ({
        word: w,
        start: 0,
        end: 2,
        cleanWord: w,
        category: 'normal',
        isProminent: false,
        isPrefixConnector: false,
        ...this.getStyleForWord('normal', w, false, isLightBackground, config)
      })),
      isLightBackground,
      startTime: 0,
      endTime: 2
    };
  }
}

export const autoTypographyEngine = new AutoTypographyEngine();
