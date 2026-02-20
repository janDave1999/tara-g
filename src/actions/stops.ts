// File: src/actions/stops.ts
// Astro actions for stop CRUD operations

import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '@/lib/supabase';

const locationTypeEnum = z.enum([
  'pickup',
  'dropoff',
  'activity',
  'meal_break',
  'rest_stop',
  'transit',
  'accommodation',
  'checkpoint',
  'boat',
  'ferry',
]);

export const stops = {
  // Create a new stop
  // Flow: INSERT into locations → get location_id → INSERT into trip_location
  createStop: defineAction({
    input: z.object({
      trip_id: z.string().uuid(),
      location_type: locationTypeEnum,
      location_name: z.string().min(1),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      scheduled_start: z.string(),
      scheduled_end: z.string().optional(),
      notes: z.string().optional(),
      order_index: z.number().optional(),
    }),
    handler: async (input) => {
      // 1. Insert into locations
      const { data: locationData, error: locationError } = await supabaseAdmin
        .from('locations')
        .insert({
          name: input.location_name,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
        })
        .select('location_id')
        .single();

      if (locationError || !locationData) {
        throw new Error(`Failed to create location: ${locationError?.message}`);
      }

      // 2. Determine order_index if not provided
      let orderIndex = input.order_index;
      if (orderIndex === undefined) {
        const { count } = await supabaseAdmin
          .from('trip_location')
          .select('id', { count: 'exact', head: true })
          .eq('trip_id', input.trip_id);
        orderIndex = (count ?? 0) + 1;
      }

      // 3. Insert into trip_location
      const { data: stopData, error: stopError } = await supabaseAdmin
        .from('trip_location')
        .insert({
          trip_id: input.trip_id,
          location_id: locationData.location_id,
          location_type: input.location_type,
          scheduled_start: input.scheduled_start,
          scheduled_end: input.scheduled_end ?? null,
          notes: input.notes ?? null,
          order_index: orderIndex,
        })
        .select('id')
        .single();

      if (stopError || !stopData) {
        throw new Error(`Failed to create stop: ${stopError?.message}`);
      }

      return { stopId: stopData.id };
    },
  }),

  // Update a stop
  // Flow: UPDATE locations (name/coords) + UPDATE trip_location (type/times/notes)
  updateStop: defineAction({
    input: z.object({
      stop_id: z.string().uuid(),
      location_type: locationTypeEnum.optional(),
      location_name: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      scheduled_start: z.string().optional(),
      scheduled_end: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input) => {
      // Get the current trip_location row to find location_id
      const { data: stopRow, error: fetchError } = await supabaseAdmin
        .from('trip_location')
        .select('location_id')
        .eq('id', input.stop_id)
        .single();

      if (fetchError || !stopRow) {
        throw new Error(`Stop not found: ${fetchError?.message}`);
      }

      // 1. Update locations if name or coords changed
      if (stopRow.location_id && (input.location_name !== undefined || input.latitude !== undefined || input.longitude !== undefined)) {
        const locationUpdate: Record<string, any> = {};
        if (input.location_name !== undefined) locationUpdate.name = input.location_name;
        if (input.latitude !== undefined) locationUpdate.latitude = input.latitude;
        if (input.longitude !== undefined) locationUpdate.longitude = input.longitude;

        const { error: locError } = await supabaseAdmin
          .from('locations')
          .update(locationUpdate)
          .eq('location_id', stopRow.location_id);

        if (locError) {
          throw new Error(`Failed to update location: ${locError.message}`);
        }
      }

      // 2. Update trip_location
      const stopUpdate: Record<string, any> = {};
      if (input.location_type !== undefined) stopUpdate.location_type = input.location_type;
      if (input.scheduled_start !== undefined) stopUpdate.scheduled_start = input.scheduled_start;
      if (input.scheduled_end !== undefined) stopUpdate.scheduled_end = input.scheduled_end;
      if (input.notes !== undefined) stopUpdate.notes = input.notes;

      if (Object.keys(stopUpdate).length > 0) {
        const { error: stopError } = await supabaseAdmin
          .from('trip_location')
          .update(stopUpdate)
          .eq('id', input.stop_id);

        if (stopError) {
          throw new Error(`Failed to update stop: ${stopError.message}`);
        }
      }

      return { success: true };
    },
  }),

  // Delete a stop
  deleteStop: defineAction({
    input: z.object({
      stopId: z.string().uuid(),
    }),
    handler: async ({ stopId }) => {
      // Get location_id before deleting so we can clean up locations too
      const { data: stopRow } = await supabaseAdmin
        .from('trip_location')
        .select('location_id')
        .eq('id', stopId)
        .single();

      const { error } = await supabaseAdmin
        .from('trip_location')
        .delete()
        .eq('id', stopId);

      if (error) {
        throw new Error(`Failed to delete stop: ${error.message}`);
      }

      // Clean up the locations row (only if it has no other trip_location references)
      if (stopRow?.location_id) {
        const { count } = await supabaseAdmin
          .from('trip_location')
          .select('id', { count: 'exact', head: true })
          .eq('location_id', stopRow.location_id);

        if (count === 0) {
          await supabaseAdmin
            .from('locations')
            .delete()
            .eq('location_id', stopRow.location_id);
        }
      }

      return { success: true };
    },
  }),
};
