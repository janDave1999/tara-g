import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/cf_s3_client";
import { PUBLIC_R2_BUCKET,  } from "astro:env/server";
import { PUBLIC_R2_URL } from "astro:env/client";
export async function uploadToR2(fileBuffer: Buffer, fileName: string, contentType: string, keyname: string) {
  console.log("uploadToR2 called with", { fileName, contentType });

  const command = new PutObjectCommand({
    Bucket: PUBLIC_R2_BUCKET,
    Key: keyname,
    Body: fileBuffer,
    ContentType: contentType,
  });

  console.log("Sending command to R2:", command);

  try {
    await r2.send(command);

    console.log("Successfully uploaded to R2:", fileName);

    return `${PUBLIC_R2_URL}/${keyname}`;
  } catch (err) {
    console.error("Error uploading to R2:", err);

    throw err;
  }
}
