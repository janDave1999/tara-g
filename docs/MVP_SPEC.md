# MVP Specification — Beta Release

> **Version:** 1.0 (Beta)  
> **Release:** February 2026  
> **Status:** Planned  

---

## 1. MVP Definition

The **Minimum Viable Product (MVP)** for the beta release includes all core features required for users to:
1. Register and complete onboarding
2. Create and publish trips
3. Discover and join trips
4. Build itineraries
5. Manage trip membership

**Goal:** Test core user flows with early adopters before full feature expansion.

---

## 2. Included Features

### 2.1 User Accounts ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password registration | ✅ Included | With DB trigger auto-population |
| Email confirmation | ✅ Included | Auto sign-in via WebSocket, redirect to onboarding |
| Sign in | ✅ Included | With rate limiting |
| Sign out | ✅ Included | |
| Forgot password | ✅ Included | |
| 3-step onboarding | ✅ Included | Profile → Interests → Preferences |
| Own profile view | ✅ Included | |
| Public profile view | ✅ Included | Privacy-aware |

**Excluded from MVP:**
- Social login (Google/Facebook) — configured but not tested
- Profile editing
- Profile completion UI
- Verified badge
- Friend system
- Block system

### 2.2 Trips ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Create trip wizard | ✅ Included | 5-step form |
| Trip detail page | ✅ Included | All info display |
| Edit trip details | ✅ Included | Via modals |
| Trip visibility | ✅ Included | Private/Public/Friends |
| Trip status | ✅ Included | Draft/Active/Completed/Archived |
| Trip sharing | ✅ Included | Web Share API + clipboard |
| Delete trip | ⚠️ Not Tested | Should work via RPC |

**Excluded from MVP:**
- Trip cancellation with notification

### 2.3 Trip Discovery ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Trip listing page | ✅ Included | Owned/Joined/Discover tabs |
| Search by destination | ✅ Included | |
| Filter by tags | ✅ Included | |
| Discover tab | ✅ Included | Personalized recommendations |
| Travel preferences prompt | ✅ Included | |

**Excluded from MVP:**
- Filter by date range
- Filter by budget range

### 2.4 Membership ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Request to join | ✅ Included | |
| Accept/decline requests | ✅ Included | Owner sees requests |
| Accept/decline invitations | ✅ Included | Invited user sees banner |
| Member list | ✅ Included | Owner and members only |
| Leave trip | ✅ Included | Members can leave |
| Remove member | ✅ Included | Owner can remove |

**Excluded from MVP:**
- Invite by username/email (future)

### 2.5 Itinerary ✅

| Feature | Status | Notes |
|---------|--------|-------|
| View itinerary | ✅ Included | Members + public if toggled |
| Add stops | ✅ Included | Mapbox location search |
| Edit stops | ✅ Included | |
| Delete stops | ✅ Included | |
| Time overlap validation | ✅ Included | |
| Add activities | ✅ Included | |
| Edit activities | ✅ Included | |
| Delete activities | ✅ Included | |
| Itinerary visibility toggle | ✅ Included | Members-only/Public |
| Pickup/Dropoff stops | ✅ Included | Max 20 each |

**Excluded from MVP:**
- Drag-drop reordering
- Activity type dropdown (free-text only)
- Actual vs scheduled time tracking

### 2.6 Maps ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Interactive map | ✅ Included | Mapbox GL JS |
| Province search | ✅ Included | |
| Trip markers | ✅ Included | |
| Marker clustering | ✅ Included | |
| Trip detail popup | ✅ Included | |
| "Search this area" | ✅ Included | |
| Geolocation | ✅ Included | |
| Filters | ⚠️ Partial | UI exists, wired |

**Excluded from MVP:**
- Date filters
- Budget filters
- Loading states

---

## 3. Excluded Features (Post-MVP)

The following features are **NOT** in the beta release:

| Feature | Priority | Reason |
|---------|----------|--------|
| Project 82 | P1 | Can be added later |
| Friend System | P1 | Core trips work without |
| Email Notifications | P1 | In-app notifications sufficient |
| Push Notifications | P2 | Phase 2 |
| Expense Tracking | P1 | Add after core is stable |
| Offline Mode | P2 | PH-specific, lower priority |
| Emergency Contacts | P2 | Requires data sourcing |
| Weather Alerts | P2 | Requires API integration |
| Trip Templates | P2 | Nice to have |
| Messaging | P2 | Out of scope |

---

## 4. Technical Requirements

### 4.1 Infrastructure

| Component | Requirement |
|-----------|-------------|
| Database | Supabase with PostGIS |
| Auth | Supabase Auth |
| Storage | Cloudflare R2 |
| Maps | Mapbox GL JS |
| Hosting | Cloudflare Pages |

### 4.2 Required Migrations

| Migration | Purpose |
|-----------|---------|
| 001-015 | Core schema |
| 017 | User trigger |
| 018 | Onboarding RPCs |
| 019 | Password reset |
| 021-023 | Bug fixes |
| 025 | Login protection |
| 026-034 | Trip enhancements |
| 035 | Nearby trips RPC |

### 4.3 Pages Required

```
/                     → Landing page
/register             → Sign up
/signin               → Sign in
/forgot-password      → Reset request
/reset-password       → New password
/onboarding/profile   → Step 1
/onboarding/interests → Step 2
/onboarding/preferences → Step 3
/profile              → Own profile
/profile/[username]   → Public profile
/trips                → Trip listing
/trips/create          → Create wizard
/trips/[trip_id]      → Trip detail
/maps                 → Map discovery
```

---

## 5. Testing Checklist

### 5.1 User Flow Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| New user registration | Register → Confirm email → Onboarding → Complete | User can access all pages |
| Trip creation | Create 5-step wizard → Publish → View | Trip appears in listing |
| Trip discovery | Browse Discover → Search → Filter | Relevant trips shown |
| Join trip | Request → Owner approves → See in Joined | Member list updated |
| Itinerary building | Add stop → Add activity → Toggle visibility | Itinerary displays correctly |

### 5.2 Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate username | Inline error, prevent submit |
| Trip at capacity | Disable join button, show "Trip Full" |
| Invalid dates | Validation prevents past dates |
| Time overlap | Inline error, block save |
| Private trip (non-member) | Redirect to 404 |

---

## 6. Launch Criteria

### 6.1 Functional Requirements

- [ ] User can register and complete onboarding
- [ ] User can create and publish a trip
- [ ] User can discover trips in Discover tab
- [ ] User can view trips on map
- [ ] User can request to join a trip
- [ ] Owner can approve join requests
- [ ] Members can view and edit itinerary
- [ ] Owner can toggle itinerary visibility

### 6.2 Performance Requirements

- [ ] Page load < 3 seconds
- [ ] API response < 1 second
- [ ] No console errors on main flows

### 6.3 Security Requirements

- [ ] All RPCs use SECURITY DEFINER
- [ ] No user ID from client input
- [ ] Rate limiting on login
- [ ] Auth required for protected routes

---

## 7. Post-MVP Roadmap

### Phase 2 (Q2 2026)

1. **Project 82** — Province tracking feature
2. **Push Notifications** — Browser push notifications
3. **Email Notifications** — Action notifications via email
4. **Profile Enhancement** — Edit profile, completion UI
5. **Friend System** — Add friends, view list

### Phase 3 (Q3 2026)

1. **Expense Tracking** — Split costs
2. **Trip Templates** — Reusable configurations
3. **Offline Mode** — Downloadable itineraries

### Phase 4 (Q4 2026)

1. **Emergency Features** — LGU contacts
2. **Weather Alerts** — Trip date warnings
3. **Messaging** — In-app chat

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Feb 2026 | Initial MVP specification |

---

## Related Feature Specs

| Feature | File |
|---------|------|
| Auto Sign-In After Email Confirmation | `FEATURE_AUTO_SIGNIN_EMAIL_CONFIRMATION.md` |
| Email Notifications | `FEATURE_EMAIL_NOTIFICATIONS.md` |
| Join Request Badge | `FEATURE_JOIN_REQUEST_BADGE.md` |

---

*This MVP specification defines the minimum features required for beta release. All features listed as "Included" must be functional and tested before launch.*
