import { actions } from 'astro:actions';
import { showToast } from '@/scripts/Toast';
import { createConfirmModal } from '@/scripts/Modal';
import { createMapboxSearchBox } from '@/scripts/mapBoxSearch';

const MAX_PICKUP = 20;
const MAX_DROPOFF = 20;

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
    <div class="space-y-3 bg-white/90 p-4 rounded-lg border-2 border-blue-300">
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
        <button class="cancel-edit-btn px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-semibold">Cancel</button>
        <button class="save-stop-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Save Changes</button>
      </div>
    </div>
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

export function initStopEditor(root: HTMLElement, tripId: string) {
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
      const form = btn.closest('.edit-mode')!;

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
        window.location.reload();
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
        await actions.stops.createStop(newStopData);
        window.location.reload();
      } catch (error) {
        console.error('Failed to create stop:', error);
        showToast({ message: 'Failed to create stop', type: 'error' });
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }
  });
}
