// src/lib/imageUpload.ts
import { supabase } from './supabase';

export interface UploadResult {
  url: string;
  path: string;
}

export const uploadProfileImage = async (file: File, userId: string): Promise<UploadResult> => {
  try {
    if (!file.type.startsWith('image/')) throw new Error('File must be an image');
    if (file.size > 5 * 1024 * 1024) throw new Error('File size must be less than 5MB');

    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // (اختياري) تأكيد وجود session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error('User not authenticated');

    const { data, error } = await supabase.storage.from('profile-images').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from('profile-images').getPublicUrl(data.path);

    return { url: publicUrl, path: data.path };
  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error(error?.message || 'Failed to upload image');
  }
};

export const deleteProfileImage = async (path: string): Promise<void> => {
  try {
    // 🔴 مهم جداً: نظّف المسار قبل الحذف
    // Supabase يريد فقط اسم الملف داخل الـ bucket
    const cleanPath = path
      .replace(/^\/+/, '')
      .replace(/^profile-images\//, '');

    console.log('Deleting image path:', cleanPath);

    // تأكيد الجلسة (حتى يتأكد إرسال Authorization)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase.storage
      .from('profile-images')
      .remove([cleanPath]);

    if (error) throw error;
  } catch (error: any) {
    console.error('Delete error:', error);
    throw new Error(error.message || 'Failed to delete image');
  }
};
