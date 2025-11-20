import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";
import { ActionError, defineAction } from "astro:actions";
import { rollBack } from "@/lib/rollback";
import { saveLocation, saveTripLoc } from "@/lib/locations";
// get user id in astro locals


export const trip = {
    createTrip: defineAction({
      input: z.object({
        slug: z.string(),
        title: z.string(),
        region_address: z.string(),
        region_coordinates: z.string(),
        description: z.string(),
        start_date: z.string(),
        end_date: z.string(),
        cost_sharing: z.string(),
        pickup_address: z.string(),
        pickup_coordinates: z.string(),
        max_pax: z.number(),
        pickup_dates: z.string(),
        waiting_time: z.number(),
        gender_preference: z.string(),
      }),

      async handler(input, context) {
        console.log("Trip Created:", input);
        const user_id = context.locals.user_id || "";

        // insert into trips table
        const { data, error } = await supabaseAdmin
          .from("trips")
          .insert({
            title: input.title,
            slug: input.slug,
            owner_id: user_id,
            description: input.description,
            status: "draft",
            is_public: false
          })
          .select("trip_id, slug")
          .single();

        if (error) {
            console.log("[error]Checkpoint 1:", error);
            throw new ActionError({
                message: error.message,
                code: "INTERNAL_SERVER_ERROR"
            });
        }

        console.log("Checkpoint 1:", data);

        let trip_id = data?.trip_id || "";
        let slug = data?.slug || "";


        const { error: tripError } = await supabaseAdmin
          .from("trip_details")
          .insert({
            trip_id: trip_id,
            start_date: input.start_date,
            end_date: input.end_date,
            cost_sharing: input.cost_sharing,
            region: input.region_address,
            gender_pref: input.gender_preference,
            max_pax: input.max_pax,
          })
          .single();

        if (tripError) {
            await rollBack("trips", trip_id);
            throw new ActionError({
                message: tripError.message,
                code: "INTERNAL_SERVER_ERROR"
            })
        }

        const { error: tripVisibilityError } = await supabaseAdmin
            .from("trip_visibility")
            .insert({
                trip_id: trip_id,
                max_participants: input.max_pax,

            })

            if (tripVisibilityError) {
                await rollBack("trips", trip_id);
                throw new ActionError({
                    message: tripVisibilityError.message,
                    code: "INTERNAL_SERVER_ERROR"
                })
            }

        const { data: region, error: locationError } = await saveLocation(input.region_address, input.region_coordinates);
        if (locationError) {
            await rollBack("trips", trip_id);
            throw new ActionError({
                message: locationError,
                code: "INTERNAL_SERVER_ERROR"
            })
        }
        const { data: pickup, error: pickupError } = await saveLocation(input.pickup_address, input.pickup_coordinates);
        if (pickupError) {
            await rollBack("trips", trip_id);
            throw new ActionError({
                message: pickupError,
                code: "INTERNAL_SERVER_ERROR"
            })
        }
        // const { data: dropoff, error: dropoffError } = await saveLocation(input.dropoff_address, input.dropoff_coordinates);
        // if (dropoffError) {
        //     await rollBack("trips", trip_id);
        //     throw new ActionError({
        //         message: dropoffError,
        //         code: "INTERNAL_SERVER_ERROR"
        //     })
        // }
        const { error: tripLocError } = await saveTripLoc(trip_id, region, "destination", input.start_date, input.end_date, 0);
        if (tripLocError) {
            await rollBack("trips", trip_id);
            console.log("[error]Checkpoint 2:", tripLocError);
            throw new ActionError({
                message: tripLocError,
                code: "INTERNAL_SERVER_ERROR"
            })
        }
        const { error: tripPickupError } = await saveTripLoc(trip_id, pickup, "pickup", input.pickup_dates, input.pickup_dates, input.waiting_time || 0);
        if (tripPickupError) {
            await rollBack("trips", trip_id);
            console.log("[error]Checkpoint 3:", tripPickupError);
            throw new ActionError({
                message: tripPickupError,
                code: "INTERNAL_SERVER_ERROR"
            })
        }
        // const { error: tripDropoffError } = await saveTripLoc(trip_id, dropoff, "dropoff", "", "", 0);
        // if (tripDropoffError) {
        //     await rollBack("trips", trip_id);
        //     console.log("[error]Checkpoint 4:", tripDropoffError);
        //     throw new ActionError({
        //         message: tripDropoffError,
        //         code: "INTERNAL_SERVER_ERROR"
        //     })
        // }

        let reponse = JSON.stringify({
            success: true,
            message: "Trip created successfully!",
            data: {
                trip_id: trip_id,
                slug: slug,
            },
        })

        return reponse;
      }
    }),

    getAllUserTrips: defineAction({
      handler(context) {
        return supabaseAdmin.from("trips").select("*").eq("owner_id", context.locals.user_id || "");
      }
    })
}