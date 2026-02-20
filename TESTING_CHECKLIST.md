# P0 Testing Checklist - User Feature

## 1. User Registration

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| 1.1 | Register new account at `/register` with email/password | Email confirmation sent | [ ] |
| 1.2 | Check `auth.users` table in Supabase | New row created with user data | [ ] |
| 1.3 | Check `public.users` table | Row auto-created by trigger (migration 017/021) | [ ] |
| 1.4 | Check `user_settings` table | Skeleton row created | [ ] |
| 1.5 | Check `user_information` table | Skeleton row created | [ ] |

## 2. Email Confirmation

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| 2.1 | Click confirmation link in email | Redirects to `/onboarding/profile` | [ ] |
| 2.2 | Check URL contains `next` param | Should point to onboarding | [ ] |

## 3. Onboarding Flow - Step 1 (Profile)

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| 3.1 | Visit `/onboarding/profile` | Page loads without error | [ ] |
| 3.2 | Fill form: full name, username, bio | Fields accept input | [ ] |
| 3.3 | Test username availability check | Shows available/taken | [ ] |
| 3.4 | Submit form | Saves via `update_user_profile` RPC | [ ] |
| 3.5 | Check `user_onboarding_progress` table | Step marked completed | [ ] |
| 3.6 | Click "Skip" button | Step marked skipped, proceed to step 2 | [ ] |

## 4. Onboarding Flow - Step 2 (Interests)

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| 4.1 | Visit `/onboarding/interests` | Page loads, shows 8 categories | [ ] |
| 4.2 | Select less than 3 interests | Validation error shown | [ ] |
| 4.3 | Select 3+ interests | Can proceed | [ ] |
| 4.4 | Submit form | Saves via `set_user_interests` RPC | [ ] |
| 4.5 | Click "Skip" button | Step marked skipped | [ ] |

## 5. Onboarding Flow - Step 3 (Preferences)

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| 5.1 | Visit `/onboarding/preferences` | Page loads | [ ] |
| 5.2 | Fill travel preferences | Fields accept input | [ ] |
| 5.3 | Submit form | Saves via `set_travel_preferences` RPC | [ ] |
| 5.4 | Complete onboarding | Redirects to `/feeds` | [ ] |
| 5.5 | Check onboarding status | `onboarding_completed` = true | [ ] |

## 6. Onboarding Redirect Loop Fix (Migration 023)

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| 6.1 | Register new user, skip all steps | Should NOT redirect to onboarding from `/feeds` | [ ] |
| 6.2 | Access `/trips/create` while onboarding incomplete | Redirects to next incomplete step | [ ] |
| 6.3 | Access `/onboarding/*` while completed | Redirects to `/feeds` | [ ] |

## 7. Profile Completion Infinite Recursion Fix (Migration 022)

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| 7.1 | Register new user | No "stack depth limit" error in Supabase logs | [ ] |
| 7.2 | Complete profile | `profile_completion_percentage` updates | [ ] |

## 8. Login & Logout

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| 8.1 | Login with registered email | Redirects to `/feeds` or `/onboarding/*` | [ ] |
| 8.2 | Logout | Clears cookies, redirects to `/signin` | [ ] |
| 8.3 | Access protected route while logged out | Redirects to `/signin` | [ ] |

---

**Total Tests:** 30  
**Passed:**  
**Failed:**

---

## Notes

- Migration 017/021: `handle_new_user` trigger - auto-creates user rows
- Migration 022: Fixed infinite recursion in profile completion trigger
- Migration 023: Fixed onboarding status field name (`is_complete` → `onboarding_completed`)
- Migrations must be run in Supabase SQL Editor before testing
