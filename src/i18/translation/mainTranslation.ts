import type { LANGUAGE_CODE } from "@/i18/lang";
import { ui } from "./_ui";

export const translationKeyList = [
  // Page titles
  "home.title",

  // Navigation
  "nav.home",
  "nav.discover",
  "nav.trips",
  "nav.feeds",
  "nav.maps",
  "nav.profile",

  // Auth
  "auth.sign_in",
  "auth.sign_up",
  "auth.sign_out",
  "auth.email",
  "auth.password",
  "auth.forgot_password",

  // Buttons
  "btn.save",
  "btn.cancel",
  "btn.confirm",
  "btn.delete",
  "btn.edit",
  "btn.create",
  "btn.submit",
  "btn.back",
  "btn.next",
  "btn.join",
  "btn.leave",

  // Common states
  "common.loading",
  "common.error",
  "common.empty",
  "common.saved",
  "common.deleted",

  // Trip
  "trip.status.draft",
  "trip.status.active",
  "trip.status.completed",
  "trip.status.cancelled",
  "trip.visibility.private",
  "trip.visibility.public",
  "trip.cost.split_evenly",
  "trip.cost.organizer_shoulders_cost",
  "trip.cost.pay_own_expenses",
  "trip.cost.custom_split",
] as const;
export type TRANSLATION_KEY = typeof translationKeyList[number];
export type TRANSLATION_CONTENT = { [key in TRANSLATION_KEY]: string };
export type TRANSLATION_LANGUAGES_CONTENT = {[key in LANGUAGE_CODE]: TRANSLATION_CONTENT};

export const mainTranslation = {
  en: {
    ...ui.en,
  },
  ph: {
    ...ui.ph,
  },
} as TRANSLATION_LANGUAGES_CONTENT;