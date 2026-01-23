// src/components/trip/members/actions.ts

import { actions } from "astro:actions";
import { modal } from "@/scripts/NewModal";

export class MemberActions {
  constructor(
    private tripId: string,
    private onDataChange: () => Promise<void>
  ) {}

  async approveRequest(memberId: string): Promise<void> {
    try {
      const result = await actions.trip.approveJoinRequest({ memberId, tripId: this.tripId });
      if (result.data) {
        modal.showSuccess(result.data.message);
        await this.onDataChange();
      }
    } catch (error: any) {
      modal.showError('Failed to approve: ' + error.message);
    }
  }

  async rejectRequest(memberId: string): Promise<void> {
    const confirmed = await modal.showConfirm({
      title: 'Reject Request',
      message: 'Are you sure you want to reject this join request?',
      confirmText: 'Reject',
      cancelText: 'Cancel',
      confirmVariant: 'danger'
    });

    if (!confirmed) return;

    try {
      const result = await actions.trip.rejectJoinRequest({ memberId, tripId: this.tripId });
      if (result.data) {
        modal.showSuccess('Request rejected successfully');
        await this.onDataChange();
      }
    } catch (error: any) {
      modal.showError('Failed to reject: ' + error.message);
    }
  }

  async removeMember(memberId: string): Promise<void> {
    const confirmed = await modal.showConfirm({
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the trip? This action cannot be undone.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      confirmVariant: 'danger'
    });

    if (!confirmed) return;

    try {
      const result = await actions.trip.removeTripMember({ memberId, tripId: this.tripId });
      if (result.data) {
        modal.showSuccess(result.data.message);
        await this.onDataChange();
      }
    } catch (error: any) {
      modal.showError('Failed to remove member: ' + error.message);
    }
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    const confirmed = await modal.showConfirm({
      title: 'Cancel Invitation',
      message: 'Are you sure you want to cancel this invitation?',
      confirmText: 'Cancel Invitation',
      cancelText: 'Keep Invitation',
      confirmVariant: 'danger'
    });

    if (!confirmed) return;

    try {
      const result = await actions.trip.cancelTripInvitation({ invitationId });
      if (result.data) {
        modal.showSuccess('Invitation cancelled successfully');
        await this.onDataChange();
      }
    } catch (error: any) {
      modal.showError('Failed to cancel invitation: ' + error.message);
    }
  }

  async sendInvitations(
    selectedUsers: Set<string>,
    onSuccess: () => void
  ): Promise<void> {
    const selectedUsersList = Array.from(selectedUsers).map(userId => ({ userId }));

    try {
      const result = await actions.trip.sendTripInvitations({
        tripId: this.tripId,
        invitees: selectedUsersList,
        message: undefined,
      });

      if (result.data) {
        modal.showSuccess(result.data.message);
        onSuccess();
        await this.onDataChange();
      }
    } catch (error: any) {
      modal.showError('Failed to send invitations: ' + error.message);
      throw error;
    }
  }
}