// File: src/pages/api/trips/suggested.ts
import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';

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
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        trips: data || [],
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