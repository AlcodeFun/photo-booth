declare module '@brick-a-brack/napi-canon-cameras' {
  export type PropertyValue = number | { value: number } | string;

  export interface PropertiesData {
    [key: string]: unknown;
  }

  export class LiveViewImage {
    getDataURL(): string;
  }

  export class CameraFile {
    name: string;
    size: number;
    downloadToPath(path: string): string;
    downloadToFile(fileName: string): string;
    downloadToString(): string;
    downloadThumbnailToString(): string;
  }

  export interface CameraDeviceEvent {
    camera: Camera;
  }

  export interface DownloadRequestEvent extends CameraDeviceEvent {
    file: CameraFile;
  }

  export interface StateChangeEvent extends CameraDeviceEvent {
    stateEvent: unknown;
  }

  export interface ObjectChangeEvent extends CameraDeviceEvent {
    objectEvent: unknown;
  }

  export type EventCallback = (eventName: string, event: unknown) => void;

  export class CameraBrowser {
    static readonly EventName: Record<string, string>;
    setEventHandler(listener: EventCallback): void;
    initialize(): void;
    terminate(): void;
    triggerEvents(): void;
    getCamera(at?: string | number, exactOnly?: boolean): Camera;
    getCameras(): Camera[];
    update(): void;
  }

  export class Camera {
    static readonly EventName: Record<string, string>;
    static readonly Command: Record<string, number>;
    static readonly PressShutterButton: Record<string, number>;
    readonly description: string;
    readonly portName: string;
    connect(shouldKeepAlive?: boolean): void;
    disconnect(): void;
    getProperty(propertyID: string | number, specifier?: number): { value: PropertyValue };
    setProperty(propertyID: string | number, value: PropertyValue): void;
    setProperties(properties: PropertiesData): void;
    sendCommand(command: number, parameter?: number): void;
    takePicture(): void;
    isLiveViewActive(): boolean;
    startLiveView(): void;
    stopLiveView(): void;
    getLiveViewImage(): LiveViewImage;
    getVolumes(): unknown[];
  }

  export class CameraProperty {
    static readonly ID: Record<string, number>;
    static readonly PropertySpecifier: Record<string, number>;
  }

  export class Option {
    static readonly SaveTo: Record<string, number>;
    static readonly WhiteBalance: Record<string, number>;
  }

  export class ImageQuality {
    static readonly ID: Record<string, number>;
  }

  export const cameraBrowser: CameraBrowser;
  export function watchCameras(timeout?: number): () => void;
}
