import { activities } from "./activities";
import { auth } from "./auth";
import { friends } from "./friends";
import { notificationActions } from "./notifications";
import { stops } from "./stops";
import { trip } from "./trips";
import { onboarding, settings, travelPreferences, user } from "./user";

export const server = {
    activities,
    friends,
    trip,
    auth,
    notifications: notificationActions,
    onboarding,
    stops,
    settings,
    travelPreferences,
    user
};