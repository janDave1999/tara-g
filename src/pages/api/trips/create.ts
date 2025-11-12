import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { forwardGeocode } from "@/scripts/mapboxGeocoding";


type TripFormData = {
  title: string;
  "region address-search": string;
  description: string;
  start_date: string;
  end_date: string;
  total_budget: string;
  "pickup_locations address-search": string;
  pickup_dates: string;
  waiting_time: string;
  "dropoff_locations address-search": string;
}

export const POST: APIRoute = async ({ request }) => {
    const formData = await request.formData();
    console.log(formData);
    const trip: TripFormData = Object.fromEntries(formData) as TripFormData;


    return new Response("Success", { status: 200 });
}