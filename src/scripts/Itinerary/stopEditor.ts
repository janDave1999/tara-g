import { actions } from 'astro:actions';
import { showToast } from '@/scripts/Toast';
import { createConfirmModal } from '@/scripts/Modal';
import { createMapboxSearchBox } from '@/scripts/mapBoxSearch';

const MAX_PICKUP = 20;
const MAX_DROPOFF = 20;

// --- DOM-update helpers (avoid page reload) ---

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STOP_COLORS: Record<string, { text: string; dot: string }> = {
  pickup:        { text: 'text-blue-700',    dot: 'bg-blue-500' },
  dropoff:       { text: 'text-purple-700',  dot: 'bg-purple-500' },
  destination:   { text: 'text-emerald-700', dot: 'bg-emerald-500' },
  activity:      { text: 'text-orange-700',  dot: 'bg-orange-500' },
  meal_break:    { text: 'text-amber-700',   dot: 'bg-amber-500' },
  rest_stop:     { text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  transit:       { text: 'text-slate-700',   dot: 'bg-slate-500' },
  checkpoint:    { text: 'text-pink-700',    dot: 'bg-pink-500' },
  accommodation: { text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  boat:          { text: 'text-teal-700',    dot: 'bg-teal-500' },
};
const getStopTextColor = (t: string) => (STOP_COLORS[t] ?? STOP_COLORS.activity).text;
const getStopDotColor  = (t: string) => (STOP_COLORS[t] ?? STOP_COLORS.activity).dot;

const formatTimeISO = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
};

const computeStopTime = (start: string, end: string): string => {
  const sl = formatTimeISO(start);
  const el = formatTimeISO(end);
  return sl && el && sl !== el ? `${sl} – ${el}` : sl || el;
};

/** True if the user is currently in edit mode (controls are visible). */
const isEditModeActive = () => document.querySelector('.edit-controls.flex') !== null;

const EDIT_BTN_SVG = `<svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`;
const DELETE_BTN_SVG = `<svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
const ADD_ACTIVITY_SVG = `<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>`;

/** Update the view-mode portion of a stop card after an edit (without touching ActivityList). */
const updateStopViewMode = (stopCard: HTMLElement, data: {
  locationType: string; locationName: string;
  scheduledStart: string; scheduledEnd: string; notes: string;
}) => {
  const viewMode = stopCard.querySelector<HTMLElement>('.view-mode')!;
  const flex1 = viewMode.querySelector<HTMLElement>('.flex-1');
  const shrink0 = viewMode.querySelector<HTMLElement>('.shrink-0');

  // Type label
  const typeSpan = flex1?.querySelector('span');
  if (typeSpan) {
    [...typeSpan.classList].filter(c => c.startsWith('text-')).forEach(c => typeSpan.classList.remove(c));
    typeSpan.classList.add(getStopTextColor(data.locationType));
    typeSpan.textContent = data.locationType.replace(/_/g, ' ');
  }

  // Location name
  let nameEl = flex1?.querySelector('p');
  if (data.locationName) {
    if (!nameEl) {
      nameEl = document.createElement('p');
      nameEl.className = 'font-semibold text-gray-900 text-base leading-snug mt-0.5';
      flex1?.appendChild(nameEl);
    }
    nameEl.textContent = data.locationName;
  } else if (nameEl) {
    nameEl.remove();
  }

  // Time
  let timeEl = shrink0?.querySelector<HTMLElement>('.tabular-nums');
  const stopTime = computeStopTime(data.scheduledStart, data.scheduledEnd);
  if (stopTime) {
    if (!timeEl) {
      timeEl = document.createElement('span');
      timeEl.className = 'text-sm font-medium text-gray-400 tabular-nums';
      shrink0?.insertBefore(timeEl, shrink0.firstChild);
    }
    timeEl.textContent = stopTime;
  } else if (timeEl) {
    timeEl.remove();
  }

  // Notes
  let notesEl = viewMode.querySelector<HTMLElement>('p.italic');
  if (data.notes) {
    if (!notesEl) {
      notesEl = document.createElement('p');
      notesEl.className = 'text-xs text-gray-400 italic mt-2 leading-relaxed';
      viewMode.querySelector('.flex.items-start')?.insertAdjacentElement('afterend', notesEl);
    }
    notesEl.textContent = data.notes;
  } else if (notesEl) {
    notesEl.remove();
  }
};

/** Build HTML for a freshly-created stop card (owner view). */
const renderNewStopCard = (stopId: string, data: {
  locationType: string; locationName: string;
  scheduledStart: string; scheduledEnd: string; notes: string;
}) => {
  const dotColor  = getStopDotColor(data.locationType);
  const textColor = getStopTextColor(data.locationType);
  const stopTime  = computeStopTime(data.scheduledStart, data.scheduledEnd);
  const ctrlCls   = isEditModeActive() ? 'flex' : 'hidden';
  return `
    <div class="timeline-item relative group pl-9 border-b border-gray-100 last:border-b-0"
      data-stop-id="${stopId}"
      data-stop-name="${esc(data.locationName)}"
      data-stop-type="${esc(data.locationType)}"
      data-location-name="${esc(data.locationName)}"
      data-scheduled-start="${esc(data.scheduledStart)}"
      data-scheduled-end="${esc(data.scheduledEnd)}"
      data-notes="${esc(data.notes)}"
    >
      <div class="absolute left-[-5px] top-4 w-2 h-2 ${dotColor} rounded-full border-2 border-white z-10"></div>
      <div class="stop-card py-3.5">
        <div class="view-mode">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <span class="text-xs font-semibold ${textColor} uppercase tracking-wide">${esc(data.locationType.replace(/_/g, ' '))}</span>
              ${data.locationName ? `<p class="font-semibold text-gray-900 text-base leading-snug mt-0.5">${esc(data.locationName)}</p>` : ''}
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${stopTime ? `<span class="text-sm font-medium text-gray-400 tabular-nums">${stopTime}</span>` : ''}
              <div class="edit-controls ${ctrlCls} gap-0.5">
                <button class="edit-stop-btn p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Edit stop">${EDIT_BTN_SVG}</button>
                <button class="delete-stop-btn p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete stop">${DELETE_BTN_SVG}</button>
              </div>
            </div>
          </div>
          ${data.notes ? `<p class="text-xs text-gray-400 italic mt-2 leading-relaxed">${esc(data.notes)}</p>` : ''}
          <button class="add-activity-btn mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 items-center gap-1 ${ctrlCls}" data-stop-id="${stopId}">
            ${ADD_ACTIVITY_SVG} Add Activity
          </button>
        </div>
        <div class="edit-mode hidden"></div>
      </div>
    </div>
  `;
};

/**
 * Convert a UTC ISO string from the DB into "YYYY-MM-DDTHH:mm" using local time parts,
 * so <input type="datetime-local"> shows the correct local time.
 */
const formatDateTimeLocal = (isoString: string): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Convert a datetime-local string ("YYYY-MM-DDTHH:mm", browser-local time) to UTC ISO
 * before sending to the server, so Supabase stores the correct absolute timestamp.
 */
const toUTCISO = (v: string | undefined | null): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v); // browser: naive string → local time → Date object
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

const showLoading = (element: HTMLButtonElement, message = 'Saving...') => {
  const originalText = element.textContent;
  element.textContent = message;
  element.setAttribute('disabled', 'true');
  return originalText!;
};

const hideLoading = (element: HTMLButtonElement, originalText: string) => {
  element.textContent = originalText;
  element.removeAttribute('disabled');
};

const parseCoord = (val: string | undefined | null): number | undefined => {
  if (!val) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
};

// --- Inline form error helpers ---

const showFormError = (form: Element, message: string) => {
  const el = form.querySelector<HTMLElement>('.form-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const clearFormError = (form: Element) => {
  form.querySelector<HTMLElement>('.form-error')?.classList.add('hidden');
};

// --- Trip date-range validation ---

/**
 * Returns an error string if scheduledStart or scheduledEnd fall outside [tripStart, tripEnd].
 * tripStart / tripEnd are plain date strings ("YYYY-MM-DD"). Comparison is done by calendar date only.
 */
const validateTripDateRange = (
  scheduledStart: string,
  scheduledEnd: string | undefined,
  tripStart: string,
  tripEnd: string,
): string | null => {
  if (!tripStart && !tripEnd) return null; // no trip dates set — skip

  const toDate = (iso: string) => {
    // Accept both full ISO and plain date
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d.getTime()) ? null : d;
  };

  const tripS = tripStart ? toDate(tripStart) : null;
  const tripE = tripEnd   ? toDate(tripEnd)   : null;

  const check = (iso: string, label: string): string | null => {
    const d = toDate(iso);
    if (!d) return null;
    // Compare by date only (strip time)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (tripS) {
      const ts = new Date(tripS.getFullYear(), tripS.getMonth(), tripS.getDate());
      if (day < ts) return `${label} must be on or after the trip start date (${tripStart}).`;
    }
    if (tripE) {
      const te = new Date(tripE.getFullYear(), tripE.getMonth(), tripE.getDate());
      if (day > te) return `${label} must be on or before the trip end date (${tripEnd}).`;
    }
    return null;
  };

  if (scheduledStart) {
    const err = check(scheduledStart, 'Start time');
    if (err) return err;
  }
  if (scheduledEnd) {
    const err = check(scheduledEnd, 'End time');
    if (err) return err;
  }
  return null;
};

// --- US18a: Pickup / Dropoff count limit ---

const countStopsByType = (type: string): number =>
  document.querySelectorAll<HTMLElement>(`.timeline-item[data-stop-type="${type}"]`).length;

const validateTypeLimit = (type: string): string | null => {
  if (type === 'pickup' && countStopsByType('pickup') >= MAX_PICKUP) {
    return `Maximum of ${MAX_PICKUP} pickup stops allowed per trip.`;
  }
  if (type === 'dropoff' && countStopsByType('dropoff') >= MAX_DROPOFF) {
    return `Maximum of ${MAX_DROPOFF} dropoff stops allowed per trip.`;
  }
  return null;
};

// --- US18b: Time overlap validation ---

interface StopInterval {
  start: Date;
  end: Date | null;
}

/** Collect all stop intervals on the given day (by calendar date string), optionally excluding one stopId. */
const getStopsOnDay = (dayStr: string, excludeStopId?: string): StopInterval[] => {
  const result: StopInterval[] = [];
  document.querySelectorAll<HTMLElement>('.timeline-item').forEach(item => {
    if (excludeStopId && item.dataset.stopId === excludeStopId) return;
    const startStr = item.dataset.scheduledStart;
    if (!startStr) return;
    const start = new Date(startStr);
    if (isNaN(start.getTime()) || start.toDateString() !== dayStr) return;
    const endStr = item.dataset.scheduledEnd;
    const end = endStr ? new Date(endStr) : null;
    result.push({ start, end: end && !isNaN(end.getTime()) ? end : null });
  });
  return result;
};

/**
 * Returns true if [newStart, newEnd] overlaps any interval in the list.
 * Rules (per US18b):
 *  - If newEnd is absent: only flag an exact start-time collision.
 *  - If newEnd is present but existing stop has no end: flag if existing start falls within [newStart, newEnd).
 *  - If both have end times: standard interval overlap (newStart < existEnd && newEnd > existStart).
 */
const hasOverlap = (newStart: Date, newEnd: Date | null, stops: StopInterval[]): boolean => {
  for (const s of stops) {
    if (!newEnd) {
      if (newStart.getTime() === s.start.getTime()) return true;
    } else if (!s.end) {
      if (s.start >= newStart && s.start < newEnd) return true;
    } else {
      if (newStart < s.end && newEnd > s.start) return true;
    }
  }
  return false;
};

const validateTimeOverlap = (
  scheduledStart: string,
  scheduledEnd: string | undefined,
  excludeStopId?: string
): string | null => {
  if (!scheduledStart) return null;
  const start = new Date(scheduledStart);
  if (isNaN(start.getTime())) return null;

  const end = scheduledEnd ? new Date(scheduledEnd) : null;
  if (end && !isNaN(end.getTime()) && end <= start) {
    return 'End time must be after start time.';
  }

  const dayStr = start.toDateString();
  const stops = getStopsOnDay(dayStr, excludeStopId);
  if (hasOverlap(start, end && !isNaN(end.getTime()) ? end : null, stops)) {
    return 'This stop overlaps with an existing stop on the same day.';
  }
  return null;
};

// --- Form HTML helpers ---

const ERROR_DIV = `<div class="form-error hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1"></div>`;

const typeOptions = (selected = 'activity') => `
  <option value="activity"    ${selected === 'activity'       ? 'selected' : ''}>Activity</option>
  <option value="pickup"      ${selected === 'pickup'         ? 'selected' : ''}>Pickup</option>
  <option value="dropoff"     ${selected === 'dropoff'        ? 'selected' : ''}>Dropoff</option>
  <option value="meal_break"  ${selected === 'meal_break'     ? 'selected' : ''}>Meal Break</option>
  <option value="rest_stop"   ${selected === 'rest_stop'      ? 'selected' : ''}>Rest Stop</option>
  <option value="transit"     ${selected === 'transit'        ? 'selected' : ''}>Transit</option>
  <option value="accommodation" ${selected === 'accommodation'? 'selected' : ''}>Accommodation</option>
  <option value="checkpoint"  ${selected === 'checkpoint'     ? 'selected' : ''}>Checkpoint</option>
  <option value="boat"        ${selected === 'boat'           ? 'selected' : ''}>Boat / Ferry</option>
`;

// --- Edit existing stop form ---

const createStopEditor = (stopCard: HTMLElement, stopData: any) => {
  const editMode = stopCard.querySelector('.edit-mode')! as HTMLElement;
  const inputId = `edit-stop-location-${Date.now()}`;

  editMode.innerHTML = `
    <form class="edit-stop-form space-y-3 bg-white/90 p-4 rounded-lg border-2 border-blue-300">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Location Name *</label>
          <input
            id="${inputId}"
            type="text"
            name="location_name"
            value="${stopData.location_name || ''}"
            placeholder="Search location..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
          <input type="hidden" name="latitude" value="" />
          <input type="hidden" name="longitude" value="" />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Type *</label>
          <select name="location_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            ${typeOptions(stopData.location_type || 'activity')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Start Time *</label>
          <input type="datetime-local" name="scheduled_start" value="${stopData.scheduled_start ? formatDateTimeLocal(stopData.scheduled_start) : ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">End Time</label>
          <input type="datetime-local" name="scheduled_end" value="${stopData.scheduled_end ? formatDateTimeLocal(stopData.scheduled_end) : ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-700 mb-1">Notes</label>
        <textarea name="notes" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" rows="2">${stopData.notes || ''}</textarea>
      </div>
      ${ERROR_DIV}
      <div class="flex justify-end gap-2 pt-2 border-t">
        <button type="button" class="cancel-edit-btn px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-semibold">Cancel</button>
        <button type="button" class="save-stop-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Save Changes</button>
      </div>
    </form>
  `;

  const viewMode = stopCard.querySelector('.view-mode') as HTMLElement;
  if (viewMode) viewMode.style.display = 'none';
  editMode.style.display = 'block';

  createMapboxSearchBox({
    sessionTokenID: crypto.randomUUID(),
    targetSelector: `#${inputId}`,
    placeholder: 'Search location...',
    onSelect: ({ coordinates }) => {
      const latInput = editMode.querySelector<HTMLInputElement>('[name="latitude"]');
      const lngInput = editMode.querySelector<HTMLInputElement>('[name="longitude"]');
      if (latInput) latInput.value = String(coordinates[1]);
      if (lngInput) lngInput.value = String(coordinates[0]);
    },
  });
};

// --- Add new stop form ---

/** Returns a suggested start time: the latest scheduled_end (or scheduled_start) among
 *  stops already in the given day's timeline container, plus a 15-minute buffer.
 *  Falls back to the current time if no stops exist yet. */
const suggestStartTime = (timelineContainer: HTMLElement): Date => {
  let latest = new Date();
  timelineContainer.querySelectorAll<HTMLElement>('.timeline-item').forEach(item => {
    const endStr = item.dataset.scheduledEnd;
    const startStr = item.dataset.scheduledStart;
    const candidate = endStr ? new Date(endStr) : startStr ? new Date(startStr) : null;
    if (candidate && !isNaN(candidate.getTime()) && candidate > latest) {
      latest = candidate;
    }
  });
  // Round up to the next 15-minute mark after the latest stop
  const ms = latest.getTime();
  const buffer = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / buffer) * buffer);
};

const createAddStopForm = (timelineContainer: HTMLElement, dayIndex: number) => {
  const existingForm = timelineContainer.querySelector('.add-stop-form');
  if (existingForm) return;

  const suggestedStart = suggestStartTime(timelineContainer);
  const defaultStart = suggestedStart.toISOString();
  const inputId = `add-stop-location-${Date.now()}`;

  const formHTML = `
    <form class="add-stop-form relative pl-12 pb-6">
      <div class="absolute -left-[9px] top-2 w-5 h-5 bg-linear-to-br from-green-500 to-emerald-500 rounded-full border-4 border-white shadow-lg z-10 animate-pulse"></div>
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-dashed border-green-400 rounded-xl p-5 shadow-lg">
        <h4 class="text-green-700 font-bold text-base mb-4">➕ New Stop</h4>
        <div class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Location Name *</label>
              <input
                id="${inputId}"
                type="text"
                name="location_name"
                placeholder="Search location..."
                class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              />
              <input type="hidden" name="latitude" value="" />
              <input type="hidden" name="longitude" value="" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Type *</label>
              <select name="location_type" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500">
                ${typeOptions('activity')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Start Time *</label>
              <input type="datetime-local" name="scheduled_start" value="${formatDateTimeLocal(defaultStart)}" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">End Time</label>
              <input type="datetime-local" name="scheduled_end" value="${formatDateTimeLocal(new Date(new Date(defaultStart).getTime() + 3600000).toISOString())}" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Notes</label>
            <textarea name="notes" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" rows="2"></textarea>
          </div>
          ${ERROR_DIV}
          <div class="flex justify-end gap-2 pt-2">
            <button class="cancel-add-stop-btn px-4 py-2 text-sm text-gray-600 hover:bg-white/60 rounded-lg font-semibold">Cancel</button>
            <button class="save-new-stop-btn px-5 py-2 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold shadow-lg">Create Stop</button>
          </div>
        </div>
      </div>
    </form>
  `;

  timelineContainer.insertAdjacentHTML('beforeend', formHTML);

  const form = timelineContainer.querySelector<HTMLFormElement>('.add-stop-form')!;

  createMapboxSearchBox({
    sessionTokenID: crypto.randomUUID(),
    targetSelector: `#${inputId}`,
    placeholder: 'Search location...',
    onSelect: ({ coordinates }) => {
      const latInput = form.querySelector<HTMLInputElement>('[name="latitude"]');
      const lngInput = form.querySelector<HTMLInputElement>('[name="longitude"]');
      if (latInput) latInput.value = String(coordinates[1]);
      if (lngInput) lngInput.value = String(coordinates[0]);
    },
  });
};

// --- Main event handler ---

export function initStopEditor(root: HTMLElement, tripId: string, tripStart = '', tripEnd = '') {
  root.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button');
    if (!btn) return;

    // Edit Stop
    if (btn.classList.contains('edit-stop-btn')) {
      const stopCard = btn.closest('.stop-card')!;
      const stopItem = btn.closest('.timeline-item') as HTMLElement;

      const stopData = {
        location_type: stopItem.dataset.stopType || 'activity',
        location_name: stopItem.dataset.locationName || '',
        scheduled_start: stopItem.dataset.scheduledStart || '',
        scheduled_end: stopItem.dataset.scheduledEnd || '',
        notes: stopItem.dataset.notes || '',
      };

      createStopEditor(stopCard as HTMLElement, stopData);
    }

    // Cancel Edit
    if (btn.classList.contains('cancel-edit-btn')) {
      const stopCard = btn.closest('.stop-card')! as HTMLElement;
      const editMode = stopCard.querySelector('.edit-mode') as HTMLElement;
      const viewMode = stopCard.querySelector('.view-mode') as HTMLElement;
      if (editMode) editMode.style.display = 'none';
      if (viewMode) viewMode.style.display = '';
    }

    // Save Stop (edit)
    if (btn.classList.contains('save-stop-btn')) {
      const stopItem = btn.closest('.timeline-item')! as HTMLElement;
      const stopId = stopItem.dataset.stopId!;
      const form = btn.closest('form')!;

      clearFormError(form);

      const formData = new FormData(form as HTMLFormElement);
      const locationType = formData.get('location_type') as string;
      const scheduledStart = formData.get('scheduled_start') as string;
      const scheduledEnd = formData.get('scheduled_end') as string || undefined;

      // US18a: type limit check (only if type changed)
      const originalType = stopItem.dataset.stopType || '';
      if (locationType !== originalType) {
        const typeError = validateTypeLimit(locationType);
        if (typeError) { showFormError(form, typeError); return; }
      }

      // Trip date-range check
      const rangeError = validateTripDateRange(scheduledStart, scheduledEnd, tripStart, tripEnd);
      if (rangeError) { showFormError(form, rangeError); return; }

      // US18b: time overlap check (exclude self)
      const overlapError = validateTimeOverlap(scheduledStart, scheduledEnd, stopId);
      if (overlapError) { showFormError(form, overlapError); return; }

      const updateData = {
        stop_id: stopId,
        location_type: locationType as any,
        location_name: formData.get('location_name') as string || undefined,
        latitude: parseCoord(formData.get('latitude') as string),
        longitude: parseCoord(formData.get('longitude') as string),
        scheduled_start: toUTCISO(scheduledStart),
        scheduled_end: toUTCISO(scheduledEnd),
        notes: formData.get('notes') as string || undefined,
      };

      const originalText = showLoading(btn as HTMLButtonElement, 'Saving...');

      try {
        await actions.stops.updateStop(updateData);

        // Update data attributes
        stopItem.dataset.stopType      = locationType;
        stopItem.dataset.locationName  = formData.get('location_name') as string || '';
        stopItem.dataset.scheduledStart = updateData.scheduled_start ?? '';
        stopItem.dataset.scheduledEnd   = updateData.scheduled_end   ?? '';
        stopItem.dataset.notes          = formData.get('notes') as string || '';

        // Update timeline dot colour
        const dot = stopItem.querySelector<HTMLElement>('.rounded-full');
        if (dot) {
          [...dot.classList].filter(c => c.startsWith('bg-')).forEach(c => dot.classList.remove(c));
          dot.classList.add(getStopDotColor(locationType));
        }

        // Update view-mode text
        const stopCard = stopItem.querySelector<HTMLElement>('.stop-card')!;
        updateStopViewMode(stopCard, {
          locationType,
          locationName:   formData.get('location_name') as string || '',
          scheduledStart: updateData.scheduled_start ?? '',
          scheduledEnd:   updateData.scheduled_end   ?? '',
          notes:          formData.get('notes') as string || '',
        });

        // Close edit mode
        const editMode = stopCard.querySelector<HTMLElement>('.edit-mode')!;
        const viewMode = stopCard.querySelector<HTMLElement>('.view-mode')!;
        editMode.innerHTML = '';
        editMode.style.display = 'none';
        viewMode.style.display = '';
        showToast({ message: 'Stop updated', type: 'success' });
      } catch (error) {
        console.error('Failed to update stop:', error);
        showToast({ message: 'Failed to update stop', type: 'error' });
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }

    // Delete Stop
    if (btn.classList.contains('delete-stop-btn')) {
      const stopItem = btn.closest('.timeline-item')! as HTMLElement;
      const stopId = stopItem.dataset.stopId!;

      createConfirmModal({
        message: 'Delete this stop and all its activities?',
        confirmText: 'Delete',
        onConfirm: async () => {
          try {
            await actions.stops.deleteStop({ stopId });
            stopItem.remove();
          } catch (error) {
            console.error('Failed to delete stop:', error);
            showToast({ message: 'Failed to delete stop', type: 'error' });
          }
        },
      });
    }

    // Add Stop Button (per-day) or Add First Stop (empty state)
    if (btn.classList.contains('add-stop-btn') || btn.classList.contains('add-first-stop-btn')) {
      const daysContainer = document.getElementById('days-container')!;
      const daySection = btn.closest('.day-section') as HTMLElement | null;

      if (daySection) {
        const timeline = daySection.querySelector('.timeline-container')!;
        createAddStopForm(timeline as HTMLElement, parseInt(daySection.dataset.dayIndex || '0'));
      } else {
        const existingForm = daysContainer.querySelector('.add-stop-form');
        if (existingForm) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'relative pl-4';
        daysContainer.appendChild(wrapper);
        createAddStopForm(wrapper, 0);
      }
    }

    // Cancel Add
    if (btn.classList.contains('cancel-add-stop-btn')) {
      btn.closest('.add-stop-form')?.remove();
    }

    // Save New Stop
    if (btn.classList.contains('save-new-stop-btn')) {
      const form = btn.closest('.add-stop-form')!;
      clearFormError(form);

      const formData = new FormData(form as any);
      const locationName = formData.get('location_name') as string;
      const locationType = formData.get('location_type') as string;
      const scheduledStart = formData.get('scheduled_start') as string;
      const scheduledEnd = formData.get('scheduled_end') as string || undefined;

      // Required field check
      if (!locationName) {
        showFormError(form, 'Location name is required.');
        return;
      }

      // US18a: type limit check
      const typeError = validateTypeLimit(locationType);
      if (typeError) { showFormError(form, typeError); return; }

      // Trip date-range check
      const rangeError = validateTripDateRange(scheduledStart, scheduledEnd, tripStart, tripEnd);
      if (rangeError) { showFormError(form, rangeError); return; }

      // US18b: time overlap check
      const overlapError = validateTimeOverlap(scheduledStart, scheduledEnd);
      if (overlapError) { showFormError(form, overlapError); return; }

      const newStopData = {
        trip_id: tripId,
        location_type: locationType as any,
        location_name: locationName,
        latitude: parseCoord(formData.get('latitude') as string),
        longitude: parseCoord(formData.get('longitude') as string),
        scheduled_start: toUTCISO(scheduledStart) ?? scheduledStart,
        scheduled_end: toUTCISO(scheduledEnd),
        notes: formData.get('notes') as string || undefined,
      };

      const originalText = showLoading(btn as HTMLButtonElement, 'Creating...');

      try {
        const res = await actions.stops.createStop(newStopData);
        const stopId = res.data?.stopId;

        // If we can't get the new stop id, or it's the very first stop
        // (empty-state path, no .day-section), fall back to a reload.
        const daySection = form.parentElement?.closest('.day-section');
        if (!stopId || !daySection) {
          window.location.reload();
          return;
        }

        const newHTML = renderNewStopCard(stopId, {
          locationType,
          locationName,
          scheduledStart: newStopData.scheduled_start,
          scheduledEnd:   newStopData.scheduled_end ?? '',
          notes:          formData.get('notes') as string || '',
        });

        form.insertAdjacentHTML('beforebegin', newHTML);
        form.remove();
        document.getElementById('empty-itinerary')?.remove();
        showToast({ message: 'Stop added', type: 'success' });
      } catch (error) {
        console.error('Failed to create stop:', error);
        showToast({ message: 'Failed to create stop', type: 'error' });
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }
  });
}
