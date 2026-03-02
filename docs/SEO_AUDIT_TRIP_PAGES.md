# SEO Audit Report: Tara G (Trip Pages)

## Executive Summary

**Site Type:** Travel community platform (SaaS) for Philippine travel planning  
**Overall Health:** Moderate - Good foundational SEO but critical gaps in public discoverability  

### Top Issues Identified:
1. **Trip pages require authentication** - Cannot be indexed (privacy-first design)
2. **Missing Event/Trip schema markup** - No rich results potential
3. **Non-descriptive URLs** - Uses UUIDs instead of readable slugs
4. **No canonical tags** - Risk of duplicate content issues

---

## Technical SEO Findings

### ✅ Crawlability & Indexation

| Item | Status | Notes |
|------|--------|-------|
| Robots.txt | ✅ Good | Properly blocks `/dashboard/`, `/feeds/`, `/onboarding/`, `/settings/`, `/api/` |
| Sitemap | ✅ Good | Configured via `@astrojs/sitemap`, filters 404/500 |
| Site Architecture | ⚠️ Issue | Trip pages require auth - not indexable |
| Cloudflare Adapter | ✅ Good | SSR with proper caching headers |

**Issue: Trip pages are private by default**
- **Impact:** High
- **Evidence:** `/trips/[trip_id]` redirects unauthenticated users to `/login` (line 12-13 in trips/index.astro)
- **Fix:** Implement a "public trip" visibility option that allows trip pages to be indexed

### ⚠️ Missing Canonical Tags

- **Impact:** Medium
- **Evidence:** No `<link rel="canonical">` found in Layout.astro or page components
- **Fix:** Add self-referencing canonical to Layout.astro head

### ⚠️ Schema Markup - Missing Trip/Event Type

- **Impact:** High  
- **Evidence:** Only `WebPage` schema implemented in PageSchema.astro
- **Fix:** Add `Event` or custom `Trip` schema for public trips (see below)

---

## On-Page SEO Findings (Trip Detail Page)

### ✅ Title & Meta Description

| Element | Status | Example |
|---------|--------|---------|
| Title Tag | ✅ Good | `${title} \| Tara G` (line 181) |
| Meta Description | ✅ Good | Dynamic with destination, 155 chars max (line 177) |
| OG Title | ✅ Good | Via astro-seo |
| OG Image | ✅ Good | Dynamic cover image (lines 169-173) |
| Twitter Cards | ✅ Good | Configured in HeadTagTwitter.astro |

### ✅ Heading Structure

- **H1:** Present via `<Hero>` component (uses trip title)
- **Hierarchy:** Proper H1 → H2 → H3 structure

### ⚠️ Image Optimization

- **Issue:** Hero images may lack descriptive filenames
- **Fix:** Ensure uploaded images have descriptive alt text (currently relies on trip title)

### ❌ URL Structure

- **Current:** `/trips/abc123-def456-ghi789` (UUID-style)
- **Preferred:** `/trips/palawan-weekend-getaway-2024` (slug-based)
- **Impact:** Medium - Less readable for users/search engines
- **Fix:** Add slug field to trips table, implement `/trips/[slug]-[id]` pattern

---

## Schema Markup Recommendations

Currently using `WebPage` schema (basic). For public trips, add:

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Trip Title",
  "startDate": "2024-03-15",
  "endDate": "2024-03-17",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "eventStatus": "https://schema.org/EventScheduled",
  "location": {
    "@type": "Place",
    "name": "Palawan, Philippines",
    "address": {
      "@type": "PostalAddress",
      "addressRegion": "Region IV-B",
      "addressCountry": "PH"
    }
  },
  "organizer": {
    "@type": "Person",
    "name": "Organizer Name"
  }
}
```

---

## Action Plan

### 🔴 Critical (Fix Before Launch)

1. **Implement Public Trip Visibility**
   - Add `visibility` field to trips (public/private)
   - Allow public trips to render without auth
   - Only index `public` trips in sitemap

2. **Add Canonical Tags**
   - Edit `src/layouts/Layout.astro` line 24+:
   ```astro
   <link rel="canonical" href={Astro.url.href} />
   ```

3. **Add Event/Trip Schema**
   - Create `TripSchema.astro` component
   - Apply to public trip pages only

### 🟡 High Priority

4. **Implement URL Slugs**
   - Add `slug` column to trips table
   - Update route to `[slug]-[id]`
   - Preserve ID for backwards compatibility

5. **Add Last-Modified Headers**
   - Return `Last-Modified` or `ETag` header from trip RPC
   - Helps search engines understand content freshness

### 🟢 Quick Wins

6. **Improve Robots.txt**
   - Add explicit `Disallow: /trips/*` for private trips
   - Add `Allow: /trips/*?visibility=public` if applicable

7. **Add Structured Data for Profile Pages**
   - Profile pages already have author schema
   - Consider `Person` schema with `url` property

---

## Summary

The current trip page implementation is **privacy-first** - trip pages are not designed to be indexed. This is likely intentional for a social travel app. However, if you want organic search traffic:

1. **Public trips need a visibility toggle** (already exists as `trip_visibility.visibility`)
2. **Add Trip/Event schema** for rich results
3. **Switch to slugs** for better URLs
4. **Add canonicals** to prevent duplicate content

If the app is meant to be fully private (invite-only trips), SEO for trip pages is not applicable - focus SEO efforts on public pages like `/discover`, `/about`, and profile pages.
