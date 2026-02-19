// File: src/pages/api/trips/suggested.ts
import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { handleApiError, createSuccessResponse } from '@/lib/errorHandler';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      userId: string;
      limit?: number;
    };
    const { userId, limit } = body;

    const { data, error } = await supabase.rpc('get_suggested_trips', {
      p_user_id: userId,
      p_limit: limit || 6,
    });

    if (error) {
      throw new Error('Failed to fetch suggested trips');
    }

    return createSuccessResponse({
      trips: data || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
};
