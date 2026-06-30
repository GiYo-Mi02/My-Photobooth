import { ensureCloudinary, uploadImageBuffer } from './lib/cloudinary.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const cloudinaryInstance = ensureCloudinary();
  if (!cloudinaryInstance) {
    console.error("Cloudinary not configured");
    return;
  }
  
  const dummyBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );
  
  const testSessionId = 'test_retry_' + Date.now();
  const tag = `gpix-${testSessionId}`;
  
  console.log(`Uploading 3 frames for tag: ${tag}...`);
  for (let i = 0; i < 3; i++) {
    await uploadImageBuffer(dummyBuffer, {
      tags: [tag],
      public_id: `gpix-${testSessionId}-frame-${i}`,
      folder: `giopix/sessions/${testSessionId}`,
      overwrite: true,
    });
  }
  
  console.log("Uploaded. Starting multi-compile retry loop...");
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Attempt ${attempts}/${maxAttempts}...`);
    try {
      const gifResult = await cloudinaryInstance.uploader.multi(tag, {
        format: "gif",
        delay: 800,
      });
      console.log(`Attempt ${attempts} result: bytes = ${gifResult.bytes}, pages = ${gifResult.pages}`);
      
      if (gifResult.bytes > 1000 || gifResult.pages > 1) {
        console.log("SUCCESS! Valid GIF generated:", gifResult.secure_url);
        break;
      } else {
        console.log("GIF is empty (tag not indexed yet). Sleeping 1.5 seconds...");
        await sleep(1500);
      }
    } catch (e) {
      console.error(`Attempt ${attempts} failed with error:`, e.message);
      await sleep(1500);
    }
  }
}

run().catch(console.error);
