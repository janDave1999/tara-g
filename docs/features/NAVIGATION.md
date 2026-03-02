# Tara G! — Navigation

**Version:** v2.1
**Date:** March 2026
**Status:** Implemented
**Scope:** Header (`Header.astro`), Bottom Nav (`BottomNav.astro`), Mobile Sidebar

---

## 1. Overview

Navigation is split into three surfaces:

| Surface | Visibility | File |
|---|---|---|
| Top header | All screen sizes | `src/features/navbar/Header.astro` |
| Desktop dropdown | `md+`, authenticated only | Inside `Header.astro` |
| Mobile sidebar | `< md`, authenticated only | Inside `Header.astro` |
| Bottom tab bar | `< md`, authenticated only | `src/features/navbar/BottomNav.astro` |

---

## 2. Top Header — Desktop Nav Links

Shown in the `<ul class="hidden md:flex">` strip to the left of the profile button.

| Link | Auth required | URL |
|---|---|---|
| About | No | `/about` |
| Blogs | No | `/blogs` |
| Trips | Yes | `/trips` |
| Maps | Yes | `/maps` |

Feed is intentionally excluded from the desktop top nav (accessible via sidebar and bottom nav).

### Header Action Icons (right side, before profile button)

| Icon | URL | Condition |
|---|---|---|
| Search (magnifier) | `/search` | Authenticated only |
| Notification bell | (opens notification panel) | Authenticated only |

Search icon was added in v2.1 beside the notification bell for quick access to the search/discovery page.

---

## 3. Desktop Profile Dropdown

Shown when clicking the avatar/username button. Authenticated only.

### Explore section (implicit)
| Item | URL | Icon |
|---|---|---|
| My Profile | `/profile` | Person |
| My Trips | `/trips` | Globe |
| Project 82 | `/project82` | Custom bucket SVG (`BucketIcon`) |
| Feed | `/feeds` | Home |
| Maps | `/maps` | Map pin |

### Account section
| Item | URL | Icon |
|---|---|---|
| Settings | `/profile/edit` | Gear |

### Footer
| Item | Action |
|---|---|
| Sign out | `actions.auth.signout` → redirect `/signin` |

---

## 4. Mobile Sidebar

Slides in from the right. Opened via hamburger button in header.

### Explore section
| Item | URL |
|---|---|
| About | `/about` |
| Blogs | `/blogs` |
| Feed | `/feeds` |
| Maps | `/maps` |

### Account section
| Item | URL |
|---|---|
| My Profile | `/profile` |
| My Trips | `/trips` |
| Project 82 | `/project82` |
| Settings | `/profile/edit` |

### Footer
| Item | Action |
|---|---|
| Sign out | `actions.auth.signout` → redirect `/signin` |

---

## 5. Bottom Tab Bar (`BottomNav.astro`)

Shown on mobile only (`< md`). 5-tab layout with glass morphism style.

| Tab | URL | Icon |
|---|---|---|
| Search | `/search` | `Search` (Lucide) |
| Trips | `/trips` | `Move` (Lucide) |
| Project 82 | `/project82` | `BucketIcon` (custom SVG) |
| Maps | `/maps` | `Map` (Lucide) |
| Profile | `/profile` | `User` (Lucide) |

> **v2.1 change:** The Feed (`/feeds`, `House` icon) tab was replaced with Search (`/search`, `Search` icon). Feed remains accessible via the desktop profile dropdown and mobile sidebar.

Active tab detection: `currentPath.startsWith(href)` — adds `active` class (dark text, `font-semibold`, `scale(1.04)`).

### Assist Button
A draggable floating button that opens the bottom nav on tap and a radial quick-action menu on long press. Position is persisted to `localStorage` and magnets to left/right edge on release.

---

## 6. BucketIcon

Custom SVG icon for Project 82, stored as an Astro component at `src/features/navbar/BucketIcon.astro`. Uses `fill="currentColor"` so it inherits Tailwind text colour classes.

Used in:
- `BottomNav.astro` — Project 82 tab
- `Header.astro` — desktop dropdown + mobile sidebar Project 82 link

---

## 7. Sidebar Animation

Staggered `slideInRight` animation on `.sidebar-link` elements when the sidebar opens. 8 delay steps at 30ms intervals (`0.04s` → `0.25s`). Disabled under `prefers-reduced-motion`.

---

## 8. File Manifest

| File | Purpose |
|---|---|
| `src/features/navbar/Header.astro` | Top header, desktop dropdown, mobile sidebar, logout script |
| `src/features/navbar/BottomNav.astro` | Mobile bottom tab bar + floating assist button |
| `src/features/navbar/BucketIcon.astro` | Custom bucket/barrel SVG icon component |

---

---

## 9. Changelog

| Version | Date | Change |
|---|---|---|
| v2.0 | 2026-03 | Initial documentation |
| v2.1 | 2026-03-02 | Added search icon to Header; replaced Feed tab with Search in BottomNav |

---

*Confidential — Internal Use Only · Tara G! Product Team · March 2026*
