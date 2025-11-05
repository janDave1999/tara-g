import { describe, it, expect } from "vitest";
import { translationKeyList, mainTranslation } from "@/i18/translation/mainTranslation";
// import { languages } from "@/i18/lang";

describe("translation", () => {
  it("should have a value for every key in every language", () => {
    // const languageCodes = Object.keys(languages);

    // Check first how many languages does mainTranslation has
    // The only language that is available will be the one that will be tested
    expect(Object.keys(mainTranslation).length).toBeGreaterThan(0);

    // Show what language codes are being tested
    console.log("Testing languages:\n  ", Object.keys(mainTranslation).join("\n   "));

    // Now check for every key in every language
    const languagesCodeToCheck = Object.keys(mainTranslation);

    for (const key of translationKeyList) {
      for (const lang of languagesCodeToCheck) {
        const translation = mainTranslation[lang]?.[key];
        // Check if the translation is a non-empty string
        expect(typeof translation, `Translation for key '${key}' in language '${lang}' is not a string`).toBe("string");
        expect(translation.length, `Translation for key '${key}' in language '${lang}' is empty`).toBeGreaterThan(0);
      }
    }
  });
});