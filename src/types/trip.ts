export type TripFormData = {
  gender_preference: string;
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
  cost_sharing: string;
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
  start_time: string;
  end_time: string;
  waiting_time: number;
  type: string;
  locations: Location;
}

export interface TripDetails {
  start_date: string;
  end_date: string;
  gender_pref?: string;
  cost_sharing?: string;
  region?: string;
  cover_image?: string;
  tags?: string[];
  max_pax?: number;
}

export interface TripMember {
  user_id: string;
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

export interface Trip {
  trip_id: string;
  owner_id: string;
  title: string;
  description: string;
  status: string;
  trip_details?: TripDetails[];
  trip_location?: TripLocation[];
  trip_members?: TripMember[];
  trip_pools?: TripPool[];
  trip_pool_members?: TripPoolMember[];
  trip_expenses?: TripExpense[];
}
