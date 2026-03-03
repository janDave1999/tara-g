import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

const SITE = "https://tara-g.site";

// Static public pages and their priorities
const STATIC_PAGES = [
  { url: "/",        changefreq: "daily",   priority: "1.0" },
  { url: "/trips",   changefreq: "hourly",  priority: "0.9" },
  { url: "/discover",changefreq: "daily",   priority: "0.8" },
  { url: "/about",   changefreq: "monthly", priority: "0.5" },
  { url: "/blogs",   changefreq: "weekly",  priority: "0.7" },
];

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const GET: APIRoute = async () => {
  const now = new Date().toISOString().split("T")[0];

  // Fetch public trips
  const { data: trips } = await supabaseAdmin
    .from("trips")
    .select("trip_id, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(500);

  const urls: string[] = [];

  // Static pages
  for (const page of STATIC_PAGES) {
    urls.push(`
  <url>
    <loc>${SITE}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // Dynamic trip pages
  for (const trip of trips ?? []) {
    const lastmod = trip.updated_at
      ? new Date(trip.updated_at).toISOString().split("T")[0]
      : now;
    urls.push(`
  <url>
    <loc>${xmlEscape(`${SITE}/trips/${trip.trip_id}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
