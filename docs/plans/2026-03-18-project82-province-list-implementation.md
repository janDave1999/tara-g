# Project 82 Province List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a province grid list view to Project 82 that displays all 82 provinces alphabetically, accessible via zoom-out interaction.

**Architecture:** Split view with adjustable height - map on top (40%) and province grid below (60%). Zoom controls toggle between map-only and map+grid views. Uses existing visit data and VisitModal.

**Tech Stack:** Astro components, TypeScript, CSS (Tailwind)

---

### Task 1: Create ProvinceGrid Component

**Files:**
- Create: `src/components/Project82/ProvinceGrid.astro`

**Step 1: Write the component**

```astro
---
import { PH_PROVINCES } from "@/data/phProvinces";

interface Visit {
  id: string;
  province_key: string;
  stage: string;
  visit_date: string | null;
}

interface Props {
  visits: Visit[];
}

const { visits } = Astro.props;

const STAGE_COLORS: Record<string, string> = {
  pass_through: '#3B82F6',
  short_stay: '#FBBF24',
  extended_stay: '#F97316',
  thorough_exploration: '#EF4444',
};

const visitMap = new Map(visits.map(v => [v.province_key, v]));
const sortedProvinces = [...PH_PROVINCES].sort((a, b) => a.name.localeCompare(b.name));
---

<div id="province-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 overflow-y-auto">
  {sortedProvinces.map(province => {
    const visit = visitMap.get(province.key);
    const isVisited = !!visit;
    const stageColor = visit ? STAGE_COLORS[visit.stage] : '#E5E7EB';
    
    return (
      <button
        type="button"
        class:list={[
          "province-bucket flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left",
          isVisited 
            ? "bg-white border-gray-200 hover:border-emerald-400 hover:shadow-sm" 
            : "bg-gray-50 border-gray-100 opacity-60"
        ]}
        data-province-key={province.key}
        data-province-name={province.name}
        data-province-region={`Region ${province.region}`}
        data-stage={visit?.stage ?? ''}
        data-visit-date={visit?.visit_date ?? ''}
        data-is-visited={isVisited}
      >
        <span 
          class:list=["w-2 h-2 rounded-full shrink-0", isVisited ? "ring-2 ring-white shadow-sm" : ""]
          style={`background: ${stageColor}`}
        />
        <span class:list={["text-xs font-medium truncate", isVisited ? "text-gray-800" : "text-gray-400"]}>
          {province.name}
        </span>
        {isVisited && (
          <svg class="w-3 h-3 text-emerald-500 shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
          </svg>
        )}
      </button>
    );
  })}
</div>

<script>
  const grid = document.getElementById('province-grid');
  
  grid?.addEventListener('click', (e) => {
    const bucket = (e.target as HTMLElement).closest('.province-bucket') as HTMLElement;
    if (!bucket) return;
    
    const data = {
      id: bucket.dataset.stage ? 'existing' : undefined,
      province_key: bucket.dataset.provinceKey,
      province_name: bucket.dataset.provinceName,
      province_region: bucket.dataset.provinceRegion,
      stage: bucket.dataset.stage || undefined,
      visit_date: bucket.dataset.visitDate || null,
      notes: null,
    };
    
    (window as any).openVisitModal(data);
  });

  // Live update on save
  window.addEventListener('province-visit-saved', (e: any) => {
    const { province_key, stage, visit } = e.detail;
    const bucket = document.querySelector(`[data-province-key="${province_key}"]`) as HTMLElement;
    if (!bucket) return;
    
    const color = { pass_through: '#3B82F6', short_stay: '#FBBF24', extended_stay: '#F97316', thorough_exploration: '#EF4444' }[stage] || '#E5E7EB';
    
    bucket.classList.remove('bg-gray-50', 'border-gray-100', 'opacity-60');
    bucket.classList.add('bg-white', 'border-gray-200', 'hover:border-emerald-400', 'hover:shadow-sm');
    
    const dot = bucket.querySelector('span:first-child');
    if (dot) {
      dot.classList.remove('bg-gray-200');
      dot.classList.add('ring-2', 'ring-white', 'shadow-sm');
      (dot as HTMLElement).style.background = color;
    }
    
    const nameSpan = bucket.querySelector('span:nth-child(2)');
    if (nameSpan) {
      nameSpan.classList.remove('text-gray-400');
      nameSpan.classList.add('text-gray-800');
    }
    
    // Add checkmark if not exists
    if (!bucket.querySelector('svg')) {
      const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      checkmark.setAttribute('class', 'w-3 h-3 text-emerald-500 shrink-0 ml-auto');
      checkmark.setAttribute('fill', 'none');
      checkmark.setAttribute('stroke', 'currentColor');
      checkmark.setAttribute('viewBox', '0 0 24 24');
      checkmark.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>';
      bucket.appendChild(checkmark);
    }
    
    bucket.dataset.stage = stage;
    bucket.dataset.visitDate = visit?.visit_date || '';
    bucket.dataset.isVisited = 'true';
  });

  // Live update on delete
  window.addEventListener('province-visit-deleted', (e: any) => {
    const { province_key } = e.detail;
    const bucket = document.querySelector(`[data-province-key="${province_key}"]`) as HTMLElement;
    if (!bucket) return;
    
    bucket.classList.add('bg-gray-50', 'border-gray-100', 'opacity-60');
    bucket.classList.remove('bg-white', 'border-gray-200', 'hover:border-emerald-400', 'hover:shadow-sm');
    
    const dot = bucket.querySelector('span:first-child');
    if (dot) {
      dot.classList.remove('ring-2', 'ring-white', 'shadow-sm');
      (dot as HTMLElement).style.background = '#E5E7EB';
    }
    
    const nameSpan = bucket.querySelector('span:nth-child(2)');
    if (nameSpan) {
      nameSpan.classList.add('text-gray-400');
      nameSpan.classList.remove('text-gray-800');
    }
    
    const checkmark = bucket.querySelector('svg');
    checkmark?.remove();
    
    bucket.dataset.stage = '';
    bucket.dataset.visitDate = '';
    bucket.dataset.isVisited = 'false';
  });
</script>
```

**Step 2: Verify file created**

Run: `ls src/components/Project82/ProvinceGrid.astro`

---

### Task 2: Create ZoomControls Component

**Files:**
- Create: `src/components/Project82/ZoomControls.astro`

**Step 1: Write the component**

```astro
---
interface Props {
  min?: number;
  max?: number;
  initial?: number;
}

const { min = 1, max = 4, initial = 1 } = Astro.props;
---

<div id="zoom-controls" class="absolute top-4 right-4 flex flex-col gap-1 z-10">
  <button
    type="button"
    id="zoom-in"
    class="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
    title="Zoom in"
    disabled={false}
  >
    <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/>
    </svg>
  </button>
  <button
    type="button"
    id="zoom-out"
    class="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
    title="Zoom out"
    disabled={false}
  >
    <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6"/>
    </svg>
  </button>
</div>

<script define:vars={{ min, max, initial }}>
  let zoomLevel = initial;
  
  function updateZoom(newLevel) {
    zoomLevel = Math.max(min, Math.min(max, newLevel));
    
    const inBtn = document.getElementById('zoom-in');
    const outBtn = document.getElementById('zoom-out');
    if (inBtn) inBtn.disabled = zoomLevel >= max;
    if (outBtn) outBtn.disabled = zoomLevel <= min;
    
    // Dispatch custom event for layout to respond
    window.dispatchEvent(new CustomEvent('zoom-change', { detail: { level: zoomLevel } }));
    
    // Store in localStorage
    localStorage.setItem('project82_zoom', String(zoomLevel));
  }
  
  // Load saved zoom level
  const saved = localStorage.getItem('project82_zoom');
  if (saved) {
    updateZoom(parseInt(saved, 10));
  }
  
  document.getElementById('zoom-in')?.addEventListener('click', () => updateZoom(zoomLevel + 1));
  document.getElementById('zoom-out')?.addEventListener('click', () => updateZoom(zoomLevel - 1));
</script>
```

**Step 2: Verify file created**

Run: `ls src/components/Project82/ZoomControls.astro`

---

### Task 3: Modify project82.astro for Split View

**Files:**
- Modify: `src/pages/project82.astro`

**Step 1: Add ProvinceGrid and ZoomControls to imports**

```astro
import ProvinceGrid from "@/components/Project82/ProvinceGrid.astro";
import ZoomControls from "@/components/Project82/ZoomControls.astro";
```

**Step 2: Modify the layout structure**

Replace the main div content:

```astro
<div class="flex flex-col h-[calc(100vh-64px)]">
  <!-- Header bar -->
  <div class="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
    <!-- ... existing header content ... -->
  </div>

  <!-- Map and Grid Container -->
  <div id="map-grid-container" class="flex-1 flex flex-col overflow-hidden relative">
    <!-- Map section (height changes based on zoom) -->
    <div id="map-section" class="w-full overflow-hidden transition-all duration-300">
      <ProvinceMap visits={visits} />
      <ZoomControls />
    </div>
    
    <!-- Grid section (hidden when zoomed in) -->
    <div id="grid-section" class="w-full overflow-hidden transition-all duration-300 hidden bg-gray-50">
      <ProvinceGrid visits={visits} />
    </div>
  </div>
</div>
```

**Step 3: Add zoom handling script**

Add to the existing script section:

```javascript
const mapSection = document.getElementById('map-section');
const gridSection = document.getElementById('grid-section');

function handleZoom(e) {
  const level = e.detail.level;
  const isZoomedOut = level >= 3;
  
  if (isZoomedOut) {
    mapSection.style.height = '40%';
    gridSection.classList.remove('hidden');
  } else {
    mapSection.style.height = '100%';
    gridSection.classList.add('hidden');
  }
}

window.addEventListener('zoom-change', handleZoom);

// Initialize on page load
const savedZoom = localStorage.getItem('project82_zoom');
if (savedZoom && parseInt(savedZoom, 10) >= 3) {
  mapSection.style.height = '40%';
  gridSection.classList.remove('hidden');
}
```

**Step 4: Pass visits data to ProvinceGrid**

Update line 51 to pass visits:

```astro
<ProvinceMap visits={visits} />
```

And add ProvinceGrid with visits:

```astro
<div id="grid-section" class="w-full overflow-hidden transition-all duration-300 hidden bg-gray-50">
  <ProvinceGrid visits={visits} />
</div>
```

**Step 5: Commit**

Run: `git add src/pages/project82.astro src/components/Project82/ProvinceGrid.astro src/components/Project82/ZoomControls.astro`
Run: `git commit -m "feat: add province grid list view with zoom controls"`

---

### Task 4: Add BucketIcon Branding

**Files:**
- Modify: `src/pages/project82.astro`

**Step 1: Import BucketIcon**

```astro
import BucketIcon from "@/features/navbar/BucketIcon.astro";
```

**Step 2: Add to header**

Replace the header title section with icon + title:

```astro
<div class="shrink-0 whitespace-nowrap flex items-center gap-2">
  <BucketIcon class="w-5 h-5 text-emerald-600" />
  <div>
    <h1 class="text-sm font-bold text-gray-900 leading-none">Project 82</h1>
    <p class="text-[10px] text-gray-400 leading-none mt-0.5">PH Provinces</p>
  </div>
</div>
```

**Step 3: Commit**

Run: `git add src/pages/project82.astro`
Run: `git commit -m "feat: add BucketIcon branding to project82 header"`

---

### Task 5: Test and Verify

**Step 1: Run the development server**

Run: `npm run dev`

**Step 2: Navigate to /project82**

- Verify map loads
- Verify zoom controls appear in top-right
- Click zoom out (-) to reveal grid
- Verify provinces are alphabetically sorted
- Verify visited provinces show checkmark and color
- Click on a province bucket to open VisitModal
- Save a visit and verify grid updates live

**Step 3: Test responsive layout**

- Check on mobile viewport (2 columns)
- Check on desktop viewport (4 columns)

**Step 4: Commit**

Run: `git commit -m "test: verify province grid list functionality"`

---

### Task 6: Run TypeCheck and Lint

**Step 1: Run typecheck**

Run: `npm run typecheck` (or check package.json for correct command)

**Step 2: Run lint**

Run: `npm run lint` (or check package.json for correct command)

**Step 3: Fix any errors**

**Step 4: Commit any fixes**

Run: `git add . && git commit -m "fix: typecheck and lint fixes"`

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create ProvinceGrid.astro component |
| 2 | Create ZoomControls.astro component |
| 3 | Modify project82.astro for split view with zoom |
| 4 | Add BucketIcon branding |
| 5 | Test and verify functionality |
| 6 | Run typecheck and lint |
