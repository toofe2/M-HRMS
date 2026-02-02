import ImageKit from 'imagekit-javascript';

// ImageKit configuration
export const imageKitConfig = {
  publicKey: 'public_zljDhFQ5HMKpGPfR6OIHVMosJZs=',
  urlEndpoint: 'https://ik.imagekit.io/akh0o8q59',
  authenticationEndpoint: '/api/imagekit-auth', // We'll create this endpoint
};

// Initialize ImageKit
export const imagekit = new ImageKit({
  publicKey: imageKitConfig.publicKey,
  urlEndpoint: imageKitConfig.urlEndpoint,
  authenticationEndpoint: imageKitConfig.authenticationEndpoint,
});

// Helper function to get optimized image URL
export const getOptimizedImageUrl = (
  path: string,
  transformations?: Array<{ [key: string]: string | number }>
) => {
  if (!path) return null;
  
  const url = new URL(path, imageKitConfig.urlEndpoint);
  
  if (transformations && transformations.length > 0) {
    const transformString = transformations
      .map(transform => 
        Object.entries(transform)
          .map(([key, value]) => `${key}-${value}`)
          .join(',')
      )
      .join('/');
    
    url.pathname = `/tr:${transformString}${url.pathname}`;
  }
  
  return url.toString();
};

// Helper function to upload image
export const uploadImage = async (
  file: File,
  fileName: string,
  folder?: string
): Promise<{ url: string; fileId: string }> => {
  return new Promise((resolve, reject) => {
    imagekit.upload({
      file,
      fileName,
      folder: folder || 'profile-images',
      useUniqueFileName: true,
    }, (error, result) => {
      if (error) {
        reject(error);
      } else if (result) {
        resolve({
          url: result.url,
          fileId: result.fileId,
        });
      } else {
        reject(new Error('Upload failed'));
      }
    });
  });
};

// Helper function to delete image
export const deleteImage = async (fileId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    imagekit.deleteFile(fileId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};