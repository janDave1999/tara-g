import { supabaseAdmin } from "./supabase";
export async function saveTripLoc(trip_id: string, location_id: string, type: string, start_time: string, end_time: string, waiting_time: number) {
    let { error} = await supabaseAdmin
    .from("trip_location")
    .insert({
        trip_id: trip_id,
        location_id: location_id,
        type: type,
        start_time: start_time || null,
        end_time: end_time || null,
        waiting_time: waiting_time
    })
    .single();

    if (error) {
        console.log("[error]Checkpoint 1:", error);
        return ({ error: error.message, data: null });
    } else {
        console.log("Checkpoint 1:", error);
        return ({ error: null, data: null });
    }
}

export async function saveLocation(locationAddress: string, coordinates: string) {
    let coordinatesObj = JSON.parse(coordinates);
    let {data, error} = await supabaseAdmin
    .from("locations")
    .insert({
        name: locationAddress,
        lat: coordinatesObj[0],
        lng: coordinatesObj[1]
    })
    .select("location_id")
    .single();

    if (error) {
        console.log("[error]Checkpoint 1:", error);
        return ({ error: error.message, data: null });
    }

    console.log("Checkpoint 1:", data);
    return ({ error: null, data: data?.location_id });

}