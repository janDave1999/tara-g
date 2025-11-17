import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase";


type TripFormData = {
  title: string;
  region_address: string;
  region_coordinates: string;
  description: string;
  start_date: string;
  end_date: string;
  total_budget: string;
  pickup_address: string;
  pickup_coordinates: string;
  dropoff_address: string;
  dropoff_coordinates: string;
  pickup_dates: string;
  waiting_time: string;
}

export const POST: APIRoute = async ({ locals, request }) => {
    const formData = await request.formData();
    console.log(formData);
    const trip: TripFormData = Object.fromEntries(formData) as TripFormData;
    let user_id  = locals.user_id || "";
    let { data, error } = await createTrip(trip, user_id);
    console.log(data, error);
    return new Response("Success", { status: 200, statusText: "Success", });
}

type Trip = {
  owner_id: string;
  title: string;
  description: string;
  status: string;
  is_public: boolean;
}

async function createTrip(trip: TripFormData, user_id: string) {
  // insert into trips table
  const { data, error } = await supabaseAdmin
    .from("trips")
    .insert({
      title: trip.title,
      owner_id: user_id,
      description: trip.description,
      status: "draft",
      is_public: false
    })
    .select("trip_id")
    .single();

    if (error) {
      console.log(error);
    }
  
  let trip_id = data?.trip_id || "";

  const {data: tripData, error: tripError} = await supabaseAdmin
    .from("trip_details")
    .insert({
      trip_id: trip_id,
      start_date: trip.start_date,
      end_date: trip.end_date,
      region: trip.region_address,
    })
    .select("*")
    .single();
    if (tripError) {
      console.log(tripError);
    }
    console.log(tripData);

    return { data, error };
}

