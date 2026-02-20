// File: src/components/itinerary/scripts/itinerary.ts
// Main itinerary script - coordinates all functionality

import { initStopEditor } from './stopEditor';
import { initActivityEditor } from './activityEditor';

function initItinerary() {
  const root = document.getElementById('itinerary-root');
  if (!root) return;

  const tripId = root.dataset.tripId!;
  const isOwner = root.dataset.isOwner === 'true';
  
  if (!isOwner) return;

  const toggleBtn = document.getElementById('toggle-mode-btn');
  let isEditing = false;

  // Toggle Edit Mode
  toggleBtn?.addEventListener('click', () => {
    isEditing = !isEditing;
    toggleBtn.textContent = isEditing ? '✓ Finish Editing' : 'Edit Itinerary';
    toggleBtn.className = isEditing 
      ? 'px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/30 focus:ring-2 focus:ring-amber-500 focus:outline-none'
      : 'px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/30 focus:ring-2 focus:ring-emerald-500 focus:outline-none';
    
    // Show/hide all edit controls
    document.querySelectorAll<HTMLElement>('.edit-controls, .activity-controls, .add-stop-btn, .add-activity-btn').forEach(el => {
      el.style.display = isEditing ? 'flex' : 'none';
    });
  });

  // Day header collapse toggle
  document.querySelectorAll('.day-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.add-stop-btn')) return;
      
      const daySection = header.closest('.day-section');
      const timeline = daySection?.querySelector('.timeline-container');
      const chevron = header.querySelector('.chevron-icon');
      
      timeline?.classList.toggle('hidden');
      chevron?.classList.toggle('rotate-180');
    });
  });

  // Initialize stop editor functionality
  initStopEditor(root, tripId);

  // Initialize activity editor functionality
  initActivityEditor(root, tripId);
}

// Initialize on page load
initItinerary();
document.addEventListener('astro:page-load', initItinerary);