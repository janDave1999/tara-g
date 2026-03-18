# Province Detail & Travel Logs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dedicated province detail page at `/bucket/[province_key]` where users can view their visit info and full CRUD on personal travel/activity logs per province.

**Architecture:** New `province_travel_logs` table (auth_id FK, same pattern as migration 038). API routes follow existing `/api/project82/` patterns (APIRoute + supabaseAdmin). Province grid buckets navigate to the detail page; map keeps existing VisitModal. Detail page is SSR with client-side CRUD via fetch + a LogModal component.

**Tech Stack:** Astro SSR, Tailwind CSS, Supabase (supabaseAdmin), TypeScript, existing PagePlate layout, existing VisitModal

---

## Task 1: Database Migration — `province_travel_logs`

**Files:**
- Create: `database-migrations/091_province_travel_logs.sql`

**Step 1: Write the migration**

```sql
-- =====================================================
-- MIGRATION 091: province_travel_logs
-- =====================================================
-- Stores per-province personal travel/activity logs.
-- user_id references auth.users(id) directly (same pattern as migration 038).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.province_travel_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  province_key TEXT        NOT NULL,
  title        TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description  TEXT,
  activity_type TEXT       NOT NULL DEFAULT 'other'
                           CHECK (activity_type IN (
                             'sightseeing','dining','shopping','entertainment',
                             'adventure','cultural','relaxation','other'
                           )),
  visit_date   DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-user, per-province queries
CREATE INDEX IF NOT EXISTS province_travel_logs_user_province
  ON public.province_travel_logs (user_id, province_key);

-- RLS
ALTER TABLE public.province_travel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_logs_select"
  ON public.province_travel_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "travel_logs_all"
  ON public.province_travel_logs FOR ALL
  USING (user_id = auth.uid());

GRANT ALL ON public.province_travel_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.province_travel_logs TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'MIGRATION 091 applied — province_travel_logs table created';
END $$;
```

**Step 2: Apply in Supabase**

Go to Supabase → SQL Editor → paste and run. Confirm "MIGRATION 091 applied" notice appears.

**Step 3: Commit**

```bash
git add database-migrations/091_province_travel_logs.sql
git commit -m "feat: add province_travel_logs table (migration 091)"
```

---

## Task 2: API — List & Create Logs

**Files:**
- Create: `src/pages/api/project82/[province_key]/logs.ts`

Pattern mirrors `src/pages/api/project82/index.ts`. Uses `supabaseAdmin` + `resolveUserId`.

**Step 1: Write the route**

```typescript
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_TYPES = [
  "sightseeing","dining","shopping","entertainment",
  "adventure","cultural","relaxation","other",
] as const;

async function resolveUserId(authId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("auth_id", authId)
    .single();
  return data?.user_id ?? null;
}

// GET /api/project82/[province_key]/logs
export const GET: APIRoute = async ({ locals, params }) => {
  const authId = locals.user_id;
  if (!authId) return json({ error: "Unauthorized" }, 401);

  const provinceKey = params.province_key?.toUpperCase();
  if (!provinceKey) return json({ error: "province_key required" }, 400);

  const { data: logs, error } = await supabaseAdmin
    .from("province_travel_logs")
    .select("id, title, description, activity_type, visit_date, created_at, updated_at")
    .eq("user_id", authId)
    .eq("province_key", provinceKey)
    .order("visit_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return json({ error: "Failed to fetch logs" }, 500);
  return json({ logs: logs ?? [] });
};

// POST /api/project82/[province_key]/logs
export const POST: APIRoute = async ({ locals, params, request }) => {
  const authId = locals.user_id;
  if (!authId) return json({ error: "Unauthorized" }, 401);

  const provinceKey = params.province_key?.toUpperCase();
  if (!provinceKey) return json({ error: "province_key required" }, 400);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { title, description, activity_type, visit_date } = body as {
    title?: string;
    description?: string;
    activity_type?: string;
    visit_date?: string;
  };

  if (!title || title.trim().length === 0)
    return json({ error: "title is required" }, 400);
  if (title.trim().length > 200)
    return json({ error: "title max 200 chars" }, 400);
  if (!activity_type || !VALID_TYPES.includes(activity_type as any))
    return json({ error: `activity_type must be one of: ${VALID_TYPES.join(", ")}` }, 400);

  const { data: log, error } = await supabaseAdmin
    .from("province_travel_logs")
    .insert({
      user_id:       authId,
      province_key:  provinceKey,
      title:         title.trim(),
      description:   description?.trim() || null,
      activity_type,
      visit_date:    visit_date || null,
    })
    .select()
    .single();

  if (error) return json({ error: "Failed to create log" }, 500);
  return json({ log }, 201);
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Step 2: Verify**

Manually test in browser devtools or curl:
```bash
# Should return { logs: [] } for a valid province key
curl -b <your-session-cookie> http://localhost:4321/api/project82/TAR/logs
```

**Step 3: Commit**

```bash
git add src/pages/api/project82/[province_key]/logs.ts
git commit -m "feat: add province travel logs list/create API"
```

---

## Task 3: API — Update & Delete Log

**Files:**
- Create: `src/pages/api/project82/[province_key]/logs/[log_id].ts`

**Step 1: Write the route**

```typescript
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_TYPES = [
  "sightseeing","dining","shopping","entertainment",
  "adventure","cultural","relaxation","other",
] as const;

// PUT /api/project82/[province_key]/logs/[log_id]
export const PUT: APIRoute = async ({ locals, params, request }) => {
  const authId = locals.user_id;
  if (!authId) return json({ error: "Unauthorized" }, 401);

  const logId = params.log_id;
  if (!logId) return json({ error: "log_id required" }, 400);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { title, description, activity_type, visit_date } = body as {
    title?: string;
    description?: string;
    activity_type?: string;
    visit_date?: string;
  };

  if (!title || title.trim().length === 0)
    return json({ error: "title is required" }, 400);
  if (title.trim().length > 200)
    return json({ error: "title max 200 chars" }, 400);
  if (!activity_type || !VALID_TYPES.includes(activity_type as any))
    return json({ error: `activity_type must be one of: ${VALID_TYPES.join(", ")}` }, 400);

  const { data: log, error } = await supabaseAdmin
    .from("province_travel_logs")
    .update({
      title:         title.trim(),
      description:   description?.trim() || null,
      activity_type,
      visit_date:    visit_date || null,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", logId)
    .eq("user_id", authId)   // ownership check
    .select()
    .single();

  if (error) return json({ error: "Failed to update log" }, 500);
  if (!log)  return json({ error: "Log not found" }, 404);
  return json({ log });
};

// DELETE /api/project82/[province_key]/logs/[log_id]
export const DELETE: APIRoute = async ({ locals, params }) => {
  const authId = locals.user_id;
  if (!authId) return json({ error: "Unauthorized" }, 401);

  const logId = params.log_id;
  if (!logId) return json({ error: "log_id required" }, 400);

  const { error, count } = await supabaseAdmin
    .from("province_travel_logs")
    .delete({ count: "exact" })
    .eq("id", logId)
    .eq("user_id", authId);   // ownership check

  if (error) return json({ error: "Failed to delete log" }, 500);
  if (count === 0) return json({ error: "Log not found" }, 404);
  return json({ success: true });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Step 2: Commit**

```bash
git add "src/pages/api/project82/[province_key]/logs/[log_id].ts"
git commit -m "feat: add province travel log update/delete API"
```

---

## Task 4: LogModal Component

**Files:**
- Create: `src/components/Project82/LogModal.astro`

This is a `<dialog>` element opened via `window.openLogModal(data)` — same pattern as `VisitModal.astro`.

**Step 1: Write the component**

```astro
---
// Opened programmatically via window.openLogModal(data)
---

<dialog
  id="log-modal"
  class="rounded-2xl shadow-2xl p-0 w-full max-w-sm mx-auto backdrop:bg-black/50 backdrop:backdrop-blur-sm"
>
  <div>
    <!-- Header -->
    <div class="bg-gradient-to-r from-sky-500 to-sky-600 px-5 py-4 flex items-start justify-between rounded-t-2xl">
      <div>
        <h2 id="log-modal-title" class="text-lg font-bold text-white">Travel Log</h2>
        <p id="log-modal-province" class="text-sky-100 text-xs mt-0.5"></p>
      </div>
      <button
        type="button"
        id="log-modal-close"
        class="text-white/70 hover:text-white transition-colors ml-4 mt-0.5"
        aria-label="Close"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Body -->
    <div class="px-5 py-4 space-y-4 bg-white">
      <!-- Title -->
      <div>
        <label for="log-title" class="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          Title <span class="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="log-title"
          maxlength="200"
          placeholder="e.g. Explored Chocolate Hills"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <p id="log-title-error" class="text-xs text-red-500 mt-1 hidden">Title is required.</p>
      </div>

      <!-- Activity Type -->
      <div>
        <label for="log-activity-type" class="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          Activity Type <span class="text-red-400">*</span>
        </label>
        <select
          id="log-activity-type"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
        >
          <option value="">Select type…</option>
          <option value="sightseeing">Sightseeing</option>
          <option value="dining">Dining</option>
          <option value="shopping">Shopping</option>
          <option value="entertainment">Entertainment</option>
          <option value="adventure">Adventure</option>
          <option value="cultural">Cultural</option>
          <option value="relaxation">Relaxation</option>
          <option value="other">Other</option>
        </select>
        <p id="log-type-error" class="text-xs text-red-500 mt-1 hidden">Activity type is required.</p>
      </div>

      <!-- Visit Date -->
      <div>
        <label for="log-visit-date" class="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          Date <span class="font-normal normal-case text-gray-400">(optional)</span>
        </label>
        <input
          type="date"
          id="log-visit-date"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </div>

      <!-- Description -->
      <div>
        <label for="log-description" class="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          Notes <span class="font-normal normal-case text-gray-400">(optional)</span>
        </label>
        <textarea
          id="log-description"
          rows="3"
          placeholder="What happened? What did you feel?"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-400"
        ></textarea>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-5 pb-5 pt-2 bg-white rounded-b-2xl flex gap-2">
      <button
        type="button"
        id="log-modal-delete"
        class="hidden px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors"
      >Delete</button>
      <button
        type="button"
        id="log-modal-save"
        class="flex-1 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >Save Log</button>
    </div>
  </div>
</dialog>

<script>
  type LogData = {
    id?: string;
    province_key: string;
    province_name: string;
    title?: string;
    description?: string | null;
    activity_type?: string;
    visit_date?: string | null;
  };

  const dialog    = document.getElementById('log-modal')         as HTMLDialogElement;
  const saveBtn   = document.getElementById('log-modal-save')    as HTMLButtonElement;
  const deleteBtn = document.getElementById('log-modal-delete')  as HTMLButtonElement;
  const closeBtn  = document.getElementById('log-modal-close')   as HTMLButtonElement;
  const titleErr  = document.getElementById('log-title-error')   as HTMLElement;
  const typeErr   = document.getElementById('log-type-error')    as HTMLElement;

  let current: LogData | null = null;

  (window as any).openLogModal = (data: LogData) => {
    current = data;
    const isEdit = !!data.id;

    (document.getElementById('log-modal-title') as HTMLElement).textContent =
      isEdit ? 'Edit Log' : 'Add Log';
    (document.getElementById('log-modal-province') as HTMLElement).textContent =
      data.province_name;

    (document.getElementById('log-title') as HTMLInputElement).value         = data.title ?? '';
    (document.getElementById('log-activity-type') as HTMLSelectElement).value = data.activity_type ?? '';
    (document.getElementById('log-visit-date') as HTMLInputElement).value    = data.visit_date ?? '';
    (document.getElementById('log-description') as HTMLTextAreaElement).value = data.description ?? '';

    titleErr.classList.add('hidden');
    typeErr.classList.add('hidden');
    saveBtn.textContent = 'Save Log';
    saveBtn.disabled = false;
    deleteBtn.disabled = false;
    deleteBtn.classList.toggle('hidden', !isEdit);

    dialog.showModal();
  };

  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  saveBtn.addEventListener('click', async () => {
    if (!current) return;

    const title        = (document.getElementById('log-title') as HTMLInputElement).value.trim();
    const activity_type = (document.getElementById('log-activity-type') as HTMLSelectElement).value;
    const visit_date   = (document.getElementById('log-visit-date') as HTMLInputElement).value;
    const description  = (document.getElementById('log-description') as HTMLTextAreaElement).value.trim();

    let valid = true;
    if (!title)         { titleErr.classList.remove('hidden'); valid = false; }
    else                { titleErr.classList.add('hidden'); }
    if (!activity_type) { typeErr.classList.remove('hidden'); valid = false; }
    else                { typeErr.classList.add('hidden'); }
    if (!valid) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const isEdit = !!current.id;
    const url    = isEdit
      ? `/api/project82/${current.province_key}/logs/${current.id}`
      : `/api/project82/${current.province_key}/logs`;

    try {
      const res = await fetch(url, {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, activity_type, visit_date: visit_date || null, description: description || null }),
      });
      if (!res.ok) throw new Error(await res.text());

      const { log } = await res.json() as { log: any };
      window.dispatchEvent(new CustomEvent(
        isEdit ? 'province-log-updated' : 'province-log-created',
        { detail: { log } }
      ));
      dialog.close();
    } catch (err) {
      console.error('Failed to save log:', err);
      saveBtn.textContent = 'Error — try again';
      saveBtn.disabled = false;
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (!current?.id) return;
    if (!confirm('Delete this travel log?')) return;

    deleteBtn.disabled = true;
    try {
      const res = await fetch(
        `/api/project82/${current.province_key}/logs/${current.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(await res.text());
      window.dispatchEvent(new CustomEvent('province-log-deleted', {
        detail: { log_id: current.id },
      }));
      dialog.close();
    } catch (err) {
      console.error('Failed to delete log:', err);
      deleteBtn.disabled = false;
    }
  });
</script>
```

**Step 2: Commit**

```bash
git add src/components/Project82/LogModal.astro
git commit -m "feat: add LogModal component for province travel logs"
```

---

## Task 5: Province Detail Page

**Files:**
- Create: `src/pages/bucket/[province_key].astro`

**Step 1: Write the page**

```astro
---
import PagePlate from "@/layouts/PagePlate.astro";
import VisitModal from "@/components/Project82/VisitModal.astro";
import LogModal from "@/components/Project82/LogModal.astro";
import { PH_PROVINCES } from "@/data/phProvinces";
import { supabaseAdmin } from "@/lib/supabase";

const authId = Astro.locals.user_id;
const pathname = new URL(Astro.request.url).pathname;
if (!authId) return Astro.redirect("/signin?next=" + encodeURIComponent(pathname));

const { province_key } = Astro.params;
const provinceKey = province_key?.toUpperCase() ?? "";
const province = PH_PROVINCES.find(p => p.key === provinceKey);
if (!province) return Astro.redirect("/project82");

// Fetch visit
const { data: visitRow } = await supabaseAdmin
  .from("user_province_visits")
  .select("id, stage, visit_date, notes, is_auto_detected, created_at")
  .eq("user_id", authId)
  .eq("province_key", provinceKey)
  .maybeSingle();

// Fetch travel logs
const { data: logsRows } = await supabaseAdmin
  .from("province_travel_logs")
  .select("id, title, description, activity_type, visit_date, created_at, updated_at")
  .eq("user_id", authId)
  .eq("province_key", provinceKey)
  .order("visit_date", { ascending: false, nullsFirst: false })
  .order("created_at", { ascending: false });

const visit = visitRow ?? null;
const logs = logsRows ?? [];

const STAGE_LABELS: Record<string, string> = {
  pass_through:         "Pass Through",
  short_stay:           "Short Stay",
  extended_stay:        "Extended Stay",
  thorough_exploration: "Thorough Exploration",
};
const STAGE_COLORS: Record<string, string> = {
  pass_through:         "bg-blue-100 text-blue-700",
  short_stay:           "bg-yellow-100 text-yellow-700",
  extended_stay:        "bg-orange-100 text-orange-700",
  thorough_exploration: "bg-red-100 text-red-700",
};
const TYPE_LABELS: Record<string, string> = {
  sightseeing:   "Sightseeing",
  dining:        "Dining",
  shopping:      "Shopping",
  entertainment: "Entertainment",
  adventure:     "Adventure",
  cultural:      "Cultural",
  relaxation:    "Relaxation",
  other:         "Other",
};
const TYPE_COLORS: Record<string, string> = {
  sightseeing:   "bg-sky-100 text-sky-700",
  dining:        "bg-amber-100 text-amber-700",
  shopping:      "bg-pink-100 text-pink-700",
  entertainment: "bg-purple-100 text-purple-700",
  adventure:     "bg-emerald-100 text-emerald-700",
  cultural:      "bg-indigo-100 text-indigo-700",
  relaxation:    "bg-teal-100 text-teal-700",
  other:         "bg-gray-100 text-gray-600",
};
---

<PagePlate
  title={`${province.name} — Tara G!`}
  description={{
    title: `${province.name} — Tara G!`,
    description: `Travel logs for ${province.name}, Region ${province.region}.`,
    author: "Tara G!",
    authorIs: "Organization",
  }}
>
  <div class="max-w-lg mx-auto px-4 py-6 space-y-6">

    <!-- Back + Header -->
    <div class="flex items-center gap-3">
      <a href="/project82" class="text-gray-400 hover:text-gray-600 transition-colors">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </a>
      <div class="flex-1 min-w-0">
        <h1 class="text-xl font-bold text-gray-900 truncate">{province.name}</h1>
        <p class="text-xs text-gray-400">Region {province.region}</p>
      </div>
      {visit && (
        <span class={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_COLORS[visit.stage] ?? "bg-gray-100 text-gray-600"}`}>
          {STAGE_LABELS[visit.stage] ?? visit.stage}
        </span>
      )}
    </div>

    <!-- Visit card -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wide">My Visit</h2>
        <button
          id="edit-visit-btn"
          class="text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
        >
          {visit ? "Edit" : "+ Log Visit"}
        </button>
      </div>
      {visit ? (
        <div class="px-4 py-3 space-y-1.5">
          <div class="flex items-center gap-2 text-sm text-gray-700">
            <span class={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_COLORS[visit.stage] ?? "bg-gray-100 text-gray-500"}`}>
              {STAGE_LABELS[visit.stage] ?? visit.stage}
            </span>
            {visit.visit_date && (
              <span class="text-gray-400 text-xs">
                {new Date(visit.visit_date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          {visit.notes && <p class="text-sm text-gray-500 leading-relaxed">{visit.notes}</p>}
        </div>
      ) : (
        <div class="px-4 py-5 text-center text-sm text-gray-400">
          You haven't logged a visit here yet.
        </div>
      )}
    </div>

    <!-- Travel Logs -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-gray-700">Travel Logs</h2>
        <button
          id="add-log-btn"
          class="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
          </svg>
          Add Log
        </button>
      </div>

      <!-- Log list -->
      <div id="log-list" class="space-y-2">
        {logs.length === 0 ? (
          <div id="log-empty" class="text-center py-8 text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            No travel logs yet. Tap "Add Log" to start.
          </div>
        ) : (
          logs.map(log => (
            <div
              class="log-card bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-1"
              data-log-id={log.id}
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800 truncate">{log.title}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[log.activity_type] ?? "bg-gray-100 text-gray-600"}`}>
                      {TYPE_LABELS[log.activity_type] ?? log.activity_type}
                    </span>
                    {log.visit_date && (
                      <span class="text-[10px] text-gray-400">
                        {new Date(log.visit_date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  class="edit-log-btn shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                  data-log={JSON.stringify(log)}
                  aria-label="Edit log"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
              </div>
              {log.description && (
                <p class="text-xs text-gray-500 leading-relaxed line-clamp-2">{log.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>

  </div>

  <VisitModal />
  <LogModal />
</PagePlate>

<script define:vars={{ province, visit, provinceKey: province.key }}>
  // --- Visit edit button ---
  document.getElementById('edit-visit-btn')?.addEventListener('click', () => {
    (window).openVisitModal({
      id:              visit?.id,
      province_key:    province.key,
      province_name:   province.name,
      province_region: `Region ${province.region}`,
      stage:           visit?.stage,
      visit_date:      visit?.visit_date ?? null,
      notes:           visit?.notes ?? null,
    });
  });

  // --- Add log button ---
  document.getElementById('add-log-btn')?.addEventListener('click', () => {
    (window).openLogModal({
      province_key:  province.key,
      province_name: province.name,
    });
  });

  // --- Edit log buttons (SSR-rendered) ---
  document.querySelectorAll('.edit-log-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const log = JSON.parse(btn.dataset.log ?? '{}');
      (window).openLogModal({
        id:            log.id,
        province_key:  province.key,
        province_name: province.name,
        title:         log.title,
        description:   log.description,
        activity_type: log.activity_type,
        visit_date:    log.visit_date,
      });
    });
  });

  // --- Log card HTML builder ---
  const TYPE_LABELS = {
    sightseeing:'Sightseeing', dining:'Dining', shopping:'Shopping',
    entertainment:'Entertainment', adventure:'Adventure',
    cultural:'Cultural', relaxation:'Relaxation', other:'Other',
  };
  const TYPE_COLORS = {
    sightseeing:'bg-sky-100 text-sky-700', dining:'bg-amber-100 text-amber-700',
    shopping:'bg-pink-100 text-pink-700', entertainment:'bg-purple-100 text-purple-700',
    adventure:'bg-emerald-100 text-emerald-700', cultural:'bg-indigo-100 text-indigo-700',
    relaxation:'bg-teal-100 text-teal-700', other:'bg-gray-100 text-gray-600',
  };

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' });
  }

  function buildLogCard(log) {
    const colorClass = TYPE_COLORS[log.activity_type] ?? 'bg-gray-100 text-gray-600';
    const typeLabel  = TYPE_LABELS[log.activity_type] ?? log.activity_type;
    const div = document.createElement('div');
    div.className = 'log-card bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-1';
    div.dataset.logId = log.id;
    div.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">${log.title}</p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${colorClass}">${typeLabel}</span>
            ${log.visit_date ? `<span class="text-[10px] text-gray-400">${formatDate(log.visit_date)}</span>` : ''}
          </div>
        </div>
        <button class="edit-log-btn shrink-0 text-gray-300 hover:text-gray-500 transition-colors" data-log='${JSON.stringify(log)}' aria-label="Edit log">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
      </div>
      ${log.description ? `<p class="text-xs text-gray-500 leading-relaxed line-clamp-2">${log.description}</p>` : ''}
    `;
    // Wire edit button
    div.querySelector('.edit-log-btn')?.addEventListener('click', () => {
      (window).openLogModal({
        id:            log.id,
        province_key:  province.key,
        province_name: province.name,
        title:         log.title,
        description:   log.description,
        activity_type: log.activity_type,
        visit_date:    log.visit_date,
      });
    });
    return div;
  }

  function hideEmpty() {
    document.getElementById('log-empty')?.remove();
  }

  // --- Live updates ---
  window.addEventListener('province-log-created', (e) => {
    const { log } = e.detail;
    hideEmpty();
    const list = document.getElementById('log-list');
    if (list) list.prepend(buildLogCard(log));
  });

  window.addEventListener('province-log-updated', (e) => {
    const { log } = e.detail;
    const existing = document.querySelector(`[data-log-id="${log.id}"]`);
    if (existing) existing.replaceWith(buildLogCard(log));
  });

  window.addEventListener('province-log-deleted', (e) => {
    const { log_id } = e.detail;
    document.querySelector(`[data-log-id="${log_id}"]`)?.remove();
    const list = document.getElementById('log-list');
    if (list && list.children.length === 0) {
      const empty = document.createElement('div');
      empty.id = 'log-empty';
      empty.className = 'text-center py-8 text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200';
      empty.textContent = 'No travel logs yet. Tap "Add Log" to start.';
      list.appendChild(empty);
    }
  });

  // Visit saved — reload visit card area (simplest: full page reload for visit changes)
  window.addEventListener('province-visit-saved', () => { window.location.reload(); });
  window.addEventListener('province-visit-deleted', () => { window.location.reload(); });
</script>
```

**Step 2: Verify manually**

- Navigate to `/bucket/TAR` (or any province key) — should render the page
- If province not in PH_PROVINCES, redirects to `/project82`
- If not authenticated, redirects to `/signin`

**Step 3: Commit**

```bash
git add src/pages/bucket/[province_key].astro
git commit -m "feat: add province detail page with travel logs"
```

---

## Task 6: Wire ProvinceGrid Buckets → Detail Page

**Files:**
- Modify: `src/components/Project82/ProvinceGrid.astro`

Change the click handler from opening `VisitModal` to navigating to `/bucket/[province_key]`.

**Step 1: Replace the click handler in the `<script>` block**

Find this section in `ProvinceGrid.astro`:
```typescript
  // Click → open VisitModal
  document.querySelectorAll<HTMLButtonElement>('#province-grid .province-bucket').forEach(btn => {
    btn.addEventListener('click', () => {
      const key    = btn.dataset.key ?? '';
      const name   = btn.dataset.name ?? '';
      const region = btn.dataset.region ?? '';
      const visit  = visitMap.get(key);
      (window as any).openVisitModal({
        id:              visit?.id,
        province_key:    key,
        province_name:   name,
        province_region: `Region ${region}`,
        stage:           visit?.stage,
        visit_date:      visit?.visit_date ?? null,
        notes:           visit?.notes ?? null,
      });
    });
  });
```

Replace with:
```typescript
  // Click → navigate to province detail page
  document.querySelectorAll<HTMLButtonElement>('#province-grid .province-bucket').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key ?? '';
      if (key) window.location.href = `/bucket/${key}`;
    });
  });
```

**Step 2: Commit**

```bash
git add src/components/Project82/ProvinceGrid.astro
git commit -m "feat: province grid buckets navigate to detail page"
```

---

## Task 7: Final QA Checklist

Run through these manually in the browser:

- [ ] `/project82` loads — grid shows all 82 provinces
- [ ] Clicking a bucket navigates to `/bucket/[key]`
- [ ] `/bucket/TAR` shows province name, region, "My Visit" card
- [ ] If no visit: "Log Visit" button opens VisitModal; after save, page reloads with visit shown
- [ ] "Add Log" button opens LogModal
- [ ] Saving a log adds it to the list without page reload
- [ ] Editing a log (pencil icon) opens LogModal pre-filled
- [ ] Updating a log replaces the card in place
- [ ] Deleting a log removes the card; empty state appears when list is empty
- [ ] Map province click still opens VisitModal (unchanged)
- [ ] `/bucket/INVALID` redirects to `/project82`
- [ ] Unauthenticated `/bucket/TAR` redirects to `/signin?next=/bucket/TAR`

**Step: Final commit**

```bash
git add -A
git commit -m "feat: province detail travel logs — complete"
```
