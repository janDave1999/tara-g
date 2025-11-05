import type { LANGUAGE_CODE } from "@/i18/lang";
import { ui } from "./_ui";

export const translationKeyList = [
  "home.title",
] as const;
export type TRANSLATION_KEY = typeof translationKeyList[number];
export type TRANSLATION_CONTENT = { [key in TRANSLATION_KEY]: string };
export type TRANSLATION_LANGUAGES_CONTENT = {[key in LANGUAGE_CODE]: TRANSLATION_CONTENT};

export const mainTranslation = {
  en: {
    ...ui.en,
  },
  th: {
    ...ui.th,
  },
} as TRANSLATION_LANGUAGES_CONTENT;