# Trip Status Notification System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a daily cron job that notifies users about trip status changes (upcoming, on-going, needs update) and auto-archives overdue trips.

**Architecture:** Cloudflare Workers scheduled cron triggers an API endpoint that calls a PostgreSQL RPC function to check trips and send notifications.

**Tech Stack:** Cloudflare Workers, Supabase (PostgreSQL), Astro API routes

---

## Task 1: Add 'on-going' Status to Database

**Files:**
- Create: `database-migrations/0xx_add_ongoing_trip_status.sql`

**Step 1: Create migration file**

```sql
-- Add 'on-going' status to trip_status enum
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'on-going';

-- Create the check and notify function
CREATE OR REPLACE FUNCTION check_trip_status_and_notify()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_record RECORD;
  member_record RECORD;
  notification_id UUID;
BEGIN
  -- Step 1: Notify owner + members about trips starting tomorrow
  FOR trip_record IN
    SELECT t.id, t.title, t.owner_id
    FROM trip_details t
    WHERE t.start_date = CURRENT_DATE + 1
      AND t.status IN ('active', 'planning')
  LOOP
    -- Notify owner
    PERFORM create_notification(
      trip_record.owner_id,
      'trip_tomorrow',
      'Trip starts tomorrow!',
      format('%s starts tomorrow! Get ready for your adventure!', trip_record.title),
      NULL,
      NULL,
      NULL,
      'high',
      format('/trips/%s', trip_record.id)
    );
    
    -- Notify members
    FOR member_record IN
      SELECT tm.user_id FROM trip_members tm WHERE tm.trip_id = trip_record.id
    LOOP
      PERFORM create_notification(
        member_record.user_id,
        'trip_tomorrow',
        'Trip starts tomorrow!',
        format('%s starts tomorrow! Get ready for your adventure!', trip_record.title),
        NULL,
        NULL,
        NULL,
        'high',
        format('/trips/%s', trip_record.id)
      );
    END LOOP;
  END LOOP;

  -- Step 2: Auto-set status to 'on-going' for trips starting today
  UPDATE trip_details
  SET status = 'on-going'
  WHERE start_date = CURRENT_DATE
    AND status IN ('active', 'planning');

  -- Step 3: Notify owner about trips that ended yesterday
  FOR trip_record IN
    SELECT t.id, t.title, t.owner_id
    FROM trip_details t
    WHERE t.end_date = CURRENT_DATE - 1
      AND t.status NOT IN ('completed', 'archived', 'cancelled')
  LOOP
    PERFORM create_notification(
      trip_record.owner_id,
      'trip_needs_status',
      'Update your trip status',
      format('Your trip "%s" has ended. Please update the status.', trip_record.title),
      NULL,
      NULL,
      NULL,
      'high',
      format('/trips/%s', trip_record.id)
    );
  END LOOP;

  -- Step 4: Auto-archive trips ended 2+ days ago
  UPDATE trip_details
  SET status = 'archived'
  WHERE end_date < CURRENT_DATE - 1
    AND status NOT IN ('completed', 'archived', 'cancelled');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_trip_status_and_notify TO authenticated;
```

**Step 2: Run migration**

```bash
npm run migrate
```

**Step 3: Commit**

```bash
git add database-migrations/0xx_add_ongoing_trip_status.sql
git commit -m "feat: add trip status notification system"
```

---

## Task 2: Create API Cron Endpoint

**Files:**
- Create: `src/pages/api/cron/trip-status-check.ts`

**Step 1: Write the API endpoint**

```typescript
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";
import { CRON_SECRET } from "astro:env/server";

export const POST: APIRoute = async ({ request }) => {
  // Optional: Verify cron secret from headers
  const authHeader = request.headers.get("Authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("check_trip_status_and_notify");

    if (error) {
      console.error("[cron] Trip status check failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("[cron] Trip status check completed:", data);
    return new Response(JSON.stringify({ success: true, result: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[cron] Trip status check error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
```

**Step 2: Add CRON_SECRET to env**

```bash
# Add to .env
CRON_SECRET=your-secret-key-here
```

**Step 3: Commit**

```bash
git add src/pages/api/cron/trip-status-check.ts
git commit -m "feat: add trip status check cron endpoint"
```

---

## Task 3: Configure Cloudflare Cron

**Files:**
- Modify: `wrangler.toml`

**Step 1: Add cron trigger**

```toml
# Add to existing [triggers] section or create new
[triggers]
crons = ["0 9 * * *"]  # Daily at 9am UTC
```

**Step 2: Commit**

```bash
git add wrangler.toml
git commit -m "feat: add daily cron for trip status notifications"
```

---

## Task 4: Test the Implementation

**Step 1: Test locally**

```bash
# Run the migration first
npm run migrate

# Test the API endpoint manually
curl -X POST http://localhost:4321/api/cron/trip-status-check

# Or with auth header
curl -X POST http://localhost:4321/api/cron/trip-status-check \
  -H "Authorization: Bearer your-secret-key"
```

**Step 2: Check notifications table**

```sql
SELECT * FROM notifications 
WHERE type IN ('trip_tomorrow', 'trip_needs_status')
ORDER BY created_at DESC
LIMIT 10;
```

**Step 3: Verify status changes**

```sql
SELECT id, title, status, start_date, end_date 
FROM trip_details 
WHERE status = 'on-going';
```

---

## Plan complete

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
