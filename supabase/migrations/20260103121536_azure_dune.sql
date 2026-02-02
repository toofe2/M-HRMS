/*
  # Fix Storage RLS Policies for Profile Images Upload

  1. Storage Bucket Setup
    - Ensure profile-images bucket exists and is properly configured
    - Set bucket to public for read access

  2. Storage Policies
    - Allow authenticated users to insert/upload to their own folder
    - Allow public read access for viewing images
    - Allow users to update/delete their own images
    - Use proper path-based security

  3. Security
    - Users can only upload to folders matching their user ID
    - Public read access for displaying profile images
    - Users can only modify their own uploaded files
*/

-- Ensure the storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images', 
  'profile-images', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;

-- Allow authenticated users to upload profile images to their own folder
CREATE POLICY "Enable upload for authenticated users to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all profile images
CREATE POLICY "Enable read access for all users"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Allow users to update their own profile images
CREATE POLICY "Enable update for users on own images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own profile images
CREATE POLICY "Enable delete for users on own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);