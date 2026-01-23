// src/components/trip/members/InviteManager.ts

import { actions } from "astro:actions";
import type { UserSuggestion } from '@/types/tripMembers';
import { createAvatar, getElement, showElement, hideElement } from '@/utility/tripMembers';

export class InviteManager {
  private selectedUsers: Set<string> = new Set();
  private allSuggestions: UserSuggestion[] = [];
  private allSearchResults: UserSuggestion[] = [];
  private searchTimeout: any;

  constructor(
    private tripId: string,
    private modal: HTMLDivElement,
    private searchInput: HTMLInputElement,
    private suggestionsContainer: HTMLDivElement,
    private searchResultsContainer: HTMLDivElement,
    private selectedUsersContainer: HTMLDivElement,
    private selectedCountSpan: HTMLSpanElement,
    private sendBtn: HTMLButtonElement,
    private suggestionsLoading: HTMLDivElement,
    private onSendInvites: (selectedUsers: Set<string>, onSuccess: () => void) => Promise<void>
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.handleSearch((e.target as HTMLInputElement).value);
      }, 300);
    });

    this.sendBtn.addEventListener('click', () => this.sendInvitations());
  }

  async open(): Promise<void> {
    showElement(this.modal);
    this.modal.classList.add('flex');
    this.selectedUsers.clear();
    this.updateSelectedDisplay();
    await this.loadSuggestions();
    this.searchInput.focus();
  }

  close(): void {
    hideElement(this.modal);
    this.modal.classList.remove('flex');
    this.searchInput.value = '';
    this.handleSearch('');
    this.allSearchResults = [];
    this.allSuggestions = [];
  }

  private async loadSuggestions(): Promise<void> {
    try {
      showElement(this.suggestionsLoading);

      const result = await actions.trip.getTripSuggestions({ tripId: this.tripId, limit: 10 });

      if (result.data) {
        this.allSuggestions = result.data.suggestions;
        this.renderSuggestions();
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      this.suggestionsContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <p class="text-sm">Failed to load suggestions</p>
        </div>
      `;
    } finally {
      hideElement(this.suggestionsLoading);
    }
  }

  private renderSuggestions(): void {
    this.suggestionsContainer.innerHTML = '';

    if (this.allSuggestions.length === 0) {
      this.suggestionsContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p class="text-sm">No suggestions available</p>
          <p class="text-xs mt-1">Try searching for users</p>
        </div>
      `;
      return;
    }

    this.allSuggestions.forEach(user => {
      this.suggestionsContainer.appendChild(this.createUserItem(user, true));
    });
  }

  private async handleSearch(query: string): Promise<void> {
    if (!query.trim()) {
      this.searchResultsContainer.innerHTML = '';
      hideElement(this.searchResultsContainer);
      showElement(this.suggestionsContainer);
      this.allSearchResults = [];
      return;
    }

    try {
      const result = await actions.trip.searchUsersForInvitation({
        query,
        tripId: this.tripId,
        limit: 10
      });

      if (result.data) {
        this.allSearchResults = result.data.users;
        this.renderSearchResults();
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  private renderSearchResults(): void {
    hideElement(this.suggestionsContainer);
    showElement(this.searchResultsContainer);
    this.searchResultsContainer.innerHTML = '';

    if (this.allSearchResults.length === 0) {
      this.searchResultsContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p class="text-sm">No users found</p>
          <p class="text-xs mt-1">Try a different search term</p>
        </div>
      `;
    } else {
      this.allSearchResults.forEach(user => {
        this.searchResultsContainer.appendChild(this.createUserItem(user, false));
      });
    }
  }

  private createUserItem(user: UserSuggestion, showRelation: boolean): HTMLDivElement {
    const div = document.createElement('div');
    const isSelected = this.selectedUsers.has(user.user_id);

    const avatarHtml = createAvatar(user.full_name, user.avatar_url);

    div.className = `flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : ''}`;
    div.innerHTML = `
      <div class="flex items-center gap-3 flex-1">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          ${avatarHtml}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-slate-800 truncate">${user.full_name}</div>
          <div class="text-xs text-slate-500 truncate">@${user.username || user.email}</div>
          ${showRelation && user.relation_reason ? `<div class="text-xs text-slate-400 mt-0.5 truncate">${user.relation_reason}</div>` : ''}
        </div>
      </div>
      <div class="checkbox-container flex-shrink-0">
        <input type="checkbox" ${isSelected ? 'checked' : ''} class="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500">
      </div>
    `;

    div.addEventListener('click', () => this.toggleUserSelection(user.user_id, div));
    return div;
  }

  private toggleUserSelection(userId: string, element: HTMLDivElement): void {
    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement;

    if (this.selectedUsers.has(userId)) {
      this.selectedUsers.delete(userId);
      checkbox.checked = false;
      element.classList.remove('bg-blue-50');
    } else {
      this.selectedUsers.add(userId);
      checkbox.checked = true;
      element.classList.add('bg-blue-50');
    }

    this.updateSelectedDisplay();
  }

  private updateSelectedDisplay(): void {
    this.selectedUsersContainer.innerHTML = '';
    this.selectedCountSpan.textContent = this.selectedUsers.size.toString();
    this.sendBtn.disabled = this.selectedUsers.size === 0;

    this.selectedUsers.forEach(userId => {
      const user = [...this.allSuggestions, ...this.allSearchResults].find(u => u.user_id === userId);
      if (!user) return;

      const pill = document.createElement('div');
      pill.className = 'inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm';
      pill.innerHTML = `
        <span class="font-medium">${user.full_name}</span>
        <button class="hover:bg-blue-200 rounded-full p-0.5 transition-colors" data-user-id="${user.user_id}">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      `;

      const removeBtn = pill.querySelector('button') as HTMLButtonElement;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedUsers.delete(userId);
        this.updateSelectedDisplay();
        this.renderSuggestions();
        if (this.allSearchResults.length > 0) {
          this.renderSearchResults();
        }
      });

      this.selectedUsersContainer.appendChild(pill);
    });
  }

  private async sendInvitations(): Promise<void> {
    this.sendBtn.disabled = true;
    this.sendBtn.textContent = 'Sending...';

    try {
      await this.onSendInvites(this.selectedUsers, () => {
        this.selectedUsers.clear();
        this.updateSelectedDisplay();
        this.searchInput.value = '';
        this.handleSearch('');
        this.close();
      });
    } catch (error) {
      // Error handled in onSendInvites
    } finally {
      this.sendBtn.disabled = false;
      this.sendBtn.textContent = 'Send Invitations';
    }
  }
}