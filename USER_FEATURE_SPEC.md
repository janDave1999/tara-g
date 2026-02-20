# User Feature — Detailed Specification

> Track progress: Mark items as `[x]` when completed, `[ ]` when pending.
> Prioritize: P0 = Must have, P1 = Should have, P2 = Nice to have

---

## Overview

The **User** feature covers the complete journey from account creation to a fully-configured profile, including email/password registration, email confirmation, 3-step onboarding, and profile management. Every other feature (trips, feeds, members) depends on a populated `public.users` row — this is the **most critical prerequisite** in the entire system.

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
| `/profile` | `src/pages/profile/index.astro` | ⚠️ Minimal (nearly empty) |
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
| UA1 | As a visitor, I want to create an account with email and password | Register form validates email format, password min 8 chars, requires terms agreement | ✅ Form exists |
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
| UO2 | As a new user, I want to set my display name and username | Step 1 collects full name, unique username (3-50 chars, alphanumeric + underscore) | ✅ Page exists |
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
| UP1 | As a user, I want to view my profile | `/profile` shows name, username, avatar, bio, stats (trips, friends) | ⚠️ Page minimal |
| UP2 | As a user, I want to edit my profile | Edit name, bio, avatar, location inline | ❌ Not implemented |
| UP3 | As a user, I want to update my travel preferences | Revisit Step 3 data from profile settings | ❌ Not implemented |
| UP4 | As a user, I want to update my interests | Revisit Step 2 data from profile settings | ❌ Not implemented |
| UP5 | As a user, I want to see my trips on my profile | Tabs: Owned trips / Joined trips | ❌ Not implemented |
| UP6 | As a user, I want to change my email address | Requires re-confirmation | ❌ Not implemented |
| UP7 | As a user, I want to change my password | Current + new password form | ❌ Not implemented |
| UP8 | As a user, I want to set up two-factor authentication | TOTP via authenticator app | ⚠️ Code commented out |
| UP9 | As a user, I want to see another user's public profile | `/profile/[username]` shows public info | ❌ Not implemented |
| UP10 | As a user, I want to set my profile to private | Toggle in settings | ❌ Not implemented |

### 3.4 Friends & Social (P1)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| UF1 | As a user, I want to send a friend request | Button on other user's profile | ❌ Not implemented |
| UF2 | As a user, I want to accept or decline friend requests | Notification + accept/decline UI | ❌ Not implemented |
| UF3 | As a user, I want to see my friends list | `/profile/friends` or profile tab | ❌ Not implemented |
| UF4 | As a user, I want to block another user | Block from profile; hides their content | ❌ Not implemented |

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

## 5. Current Gaps

### 5.1 P0 — Blocking (Fix First)

- [x] ~~**Missing `handle_new_user` trigger**~~ — Fixed in migration 017. Trigger now auto-populates `public.users`, `user_settings`, `user_information` on signup. Backfills existing users.
- [x] ~~**Missing onboarding RPC functions**~~ — Fixed in migration 018. All 9 functions created.
- [x] ~~**Email confirmation → onboarding redirect**~~ — Fixed in Phase 3: `register.ts` passes `emailRedirectTo`, `callback.ts` forwards `next` param.
- [x] ~~**`/forgot-password` page missing**~~ — Created in Phase 3 along with `/reset-password`.
- [x] ~~**Profile completion infinite recursion**~~ — Fixed in migration 022. Dropped `trigger_user_info_completion` that caused infinite loop.
- [x] ~~**Onboarding redirect loop**~~ — Fixed in migration 023. Changed RPC field `is_complete` to `onboarding_completed`.

### 5.2 P1 — Should Fix Soon

- [x] ~~**Global middleware**~~ — Implemented in `src/middleware/index.ts`. Protects routes, handles auth, redirects to onboarding if incomplete.
- [ ] **Profile edit page** — `/profile/index.astro` is nearly empty.
- [ ] **Social login** (Google/Facebook) — Buttons render but handlers show "not available yet".
- [ ] **Username uniqueness enforcement on trigger** — If email prefix collides, auto-append suffix (e.g., `dave_32f`).
- [ ] **`/profile/[username]` public view** — No route for viewing another user's profile.

### 5.3 P2 — Nice to Have

- [ ] **MFA / 2FA** — TOTP code exists but is commented out.
- [ ] **Friends system UI** — Tables exist, no UI for friend requests/listing.
- [ ] **Block system UI** — Table exists, no UI.
- [ ] **Email change** — Requires Supabase auth flow + re-confirm.
- [ ] **Account deletion** — GDPR compliance.

---

## 6. Implementation Phases

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

### Phase 4: Profile Page (P1)

- [ ] Build out `/profile/index.astro` — view own profile with stats
- [ ] Inline edit: name, bio, avatar, location
- [ ] Tabs: owned trips / joined trips / friends
- [ ] Create `/profile/[username].astro` — public profile view

### Phase 5: Global Middleware (P1)

- [x] ~~Create `src/middleware/index.ts`~~
  - ~~Protect all `/trips/*`, `/feeds`, `/profile/*`, `/onboarding/*` routes~~
  - ~~Redirect unauthenticated → `/signin`~~
  - ~~Redirect authenticated with incomplete onboarding → `/onboarding/profile`~~
  - ~~Remove per-page cookie checks~~

### Phase 6: Social & Safety (P2)

- [ ] Friend request send/accept/decline UI
- [ ] Block/unblock UI
- [ ] MFA (TOTP) — uncomment and complete existing code
- [ ] Social login (Google/Facebook) — complete OAuth handlers
- [ ] Account deletion

---

## 7. File Structure

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
└── 023_fix_onboarding_status_field.sql  # ✅ fix onboarding_completed field name

src/
├── pages/
│   ├── register.astro
│   ├── signin.astro
│   ├── logout.astro
│   ├── forgot-password.astro           # ✅ Migration 019 (Phase 3)
│   ├── reset-password.astro           # ✅ Migration 019 (Phase 3)
│   ├── api/auth/
│   │   ├── register.ts
│   │   ├── signin.ts
│   │   ├── callback.ts
│   │   ├── signout.ts
│   │   └── resend-confirmation.ts
│   ├── onboarding/
│   │   ├── profile.astro              # Step 1
│   │   ├── interests.astro             # Step 2
│   │   └── preferences.astro          # Step 3
│   └── profile/
│       ├── index.astro                # ⚠️ Nearly empty
│       ├── [username].astro           # TODO: missing
│       └── security.astro             # ⚠️ MFA commented out
├── actions/
│   ├── index.ts                      # onboarding.* actions
│   ├── auth.ts                       # auth.* actions
│   └── user.ts                       # user.* actions
└── middleware/
    └── index.ts                      # ✅ Global auth & onboarding middleware (Phase 5)
```

---

## 8. Complete Signup Flow (Current vs Target)

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

*Last updated: 2026-02-20*
*Updated: Migration 021-023 fixes, Global middleware implemented, Onboarding flow complete*
