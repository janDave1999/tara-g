# User Feature — Detailed Specification

> Track progress: Mark items as `[x]` when completed, `[ ]` when pending.
> Prioritize: P0 = Must have, P1 = Should have, P2 = Nice to have

---

## Overview

The **User** feature covers the complete journey from account creation to a fully-configured profile, including email/password registration, email confirmation, 3-step onboarding, and profile management. Every other feature (trips, feeds, members) depends on a populated `public.users` row — this is the **most critical prerequisite** in the entire system.

---

### Problem Statement

New users to Tara G! face friction when:
- Creating an account requires multiple manual database entries that aren't auto-populated
- Onboarding is disjointed across different pages with no clear progress tracking
- Profile data is incomplete, breaking downstream features (trip members, search, invitations)

This feature consolidates user management into a cohesive flow that automatically populates required data and guides users through setup.

---

### Constraints & Assumptions

#### Constraints (Confirmed)
- Supabase Auth + Database required
- PostGIS enabled for spatial queries
- MapBox integrated for maps
- R2/Cloudflare for image storage

#### Assumptions (Unvalidated)
- [ ] Email delivery working for confirmations
- [ ] Social login providers can be configured (Google/Facebook)
- [ ] Session cookies properly handled across domains

#### Time Estimates (Remaining Work)
| Phase | Estimate |
|-------|----------|
| Phase 4.3: Profile Edit + Completion UI | ~4 hours |
| Phase 4.4: Profile Tabs (Trips/Friends) | ~3 hours |
| Phase 4.5: Verified Badge + Share | ~1 hour |
| Phase 6.1: Friend System UI | ~4 hours |
| Phase 6.2: Block System UI | ~2 hours |
| **Total Remaining** | **~14 hours** |

---

## 1. Current Implementation Summary

### 1.1 Auth Pages

| Route | File | Purpose |
|-------|------|---------|
| `/register` | `src/pages/register.astro` | Sign up (email, password, terms, marketing consent) |
| `/signin` | `src/pages/signin.astro` | Sign in (email/password + social buttons) |
| `/logout` | `src/pages/logout.astro` | Sign out |
| `/api/auth/register` | `src/pages/api/auth/register.ts` | Create `auth.users` entry, redirect to email confirmation |
| `/api/auth/signin` | `src/pages/api/auth/signin.ts` | Authenticate, set cookies, redirect to `/feeds` |
| `/api/auth/callback` | `src/pages/api/auth/callback.ts` | OAuth callback (Google/Facebook) |
| `/api/auth/signout` | `src/pages/api/auth/signout.ts` | Clear cookies, sign out |

### 1.2 Onboarding Pages

| Route | File | Step |
|-------|------|------|
| `/onboarding/profile` | `src/pages/onboarding/profile.astro` | Step 1 — Name, username, avatar, bio, DOB, gender, location |
| `/onboarding/interests` | `src/pages/onboarding/interests.astro` | Step 2 — Select interests (min 3 of 8 categories) |
| `/onboarding/preferences` | `src/pages/onboarding/preferences.astro` | Step 3 — Budget, travel style, pace, accommodation, languages |

### 1.3 Profile Pages

| Route | File | Status |
|-------|------|--------|
| `/profile` | `src/pages/profile/index.astro` | ✅ Own profile view |
| `/profile/[username]` | `src/pages/profile/[username].astro` | ✅ Public profile view |
| `/profile/security` | `src/pages/profile/security.astro` | ⚠️ MFA code commented out |

### 1.4 Actions

| Namespace | File |
|-----------|------|
| `onboarding.*` | `src/actions/index.ts` |
| `auth.*` | `src/actions/auth.ts` |
| `user.*` | `src/actions/user.ts` |

### 1.5 Database Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `users` | Core user row linked to `auth.users` | ✅ Exists |
| `user_information` | Extended profile (DOB, phone, emergency contact) | ✅ Exists |
| `user_travel_preferences` | Budget, style, pace, dietary, accessibility | ✅ Exists |
| `user_interests` | Interest categories with priority | ✅ Exists |
| `user_onboarding_progress` | Step-by-step onboarding state | ✅ Exists |
| `user_settings` | Language, theme, notifications, timezone, currency | ✅ Exists |
| `friends` | Bidirectional friendship pairs | ✅ Exists |
| `friend_requests` | Pending/accepted/declined requests | ✅ Exists |
| `blocks` | Blocker/blocked pairs | ✅ Exists |

---

## 2. The Root Problem

> **When a user creates an account, `public.users` is NOT populated.**

### Why this breaks everything

Every feature queries `public.users` via `auth_id = <supabase_user_id>`:

```sql
-- Used in every member RPC (get_trip_members_complete, search_users_for_invitation, etc.)
JOIN users u ON u.auth_id = tm.user_id

-- Used in trip creation (get_trip_full_details RPC)
JOIN users u ON u.auth_id = t.owner_id
```

If `public.users` has no row for a user, all of these queries silently return null/empty — causing the member management null error reported, missing owner names on trips, and broken invitation search.

### What currently exists

- `/api/auth/register` calls `supabase.auth.signUp()` → creates `auth.users` entry ✅
- **No trigger or hook auto-populates `public.users`** ❌

The missing piece is a PostgreSQL trigger on `auth.users INSERT` that creates the corresponding `public.users` row.

---

## 3. User Stories

### 3.1 Account Creation (P0)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| UA1 | As a visitor, I want to create an account with email and password | 
- [ ] Email field shows inline error for invalid format
- [ ] Password field enforces minimum 8 characters
- [ ] Terms checkbox must be checked to enable submit
- [ ] Submitting valid form creates `auth.users` row AND triggers `handle_new_user` function
- [ ] Success message "Check your email" displays within 1 second | ✅ Form exists |
| UA2 | As a new user, my profile row is created automatically on signup | `public.users` row inserted when `auth.users` row is created (via DB trigger) | ✅ Migration 019 (robust, handles orphaned rows) |
| UA3 | As a new user, I receive a confirmation email to verify my address | Supabase sends confirmation email; user lands on onboarding after clicking link | ✅ Phase 3 — emailRedirectTo set, callback supports next param |
| UA4 | As a user, I want to sign in with email and password | Login sets auth cookies, redirects to `/feeds` or onboarding if not complete | ✅ Implemented |
| UA5 | As a user, I want to sign in with Google or Facebook | Social login via OAuth callback | ⚠️ Partial — buttons exist, handlers show "not available yet" |
| UA6 | As a user, I want to reset my forgotten password | `/forgot-password` page with email input | ✅ Phase 3 |
| UA7 | As a signed-in user, I want to sign out securely | Clears auth cookies, redirects to `/signin` | ✅ Implemented |

### 3.2 Onboarding (P0)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| UO1 | As a new user, I am guided to complete my profile after email confirmation | After confirming email, redirected to `/onboarding/profile` | ✅ Flow implemented - middleware handles redirect |
| UO2 | As a new user, I want to set my display name and username | 
- [ ] Full name input required, max 200 chars
- [ ] Username input required, 3-50 chars, lowercase alphanumeric + underscore
- [ ] Real-time availability check shows ✅ or ❌ within 500ms
- [ ] Duplicate username shows inline error and prevents submit | ✅ Page exists |
| UO3 | As a new user, I want to upload a profile photo | Avatar upload to Supabase Storage in Step 1 | ✅ Implemented |
| UO4 | As a new user, I want to check if my username is available before submitting | Real-time availability check via `check_username_availability` RPC | ✅ Migration 018 |
| UO5 | As a new user, I want to set my interests to personalize my feed | Step 2 — choose min 3 from 8 categories via `set_user_interests` RPC | ✅ Migration 018 |
| UO6 | As a new user, I want to set my travel preferences | Step 3 — budget, style, pace, dietary, etc. via `set_travel_preferences` RPC | ✅ Migration 018 |
| UO7 | As a new user, I want to skip onboarding steps and finish later | Each step has a "Skip" option via `skip_onboarding_step` RPC | ✅ Migration 018 |
| UO8 | As a new user, I want to see my onboarding progress | Progress indicator shows Step 1/2/3 | ✅ UI likely exists |
| UO9 | As a returning user, I am NOT shown onboarding if already completed | Check `get_onboarding_status` RPC on page load | ✅ Migration 018 |
| UO10 | As a returning user, I am redirected to remaining onboarding steps if skipped | Incomplete steps re-presented on next sign in | ✅ Implemented via middleware |

### 3.3 Profile Management (P1)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| UP1 | As a user, I want to view my profile | `/profile` shows name, username, avatar, bio, stats (trips, friends) | ✅ Implemented |
| UP2 | As a user, I want to edit my profile | 
- [ ] Click "Edit Profile" opens modal with current data
- [ ] Editable fields: full_name, bio, location_city, location_country
- [ ] **Note: Avatar is handled separately** - see UP2b
- [ ] Cancel button discards changes, confirms if dirty
- [ ] Save button shows loading state, then success toast
- [ ] Inline validation with error messages | ❌ Not implemented |
| UP2a | As a user, I want to see my profile completion progress |
- [ ] Shows percentage bar (0-100%)
- [ ] Below 100%, shows actionable "Complete your profile" prompt
- [ ] Clicking prompt navigates to relevant onboarding step | ❌ Not implemented |
| UP2b | As a user, I want to upload/change my profile picture |
- [ ] Click avatar opens dedicated avatar editor
- [ ] File picker for image selection
- [ ] Live preview before saving
- [ ] Immediate upload to Supabase Storage on selection
- [ ] Success/error feedback shown
- [ ] Works independently of profile edit | ❌ Not implemented |
| UP3 | As a user, I want to update my travel preferences | Revisit Step 3 data from profile settings | ❌ Not implemented |
| UP4 | As a user, I want to update my interests | Revisit Step 2 data from profile settings | ❌ Not implemented |
| UP5 | As a user, I want to see my trips on my profile | 
- [ ] Tabs: Owned trips / Joined trips
- [ ] Each tab shows trip cards with thumbnail, title, dates
- [ ] Empty state if no trips in category | ❌ Not implemented |
| UP6 | As a user, I want to change my email address | Requires re-confirmation | ❌ Not implemented |
| UP7 | As a user, I want to change my password | Current + new password form | ❌ Not implemented |
| UP8 | As a user, I want to set up two-factor authentication | TOTP via authenticator app | ⚠️ Code commented out |
| UP9 | As a user, I want to see another user's public profile | `/profile/[username]` shows public info | ✅ Implemented — privacy-aware by viewer relationship |
| UP10 | As a user, I want to set my profile to private | Toggle in settings | ❌ Not implemented |
| UP11 | As a user, I want to share my profile |
- [ ] "Share Profile" button generates shareable link
- [ ] Copy to clipboard with visual feedback
- [ ] Optional: Share to social media | ❌ Not implemented |
| UP12 | As a user, I want to see a verified badge | 
- [ ] Blue checkmark displays next to name if is_verified = true
- [ ] Tooltip on hover: "Verified account" | ❌ Not implemented |

### 3.4 Friends & Social (P1)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| UF1 | As a user, I want to send a friend request | 
- [ ] "Add Friend" button on public profile
- [ ] Click → POST to `friend_requests` table (status: pending)
- [ ] Button changes to "Request Sent" (disabled)
- [ ] Toast notification: "Friend request sent" | ❌ Not implemented |
| UF2 | As a user, I want to accept or decline friend requests |
- [ ] Notification badge on header when pending requests exist
- [ ] Dropdown/panel shows list of pending requests
- [ ] Each request shows: avatar, name, "Accept" / "Decline" buttons
- [ ] Accept → creates friendship pair, notifieser
- [ request ] Decline → deletes request, no notification | ❌ Not implemented |
| UF3 | As a user, I want to see my friends list |
- [ ] `/profile/friends` or profile tab shows all friends
- [ ] Grid of friend cards (avatar + name)
- [ ] Click navigates to friend's profile
- [ ] Pagination if > 20 friends | ❌ Not implemented |
| UF4 | As a user, I want to block another user |
- [ ] "Block" option in profile menu (three dots)
- [ ] Confirmation modal: "Block @username? They won't see your profile."
- [ ] Block → inserts into `blocks` table
- [ ] Blocked user sees 404 on your profile | ❌ Not implemented |
| UF5 | As a user, I want to unfriend someone |
- [ ] "Unfriend" button on friend profile
- [ ] Confirmation: "Unfriend @username?"
- [ ] Removes friendship from both `friends` table rows | ❌ Not implemented |

---

## 4. Technical Details

### 4.1 The Missing Trigger — auth.users → public.users

This is the **#1 gap** to fix. A Supabase `handle_new_user` trigger runs when a row is inserted into `auth.users` and creates the corresponding `public.users` row.

**Required behavior:**
- Fires on `AFTER INSERT ON auth.users`
- Inserts into `public.users` with: `auth_id`, `email`, `username` (generated from email prefix), `full_name` (from OAuth metadata if available)
- Also inserts skeleton rows into: `user_settings`, `user_information`
- Username must be made unique if collision (append random suffix)

**Schema mapping from `auth.users`:**

| `auth.users` field | → `public.users` field |
|--------------------|------------------------|
| `id` | `auth_id` |
| `email` | `email` |
| `raw_user_meta_data->>'full_name'` | `full_name` |
| `raw_user_meta_data->>'avatar_url'` | `avatar_url` |
| *(generated from email)* | `username` |

### 4.2 Missing RPC Functions

All onboarding actions call RPCs that do not exist in any migration file:

| RPC Function | Called By | Purpose | Migration |
|--------------|-----------|---------|-----------|
| `handle_new_user` (trigger fn) | `auth.users INSERT` | Auto-create `public.users` row | ✅ Migration 017 |
| `check_username_availability` | `onboarding.checkUsername` | Check if username is taken | ✅ Migration 018 |
| `update_user_profile` | `onboarding.updateProfile` | Save Step 1 profile data | ✅ Migration 018 |
| `set_user_interests` | `onboarding.setInterests` | Save Step 2 interest selections | ✅ Migration 018 |
| `set_travel_preferences` | `onboarding.setTravelPreferences` | Save Step 3 travel preferences | ✅ Migration 018 |
| `skip_onboarding_step` | `onboarding.skipOnboardingStep` | Record a step as skipped | ✅ Migration 018 |
| `complete_user_onboarding` | `onboarding.completeOnboarding` | Mark onboarding done | ✅ Migration 018 |
| `get_onboarding_status` | `onboarding.getOnboardingStatus` | Check which steps are complete | ✅ Migration 018 |
| `get_user_profile_data` | `onboarding.getUserProfileData` | Load all profile data for display | ✅ Migration 018 |
| `get_user_stats` | `onboarding.getUserStats` | Trip count, friend count, etc. | ✅ Migration 018 |

### 4.3 Session & Auth Cookie Pattern

Auth state is stored in three cookies (set in `/api/auth/signin` and `/api/auth/callback`):

| Cookie | Value | TTL |
|--------|-------|-----|
| `sb-access-token` | JWT access token | 7 days |
| `sb-refresh-token` | Refresh token | 30 days |
| `sb-session-id` | Session identifier | Session |

All cookies are: `httpOnly`, `secure` (production), `sameSite: strict`, `path: /`.

**Page-level auth check pattern** (used in all protected pages):
```typescript
const accessToken = Astro.cookies.get("sb-access-token");
const refreshToken = Astro.cookies.get("sb-refresh-token");
if (!accessToken || !refreshToken) {
  return Astro.redirect("/signin");
}
```

> **Note:** Global middleware implemented in `src/middleware/index.ts`. All protected pages now use centralized auth checking.

### 4.4 Key Validation Rules

| Field | Rule |
|-------|------|
| `email` | Valid email format, unique in `auth.users` and `public.users` |
| `password` | Min 8 characters |
| `username` | 3–50 chars, lowercase alphanumeric + underscore only, unique |
| `full_name` | Max 200 chars |
| `bio` | Free text |
| `date_of_birth` | Must be in the past; age ≥ 18 recommended |
| `phone_number` | E.164 format preferred |

### 4.5 Profile Completion Calculation

An existing trigger in migration 006 auto-calculates `profile_completion_percentage` based on:

| Field | Weight |
|-------|--------|
| `full_name` | 10% |
| `avatar_url` | 15% |
| `bio` | 10% |
| `is_verified` | 5% |
| `phone_number` | 10% |
| `date_of_birth` | 10% |
| `location_country` | 10% |
| `emergency_contact_name` + phone | 15% |
| `travel_style` (any) | 10% |
| `languages_spoken` (any) | 5% |

---

## 5. V1 Minimum Scope

### Must Have (Launch Blockers)
1. Account registration with auto-population of `public.users`
2. Email confirmation flow
3. 3-step onboarding wizard
4. Login with rate limiting protection
5. Profile view (own and public)

### Should Have (Launch Quality)
1. Edit profile inline (with modal)
2. Profile privacy toggle
3. Social login (Google/Facebook)
4. Profile completion progress UI
5. Verified badge display
6. Profile tabs (Trips / Friends)
7. Add Friend / Message buttons on public profiles

### Could Have (Post-Launch)
1. Friend system UI (requests, list, unfriend)
2. Block system UI
3. MFA/2FA
4. Account deletion (GDPR)
5. Data export (GDPR)
6. Profile sharing (copy link)
7. Profile QR code

### Explicitly Not in V1
- Trip tabs on profile (belongs to Trip feature)
- Messaging between users (belongs to Social feature)
- Dark mode (belongs to Settings/Theme feature)

---

## 6. Current Gaps

### 6.1 P0 — Blocking (Fix First)

- [x] ~~**Missing `handle_new_user` trigger**~~ — Fixed in migration 017. Trigger now auto-populates `public.users`, `user_settings`, `user_information` on signup. Backfills existing users.
- [x] ~~**Missing onboarding RPC functions**~~ — Fixed in migration 018. All 9 functions created.
- [x] ~~**Email confirmation → onboarding redirect**~~ — Fixed in Phase 3: `register.ts` passes `emailRedirectTo`, `callback.ts` forwards `next` param.
- [x] ~~**`/forgot-password` page missing**~~ — Created in Phase 3 along with `/reset-password`.
- [x] ~~**Profile completion infinite recursion**~~ — Fixed in migration 022. Dropped `trigger_user_info_completion` that caused infinite loop.
- [x] ~~**Onboarding redirect loop**~~ — Fixed in migration 023. Changed RPC field `is_complete` to `onboarding_completed`.

### 6.2 P1 — Should Fix Soon

- [x] ~~**Global middleware**~~ — Implemented in `src/middleware/index.ts`. Protects routes, handles auth, redirects to onboarding if incomplete.
- [x] ~~**Login attempt protection**~~ — Rate limit failed logins with progressive cooldown (5min/15min/30min). Migration 025 created, signin.ts and signin.astro updated.
- [x] ~~**Onboarding Cloudflare build errors**~~ — Fixed TypeScript errors in all 3 onboarding pages. Root cause: orphaned `<script define:vars>` open tags (no body/close) caused the language server to parse entire HTML templates as script body. Also reconstructed missing HTML template in `preferences.astro`. All pages now use `data-*` attribute pattern to pass SSR values to client scripts.
- [x] ~~**`/profile/[username]` public view**~~ — Route created, fetches by username via `get_profile_by_username` RPC (Migration 026), applies privacy rules by viewer relationship.
- [ ] **Social login** (Google/Facebook) — Code ready, awaiting Supabase/Google/Facebook configuration. See `docs/SOCIAL_LOGIN_SETUP.md`
- [ ] **Profile edit modal** — Implement edit profile UI with inline editing
- [ ] **Profile completion UI** — Progress bar + actionable prompts
- [ ] **Verified badge** — Display blue checkmark for verified users
- [ ] **Profile tabs** — Owned Trips / Joined Trips / Friends sections
- [ ] **Friend action buttons** — Add Friend, Message, Unfriend buttons on public profiles

### 6.3 P2 — Nice to Have

- [ ] **MFA / 2FA** — TOTP code exists but is commented out.
- [ ] **Friends system UI** — Tables exist, no UI for friend requests/listing.
- [ ] **Block system UI** — Table exists, no UI.
- [ ] **Email change** — Requires Supabase auth flow + re-confirm.
- [ ] **Account deletion** — GDPR compliance: self-service deletion flow
- [ ] **Data export** — GDPR compliance: download user data as JSON/CSV
- [ ] **Profile sharing** — Copy link, share to social
- [ ] **Profile QR code** — Scan to view profile
- [ ] **Empty states** — Friendly guidance for incomplete profiles
- [ ] **Skeleton loaders** — Loading states with shimmer effect

---

## 7. Implementation Phases

### Phase 1: Fix the Root Cause (P0)

- [x] ~~Create `017_handle_new_user_trigger.sql`~~
  - ~~`handle_new_user()` trigger function on `auth.users INSERT`~~
  - ~~Auto-populates: `public.users`, `user_settings`, `user_information`~~
  - ~~Generates unique username from email prefix~~
  - ~~Reads OAuth metadata (`full_name`, `avatar_url`) if present~~
- [x] ~~Backfill existing `auth.users` that have no `public.users` row~~
- [x] ~~Test checklist created~~ — See `TESTING_CHECKLIST.md`

### Phase 2: Onboarding RPCs (P0)

- [x] ~~Create `018_onboarding_rpcs.sql` with all 9 missing functions~~
  - ~~`check_username_availability`~~
  - ~~`update_user_profile`~~
  - ~~`set_user_interests`~~
  - ~~`set_travel_preferences`~~
  - ~~`skip_onboarding_step`~~
  - ~~`complete_user_onboarding`~~
  - ~~`get_onboarding_status`~~
  - ~~`get_user_profile_data`~~
  - ~~`get_user_stats`~~
- [x] ~~All action parameters verified against RPC signatures~~
  - ~~`gender: 'non-binary'` → mapped to `'other'` (DB constraint)~~
  - ~~`pace_preference: 'packed'` → mapped to `'fast'` (DB constraint)~~
  - ~~`nationality` column added to `user_information`~~
- [x] ~~Test checklist created~~ — See `TESTING_CHECKLIST.md`

### Phase 3: Email Confirmation & Password Reset (P0)

- [x] ~~Confirm Supabase email redirect URL → `/onboarding/profile`~~ — Fixed in `register.ts` (emailRedirectTo) + `callback.ts` (next param)
- [x] ~~Create `/forgot-password` page (send reset email)~~ — Done (Phase 3)
- [x] ~~Create `/reset-password` page (new password form, handles token from email)~~ — Done (Phase 3)

### Phase 4: Profile Page (P1) - IN PROGRESS

- [x] ~~Build out `/profile/index.astro`~~ — Own profile view with stats
- [x] ~~Create `/profile/[username].astro`~~ — Public profile view with privacy rules by relationship (owner/friend/visitor)
- [ ] Inline edit: name, bio, avatar, location (modal form)
- [ ] Profile completion progress bar + prompts
- [ ] Verified badge display
- [ ] Tabs: owned trips / joined trips / friends
- [ ] Share profile button

### Phase 5: Global Middleware (P1)

- [x] ~~Create `src/middleware/index.ts`~~
  - ~~Protect all `/trips/*`, `/feeds`, `/profile/*`, `/onboarding/*` routes~~
  - ~~Redirect unauthenticated → `/signin`~~
  - ~~Redirect authenticated with incomplete onboarding → `/onboarding/profile`~~
  - ~~Remove per-page cookie checks~~

### Phase 6: Social & Safety (P2)

- [ ] Friend request send UI (button on profile, request creation)
- [ ] Friend request accept/decline UI (notification + action buttons)
- [ ] Friends list page (`/profile/friends` or tab)
- [ ] Unfriend functionality
- [ ] Block/unblock UI (profile menu, confirmation modal)
- [ ] MFA (TOTP) — uncomment and complete existing code
- [ ] Social login (Google/Facebook) — complete OAuth handlers
- [ ] Account deletion (GDPR self-service)
- [ ] Data export (GDPR)
- [x] ~~**Login attempt protection**~~ — Rate limiting for failed login attempts (Migration 025)

---

## 7.1 Login Attempt Protection ✅ COMPLETED

### Problem

Brute force attacks can attempt to guess user passwords. Without protection, attackers can make unlimited attempts.

### Solution

Implemented login attempt tracking with progressive cooldown:

| Failed Attempts | Cooldown Period |
|-----------------|-----------------|
| 1-4 attempts   | No cooldown     |
| 5 attempts      | 5 minutes       |
| 6 attempts      | 15 minutes      |
| 7+ attempts     | 30 minutes      |

### Implementation Complete

**Database:**
- Migration `025_login_attempt_protection.sql` created
- `login_attempts` table tracks failed attempts
- RPC functions: `check_login_cooldown`, `record_login_attempt`

**Backend (`signin.ts`):**
- Checks cooldown before attempting login
- Records failed/successful attempts
- Returns 429 with `RATE_LIMITED` code when in cooldown

**Frontend (`signin.astro`):**
- Handles 429 status and rate limit errors
- Shows countdown timer on submit button
- Disables button during cooldown period
- Prevents form submission while in cooldown

---

## 7.2 Profile Page Implementation

### Overview

Profile pages need to support three user types:
1. **Owner** - Viewing their own profile
2. **Friend** - Viewing a friend's profile  
3. **Visitor** - Viewing a public profile (not a friend)

### Available Data from Database

**users table:**
- username, email, full_name, avatar_url, bio, is_verified, is_private, created_at

**user_information table:**
- first_name, last_name, phone_number, date_of_birth, gender, location_city, location_country, nationality, profile_completion_percentage

**user_travel_preferences table:**
- budget_range, travel_style, pace_preference, accommodation_type, languages_spoken

**user_interests table:**
- Interest categories

**friends table:**
- Friend count

### Profile View by User Type

#### Owner View (`/profile`)
| Section | Content |
|---------|---------|
| **Header** | Avatar, full name, username, verified badge |
| **Stats** | Trips owned, Trips joined, Friends count |
| **About** | Bio, Location (city, country), Member since |
| **Interests** | Interest tags |
| **Travel Preferences** | Budget, travel style, pace, languages |
| **Edit Button** | Edit profile (name, bio, avatar, location) |
| **Settings Link** | Account settings, privacy settings |

#### Friend View (`/profile/[username]`)
| Section | Content |
|---------|---------|
| **Header** | Avatar, full name, username, verified badge |
| **Stats** | Trips owned, Trips joined, Friends count |
| **About** | Bio, Location |
| **Interests** | Interest tags |
| **Travel Preferences** | (Optional - if shared) |
| **Action Buttons** | Message, Unfriend |
| **Trip Section** | Public trips they're part of |

#### Visitor View (`/profile/[username]`)
| Section | Content |
|---------|---------|
| **Header** | Avatar, username |
| **Stats** | Trips shared publicly, Friends count |
| **About** | Bio only |
| **Interests** | Interest tags (if public) |
| **Action Buttons** | Add Friend |
| **Trip Section** | Only public trips |

### Privacy Matrix

| Field | Owner | Friend | Visitor |
|-------|-------|--------|---------|
| Full Name | ✅ | ✅ | ❌ (username only) |
| Bio | ✅ | ✅ | ✅ |
| Location | ✅ | ✅ | ❌ |
| Email | ✅ | ❌ | ❌ |
| Phone | ✅ | ❌ | ❌ |
| Interests | ✅ | ✅ | Configurable |
| Travel Preferences | ✅ | Configurable | ❌ |
| Trips | ✅ | Friends-only | Public only |

### Implementation Plan

**Phase 4.1: Own Profile (`/profile`)** - ✅ COMPLETED
1. ✅ `/profile/index.astro` created
2. ✅ Uses `get_user_profile_data` RPC to fetch profile
3. ✅ Uses `get_user_stats` RPC for stats
4. ✅ Displays profile sections: header, stats, about, interests, preferences
5. [ ] Edit profile modal/button — still pending

**Phase 4.2: Public Profile (`/profile/[username]`)** - ✅ COMPLETED
1. Create `/profile/[username].astro` dynamic route - ✅
2. Fetch profile by username (not auth_id) - ✅ (via `get_profile_by_username` RPC)
3. Check friendship status for viewer - ✅
4. Apply privacy rules based on relationship - ✅
5. Show appropriate action buttons - ✅

**Phase 4.3: Profile Edit**
1. Create edit profile modal component
2. Inline edit for name, bio, avatar
3. Link to onboarding for interests/preferences

### 7.4 Edit Profile Modal Specification

> **Note:** Avatar upload is handled separately from profile edit. See [AvatarEditor Component](#77-avatar-editor-component).

#### Modal Layout
```
┌────────────────────────────────────────┐
│  Edit Profile                    [X]  │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────┐  (Avatar shown here)  │
│  │   [Avatar]   │  but NOT editable   │
│  │   120px     │  - separate modal    │
│  └──────────────┘                      │
│  [Change Photo →] link to avatar modal  │
│                                        │
│  Display Name                         │
│  [________________]                    │
│                                        │
│  Username                             │
│  [@___________] ✅ Available           │
│                                        │
│  Bio                                  │
│  [__________________]                 │
│  [160 characters remaining]            │
│                                        │
│  Location                             │
│  City: [_______] Country: [_______]   │
│                                        │
│  [Cancel]            [Save Changes]    │
└────────────────────────────────────────┘
```

#### Component Specifications
| Element | Specification |
|---------|---------------|
| Modal Overlay | #000000 50% opacity, click-outside to close |
| Modal Width | 480px desktop, 100% mobile |
| Avatar Display | 120px circle, read-only, "Change Photo" link below |
| Avatar Upload | Opens separate AvatarEditor modal (see Section 7.7) |
| Input Fields | Full width, 44px height, 8px border-radius |
| Character Counter | Shows remaining for bio (160 max) |
| Save Button | Primary style, disabled until changes detected |
| Loading State | Spinner + "Saving..." during API call |
| Success | Toast notification, close modal, refresh profile |
| Error | Inline error message below field |

### 7.7 Avatar Editor Component (NEW)

> **Architectural Decision:** Avatar upload is separated from profile edit for better UX and cleaner error handling.

#### Purpose
Allow users to upload/change their profile picture independently from editing other profile information.

#### User Flow
1. User clicks avatar or "Change Photo" link on profile
2. Avatar Editor modal opens with current avatar displayed
3. User selects new image file
4. Live preview shown immediately
5. User clicks "Save" → uploads to Cloudflare R2 → updates `users.avatar_url`
6. Success/error feedback shown

#### Storage Architecture
- **Provider:** Cloudflare R2 (not Supabase Storage)
- **Path Structure:** `user/[user_id]/profile-pictures/[timestamp]-[random].[ext]`
- **Upload Method:** Base64 encoding via R2 API

#### Modal Layout
```
┌────────────────────────────────────────┐
│  Change Profile Photo             [X]  │
├────────────────────────────────────────┤
│                                        │
│         ┌──────────────┐               │
│         │   [Avatar]   │               │
│         │   150px     │               │
│         │   Preview    │               │
│         └──────────────┘               │
│                                        │
│    [Choose Image]  (file input)        │
│                                        │
│    Supported: JPG, PNG, GIF (max 5MB) │
│                                        │
│  [Cancel]            [Save Photo]      │
└────────────────────────────────────────┘
```

#### Features
| Feature | Description |
|---------|-------------|
| File Selection | Native file picker, filtered to images only |
| Live Preview | Shows selected image before uploading |
| File Validation | Type (image/*), Size (max 5MB) |
| Upload | Uses new `actions.user.uploadAvatarToR2` for R2 upload |
| Progress | Shows loading state during upload |
| Error Handling | Displays clear error messages for failures |
| Success | Auto-closes modal, profile updates immediately |

#### Backend Requirements
- **New:** `actions.user.uploadAvatarToR2` - uploads to R2, returns public URL
- **Existing:** `update_user_profile` RPC - updates avatar_url in database
- **R2 Utility:** `src/scripts/R2/upload.ts` - existing uploadToR2 function
- **Example Reference:** `src/actions/trips.ts` - existing R2 upload pattern

### Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `src/pages/profile/index.astro` | ✅ Done - Own profile view | - |
| `src/pages/profile/[username].astro` | ✅ Done - Public profile view | - |
| Database RPC: `get_profile_by_username` | ✅ Create - Migration 026 | - |
| `src/components/Profile/ProfileHeader.astro` | Create - Avatar, name, username | P1 |
| `src/components/Profile/ProfileStats.astro` | Create - Trip/friend counts | P1 |
| `src/components/Profile/ProfileAbout.astro` | Create - Bio, location | P1 |
| `src/components/Profile/ProfileInterests.astro` | Create - Interest tags | P1 |
| `src/components/Profile/ProfilePreferences.astro` | Create - Travel prefs | P1 |
| `src/components/Profile/EditProfileModal.astro` | Refactor - Remove avatar, text only | P1 |
| `src/components/Profile/AvatarEditor.astro` | **Create NEW** - Separate avatar upload | P1 |
| `src/components/Profile/ProfileTabs.astro` | Create - Tabs navigation | P1 |
| `src/components/Profile/ProfileCompletion.astro` | Create - Progress bar | P1 |
| `src/components/Profile/VerifiedBadge.astro` | Create - Blue checkmark | P1 |
| `src/components/Profile/FriendActions.astro` | Create - Follow/Message buttons | P1 |
| `src/components/Profile/ShareProfile.astro` | Create - Share modal | P2 |
| `src/components/ui/Skeleton.astro` | Create - Loading skeleton | P2 |
| `src/components/ui/EmptyState.astro` | Create - Empty state | P2 |
| `src/actions/profile.ts` | Create - Profile actions | P1 |
| `src/actions/friends.ts` | Create - Friend actions | P2 |
| Database RPC: `update_user_profile` | ✅ Exists - Migration 018 | - |
| Database RPC: `send_friend_request` | Create - New | P2 |
| Database RPC: `accept_friend_request` | Create - New | P2 |
| Database RPC: `decline_friend_request` | Create - New | P2 |
| Database RPC: `unfriend_user` | Create - New | P2 |
| Database RPC: `block_user` | Create - New | P2 |
| Database RPC: `unblock_user` | Create - New | P2 |

---

## 7.3 Modern UI/UX Requirements (Based on Industry Best Practices)

Based on analysis of modern social media platforms (Instagram, LinkedIn, X/Twitter, TikTok, Figma), the following UX patterns should be implemented:

### 7.3.1 Profile Layout Guidelines

#### Desktop Layout (min-width: 1024px)
```
┌─────────────────────────────────────────────────────────┐
│                      HEADER                              │
│  [Cover Image - Optional 1500x500px]                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐   NAME + USERNAME + BADGES    [Edit]    │
│  │  Avatar  │   @username                      [Follow]│
│  │  150px   │                                          │
│  └──────────┘   STATS: 12 Trips | 48 Friends          │
├─────────────────────────────────────────────────────────┤
│  [About] [Trips] [Friends]  ← TABS                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                  CONTENT AREA                           │
│              (Tab-dependent content)                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Mobile Layout (max-width: 768px)
```
┌─────────────────┐
│ [Cover - 100%] │
├─────────────────┤
│   ┌───┐ NAME   │
│   │Ava│ @user  │
│   │tar│        │
│   └───┘ STATS  │
├─────────────────┤
│ [Follow] [Msg] │
├─────────────────┤
│ [About│Trips│  │
│ Friends]        │
├─────────────────┤
│                 │
│   CONTENT       │
│                 │
└─────────────────┘
```

#### Visual Hierarchy (per UX best practices)
1. **Identity Zone** (top-left) — Avatar, name, username, verification badge
2. **Action Zone** (top-right) — Primary CTAs (Edit Profile, Follow, Message)
3. **Stats Bar** — Horizontal cards showing key metrics
4. **Navigation Tabs** — Segmented controls (sticky on scroll)
5. **Content Area** — Scrollable content below tabs

### 7.3.2 Component Specifications

#### Profile Header
| Element | Specification |
|---------|---------------|
| Avatar Size | 150px desktop, 80px mobile |
| Avatar Shape | Circle with 2px border |
| Cover Image | 1500x500px (desktop), full-width (mobile) |
| Name Font | 24px bold, #1a1a1a |
| Username | 14px, #666666, @ prefix |
| Verified Badge | 20px icon, #1da1f2 |
| Edit Button | Outlined, 40px height min |

#### Stats Cards
| Element | Specification |
|---------|---------------|
| Layout | Horizontal flex, equal width |
| Number | 18px bold |
| Label | 12px regular, #888888 |
| Spacing | 24px gap between items |
| Min Touch Target | 44px height (mobile) |

#### Tab Navigation
| Element | Specification |
|---------|---------------|
| Style | Segmented control (iOS) or underline (Android) |
| Active State | Bold text, colored underline 2px |
| Inactive State | Regular weight, no underline |
| Sticky Behavior | Fixed to top on scroll past header |
| Animation | 200ms ease-out transition |

#### Action Buttons
| Element | Specification |
|---------|---------------|
| Primary (Follow) | Filled, #1da1f2, 36px height |
| Secondary (Message) | Outlined, #1da1f2, 36px height |
| States | Default → Hover (darken 10%) → Active (darken 15%) → Disabled (opacity 0.5) |
| Loading | Spinner + "Loading..." text |
| Min Width | 120px |

### 7.3.3 Micro-interactions & Animations

| Interaction | Trigger | Animation |
|-------------|---------|-----------|
| Button Hover | Mouse enter | Scale 1.02, 150ms |
| Button Click | Mouse down | Scale 0.98, 100ms |
| Tab Switch | Click | Underline slide, 200ms |
| Avatar Hover | Mouse enter | Subtle glow, box-shadow |
| Card Hover | Mouse enter | translateY(-2px), shadow increase |
| Skeleton Loading | Data fetch | Pulse animation 1.5s infinite |
| Success Toast | Action complete | Slide in from top, 300ms |

### 7.3.4 Accessibility Requirements (WCAG 2.1 AA)

| Requirement | Specification |
|-------------|--------------|
| Color Contrast | 4.5:1 minimum for text |
| Focus Indicators | 2px outline, #1da1f2 |
| Keyboard Navigation | All actions keyboard-accessible |
| Screen Reader | ARIA labels for all interactive elements |
| Touch Targets | Minimum 44x44px |
| Focus Order | Logical tab order (left-to-right, top-to-bottom) |

### 7.3.5 Missing UX Features

| Feature | Modern Standard | Priority |
|---------|----------------|----------|
| **Profile Completion UI** | Progress bar + actionable prompts | P1 |
| **Empty States** | Friendly illustrations + CTAs to complete | P1 |
| **Skeleton Loaders** | Shimmer effect while loading | P1 |
| **Verified Badge** | Blue checkmark next to name | P1 |
| **Share Profile** | Copy link, share to social | P2 |
| **Profile QR Code** | Scan to view profile | P2 |

---

## 8. File Structure

```
database-migrations/
├── 006_critical_user_social_fixes.sql   # users, user_information, user_travel_preferences,
│                                        # user_interests, user_onboarding_progress, user_settings,
│                                        # friends, friend_requests, blocks + triggers
├── 007_enhanced_social_features.sql     # notifications, messages, reviews, reputation
├── 009_add_preferences_prompt.sql       # preferences_prompt_until column in user_settings
├── 017_handle_new_user_trigger.sql       # ✅ auto-populate public.users on auth signup
├── 018_onboarding_rpcs.sql             # ✅ all 9 onboarding RPC functions
├── 021_trigger_with_logging.sql         # ✅ debug trigger with RAISE LOG statements
├── 022_fix_profile_completion_recursion.sql  # ✅ fix infinite recursion
├── 023_fix_onboarding_status_field.sql  # ✅ fix onboarding_completed field name
├── 025_login_attempt_protection.sql     # ✅ rate limiting for failed logins
├── 026_get_profile_by_username.sql      # ✅ public profile by username RPC

src/
├── pages/
│   ├── register.astro
│   ├── signin.astro                    # ✅ Cooldown UI implemented
│   ├── logout.astro
│   ├── forgot-password.astro           # ✅ Migration 019 (Phase 3)
│   ├── reset-password.astro           # ✅ Migration 019 (Phase 3)
│   ├── api/auth/
│   │   ├── register.ts
│   │   ├── signin.ts                  # ✅ Attempt tracking implemented
│   │   ├── callback.ts
│   │   ├── signout.ts
│   │   └── resend-confirmation.ts
│   ├── onboarding/
│   │   ├── profile.astro              # Step 1
│   │   ├── interests.astro             # Step 2
│   │   └── preferences.astro          # Step 3
│   └── profile/
│       ├── index.astro                # ✅ Own profile view
│       ├── [username].astro           # ✅ Public profile view (privacy-aware)
│       └── security.astro             # ⚠️ MFA commented out
├── actions/
│   ├── index.ts                      # onboarding.* actions
│   ├── auth.ts                       # auth.* actions
│   └── user.ts                       # user.* actions
└── middleware/
    └── index.ts                      # ✅ Global auth & onboarding middleware (Phase 5)
```

---

## 9. Complete Signup Flow (Current vs Target)

### Current (Broken)

```
User fills /register
  → POST /api/auth/register
  → supabase.auth.signUp() → auth.users row created ✅
  → "Check your email" message shown
  → User confirms email
  → Redirect to ??? (unclear)
  → public.users = EMPTY ❌
  → Onboarding RPC calls = FAIL ❌
  → Trip member queries = return null ❌
```

### Target (Complete)

```
User fills /register
  → POST /api/auth/register
  → supabase.auth.signUp() → auth.users row created ✅
  → PostgreSQL trigger fires: handle_new_user() ✅
      → INSERT INTO public.users (auth_id, email, username, ...) ✅
      → INSERT INTO user_settings (...) ✅
      → INSERT INTO user_information (...) ✅
  → "Check your email" message shown ✅
  → User clicks confirmation link in email ✅
  → Supabase redirects to /onboarding/profile ✅
  → Step 1: update_user_profile RPC ✅
  → Step 2: set_user_interests RPC ✅
  → Step 3: set_travel_preferences + complete_user_onboarding RPC ✅
  → Redirect to /feeds ✅
  → All downstream features work (trips, members, search) ✅
```

---

*Last updated: 2026-02-21*
*Updated: Requirements analysis improvements - added Problem Statement, Constraints & Assumptions, V1 Minimum Scope, time estimates, renumbered sections*
*Updated: Modern UI/UX requirements - added profile layout guidelines, component specs, accessibility, micro-interactions, missing UX features, edit modal spec*
*Updated: Separated Avatar Upload from Profile Edit - added new AvatarEditor component specification (Section 7.7)*
