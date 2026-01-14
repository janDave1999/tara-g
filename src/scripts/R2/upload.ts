import type { R2Bucket } from '@cloudflare/workers-types';

export async function uploadToR2(
  fileBuffer: Buffer, 
  fileName: string, 
  contentType: string, 
  keyname: string,
  r2Bucket: any // Now TypeScript knows what this is
) {
  // Validate inputs
  if (!fileBuffer || fileBuffer.length === 0) {
    console.error("uploadToR2 called with empty file buffer");
    throw new Error("File buffer is empty");
  }
  if (!keyname) {
    console.error("uploadToR2 called with empty key name");
    throw new Error("Key name is required");
  }

  console.log("uploadToR2 called with", { fileName, contentType, keyname });

  try {
    // Use the R2 binding's put method directly
    console.log(`Uploading ${fileName} to R2 with key name ${keyname}`);
    await r2Bucket.put(keyname, fileBuffer, {
      httpMetadata: {
        contentType: contentType,
      },
    });

    console.log(`Successfully uploaded ${fileName} to R2`);

    // Return the public URL
    const baseUrl = import.meta.env.PUBLIC_R2_URL.endsWith('/') 
      ? import.meta.env.PUBLIC_R2_URL.slice(0, -1) 
      : import.meta.env.PUBLIC_R2_URL;
    const key = keyname.startsWith('/') 
      ? keyname.slice(1) 
      : keyname;

    console.log(`Returning public URL for ${fileName}: ${baseUrl}/${key}`);

    return `${baseUrl}/${key}`;
  } catch (err) {
    console.error(`Error uploading ${fileName} to R2:`, err);
    
    if (err instanceof Error) {
      throw new Error(`Failed to upload ${fileName} to R2: ${err.message}`);
    }
    throw new Error(`Failed to upload ${fileName} to R2: Unknown error`);
  }
}
