// File: src/components/itinerary/scripts/activityEditor.ts
// Activity editing functionality

import { actions } from 'astro:actions';

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
    <div class="bg-blue-50 p-3 rounded-lg border-2 border-blue-300 space-y-2">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Activity Type</label>
          <input type="text" name="activity_type" value="${activityData.activity_type}" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
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
        <button class="cancel-activity-edit-btn px-3 py-1.5 text-xs text-gray-600 hover:bg-white rounded font-semibold">Cancel</button>
        <button class="save-activity-btn px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold">Save</button>
      </div>
    </div>
  `;
};

// Create add activity form
const createAddActivityForm = (activitiesSection: HTMLElement) => {
  const existingForm = activitiesSection.querySelector('.add-activity-form');
  if (existingForm) return;

  const formHTML = `
    <div class="add-activity-form bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border-2 border-dashed border-blue-400 space-y-2">
      <h5 class="text-blue-700 font-bold text-sm">➕ New Activity</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Activity Type</label>
          <input type="text" name="activity_type" value="photo_op" class="w-full px-2 py-1.5 bg-white border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
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
    </div>
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
        alert('Activity description is required');
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
        await actions.activities.createActivity(newActivityData);
        window.location.reload();
      } catch (error) {
        console.error('Failed to create activity:', error);
        alert('Failed to create activity');
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }

    // Edit Activity
    if (btn.classList.contains('edit-activity-btn')) {
      const activityItem = btn.closest('.activity-item')!;
      
      const activityData = {
        activity_type: 'photo_op',
        description: activityItem.querySelector('.text-sm')?.textContent || '',
        planned_duration_minutes: parseInt(activityItem.querySelector('.bg-gray-100')?.textContent?.replace(' mins', '') || '30')
      };
      
      createActivityEditor(activityItem as HTMLElement, activityData);
    }

    // Cancel Activity Edit
    if (btn.classList.contains('cancel-activity-edit-btn')) {
      window.location.reload();
    }

    // Save Activity
    if (btn.classList.contains('save-activity-btn')) {
      const activityItem = btn.closest('.activity-item')! as HTMLElement;
      const activityId = activityItem.dataset.activityId!;
      
      const formData = new FormData(activityItem as HTMLFormElement);
      const updateData = {
        activity_id: activityId,
        activity_type: formData.get('activity_type') as string,
        description: formData.get('description') as string,
        planned_duration_minutes: parseInt(formData.get('planned_duration_minutes') as string)
      };

      const originalText = showLoading(btn as HTMLButtonElement, 'Saving...');

      try {
        await actions.activities.updateActivity(updateData);
        window.location.reload();
      } catch (error) {
        console.error('Failed to update activity:', error);
        alert('Failed to update activity');
        hideLoading(btn as HTMLButtonElement, originalText);
      }
    }

    // Delete Activity
    if (btn.classList.contains('delete-activity-btn')) {
      const activityItem = btn.closest('.activity-item')! as HTMLElement;
      const activityId = activityItem.dataset.activityId!;
      
      if (confirm('Delete this activity?')) {
        try {
          await actions.activities.deleteActivity({ activityId });
          activityItem.remove();
        } catch (error) {
          console.error('Failed to delete activity:', error);
          alert('Failed to delete activity');
        }
      }
    }
  });
}