import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";
import { defineAction } from "astro:actions";
// get user id in astro locals


export const trip = {
    createTrip: defineAction({
      input: z.object({
        title: z.string(),
        region_address: z.string(),
        region_coordinates: z.string(),
        description: z.string(),
        start_date: z.string(),
        end_date: z.string(),
        total_budget: z.string(),
        budget_type: z.string(),
        pickup_address: z.string(),
        pickup_coordinates: z.string(),
        dropoff_address: z.string(),
        dropoff_coordinates: z.string(),
        max_pax: z.number(),
        pickup_dates: z.string(),
        waiting_time: z.string(),
      }),

      async handler(input, context) {
        const user_id = context.locals.user_id || "";

        // insert into trips table
        const { data, error } = await supabaseAdmin
          .from("trips")
          .insert({
            title: input.title,
            owner_id: user_id,
            description: input.description,
            status: "draft",
            is_public: false
          })
          .select("trip_id")
          .single();

        if (error) {
            console.log("[error]Checkpoint 1:", error);
            return ({ error: error.message, data: null });
        }

        console.log("Checkpoint 1:", data);

        let trip_id = data?.trip_id || "";

        let isPerPax = false;

        if (input.budget_type === "per_person") {
          isPerPax = true;
        }

        const { data: tripData, error: tripError } = await supabaseAdmin
          .from("trip_details")
          .insert({
            trip_id: trip_id,
            start_date: input.start_date,
            end_date: input.end_date,
            budget: input.total_budget,
            is_per_person: isPerPax,
            region: input.region_address,
            max_pax: input.max_pax,
          })
          .select("*")
          .single();

        if (tripError) {
            return new Response(tripError.message, { status: 500 });
        }

        return ({ error: null, data: trip_id });
      }
    }),

    getAllUserTrips: defineAction({
      handler(context) {
        return supabaseAdmin.from("trips").select("*").eq("owner_id", context.locals.user_id || "");
      }
    }) 
}