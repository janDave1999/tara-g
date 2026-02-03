import { activities } from "./activities";
import { auth } from "./auth";
import { stops } from "./stops";
import { trip } from "./trips";
import { onboarding } from "./user";

export const server = {
    activities,
    trip,
    auth,
    onboarding,
    stops
};