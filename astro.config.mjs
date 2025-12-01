// @ts-check
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';

import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import sitemap from "@astrojs/sitemap";


const env = loadEnv("", process.cwd(), "");

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    imageService: "compile"
  }),
  session: {
    cookie: ""
  },
  image: {
    // Allow processing all images from remote. This allow modifying the images size depending on the device.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.placehold.co",
      },
      {
        protocol: "https",
        hostname: "**.imagedelivery.net",
      },
    ],
  },
  devToolbar: {
    enabled: false
  },
  output: 'server',
  prefetch: {
    defaultStrategy: 'viewport'
  },
   env: {
    schema: {
      SECRET_ENVIRONMENT_STATUS: envField.string({ context: "server", access: "public", default: "live" }),
      SUPABASE_URL: envField.string({ context: "server", access: "public" }),
      SUPABASE_ANON_KEY: envField.string({ context: "server", access: "public" }),
      SITE_URL: envField.string({ context: "server", access: "public" }),
      PUBLIC_MAPBOX_TOKEN: envField.string({ context: "client", access: "public" }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "public" }),
      SUPABASE_GRAPHQL_URL: envField.string({ context: "server", access: "public" }),
      CLOUDINARY_CLOUD_NAME: envField.string({ context: "server", access: "public" }),
      CLOUDINARY_API_KEY: envField.string({ context: "server", access: "public" }),
      CLOUDINARY_API_SECRET: envField.string({ context: "server", access: "public" }),
      CF_ACCESS_KEY_ID: envField.string({ context: "server", access: "public" }),
      CF_SECRET_ACCESS_KEY: envField.string({ context: "server", access: "public" }),
      CF_SPECIFIC_BUCKET_S3_URL: envField.string({ context: "server", access: "public" }),
      CF_ACCOUNT_ID: envField.string({ context: "server", access: "public" }),
      PUBLIC_R2_BUCKET: envField.string({ context: "server", access: "public" }),
      PUBLIC_R2_URL: envField.string({ context: "server", access: "public" }),
    },
  },
  vite: {
    ssr: {
      external: ['node:buffer'],
    },
    plugins: [
      // @ts-ignore
      tailwindcss()
    ],
  },
  server: {
    port: 3001,
    host: true
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "ph"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [sitemap({
    filter: (page) =>
      page !== "/500" &&
      page !== "/404",
    i18n: {
      defaultLocale: 'en',
      locales: {
        en: 'en-PH',
        ph: 'ph-PH',
      }
    }
  })],
  site:"https://__YOUR_DOMAIN__.com/",
});