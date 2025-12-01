import { S3Client } from "@aws-sdk/client-s3";
import { CF_ACCESS_KEY_ID, CF_SPECIFIC_BUCKET_S3_URL, CF_SECRET_ACCESS_KEY } from "astro:env/server";
console.log("CF_SPECIFIC_BUCKET_S3_URL", CF_SPECIFIC_BUCKET_S3_URL);
console.log("CF_ACCESS_KEY_ID", CF_ACCESS_KEY_ID);
console.log("CF_SECRET_ACCESS_KEY", CF_SECRET_ACCESS_KEY);
export const r2 = new S3Client({
  endpoint: CF_SPECIFIC_BUCKET_S3_URL,
  credentials: {
    accessKeyId: CF_ACCESS_KEY_ID,
    secretAccessKey: CF_SECRET_ACCESS_KEY,
  },
  region: "auto",
});
