// File: src/actions/itinerary/stops.ts
// Astro actions for stop CRUD operations

import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { getSupabaseClient, supabaseAdmin } from '@/lib/supabase';
import type { TripItinerary } from '@/types/itinerary';

export const stops = {
  // Get complete itinerary
  getItinerary: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
    }),
    handler: async ({ tripId }, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      const { data, error } = await supabase.rpc('get_trip_itinerary', {
        trip_uuid: tripId,
      });

      if (error) {
        throw new Error(`Failed to fetch itinerary: ${error.message}`);
      }

      return data as TripItinerary;
    },
  }),

  // Create a new stop
  createStop: defineAction({
    input: z.object({
      trip_id: z.string().uuid(),
      name: z.string().min(1),
      stop_type: z.enum([
        'pickup',
        'dropoff',
        'destination',
        'activity',
        'meal_break',
        'rest_stop',
        'transit',
        'accommodation',
        'checkpoint',
      ]),
      scheduled_start: z.string(),
      scheduled_end: z.string(),
      location_name: z.string().optional(),
      notes: z.string().optional(),
      order_index: z.number().optional(),
      activities: z.array(z.object({
        activity_type: z.string(),
        description: z.string(),
        planned_duration_minutes: z.number(),
        order_index: z.number().optional(),
      })).optional(),
      transportation: z.object({
        vehicle_type: z.string(),
        driver_name: z.string().optional(),
        driver_contact: z.string().optional(),
        notes: z.string().optional(),
      }).optional(),
    }),
    handler: async (input) => {

      const { data, error } = await supabaseAdmin.rpc('create_itinerary_stop', {
        p_trip_id: input.trip_id,
        p_name: input.name,
        p_stop_type: input.stop_type,
        p_scheduled_start: input.scheduled_start,
        p_scheduled_end: input.scheduled_end,
        p_location_name: input.location_name || null,
        p_notes: input.notes || null,
        p_order_index: input.order_index || null,
        p_activities: input.activities ? JSON.stringify(input.activities) : '[]',
        p_transportation: input.transportation ? JSON.stringify(input.transportation) : null,
      });
      if (error) {
        throw new Error(`Failed to create stop: ${error.message}`);
      }

      return { stopId: data as string };
    },
  }),

  // Update a stop
  updateStop: defineAction({
    input: z.object({
      stop_id: z.string().uuid(),
      name: z.string().optional(),
      stop_type: z.enum([
        'pickup',
        'dropoff',
        'destination',
        'activity',
        'meal_break',
        'rest_stop',
        'transit',
        'accommodation',
        'checkpoint',
      ]).optional(),
      scheduled_start: z.string().optional(),
      scheduled_end: z.string().optional(),
      location_name: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input) => {

      const { data, error } = await supabaseAdmin.rpc('update_itinerary_stop', {
        p_stop_id: input.stop_id,
        p_name: input.name || null,
        p_stop_type: input.stop_type || null,
        p_scheduled_start: input.scheduled_start || null,
        p_scheduled_end: input.scheduled_end || null,
        p_location_name: input.location_name || null,
        p_notes: input.notes || null,
      });

      if (error) {
        throw new Error(`Failed to update stop: ${error.message}`);
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

      const { error } = await supabaseAdmin.rpc('delete_itinerary_stop', {
        p_stop_id: stopId,
      });

      if (error) {
        throw new Error(`Failed to delete stop: ${error.message}`);
      }

      return { success: true };
    },
  }),

  // Reorder stops
  reorderStops: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      orders: z.array(z.object({
        stop_id: z.string().uuid(),
        order_index: z.number(),
      })),
    }),
    handler: async ({ tripId, orders }, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      const { data, error } = await supabase.rpc('reorder_itinerary_stops', {
        p_trip_id: tripId,
        p_stop_orders: JSON.stringify(orders),
      });

      if (error) {
        throw new Error(`Failed to reorder stops: ${error.message}`);
      }

      return { success: true };
    },
  }),
};