import { defaultLang, languages } from './lang';
import { mainTranslation } from './translation/mainTranslation';

export const showDefaultLang = false; // show default lang meaning show the /en/ in the url or not

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/');
  if (lang in mainTranslation) return lang as keyof typeof mainTranslation;
  return defaultLang;
}

export function useTranslations(lang: keyof typeof mainTranslation) {
  return function t(key: keyof typeof mainTranslation[typeof defaultLang]) {
    return mainTranslation[lang][key] || mainTranslation[defaultLang][key];
  }
}

export function useTranslatedPath(lang: keyof typeof mainTranslation) {
  return function translatePath(path: string, l: string = lang) {
    //If there is two word like en and th remove it
    for(const key in languages) {
      if (path.startsWith(`/${key}/`)) {
        path = path.replace(`/${key}`, '');
        break;
      }
    }
    return !showDefaultLang && l === defaultLang ? path : `/${l}${path}`
  }
}

export function pathTranslatorQ(url: URL) {
  const lang = getLangFromUrl(url);
  return useTranslatedPath(lang);
}

export function textTranslatorQ(url: URL){
  const lang = getLangFromUrl(url);
  return useTranslations(lang);
}