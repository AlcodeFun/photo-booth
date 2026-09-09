import { BrowserWindow } from 'electron';
import {
  Camera,
  CameraFile,
  CameraProperty,
  ImageQuality,
  Option,
} from '@brick-a-brack/napi-canon-cameras';
import { CameraStatePayload } from '@photo-booth/types';

type CanonApi = typeof import('@brick-a-brack/napi-canon-cameras');

/**
 * Encapsulates the Canon EDSDK lifecycle (via @brick-a-brack/napi-canon-cameras)
 * and proxies live-view frames / status / captured photos to a window over IPC.
 *
 * The native addon is loaded lazily so the app can boot without a camera and
 * without requiring the SDK to be present at startup.
 */
export class CanonCameraService {
  private initialized = false;
  private camera: Camera | null = null;
  private stopWatching: (() => void) | null = null;
  private liveViewTimer: NodeJS.Timeout | null = null;
  private capturing = false;
  private api: CanonApi | null = null;
  private window: BrowserWindow | null = null;

  attachWindow(window: BrowserWindow): void {
    this.window = window;
  }

  getStatus(): CameraStatePayload {
    if (!this.initialized) {
      return { status: 'DISCONNECTED', info: { model: null, connected: false } };
    }
    const model = this.camera?.description ?? null;
    const connected = Boolean(this.camera);
    return {
      status: this.camera ? 'LIVE_VIEW' : 'DISCONNECTED',
      info: { model, connected },
    };
  }

  async initialize(): Promise<CameraStatePayload> {
    try {
      this.api = await import('@brick-a-brack/napi-canon-cameras');
    } catch (error) {
      this.emit({ status: 'ERROR', error: `Failed to load Canon SDK: ${String(error)}` });
      return { status: 'ERROR', info: { model: null, connected: false }, error: String(error) };
    }

    this.api.cameraBrowser.setEventHandler((eventName, event) => {
      this.handleEvent(eventName, event);
    });

    this.api.cameraBrowser.initialize();
    this.initialized = true;
    this.stopWatching = this.api.watchCameras(50);
    this.emit({ status: 'CONNECTING' });
    this.api.cameraBrowser.update();
    return this.getStatus();
  }

  async startLiveView(): Promise<CameraStatePayload> {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (initResult.status === 'ERROR') {
        return initResult;
      }
    }
    const camera = this.camera ?? this.api?.cameraBrowser.getCamera();
    if (!camera) {
      this.emit({ status: 'DISCONNECTED', info: { model: null, connected: false } });
      return { status: 'DISCONNECTED', info: { model: null, connected: false } };
    }
    this.camera = camera;
    try {
      camera.connect(true);
      camera.setProperties({
        [CameraProperty.ID.SaveTo]: Option.SaveTo.Host,
        [CameraProperty.ID.ImageQuality]: ImageQuality.ID.LargeJPEGFine,
      });
      if (!camera.isLiveViewActive()) {
        camera.startLiveView();
      }
      this.startLiveViewLoop(camera);
      this.emit({ status: 'LIVE_VIEW', info: { model: camera.description, connected: true } });
      return { status: 'LIVE_VIEW', info: { model: camera.description, connected: true } };
    } catch (error) {
      this.emit({ status: 'ERROR', error: String(error) });
      return { status: 'ERROR', info: { model: camera.description, connected: true }, error: String(error) };
    }
  }

  async stopLiveView(): Promise<CameraStatePayload> {
    this.stopLiveViewLoop();
    try {
      this.camera?.stopLiveView();
    } catch {
      // best effort
    }
    this.emit({ status: 'READY', info: { model: this.camera?.description ?? null, connected: Boolean(this.camera) } });
    return this.getStatus();
  }

  /**
   * Triggers the shutter and resolves with the full resolution JPEG as a data URL.
   */
  takePicture(): Promise<{ dataUrl: string }> {
    return new Promise((resolve, reject) => {
      if (this.capturing) {
        reject(new Error('Camera is already capturing.'));
        return;
      }
      const camera = this.camera;
      if (!camera) {
        reject(new Error('No camera connected.'));
        return;
      }
      this.capturing = true;
      this.emit({ status: 'CAPTURING', info: { model: camera.description, connected: true } });

      const timeout = setTimeout(() => {
        if (this.downloadHandler) {
          this.downloadHandler = null;
        }
        this.capturing = false;
        this.emit({ status: 'LIVE_VIEW', info: { model: camera.description, connected: true }, error: 'Capture timed out.' });
        reject(new Error('Capture timed out.'));
      }, 8000);

      // DownloadRequest arrives through the single browser event handler;
      // set this.downloadHandler so handleEvent can resolve the promise.
      this.downloadHandler = (eventName, event) => {
        if (eventName !== 'DownloadRequest') {
          return;
        }
        const file = (event as { file?: CameraFile }).file;
        if (!file) {
          return;
        }
        clearTimeout(timeout);
        this.downloadHandler = null;
        this.capturing = false;
        try {
          const base64 = file.downloadToString();
          const dataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
          this.emit({ status: 'LIVE_VIEW', info: { model: camera.description, connected: true } });
          resolve({ dataUrl });
        } catch (error) {
          this.emit({ status: 'ERROR', error: String(error) });
          reject(error);
        }
      };
      camera.takePicture();
    });
  }

  async dispose(): Promise<void> {
    this.stopLiveViewLoop();
    this.stopWatching?.();
    try {
      this.camera?.disconnect();
    } catch {
      // best effort
    }
    try {
      this.api?.cameraBrowser.terminate();
    } catch {
      // best effort
    }
    this.initialized = false;
    this.camera = null;
  }

  private downloadHandler: ((eventName: string, event: unknown) => void) | null = null;

  private handleEvent(eventName: string, event: unknown): void {
    const camera = this.camera;
    if (this.downloadHandler) {
      this.downloadHandler(eventName, event);
      if (eventName === 'DownloadRequest') {
        this.downloadHandler = null;
      }
    }
    if (!camera) {
      return;
    }
    switch (eventName) {
      case 'CameraDisconnect':
        this.stopLiveViewLoop();
        this.emit({ status: 'DISCONNECTED', info: { model: camera.description, connected: false } });
        break;
      case 'LiveViewStop':
        this.stopLiveViewLoop();
        this.emit({ status: 'READY', info: { model: camera.description, connected: true } });
        break;
      default:
        break;
    }
  }

  private startLiveViewLoop(camera: Camera): void {
    this.stopLiveViewLoop();
    this.liveViewTimer = setInterval(() => {
      try {
        if (!camera.isLiveViewActive()) {
          return;
        }
        const image = camera.getLiveViewImage();
        const dataUrl = image.getDataURL();
        if (!this.window || this.window.isDestroyed()) {
          return;
        }
        this.window.webContents.send('camera:liveView', { dataUrl, timestamp: Date.now() });
      } catch {
        // ignore transient live view failures
      }
    }, 66);
  }

  private stopLiveViewLoop(): void {
    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
      this.liveViewTimer = null;
    }
  }

  private emit(payload: CameraStatePayload): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('camera:status', payload);
    }
  }
}

export const canonCameraService = new CanonCameraService();
