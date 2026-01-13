import { STRAPI_URL } from "astro:env/server";

export async function fetchPosts() {
  const response = await fetch(`${STRAPI_URL}/api/annuncement-banners`);
  console.log(response);
  const { data } = await response.json();
  console.log(data);
  return data;
}