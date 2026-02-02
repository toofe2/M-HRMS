/*
  # Fix Storage RLS Policies for Profile Images

  1. Storage Policies
    - Create policy to allow authenticated users to upload profile images
    - Create policy to allow authenticated users to view profile images
    - Create policy to allow users to update their own profile images
    - Create policy to allow users to delete their own profile images

  2. Security
    - Users can only upload to their own folder (user ID based path)
    - Users can view all profile images (for displaying other users' avatars)
    - Users can only modify/delete their own images
*/

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload profile images to their own folder
CREATE POLICY "Users can upload their own profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view profile images (public read access)
CREATE POLICY "Anyone can view profile images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Allow users to update their own profile images
CREATE POLICY "Users can update their own profile images"
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
CREATE POLICY "Users can delete their own profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);