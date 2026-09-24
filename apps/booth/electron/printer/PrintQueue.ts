import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PrinterPrintPayload, PrinterService } from './PrinterService';

/**
 * Main-process print queue.
 *
 * One job is submitted at a time (the Selphy is a slow dye-sub device), jobs
 * are tracked by their CUPS job id, and a retried job is inserted at the head
 * of the pending list so it prints as soon as the active job finishes — not at
 * the back of the queue.
 *
 * There is no automatic retry: a failed job waits for the operator. The queue
 * also stages no images on disk — when a job becomes active it asks the
 * renderer to resolve the framed image just-in-time (from IndexedDB / gallery)
 * and deletes the transient temp file as soon as `lp` accepts the job.
 */

export type PrintJobState =
  | 'pending'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface PrintJob {
  id: string;
  token?: string;
  fileName: string;
  queueName: string;
  copies?: number;
  paperSize?: string;
  mediaType?: string;
  quality?: number;
  colorMode?: 'color' | 'grayscale';
  cupsOptions?: Record<string, string>;
  state: PrintJobState;
  cupsJobId?: string;
  attempts: number;
  error?: string;
  priority?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PrintQueueSnapshot {
  jobs: PrintJob[];
  running: boolean;
  activeJobId: string | null;
}

export interface PrintEnqueueInput {
  token?: string;
  fileName?: string;
  queueName: string;
  copies?: number;
  paperSize?: string;
  mediaType?: string;
  quality?: number;
  colorMode?: 'color' | 'grayscale';
  cupsOptions?: Record<string, string>;
}

export interface PrintQueueDeps {
  service: PrinterService;
  /** Directory for the tiny jobs.json (no images are persisted). */
  storageDir: string;
  /** Pushes a fresh snapshot to the renderer. */
  emit: (snapshot: PrintQueueSnapshot) => void;
  /** Asks the renderer to resolve a job's framed image as a JPEG data URL. */
  requestImage: (job: PrintJob) => Promise<string>;
}

interface PersistedState {
  jobs: PrintJob[];
  activeIds: string[];
  running: boolean;
}

const POLL_INTERVAL_MS = 2000;
/** A job that never leaves the CUPS queue is treated as failed after this long. */
const JOB_TIMEOUT_MS = 5 * 60 * 1000;

export class PrintQueue {
  private jobs: PrintJob[] = [];
  private activeIds = new Set<string>();
  private running = false;
  private processing = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly file: string;

  constructor(private readonly deps: PrintQueueDeps) {
    this.file = path.join(deps.storageDir, 'jobs.json');
  }

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      this.jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
      this.activeIds = new Set(Array.isArray(parsed.activeIds) ? parsed.activeIds : []);
      this.running = Boolean(parsed.running);
      // Jobs that were mid-flight when the app quit can't be tracked any more.
      for (const job of this.jobs) {
        if (job.state === 'submitted' || job.state === 'processing') {
          job.state = 'failed';
          job.error = 'Interrupted by an app restart — retry to print again.';
          job.updatedAt = Date.now();
          this.activeIds.delete(job.id);
        }
      }
      await this.persist();
      this.emit();
      if (this.running) {
        void this.pump();
      }
    } catch {
      // No persisted state yet.
    }
  }

  getSnapshot(): PrintQueueSnapshot {
    const active = this.jobs.find((job) => job.state === 'submitted' || job.state === 'processing');
    return {
      jobs: this.jobs.map((job) => ({ ...job })),
      running: this.running,
      activeJobId: active?.id ?? null,
    };
  }

  async enqueue(input: PrintEnqueueInput): Promise<PrintJob> {
    const now = Date.now();
    const job: PrintJob = {
      id: `job_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      token: input.token,
      fileName: input.fileName || 'framed.png',
      queueName: input.queueName,
      copies: input.copies,
      paperSize: input.paperSize,
      mediaType: input.mediaType,
      quality: input.quality,
      colorMode: input.colorMode,
      cupsOptions: input.cupsOptions,
      state: 'pending',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.push(job);
    await this.persist();
    this.emit();
    return { ...job };
  }

  /** Marks the given jobs as part of the active batch and starts processing. */
  async startBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.activeIds.add(id);
    }
    this.running = true;
    await this.persist();
    this.emit();
    void this.pump();
  }

  /**
   * Retries a failed/canceled job, inserting it directly after the active job
   * so it prints next (priority) instead of at the end of the queue.
   */
  async retry(id: string): Promise<PrintJob | null> {
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job || job.state === 'completed' || job.state === 'submitted' || job.state === 'processing') {
      return null;
    }

    job.state = 'pending';
    job.error = undefined;
    job.priority = true;
    job.attempts += 1;
    job.updatedAt = Date.now();

    this.jobs = this.jobs.filter((entry) => entry.id !== id);
    const activeIndex = this.jobs.findIndex((entry) => entry.state === 'submitted' || entry.state === 'processing');
    const insertAt = activeIndex >= 0 ? activeIndex + 1 : 0;
    this.jobs.splice(insertAt, 0, job);

    this.activeIds.add(id);
    this.running = true;
    await this.persist();
    this.emit();
    void this.pump();
    return { ...job };
  }

  async cancel(id: string): Promise<void> {
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job) {
      return;
    }
    if ((job.state === 'submitted' || job.state === 'processing') && job.cupsJobId) {
      await this.deps.service.cancelJob(job.cupsJobId);
    }
    job.state = 'canceled';
    job.updatedAt = Date.now();
    this.activeIds.delete(id);
    await this.persist();
    this.emit();
    void this.pump();
  }

  async remove(id: string): Promise<void> {
    const job = this.jobs.find((entry) => entry.id === id);
    if (job && (job.state === 'submitted' || job.state === 'processing')) {
      if (job.cupsJobId) {
        await this.deps.service.cancelJob(job.cupsJobId);
      }
    }
    this.jobs = this.jobs.filter((entry) => entry.id !== id);
    this.activeIds.delete(id);
    await this.persist();
    this.emit();
  }

  private async pump(): Promise<void> {
    if (this.processing || !this.running) {
      return;
    }
    // Already waiting on an active job; its poll loop will call pump() again.
    const active = this.jobs.find((job) => job.state === 'submitted' || job.state === 'processing');
    if (active) {
      return;
    }

    const next = this.jobs.find((job) => job.state === 'pending' && this.activeIds.has(job.id));
    if (!next) {
      this.running = false;
      await this.persist();
      this.emit();
      return;
    }

    await this.process(next);
  }

  private async process(job: PrintJob): Promise<void> {
    this.processing = true;
    try {
      job.state = 'submitted';
      job.updatedAt = Date.now();
      this.emit();

      let dataUrl: string;
      try {
        dataUrl = await this.deps.requestImage({ ...job });
      } catch (error) {
        await this.fail(job, error instanceof Error ? error.message : 'The framed image could not be resolved.');
        return;
      }

      const payload: PrinterPrintPayload = {
        dataUrl,
        fileName: job.fileName,
        queueName: job.queueName,
        copies: job.copies,
        paperSize: job.paperSize,
        mediaType: job.mediaType,
        quality: job.quality,
        colorMode: job.colorMode,
        cupsOptions: job.cupsOptions,
      };

      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-booth-queue-'));
      const filePath = path.join(dir, path.basename(job.fileName || 'print.jpg'));
      let result;
      try {
        await fs.writeFile(filePath, Buffer.from(dataUrl.replace(/^data:[^,]+,/, ''), 'base64'));
        result = await this.deps.service.submitFile(payload, filePath);
      } finally {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      }

      if (!result.ok || !result.jobId) {
        await this.fail(job, result.error ?? 'CUPS rejected the job.');
        return;
      }

      job.cupsJobId = result.jobId;
      job.state = 'processing';
      job.updatedAt = Date.now();
      this.emit();
      await this.persist();
      this.poll(job);
    } finally {
      this.processing = false;
    }
  }

  private poll(job: PrintJob): void {
    const startedAt = Date.now();
    const tick = async () => {
      if (job.state !== 'processing') {
        return;
      }
      if (Date.now() - startedAt > JOB_TIMEOUT_MS) {
        await this.fail(job, 'The print job timed out in the CUPS queue.');
        return;
      }

      const status = await this.deps.service.jobStatus(job.queueName, job.cupsJobId ?? '');
      if (status.state === 'completed') {
        job.state = 'completed';
        job.updatedAt = Date.now();
        this.activeIds.delete(job.id);
        this.emit();
        await this.persist();
        void this.pump();
        return;
      }
      if (status.state === 'canceled') {
        await this.fail(job, 'The printer canceled the job.');
        return;
      }
      if (status.state === 'unknown') {
        // CUPS no longer reports it and it isn't in the completed/canceled
        // lists — treat as failed so the operator can retry.
        await this.fail(job, 'The printer stopped reporting the job.');
        return;
      }

      this.pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    this.pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
  }

  private async fail(job: PrintJob, message: string): Promise<void> {
    job.state = 'failed';
    job.error = message;
    job.updatedAt = Date.now();
    this.activeIds.delete(job.id);
    this.emit();
    await this.persist();
    void this.pump();
  }

  private emit(): void {
    this.deps.emit(this.getSnapshot());
  }

  private async persist(): Promise<void> {
    const state: PersistedState = {
      jobs: this.jobs,
      activeIds: [...this.activeIds],
      running: this.running,
    };
    await fs.mkdir(this.deps.storageDir, { recursive: true }).catch(() => undefined);
    await fs.writeFile(this.file, JSON.stringify(state, null, 2), 'utf8').catch(() => undefined);
  }

  dispose(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
