// File: src/pages/api/trips/owned.ts
import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { handleApiError, createSuccessResponse } from '@/lib/errorHandler';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      userId: string;
      search?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };

    const { userId, search, status, limit, offset } = body;

    const { data, error } = await supabase.rpc('get_user_owned_trips', {
      p_user_id: userId,
      p_search: search || null,
      p_status: status || null,
      p_limit: limit || 12,
      p_offset: offset || 0,
    });

    if (error) {
      throw new Error('Failed to fetch owned trips');
    }

    return createSuccessResponse({
      trips: data || [],
      totalCount: data?.[0]?.total_count || 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
};
