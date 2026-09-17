/// <reference types="vite/client" />

import {
  CameraStatePayload,
  CameraLiveFrame,
  CameraCaptureResult,
} from '@photo-booth/types';

export interface IElectronAPICamera {
  available: () => Promise<boolean>;
  getStatus: () => Promise<CameraStatePayload>;
  initialize: () => Promise<CameraStatePayload>;
  startLiveView: () => Promise<CameraStatePayload>;
  stopLiveView: () => Promise<CameraStatePayload>;
  takePicture: () => Promise<CameraCaptureResult>;
  onStatus: (callback: (payload: CameraStatePayload) => void) => () => void;
  onLiveView: (callback: (frame: CameraLiveFrame) => void) => () => void;
  mjpeg: IElectronAPIMjpeg;
}

export interface IElectronAPIMjpeg {
  get: () => Promise<{ running: boolean; port: number }>;
  start: () => Promise<{ running: boolean; port: number }>;
  stop: () => Promise<{ running: boolean; port: number }>;
}

export interface IElectronAPIWindow {
  toggleFullscreen: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
}

export interface IElectronAPI {
  ping: () => Promise<string>;
  printToPDF: () => Promise<string | null>;
  saveFile: (fileName: string, dataUrl: string) => Promise<string | null>;
  window: IElectronAPIWindow;
  camera: IElectronAPICamera;
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    electronAPI: IElectronAPI;
  }
}
