import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// PWA viewport height fix for iOS
const setAppHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};

// Handle both resize and orientation change
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => {
  // Small delay to ensure new dimensions are available
  setTimeout(setAppHeight, 100);
});

setAppHeight();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);