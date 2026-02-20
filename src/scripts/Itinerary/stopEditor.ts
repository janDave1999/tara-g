import type { StopType } from '@/types/itinerary';
import { actions } from 'astro:actions';

const formatDateTimeLocal = (isoString: string) => isoString.slice(0, 16);

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

// Create stop editor form
const createStopEditor = (stopCard: HTMLElement, stopData: any) => {
  const editMode = stopCard.querySelector('.edit-mode')!;
  editMode.innerHTML = `
    <div class="space-y-3 bg-white/90 p-4 rounded-lg border-2 border-blue-300">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Stop Name *</label>
          <input type="text" name="name" value="${stopData.name || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Type *</label>
          <select name="stop_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            <option value="pickup" ${stopData.stop_type === 'pickup' ? 'selected' : ''}>Pickup</option>
            <option value="dropoff" ${stopData.stop_type === 'dropoff' ? 'selected' : ''}>Dropoff</option>
            <option value="destination" ${stopData.stop_type === 'destination' ? 'selected' : ''}>Destination</option>
            <option value="activity" ${stopData.stop_type === 'activity' ? 'selected' : ''}>Activity</option>
            <option value="meal_break" ${stopData.stop_type === 'meal_break' ? 'selected' : ''}>Meal Break</option>
            <option value="rest_stop" ${stopData.stop_type === 'rest_stop' ? 'selected' : ''}>Rest Stop</option>
            <option value="transit" ${stopData.stop_type === 'transit' ? 'selected' : ''}>Transit</option>
            <option value="accommodation" ${stopData.stop_type === 'accommodation' ? 'selected' : ''}>Accommodation</option>
            <option value="checkpoint" ${stopData.stop_type === 'checkpoint' ? 'selected' : ''}>Checkpoint</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-700 mb-1">Location</label>
        <input type="text" name="location_name" value="${stopData.location_name || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Start Time *</label>
          <input type="datetime-local" name="scheduled_start" value="${formatDateTimeLocal(stopData.scheduled_start)}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">End Time *</label>
          <input type="datetime-local" name="scheduled_end" value="${formatDateTimeLocal(stopData.scheduled_end)}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-700 mb-1">Notes</label>
        <textarea name="notes" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" rows="2">${stopData.notes || ''}</textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2 border-t">
        <button class="cancel-edit-btn px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-semibold">Cancel</button>
        <button class="save-stop-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Save Changes</button>
      </div>
    </div>
  `;
  
  stopCard.querySelector('.view-mode')?.classList.add('hidden');
  editMode.classList.remove('hidden');
};

// Create add stop form
const createAddStopForm = (timelineContainer: HTMLElement, dayIndex: number) => {
  const existingForm = timelineContainer.querySelector('.add-stop-form');
  if (existingForm) return;

  const defaultStart = new Date().toISOString();
  
  const formHTML = `
    <form class="add-stop-form relative pl-12 pb-6">
      <div class="absolute -left-[9px] top-2 w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full border-4 border-white shadow-lg z-10 animate-pulse"></div>
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-dashed border-green-400 rounded-xl p-5 shadow-lg">
        <h4 class="text-green-700 font-bold text-base mb-4">➕ New Stop</h4>
        <div class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Stop Name *</label>
              <input type="text" name="name" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Type *</label>
              <select name="stop_type" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500">
                <option value="activity">Activity</option>
                <option value="destination">Destination</option>
                <option value="meal_break">Meal Break</option>
                <option value="rest_stop">Rest Stop</option>
                <option value="transit">Transit</option>
                <option value="accommodation">Accommodation</option>
                <option value="checkpoint">Checkpoint</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Location</label>
            <input type="text" name="location_name" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Start Time *</label>
              <input type="datetime-local" name="scheduled_start" value="${formatDateTimeLocal(defaultStart)}" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">End Time *</label>
              <input type="datetime-local" name="scheduled_end" value="${formatDateTimeLocal(new Date(new Date(defaultStart).getTime() + 3600000).toISOString())}" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Notes</label>
            <textarea name="notes" class="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" rows="2"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button class="cancel-add-stop-btn px-4 py-2 text-sm text-gray-600 hover:bg-white/60 rounded-lg font-semibold">Cancel</button>
            <button class="save-new-stop-btn px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold shadow-lg">Create Stop</button>
          </div>
        </div>
      </div>
    </form>
  `;
  
  timelineContainer.insertAdjacentHTML('beforeend', formHTML);
};

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
        name: stopItem.dataset.stopName || '',
        stop_type: stopItem.dataset.stopType || 'activity',
        location_name: stopItem.dataset.locationName || '',
        scheduled_start: stopItem.dataset.scheduledStart || new Date().toISOString(),
        scheduled_end: stopItem.dataset.scheduledEnd || new Date(Date.now() + 3600000).toISOString(),
        notes: stopItem.dataset.notes || '',
      };

      createStopEditor(stopCard as HTMLElement, stopData);
    }

    // Cancel Edit
    if (btn.classList.contains('cancel-edit-btn')) {
      const stopCard = btn.closest('.stop-card')!;
      stopCard.querySelector('.edit-mode')?.classList.add('hidden');
      stopCard.querySelector('.view-mode')?.classList.remove('hidden');
    }

    // Save Stop
    if (btn.classList.contains('save-stop-btn')) {
      const stopItem = btn.closest('.timeline-item')! as HTMLElement;
      const stopId = stopItem.dataset.stopId!;
      const form = btn.closest('.edit-mode')!;
      
      const formData = new FormData(form as HTMLFormElement);
      const updateData = {
        stop_id: stopId,
        name: formData.get('name') as string,
        stop_type: formData.get('stop_type') as StopType,
        scheduled_start: formData.get('scheduled_start') as string,
        scheduled_end: formData.get('scheduled_end') as string,
        location_name: formData.get('location_name') as string,
        notes: formData.get('notes') as string
      };

      const originalText = showLoading(btn as HTMLButtonElement, 'Saving...');

      try {
        await actions.stops.updateStop(updateData);
        window.location.reload();
      } catch (error) {
        console.error('Failed to update stop:', error);
        alert('Failed to update stop');
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }

    // Delete Stop
    if (btn.classList.contains('delete-stop-btn')) {
      const stopItem = btn.closest('.timeline-item')! as HTMLElement;
      const stopId = stopItem.dataset.stopId!;
      
      if (confirm('Delete this stop?')) {
        try {
          await actions.stops.deleteStop({ stopId });
          stopItem.remove();
        } catch (error) {
          console.error('Failed to delete stop:', error);
          alert('Failed to delete stop');
        }
      }
    }

    // Add Stop Button (per-day) or Add First Stop (empty state)
    if (btn.classList.contains('add-stop-btn') || btn.classList.contains('add-first-stop-btn')) {
      const daysContainer = document.getElementById('days-container')!;
      const daySection = btn.closest('.day-section') as HTMLElement | null;

      if (daySection) {
        const timeline = daySection.querySelector('.timeline-container')!;
        createAddStopForm(timeline as HTMLElement, parseInt(daySection.dataset.dayIndex || '0'));
      } else {
        // Empty state — inject a standalone form directly into the days container
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
      const formData = new FormData(form as any);
      console.log(formData);
      const name = formData.get('name') as string;
      if (!name) {
        alert('Stop name is required');
        return;
      }

      const newStopData = {
        trip_id: tripId,
        name,
        stop_type: formData.get('stop_type') as StopType,
        scheduled_start: formData.get('scheduled_start') as string,
        scheduled_end: formData.get('scheduled_end') as string,
        location_name: formData.get('location_name') as string || undefined,
        notes: formData.get('notes') as string || undefined
      };

      const originalText = showLoading(btn as HTMLButtonElement, 'Creating...');

      try {
        await actions.stops.createStop(newStopData);
        window.location.reload();
      } catch (error) {
        console.error('Failed to create stop:', error);
        alert('Failed to create stop');
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }
  });
}