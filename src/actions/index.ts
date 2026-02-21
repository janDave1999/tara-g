import { activities } from "./activities";
import { auth } from "./auth";
import { stops } from "./stops";
import { trip } from "./trips";
import { onboarding, settings, travelPreferences, user } from "./user";

export const server = {
    activities,
    trip,
    auth,
    onboarding,
    stops,
    settings,
    travelPreferences,
    user
};