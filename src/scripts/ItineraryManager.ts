// File: src/scripts/itinerary-manager-safe.ts
// Type-safe version with proper DOM element type guards

import { actions } from 'astro:actions';

export interface Activity {
  id: string;
  activity_type: string;
  description: string;
  planned_duration_minutes: number;
  order_index?: number;
}

export interface Stop {
  id: string;
  name: string;
  stop_type: string;
  scheduled_start: string;
  scheduled_end: string;
  location_name?: string;
  notes?: string;
  transportation?: { vehicle_type: string };
  activities?: Activity[];
}

export interface Trip {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

// Type guards for DOM elements
function isHTMLInputElement(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

// function isHTMLSelectElement(element: Element | null | undefined): element is any {
//   return element instanceof HTMLSelectElement;
// }

function isHTMLTextAreaElement(element: Element | null): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement;
}

const stopTypeColors = {
  pickup: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' },
  dropoff: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-500' },
  destination: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  activity: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-500' },
  meal_break: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
  rest_stop: { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  transit: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', dot: 'bg-slate-500' },
  checkpoint: { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', dot: 'bg-pink-500' },
  accommodation: { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', dot: 'bg-indigo-500' }
};

export class ItineraryManager {
  private editMode: boolean = false;
  private stopsByDay: Stop[][];
  private tripId: string;
  
  constructor(tripId: string, initialStops: Stop[][]) {
    this.tripId = tripId;
    this.stopsByDay = initialStops;
    this.init();
  }

  private init() {
    this.attachEventListeners();
    this.updateAllContent();
  }

  // Utility functions
  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  private formatDateTimeLocal(isoString: string): string {
    return isoString.slice(0, 16);
  }

  private getDuration(start: string, end: string): string {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  private updateAllContent() {
    document.querySelectorAll('.day-section').forEach((daySection) => {
      const dayIndex = parseInt(daySection.getAttribute('data-day-index') || '0');
      const stops = this.stopsByDay[dayIndex] || [];
      
      // Update day date
      const dateEl = daySection.querySelector('.day-date');
      if (dateEl && stops.length > 0) {
        dateEl.textContent = this.formatDate(stops[0].scheduled_start);
      }

      // Update stop count
      const countEl = daySection.querySelector('.stop-count');
      if (countEl) {
        countEl.textContent = `${stops.length} stops`;
      }

      // Update each stop's dynamic content
      daySection.querySelectorAll('.stop-item').forEach((stopEl) => {
        const stopId = stopEl.getAttribute('data-stop-id');
        const stop = stops.find((s) => s.id === stopId);
        
        if (stop) {
          const startTimeEl = stopEl.querySelector('.stop-start-time');
          const durationEl = stopEl.querySelector('.stop-duration');
          
          if (startTimeEl) startTimeEl.textContent = this.formatTime(stop.scheduled_start);
          if (durationEl) durationEl.textContent = this.getDuration(stop.scheduled_start, stop.scheduled_end);
        }
      });
    });
  }

  private attachEventListeners() {
    // Edit mode toggle
    const editToggle = document.getElementById('edit-mode-toggle');
    editToggle?.addEventListener('click', () => this.toggleEditMode());

    // Day header collapse
    document.querySelectorAll('.day-header').forEach((header) => {
      header.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.add-stop-btn')) {
          const daySection = header.closest('.day-section');
          daySection?.classList.toggle('collapsed');
        }
      });
    });

    // Delegate events for dynamic elements
    document.addEventListener('click', (e) => this.handleClick(e));
  }

  private handleClick(e: Event) {
    const target = e.target as HTMLElement;
    
    // Add Stop
    if (target.closest('.add-stop-btn')) {
      const btn = target.closest('.add-stop-btn');
      const dayIndex = parseInt(btn?.getAttribute('data-day-index') || '0');
      this.showAddStopForm(dayIndex);
    }
    
    // Edit Stop
    if (target.closest('.edit-stop-btn')) {
      const stopItem = target.closest('.stop-item');
      const stopId = stopItem?.getAttribute('data-stop-id');
      if (stopId) this.editStop(stopId);
    }
    
    // Delete Stop
    if (target.closest('.delete-stop-btn')) {
      const stopItem = target.closest('.stop-item');
      const stopId = stopItem?.getAttribute('data-stop-id');
      const daySection = target.closest('.day-section');
      const dayIndex = parseInt(daySection?.getAttribute('data-day-index') || '0');
      if (stopId) this.deleteStop(dayIndex, stopId);
    }
    
    // Save Stop Edit
    if (target.closest('.save-edit-stop')) {
      const stopItem = target.closest('.stop-item');
      const stopId = stopItem?.getAttribute('data-stop-id');
      const daySection = target.closest('.day-section');
      const dayIndex = parseInt(daySection?.getAttribute('data-day-index') || '0');
      if (stopId) this.saveStopEdit(dayIndex, stopId);
    }
    
    // Cancel Stop Edit
    if (target.closest('.cancel-edit-stop')) {
      const stopItem = target.closest('.stop-item');
      this.cancelStopEdit(stopItem);
    }
    
    // Submit Add Stop
    if (target.closest('.submit-add-stop')) {
      const form = target.closest('.add-stop-form-wrapper');
      const container = form?.parentElement;
      const dayIndex = parseInt(container?.getAttribute('data-day-index') || '0');
      this.submitAddStop(dayIndex);
    }
    
    // Cancel Add Stop
    if (target.closest('.cancel-add-stop')) {
      const form = target.closest('.add-stop-form-wrapper');
      form?.remove();
    }
    
    // Activity actions
    if (target.closest('.add-activity-btn')) {
      const stopItem = target.closest('.stop-item');
      const stopId = stopItem?.getAttribute('data-stop-id');
      const daySection = target.closest('.day-section');
      const dayIndex = parseInt(daySection?.getAttribute('data-day-index') || '0');
      if (stopId) this.showAddActivityForm(dayIndex, stopId);
    }
    
    if (target.closest('.delete-activity-btn')) {
      const activityItem = target.closest('.activity-item');
      const activityId = activityItem?.getAttribute('data-activity-id');
      const stopItem = target.closest('.stop-item');
      const stopId = stopItem?.getAttribute('data-stop-id');
      const daySection = target.closest('.day-section');
      const dayIndex = parseInt(daySection?.getAttribute('data-day-index') || '0');
      if (activityId && stopId) this.deleteActivity(dayIndex, stopId, activityId);
    }
    
    if (target.closest('.submit-add-activity')) {
      const form = target.closest('.add-activity-form');
      const stopItem = form?.closest('.stop-item');
      const stopId = stopItem?.getAttribute('data-stop-id');
      const daySection = target.closest('.day-section');
      const dayIndex = parseInt(daySection?.getAttribute('data-day-index') || '0');
      if (stopId) this.submitAddActivity(dayIndex, stopId);
    }
    
    if (target.closest('.cancel-add-activity')) {
      const form = target.closest('.add-activity-form');
      form?.remove();
    }
  }

  private toggleEditMode() {
    this.editMode = !this.editMode;
    const toggle = document.getElementById('edit-mode-toggle');
    
    if (this.editMode) {
      toggle?.classList.remove('from-emerald-600', 'to-green-600', 'hover:from-emerald-700', 'hover:to-green-700', 'shadow-emerald-500/30');
      toggle?.classList.add('from-amber-600', 'to-orange-600', 'hover:from-amber-700', 'hover:to-orange-700', 'shadow-amber-500/30');
      if (toggle) toggle.textContent = '✓ Finish Editing';
      
      document.querySelectorAll('.edit-controls').forEach(el => {
        el.classList.remove('hidden');
        el.classList.add('flex');
      });
      document.querySelectorAll('.add-stop-btn').forEach(el => {
        el.classList.remove('hidden');
        el.classList.add('flex');
      });
      document.querySelectorAll('.add-activity-btn').forEach(el => {
        el.classList.remove('hidden');
        el.classList.add('flex');
      });
      document.querySelectorAll('.activity-controls').forEach(el => {
        el.classList.remove('hidden');
        el.classList.add('flex');
      });
      document.querySelectorAll('.add-activity-placeholder').forEach(el => {
        el.classList.remove('hidden');
      });
    } else {
      toggle?.classList.add('from-emerald-600', 'to-green-600', 'hover:from-emerald-700', 'hover:to-green-700', 'shadow-emerald-500/30');
      toggle?.classList.remove('from-amber-600', 'to-orange-600', 'hover:from-amber-700', 'hover:to-orange-700', 'shadow-amber-500/30');
      if (toggle) toggle.textContent = 'Edit Itinerary';
      
      document.querySelectorAll('.edit-controls').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
      });
      document.querySelectorAll('.add-stop-btn').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
      });
      document.querySelectorAll('.add-activity-btn').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
      });
      document.querySelectorAll('.activity-controls').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
      });
      document.querySelectorAll('.add-activity-placeholder').forEach(el => {
        el.classList.add('hidden');
      });
      
      // Clear any open forms
      document.querySelectorAll('.stop-edit').forEach(el => {
        el.classList.add('hidden');
        el.innerHTML = '';
      });
      document.querySelectorAll('.stop-view').forEach(el => el.classList.remove('hidden'));
      document.querySelectorAll('.add-stop-form-wrapper').forEach(el => el.remove());
      document.querySelectorAll('.add-activity-form').forEach(el => el.remove());
    }
  }

  private editStop(stopId: string) {
    const stopItem = document.querySelector(`[data-stop-id="${stopId}"]`);
    if (!stopItem) return;

    const daySection = stopItem.closest('.day-section');
    const dayIndex = parseInt(daySection?.getAttribute('data-day-index') || '0');
    const stop = this.stopsByDay[dayIndex].find(s => s.id === stopId);
    if (!stop) return;

    const stopView = stopItem.querySelector('.stop-view');
    const stopEdit = stopItem.querySelector('.stop-edit');
    
    if (!stopView || !stopEdit) return;

    // Get template
    const template = document.getElementById('stop-editor-template') as HTMLTemplateElement | null;
    if (!template) {
      console.error('Stop editor template not found');
      return;
    }
    
    const clone = template.content.cloneNode(true) as DocumentFragment;
    
    // Fill form with current values using type guards
    const form = clone.querySelector('.stop-editor-form');
    if (form) {
      const nameInput = form.querySelector('[name="name"]');
      const typeSelect = form.querySelector('[name="stop_type"]') as any;
      const locationInput = form.querySelector('[name="location_name"]');
      const startInput = form.querySelector('[name="scheduled_start"]');
      const endInput = form.querySelector('[name="scheduled_end"]');
      const notesTextarea = form.querySelector('[name="notes"]');
      
      if (isHTMLInputElement(nameInput)) nameInput.value = stop.name;
      if (typeSelect) typeSelect.value = stop.stop_type;
      if (isHTMLInputElement(locationInput)) locationInput.value = stop.location_name || '';
      if (isHTMLInputElement(startInput)) startInput.value = this.formatDateTimeLocal(stop.scheduled_start);
      if (isHTMLInputElement(endInput)) endInput.value = this.formatDateTimeLocal(stop.scheduled_end);
      if (isHTMLTextAreaElement(notesTextarea)) notesTextarea.value = stop.notes || '';
    }

    stopEdit.innerHTML = '';
    stopEdit.appendChild(clone);
    stopView.classList.add('hidden');
    stopEdit.classList.remove('hidden');
  }

  private async saveStopEdit(dayIndex: number, stopId: string) {
    const stopItem = document.querySelector(`[data-stop-id="${stopId}"]`);
    if (!stopItem) return;

    const form = stopItem.querySelector('.stop-editor-form');
    if (!form) return;

    const nameInput = form.querySelector('[name="name"]');
    const typeSelect = form.querySelector('[name="stop_type"]') as any;
    const locationInput = form.querySelector('[name="location_name"]');
    const startInput = form.querySelector('[name="scheduled_start"]');
    const endInput = form.querySelector('[name="scheduled_end"]');
    const notesTextarea = form.querySelector('[name="notes"]');

    const formData = {
      stop_id: stopId,
      name: isHTMLInputElement(nameInput) ? nameInput.value : '',
      stop_type: typeSelect ? typeSelect.value : 'activity',
      location_name: isHTMLInputElement(locationInput) ? (locationInput.value || undefined) : undefined,
      scheduled_start: isHTMLInputElement(startInput) ? startInput.value : '',
      scheduled_end: isHTMLInputElement(endInput) ? endInput.value : '',
      notes: isHTMLTextAreaElement(notesTextarea) ? (notesTextarea.value || undefined) : undefined,
    };

    try {
      await actions.trip.updateStop(formData);
      
      // Update local state
      const stopIndex = this.stopsByDay[dayIndex].findIndex(s => s.id === stopId);
      if (stopIndex !== -1) {
        this.stopsByDay[dayIndex][stopIndex] = {
          ...this.stopsByDay[dayIndex][stopIndex],
          ...formData
        };
      }

      // Update view
      this.updateStopDisplay(dayIndex, stopId);
      this.cancelStopEdit(stopItem);
    } catch (error) {
      console.error('Failed to update stop:', error);
      alert('Failed to update stop. Please try again.');
    }
  }

  private cancelStopEdit(stopItem: Element | null) {
    if (!stopItem) return;
    const stopView = stopItem.querySelector('.stop-view');
    const stopEdit = stopItem.querySelector('.stop-edit');
    
    if (stopView && stopEdit) {
      stopView.classList.remove('hidden');
      stopEdit.classList.add('hidden');
      stopEdit.innerHTML = '';
    }
  }

  private async deleteStop(dayIndex: number, stopId: string) {
    if (!confirm('Delete this stop? This action cannot be undone.')) return;

    try {
      await actions.trip.deleteStop({ stopId });
      
      // Update local state
      this.stopsByDay[dayIndex] = this.stopsByDay[dayIndex].filter(s => s.id !== stopId);
      
      // Remove from DOM
      const stopItem = document.querySelector(`[data-stop-id="${stopId}"]`);
      stopItem?.remove();
      
      this.updateAllContent();
    } catch (error) {
      console.error('Failed to delete stop:', error);
      alert('Failed to delete stop. Please try again.');
    }
  }

  private showAddStopForm(dayIndex: number) {
    const container = document.querySelector(`.add-stop-form-container[data-day-index="${dayIndex}"]`);
    if (!container) return;

    // Remove any existing forms
    container.innerHTML = '';

    // Get template
    const template = document.getElementById('add-stop-template') as HTMLTemplateElement | null;
    if (!template) {
      console.error('Add stop template not found');
      return;
    }
    
    const clone = template.content.cloneNode(true) as DocumentFragment;
    
    // Set default times
    const stops = this.stopsByDay[dayIndex];
    const defaultStart = stops.length > 0 
      ? stops[stops.length - 1].scheduled_end
      : new Date().toISOString();
    const defaultEnd = new Date(new Date(defaultStart).getTime() + 3600000).toISOString();
    
    const form = clone.querySelector('.add-stop-form-wrapper');
    if (form) {
      const startInput = form.querySelector('[name="scheduled_start"]');
      const endInput = form.querySelector('[name="scheduled_end"]');
      
      if (isHTMLInputElement(startInput)) startInput.value = this.formatDateTimeLocal(defaultStart);
      if (isHTMLInputElement(endInput)) endInput.value = this.formatDateTimeLocal(defaultEnd);
    }

    container.appendChild(clone);
  }

  private async submitAddStop(dayIndex: number) {
    const container = document.querySelector(`.add-stop-form-container[data-day-index="${dayIndex}"]`);
    const form = container?.querySelector('.add-stop-form-wrapper');
    if (!form) return;

    const nameInput = form.querySelector('[name="name"]');
    const typeSelect = form.querySelector('[name="stop_type"]') as  any;
    const locationInput = form.querySelector('[name="location_name"]');
    const startInput = form.querySelector('[name="scheduled_start"]');
    const endInput = form.querySelector('[name="scheduled_end"]');
    const notesTextarea = form.querySelector('[name="notes"]');

    const formData = {
  trip_id: this.tripId,
  location_name: isHTMLInputElement(nameInput) ? nameInput.value : '',
  start_time: isHTMLInputElement(startInput) ? startInput.value : '',
  end_time: isHTMLInputElement(endInput) ? endInput.value : '',
  type: typeSelect ? typeSelect.value : 'activity',
  notes: isHTMLTextAreaElement(notesTextarea) ? (notesTextarea.value || undefined) : undefined,
  day_index: dayIndex,
  location: {
    name: isHTMLInputElement(locationInput) ? locationInput.value : '',
    lat: '',
    lng: ''
  },
  scheduled_start: isHTMLInputElement(startInput) ? startInput.value : '', // Add this line
  scheduled_end: isHTMLInputElement(endInput) ? endInput.value : '', // Add this line
};

    if (!formData.location_name) {
      alert('Please enter a stop name');
      return;
    }

    try {
      await actions.trip.createStop(formData);
      window.location.reload();
    } catch (error) {
      console.error('Failed to create stop:', error);
      alert('Failed to create stop. Please try again.');
    }
  }

  private updateStopDisplay(dayIndex: number, stopId: string) {
    const stop = this.stopsByDay[dayIndex].find(s => s.id === stopId);
    if (!stop) return;

    const stopItem = document.querySelector(`[data-stop-id="${stopId}"]`);
    if (!stopItem) return;

    // Update displayed values
    const nameEl = stopItem.querySelector('.stop-name');
    const locationEl = stopItem.querySelector('.stop-location');
    const notesEl = stopItem.querySelector('.stop-notes');
    const startTimeEl = stopItem.querySelector('.stop-start-time');
    const durationEl = stopItem.querySelector('.stop-duration');

    if (nameEl) nameEl.textContent = stop.name;
    if (locationEl) locationEl.textContent = stop.location_name || '';
    if (notesEl) notesEl.textContent = stop.notes || '';
    if (startTimeEl) startTimeEl.textContent = this.formatTime(stop.scheduled_start);
    if (durationEl) durationEl.textContent = this.getDuration(stop.scheduled_start, stop.scheduled_end);
  }

  private async deleteActivity(dayIndex: number, stopId: string, activityId: string) {
    if (!confirm('Delete this activity?')) return;

    try {
      await actions.trip.deleteActivity({ activityId });
      
      // Update local state
      const stopIndex = this.stopsByDay[dayIndex].findIndex(s => s.id === stopId);
      if (stopIndex !== -1) {
        this.stopsByDay[dayIndex][stopIndex].activities = 
          this.stopsByDay[dayIndex][stopIndex].activities?.filter(a => a.id !== activityId);
      }
      
      // Remove from DOM
      const activityItem = document.querySelector(`[data-activity-id="${activityId}"]`);
      activityItem?.remove();
    } catch (error) {
      console.error('Failed to delete activity:', error);
      alert('Failed to delete activity. Please try again.');
    }
  }

  private showAddActivityForm(dayIndex: number, stopId: string) {
    const stopItem = document.querySelector(`[data-stop-id="${stopId}"]`);
    const activitiesSection = stopItem?.querySelector('.activities-section');
    if (!activitiesSection) return;

    // Remove any existing add forms
    activitiesSection.querySelectorAll('.add-activity-form').forEach(f => f.remove());

    // Get template
    const template = document.getElementById('add-activity-template') as HTMLTemplateElement | null;
    if (!template) {
      console.error('Add activity template not found');
      return;
    }
    
    const clone = template.content.cloneNode(true);
    
    activitiesSection.appendChild(clone);
  }

  private async submitAddActivity(dayIndex: number, stopId: string) {
    const stopItem = document.querySelector(`[data-stop-id="${stopId}"]`);
    const form = stopItem?.querySelector('.add-activity-form');
    if (!form) return;

    const typeInput = form.querySelector('[name="activity_type"]');
    const descInput = form.querySelector('[name="description"]');
    const durationInput = form.querySelector('[name="planned_duration_minutes"]');

    const formData = {
      stop_id: stopId,
      activity_type: isHTMLInputElement(typeInput) ? typeInput.value : 'photo_op',
      description: isHTMLInputElement(descInput) ? descInput.value : '',
      planned_duration_minutes: isHTMLInputElement(durationInput) ? parseInt(durationInput.value) : 30,
    };

    if (!formData.description) {
      alert('Please enter an activity description');
      return;
    }

    try {
      await actions.trip.createActivity(formData);
      window.location.reload();
    } catch (error) {
      console.error('Failed to create activity:', error);
      alert('Failed to create activity. Please try again.');
    }
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const tripData = (window as any).__TRIP_DATA__;
    const stopsData = (window as any).__INITIAL_STOPS__;
    
    if (tripData && stopsData) {
      new ItineraryManager(tripData.trip_id || tripData.id, stopsData);
    }
  });
}