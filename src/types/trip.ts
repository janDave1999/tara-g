export type TripFormData = {
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
  waiting_time: number;
  cost_sharing: string;
  slug: string;
  max_pax: number;
}