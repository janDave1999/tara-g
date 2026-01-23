// src/components/trip/members/utils.ts

export const getTripId = (): string => {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  return pathParts[pathParts.length - 1] || '';
};

export const getInitials = (name: string): string => {
  return (name || '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const getElement = <T extends HTMLElement>(id: string): T | null => {
  return document.getElementById(id) as T | null;
};

export const showElement = (el: HTMLElement | null): void => {
  if (el) el.classList.remove('hidden');
};

export const hideElement = (el: HTMLElement | null): void => {
  if (el) el.classList.add('hidden');
};

export const createButton = (
  text: string,
  classes: string,
  onClick: () => void
): HTMLButtonElement => {
  const btn = document.createElement('button');
  btn.className = `text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${classes}`;
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
};

export const createAvatar = (name: string, avatarUrl?: string | null): string => {
  const initials = getInitials(name);
  return avatarUrl
    ? `<img src="${avatarUrl}" alt="${name}" class="w-full h-full rounded-full object-cover" />`
    : initials;
};