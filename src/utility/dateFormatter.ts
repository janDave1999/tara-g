// File: src/utility/dateFormatter.ts
// Date and time formatting utilities
//
// Timezone contract:
//   - TIMESTAMPTZ values come from Supabase as UTC ISO strings (e.g. "2025-02-21T06:30:00+00:00").
//   - DATE-only values come as bare date strings (e.g. "2025-02-21") with no time component.
//   - All display functions convert UTC → browser-local automatically via the Date API.
//   - formatDateTimeLocal() is used to populate <input type="datetime-local">; it must
//     produce a local-time string ("YYYY-MM-DDTHH:mm") from a UTC ISO string.

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Parse an ISO string safely.
 * Date-only strings (YYYY-MM-DD) are treated as local midnight to prevent the
 * UTC-midnight → previous-day shift that affects users east of UTC.
 */
const parseISO = (isoString: string): Date => {
  if (!isoString) return new Date(NaN);
  // Date-only: "2025-02-21" → local midnight (avoids UTC offset day shift)
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return new Date(`${isoString}T00:00:00`);
  }
  return new Date(isoString);
};

/** Format a UTC ISO or DATE string as a human-readable time in browser-local timezone. */
export const formatTime = (isoString: string): string => {
  const date = parseISO(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/** Format a UTC ISO or DATE string as a human-readable date in browser-local timezone. */
export const formatDate = (isoString: string): string => {
  const date = parseISO(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Convert a UTC ISO string (returned by Supabase) into the "YYYY-MM-DDTHH:mm" format
 * required by <input type="datetime-local">.
 * Uses local date/time parts so the browser's input shows the correct local time,
 * not the raw UTC value.
 */
export const formatDateTimeLocal = (isoString: string): string => {
  if (!isoString) return '';
  const date = parseISO(isoString);
  if (isNaN(date.getTime())) return '';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

/** Human-readable duration between two ISO strings. */
export const getDuration = (start: string, end: string): string => {
  const diff = parseISO(end).getTime() - parseISO(start).getTime();
  if (isNaN(diff) || diff < 0) return '';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

/** One-line date+time range display for a stop. */
export const getDisplayTime = (start: string, end: string): string => {
  const isSameDay = start.slice(0, 10) === end.slice(0, 10);
  if (isSameDay) {
    return `${formatDate(start)} | ${formatTime(start)} - ${formatTime(end)}`;
  }
  return `${formatDate(start)}, ${formatTime(start)} — ${formatDate(end)}, ${formatTime(end)}`;
};
