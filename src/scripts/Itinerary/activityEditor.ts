// File: src/components/itinerary/scripts/activityEditor.ts
// Activity editing functionality

import { actions } from 'astro:actions';
import { showToast } from '@/scripts/Toast';
import { createConfirmModal } from '@/scripts/Modal';

const ACTIVITY_TYPES = [
  'sightseeing', 'dining', 'shopping', 'entertainment',
  'sports', 'relaxation', 'cultural', 'adventure', 'other',
] as const;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** True when the itinerary is in edit mode (controls are showing). */
const isEditModeActive = () => document.querySelector('.edit-controls.flex') !== null;

const EDIT_ACT_SVG = `<svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`;
const DEL_ACT_SVG  = `<svg class="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;

/** Inner HTML for a single activity row (view mode). */
const renderActivityRowHTML = (data: {
  description: string; durationMinutes: number;
}) => {
  const ctrlCls = isEditModeActive() ? 'flex' : 'hidden';
  return `
    <div class="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0"></div>
    <div class="flex-1">
      <span class="text-sm font-semibold text-gray-800">${esc(data.description)}</span>
    </div>
    <span class="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">${data.durationMinutes} mins</span>
    <div class="activity-controls opacity-0 group-hover/activity:opacity-100 transition-opacity gap-1 ${ctrlCls}">
      <button class="edit-activity-btn p-1 hover:bg-white rounded" title="Edit activity">${EDIT_ACT_SVG}</button>
      <button class="delete-activity-btn p-1 hover:bg-white rounded" title="Delete activity">${DEL_ACT_SVG}</button>
    </div>
  `;
};

const activityTypeOptions = (selected = 'other') =>
  ACTIVITY_TYPES.map(t =>
    `<option value="${t}"${t === selected ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
  ).join('');

const selectClass = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500';
const selectClassAdd = 'w-full px-2 py-1.5 bg-white border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500';

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

// Create activity editor
const createActivityEditor = (activityItem: HTMLElement, activityData: any) => {
  activityItem.innerHTML = `
    <form class="edit-activity-form bg-blue-50 p-3 rounded-lg border-2 border-blue-300 space-y-2">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Activity Type</label>
          <select name="activity_type" class="${selectClass}">${activityTypeOptions(activityData.activity_type)}</select>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Duration (mins)</label>
          <input type="number" name="planned_duration_minutes" value="${activityData.planned_duration_minutes}" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-700 mb-1">Description</label>
        <input type="text" name="description" value="${activityData.description}" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" class="cancel-activity-edit-btn px-3 py-1.5 text-xs text-gray-600 hover:bg-white rounded font-semibold">Cancel</button>
        <button type="button" class="save-activity-btn px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold">Save</button>
      </div>
    </form>
  `;
};

// Create add activity form
const createAddActivityForm = (activitiesSection: HTMLElement) => {
  const existingForm = activitiesSection.querySelector('.add-activity-form');
  if (existingForm) return;

  const formHTML = `
    <form class="add-activity-form bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border-2 border-dashed border-blue-400 space-y-2">
      <h5 class="text-blue-700 font-bold text-sm">➕ New Activity</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Activity Type</label>
          <select name="activity_type" class="${selectClassAdd}">${activityTypeOptions('other')}</select>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Duration (mins)</label>
          <input type="number" name="planned_duration_minutes" value="30" class="w-full px-2 py-1.5 bg-white border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-700 mb-1">Description *</label>
        <input type="text" name="description" class="w-full px-2 py-1.5 bg-white border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
      </div>
      <div class="flex justify-end gap-2">
        <button class="cancel-add-activity-btn px-3 py-1.5 text-xs text-gray-600 hover:bg-white/60 rounded font-semibold">Cancel</button>
        <button class="save-new-activity-btn px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded text-xs font-semibold">Add Activity</button>
      </div>
    </form>
  `;

  const activitiesList = activitiesSection.querySelector('.activities-list');
  if (activitiesList) {
    activitiesList.insertAdjacentHTML('beforeend', formHTML);
  }
};

export function initActivityEditor(root: HTMLElement, tripId: string) {
  root.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button');
    if (!btn) return;

    // Add Activity Button
    if (btn.classList.contains('add-activity-btn')) {
      const stopCard = btn.closest('.stop-card')!;
      let activitiesSection = stopCard.querySelector('.activities-section');

      if (!activitiesSection) {
        const viewMode = stopCard.querySelector('.view-mode')!;
        viewMode.insertAdjacentHTML('beforeend', `
          <div class="activities-section space-y-2 mt-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Activities:</p>
            </div>
            <div class="activities-list space-y-2"></div>
          </div>
        `);
        activitiesSection = stopCard.querySelector('.activities-section')!;
      }

      createAddActivityForm(activitiesSection as HTMLElement);
    }

    // Cancel Add Activity
    if (btn.classList.contains('cancel-add-activity-btn')) {
      btn.closest('.add-activity-form')?.remove();
    }

    // Save New Activity
    if (btn.classList.contains('save-new-activity-btn')) {
      const form = btn.closest('.add-activity-form')!;
      const formData = new FormData(form as HTMLFormElement);
      const stopItem = btn.closest('.timeline-item')! as HTMLElement;
      const stopId = stopItem.dataset.stopId!;

      const description = formData.get('description') as string;
      if (!description) {
        showToast({ message: 'Activity description is required', type: 'error' });
        return;
      }

      const newActivityData = {
        stop_id: stopId,
        activity_type: formData.get('activity_type') as string,
        description,
        planned_duration_minutes: parseInt(formData.get('planned_duration_minutes') as string)
      };

      const originalText = showLoading(btn as HTMLButtonElement, 'Adding...');

      try {
        const res = await actions.activities.createActivity(newActivityData);
        const newActivity = res.data?.activity;
        const newId = newActivity?.id ?? '';

        // Ensure activities section exists
        const stopCard = stopItem.querySelector('.stop-card')! as HTMLElement;
        let activitiesSection = stopCard.querySelector<HTMLElement>('.activities-section');
        if (!activitiesSection) {
          const viewMode = stopCard.querySelector('.view-mode')!;
          const ctrlCls = isEditModeActive() ? 'flex' : 'hidden';
          viewMode.insertAdjacentHTML('beforeend', `
            <div class="activities-section space-y-2 mt-3">
              <div class="flex items-center justify-between">
                <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Activities:</p>
                <button class="add-activity-btn text-xs font-semibold text-blue-600 hover:text-blue-700 items-center gap-1 ${ctrlCls}">
                  <svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Activity
                </button>
              </div>
              <div class="activities-list space-y-2"></div>
            </div>
          `);
          activitiesSection = stopCard.querySelector<HTMLElement>('.activities-section')!;
        }

        const activitiesList = activitiesSection.querySelector('.activities-list')!;
        const newItemHTML = `
          <div class="activity-item flex items-center gap-3 bg-white/70 p-2 rounded-lg group/activity"
            data-activity-id="${newId}"
            data-activity-type="${esc(newActivityData.activity_type)}"
            data-activity-description="${esc(newActivityData.description)}"
            data-duration="${newActivityData.planned_duration_minutes}"
          >
            ${renderActivityRowHTML({ description: newActivityData.description, durationMinutes: newActivityData.planned_duration_minutes })}
          </div>
        `;

        btn.closest('.add-activity-form')?.remove();
        activitiesList.insertAdjacentHTML('beforeend', newItemHTML);

        // Also hide the standalone "Add Activity" button if it's outside the section
        stopCard.querySelector<HTMLElement>('.add-activity-btn:not(.activities-section .add-activity-btn)')?.remove();

        showToast({ message: 'Activity added', type: 'success' });
      } catch (error) {
        console.error('Failed to create activity:', error);
        showToast({ message: 'Failed to create activity', type: 'error' });
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }

    // Edit Activity
    if (btn.classList.contains('edit-activity-btn')) {
      const activityItem = btn.closest('.activity-item')! as HTMLElement;

      const activityData = {
        activity_type: activityItem.dataset.activityType || 'other',
        description: activityItem.dataset.activityDescription || '',
        planned_duration_minutes: parseInt(activityItem.dataset.duration || '30'),
      };

      createActivityEditor(activityItem, activityData);
    }

    // Cancel Activity Edit — restore the view without reloading
    if (btn.classList.contains('cancel-activity-edit-btn')) {
      const activityItem = btn.closest('.activity-item')! as HTMLElement;
      activityItem.innerHTML = renderActivityRowHTML({
        description:     activityItem.dataset.activityDescription ?? '',
        durationMinutes: parseInt(activityItem.dataset.duration ?? '0'),
      });
    }

    // Save Activity
    if (btn.classList.contains('save-activity-btn')) {
      const activityItem = btn.closest('.activity-item')! as HTMLElement;
      const activityId = activityItem.dataset.activityId!;

      const form = btn.closest('form')!;
      const formData = new FormData(form as HTMLFormElement);
      const updateData = {
        activity_id: activityId,
        activity_type: formData.get('activity_type') as string,
        description: formData.get('description') as string,
        planned_duration_minutes: parseInt(formData.get('planned_duration_minutes') as string)
      };

      const originalText = showLoading(btn as HTMLButtonElement, 'Saving...');

      try {
        await actions.activities.updateActivity(updateData);

        // Update data attributes
        activityItem.dataset.activityType        = updateData.activity_type;
        activityItem.dataset.activityDescription = updateData.description;
        activityItem.dataset.duration            = String(updateData.planned_duration_minutes);

        // Restore view-mode HTML
        activityItem.innerHTML = renderActivityRowHTML({
          description:     updateData.description,
          durationMinutes: updateData.planned_duration_minutes,
        });

        showToast({ message: 'Activity updated', type: 'success' });
      } catch (error) {
        console.error('Failed to update activity:', error);
        showToast({ message: 'Failed to update activity', type: 'error' });
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }

    // Delete Activity
    if (btn.classList.contains('delete-activity-btn')) {
      const activityItem = btn.closest('.activity-item')! as HTMLElement;
      const activityId = activityItem.dataset.activityId!;

      createConfirmModal({
        message: 'Delete this activity?',
        confirmText: 'Delete',
        onConfirm: async () => {
          try {
            await actions.activities.deleteActivity({ activityId });
            activityItem.remove();
          } catch (error) {
            console.error('Failed to delete activity:', error);
            showToast({ message: 'Failed to delete activity', type: 'error' });
          }
        },
      });
    }
  });
}
