# Trip Share with Auto-Join Feature

## Overview

When users share a trip link with friends who don't have an account, the new user should be redirected to the shared trip after registration and onboarding. Additionally, users who join via a shared trip link should be automatically accepted as members.

## Problem

Currently:
1. User shares a trip link (e.g., `/trips/abc123`)
2. Friend clicks the link but has no account
3. Friend is redirected to sign in, then register
4. After registration and onboarding, friend ends up on `/feeds` or `/trips`
5. Friend must manually find and request to join the original trip
6. Trip owner must approve the join request

This creates friction and delays.

## Proposed Solution

### Feature 1: Redirect to Shared Trip After Onboarding

1. Store the shared trip ID in localStorage when user clicks the link without being logged in
2. After successful registration and onboarding completion, redirect to the stored trip URL
3. Clear the stored trip ID after redirect

### Feature 2: Auto-Accept Member from Shared Link

1. When a user joins a trip via shared link (with stored invite token), auto-approve their membership
2. Skip the approval step for users who come from shared links

## User Flows

### Current Flow
```
User A shares trip link
       ↓
User B clicks link (not logged in)
       ↓
Redirected to /signin
       ↓
Navigates to /register
       ↓
Registers and confirms email
       ↓
Completes onboarding
       ↓
Ends up on /feeds
       ↓
Must find trip manually and request to join
       ↓
Wait for owner approval
```

### Proposed Flow
```
User A shares trip link (e.g., /trips/abc123?ref=owner123)
       ↓
User B clicks link (not logged in)
       ↓
Store trip ID + referrer in localStorage
       ↓
Redirected to /signin → /register
       ↓
Registers and confirms email
       ↓
Completes onboarding
       ↓
Redirected to /trips/abc123
       ↓
Already a member! (auto-approved)
```

## Technical Implementation

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Trip Page  │────▶│  Middleware │────▶│  Onboarding │
│  (no auth) │     │  (store)    │     │  (redirect) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │ 1. Store trip_id                      │ 4. Read trip_id
       │ 2. Redirect to /signin                │ 5. Join trip
       │                                       │ 6. Redirect to trip
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│ localStorage│                         │  Trip Page  │
│ trip_share  │                         │  (member)   │
└─────────────┘                         └─────────────┘
```

### Data Storage

**localStorage:**
```typescript
interface TripShareData {
  tripId: string;
  referrerUserId?: string;  // Who shared the trip
  timestamp: number;
  expiresAt: number;
}
```

Key: `trip_share_pending`
Value: JSON string of TripShareData

### URL Structure

```
/trips/{trip_id}?ref={user_id}
```

- `trip_id`: The shared trip's ID
- `ref`: Optional referrer's user ID (for auto-accept)

### Database Changes

No new tables required. We can use existing tables:

1. **Join Request Auto-Approval:**
   - When user joins via link with valid `ref` token, auto-approve
   - Use existing `trip_members` table
   - No new RPC needed if we handle on client-side

### API Changes

#### Option A: Client-Side Auto-Join (Recommended for MVP)

1. **Onboarding Completion** (`/onboarding/preferences` POST)
   - After successful onboarding, check localStorage for `trip_share_pending`
   - If exists, call `joinTrip` action with auto-accept flag
   - Redirect to trip page

2. **Join Trip Action** (`trip.joinTrip`)
   - Accept optional parameter `autoAcceptedFromShare: boolean`
   - If true and user comes from shared link, skip approval queue
   - Set membership status directly to 'active'

#### Option B: Server-Side Auto-Join (More Secure)

1. **Create Join Token:**
   - Generate unique token when user shares trip
   - Store in `trip_invitations` table
   - Token includes: trip_id, inviter_user_id, expires_at

2. **Redeem Token on Register:**
   - After onboarding, check for valid token
   - Auto-create membership if token valid

### File Changes

#### New Files
| File | Purpose |
|------|---------|
| `src/lib/tripShare.ts` | localStorage utilities for trip sharing |
| `docs/features/FEATURE_TRIP_SHARE_AUTO_JOIN.md` | This spec |

#### Modified Files
| File | Changes |
|------|---------|
| `src/pages/trips/[trip_id].astro` | Store trip ID in localStorage if not logged in |
| `src/pages/onboarding/preferences.astro` | Check localStorage, redirect to trip after onboarding |
| `src/actions/trips.ts` | Add auto-accept logic to joinTrip action |
| `src/components/Trip/Hero.astro` | Add share button with ref param |

### UI/UX

#### Trip Page (Not Logged In)
- Show full trip details (public info)
- Show "Join This Trip" button prominently
- Show "Sign in to join" if not logged in

#### After Registration + Onboarding
- If trip_share_pending exists:
  1. Call joinTrip action
  2. On success: Redirect to `/trips/{trip_id}`
  3. On failure: Show error, redirect to trips list

#### Share Button
- Copy link with ref param: `/trips/{id}?ref={user_id}`
- Use Web Share API if available
- Fallback to clipboard copy

## Security Considerations

1. **Token Expiry:**
   - Store timestamp in localStorage
   - Expire after 24 hours
   - Validate on redirect

2. **Referrer Validation:**
   - Verify referrer is actually a member of the trip
   - Prevent spam by rate-limiting share actions

3. **Auto-Join Protection:**
   - Only auto-accept if valid ref token present
   - Limit auto-accept to one trip per user session
   - Log auto-accept actions for audit

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User already a member | Skip join, just redirect |
| Trip is private | Redirect to signin, then show "Request to Join" |
| Trip is full | Show "Trip Full" message |
| Trip doesn't exist | Show 404 |
| localStorage cleared | Normal flow, no redirect |
| Multiple pending trips | Use most recent |
| User joins different trip first | Clear pending, proceed with new |

## Implementation Phases

### Phase 1: Core (Priority)
1. Add `tripShare` localStorage utilities
2. Modify trip page to store trip ID when not logged in
3. Modify onboarding completion to check and redirect
4. Add auto-accept logic to join action

### Phase 2: Polish
1. Add share button with Web Share API
2. Add "You were invited to join this trip" banner
3. Handle edge cases gracefully
4. Add analytics tracking

## Acceptance Criteria

### Phase 1
- [ ] Clicking shared trip link while logged out stores trip ID
- [ ] After onboarding, user is redirected to shared trip
- [ ] User is automatically a member of the trip
- [ ] Works for both new registrations and existing users

### Phase 2
- [ ] Share button generates correct link with ref param
- [ ] Web Share API works on supported browsers
- [ ] Clipboard copy fallback works
- [ ] "Invited to join" banner shows for ref-based joins

## Related Features

- Trip sharing (existing)
- User registration (existing)
- Email confirmation with auto-signin (existing)
- Onboarding flow (existing)
- Trip membership (existing)

## Timeline Estimate

- Phase 1: 2-3 hours
- Phase 2: 1-2 hours
- Testing: 1 hour

**Total: ~4-6 hours**
