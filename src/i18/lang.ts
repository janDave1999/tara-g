export const languageCodes = [
  'en', 'th', 'ph', 'jp', 'kr', 'cn', 'vn', 'id', 'my', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'pt', 'hi', 'tr', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'hu', 'cs', 'ro', 'el', 'he'
];
export type LANGUAGE_CODE = typeof languageCodes[number];

export const languages = {
  en: 'English',
  th: 'Thai',
  ph: 'Filipino',
  jp: 'Japanese',
  kr: 'Korean',
  cn: 'Chinese',
  vn: 'Vietnamese',
  id: 'Indonesian',
  my: 'Malay',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ru: 'Russian',
  ar: 'Arabic',
  pt: 'Portuguese',
  hi: 'Hindi',
  tr: 'Turkish',
  nl: 'Dutch',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  pl: 'Polish',
  hu: 'Hungarian',
  cs: 'Czech',
  ro: 'Romanian',
  el: 'Greek',
  he: 'Hebrew',
} as {
  [key in LANGUAGE_CODE]: string
};



export const languageDescription = {
  en: {
    name: 'English',
    country: 'United States',
    translatedName: 'English',
    translatedCountry: 'United States',
  },
  th: {
    name: 'ภาษาไทย',
    country: 'Thailand',
    translatedName: 'ไทย',
    translatedCountry: 'ประเทศไทย',
  },
  ph: {
    name: 'Filipino',
    country: 'Philippines',
    translatedName: 'Pilipino',
    translatedCountry: 'Pilipinas',
  },
  jp: {
    name: 'Japanese',
    country: 'Japan',
    translatedName: '日本語',
    translatedCountry: '日本',
  },
  kr: {
    name: 'Korean',
    country: 'South Korea',
    translatedName: '한국어',
    translatedCountry: '대한민국',
  },
  cn: {
    name: 'Chinese',
    country: 'China',
    translatedName: '中文',
    translatedCountry: '中国',
  },
  vn: {
    name: 'Vietnamese',
    country: 'Vietnam',
    translatedName: 'Tiếng Việt',
    translatedCountry: 'Việt Nam',
  },
  id: {
    name: 'Indonesian',
    country: 'Indonesia',
    translatedName: 'Bahasa Indonesia',
    translatedCountry: 'Indonesia',
  },
  my: {
    name: 'Malay',
    country: 'Malaysia',
    translatedName: 'Bahasa Melayu',
    translatedCountry: 'Malaysia',
  },
  es: {
    name: 'Spanish',
    country: 'Spain',
    translatedName: 'Español',
    translatedCountry: 'España',
  },
  fr: {
    name: 'French',
    country: 'France',
    translatedName: 'Français',
    translatedCountry: 'France',
  },
  de: {
    name: 'German',
    country: 'Germany',
    translatedName: 'Deutsch',
    translatedCountry: 'Deutschland',
  },
  it: {
    name: 'Italian',
    country: 'Italy',
    translatedName: 'Italiano',
    translatedCountry: 'Italia',
  },
  ru: {
    name: 'Russian',
    country: 'Russia',
    translatedName: 'Русский',
    translatedCountry: 'Россия',
  },
  ar: {
    name: 'Arabic',
    country: 'Saudi Arabia',
    translatedName: 'العربية',
    translatedCountry: 'المملكة العربية السعودية',
  },
  pt: {
    name: 'Portuguese',
    country: 'Portugal',
    translatedName: 'Português',
    translatedCountry: 'Portugal',
  },
  hi: {
    name: 'Hindi',
    country: 'India',
    translatedName: 'हिन्दी',
    translatedCountry: 'भारत',
  },
  tr: {
    name: 'Turkish',
    country: 'Turkey',
    translatedName: 'Türkçe',
    translatedCountry: 'Türkiye',
  },
  nl: {
    name: 'Dutch',
    country: 'Netherlands',
    translatedName: 'Nederlands',
    translatedCountry: 'Nederland',
  },
  sv: {
    name: 'Swedish',
    country: 'Sweden',
    translatedName: 'Svenska',
    translatedCountry: 'Sverige',
  },
  no: {
    name: 'Norwegian',
    country: 'Norway',
    translatedName: 'Norsk',
    translatedCountry: 'Norge',
  },
  da: {
    name: 'Danish',
    country: 'Denmark',
    translatedName: 'Dansk',
    translatedCountry: 'Danmark',
  },
  fi: {
    name: 'Finnish',
    country: 'Finland',
    translatedName: 'Suomi',
    translatedCountry: 'Suomi',
  },
  pl: {
    name: 'Polish',
    country: 'Poland',
    translatedName: 'Polski',
    translatedCountry: 'Polska',
  },
  hu: {
    name: 'Hungarian',
    country: 'Hungary',
    translatedName: 'Magyar',
    translatedCountry: 'Magyarország',
  },
  cs: {
    name: 'Czech',
    country: 'Czech Republic',
    translatedName: 'Čeština',
    translatedCountry: 'Česká republika',
  },
  ro: {
    name: 'Romanian',
    country: 'Romania',
    translatedName: 'Română',
    translatedCountry: 'România',
  },
  el: {
    name: 'Greek',
    country: 'Greece',
    translatedName: 'Ελληνικά',
    translatedCountry: 'Ελλάδα',
  },
  he: {
    name: 'Hebrew',
    country: 'Israel',
    translatedName: 'עברית',
    translatedCountry: 'ישראל',
  }
}

export const defaultLang = 'en';