// Auto AI Dynamic Typography & Entity Analysis Engine
// Recreates viral Instagram Reels & TikTok high-fashion dynamic captions (as in "this is Emily" and "for September")

export class AutoTypographyEngine {
  constructor() {
    this.monthsDatesRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Today|Tomorrow|Tonight|Weekend|2024|2025|2026|2027|\d{1,2}(st|nd|rd|th))\b/i;
    this.placesRegex = /\b(California|New York|London|Paris|Dubai|Miami|Tokyo|Los Angeles|LA|Beach|City|Studio|Home|Office|World|Earth|Hotel|Resort|Club|Party|Stage|Island|Coast|Station)\b/i;
    this.keyItemsRegex = /\b(Event|Love|Life|Money|Future|Dream|Secret|Business|Success|Power|Style|Fashion|Luxury|Realtor|Creator|Model|Champion|Winner|Music|Song|Drop|Release|Show|Story|Beauty|Launch|Project|Magic)\b/i;
    this.connectorsRegex = /^(this is|that is|it is|this was|for an|for the|for a|for|in the|at the|on the|welcome to|meet|here is|here are|we are|they are|look at|check out|with the|about the|and the|into the|out of|come to)\b/i;
  }

  /**
   * Analyzes a caption sentence and decomposes it into high-impact dynamic hierarchy:
   * 1. Prefix line: subtle, small, elegant italic/sans (e.g. "this is", "for")
   * 2. Hero line: massive, high-fashion display/editorial font (e.g. "Emily", "September")
   */
  analyzeSentence(sentence) {
    if (!sentence || !sentence.text) {
      return this.createFallbackAnalysis(sentence ? sentence.text : '');
    }

    const words = sentence.words && sentence.words.length > 0
      ? sentence.words
      : (sentence.text || '').trim().split(/\s+/).map((w, i) => ({
          word: w,
          start: sentence.startTime || 0,
          end: sentence.endTime || 2
        }));

    const text = sentence.text.trim();
    const tokenStrings = words.map(w => w.word);

    // 1. Detect if the text starts with a known connecting phrase
    const matchConnector = text.match(this.connectorsRegex);
    let splitIndex = -1;
    let detectedCategory = 'general';

    if (matchConnector) {
      const connLen = matchConnector[0].trim().split(/\s+/).length;
      splitIndex = Math.min(connLen, words.length - 1);
    }

    // 2. Check for Entity in the tokens (Month, Place, Key Item, or Capitalized Name)
    for (let i = 0; i < tokenStrings.length; i++) {
      const rawWord = tokenStrings[i].replace(/[.,!?:;"'()]/g, '');

      if (this.monthsDatesRegex.test(rawWord)) {
        detectedCategory = 'date';
        if (splitIndex === -1 || splitIndex > i) splitIndex = Math.max(1, i);
        break;
      } else if (this.placesRegex.test(rawWord)) {
        detectedCategory = 'place';
        if (splitIndex === -1 || splitIndex > i) splitIndex = Math.max(1, i);
        break;
      } else if (this.keyItemsRegex.test(rawWord)) {
        detectedCategory = 'item';
        if (splitIndex === -1 || splitIndex > i) splitIndex = Math.max(1, i);
        break;
      } else if (i > 0 && /^[A-Z][a-z]{2,}$/.test(rawWord)) {
        // Proper noun / Name (e.g. "Emily")
        detectedCategory = 'name';
        if (splitIndex === -1 || splitIndex > i) splitIndex = Math.max(1, i);
        break;
      }
    }

    // If no split determined yet: split roughly first 30-40% as prefix, remainder as hero
    if (splitIndex <= 0 || splitIndex >= words.length) {
      if (words.length <= 2) {
        splitIndex = Math.max(1, words.length - 1);
      } else {
        splitIndex = Math.max(1, Math.floor(words.length * 0.45));
      }
    }

    const prefixWords = words.slice(0, splitIndex);
    const heroWords = words.slice(splitIndex);

    const prefixText = prefixWords.map(w => w.word).join(' ');
    const heroText = heroWords.map(w => w.word).join(' ');

    // 3. Select Theme & Font Pairing
    const theme = this.getThemeForCategory(detectedCategory, heroText);

    return {
      hasHierarchy: true,
      category: detectedCategory,
      prefixText,
      prefixWords,
      heroText,
      heroWords,
      theme,
      startTime: sentence.startTime || 0,
      endTime: sentence.endTime || 2
    };
  }

  getThemeForCategory(category, heroText = '') {
    // Exact match for user reference image 2 ("for September"):
    if (category === 'date') {
      return {
        prefixFontFamily: "'Playfair Display', Georgia, serif",
        prefixFontSizeMultiplier: 0.72,
        prefixItalic: true,
        prefixFontWeight: '700',
        prefixColor: '#FFFFFF',
        prefixTransform: 'none',

        // Vibrant Neon Magenta / Pink Focus
        heroFontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        heroFontSizeMultiplier: 2.45,
        heroItalic: false,
        heroFontWeight: '900',
        heroColor: '#FF4DA6',
        heroShadow: '0 0 25px rgba(255, 77, 166, 0.65), 0 8px 32px rgba(0, 0, 0, 0.95)',
        heroTransform: 'none',
        heroLetterSpacing: '-1px'
      };
    }

    // Places / Locations (e.g. "California", "Dubai"):
    if (category === 'place') {
      return {
        prefixFontFamily: "'Inter', sans-serif",
        prefixFontSizeMultiplier: 0.64,
        prefixItalic: true,
        prefixFontWeight: '600',
        prefixColor: 'rgba(255, 255, 255, 0.92)',
        prefixTransform: 'none',

        heroFontFamily: "'Playfair Display', Georgia, serif",
        heroFontSizeMultiplier: 2.25,
        heroItalic: true,
        heroFontWeight: '900',
        heroColor: '#00F0FF',
        heroShadow: '0 0 25px rgba(0, 240, 255, 0.6), 0 8px 30px rgba(0, 0, 0, 0.9)',
        heroTransform: 'none',
        heroLetterSpacing: '0px'
      };
    }

    // High Impact Items / Action verbs
    if (category === 'item') {
      return {
        prefixFontFamily: "'Inter', sans-serif",
        prefixFontSizeMultiplier: 0.65,
        prefixItalic: true,
        prefixFontWeight: '600',
        prefixColor: '#FFFFFF',
        prefixTransform: 'none',

        heroFontFamily: "'Playfair Display', Georgia, serif",
        heroFontSizeMultiplier: 2.2,
        heroItalic: true,
        heroFontWeight: '900',
        heroColor: '#FFE600',
        heroShadow: '0 0 25px rgba(255, 230, 0, 0.55), 0 8px 30px rgba(0, 0, 0, 0.9)',
        heroTransform: 'none',
        heroLetterSpacing: '-0.5px'
      };
    }

    // Exact match for user reference image 1 ("this is Emily"):
    if (category === 'name' || /^[A-Z][a-z]+$/.test(heroText.trim())) {
      return {
        prefixFontFamily: "'Inter', -apple-system, sans-serif",
        prefixFontSizeMultiplier: 0.62,
        prefixItalic: true,
        prefixFontWeight: '600',
        prefixColor: 'rgba(255, 255, 255, 0.95)',
        prefixTransform: 'none',

        // Luxury Editorial Serif
        heroFontFamily: "'Playfair Display', Georgia, serif",
        heroFontSizeMultiplier: 2.35,
        heroItalic: true,
        heroFontWeight: '900',
        heroColor: '#FFFFFF',
        heroShadow: '0 6px 30px rgba(0, 0, 0, 0.9), 0 0 15px rgba(255, 255, 255, 0.35)',
        heroTransform: 'none',
        heroLetterSpacing: '-0.5px'
      };
    }

    // Places / Locations (e.g. "California", "Dubai"):
    if (category === 'place') {
      return {
        prefixFontFamily: "'Inter', sans-serif",
        prefixFontSizeMultiplier: 0.64,
        prefixItalic: true,
        prefixFontWeight: '600',
        prefixColor: 'rgba(255, 255, 255, 0.92)',
        prefixTransform: 'none',

        heroFontFamily: "'Playfair Display', Georgia, serif",
        heroFontSizeMultiplier: 2.25,
        heroItalic: true,
        heroFontWeight: '900',
        heroColor: '#00F0FF',
        heroShadow: '0 0 25px rgba(0, 240, 255, 0.6), 0 8px 30px rgba(0, 0, 0, 0.9)',
        heroTransform: 'none',
        heroLetterSpacing: '0px'
      };
    }

    // High Impact Items / Action verbs
    if (category === 'item') {
      return {
        prefixFontFamily: "'Inter', sans-serif",
        prefixFontSizeMultiplier: 0.65,
        prefixItalic: true,
        prefixFontWeight: '600',
        prefixColor: '#FFFFFF',
        prefixTransform: 'none',

        heroFontFamily: "'Playfair Display', Georgia, serif",
        heroFontSizeMultiplier: 2.2,
        heroItalic: true,
        heroFontWeight: '900',
        heroColor: '#FFE600',
        heroShadow: '0 0 25px rgba(255, 230, 0, 0.55), 0 8px 30px rgba(0, 0, 0, 0.9)',
        heroTransform: 'none',
        heroLetterSpacing: '-0.5px'
      };
    }

    // General default high-aesthetic pairing
    return {
      prefixFontFamily: "'Inter', sans-serif",
      prefixFontSizeMultiplier: 0.65,
      prefixItalic: true,
      prefixFontWeight: '600',
      prefixColor: 'rgba(255, 255, 255, 0.95)',
      prefixTransform: 'none',

      heroFontFamily: "'Playfair Display', Georgia, serif",
      heroFontSizeMultiplier: 2.2,
      heroItalic: true,
      heroFontWeight: '900',
      heroColor: '#FFFFFF',
      heroShadow: '0 6px 28px rgba(0, 0, 0, 0.95), 0 0 15px rgba(255, 255, 255, 0.25)',
      heroTransform: 'none',
      heroLetterSpacing: '-0.5px'
    };
  }

  createFallbackAnalysis(rawText) {
    return {
      hasHierarchy: false,
      category: 'general',
      prefixText: '',
      prefixWords: [],
      heroText: rawText || '',
      heroWords: [],
      theme: this.getThemeForCategory('general', rawText),
      startTime: 0,
      endTime: 2
    };
  }
}

export const autoTypographyEngine = new AutoTypographyEngine();
