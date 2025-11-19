import type { APIRoute } from 'astro';
import { PUBLIC_MAPBOX_TOKEN } from 'astro:env/client';

export const GET: APIRoute = async ({ request }) => {
  const token = PUBLIC_MAPBOX_TOKEN; // only available on server
  if (!token) {
    return new Response(JSON.stringify({ error: 'Token not found' }), { status: 500 });
  }

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
