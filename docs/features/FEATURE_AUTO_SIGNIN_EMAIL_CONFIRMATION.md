# Auto Sign-In After Email Confirmation

## Overview

Improve user registration by automatically signing in users when they confirm their email, eliminating the need to go back to sign-in page.

## Problem

Currently after email confirmation:
1. User clicks confirmation link in email
2. Gets redirected to `/register/email-confirmed` page
3. Must manually navigate to `/signin`
4. Enter credentials again
5. Then proceed to profile setup

This creates friction and poor UX.

## Solution

Use WebSocket to detect when the user's email is confirmed in real-time, then automatically:
1. Sign in the user server-side
2. Redirect to profile setup page

## Current Flow
```
Register → Confirmation Page → Email → Confirm Link → Email Confirmed Page → Sign In → Profile Setup
```

## Proposed Flow
```
Register → Confirmation Page (WebSocket) → Email → Confirm Link → WebSocket Notifies → Auto Sign-In → Profile Setup
```

## Technical Implementation

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client     │────▶│  WebSocket  │◀───▶│  Server     │
│  (Browser)  │     │  Server     │     │  (API)      │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │ 1. Connect with session_token         │
       │                                       │
       │ 2. Wait for confirmation             │
       │                                       │
       │ 3. Auto sign-in & redirect            │
       │                                       │
       │◀─── 4. Receive tokens ────────────────│
```

### Database Changes

Add `confirmation_sessions` table to track pending confirmations:

```sql
CREATE TABLE confirmation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  session_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `register_session` | Client → Server | `{ session_token, email }` |
| `email_confirmed` | Server → Client | `{ access_token, refresh_token }` |
| `confirmation_failed` | Server → Client | `{ error }` |

### API Changes

1. **POST /api/auth/register**
   - On successful registration, create a `confirmation_session` record
   - Return `session_token` to client

2. **WebSocket /ws/confirmation**
   - Accept connection with `session_token`
   - Poll/check for email confirmation status
   - Emit `email_confirmed` with tokens when confirmed
   - Auto-cleanup after confirmation or expiry (5 min)

3. **GET /api/auth/confirm**
   - Mark user as confirmed
   - Find pending `confirmation_session`
   - Generate auth tokens
   - Emit tokens via WebSocket OR set cookies and redirect

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `src/pages/api/ws/confirmation.ts` | WebSocket endpoint |
| `src/lib/websocket.ts` | WebSocket client utilities |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/api/auth/register.ts` | Generate session token, store in DB |
| `src/pages/api/auth/confirm.ts` | Emit via WebSocket or set cookies |
| `src/pages/register/confirmation.astro` | WebSocket client, auto-redirect |
| `src/pages/register/email-confirmed.astro` | Simplified fallback |

## UI/UX

### WebSocket Status Indicator
- Show "Connecting..." initially
- Show "Waiting for email confirmation..." when connected
- Show "Email confirmed! Signing you in..." on success
- Fallback countdown timer always visible as backup

### Visual States
```
[Spinner] Connecting...
    ↓
[Checkmark Pulse] Waiting for email confirmation...
    ↓ (user clicks email link)
[Checkmark] Email confirmed!
[Arrow] Signing you in...
    ↓
[Redirect to /onboarding/profile]
```

## Security Considerations

1. **Session Token**
   - Use cryptographically secure random token
   - Expire after 5 minutes
   - One-time use only

2. **WebSocket**
   - Validate session token on connection
   - Rate limit connections
   - Use WSS (WebSocket Secure) in production

3. **Token Storage**
   - Store access token in memory for auto-redirect
   - Set cookies for subsequent requests

## Implementation Phases

### Phase 1: Core
1. Add `confirmation_sessions` table
2. Update register API to generate session token
3. Create WebSocket server endpoint
4. Update confirmation page with WebSocket client
5. Update confirm API to emit via WebSocket

### Phase 2: Polish
1. Add visual states/animations
2. Fallback countdown timer
3. Error handling and retries
4. Test across browsers

## Acceptance Criteria

1. ✅ User sees "Waiting for confirmation" on /register/confirmation
2. ✅ WebSocket connects and listens for confirmation
3. ✅ When user clicks email link, WebSocket receives confirmation
4. ✅ User is automatically signed in (tokens received)
5. ✅ User is redirected to /onboarding/profile
6. ✅ Fallback countdown timer works if WebSocket fails
7. ✅ Works when user opens confirmation link in same browser

## Related Features

- Email confirmation flow (existing)
- Profile onboarding (existing)
- Session management (existing)

## Timeline Estimate

- Phase 1: 2-3 hours
- Phase 2: 1-2 hours
- Testing: 1 hour

**Total: ~4-6 hours**
