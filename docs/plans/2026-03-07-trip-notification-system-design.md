# Trip Status Notification System Design

**Date:** 2026-03-07
**Status:** Approved

## Overview

A scheduled background worker that checks trips daily and notifies users about:
1. Upcoming trips (1 day before start) - notify owner + members
2. Trip starts today - auto-set status to "on-going"
3. Trip ended but not marked completed - notify owner, auto-archive after 2 days

## Trip Statuses

| Status | Description | How Set |
|--------|-------------|---------|
| `planning` | Trip being planned | Owner |
| `active` | Trip approved, upcoming | Owner |
| `on-going` | Trip currently happening | Cron (auto) |
| `completed` | Trip finished | Owner |
| `cancelled` | Trip cancelled | Owner |
| `archived` | Auto-archived after 2+ days | Cron (auto) |

## Architecture

```
Cloudflare Workers Cron (daily 9am)
           ↓
   POST /api/cron/trip-status-check
           ↓
check_trip_status_and_notify() RPC
           ↓
    ┌──────┴──────┐
    ↓             ↓
Notify Users  Update Status
```

## Cron Job Actions (Daily 9am)

| Step | Query | Action |
|------|-------|--------|
| 1 | `start_date = tomorrow` | Send `trip_tomorrow` to owner + members |
| 2 | `start_date = today` | Auto-set status to `on-going` |
| 3 | `end_date = yesterday` AND status NOT completed/archived | Send `trip_needs_status` to owner |
| 4 | `end_date < today - 1` AND status NOT completed/archived | Auto-set status to `archived` |

## Notification Types

| Type | Recipients | Title | Message |
|------|-----------|-------|---------|
| `trip_tomorrow` | Owner + Members | "Trip starts tomorrow!" | "{trip_title} starts tomorrow! Get ready for your adventure!" |
| `trip_ongoing` | Members | "Trip on-going" | "Your trip '{trip_title}' is now on-going! Please be on time at the pickup location." |
| `trip_needs_status` | Owner | "Update your trip status" | "Your trip '{trip_title}' has ended. Please update the status." |
| `trip_status_changed` | Owner | "Trip status updated" | "Your trip '{trip_title}' status changed to {new_status}." |

## Components to Implement

1. **Database RPC:** `check_trip_status_and_notify()`
2. **API Endpoint:** `POST /api/cron/trip-status-check`
3. **Cloudflare Cron:** Configure in `wrangler.toml`
4. **Notification Types:** Add `trip_tomorrow`, `trip_ongoing`, `trip_needs_status`

## Edge Cases

- **Member joins after notification sent:** They'll see it when viewing the trip
- **Owner changes trip dates:** Next cron run catches new dates
- **All members leave:** Owner still gets notifications
- **Trip already archived:** Skip in queries
- **Cron fails:** Logged, next run catches pending items

## Database Changes

```sql
-- Add 'on-going' status to trip_status enum
ALTER TYPE trip_status ADD VALUE 'on-going';

-- Create the check and notify function
CREATE OR REPLACE FUNCTION check_trip_status_and_notify()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Implementation in migration
END;
$$;
```

## API Endpoint

```typescript
// src/pages/api/cron/trip-status-check.ts
export const POST: APIRoute = async ({ request }) => {
  // Verify cron secret (optional)
  // Call RPC function
  // Return success/error
};
```

## Cloudflare Cron Configuration

```toml
# wrangler.toml
[triggers]
crons = ["0 9 * * *"]  # Daily at 9am UTC
```
