import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";
import { type ActionInputSchema, type ActionReturnType, ActionError, defineAction } from "astro:actions";
import { rollBack } from "@/lib/rollback";
import { saveLocation, saveTripLoc } from "@/lib/locations";
import { uploadToR2 } from "@/scripts/R2/upload";
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
  
  getTripDetails: defineAction({
    input: z.object({
      slug: z.string(),
    }),
    
    async handler(input) {
      let slug = input.slug
      
      const { data, error } = await supabaseAdmin
      .from('trips')
      .select(`
                trip_id,
                owner_id,
                title,
                description,
                status,
                trip_details (
                  start_date,
                  end_date,
                  gender_pref,
                  cost_sharing,
                  region,
                  cover_image,
                  tags,
                  max_pax
                ),
                trip_location (
                  start_time,
                  end_time,
                  waiting_time,
                  type,
                  locations (
                    name,
                    lat,
                    lng
                  )
                ),
                trip_members (
                  user_id
                ),
                trip_pools (
                  total_pool,
                  currency
                ),
                trip_pool_members (
                  contribution,
                  balance,
                  user_id
                ),
                trip_expenses (
                  user_id,
                  description,
                  category,
                  amount
                ),
                trip_images (
                  key_name,
                  type
                ),
                trip_visibility (
                  max_participants,
                  visibility,
                  current_participants
                )
              `)
        .eq('trip_id', slug)
        .single(); // fetch only one record
        
        if (error) {
          throw new ActionError({
            message: error.message,
            code: "INTERNAL_SERVER_ERROR"
          })
        }
        return data
      }
    }),
    
    getAllUserTrips: defineAction({
      handler(context) {
        return supabaseAdmin.from("trips").select("*").eq("owner_id", context.locals.user_id || "");
      }
    }),

    uploadToR2: defineAction({
  accept: "json",

  input: z.object({
    files: z.array(
      z.object({
        file: z.string(), // base64
        name: z.string(),
        type: z.string(),
      })
    ),
    trip_id: z.string(),
  }),

  async handler({ files, trip_id }) {
    try {
      for (const f of files) {
        // --- Proper base64 file size check (in bytes) ---
        const base64 = f.file;
        const sizeInBytes = (base64.length * 3) / 4 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
        
        if (sizeInBytes > 5 * 1024 * 1024) {
          throw new ActionError({
            message: "File too large (max 5MB)",
            code: "BAD_REQUEST",
          });
        }
        
        // decode
        const buffer = Buffer.from(base64, "base64");
        
        // unique filename
        const keyname = `trip/hero/${Date.now()}-${crypto.randomUUID()}-${f.name}`;
        
        const url = await uploadToR2(buffer, f.name, f.type, keyname);
        
        if (!url) {
          throw new ActionError({
            message: "Upload failed",
            code: "INTERNAL_SERVER_ERROR",
          });
        }
        
        // save record in DB
        const { error } = await supabaseAdmin
        .from("trip_images")
        .insert({
          trip_id,
          key_name: keyname,
          type: "hero",
        });
        
        if (error) {
          console.log("[DB ERROR]", error);
          throw new ActionError({
            message: error.message,
            code: "INTERNAL_SERVER_ERROR",
          });
        }
      }
      
      return {
        success: true,
        message: "Images uploaded successfully!",
      };
    } catch (error: any) {
      console.log("[ERROR]", error);
      throw new ActionError({
        message: error?.message || "Upload failed",
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  },
  }),


 getNearbyTrips: defineAction({
  input: z.object({
    lat: z.number(),
    lng: z.number(),
    radius: z.number(),
    page: z.number().default(1),
    location_filter: z.string().default("destination"),
  }),

  async handler(input) {
    const allTrips: any[] = [];
    let page = input.page;
    const pageSize = 50;
    let lastBatchLength = -1;

    while (true) {
      const { data, error } = await supabaseAdmin.rpc("get_nearby_trips", {
        user_lng: input.lat,
        user_lat: input.lng,
        page: page,
        page_size: pageSize,
        radius_meters: input.radius,
        location_filter: input.location_filter,
      });

      if (error) {
        console.error(error);
        throw new ActionError({
          message: error.message,
          code: "INTERNAL_SERVER_ERROR",
        });
      }

      // Ensure it's an array
      const batch = Array.isArray(data) ? data : [];
      console.log("BAAAAAAAAAAAATCH", batch);
      // Stop if no data or same length as previous batch (safety check)
      if (batch.length === 0 || batch.length === lastBatchLength) break;

      allTrips.push(...batch);

      // Stop if less than pageSize (last page)
      if (batch.length < pageSize) break;

      lastBatchLength = batch.length;
      page++;
    }

    return allTrips;
  },
  })

}

  type tripDetailsSchema = ActionInputSchema<typeof trip.getTripDetails>;

  export type TripDetails = z.output<tripDetailsSchema>;
  export type TripDetailsRES = ActionReturnType<typeof trip.getTripDetails>;