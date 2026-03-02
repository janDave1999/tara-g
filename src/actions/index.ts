import { activities } from "./activities";
import { auth } from "./auth";
import { feed } from "./feed";
import { friends } from "./friends";
import { notificationActions } from "./notifications";
import { search } from "./search";
import { stops } from "./stops";
import { trip } from "./trips";
import { onboarding, settings, travelPreferences, user } from "./user";

export const server = {
    activities,
    feed,
    friends,
    trip,
    auth,
    notifications: notificationActions,
    onboarding,
    search,
    stops,
    settings,
    travelPreferences,
    user
};