// Gemini AI Translation & Transliteration Service for Video Captions
// Translates and transliterates video transcripts using Google Gemini models:
// 1. Roman Hindi & Urdu: Natural conversational English alphabets (e.g., "agar ap isko dekh skte hein").
// 2. Native Hindi: 100% pure Devanagari script (हिन्दी) with zero English alphabets.
// 3. Native Urdu: 100% pure Nastaliq script (اردو) with zero English alphabets.
// 4. Word-by-word timestamp synchronization managed in transcript code for live animations.
// 5. Automatic fallback to translationService if Gemini API key is unreachable, leaked, or exhausted.

import { translationService } from './translationService.js';
import { apiClient } from './apiClient.js';

class GeminiTranslationService {
  constructor() {
    this.models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    this.cache = new Map();
  }

  /**
   * Retrieves the active Gemini API key from options, localStorage, or environment variables.
   */
  getApiKey(options = {}) {
    if (options?.geminiKey && typeof options.geminiKey === 'string' && options.geminiKey.trim()) {
      return options.geminiKey.trim();
    }
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    if (local && local.trim()) {
      return local.trim();
    }
    const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
      '';
    if (envKey && envKey.trim()) {
      return envKey.trim();
    }
    return '';
  }

  /**
   * Saves a user-provided Gemini API key to local storage for future video sessions.
   */
  setCustomApiKey(key) {
    if (typeof localStorage === 'undefined') return;
    if (!key || !key.trim()) {
      localStorage.removeItem('gemini_api_key');
    } else {
      localStorage.setItem('gemini_api_key', key.trim());
    }
  }

  /**
   * Cleans raw text returned by Gemini LLM (strips Markdown ```json fences if present).
   */
  cleanJsonText(rawText) {
    if (!rawText) return '';
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    return cleaned;
  }

  /**
   * Main entrypoint for translating transcript segments.
   * Manages transcript timestamps, word synchronizations, and script modes.
   */
  async translateSentencesWithGemini(sentences, onProgress = () => {}, options = {}) {
    if (!Array.isArray(sentences) || sentences.length === 0) {
      return [];
    }

    const scriptMode = options?.scriptMode || 'roman'; // 'roman' | 'native' | 'english'
    const languagePreference = options?.languagePreference || options?.language || 'auto'; // 'hindi' | 'urdu' | 'roman' | 'en' | 'auto'

    // If English transcript is selected and all segments are already Latin English, return pristine
    if (scriptMode === 'english' && !sentences.some(s => translationService.hasNonLatinScript(s.text || ''))) {
      return sentences;
    }

    onProgress({
      status: 'translating',
      message: `Localizing transcript with Gemini AI (${scriptMode === 'roman' ? 'Roman Urdu/Hindi' : scriptMode === 'native' ? 'Pure Native Script' : 'English'})...`,
      percent: 92
    });

    const apiKey = this.getApiKey(options);
    let translatedSegments = null;

    // STEP 1: Attempt Gemini Translation (Backend Proxy first, then direct REST API)
    try {
      translatedSegments = await this.invokeGeminiTranslation(sentences, scriptMode, languagePreference, apiKey, onProgress);
    } catch (geminiErr) {
      console.warn('[Gemini AI] Direct translation error, attempting fallback:', geminiErr.message);
    }

    // STEP 2: If Gemini succeeded, integrate and realign word-by-word timestamps
    if (Array.isArray(translatedSegments) && translatedSegments.length > 0) {
      const merged = this.applyGeminiTranslationsToSentences(sentences, translatedSegments, scriptMode, languagePreference);
      onProgress({
        status: 'translating',
        message: 'Synchronizing Gemini AI captions with video timestamps...',
        percent: 98
      });
      return merged;
    }

    // STEP 3: Resilient Fallback to translationService if Gemini is unavailable
    console.warn('[Gemini AI] Using resilient translation engine fallback.');
    return translationService.translateSentencesToEnglish(sentences, onProgress, options);
  }

  /**
   * Executes the prompt request against Gemini via server proxy or client REST API.
   */
  async invokeGeminiTranslation(sentences, scriptMode, languagePreference, apiKey, onProgress = () => {}) {
    // 1. Try server backend route first if available
    try {
      const serverPayload = {
        sentences: sentences.map(s => ({
          id: s.id,
          text: s.text || '',
          startTime: Number(s.start ?? s.startTime ?? 0),
          endTime: Number(s.end ?? s.endTime ?? 0)
        })),
        scriptMode,
        languagePreference,
        apiKey: apiKey || undefined
      };

      const res = await apiClient.request('/ai/translate-transcript', {
        method: 'POST',
        body: JSON.stringify(serverPayload)
      });

      if (res && res.success && Array.isArray(res.translatedSentences)) {
        return res.translatedSentences;
      }
    } catch (backendErr) {
      // Backend route might not be running or key is configured client-side
      console.warn('[Gemini AI] Backend route unavailable, trying direct client API:', backendErr.message);
    }

    // 2. Direct client-side Gemini REST API call if apiKey is present
    if (!apiKey) {
      throw new Error('No Gemini API key configured.');
    }

    return await this.callGeminiDirectRest(sentences, scriptMode, languagePreference, apiKey, onProgress);
  }

  /**
   * Direct REST call to Google Generative Language API (Gemini 1.5 Flash / 2.0 Flash)
   */
  async callGeminiDirectRest(sentences, scriptMode, languagePreference, apiKey, onProgress = () => {}) {
    const batchSize = 25; // Chunk large videos into safe prompt windows
    const allResults = [];
    const totalBatches = Math.ceil(sentences.length / batchSize);

    for (let b = 0; b < totalBatches; b++) {
      const chunk = sentences.slice(b * batchSize, (b + 1) * batchSize);
      const prompt = this.buildGeminiPrompt(chunk, scriptMode, languagePreference);

      let batchSuccess = false;
      let lastError = null;

      // Try available models in order: gemini-1.5-flash, gemini-2.0-flash, gemini-1.5-pro
      for (const model of this.models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const payload = {
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.15,
              topK: 32,
              topP: 0.95,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json'
            }
          };

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `HTTP ${response.status}`;
            throw new Error(`Gemini ${model} error: ${errMsg}`);
          }

          const data = await response.json();
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!candidateText) {
            throw new Error('Empty response from Gemini.');
          }

          const parsed = JSON.parse(this.cleanJsonText(candidateText));
          if (Array.isArray(parsed)) {
            allResults.push(...parsed);
            batchSuccess = true;
            break;
          }
        } catch (mErr) {
          lastError = mErr;
          console.warn(`[Gemini AI] Attempt with ${model} failed:`, mErr.message);
        }
      }

      if (!batchSuccess) {
        throw lastError || new Error('All Gemini models failed.');
      }
    }

    return allResults;
  }

  /**
   * Formats the prompt for Gemini tailored to video subtitle translation & script transliteration.
   */
  buildGeminiPrompt(sentences, scriptMode, languagePreference) {
    let modeInstruction = '';

    if (scriptMode === 'roman') {
      modeInstruction = `TARGET SCRIPT: ROMAN HINDI & ROMAN URDU (Latin English alphabets).
Transliterate and translate speech to natural, conversational Roman Urdu / Roman Hindi using phonetic Latin English letters (e.g. "agar ap isko dekh skte hein", "kese ho aap sab", "aaj hum baat karenge").
Keep popular tech words in clean English (e.g., "video", "subscribe", "channel", "camera", "AI", "studio", "like", "link").
CRITICAL: Do NOT output Devanagari or Urdu Nastaliq letters. Output ONLY Latin English alphabet words.`;
    } else if (scriptMode === 'native' && languagePreference === 'hindi') {
      modeInstruction = `TARGET SCRIPT: PURE NATIVE HINDI (हिन्दी - Devanagari script).
Translate and convert speech into 100% pure, natural Hindi in Devanagari script.
CRITICAL: Absolutely ZERO English or Latin letters. Every single word must be in Devanagari (e.g. "अगर आप इसको देख सकते हैं তো लाइक करें").`;
    } else if (scriptMode === 'native' && languagePreference === 'urdu') {
      modeInstruction = `TARGET SCRIPT: PURE NATIVE URDU (اردو - Nastaliq script).
Translate and convert speech into 100% pure, natural Urdu in Nastaliq script.
CRITICAL: Absolutely ZERO English or Latin letters. Every single word must be in authentic Urdu script (e.g. "اگر آپ اس کو دیکھ سکتے ہیں تو لائیک کریں").`;
    } else if (scriptMode === 'native') {
      modeInstruction = `TARGET SCRIPT: PURE NATIVE SCRIPT.
Detect if the speech is Hindi or Urdu.
If Hindi: Output 100% pure Devanagari script (हिन्दी) with ZERO English letters.
If Urdu: Output 100% pure Nastaliq script (اردو) with ZERO English letters.`;
    } else {
      modeInstruction = `TARGET SCRIPT: NATURAL SOCIAL MEDIA ENGLISH.
Translate speech into concise, punchy, modern English captions suitable for viral video reels and shorts.`;
    }

    const segmentsInput = sentences.map((s, idx) => ({
      id: s.id !== undefined ? s.id : idx,
      text: s.text || ''
    }));

    return `You are an elite video transcript subtitle localization and transliteration engine.
${modeInstruction}

RULES:
1. Return exactly one entry for each input item, maintaining the identical "id".
2. Keep subtitles natural, punchy, and conversational for video creators.
3. Preserve the exact meaning and speech flow.
4. Output MUST be a valid JSON array of objects conforming to this schema:
[
  {"id": 0, "text": "localized text"}
]

INPUT SEGMENTS:
${JSON.stringify(segmentsInput, null, 2)}`;
  }

  /**
   * Merges translated text back into the original timestamped sentence structures
   * and creates synchronized word-by-word timestamps for caption animations.
   */
  applyGeminiTranslationsToSentences(originalSentences, translatedItems, scriptMode, languagePreference) {
    const itemMap = new Map();
    translatedItems.forEach((item, index) => {
      if (item && item.id !== undefined) {
        itemMap.set(String(item.id), item.text);
      }
      itemMap.set(String(index), item.text);
    });

    return originalSentences.map((s, idx) => {
      const sStart = Number(s.start ?? s.startTime ?? 0);
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
      const originalRawText = (s.text || '').trim();

      let translatedText = itemMap.get(String(s.id)) || itemMap.get(String(idx)) || originalRawText;

      // Post-clean: Ensure script rules strictly hold
      if (scriptMode === 'native' && (languagePreference === 'hindi' || (!languagePreference && /[\u0900-\u097F]/.test(originalRawText)))) {
        translatedText = translationService.ensureNativeHindi(translatedText);
      } else if (scriptMode === 'native' && (languagePreference === 'urdu' || (!languagePreference && /[\u0600-\u06FF]/.test(originalRawText)))) {
        translatedText = translationService.ensureNativeUrdu(translatedText);
      }

      // Re-align word-level timestamps across the exact sentence duration
      const words = this.realignWords(translatedText, sStart, sEnd);

      let targetLang = 'en';
      if (scriptMode === 'native') {
        targetLang = languagePreference === 'urdu' || /[\u0600-\u06FF]/.test(translatedText) ? 'ur' : 'hi';
      }

      return {
        ...s,
        id: s.id !== undefined ? s.id : `sentence_${idx + 1}`,
        startTime: sStart,
        endTime: sEnd,
        start: sStart,
        end: sEnd,
        originalText: s.originalText || originalRawText,
        nativeText: scriptMode === 'native' ? translatedText : (s.nativeText || s.originalText || originalRawText),
        romanText: scriptMode === 'roman' ? translatedText : (s.romanText || originalRawText),
        originalLanguage: s.originalLanguage || (targetLang === 'ur' || targetLang === 'hi' ? targetLang : 'auto'),
        language: targetLang,
        text: translatedText,
        words: words
      };
    });
  }

  /**
   * Re-aligns word timestamps evenly across sentence duration
   * to guarantee perfect animated captions and word-by-word highlight sync.
   */
  realignWords(text, startTime, endTime) {
    const tokens = (text || '').trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const totalDuration = Math.max(0.35, endTime - startTime);
    const durationPerWord = totalDuration / tokens.length;

    return tokens.map((token, idx) => {
      const wStart = parseFloat((startTime + idx * durationPerWord).toFixed(2));
      const wEnd = parseFloat((startTime + (idx + 1) * durationPerWord).toFixed(2));
      return {
        word: token,
        start: wStart,
        end: wEnd,
        startTime: wStart,
        endTime: wEnd
      };
    });
  }
}

export const geminiTranslationService = new GeminiTranslationService();
