// src/lib/imageUpload.ts
import { supabase } from './supabase';

export interface UploadProfileImageResult {
  url: string;
  path: string;
}

export async function uploadProfileImage(file: File, userId: string): Promise<UploadProfileImageResult> {
  if (!file) throw new Error('No file selected');
  if (!userId) throw new Error('User is not authenticated');

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const safeExt = fileExt.replace(/[^a-z0-9]/gi, '') || 'png';
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/png',
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error(uploadError.message || 'Failed to upload image');
  }

  const { data } = supabase.storage.from('profile-images').getPublicUrl(filePath);

  return {
    url: data.publicUrl,
    path: filePath,
  };
}

export async function deleteProfileImage(path: string) {
  if (!path) return;

  const { error } = await supabase.storage.from('profile-images').remove([path]);

  if (error) {
    console.error('Delete image error:', error);
    throw new Error(error.message || 'Failed to remove image');
  }
}
