// File: src/pages/api/trips/member.ts
import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      userId: string;
      search?: string;
      memberStatus?: string;
      limit?: number;
      offset?: number;
    };
    const { userId, search, memberStatus, limit, offset } = body;

    const { data, error } = await supabase.rpc('get_user_member_trips', {
      p_user_id: userId,
      p_search: search || null,
      p_member_status: memberStatus || null,
      p_limit: limit || 12,
      p_offset: offset || 0,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        trips: data || [],
        totalCount: data?.[0]?.total_count || 0,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};