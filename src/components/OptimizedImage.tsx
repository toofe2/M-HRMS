import React from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
  onError?: () => void;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  loading = 'lazy',
  onError,
}: OptimizedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      onError={onError}
    />
  );
}