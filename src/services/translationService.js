// Real-Time Multi-Language Translation Service
// Translates Hindi, Urdu, Spanish, and 50+ languages into fluent, synchronized English captions.

import { languageIdentifier } from './languageIdentifier.js';

class TranslationService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Checks if text is already mostly standard English
   */
  isEnglishText(text) {
    if (!text || !text.trim()) return true;

    // Check for non-Latin alphabets (Devanagari, Arabic/Urdu, Cyrillic, CJK, etc.)
    if (/[\u0900-\u097F]/.test(text)) return false; // Hindi Devanagari
    if (/[\u0600-\u06FF]/.test(text)) return false; // Urdu / Arabic
    if (/[\u0400-\u04FF]/.test(text)) return false; // Russian Cyrillic
    if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(text)) return false; // Chinese/Japanese
    if (/[\uAC00-\uD7AF]/.test(text)) return false; // Korean

    // Common Romanized Urdu/Hindi keywords:
    const romanUrduHindi = /\b(kya|kyun|kaise|karo|karna|raha|rahi|rahe|hota|hoti|hote|mera|meri|mere|tera|teri|tere|aapka|aapki|aapke|humara|humari|shukriya|zaroor|accha|acha|bhai|dost|zindagi|pyaar|baat|yeh|woh|kuch|nahi|haan|hain|bhi|aur|lekin|magar|bohot|boht)\b/i;
    if (romanUrduHindi.test(text)) return false;

    // Common Spanish keywords (excluding common English words like 'video', 'como', 'bien'):
    const spanish = /\b(hola|gracias|amigo|por favor|buenos dias|buenas tardes|buenas noches|estamos|subtitulos|ahora pero|todos)\b/i;
    if (spanish.test(text) || /[áéíóúñ¿¡]/.test(text)) return false;

    return true;
  }

  /**
   * Translates a string of text into English.
   * Uses high-speed direct translation with offline fallback.
   */
  async translateText(text, sourceLang = 'auto') {
    const trimmed = (text || '').trim();
    if (!trimmed) return '';

    if (this.cache.has(trimmed)) {
      return this.cache.get(trimmed);
    }

    // Try Google Translate GTX public endpoint
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data[0] && Array.isArray(data[0])) {
          const translated = data[0].map(item => item[0]).filter(Boolean).join('').trim();
          if (translated) {
            this.cache.set(trimmed, translated);
            return translated;
          }
        }
      }
    } catch (err) {
      console.warn('Google Translate API fallback:', err.message);
    }

    // Secondary fallback: MyMemory Translation API
    try {
      const pair = sourceLang && sourceLang !== 'auto' ? `${sourceLang}|en` : 'autodetect|en';
      const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${pair}`;
      const mmRes = await fetch(mmUrl, { signal: AbortSignal.timeout(4000) });
      if (mmRes.ok) {
        const mmData = await mmRes.json();
        if (mmData && mmData.responseData && mmData.responseData.translatedText) {
          const translated = mmData.responseData.translatedText.trim();
          if (translated && !translated.includes('MYMEMORY WARNING')) {
            this.cache.set(trimmed, translated);
            return translated;
          }
        }
      }
    } catch (err) {
      console.warn('MyMemory Translate fallback:', err.message);
    }

    // Offline / Local Rule-based translation & transliteration for common Hindi/Urdu/Spanish terms
    const localTranslation = this.fallbackLocalTranslate(trimmed);
    this.cache.set(trimmed, localTranslation);
    return localTranslation;
  }

  /**
   * Translates a list of timed sentence blocks to English, preserving voice timestamps.
   */
  async translateSentencesToEnglish(sentences, onProgress = () => {}) {
    if (!sentences || sentences.length === 0) return [];

    const translatedSentences = [];
    const total = sentences.length;

    for (let i = 0; i < total; i++) {
      const s = sentences[i];
      const isEnglish = this.isEnglishText(s.text);

      onProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100)
      });

      if (isEnglish) {
        translatedSentences.push({
          ...s,
          originalLanguage: s.language || 'en',
          language: 'en'
        });
        continue;
      }

      const detectedLang = languageIdentifier.detectTextLanguage(s.text);
      const translatedText = await this.translateText(s.text, detectedLang);

      // Rebuild words array with synchronized timings
      const newWords = this.realignWords(translatedText, s.startTime, s.endTime);

      translatedSentences.push({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        originalText: s.text,
        originalLanguage: detectedLang,
        language: 'en',
        text: translatedText,
        words: newWords
      });
    }

    return translatedSentences;
  }

  /**
   * Redistributes words evenly across the sentence duration,
   * guaranteeing YouTube-style word-by-word streaming sync.
   */
  realignWords(translatedText, startTime, endTime) {
    const tokens = translatedText.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const totalDuration = Math.max(0.4, endTime - startTime);
    const durationPerWord = totalDuration / tokens.length;

    return tokens.map((token, idx) => {
      const wStart = parseFloat((startTime + idx * durationPerWord).toFixed(2));
      const wEnd = parseFloat((startTime + (idx + 1) * durationPerWord).toFixed(2));
      return {
        word: token,
        start: wStart,
        end: wEnd
      };
    });
  }

  /**
   * Local rule-based translation for common Urdu, Hindi, and Spanish phrases
   * used when internet connection is lost.
   */
  fallbackLocalTranslate(text) {
    const dictionary = {
      // Urdu / Hindi common phrases & words
      'namaste': 'hello',
      'kya': 'what',
      'hai': 'is',
      'hain': 'are',
      'kaise': 'how',
      'ho': 'are you',
      'aap': 'you',
      'tum': 'you',
      'hum': 'we',
      'mera': 'my',
      'meri': 'my',
      'naam': 'name',
      'bhai': 'brother',
      'dost': 'friend',
      'shukriya': 'thank you',
      'dhanyawad': 'thank you',
      'zaroor': 'certainly',
      'bohot': 'very',
      'acha': 'good',
      'accha': 'good',
      'haan': 'yes',
      'nahi': 'no',
      'kuch': 'something',
      'video': 'video',
      'dekhein': 'watch',
      'banao': 'create',

      // Spanish common phrases & words
      'hola': 'hello',
      'gracias': 'thank you',
      'amigo': 'friend',
      'amigos': 'friends',
      'por favor': 'please',
      'buenos dias': 'good morning',
      'buenas noches': 'good evening',
      'como estas': 'how are you',
      'muy bien': 'very good',
      'estamos': 'we are',
      'crear': 'create',
      'subtitulos': 'subtitles',
      'mundo': 'world',
      'todos': 'everyone'
    };

    let result = text;
    Object.keys(dictionary).forEach(key => {
      const reg = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(reg, dictionary[key]);
    });

    return result;
  }
}

export const translationService = new TranslationService();
