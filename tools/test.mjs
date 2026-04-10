import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2NjYsImV4cCI6MjA4NjkxOTY2Nn0.1qyGb91CbLeSRNWKUNGiToJYGr8lsI-DeddWTnMv3SY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUpload() {
  const testFile = 'public/Images/marketplace-hero.jpg';
  if (!fs.existsSync(testFile)) {
     console.error("Test file does not exist in", process.cwd());
     return;
  }
  
  const buffer = fs.readFileSync(testFile);
  
  console.log("Ensuring bucket 'product-images' exists...");
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.find(b => b.name === 'product-images');
  if (!bucketExists) {
      console.log("Bucket not found, trying to create...");
      const { data, error: createError } = await supabase.storage.createBucket('product-images', { public: true });
      if (createError) {
          console.error("Failed to create bucket (probably RLS or need service role):", createError.message);
          return;
      }
      console.log("Created bucket", data);
  } else {
      console.log("Bucket already exists.");
  }

  console.log("Trying to upload file...");
  const { data, error } = await supabase.storage.from('product-images').upload('test-upload.jpg', buffer, {
      contentType: 'image/jpeg',
      upsert: true
  });
  
  if (error) {
      console.error("Upload failed (probably RLS policy needed):", error.message);
  } else {
      console.log("Upload succeeded!", data);
  }
}

testUpload();
