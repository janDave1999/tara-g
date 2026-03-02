# Tara G! — Account & Security Page

**Version:** v1.0
**Date:** March 2026
**Status:** Implemented
**Scope:** `/profile/security` — Account & Security Settings

---

## 1. Overview

A dedicated settings page for managing account credentials, connected sign-in methods, active sessions, and account deletion. Accessible from the profile edit hub (`/profile/edit`) and the header Settings link.

---

## 2. Sections

### 2.1 Email Address

| State | Behaviour |
|---|---|
| Display | Shows current email from `context.locals.email` |
| Edit trigger | "Change" button expands inline form |
| Save action | `actions.auth.changeEmail({ email })` → calls `userClient.auth.updateUser({ email })` |
| Success | Form hides; shows "Check your new email for a confirmation link" |
| Error | `showToast` error message |

Uses `getSupabaseClient(cookies)` (user-scoped client) so Supabase sends the confirmation email flow to both old and new addresses.

---

### 2.2 Password

| Condition | Behaviour |
|---|---|
| `hasPassword = true` | Shows "Change password" form with "Current password" field |
| `hasPassword = false` (OAuth-only user) | Shows "Set password" form without current password field |

**Action:** `actions.auth.changePassword({ currentPassword?, newPassword })`

- For email/password users: verifies `currentPassword` via `supabase.auth.signInWithPassword` before updating
- Updates via `supabaseAdmin.auth.admin.updateUserById(user_id, { password: newPassword })`

---

### 2.3 Sign-in Methods

Read-only display of connected auth providers detected server-side via `supabaseAdmin.auth.admin.getUserById(user_id)`.

| Provider | Detection | Display |
|---|---|---|
| Email / Password | `identity.provider === 'email'` | "Connected" badge (green) or "Not connected" (gray) |
| Google | `identity.provider === 'google'` | Same |
| Facebook | `identity.provider === 'facebook'` | Same |

---

### 2.4 Sessions

Single action button: **Sign out of all devices**

- Action: `actions.auth.signOutAll`
- Uses `supabaseAdmin.auth.admin.signOut(accessToken, "global")` then clears session cookies
- On success: redirects to `/signin`

---

### 2.5 Danger Zone — Delete Account

- Button opens a `<dialog>` confirmation modal
- User must confirm by clicking "Delete my account"
- Action: `actions.auth.deleteAccount`
- Uses `supabaseAdmin.auth.admin.deleteUser(user_id)` then clears session cookies
- On success: redirects to `/`

---

## 3. Astro Actions

All actions live in `src/actions/auth.ts`:

| Action | Input | Auth Method | Notes |
|---|---|---|---|
| `auth.signout` | — | — | Clears cookies + `supabase.auth.signOut()` |
| `auth.changeEmail` | `{ email: string }` | `getSupabaseClient(cookies).auth.updateUser` | Triggers Supabase email confirmation flow |
| `auth.changePassword` | `{ currentPassword?, newPassword: string }` | `supabaseAdmin.auth.admin.updateUserById` | Verifies current password first for email users |
| `auth.signOutAll` | — | `supabaseAdmin.auth.admin.signOut(token, "global")` | Invalidates all sessions globally |
| `auth.deleteAccount` | — | `supabaseAdmin.auth.admin.deleteUser` | Permanent — no recovery |

---

## 4. File Manifest

| File | Purpose |
|---|---|
| `src/pages/profile/security.astro` | Full security settings page |
| `src/actions/auth.ts` | All auth actions (signout, changeEmail, changePassword, signOutAll, deleteAccount) |
| `src/lib/supabase.ts` | `getSupabaseClient(cookies)` — user-scoped client using access token from cookies |

---

*Confidential — Internal Use Only · Tara G! Product Team · March 2026*
