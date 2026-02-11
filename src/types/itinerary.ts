// File: src/types/itinerary.ts
// TypeScript interfaces for itinerary system

export type StopType = 
  | 'pickup' 
  | 'dropoff' 
  | 'destination' 
  | 'activity' 
  | 'meal_break' 
  | 'rest_stop' 
  | 'transit' 
  | 'accommodation' 
  | 'checkpoint';

export type TripStatus = 'draft' | 'confirmed' | 'completed' | 'cancelled';

// export interface Trip {
//   id: string;
//   user_id: string;
//   title: string;
//   description: string | null;
//   start_date: string;
//   end_date: string;
//   status: TripStatus;
//   created_at: string;
//   updated_at: string;
// }

// export interface ItineraryStop {
//   id: string;
//   trip_id: string;
//   name: string;
//   description: string | null;
//   scheduled_start: string;
//   scheduled_end: string;
//   actual_start: string | null;
//   actual_end: string | null;
//   stop_type: StopType;
//   location_name: string | null;
//   address: string | null;
//   latitude: number | null;
//   longitude: number | null;
//   notes: string | null;
//   is_mandatory: boolean;
//   order_index: number;
//   created_at: string;
//   updated_at: string;
// }

// Composite type for complete stop with nested data
export interface StopActivity {
  id: string;
  stop_id: string;
  activity_type: string;
  description: string | null;
  planned_duration_minutes: number;
  actual_duration_minutes: number | null;
  notes: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ItineraryStop {
  id: string;
  notes?: string;
  longitude?: number;
  latitude?: number;
  stop_type: StopType;
  actual_end: string;
  order_index: number;
  actual_start: string;
  is_mandatory: boolean;
  waiting_time: number | null;
  scheduled_start: string;
  scheduled_end: string;
  location_name?: string;
  is_primary?: boolean;
  activities?: StopActivity[];
}

export interface CompleteStop {
  stop: ItineraryStop;
}

export interface TripItinerary {
  stops: CompleteStop[];
}

// Input types for creating/updating

export interface CreateStopInput {
  trip_id: string;
  name: string;
  stop_type: StopType;
  scheduled_start: string;
  scheduled_end: string;
  location_name?: string;
  notes?: string;
  order_index?: number;
  activities?: CreateActivityInput[];
}

export interface UpdateStopInput {
  stop_id: string;
  name?: string;
  stop_type?: StopType;
  scheduled_start?: string;
  scheduled_end?: string;
  location_name?: string;
  notes?: string;
}

export interface CreateActivityInput {
  activity_type: string;
  description: string;
  planned_duration_minutes: number;
  order_index?: number;
}

export interface UpdateActivityInput {
  activity_id: string;
  activity_type?: string;
  description?: string;
  planned_duration_minutes?: number;
}

export interface StopOrderUpdate {
  stop_id: string;
  order_index: number;
}

export interface Location {
  location_id: string;
  name: string;
  lat: string | null;
  lng: string | null;
}

export interface TripLocation {
  id: string;
  trip_id: string;
  location_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  waiting_time: number | null;
  stop_type: StopType
  notes: string | null;
  is_primary: boolean;
  name: string | null;
  description: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_mandatory: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  location?: Location | null;
  activities?: StopActivity[];
}

export interface Trip {
  trip_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: any;
  is_public: boolean;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripDetails {
  trip_details_id: string;
  trip_id: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image: string | null;
  region: string | null;
  max_pax: number | null;
  gender_pref: string | null;
  cost_sharing: string | null;
  join_by: string | null;
  tags: string[] | null;
  estimated_budget: number | null;
}

// For the component props (simplified view)

export interface ItineraryTrip {
  trip_id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status: string;
}