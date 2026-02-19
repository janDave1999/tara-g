/**
 * Simple in-memory IP-based rate limiter.
 *
 * Works per worker instance. For cross-instance enforcement,
 * configure Cloudflare Rate Limiting rules in the Cloudflare dashboard.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15-minute window
const MAX_ATTEMPTS = 10;           // max requests per window per IP

interface Record {
  count: number;
  resetAt: number;
}

const store = new Map<string, Record>();

export function checkRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  const record = store.get(ip);

  if (!record || now > record.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false };
  }

  record.count++;
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ??
    "unknown"
  );
}
