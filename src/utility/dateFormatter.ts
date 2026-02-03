// File: src/utils/dateFormatters.ts
// Date and time formatting utilities

export const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

export const formatDateTimeLocal = (isoString: string): string => {
  // Format for datetime-local input: YYYY-MM-DDTHH:mm
  return isoString.slice(0, 16);
};

export const getDuration = (start: string, end: string): string => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const getDisplayTime = (start: string, end: string): string => {
  const isSameDay = start.slice(0, 10) === end.slice(0, 10);
  
  if (isSameDay) {
    return `${formatDate(start)} | ${formatTime(start)} - ${formatTime(end)}`;
  }
  
  return `${formatDate(start)}, ${formatTime(start)} — ${formatDate(end)}, ${formatTime(end)}`;
};