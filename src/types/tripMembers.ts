export type MemberStatus = 'pending' | 'joined' | 'invited' | 'left';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface Member {
  member_id: string;
  user_id: string;
  full_name: string;
  username: string;
  avatar_url?: string | null;
  role: string; // Changed from MemberRole to string to match API
  member_status: string; // Changed from MemberStatus to string to match API
  is_current_user: boolean;
}

export interface JoinRequest {
  member_id: string;
  user_id: string;
  full_name: string;
  username: string;
  avatar_url?: string | null;
  is_friend: boolean;
}

export interface Invitation {
  invitation_id: string;
  invitee_id: string;
  invitee_name: string;
  invitee_username?: string | null;
  invitee_avatar?: string | null;
  inviter_name: string;
  days_until_expiry: number;
}

export interface TripSummary {
  joined_members: number;
  max_participants: number;
  available_spots: number;
  user_role: string; // Changed from MemberRole to string to match API
  can_invite: boolean;
}

export interface MembersData {
  members: Member[];
  pending_requests: JoinRequest[];
  pending_invitations: Invitation[];
  summary: TripSummary;
}


export interface UserSuggestion {
  user_id: string;
  full_name: string;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  relation_reason?: string | null;
}

export const STATUS_CONFIG: Record<MemberStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  joined: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  invited: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  left: 'bg-slate-100 text-slate-700 ring-slate-600/20'
};