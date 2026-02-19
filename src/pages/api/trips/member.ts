// File: src/pages/api/trips/member.ts
import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { handleApiError, createSuccessResponse } from '../../../lib/errorHandler';
import { validateBody, commonSchemas } from '../../../lib/validation';
import { z } from 'zod';

const memberTripsSchema = z.object({
  userId: commonSchemas.id,
  search: z.string().max(100).optional().nullable(),
  memberStatus: z.enum(['pending', 'accepted', 'declined']).optional().nullable(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await validateBody(memberTripsSchema)(request);
    const { userId, search, memberStatus, limit = 12, offset = 0 } = body;

    const { data, error } = await supabase.rpc('get_user_member_trips', {
      p_user_id: userId,
      p_search: search,
      p_member_status: memberStatus,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw new Error('Failed to fetch member trips');
    }

    const response = {
      trips: data || [],
      totalCount: Array.isArray(data) && data.length > 0 ? data[0]?.total_count || 0 : 0,
      pagination: {
        limit,
        offset,
        hasMore: (Array.isArray(data) && data.length > 0 ? data[0]?.total_count || 0 : 0) > (offset + limit)
      }
    };

    return createSuccessResponse(response);
    
  } catch (error) {
    return handleApiError(error);
  }
};