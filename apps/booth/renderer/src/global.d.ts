/// <reference types="vite/client" />

import {
  CameraStatePayload,
  CameraLiveFrame,
  CameraCaptureResult,
} from '@photo-booth/types';

export interface IElectronAPICamera {
  getStatus: () => Promise<CameraStatePayload>;
  initialize: () => Promise<CameraStatePayload>;
  startLiveView: () => Promise<CameraStatePayload>;
  stopLiveView: () => Promise<CameraStatePayload>;
  takePicture: () => Promise<CameraCaptureResult>;
  onStatus: (callback: (payload: CameraStatePayload) => void) => () => void;
  onLiveView: (callback: (frame: CameraLiveFrame) => void) => () => void;
}

export interface IElectronAPIWindow {
  toggleFullscreen: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
}

export interface IElectronAPI {
  ping: () => Promise<string>;
  printToPDF: () => Promise<string | null>;
  window: IElectronAPIWindow;
  camera: IElectronAPICamera;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
