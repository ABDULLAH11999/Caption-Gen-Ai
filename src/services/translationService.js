// Intelligent Multi-Language Transliteration & Transcript Service
// 1. Keeps English transcript 100% untouched and pristine.
// 2. Transliterates Urdu (Nastaliq) and Hindi (Devanagari) into natural Roman Urdu / Roman Hindi (Latin English alphabets, e.g., "Kese ho Guys", "Is tarah se").
// 3. Preserves already-spoken Roman Urdu / Roman Hindi without translating away spoken words.

import { languageIdentifier } from './languageIdentifier.js';

class TranslationService {
  constructor() {
    this.cache = new Map();

    // High-frequency curated dictionary for natural Roman Urdu & Hindi phrasing
    this.urduHindiPhraseMap = [
      // Common Greetings & Multi-word Expressions
      { pattern: /کیسے\s+ہو\s+گائ[یز]/gi, replacement: 'Kese ho Guys' },
      { pattern: /کیسے\s+ہیں\s+آپ/gi, replacement: 'Kaise hain aap' },
      { pattern: /کیا\s+حال\s+ہے/gi, replacement: 'Kya haal hai' },
      { pattern: /اس\s+طرح\s+سے/gi, replacement: 'Is tarah se' },
      { pattern: /اس\s+طرح/gi, replacement: 'Is tarah' },
      { pattern: /آپ\s+سب/gi, replacement: 'Aap sab' },
      { pattern: /السلام\s*علیکم/gi, replacement: 'Assalam o Alaikum' },
      { pattern: /وعلیکم\s*السلام/gi, replacement: 'Walaikum Assalam' },
      { pattern: /انشاء\s*اللہ/gi, replacement: 'Inshallah' },
      { pattern: /ماشاء\s*اللہ/gi, replacement: 'Mashallah' },
      { pattern: /الحمد\s*للہ/gi, replacement: 'Alhamdulillah' },

      { pattern: /कैसे\s+हो\s+गाइ[ज़स]/gi, replacement: 'Kese ho Guys' },
      { pattern: /क्या\s+हाल\s+है/gi, replacement: 'Kya haal hai' },
      { pattern: /इस\s+तरह\s+से/gi, replacement: 'Is tarah se' },
      { pattern: /इस\s+तरह/gi, replacement: 'Is tarah' },
      { pattern: /आप\s+सभी/gi, replacement: 'Aap sabhi' },
      { pattern: /आप\s+सब/gi, replacement: 'Aap sab' },
      { pattern: /नमस्ते\s+दोस्तों/gi, replacement: 'Namaste dosto' },
      { pattern: /स्वागत\s+है/gi, replacement: 'Swagat hai' }
    ];

    this.urduWordsMap = {
      'کیسے': 'Kese',
      'کیسا': 'Kaisa',
      'کیسی': 'Kaisi',
      'ہو': 'ho',
      'گائز': 'Guys',
      'گاۓ': 'Guys',
      'کیا': 'kya',
      'کیوں': 'kyun',
      'کب': 'kab',
      'کہاں': 'kahan',
      'کون': 'kaun',
      'کچھ': 'kuch',
      'کوئی': 'koi',
      'آپ': 'Aap',
      'آپکا': 'Aapka',
      'آپکی': 'Aapki',
      'آپکے': 'Aapke',
      'تم': 'tum',
      'تمہارا': 'tumhara',
      'تمہاری': 'tumhari',
      'ہم': 'hum',
      'ہمارا': 'humara',
      'ہمارے': 'humare',
      'میں': 'main',
      'میرا': 'mera',
      'میری': 'meri',
      'میرے': 'mere',
      'یہ': 'yeh',
      'وہ': 'woh',
      'اس': 'is',
      'اسکا': 'iska',
      'اسکی': 'iski',
      'اسکے': 'iske',
      'ان': 'in',
      'انکا': 'inka',
      'طرح': 'tarah',
      'سے': 'se',
      'بہت': 'bohot',
      'اچھا': 'acha',
      'اچھی': 'achi',
      'اچھے': 'ache',
      'بھائی': 'bhai',
      'دوست': 'dost',
      'دوستو': 'dosto',
      'شکریہ': 'shukriya',
      'مہربانی': 'meherbani',
      'زندگی': 'zindagi',
      'پیار': 'pyaar',
      'بات': 'baat',
      'نہیں': 'nahi',
      'نہ': 'na',
      'ہاں': 'haan',
      'ہے': 'hai',
      'ہیں': 'hain',
      'تھا': 'tha',
      'تھی': 'thi',
      'تھے': 'the',
      'گا': 'ga',
      'گی': 'gi',
      'گے': 'ge',
      'کریں': 'karein',
      'کرو': 'karo',
      'کرنا': 'karna',
      'کر': 'kar',
      'رہا': 'raha',
      'رہی': 'rahi',
      'رہے': 'rahe',
      'دیکھیں': 'dekhein',
      'دیکھو': 'dekho',
      'سنیں': 'sunein',
      'سنو': 'suno',
      'بتائیں': 'batayein',
      'بتاؤ': 'batao',
      'سمجھیں': 'samjhein',
      'سمجھو': 'samjho',
      'ویڈیو': 'video',
      'چینل': 'channel',
      'لائیک': 'like',
      'سبسکرائب': 'subscribe',
      'شیئر': 'share',
      'سلام': 'salam',
      'سب': 'sab',
      'ٹھیک': 'theek',
      'صحیح': 'sahi',
      'ضرور': 'zaroor',
      'لیکن': 'lekin',
      'مگر': 'magar',
      'اگر': 'agar',
      'اسکو': 'isko',
      'دیکھ': 'dekh',
      'سکتے': 'skte',
      'سکتی': 'skti',
      'سکتا': 'skta',
      'سکیں': 'skein',
      'دیکھتے': 'dekhte',
      'دیکھتی': 'dekhti',
      'دیکھتا': 'dekhta',
      'اور': 'aur',
      'بھی': 'bhi',
      'کا': 'ka',
      'کی': 'ki',
      'کے': 'ke',
      'کو': 'ko',
      'نے': 'ne',
      'تک': 'tak',
      'پر': 'par',
      'پاس': 'paas',
      'ساتھ': 'saath',
      'پہلے': 'pehle',
      'بعد': 'baad',
      'آج': 'aaj',
      'کل': 'kal'
    };

    this.hindiWordsMap = {
      'कैसे': 'Kese',
      'कैसा': 'Kaisa',
      'कैसी': 'Kaisi',
      'हो': 'ho',
      'गाइज': 'Guys',
      'गाइज़': 'Guys',
      'गाइस': 'Guys',
      'नमस्ते': 'Namaste',
      'दोस्तों': 'dosto',
      'दोस्त': 'dost',
      'क्या': 'kya',
      'क्यों': 'kyun',
      'कब': 'kab',
      'कहाँ': 'kahan',
      'कहा': 'kahan',
      'कौन': 'kaun',
      'कुछ': 'kuch',
      'कोई': 'koi',
      'हाल': 'haal',
      'है': 'hai',
      'हैं': 'hain',
      'था': 'tha',
      'थी': 'thi',
      'थे': 'the',
      'होगा': 'hoga',
      'होगी': 'hogi',
      'होंगे': 'honge',
      'आप': 'Aap',
      'आपका': 'Aapka',
      'आपकी': 'Aapki',
      'आपके': 'Aapke',
      'तुम': 'tum',
      'तुम्हारा': 'tumhara',
      'तुम्हारी': 'tumhari',
      'हम': 'hum',
      'हमारा': 'humara',
      'हमारी': 'humari',
      'हमारे': 'humare',
      'मैं': 'main',
      'मेरा': 'mera',
      'मेरी': 'meri',
      'मेरे': 'mere',
      'यह': 'yeh',
      'वह': 'woh',
      'इस': 'is',
      'इसका': 'iska',
      'इसकी': 'iski',
      'इसके': 'iske',
      'तरह': 'tarah',
      'से': 'se',
      'बहुत': 'bohot',
      'अच्छा': 'acha',
      'अच्छी': 'achi',
      'अच्छे': 'ache',
      'भाई': 'bhai',
      'करो': 'karo',
      'करना': 'karna',
      'करें': 'karein',
      'कर': 'kar',
      'रहा': 'raha',
      'रही': 'rahi',
      'रहे': 'rahe',
      'सब': 'sab',
      'सबको': 'sabko',
      'वीडियो': 'video',
      'लाइक': 'like',
      'शेयर': 'share',
      'सब्सक्राइब': 'subscribe',
      'चैनल': 'channel',
      'शुक्रिया': 'shukriya',
      'धन्यवाद': 'dhanyawad',
      'स्वागत': 'swagat',
      'बात': 'baat',
      'नहीं': 'nahi',
      'हाँ': 'haan',
      'भी': 'bhi',
      'और': 'aur',
      'लेकिन': 'lekin',
      'मगर': 'magar',
      'क्योंकि': 'kyunki',
      'अगर': 'agar',
      'इसको': 'isko',
      'देख': 'dekh',
      'सकते': 'skte',
      'सकती': 'skti',
      'सकता': 'skta',
      'सकें': 'skein',
      'देखते': 'dekhte',
      'देखती': 'dekhti',
      'देखता': 'dekhta',
      'तो': 'to',
      'जाओ': 'jao',
      'आओ': 'aao',
      'देखो': 'dekho',
      'सुनो': 'suno',
      'बोलो': 'bolo',
      'समझो': 'samjho',
      'आज': 'aaj',
      'कल': 'kal',
      'पर': 'par',
      'तक': 'tak',
      'साथ': 'saath',
      'पास': 'paas'
    };

    // Devanagari character map for full fallback
    this.devanagariVowels = {
      'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
      'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah'
    };

    this.devanagariConsonants = {
      'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
      'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
      'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
      'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
      'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm',
      'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
      'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
      'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f'
    };

    this.devanagariMatras = {
      'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
      'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h'
    };

    // Urdu character map for fallback
    this.urduCharMap = {
      'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
      'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
      'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
      'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
      'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o',
      'ہ': 'h', 'ھ': 'h', 'ء': '', 'ی': 'i', 'ے': 'e', 'ۂ': 'h', 'ۃ': 't'
    };
  }

  /**
   * Checks if text contains non-Latin scripts (Urdu, Hindi, Cyrillic, CJK, etc.)
   */
  hasNonLatinScript(text) {
    if (!text) return false;
    return /[\u0600-\u06FF\u0900-\u097F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/.test(text);
  }

  /**
   * Deterministic local transliteration of Devanagari Hindi into Roman Hindi
   */
  transliterateDevanagari(text) {
    let result = text;
    // 1. Replace multi-word and known words
    for (const [hindi, roman] of Object.entries(this.hindiWordsMap)) {
      result = result.replace(new RegExp(hindi, 'g'), roman);
    }

    // 2. Character-level fallback for remaining Devanagari characters
    let output = '';
    for (let i = 0; i < result.length; i++) {
      const ch = result[i];
      const nextCh = result[i + 1] || '';

      if (this.devanagariVowels[ch]) {
        output += this.devanagariVowels[ch];
      } else if (this.devanagariConsonants[ch]) {
        const cons = this.devanagariConsonants[ch];
        if (nextCh === '्') {
          // Halant (half consonant)
          output += cons;
          i++; // skip halant
        } else if (this.devanagariMatras[nextCh]) {
          output += cons + this.devanagariMatras[nextCh];
          i++; // skip matra
        } else if (this.devanagariConsonants[nextCh] || this.devanagariVowels[nextCh]) {
          output += cons + 'a';
        } else {
          output += cons;
        }
      } else if (this.devanagariMatras[ch]) {
        output += this.devanagariMatras[ch];
      } else {
        output += ch;
      }
    }

    return output.replace(/\s+/g, ' ').trim();
  }

  /**
   * Deterministic local transliteration of Urdu Nastaliq into Roman Urdu
   */
  transliterateUrdu(text) {
    let result = text;
    // 1. Replace known phrases and words
    for (const [urdu, roman] of Object.entries(this.urduWordsMap)) {
      result = result.replace(new RegExp(urdu, 'g'), roman);
    }

    // 2. Character-level fallback for remaining Urdu characters
    let output = '';
    for (let i = 0; i < result.length; i++) {
      const ch = result[i];
      if (this.urduCharMap[ch] !== undefined) {
        output += this.urduCharMap[ch];
      } else {
        output += ch;
      }
    }

    return output.replace(/\s+/g, ' ').trim();
  }

  isRomanHallucination(text) {
    const compact = (text || '').toLowerCase().replace(/[^a-z]+/g, '');
    return compact.length > 16 && /([a-z]{1,3})\1{6,}/i.test(compact);
  }

  polishRomanUrdu(text) {
    return (text || '')
      .replace(/\bnihen\b/gi, 'nahi')
      .replace(/\bhen\b/gi, 'hein')
      .replace(/\bhain\b/gi, 'hein')
      .replace(/\bhay\b/gi, 'hai')
      .replace(/\bskte\b/gi, 'skte')
      .replace(/\bsakte\b/gi, 'skte')
      .replace(/\bya\b/gi, 'yeh')
      .replace(/\bmin\b/gi, 'main')
      .replace(/\bpatchhe\b/gi, 'piche')
      .replace(/\btarah?on\b/gi, 'tarah')
      .replace(/\bjeedisex\b/gi, 'GTA 6')
      .replace(/\bGDSX\b/g, 'GTA 6')
      .replace(/\bfaturess?\b/gi, 'features')
      .replace(/\bsakop\b/gi, 'sab ko')
      .replace(/\bpaghal\b/gi, 'pagal')
      .replace(/\bsamase\b/gi, 'sab se')
      .replace(/\btarik\b/gi, 'track')
      .replace(/\bwepons\b/gi, 'weapons')
      .replace(/\bkalk\b/gi, 'click')
      .replace(/\bantazar\b/gi, 'intezar')
      .replace(/\s+/g, ' ')
      .trim();
  }

  ensureNativeHindi(text) {
    if (!text) return '';
    let result = text;
    const latinToDevanagari = {
      'agar': 'अगर', 'ap': 'आप', 'aap': 'आप', 'isko': 'इसको', 'dekh': 'देख',
      'skte': 'सकते', 'sakte': 'सकते', 'sakti': 'सकती', 'sakta': 'सकता', 'skein': 'सकें',
      'hein': 'हैं', 'hain': 'हैं', 'hai': 'है', 'ho': 'हो', 'hum': 'हम', 'main': 'मैं',
      'mera': 'मेरा', 'meri': 'मेरी', 'mere': 'मेरे', 'tum': 'तुम', 'tumhara': 'तुम्हारा',
      'kya': 'क्या', 'kyun': 'क्यों', 'kab': 'कब', 'kahan': 'कहाँ', 'kaun': 'कौन',
      'karo': 'करो', 'karna': 'करना', 'karein': 'करें', 'kar': 'कर', 'raha': 'रहा',
      'rahi': 'रही', 'rahe': 'रहे', 'bhai': 'भाई', 'dost': 'दोस्त', 'dosto': 'दोस्तों',
      'acha': 'अच्छा', 'achi': 'अच्छी', 'ache': 'अच्छे', 'bohot': 'बहुत', 'bahut': 'बहुत',
      'shukriya': 'शुक्रिया', 'dhanyawad': 'धन्यवाद', 'namaste': 'नमस्ते', 'swagat': 'स्वागत',
      'yeh': 'यह', 'woh': 'वह', 'is': 'इस', 'iska': 'इसका', 'iski': 'इसकी', 'iske': 'इसके',
      'se': 'से', 'ko': 'को', 'ka': 'का', 'ki': 'की', 'ke': 'के', 'ne': 'ने', 'tak': 'तक',
      'par': 'पर', 'pe': 'पे', 'aur': 'और', 'bhi': 'भी', 'lekin': 'लेकिन', 'magar': 'मगर',
      'video': 'वीडियो', 'channel': 'चैनल', 'like': 'लाइक', 'subscribe': 'सब्सक्राइब', 'share': 'शेयर',
      'guys': 'गाइस', 'hello': 'हेलो', 'hi': 'हाय', 'aaj': 'आज', 'kal': 'कल'
    };

    for (const [lat, dev] of Object.entries(latinToDevanagari)) {
      result = result.replace(new RegExp(`\\b${lat}\\b`, 'gi'), dev);
    }
    return result.replace(/\s+/g, ' ').trim();
  }

  ensureNativeUrdu(text) {
    if (!text) return '';
    let result = text;
    const latinToUrdu = {
      'agar': 'اگر', 'ap': 'آپ', 'aap': 'آپ', 'isko': 'اسکو', 'dekh': 'دیکھ',
      'skte': 'سکتے', 'sakte': 'سکتے', 'sakti': 'سکتی', 'sakta': 'سکتا', 'skein': 'سکیں',
      'hein': 'ہیں', 'hain': 'ہیں', 'hai': 'ہے', 'ho': 'ہو', 'hum': 'ہم', 'main': 'میں',
      'mera': 'میرا', 'meri': 'میری', 'mere': 'میرے', 'tum': 'تم', 'tumhara': 'تمہارا',
      'kya': 'کیا', 'kyun': 'کیوں', 'kab': 'کب', 'kahan': 'کہاں', 'kaun': 'کون',
      'karo': 'کرو', 'karna': 'کرنا', 'karein': 'کریں', 'kar': 'کر', 'raha': 'رہا',
      'rahi': 'رہی', 'rahe': 'رہے', 'bhai': 'بھائی', 'dost': 'دوست', 'dosto': 'دوستو',
      'acha': 'اچھا', 'achi': 'اچھی', 'ache': 'اچھے', 'bohot': 'بہت', 'bahut': 'بہت',
      'shukriya': 'شکریہ', 'salam': 'سلام', 'assalam': 'السلام',
      'yeh': 'یہ', 'woh': 'وہ', 'is': 'اس', 'iska': 'اسکا', 'iski': 'اسکی', 'iske': 'اسکے',
      'se': 'سے', 'ko': 'کو', 'ka': 'کا', 'ki': 'کی', 'ke': 'کے', 'ne': 'نے', 'tak': 'تک',
      'par': 'پر', 'pe': 'پر', 'aur': 'اور', 'bhi': 'بھی', 'lekin': 'لیکن', 'magar': 'مگر',
      'video': 'ویڈیو', 'channel': 'چینل', 'like': 'لائیک', 'subscribe': 'سبسکرائب', 'share': 'شیئر',
      'guys': 'گائز', 'hello': 'ہیلو', 'hi': 'ہائے', 'aaj': 'آج', 'kal': 'کل'
    };

    for (const [lat, urd] of Object.entries(latinToUrdu)) {
      result = result.replace(new RegExp(`\\b${lat}\\b`, 'gi'), urd);
    }
    return result.replace(/\s+/g, ' ').trim();
  }

  /**
   * Transliterates text into Roman English alphabet (Roman Urdu / Roman Hindi)
   * while preserving English 100% untouched.
   */
  async transliterateToRoman(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return '';

    const hasUrdu = /[\u0600-\u06FF]/.test(trimmed);
    const hasHindi = /[\u0900-\u097F]/.test(trimmed);

    // If already in Latin / English alphabet, return as is (preserves English & Roman Urdu/Hindi)
    if (!hasUrdu && !hasHindi) {
      return trimmed;
    }

    if (this.cache.has(trimmed)) {
      return this.cache.get(trimmed);
    }

    // Check curated phrases first
    let mappedText = trimmed;
    for (const rule of this.urduHindiPhraseMap) {
      mappedText = mappedText.replace(rule.pattern, rule.replacement);
    }

    if (!hasUrdu && !hasHindi && mappedText !== trimmed) {
      this.cache.set(trimmed, mappedText);
      return mappedText;
    }

    // Try Google Transliteration / Romanization API (dt=rm returns pure Latin phonetic romanization)
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=rm&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        const romanized = (data && data[0] && data[0][1] && data[0][1][3]) ||
                          (data && data[0] && data[0][0] && data[0][0][3]);
        if (romanized && typeof romanized === 'string' && romanized.trim()) {
          const polished = this.polishRomanUrdu(romanized.trim()
            .replace(/\b(gaiz|giz|gize)\b/gi, 'Guys')
            .replace(/\b(kise)\b/gi, 'Kese')
            .replace(/\b(kaise)\b/gi, 'Kaise')
            .replace(/\b(tarah|tara)\b/gi, 'tarah')
            .replace(/\b(kia|kiya)\b/gi, 'kya')
            .replace(/\b(doston)\b/gi, 'dosto'));

          this.cache.set(trimmed, polished);
          return polished;
        }
      }
    } catch (err) {
      console.warn('Google Romanization API fallback:', err.message);
    }

    // Offline deterministic transliteration fallback
    let localResult = trimmed;
    if (hasUrdu) {
      localResult = this.transliterateUrdu(localResult);
    }
    if (hasHindi) {
      localResult = this.transliterateDevanagari(localResult);
    }

    const finalResult = this.polishRomanUrdu(localResult);
    this.cache.set(trimmed, finalResult);
    return finalResult;
  }

  /**
   * Refines sentence transcript blocks:
   * - If scriptMode === 'native': Leaves native Hindi / Urdu in 100% pure native script (no English alphabets).
   * - If scriptMode === 'roman': Transliterates Urdu / Hindi speech to Roman Urdu / Roman Hindi in English alphabets.
   * - Preserves speech timings and word synchronizations.
   */
  async translateSentencesToEnglish(sentences, onProgress = () => {}, options = {}) {
    if (!sentences || sentences.length === 0) return [];
    const scriptMode = typeof options === 'string' ? options : (options?.scriptMode || 'roman');
    const targetLang = options?.languagePreference || options?.language || 'auto';

    const processedSentences = [];
    const total = sentences.length;

    for (let i = 0; i < total; i++) {
      const s = sentences[i];

      onProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100)
      });

      const rawText = (s.text || '').trim();
      const hasUrdu = /[\u0600-\u06FF]/.test(rawText);
      const hasHindi = /[\u0900-\u097F]/.test(rawText);
      const hasNonLatin = hasUrdu || hasHindi || this.hasNonLatinScript(rawText);

      // CASE 1: USER CHOSE NATIVE SCRIPT (Pure Hindi Devanagari or Pure Urdu Nastaliq, zero English letters)
      if (scriptMode === 'native') {
        let nativeText = rawText;
        if (targetLang === 'hindi' || (!hasUrdu && hasHindi)) {
          nativeText = this.ensureNativeHindi(nativeText);
        } else if (targetLang === 'urdu' || hasUrdu) {
          nativeText = this.ensureNativeUrdu(nativeText);
        }

        const sStart = Number(s.start ?? s.startTime ?? 0);
        const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
        const hasExistingWords = Array.isArray(s.words) && s.words.length > 0;
        const words = hasExistingWords ? s.words : this.realignWords(nativeText, sStart, sEnd);

        processedSentences.push({
          id: s.id,
          startTime: sStart,
          endTime: sEnd,
          start: sStart,
          end: sEnd,
          originalText: rawText,
          nativeText,
          romanText: s.romanText || rawText,
          originalLanguage: targetLang === 'urdu' || hasUrdu ? 'ur' : 'hi',
          language: targetLang === 'urdu' || hasUrdu ? 'ur' : 'hi',
          text: nativeText,
          words: words
        });
        continue;
      }

      // CASE 2: ROMAN SCRIPT (or English / Global)
      // If text is already in Latin/English alphabet (English or Roman Urdu/Hindi), keep it 100% intact
      if (!hasNonLatin) {
        processedSentences.push({
          ...s,
          romanText: s.romanText || rawText,
          originalLanguage: s.language || 'en',
          language: 'en'
        });
        continue;
      }

      // If Urdu or Hindi script detected, transliterate into Roman Urdu / Hindi in English alphabets
      const romanText = await this.transliterateToRoman(rawText);
      if (!romanText || this.isRomanHallucination(romanText)) {
        continue;
      }
      const sStart = Number(s.start ?? s.startTime ?? 0);
      const sEnd = Number(s.end ?? s.endTime ?? (sStart + 2.5));
      const newWords = this.realignWords(romanText, sStart, sEnd);

      processedSentences.push({
        id: s.id,
        startTime: sStart,
        endTime: sEnd,
        start: sStart,
        end: sEnd,
        originalText: rawText,
        nativeText: s.nativeText || rawText,
        romanText,
        originalLanguage: languageIdentifier.detectTextLanguage(rawText),
        language: 'en',
        text: romanText,
        words: newWords
      });
    }

    return processedSentences;
  }

  /**
   * Redistributes words evenly across the sentence duration,
   * guaranteeing YouTube-style word-by-word streaming sync.
   */
  realignWords(translatedText, startTime, endTime) {
    const tokens = (translatedText || '').trim().split(/\s+/).filter(Boolean);
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
}

export const translationService = new TranslationService();
