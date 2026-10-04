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
 *  - live view mirror  gphoto2 --set-config viewfinder=1 --stdout --capture-movie
 *  - shutter trigger   gphoto2 --set-config viewfinder=0 --wait-event=500ms
 *                      --capture-image-and-download
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
const STREAM_ARGS = ['--set-config', 'viewfinder=1', '--stdout', '--capture-movie'];
const STREAM_READY_TIMEOUT_MS = 15000;
const STREAM_STOP_GRACE_MS = 5000;
const STREAM_FORCE_KILL_TIMEOUT_MS = 2000;
const CAPTURE_EVENT_WAIT_MS = 500;
const SKIP_VIEWFINDER_DROP = process.env.CAMERA_SKIP_VIEWFINDER_DROP === '1';
/** JPEG Start-Of-Image marker (FF D8) as a byte sequence — `indexOf` needs a
 *  Buffer, not the bare number 0xffd8, which is matched as the single byte 0xd8. */
const SOI_MARKER = Buffer.from([0xff, 0xd8]);
/** Drop the frame buffer if it ever balloons (it never should). */
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;

type StatusHandler = (payload: CameraStatePayload) => void;
type LiveFrameHandler = (frame: CameraLiveFrame) => void;

interface RunOptions {
  cwd?: string;
  timeout?: number;
}

interface MovieReadyWaiter {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
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
  private capturePrepared = false;
  private restoreAfterCapture = false;

  private movieChild: ReturnType<typeof spawn> | null = null;
  private movieStopPromise: Promise<void> | null = null;
  private movieReady: MovieReadyWaiter | null = null;
  private movieStreamReady = false;
  private frameBuffer: Buffer = Buffer.alloc(0);
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
      const force = this.status === 'ERROR' || this.status === 'DISCONNECTED' || this.model === null;
      const model = await this.detect(force).catch(() => null);
      if (!model) {
        if (this.status === 'ERROR' || this.status === 'CAPTURING') {
          return false;
        }
        this.capturePrepared = false;
        this.restoreAfterCapture = false;
        this.model = null;
        this.setStatus('DISCONNECTED');
        return false;
      }
      this.model = model;
      if (this.status === 'DISCONNECTED' || this.status === 'ERROR') {
        this.setStatus('READY');
      }
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
        this.setStatus('LIVE_VIEW');
        return this.state();
      }
      const forceDetection = this.status === 'ERROR';
      this.setStatus('CONNECTING');
      try {
        await this.ensureCameraDetected(forceDetection);
        this.capturePrepared = false;
        this.restoreAfterCapture = false;
        await this.startMovieStream();
        return this.state();
      } catch (error) {
        this.setStatus('ERROR', this.describe(error));
        return this.state();
      }
    });
  }

  async stopLiveView(): Promise<CameraStatePayload> {
    return this.enqueue(async () => {
      try {
        await this.stopMovieStream();
        this.capturePrepared = false;
        this.restoreAfterCapture = false;
        this.setStatus(this.model ? 'READY' : 'DISCONNECTED');
        return this.state();
      } catch (error) {
        this.setStatus('ERROR', this.describe(error));
        return this.state();
      }
    });
  }

  async prepareCapture(): Promise<CameraStatePayload> {
    return this.enqueue(async () => {
      if (this.capturePrepared) {
        return this.state();
      }
      const startedAt = Date.now();
      try {
        await this.ensureCameraDetected();
        const restoreAfterCapture = this.movieChild !== null;
        if (this.movieChild !== null) {
          await this.stopMovieStream();
        }
        this.capturePrepared = true;
        this.restoreAfterCapture = restoreAfterCapture;
        this.setStatus(this.model ? 'READY' : 'DISCONNECTED');
        console.debug(`[camera] prepare armed in ${Date.now() - startedAt}ms`);
        return this.state();
      } catch (error) {
        this.capturePrepared = false;
        this.restoreAfterCapture = false;
        this.setStatus('ERROR', this.describe(error));
        return this.state();
      }
    });
  }

  async takePicture(): Promise<CameraCaptureResult> {
    return this.enqueue(async () => {
      this.setStatus('CAPTURING');
      const restoreLiveView = this.restoreAfterCapture || this.movieChild !== null;
      const fileName = `photo-booth-${Date.now()}.jpg`;
      const filePath = path.join(this.tmpDir, fileName);
      try {
        await this.ensureCameraDetected();
        if (this.movieChild !== null) {
          await this.stopMovieStream();
        }
        this.capturePrepared = false;
        this.restoreAfterCapture = false;
        const captureArgs = SKIP_VIEWFINDER_DROP ? [] : ['--set-config', 'viewfinder=0'];
        captureArgs.push(
          `--wait-event=${CAPTURE_EVENT_WAIT_MS}ms`,
          '--capture-image-and-download',
          '--force-overwrite',
          `--filename=${filePath}`,
        );
        const captureStartedAt = Date.now();
        await this.run(captureArgs, { timeout: 45000 });
        console.debug(`[camera] capture+download ${Date.now() - captureStartedAt}ms`);
        const buffer = await fs.readFile(filePath);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        let persistedPath = path.join(this.captureDir, fileName);
        try {
          await fs.mkdir(this.captureDir, { recursive: true });
          persistedPath = path.join(this.captureDir, fileName);
          await fs.copyFile(filePath, persistedPath);
          await fs.unlink(filePath).catch(() => undefined);
        } catch (error) {
          this.error = `Capture kept in temp only: ${this.describe(error)}`;
          this.events.emit('status', this.state());
        }
        if (restoreLiveView) {
          this.scheduleLiveViewRestore();
        } else {
          this.setStatus('READY');
        }
        return { dataUrl, filePath: persistedPath };
      } catch (error) {
        const message = this.describe(error);
        this.capturePrepared = false;
        this.restoreAfterCapture = false;
        if (restoreLiveView) {
          this.scheduleLiveViewRestore(message);
        } else {
          this.setStatus('ERROR', message);
        }
        throw error;
      }
    });
  }

  private scheduleLiveViewRestore(captureError?: string): void {
    void this.enqueue(async () => {
      const restoreStartedAt = Date.now();
      try {
        this.capturePrepared = false;
        this.restoreAfterCapture = false;
        this.setStatus('CONNECTING', captureError);
        await this.startMovieStream();
        if (captureError) {
          this.error = captureError;
          this.events.emit('status', this.state());
        }
        console.debug(`[camera] live view restored in ${Date.now() - restoreStartedAt}ms`);
      } catch (error) {
        const message = this.describe(error);
        this.setStatus('ERROR', captureError ? `${captureError} Live View restore failed: ${message}` : message);
      }
    }).catch(() => undefined);
  }

  dispose(): void {
    void this.stopMovieStream().catch(() => this.movieChild?.kill('SIGKILL'));
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
      return process.platform === 'win32'
        ? 'The gphoto2 executable was not found. Install a gphoto2 Windows build and point the booth at it with GPHOTO2_PATH (or place gphoto2.exe in resources/bin).'
        : 'The gphoto2 executable was not found. Install the gphoto2 package or point the booth at it with GPHOTO2_PATH.';
    }
    return message;
  }

  private async ensureCameraDetected(force = false): Promise<void> {
    const shouldForce = force || this.status === 'ERROR' || this.status === 'DISCONNECTED';
    const model = shouldForce ? await this.detect(true) : this.model ?? (await this.detect());
    if (!model) {
      throw new Error('No camera detected over USB/PTP. Is the camera powered on and connected?');
    }
    this.model = model;
  }

  private async detect(force = false): Promise<string | null> {
    if (!force && Date.now() - this.lastDetectAt < 3000 && this.model !== null) {
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
      this.model = null;
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
  private startMovieStream(): Promise<void> {
    if (this.movieChild !== null) {
      if (this.movieReady !== null) {
        return this.movieReady.promise;
      }
      if (this.movieStreamReady) {
        if (this.status === 'CONNECTING') {
          this.setStatus('LIVE_VIEW');
        }
        return Promise.resolve();
      }
      return this.stopMovieStream().then(() => this.startMovieStream());
    }
    if (this.movieStopPromise !== null) {
      return this.movieStopPromise.then(() => this.startMovieStream());
    }

    this.movieStreamReady = false;
    this.frameBuffer = Buffer.alloc(0);
    let resolveReady: () => void = () => undefined;
    let rejectReady: (error: Error) => void = () => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const waiter: MovieReadyWaiter = { promise, resolve: resolveReady, reject: rejectReady };
    this.movieReady = waiter;
    const failReady = (error: Error) => {
      if (this.movieReady !== waiter) {
        return;
      }
      if (waiter.timer) {
        clearTimeout(waiter.timer);
      }
      this.movieReady = null;
      waiter.reject(error);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(this.binary, STREAM_ARGS, {
        cwd: this.tmpDir,
        windowsHide: true,
        env: this.spawnEnv(),
      });
    } catch (error) {
      failReady(new Error(this.describe(error)));
      return promise;
    }
    this.movieChild = child;

    let stderrTail = '';
    child.stdout?.on('data', (chunk: Buffer) => this.handleStreamData(chunk));
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2000);
    });
    child.on('error', (error) => {
      if (this.movieChild !== child) {
        return;
      }
      this.movieChild = null;
      this.movieStreamReady = false;
      this.frameBuffer = Buffer.alloc(0);
      const detail = stderrTail.trim().split('\n').slice(-2).join(' · ');
      const message = new Error(detail || this.describe(error));
      failReady(message);
      this.setStatus('ERROR', message.message);
    });
    child.on('close', () => {
      if (this.movieChild !== child) {
        return;
      }
      this.movieChild = null;
      this.movieStreamReady = false;
      this.frameBuffer = Buffer.alloc(0);
      const detail = stderrTail.trim().split('\n').slice(-2).join(' · ');
      failReady(new Error(detail || 'Live View stopped before delivering a frame.'));
      if (this.movieStopPromise !== null) {
        return;
      }
      if (this.status === 'LIVE_VIEW' || this.status === 'CONNECTING') {
        this.setStatus(
          'ERROR',
          detail || 'Live view stream stopped unexpectedly. Replug the camera and tap Retry.',
        );
      }
    });
    waiter.timer = setTimeout(() => {
      const error = new Error('Live View did not deliver a frame from gphoto2.');
      failReady(error);
      void this.stopMovieStream().catch(() => this.movieChild?.kill('SIGKILL'));
    }, STREAM_READY_TIMEOUT_MS);
    return promise;
  }

  private stopMovieStream(): Promise<void> {
    if (this.movieStopPromise !== null) {
      return this.movieStopPromise;
    }
    const child = this.movieChild;
    this.movieStreamReady = false;
    this.frameBuffer = Buffer.alloc(0);
    if (!child) {
      return Promise.resolve();
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      this.movieChild = null;
      return Promise.resolve();
    }

    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    let rejectStop: ((reason?: unknown) => void) | undefined;
    let resolveStop: (() => void) | undefined;

    const cleanup = () => {
      if (graceTimer) {
        clearTimeout(graceTimer);
      }
      if (forceTimer) {
        clearTimeout(forceTimer);
      }
      child.off('close', onClose);
    };
    const abort = (error: unknown) => {
      cleanup();
      if (this.movieChild === child) {
        this.movieChild = null;
      }
      if (this.movieStopPromise === stopPromise) {
        this.movieStopPromise = null;
      }
      rejectStop?.(error);
    };
    const onClose = () => {
      cleanup();
      if (this.movieChild === child) {
        this.movieChild = null;
      }
      if (this.movieStopPromise === stopPromise) {
        this.movieStopPromise = null;
      }
      resolveStop?.();
    };

    const stopPromise = new Promise<void>((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
      child.once('close', onClose);
    });
    this.movieStopPromise = stopPromise;

    const graceTimer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) {
        onClose();
        return;
      }
      try {
        child.kill('SIGKILL');
      } catch (error) {
        abort(this.describe(error));
        return;
      }
      forceTimer = setTimeout(() => {
        abort(new Error('Live View process did not exit; capture was not started.'));
      }, STREAM_FORCE_KILL_TIMEOUT_MS);
    }, STREAM_STOP_GRACE_MS);

    try {
      child.kill(process.platform === 'win32' ? 'SIGTERM' : 'SIGINT');
    } catch (error) {
      abort(this.describe(error));
      return stopPromise;
    }

    return stopPromise;
  }

  private resolveMovieReady(): void {
    const waiter = this.movieReady;
    if (waiter === null) {
      return;
    }
    if (waiter.timer) {
      clearTimeout(waiter.timer);
    }
    this.movieReady = null;
    this.movieStreamReady = true;
    waiter.resolve();
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
      this.frameBuffer = this.frameBuffer.subarray(this.frameBuffer.indexOf(SOI_MARKER));
      return;
    }

    let nextSof = this.frameBuffer.indexOf(SOI_MARKER, 1);
    while (nextSof !== -1) {
      const frame = this.frameBuffer.subarray(0, nextSof);
      this.frameBuffer = this.frameBuffer.subarray(nextSof);
      this.emitFrame(frame);
      nextSof = this.frameBuffer.indexOf(SOI_MARKER, 1);
    }
  }

  private emitFrame(frame: Buffer): void {
    if (this.status !== 'CONNECTING' && this.status !== 'LIVE_VIEW') {
      return;
    }
    if (this.status === 'CONNECTING') {
      this.setStatus('LIVE_VIEW');
    }
    this.events.emit('liveview', {
      frame,
      timestamp: Date.now(),
    });
    this.resolveMovieReady();
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

  /**
   * A relocated MSYS2 gphoto2.exe embeds the build machine's lib dirs (e.g.
   * D:/M/msys64/...) and fails to find its camlibs/iolibs unless CAMLIBS and
   * IOLIBS are set. When the exe sits at <root>/mingw64/bin/gphoto2.exe, the
   * libs live in <root>/mingw64/lib and can be derived automatically — unless
   * the caller already provided explicit values.
   */
  private spawnEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      LANG: process.env.LANG ?? 'C',
      LC_ALL: process.env.LC_ALL ?? 'C',
    };
    if (process.platform === 'win32' && path.isAbsolute(this.binary)) {
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
    const executableName = process.platform === 'win32' ? 'gphoto2.exe' : 'gphoto2';
    const candidates = [
      process.env.GPHOTO2_PATH,
      path.join(app.getAppPath(), '..', 'resources', 'bin', executableName),
      path.join(app.getAppPath(), 'resources', 'bin', executableName),
      process.platform === 'win32' ? 'C:/msys64/mingw64/bin/gphoto2.exe' : '/usr/bin/gphoto2',
      process.platform === 'win32' ? executableName : '/usr/local/bin/gphoto2',
      executableName,
    ].filter((value): value is string => Boolean(value));
    for (const candidate of candidates) {
      const isPath = candidate.includes('/') || candidate.includes('\\') || path.isAbsolute(candidate);
      if (!isPath || existsSync(candidate)) {
        return candidate;
      }
    }
    return executableName;
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