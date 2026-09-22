import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { startUploadWatcher } from './lib/uploadJob';
import './index.css';

// Owns background gallery uploads independently of any mounted screen, so they
// keep running after the customer leaves the session (store-level, not React).
startUploadWatcher();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service workers are unavailable on file:// (Electron) - safe to ignore.
    });
  });
}
