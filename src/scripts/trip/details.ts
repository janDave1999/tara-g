import type { TripDetailsRES } from "@/actions/trips";
import { supabaseAdmin } from "@/lib/supabase";
export async function getTripDetails({ slug }: { slug: string }): Promise<TripDetailsRES> {
     console.log("Fetching trip details for slug:", slug);
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
      console.error("Error fetching trip details:", error);
        throw new Error(error.message);
    } else {
        return data as unknown as TripDetailsRES;
    }
}
