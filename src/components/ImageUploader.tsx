// src/components/ImageUploader.tsx
import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';

interface ImageUploaderProps {
  onSuccess: (result: { url: string; path: string }) => void;
  onError: (error: string) => void;
  maxSize?: number; // MB
  acceptedTypes?: string[];
  className?: string;
  children?: React.ReactNode;
}

export default function ImageUploader({
  onSuccess,
  onError,
  maxSize = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  className = '',
  children,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported. Please use: ${acceptedTypes.join(', ')}`;
    }
    if (file.size > maxSize * 1024 * 1024) {
      return `File size must be less than ${maxSize}MB`;
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { uploadProfileImage } = await import('../lib/imageUpload');
      const { user } = await import('../store/authStore').then((m) => m.useAuthStore.getState());

      if (!user?.id) throw new Error('User not authenticated');

      const result = await uploadProfileImage(file, user.id);
      onSuccess(result);
    } catch (error: any) {
      onError(error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const err = validateFile(file);
    if (err) return onError(err);

    uploadFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const err = validateFile(file);
    if (err) return onError(err);

    uploadFile(file);
  };

  return (
    <div className={`relative ${className}`}>
      {children ? (
        <div onClick={() => fileInputRef.current?.click()}>{children}</div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <p className="text-sm text-gray-600">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-500">
                Max {maxSize}MB • {acceptedTypes.map((t) => t.split('/')[1]).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
