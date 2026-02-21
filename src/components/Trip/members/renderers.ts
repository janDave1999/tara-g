// src/components/trip/members/renderers.ts

import type { Member, JoinRequest, Invitation } from '@/types/tripMembers';
import { STATUS_CONFIG } from '@/types/tripMembers';
import { getInitials, createButton } from '@/utility/tripMembers';
import { PUBLIC_R2_URL } from 'astro:env/client';

export class MemberRenderer {
  constructor(
    private membersList: HTMLTableSectionElement,
    private onRemoveMember: (memberId: string) => void,
    private onApproveRequest: (memberId: string) => void,
    private onRejectRequest: (memberId: string) => void
  ) {}

  render(members: Member[], userRole: string): void {
    this.membersList.innerHTML = '';

    members.forEach((member) => {
      const row = this.createMemberRow(member, userRole);
      this.membersList.appendChild(row);
    });
  }

  private createMemberRow(member: Member, userRole: string): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-50/80 transition-colors';

    const statusClass = STATUS_CONFIG[member.member_status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const avatarHtml = member.avatar_url
      ? `<img src="${PUBLIC_R2_URL}${member.avatar_url}" alt="${member.full_name}" class="w-10 h-10 rounded-full object-cover shrink-0" />`
      : `<div class="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">${getInitials(member.full_name)}</div>`;

    row.innerHTML = `
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          ${avatarHtml}
          <div>
            <div class="text-sm font-medium text-slate-800">
              ${member.full_name}${member.is_current_user ? ' (You)' : ''}
            </div>
            <div class="text-xs text-slate-500">@${member.username || 'N/A'}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4">
        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/20 capitalize">
          ${member.role}
        </span>
      </td>
      <td class="px-6 py-4">
        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClass} capitalize">
          ${member.member_status}
        </span>
      </td>
      <td class="px-6 py-4 text-right">
        <div class="flex justify-end gap-2 action-container"></div>
      </td>
    `;

    this.membersList.appendChild(row);
    this.addActionButtons(row, member, userRole);

    return row;
  }

  private addActionButtons(row: HTMLTableRowElement, member: Member, userRole: string): void {
    if ((userRole === 'owner' || userRole === 'admin') && !member.is_current_user && member.role !== 'owner') {
      const actionContainer = row.querySelector('.action-container') as HTMLDivElement;

      if (member.member_status === 'joined' && actionContainer) {
        const removeBtn = createButton(
          'Remove',
          'text-red-600 hover:bg-red-50 border border-red-200',
          () => this.onRemoveMember(member.member_id)
        );
        actionContainer.appendChild(removeBtn);
      }

      if (member.member_status === 'pending' && actionContainer) {
        const approveBtn = createButton(
          'Approve',
          'bg-emerald-600 hover:bg-emerald-700 text-white',
          () => this.onApproveRequest(member.member_id)
        );
        const rejectBtn = createButton(
          'Reject',
          'border border-slate-300 hover:bg-slate-100 text-slate-700',
          () => this.onRejectRequest(member.member_id)
        );
        actionContainer.appendChild(approveBtn);
        actionContainer.appendChild(rejectBtn);
      }
    }
  }
}

export class RequestRenderer {
  constructor(
    private requestsList: HTMLDivElement,
    private requestsEmpty: HTMLDivElement,
    private onApprove: (memberId: string) => void,
    private onReject: (memberId: string) => void
  ) {}

  render(requests: JoinRequest[]): void {
    if (requests.length === 0) {
      this.requestsEmpty.classList.remove('hidden');
      return;
    }

    this.requestsEmpty.classList.add('hidden');
    this.requestsList.innerHTML = '';

    requests.forEach((request) => {
      const div = this.createRequestItem(request);
      this.requestsList.appendChild(div);
    });
  }

  private createRequestItem(request: JoinRequest): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'p-4 hover:bg-slate-50 transition-colors';

    const avatarHtml = request.avatar_url
      ? `<img src="${request.avatar_url}" alt="${request.full_name}" class="w-12 h-12 rounded-full object-cover shrink-0" />`
      : `<div class="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold shrink-0">${getInitials(request.full_name)}</div>`;

    div.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          ${avatarHtml}
          <div>
            <div class="text-sm font-medium text-slate-800">${request.full_name}</div>
            <div class="text-xs text-slate-500">@${request.username || 'N/A'}</div>
            ${request.is_friend ? '<div class="text-xs text-blue-600 mt-0.5">👥 Your friend</div>' : ''}
          </div>
        </div>
        <div class="flex gap-2 action-buttons"></div>
      </div>
    `;

    const actionButtons = div.querySelector('.action-buttons') as HTMLDivElement;
    if (actionButtons) {
      actionButtons.appendChild(
        createButton(
          'Approve',
          'bg-emerald-600 hover:bg-emerald-700 text-white',
          () => this.onApprove(request.member_id)
        )
      );
      actionButtons.appendChild(
        createButton(
          'Reject',
          'border border-slate-300 hover:bg-slate-100 text-slate-700',
          () => this.onReject(request.member_id)
        )
      );
    }

    return div;
  }
}

export class InvitationRenderer {
  constructor(
    private invitationsList: HTMLDivElement,
    private invitationsEmpty: HTMLDivElement,
    private onCancel: (invitationId: string) => void
  ) {}

  render(invitations: Invitation[]): void {
    if (invitations.length === 0) {
      this.invitationsEmpty.classList.remove('hidden');
      return;
    }

    this.invitationsEmpty.classList.add('hidden');
    this.invitationsList.innerHTML = '';

    invitations.forEach((invitation) => {
      const div = this.createInvitationItem(invitation);
      this.invitationsList.appendChild(div);
    });
  }

  private createInvitationItem(invitation: Invitation): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'p-4 hover:bg-slate-50 transition-colors';

    const avatarHtml = invitation.invitee_avatar
      ? `<img src="${invitation.invitee_avatar}" alt="${invitation.invitee_name}" class="w-12 h-12 rounded-full object-cover shrink-0" />`
      : `<div class="w-12 h-12 rounded-full bg-linear-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-semibold shrink-0">${getInitials(invitation.invitee_name)}</div>`;
    const expiryText = this.getExpiryText(invitation.days_until_expiry);

    div.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          ${avatarHtml}
          </div>
          <div>
            <div class="text-sm font-medium text-slate-800">${invitation.invitee_name}</div>
            ${invitation.invitee_username ? `<div class="text-xs text-slate-500">@${invitation.invitee_username}</div>` : ''}
            <div class="text-xs text-slate-400 mt-0.5">Invited by ${invitation.inviter_name} • ${expiryText}</div>
          </div>
        </div>
        <div class="action-buttons"></div>
      </div>
    `;

    const actionButtons = div.querySelector('.action-buttons') as HTMLDivElement;
    if (actionButtons) {
      actionButtons.appendChild(
        createButton(
          'Cancel',
          'text-slate-600 hover:bg-slate-100 border border-slate-300 text-xs',
          () => this.onCancel(invitation.invitation_id)
        )
      );
    }

    return div;
  }

  private getExpiryText(daysLeft: number): string {
    if (daysLeft > 1) return `${daysLeft} days left`;
    if (daysLeft === 1) return '1 day left';
    return 'Expires today';
  }
}