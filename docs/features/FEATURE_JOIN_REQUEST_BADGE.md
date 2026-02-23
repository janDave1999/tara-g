# Trip Join Request Badge Feature

## Overview

Add a notification badge to trip cards showing the number of pending join requests. This helps trip owners quickly see which trips have pending requests without navigating to each trip's detail page.

## Current State

- Trip owners can view their trips in the "My Trips" tab on `/trips`
- Each trip shows member count, visibility badge, and status
- Join requests must be viewed by visiting each individual trip

## Requirements

### 1. Database

Add `join_request_count` column to `get_user_owned_trips` function:

```sql
-- In get_user_owned_trips RETURN TABLE:
join_request_count BIGINT

-- Query addition:
(SELECT COUNT(*) FROM trip_members tm 
 WHERE tm.trip_id = t.trip_id 
 AND tm.member_status = 'pending') AS join_request_count
```

### 2. TripCard Component

- **New Prop**: `joinRequestCount?: number`
- **Display**: Show badge when count > 0
- **Position**: Top-right area, next to visibility toggle
- **Style**: 
  - Small circular badge or text badge
  - Color: amber/orange (matching "pending" status)
  - Content: Number only (e.g., "3")

### 3. Frontend Integration

- Pass `joinRequestCount` prop to TripCard for owned trips
- Handle case when count is 0 or undefined (no badge shown)

## Implementation Plan

### Phase 1: Database
1. Create migration file: `database-migrations/038_add_join_request_count.sql`
2. Update `get_user_owned_trips` function to include join_request_count

### Phase 2: Frontend
1. Update `TripCard.astro`:
   - Add `joinRequestCount` prop to interface
   - Add badge rendering logic
   - Style badge appropriately
2. Update `trips/index.astro`:
   - Pass `joinRequestCount` prop when rendering TripCard for owned trips

## UI/UX Specification

### Badge Design
- **Size**: Small (like status badges)
- **Position**: Top-right, next to visibility toggle
- **Color**: Amber/Orange background with white text
- **Content**: Number only (e.g., "3")
- **Behavior**: Only visible when count > 0

### Visual Mockup
```
┌─────────────────────────────────┐
│ [Image]                         │
│                    [🔒] [✓] [3]│  ← Badge appears here
├─────────────────────────────────┤
│ Trip Title                      │
│ 📅 Jan 15 - Jan 20              │
│ 👥 5 members                    │
└─────────────────────────────────┘
```

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `database-migrations/038_add_join_request_count.sql` | Add column to RPC |

### Modified Files
| File | Change |
|------|--------|
| `src/components/TripCard.astro` | Add joinRequestCount prop and badge |
| `src/pages/trips/index.astro` | Pass joinRequestCount to TripCard |

## Acceptance Criteria

1. ✅ Trip owners can see a badge showing number of pending join requests
2. ✅ Badge only appears when count > 0
3. ✅ Badge is visually distinct (different from other badges)
4. ✅ No badge shown for non-owned trips
5. ✅ Works with existing trip card layout

## Notes

- Only counts `member_status = 'pending'` (join requests)
- Does not include invited users (member_status = 'invited')
- Badge is informational only (not clickable in this iteration)
