# Tara G! — Change Plan

> Track progress here. Strike out items as they are completed using `~~text~~`.
> Updated as we go — one item at a time.

---

## REVISE

### Critical (Security / Correctness)

- [x] ~~Remove `console.log` statements in `src/pages/api/auth/signin.ts` and `src/pages/api/auth/register.ts`~~
- [x] ~~Move `SALT` out of public env vars — it must not be exposed to the client~~
- [x] ~~Verify auth cookies have `secure` and `sameSite` flags properly set in `src/middleware/index.ts`~~
- [x] ~~Fix i18n language mismatch — config uses `(en, ph)` but translation files use `(en, th)` in `src/i18n/lang.ts` and `src/i18n/translation/mainTranslation.ts`~~
- [x] ~~Fix inconsistent API error response formats across `src/pages/api/trips/*`~~

### Code Health

- [x] ~~Clean up duplicate and conflicting type definitions in `src/types/trip.ts`~~
- [x] ~~Extract token refresh logic into a reusable utility function from `src/middleware/index.ts`~~
- [x] ~~Fix incomplete migration script — references non-existent RPC functions in `scripts/migrate.js`~~
- [x] ~~Consolidate multiple redundant SEO head-tag components in `src/seo/component/`~~
- [x] ~~Expand translation keys in `src/i18n/translation/mainTranslation.ts` — currently only 1 key (`home.title`) is defined~~

---

## REMOVE

- [x] ~~Remove commented-out dead code blocks in `src/types/trip.ts`~~
- [x] ~~Remove the inactive CMS client(s) — deleted Strapi (`src/lib/strapi_client.js`, `src/lib/strapi.ts`); Cosmic is the active CMS~~
- [x] ~~Remove unused imports across source files (audit pass)~~
- [x] ~~Remove stale `_readme.md` files that duplicate documented info elsewhere~~

---

## ADD

### Critical

- [x] ~~Add rate limiting on auth endpoints (`src/pages/api/auth/signin.ts`, `src/pages/api/auth/register.ts`)~~
- [ ] Add a proper logging utility to replace all `console.log` calls (e.g. structured logger scoped to server-side only)
- [ ] Add input validation on API routes that are missing request body checks
- [ ] Add a global error boundary / fallback UI component for unhandled Astro page errors

### Code Health

- [x] ~~Rename `src/scripts/LaodingSpinner.ts` → `LoadingSpinner.ts` and update all imports~~
- [ ] Add database schema documentation (ERD or Supabase schema export) to the repo
- [ ] Add API route documentation for all `src/pages/api/*` endpoints
- [ ] Add inline comments for complex logic — onboarding middleware flow, token refresh, RPC calls
- [ ] Add CI/CD step to run `vitest` on every push (GitHub Actions or Cloudflare Pages build hook)
- [ ] Expand test coverage — add component tests and API route tests for critical paths

### Features (Future)

- [ ] Add real-time collaboration using Supabase Realtime (live trip editing for group members)
- [ ] Add PDF export for itineraries
- [ ] Add trip chat / discussion board per trip
- [ ] Add analytics dashboard for trip insights (member activity, spending trends)

---

## Legend

| Status | Marker |
|--------|--------|
| Not started | `- [ ]` |
| Done | `- [x] ~~item~~` |
