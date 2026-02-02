import React from 'react';
import { IKContext } from 'imagekit-react';
import { imageKitConfig } from '../lib/imagekit';

interface ImageKitProviderProps {
  children: React.ReactNode;
}

export default function ImageKitProvider({ children }: ImageKitProviderProps) {
  return (
    <IKContext
      publicKey={imageKitConfig.publicKey}
      urlEndpoint={imageKitConfig.urlEndpoint}
      authenticationEndpoint={imageKitConfig.authenticationEndpoint}
      transformationPosition="path"
    >
      {children}
    </IKContext>
  );
}