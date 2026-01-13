import { S3Client } from "@aws-sdk/client-s3";
import { CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SPECIFIC_BUCKET_S3_URL, CLOUDFLARE_SECRET_ACCESS_KEY } from "astro:env/server";
export const r2 = new S3Client({
  endpoint: CLOUDFLARE_SPECIFIC_BUCKET_S3_URL,
  credentials: {
    accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,
  },
  region: "auto",
});
