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

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

export interface ItineraryStop {
  id: string;
  trip_id: string;
  name: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  stop_type: StopType;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  is_mandatory: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

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


// Composite type for complete stop with nested data
export interface CompleteStop {
  stop: ItineraryStop;
  activities: StopActivity[];
}

// Complete trip itinerary with all nested data
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
  transportation?: CreateTransportationInput;
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

export interface CreateTransportationInput {
  vehicle_type: string;
  driver_name?: string;
  driver_contact?: string;
  notes?: string;
}

export interface StopOrderUpdate {
  stop_id: string;
  order_index: number;
}