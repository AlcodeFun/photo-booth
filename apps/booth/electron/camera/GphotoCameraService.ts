import { execFile, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, mkdtempSync, promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { app } from 'electron';
import {
  CameraCaptureResult,
  CameraLiveFrame,
  CameraStatePayload,
  CameraStatus,
} from '@photo-booth/types';

/**
 * Tethers a Canon EOS camera over USB/PTP by driving the `gphoto2` command line
 * (libgphoto2) as a subprocess. It touches no proprietary SDK: the Canon EOS 600D
 * and friends expose PTP capture + LiveView, which gphoto2 exposes via:
 *
 *  - detect            gphoto2 --auto-detect
 *  - live view mirror  gphoto2 --stdout --capture-movie   (continuous MJPEG stream)
 *  - shutter trigger   gphoto2 --set-config viewfinder=0 && --capture-image-and-download
 *
 * The live view is a true mirror: LiveView is engaged once and frames are streamed
 * and rendered in memory only — nothing is recorded, and the shutter is never
 * re-triggered to serve the preview. A full-res photo is taken exactly once, on
 * demand (button press); the stream pauses for that moment. Each successful
 * capture is persisted at full resolution under the user's Pictures folder
 * (Pictures\Photo Booth) so the original is never lost.
 *
 * On Windows the camera must be bound to the WinUSB/libusbK driver (Zadig) and the
 * gphoto2 Windows build must be reachable via GPHOTO2_PATH / PATH / resources/bin.
 */

const DETECT_RE = /^(.{1,48}?)\s+(usb|serial|ptpip):/m;
const STREAM_ARGS = ['--stdout', '--capture-movie'];
/** Throttle how often a decoded frame is forwarded to the renderer. */
const FRAME_EMIT_INTERVAL_MS = 120;
/** Drop the frame buffer if it ever balloons (it never should). */
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;

type StatusHandler = (payload: CameraStatePayload) => void;
type LiveFrameHandler = (frame: CameraLiveFrame) => void;

interface RunOptions {
  cwd?: string;
  timeout?: number;
}

export class GphotoCameraService {
  private readonly events = new EventEmitter();
  private readonly tmpDir: string;
  private readonly captureDir: string;
  private readonly binary: string;

  private status: CameraStatus = 'DISCONNECTED';
  private error: string | undefined;
  private model: string | null = null;
  private lastDetectAt = 0;

  private movieChild: ReturnType<typeof spawn> | null = null;
  private frameBuffer: Buffer = Buffer.alloc(0);
  private lastFrameEmitAt = 0;
  private tail: Promise<unknown> = Promise.resolve();

  constructor() {
    this.tmpDir = mkdtempSync(path.join(os.tmpdir(), 'photo-booth-camera-'));
    this.captureDir = path.join(app.getPath('pictures'), 'Photo Booth');
    this.binary = this.resolveBinary();
  }

  // --- public API (used by the IPC handlers) -------------------------------

  onStatus(handler: StatusHandler): () => void {
    this.events.on('status', handler);
    return () => this.events.off('status', handler);
  }

  onLiveView(handler: LiveFrameHandler): () => void {
    this.events.on('liveview', handler);
    return () => this.events.off('liveview', handler);
  }

  /** True when a capable gphoto2 binary + camera are present right now. */
  isAvailable(): Promise<boolean> {
    return this.enqueue(async () => {
      if (this.status === 'ERROR') {
        return false;
      }
      const model = await this.detect().catch(() => null);
      if (!model) {
        this.setStatus('DISCONNECTED');
        return false;
      }
      this.model = model;
      this.setStatus(this.status === 'LIVE_VIEW' ? 'LIVE_VIEW' : 'READY');
      return true;
    });
  }

  async getStatus(): Promise<CameraStatePayload> {
    return this.isAvailable().then(() => this.state());
  }

  async initialize(): Promise<CameraStatePayload> {
    return this.isAvailable().then(() => this.state());
  }

  async startLiveView(): Promise<CameraStatePayload> {
    return this.enqueue(async () => {
      if (this.status === 'LIVE_VIEW' && this.movieChild !== null) {
        return this.state();
      }
      this.setStatus('CONNECTING');
      try {
        await this.ensureCameraDetected();
        await this.run(['--set-config', 'viewfinder=1'], { timeout: 10000 }).catch(() => undefined);
        this.setStatus('LIVE_VIEW');
        this.startMovieStream();
        return this.state();
      } catch (error) {
        this.setStatus('ERROR', this.describe(error));
        return this.state();
      }
    });
  }

  async stopLiveView(): Promise<CameraStatePayload> {
    return this.enqueue(async () => {
      this.stopMovieStream();
      if (this.status === 'LIVE_VIEW') {
        await this.run(['--set-config', 'viewfinder=0'], { timeout: 10000 }).catch(() => undefined);
      }
      this.setStatus(this.model ? 'READY' : 'DISCONNECTED');
      return this.state();
    });
  }

  async takePicture(): Promise<CameraCaptureResult> {
    return this.enqueue(async () => {
      this.setStatus('CAPTURING');
      const wasLiveView = this.movieChild !== null;
      const fileName = `photo-booth-${Date.now()}.jpg`;
      try {
        await this.ensureCameraDetected();
        if (wasLiveView) {
          this.stopMovieStream();
          await this.sleep(300);
        }
        await this.run(['--set-config', 'viewfinder=0'], { timeout: 10000 }).catch(() => undefined);
        await this.sleep(250);
        await this.run(['--capture-image-and-download', `--filename=${fileName}`], { timeout: 30000 });
        const buffer = await fs.readFile(path.join(this.tmpDir, fileName));
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        let filePath = path.join(this.tmpDir, fileName);
        try {
          await fs.mkdir(this.captureDir, { recursive: true });
          filePath = path.join(this.captureDir, fileName);
          await fs.copyFile(path.join(this.tmpDir, fileName), filePath);
          await fs.unlink(path.join(this.tmpDir, fileName)).catch(() => undefined);
        } catch (error) {
          this.error = `Capture kept in temp only: ${this.describe(error)}`;
          this.events.emit('status', this.state());
        }
        if (wasLiveView) {
          await this.run(['--set-config', 'viewfinder=1'], { timeout: 10000 }).catch(() => undefined);
          this.setStatus('LIVE_VIEW');
          this.startMovieStream();
        } else {
          this.setStatus('READY');
        }
        return { dataUrl, filePath };
      } catch (error) {
        const message = this.describe(error);
        if (wasLiveView) {
          this.startMovieStream();
          this.setStatus('LIVE_VIEW');
          this.error = message;
          this.events.emit('status', this.state());
        } else {
          this.setStatus('ERROR', message);
        }
        throw error;
      }
    });
  }

  dispose(): void {
    this.stopMovieStream();
    this.events.removeAllListeners();
  }

  // --- internals -----------------------------------------------------------

  private state(): CameraStatePayload {
    return {
      status: this.status,
      info: {
        model: this.model,
        connected: this.status === 'READY' || this.status === 'LIVE_VIEW' || this.status === 'CAPTURING',
      },
      error: this.error,
    };
  }

  private setStatus(status: CameraStatus, error?: string): void {
    this.status = status;
    this.error = error;
    this.events.emit('status', this.state());
  }

  private describe(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      return (
        'The gphoto2 executable was not found. Install a gphoto2 Windows build and point the booth ' +
        'at it with the GPHOTO2_PATH environment variable (or place gphoto2.exe in resources/bin).'
      );
    }
    return message;
  }

  private async ensureCameraDetected(): Promise<void> {
    const model = this.model ?? (await this.detect());
    if (!model) {
      throw new Error('No camera detected over USB/PTP. Is the camera powered on and connected?');
    }
    this.model = model;
  }

  private async detect(): Promise<string | null> {
    if (Date.now() - this.lastDetectAt < 3000 && this.model !== null) {
      return this.model;
    }
    this.lastDetectAt = Date.now();
    try {
      const out = await this.run(['--auto-detect'], { timeout: 15000 });
      const match = out.match(DETECT_RE);
      const model = match ? match[1].trim() : null;
      if (model !== this.model) {
        this.model = model;
      }
      return model;
    } catch (error) {
      if (/ENOENT/i.test(error instanceof Error ? error.message : String(error))) {
        throw new Error(this.describe(error));
      }
      if (this.status === 'CONNECTING' || this.status === 'CAPTURING') {
        throw new Error('gphoto2 could not reach the camera over USB/PTP.');
      }
      return null;
    }
  }

  /**
   * Engages the live stream. With `--stdout --capture-movie` the Canon keeps its
   * LiveView engaged and pushes frames continuously — we only forward them to the
   * renderer, never persist them, so the mirror never grows a file or re-triggers.
   */
  private startMovieStream(): void {
    if (this.movieChild !== null) {
      return;
    }
    this.frameBuffer = Buffer.alloc(0);
    const child = spawn(this.binary, STREAM_ARGS, {
      cwd: this.tmpDir,
      windowsHide: true,
      env: this.spawnEnv(),
    });
    this.movieChild = child;

    let stderrTail = '';
    child.stdout?.on('data', (chunk: Buffer) => this.handleStreamData(chunk));
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2000);
    });
    child.on('error', () => undefined);
    child.on('exit', () => {
      if (this.movieChild !== child) {
        return;
      }
      this.movieChild = null;
      if (this.status === 'LIVE_VIEW') {
        this.setStatus(
          'ERROR',
          'Live view stream stopped unexpectedly. Replug the camera and tap Retry.',
        );
        if (stderrTail.trim()) {
          this.error = stderrTail.trim().split('\n').slice(-2).join(' · ');
        }
      }
    });
  }

  private stopMovieStream(): void {
    const child = this.movieChild;
    this.movieChild = null;
    this.frameBuffer = Buffer.alloc(0);
    if (child && !child.killed) {
      child.kill();
    }
  }

  /**
   * The Canon EOS LiveView stream is concatenated JPEG frames plus inter-frame
   * padding/capsule data (which itself can contain FF D8 / FF D9 bytes), so we
   * split on SOI markers: each real frame runs from its FF D8 up to the next
   * frame's FF D8. Anything trailing after a frame's EOI is harmless for
   * rendering and is dropped with the next split.
   */
  private handleStreamData(chunk: Buffer): void {
    this.frameBuffer = this.frameBuffer.length ? Buffer.concat([this.frameBuffer, chunk]) : chunk;
    if (this.frameBuffer.length > MAX_BUFFER_BYTES) {
      this.frameBuffer = this.frameBuffer.subarray(this.frameBuffer.indexOf(0xffd8));
      return;
    }

    let nextSof = this.frameBuffer.indexOf(0xffd8, 1);
    while (nextSof !== -1) {
      const frame = this.frameBuffer.subarray(0, nextSof);
      this.frameBuffer = this.frameBuffer.subarray(nextSof);
      this.emitFrame(frame);
      nextSof = this.frameBuffer.indexOf(0xffd8, 1);
    }
  }

  private emitFrame(frame: Buffer): void {
    if (this.status !== 'LIVE_VIEW') {
      return;
    }
    const now = Date.now();
    if (now - this.lastFrameEmitAt < FRAME_EMIT_INTERVAL_MS) {
      return;
    }
    this.lastFrameEmitAt = now;
    this.events.emit('liveview', {
      dataUrl: `data:image/jpeg;base64,${frame.toString('base64')}`,
      timestamp: now,
    });
  }

  private run(args: string[], options: RunOptions = {}): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      execFile(
        this.binary,
        args,
        {
          cwd: options.cwd ?? this.tmpDir,
          timeout: options.timeout ?? 30000,
          windowsHide: true,
          encoding: 'utf8',
          maxBuffer: 20 * 1024 * 1024,
          env: this.spawnEnv(),
        },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            const detail = (stderr || '').trim() || error.message;
            const wrapped = new Error(`${this.binary} failed: ${detail}`);
            if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
              wrapped.message = 'ENOENT';
            }
            reject(wrapped);
            return;
          }
          resolve(stdout);
        },
      );
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * A relocated MSYS2 gphoto2.exe embeds the build machine's lib dirs (e.g.
   * D:/M/msys64/...) and fails to find its camlibs/iolibs unless CAMLIBS and
   * IOLIBS are set. When the exe sits at <root>/mingw64/bin/gphoto2.exe, the
   * libs live in <root>/mingw64/lib and can be derived automatically — unless
   * the caller already provided explicit values.
   */
  private spawnEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (path.isAbsolute(this.binary)) {
      const binDir = path.dirname(this.binary);
      const libDir = path.join(binDir, '..', 'lib');
      const iolibs = path.join(libDir, 'libgphoto2_port', '0.12.2');
      const camlibs = path.join(libDir, 'libgphoto2', '2.5.34');
      if (!env.IOLIBS && existsSync(iolibs)) {
        env.IOLIBS = iolibs;
      }
      if (!env.CAMLIBS && existsSync(camlibs)) {
        env.CAMLIBS = camlibs;
      }
    }
    return env;
  }

  private resolveBinary(): string {
    const candidates = [
      process.env.GPHOTO2_PATH,
      path.join(app.getAppPath(), '..', 'resources', 'bin', 'gphoto2.exe'),
      path.join(app.getAppPath(), 'resources', 'bin', 'gphoto2.exe'),
      'C:/msys64/mingw64/bin/gphoto2.exe',
      'gphoto2',
    ].filter((value): value is string => Boolean(value));
    for (const candidate of candidates) {
      const isPath = candidate.includes('/') || candidate.includes('\\') || path.isAbsolute(candidate);
      if (!isPath || existsSync(candidate)) {
        return candidate;
      }
    }
    return 'gphoto2';
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}