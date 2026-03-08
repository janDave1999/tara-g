import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  CLOUDFLARE_ACCESS_KEY_ID,
  CLOUDFLARE_SECRET_ACCESS_KEY,
  CLOUDFLARE_SPECIFIC_BUCKET_S3_URL,
} from "astro:env/server";

const BUCKET_NAME = "staging-tara-g-assets";

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: CLOUDFLARE_SPECIFIC_BUCKET_S3_URL,
    region: "auto",
    credentials: {
      accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  keyname: string,
): Promise<string> {
  if (!fileBuffer || fileBuffer.length === 0) throw new Error("File buffer is empty");
  if (!keyname) throw new Error("Key name is required");

  console.log(`[R2] Uploading ${fileName} → ${keyname}`);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: keyname,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  );

  const baseUrl = import.meta.env.PUBLIC_R2_URL?.endsWith("/")
    ? import.meta.env.PUBLIC_R2_URL.slice(0, -1)
    : import.meta.env.PUBLIC_R2_URL;
  const key = keyname.startsWith("/") ? keyname.slice(1) : keyname;

  console.log(`[R2] Upload complete: ${baseUrl}/${key}`);
  return `${baseUrl}/${key}`;
}

export async function deleteFromR2(keyname: string): Promise<void> {
  try {
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: keyname }),
    );
  } catch (err) {
    console.error(`[R2] Delete failed for ${keyname}:`, err);
    throw err;
  }
}
