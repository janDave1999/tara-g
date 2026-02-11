// File: src/actions/itinerary/activities.ts
// Astro actions for activity CRUD operations

import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { getSupabaseClient, supabaseAdmin } from '@/lib/supabase';

export const activities = {
  // Create activity
  createActivity: defineAction({
    input: z.object({
      stop_id: z.string().uuid(),
      activity_type: z.string(),
      description: z.string(),
      planned_duration_minutes: z.number(),
      order_index: z.number().optional(),
    }),
    handler: async (input, context) => {
      console.log("PUMASOK BA DITO?");
      const { data, error } = await supabaseAdmin
        .from('stop_activities')
        .insert({
          stop_id: input.stop_id,
          activity_type: input.activity_type,
          description: input.description,
          planned_duration_minutes: input.planned_duration_minutes,
          order_index: input.order_index || 0,
        })
        .select()
        .single();
      console.log("ANO YUNG ERROR", error);
      if (error) {
        console.error(error);
        window.alert(error.message);
        throw new Error(`Failed to create activity: ${error.message}`);
      }

      return { activity: data };
    },
  }),

  // Update activity
  updateActivity: defineAction({
    input: z.object({
      activity_id: z.string().uuid(),
      activity_type: z.string().optional(),
      description: z.string().optional(),
      planned_duration_minutes: z.number().optional(),
    }),
    handler: async (input, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      const updateData: any = { updated_at: new Date().toISOString() };
      if (input.activity_type) updateData.activity_type = input.activity_type;
      if (input.description) updateData.description = input.description;
      if (input.planned_duration_minutes) {
        updateData.planned_duration_minutes = input.planned_duration_minutes;
      }

      const { data, error } = await supabase
        .from('stop_activities')
        .update(updateData)
        .eq('id', input.activity_id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update activity: ${error.message}`);
      }

      return { activity: data };
    },
  }),

  // Delete activity
  deleteActivity: defineAction({
    input: z.object({
      activityId: z.string().uuid(),
    }),
    handler: async ({ activityId }, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      const { error } = await supabase
        .from('stop_activities')
        .delete()
        .eq('id', activityId);

      if (error) {
        throw new Error(`Failed to delete activity: ${error.message}`);
      }

      return { success: true };
    },
  }),
};