# UI Brand Guidelines

## Tara G!

Version 1.1 | Last Updated: February 2026

---

## 1. Brand Overview

### 1.1 Brand Identity

**Brand Name:** Tara G!  
**Tagline:** Let's go! (Filipino-inspired travel companion)  
**Project Code:** `project-nomad-tara-g`  
**Platform:** Astro-based web application  
**Deployment:** Cloudflare Workers

**Mission:** Empower travelers to discover, plan, and share trips with ease.

---

## 2. Color System

### 2.1 Primary Palette

The primary palette represents trust, exploration, and adventure.

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| Primary | `#3B82F6` | 59, 130, 246 | Main actions, links, CTAs |
| Primary Dark | `#2563EB` | 37, 99, 235 | Hover states, emphasis |
| Primary Light | `#60A5FA` | 96, 165, 250 | Highlights, secondary emphasis |
| Primary 50 | `#EFF6FF` | 239, 246, 255 | Light backgrounds, badges |
| Primary 100 | `#DBEAFE` | 219, 234, 254 | Hover backgrounds |
| Primary 600 | `#2563EB` | 37, 99, 235 | Active states (same as dark) |
| Primary 700 | `#1D4ED8` | 29, 78, 216 | Pressed states |

### 2.2 Secondary Palette

The secondary palette adds energy, warmth, and call-to-action emphasis.

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| Secondary | `#F97316` | 249, 115, 22 | Accents, notifications, important CTAs |
| Secondary Dark | `#EA580C` | 234, 88, 12 | Hover states for secondary |
| Secondary Light | `#FB923C` | 251, 146, 60 | Highlights |

### 2.3 Semantic Colors

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| Success | `#10B981` | 16, 185, 129 | Success states, confirmations |
| Success Light | `#D1FAE5` | 209, 250, 229 | Success backgrounds |
| Success Dark | `#059669` | 5, 150, 105 | Success hover |
| Warning | `#F59E0B` | 245, 158, 11 | Warnings, alerts |
| Warning Light | `#FEF3C7` | 254, 243, 199 | Warning backgrounds |
| Warning Dark | `#D97706` | 217, 119, 6 | Warning hover |
| Error | `#EF4444` | 239, 68, 68 | Errors, destructive actions |
| Error Light | `#FEE2E2` | 254, 226, 226 | Error backgrounds |
| Error Dark | `#DC2626` | 220, 38, 38 | Error hover |

### 2.4 Neutral Palette

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Gray 50 | `#F9FAFB` | Page backgrounds |
| Gray 100 | `#F3F4F6` | Card backgrounds, subtle borders |
| Gray 200 | `#E5E7EB` | Borders, dividers |
| Gray 300 | `#D1D5DB` | Input borders, disabled states |
| Gray 400 | `#9CA3AF` | Placeholder text |
| Gray 500 | `#6B7280` | Secondary text |
| Gray 600 | `#4B5563` | Body text |
| Gray 700 | `#374151` | Headings, emphasis |
| Gray 800 | `#1F2937` | Dark headings |
| Gray 900 | `#111827` | Primary text, black alternative |

---

## 3. Typography

### 3.1 Font Family

**Primary Font:** Inter  
**Fallback:** -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

```css
--font-heading: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### 3.2 Type Scale

| Token | Value | Line Height | Usage |
|-------|-------|-------------|-------|
| `--text-xs` | 0.75rem (12px) | 1rem | Captions, labels, badges |
| `--text-sm` | 0.875rem (14px) | 1.25rem | Secondary text, metadata |
| `--text-base` | 1rem (16px) | 1.5rem | Body text |
| `--text-lg` | 1.125rem (18px) | 1.75rem | Lead paragraphs |
| `--text-xl` | 1.25rem (20px) | 1.75rem | Section headings |
| `--text-2xl` | 1.5rem (24px) | 2rem | Card titles |
| `--text-3xl` | 1.875rem (30px) | 2.25rem | Page headings |
| `--text-4xl` | 2.25rem (36px) | 2.5rem | Hero headings |

### 3.3 Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text |
| Medium | 500 | Navigation, labels |
| Semibold | 600 | Emphasis, buttons |
| Bold | 700 | Headings, important text |

### 3.4 Text Utilities

```css
.section-label {
  text-xs md:text-sm font-semibold text-gray-500 tracking-widest uppercase;
}

.description {
  text-sm md:text-base text-gray-700 leading-relaxed;
}

.meta-label {
  text-xs text-gray-500;
}

.meta-value {
  font-semibold text-gray-800 text-sm md:text-base;
}
```

### 3.5 Property Row Typography (Data Display)

Used in property-sheet / detail views (e.g. trip summary rows):

| Role | Tailwind Classes | Example |
|------|-----------------|---------|
| Field label | `text-xs font-semibold text-gray-500 uppercase tracking-wide` | "DESTINATION", "TRIP DATES" |
| Field value | `text-sm font-semibold text-gray-900` | "Cebu City", "Mar 1 – Mar 5, 2025" |
| Sub-value / note | `text-xs text-gray-500 mt-0.5` | "Join by Feb 28", "Max 6 people" |
| Section heading | `text-sm font-semibold text-gray-700` | "About this trip" |
| Empty / placeholder | `text-sm text-gray-400 italic` | "No description yet." |

**Rule:** Field labels must always be `uppercase tracking-wide font-semibold` to maintain scannability. Never use `text-gray-400` for labels — minimum `text-gray-500`.

---

## 4. Spacing System

### 4.1 Spacing Scale

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--spacing-xs` | 0.5rem | 8px | Tight spacing, icon gaps |
| `--spacing-sm` | 1rem | 16px | Component padding, gaps |
| `--spacing-md` | 1.5rem | 24px | Section spacing |
| `--spacing-lg` | 2rem | 32px | Large gaps |
| `--spacing-xl` | 3rem | 48px | Section separation |
| `--spacing-2xl` | 4rem | 64px | Major sections |

### 4.2 Mobile Adjustments

```css
@media (max-width: 640px) {
  :root {
    --spacing-sm: 0.75rem;   /* 12px */
    --spacing-md: 1rem;      /* 16px */
    --spacing-lg: 1.5rem;    /* 24px */
    --spacing-xl: 2rem;      /* 32px */
  }
}
```

---

## 5. Layout

### 5.1 Container System

```css
--container-max-width: 1200px;
--header-height: 4rem;      /* 64px */
--footer-height: 4rem;      /* 64px */
```

### 5.2 Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablets |
| lg | 1024px | Small laptops |
| xl | 1280px | Desktops |

### 5.3 Container Responsive

```css
.container-responsive {
  width: 100%;
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding-left: var(--spacing-sm);
  padding-right: var(--spacing-sm);
}
```

---

## 6. Border Radius

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--radius-sm` | 0.375rem | 6px | Small buttons, tags |
| `--radius-md` | 0.5rem | 8px | Inputs, cards |
| `--radius-lg` | 0.75rem | 12px | Modals, large cards |
| `--radius-xl` | 1rem | 16px | Hero sections |
| `--radius-2xl` | 1.5rem | 24px | Special containers |

---

## 7. Shadows

| Token | CSS Value | Usage |
|-------|------------|-------|
| `--shadow-sm` | 0 1px 2px 0 rgba(0, 0, 0, 0.05) | Subtle elevation |
| `--shadow-md` | 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) | Cards, dropdowns |
| `--shadow-lg` | 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) | Modals, popovers |
| `--shadow-xl` | 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) | Large overlays |

---

## 8. Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | 150ms ease | Hover states, small interactions |
| `--transition-normal` | 250ms ease | Standard transitions |
| `--transition-slow` | 350ms ease | Page transitions, large elements |

---

## 9. Components

### 9.1 Buttons

#### Primary Button
```css
.btn-primary {
  background-color: var(--brand-primary);
  color: white;
  border: 1px solid var(--brand-primary);
  transition: all var(--transition-normal);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--brand-primary-dark);
  border-color: var(--brand-primary-dark);
}
```

#### Secondary Button
```css
.btn-secondary {
  background-color: transparent;
  color: var(--brand-primary);
  border: 1px solid var(--gray-300);
  transition: all var(--transition-normal);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--gray-50);
  border-color: var(--brand-primary);
  color: var(--brand-primary-dark);
}
```

#### Button Sizes

| Size | Padding | Font Size |
|------|---------|------------|
| sm | 0.5rem 1rem | 0.875rem |
| md | 0.75rem 1.5rem | 1rem |
| lg | 1rem 2rem | 1.125rem |

### 9.2 Form Inputs

```css
.input-field {
  border: 1px solid var(--gray-300);
  transition: all var(--transition-fast);
}

.input-field:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-field.error {
  border-color: var(--brand-error);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}
```

### 9.3 Cards

```css
.card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal);
}

.card:hover {
  box-shadow: var(--shadow-lg);
}
```

### 9.4 Tags & Chips

```css
.tag-chip {
  text-xs md:text-sm px-3 py-1 rounded-full bg-white 
    border border-gray-200 text-gray-700 shadow-sm;
}
```

### 9.5 Status Badges

| Status | Background | Text Color |
|--------|------------|------------|
| Success | `#D1FAE5` | `#059669` |
| Warning | `#FEF3C7` | `#D97706` |
| Error | `#FEE2E2` | `#DC2626` |
| Info | `#DBEAFE` | `#2563EB` |

---

## 10. Logo & Branding

### 10.1 Logo Specifications

**Primary Logo:**  
- File: PNG image (stored in R2/CDN)
- Dimensions: 40x40px (desktop), 32x32px (mobile)
- Border Radius: 8px (`--radius-md`)
- URL: `https://pub-aa2991db87be444fbc5fcb09dbae09a3.r2.dev/ChatGPT%20Image%20Nov%204%2C%202025%2C%2002_47_13%20PM.png`

### 10.2 Logo Usage

**Desktop:**
- Logo + "Tara G!" wordmark
- Height: 40px

**Mobile:**
- Logo only
- "TG!" abbreviation
- Height: 32px

### 10.3 Brand Gradient

```css
.brand-gradient {
  background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%);
}

.brand-gradient-text {
  background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## 11. Accessibility

### 11.1 Color Contrast

- Minimum contrast ratio: 4.5:1 for normal text
- Minimum contrast ratio: 3:1 for large text and UI components

### 11.2 High Contrast Mode

```css
@media (prefers-contrast: high) {
  :root {
    --brand-primary: #1D4ED8;
    --brand-error: #B91C1C;
    --gray-300: #E5E5E5;
    --gray-600: #262626;
  }
}
```

### 11.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --transition-fast: 0ms ease;
    --transition-normal: 0ms ease;
    --transition-slow: 0ms ease;
  }
  
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. Icons

### 12.1 Icon Library

The project uses `@jsarmyknife/native--icon` for custom icons and `@lucide/astro` for standard icons.

### 12.2 Icon Sizes

| Size | Value | Usage |
|------|-------|-------|
| xs | 16px | Inline icons, badges |
| sm | 20px | Small buttons, lists |
| md | 24px | Standard icons |
| lg | 32px | Featured icons |
| xl | 48px | Hero icons |

### 12.3 Icon Colors

- Default: `text-gray-600`
- Hover: `text-brand-primary`
- Active: `text-brand-primary-dark`
- Disabled: `text-gray-400`

### 12.4 Contextual Icon Color Conventions (Property Rows)

When icons appear inside rounded icon wells in property/detail rows, apply semantic color based on category:

| Category | Icon Well | Icon Color | Usage |
|----------|-----------|------------|-------|
| Informational (default) | `bg-blue-50` | `text-blue-600` | Destination, Dates, Members, Preferences |
| Financial / Cost | `bg-orange-50` | `text-orange-500` | Budget, Cost Sharing |
| Danger / Destructive | `bg-red-50` | `text-red-500` | Delete actions |
| Success | `bg-green-50` | `text-green-600` | Confirmations |

**Rule:** Do NOT mix multiple accent colors across informational rows. Keep all informational icons blue and only deviate for semantically distinct categories (cost = orange, danger = red).

Icon well size in rows: `w-9 h-9 rounded-xl` (slightly rounded square, not circle).

Icon well size in `EditableCard` component: `p-3 rounded-xl bg-linear-to-br` with gradient.

---

## 13. CSS Variables Reference

### 13.1 Complete Variable List

```css
:root {
  /* Brand Colors */
  --brand-primary: #3B82F6;
  --brand-primary-dark: #2563EB;
  --brand-primary-light: #60A5FA;
  --brand-primary-50: #EFF6FF;
  --brand-primary-100: #DBEAFE;
  --brand-primary-600: #2563EB;
  --brand-primary-700: #1D4ED8;
  
  --brand-secondary: #F97316;
  --brand-secondary-dark: #EA580C;
  --brand-secondary-light: #FB923C;
  
  --brand-success: #10B981;
  --brand-success-light: #D1FAE5;
  --brand-success-dark: #059669;
  
  --brand-warning: #F59E0B;
  --brand-warning-light: #FEF3C7;
  --brand-warning-dark: #D97706;
  
  --brand-error: #EF4444;
  --brand-error-light: #FEE2E2;
  --brand-error-dark: #DC2626;
  
  /* Neutral Colors */
  --gray-50: #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-200: #E5E7EB;
  --gray-300: #D1D5DB;
  --gray-400: #9CA3AF;
  --gray-500: #6B7280;
  --gray-600: #4B5563;
  --gray-700: #374151;
  --gray-800: #1F2937;
  --gray-900: #111827;
  
  /* Spacing */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --spacing-2xl: 4rem;
  
  /* Typography */
  --font-heading: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  
  /* Layout */
  --header-height: 4rem;
  --footer-height: 4rem;
  --container-max-width: 1200px;
  
  /* Border Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}
```

---

## 14. Technology Stack

| Category | Technology |
|----------|------------|
| Framework | Astro 5.x |
| Styling | Tailwind CSS 4.x |
| UI Components | DaisyUI 5.x |
| Icons | @jsarmyknife/native--icon, @lucide/astro |
| Database | Supabase (PostgreSQL) |
| Storage | Cloudflare R2 |
| Deployment | Cloudflare Workers |
| Maps | Mapbox GL |

---

## 15. File Structure Reference

```
src/
├── styles/
│   ├── _brand.css          # CSS custom properties & brand classes
│   ├── _blog.css           # Blog-specific styles
│   ├── _cards.css          # Card component styles
│   ├── _layout.css         # Layout styles
│   └── globals.css         # Main stylesheet (imports all)
├── components/             # Reusable UI components
├── features/               # Feature-specific components
│   └── navbar/             # Navigation components
├── layouts/                # Page layouts
├── pages/                  # Route pages
└── utility/                # Utility functions & helpers
```

---

## 16. Do's and Don'ts

### Do's

- Use the defined color palette consistently
- Follow the spacing scale for consistent layouts
- Use the component classes provided
- Ensure 4.5:1 contrast ratio for text
- Test with reduced motion enabled
- Use semantic HTML elements

### Don'ts

- Don't use arbitrary colors outside the palette
- Don't skip spacing values in the scale
- Don't use custom border radii not in the system
- Don't hardcode colors in components
- Don't disable focus states
- Don't ignore accessibility warnings

---

## 17. Astro Islands Architecture

### 17.1 Understanding Partial Hydration

Astro uses **Island Architecture** to ship zero JavaScript by default. Use client directives to hydrate only interactive components.

### 17.2 Client Directive Cheatsheet

| Directive | When to Use | Example |
|-----------|-------------|---------|
| `client:load` | Components needed immediately on page load | Navigation, header, auth state |
| `client:visible` | Components that appear in viewport | Modals, trip cards below fold |
| `client:idle` | Non-critical, can wait until CPU is idle | Cookie banners, analytics |
| `client:only` | Components that must run in browser only | Maps, third-party widgets |

### 17.3 Component Classification

Classify your components into:

**Static (No Client JS)**
- Landing page content
- Blog posts
- Trip listings (read-only)
- Footer
- About pages

**Interactive (Needs Hydration)**
- Navigation menus
- Modal dialogs
- Form handlers
- Maps
- Real-time updates

### 17.4 Implementation Examples

#### Example 1: Modal Component Usage

```astro
---
// src/pages/trips/[trip_id]/index.astro
import DatesModal from '@/components/Trip/modal/DatesModal.astro';
import BudgetModal from '@/components/Trip/modal/BudgetModal.astro';
import PreferenceModal from '@/components/Trip/modal/PreferenceModal.astro';
---

<!-- Load modal only when user scrolls it into view -->
<DatesModal client:visible />
<BudgetModal client:visible />
<PreferenceModal client:visible />
```

#### Example 2: Map Component

```astro
---
// src/components/MapBox.astro
---
<!-- Maps MUST use client:only - they require browser APIs -->
<Map client:only="astro" />
```

```astro
---
// src/pages/trips/[trip_id]/index.astro
import MapBox from '@/components/MapBox.astro';
---

<!-- Only load map when user scrolls to map section -->
<MapBox client:visible />
```

#### Example 3: Header with Auth State

```astro
---
// src/layouts/Layout.astro
import Header from '@/features/navbar/HeaderMain.astro';
---

<!-- Header needs immediate interactivity for mobile menu -->
<Header client:load />
```

#### Example 4: Lazy-Load Third-Party Scripts

```astro
---
// src/components/MapPickerModal.astro
---
<dialog id="map-picker" class="modal">
  <div class="modal-box max-w-2xl">
    <div id="map-container"></div>
  </div>
</dialog>

<script>
  // Lazy-load Mapbox only when modal opens
  document.getElementById('map-picker')?.addEventListener('click', async (e) => {
    if (e.target === e.currentTarget) {
      const mapModule = await import('mapbox-gl');
      // Initialize map...
    }
  }, { once: true });
</script>
```

#### Example 5: Non-Critical Components

```astro
---
// src/layouts/Layout.astro
import CookiesConsent from '@/components/CookiesConsent.astro';
import PreferencesPrompt from '@/components/PreferencesPrompt.astro';
---

<!-- Load when browser is idle - not critical for initial render -->
<CookiesConsent client:idle />
<PreferencesPrompt client:idle />
```

### 17.5 Recommended Directives by Component

| Component | Recommended Directive | Rationale |
|-----------|---------------------|-----------|
| `HeaderMain.astro` | `client:load` | Mobile menu needs immediate interactivity |
| `BottomNav.astro` | `client:load` | Mobile navigation must work instantly |
| `DatesModal.astro` | `client:visible` | Only needed when modal opens |
| `BudgetModal.astro` | `client:visible` | Only needed when modal opens |
| `DescriptionModal.astro` | `client:visible` | Only needed when modal opens |
| `DestinationModal.astro` | `client:visible` | Only needed when modal opens |
| `PreferenceModal.astro` | `client:visible` | Only needed when modal opens |
| `EditModal.astro` | `client:visible` | Only needed when modal opens |
| `MapBox.astro` | N/A (full-page component) | Standalone HTML page, no hydration needed |
| `MapPickerModal.astro` | `client:visible` | Map loads on demand |
| `PreferencesPrompt.astro` | `client:idle` | Non-critical, can wait |
| `CookiesConsent.astro` | `client:idle` | Non-critical for page render |
| `TripStatusActions.astro` | `client:visible` | Interactive on trip detail pages |
| `TripCard.astro` | `client:visible` | Below-fold content |
| `TripHeader.astro` | `client:visible` | Has interactive elements |
| `UploadImages.astro` | `client:visible` | User-triggered functionality |
| `Itinerary.astro` | `client:visible` | Drag-and-drop needs interactivity |
| `CompleteItinerary.astro` | `client:visible` | Interactive itinerary builder |

### 17.6 Pattern: Deferred Modal Loading

For optimal performance, create a wrapper that loads the modal content on-demand:

```astro
---
// src/components/ModalWrapper.astro
interface Props {
  modalId: string;
  triggerLabel: string;
}

const { modalId, triggerLabel } = Astro.props;
---

<button 
  onclick={`document.getElementById('${modalId}').showModal()`}
  class="btn btn-primary"
>
  {triggerLabel}
</button>

<dialog id={modalId} class="modal">
  <div class="modal-box">
    <slot />
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

### 17.7 State Sharing Between Islands

Use **Nano Stores** for state shared between components:

```bash
npm install nanostores @nanostores/astro
```

```typescript
// src/stores/auth.ts
import { atom } from 'nanostores';

export const $user = atom<{ id: string; name: string } | null>(null);
```

```astro
---
// src/components/AuthButton.astro
import { $user } from '@/stores/auth';
---
<script>
  import { $user } from '@/stores/auth';
  $user.subscribe(user => {
    // Update UI based on auth state
  });
</script>
```

### 17.8 Migration Strategy

1. **Phase 1**: Add `client:visible` to all modal components
2. **Phase 2**: Change `MapBox` to use `client:only`
3. **Phase 3**: Add `client:idle` to `CookiesConsent` and `PreferencesPrompt`
4. **Phase 4**: Add `client:load` to navigation components
5. **Phase 5**: Consider Preact for complex forms (optional)

---

## 18. Performance Guidelines

### 18.1 Bundle Size

| Metric | Target |
|--------|--------|
| Targets Initial JS | < 50KB |
| Time to Interactive | < 3s |
| Largest Contentful Paint | < 2.5s |

### 18.2 Lazy Loading Rules

- Images: Use `loading="lazy"` for below-fold images
- Components: Use `client:visible` for components below the fold
- Routes: Enable prefetching for likely navigations

### 18.3 Script Loading Best Practices

```astro
<!-- BAD: Inline script blocks -->
<script>
  import { something } from 'module'; // Breaks in Astro
</script>

<!-- GOOD: Use type="module" -->
<script type="module">
  import { something } from 'module';
</script>

<!-- BEST: Lazy load heavy dependencies -->
<script type="module">
  if (needsHeavyLib) {
    import('heavy-library').then(module => {
      // Use module
    });
  }
</script>
```

---

---

## 19. Trip Detail Page Patterns

These patterns were established during the trip detail UI overhaul (v1.1) and should be used as the reference for all detail/profile-style pages.

### 19.1 Two-Card Page Layout

Detail pages use a **two-card stacked layout** inside a constrained container:

```astro
<section class="max-w-5xl mx-auto mt-6 mb-20 px-4 space-y-5">

  <!-- Card 1: Hero media + entity header (title, meta, actions) -->
  <div class="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
    <Hero ... />
    <TripHeader ... />
  </div>

  <!-- Card 2: Structured property details -->
  <div class="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
    <Summary ... />
  </div>

  <!-- Full-width cards below (members, itinerary, etc.) -->
  <Member ... />
  <Itinerary2 ... />

</section>
```

- Card 1 border: `border-gray-200` (slightly more visible — anchors the hero)
- Card 2+ borders: `border-gray-100` (subtle, recedes)
- `overflow-hidden` on the outer wrapper prevents inner elements from bleeding outside `rounded-2xl`
- Do NOT apply `rounded-*` or `shadow-*` to direct children of these cards — the parent card handles shaping

### 19.2 Property Row Layout (divide-y Pattern)

For metadata/details sections, use a vertical property-sheet layout rather than a grid of cards:

```astro
<div class="divide-y divide-gray-100">

  <!-- Text-only section (e.g. description) -->
  <div class="px-6 py-5 ...">
    <p class="text-sm font-semibold text-gray-700">Section heading</p>
    <p class="text-sm text-gray-700 leading-relaxed">Content</p>
  </div>

  <!-- Icon row (e.g. destination, dates) -->
  <div class="flex items-center gap-4 px-6 py-4 ...">
    <div class="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
      <Icon class="w-4 h-4 text-blue-600" />
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Label</p>
      <p class="text-sm font-semibold text-gray-900">Value</p>
      <p class="text-xs text-gray-500 mt-0.5">Sub-value</p>
    </div>
    <!-- Edit pencil (owners only, opacity-0 group-hover:opacity-100) -->
  </div>

</div>
```

Row padding: `px-6 py-4` for icon rows, `px-6 py-5` for text-only sections.

**Editable rows** add `cursor-pointer hover:bg-gray-50 group` and reveal a pencil icon on hover via `opacity-0 group-hover:opacity-100`.

### 19.3 Entity Header (TripHeader) Conventions

The header area below the hero image follows this structure:

```astro
<div class="px-6 md:px-8 py-6 md:py-7 bg-white">
  <!-- Row 1: Title + action buttons -->
  <div class="flex items-start justify-between gap-4 mb-3">
    <h1 class="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">Title</h1>
    <!-- Join / Leave / Share buttons -->
  </div>
  <!-- Row 2: Meta chips (destination, status badge, visibility) -->
  <div class="flex flex-wrap items-center gap-2 mb-4">
    <!-- chips -->
  </div>
  <!-- Row 3: Tags -->
  <div class="flex flex-wrap gap-1.5">
    <!-- tag pills: px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 -->
  </div>
</div>
```

- Title: `text-2xl md:text-3xl font-bold text-gray-900`
- Tag chips: `px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600`
- Status badge: use `TripStatusBadge` component for owners; static colored chip for non-owners
- Join button: `bg-blue-600 hover:bg-blue-700 text-white`
- Cancel/Leave buttons: ghost border variant (`border border-gray-200` or `border border-red-200 text-red-600`)

### 19.4 Hero Carousel Conventions

- No `rounded-*` or `shadow-*` on the carousel div itself — the parent card wrapper handles shape
- Navigation arrows: semi-transparent pill buttons with `focus:ring-blue-500`
- Indicator dots: absolute overlay at `bottom-4`, hidden when `totalSlides <= 1`
- Active dot: `bg-linear-to-r from-blue-500 to-blue-600`
- Upload slide (owner): dark bg `from-slate-900 to-blue-950`, dashed blue upload border

### 19.5 Itinerary Component Conventions

```
Itinerary2 (container card)
└── rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white
    └── ItineraryHeader (title + edit mode toggle)
    └── DaySection (per day)
        └── Day header: numbered circle + day label + date chip + chevron
        └── Timeline: thin vertical line w-px bg-gray-200 (neutral, no gradient)
        └── StopCard (per stop)
            └── Colored timeline dot (from stopColors.ts — dot only, not card bg)
            └── Card: bg-white border-gray-100 rounded-xl shadow-sm hover:shadow-md
```

- **Timeline line**: `w-px bg-gray-200` — always neutral gray, never colored
- **Stop type colors**: applied only to the dot and type label text (via `stopColors.ts`), NOT the card background
- **Day number circle**: `w-7 h-7 rounded-full bg-gray-100` with `text-xs font-bold text-gray-600`
- **Add Stop button**: `text-xs font-semibold text-blue-600 hover:bg-blue-50` — hidden by default, shown in edit mode
- **Edit mode toggle button**: `border border-gray-200 text-gray-700 hover:bg-gray-50`

### 19.6 Tailwind v4 Syntax Notes

Always use Tailwind v4 canonical class names:

| v3 (incorrect) | v4 (correct) |
|----------------|--------------|
| `bg-gradient-to-r` | `bg-linear-to-r` |
| `bg-gradient-to-br` | `bg-linear-to-br` |

### 19.7 Date Formatting Safety

Always guard date formatting against null/undefined/invalid values:

```typescript
const fmt = (d: string | null | undefined): string => {
  if (!d) return 'Not set';
  const date = new Date(d);
  if (isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};
```

Never call `Intl.DateTimeFormat.format()` without first checking `isNaN(date.getTime())`.

---

*This document should be updated whenever design decisions change. Last reviewed: February 2026*
