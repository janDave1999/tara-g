# Public Trip Share Link Feature

## Current State

The system already supports:
- Share links via `?invite=SHARE_CODE` parameter
- RPC `get_trip_full_details` returns data for public trips to visitors
- Visibility gate blocks private trips for visitors (returns NULL)

## The Problem

1. Trip page redirects ALL unauthenticated visitors to `/404`
2. Even public trips are blocked
3. Facebook/Viber crawlers can't access trip pages to generate previews

## Solution

### Option A: Public Trips Always Visible (Recommended)

Update `src/pages/trips/[trip_id]/index.astro`:

1. Allow page to render when `user_role === 'visitor'` AND trip is public
2. Show visitor-friendly UI:
   - Hide "Join Trip" button → Show "Login to Join" CTA
   - Hide member list / show abbreviated
   - Hide private itinerary sections
   - Show organizer info only (already public)

### Option B: Generate Shareable Links (Existing)

Users can already generate share links from the trip UI:
- Creates a `trip_invitations` row with `invitation_type = 'share_link'`
- Link format: `/trips/[trip_id]?invite=[share_code]`
- Anyone with the link can view the trip

## Implementation Steps

### Step 1: Update Trip Page for Visitors

Modify `src/pages/trips/[trip_id]/index.astro`:

```javascript
// After getting trip data
const { user_role, trip_visibility } = trip;
const isVisitor = user_role === 'visitor';
const isPublicTrip = trip_visibility?.visibility === 'public';

// If visitor trying to access private trip → 404
if (isVisitor && !isPublicTrip) {
  return Astro.redirect('/404');
}

// Continue rendering for public trips or members
```

### Step 2: Adjust UI for Visitors

- Hide "Join Trip" button
- Hide member list (or show count only)
- Hide expense details
- Hide "Leave Trip" / "Delete Trip" buttons
- Show "Login to join this trip" CTA

### Step 3: Generate Meta Tags for Visitors

Ensure OG tags are generated even for visitors (they already are since the page renders server-side).

## Files to Modify

1. `src/pages/trips/[trip_id]/index.astro` - Handle visitor access + UI conditions
2. `src/components/Trip/Summary.astro` - May need visitor props
3. `src/components/Trip/JoinTrip.astro` - Show login CTA for visitors

## Testing Checklist

- [ ] Public trip loads without auth
- [ ] Private trip still returns 404 for visitors
- [ ] Share link works for private trips
- [ ] Facebook debugger can scrape public trip
- [ ] Viber/Messenger preview shows correctly
