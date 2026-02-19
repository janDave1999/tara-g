export type TripFormData = {
  gender_preference: any;
  tags: string[];
  joined_by: string;
  title: string;
  region_address: string;
  region_coordinates: string;
  description: string;
  start_date: string;
  end_date: string;
  pickup_address: string;
  pickup_coordinates: string;
  dropoff_address: string;
  dropoff_coordinates: string;
  pickup_dates: string;
  dropoff_dates: string;
  waiting_time: number;
  cost_sharing: 'split_evenly' | 'organizer_shoulders_cost' | 'pay_own_expenses' | 'custom_split';
  slug: string;
  max_pax: number;
  estimated_budget: number | null;
}

export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface TripLocation {
  id: string;
  start_time: string;
  end_time: string;
  waiting_time: number;
  type: string;
  notes: string;
  is_primary: boolean;
  location: {
    location_id: string;
    name: string;
    lat: string;
    lng: string;
  };
  activities: Array<{
    id: string;
    activity_type: string;
    description: string;
    planned_duration_minutes: number;
  }>;
}

export interface TripPool {
  total_pool: number;
  currency: string;
}

export interface TripPoolMember {
  user_id: string;
  contribution: number;
  balance: number;
}

export interface TripExpense {
  user_id: string;
  description: string;
  category: string;
  amount: number;
}

export type TripMember = {
  member_id: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  email: string;
  role: string;
  member_status: string;
  join_method: string;
  joined_at: string;
  initial_contribution: number;
  is_current_user: boolean;
};

export type JoinRequest = {
  member_id: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  role: string;
  requested_at: string;
  is_friend: boolean;
};

export type PendingInvitation = {
  invitation_id: string;
  invitee_id: string;
  invitee_name: string;
  invitee_username: string;
  invitee_email: string;
  invitee_avatar: string;
  inviter_name: string;
  message: string;
  created_at: string;
  expires_at: string;
  days_until_expiry: number;
};

export type MembersSummary = {
  total_members: number;
  joined_members: number;
  pending_requests: number;
  pending_invitations: number;
  max_participants: number;
  current_participants: number;
  available_spots: number;
  user_role: string;
  user_status: string;
  can_invite: boolean;
};

export type CompleteMembersData = {
  members: TripMember[];
  pending_requests: JoinRequest[];
  pending_invitations: PendingInvitation[];
  summary: MembersSummary;
};

export interface TripDetails {
  description: string;
  start_date: string;
  end_date: string;
  cover_image: string;
  region: string;
  max_pax: number;
  gender_pref: string;
  cost_sharing: string;
  estimated_budget: number;
  join_by: string;
  join_by_time: string;
  tags: string[];
}

export interface TripVisibility {
  visibility: 'private' | 'public';
  max_participants: number;
  current_participants: number;
  is_reusable: boolean;
  share_slug: string;
}

export interface Trip {
  trip_id: string;
  owner_id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived' | 'cancelled';
  user_role: 'owner' | 'member' | 'pending' | 'visitor';
  trip_details: TripDetails;
  trip_locations: TripLocation[];
  trip_members: TripMember[];
  trip_visibility: TripVisibility;
  trip_pools: any;
  trip_pool_members: any[];
  trip_expenses: any[];
  trip_images: any[];
}

export interface TripPageProps {
  tripId: string;
  title: string;
  description: string;
  tripStatus: string;
  userRole: string;
  visibility: string;
  destination: string;
  tripStart: string;
  tripEnd: string;
  joinedBy: string;
  currentPax: number;
  maxPax: number;
  members: TripMember[];
  genderPref: string;
  costSharing: string;
  estimatedBudget: number;
  tags: string[];
  locations: TripLocation[];
}
