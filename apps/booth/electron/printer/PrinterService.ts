import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

/**
 * CUPS-backed printer bridge for the Canon Selphy CP1000 (dye-sub) printer.
 *
 * The booth's production device runs Ubuntu, where the Selphy is a normal CUPS
 * queue (installed through Gutenprint's `canonselphyneo` backend — see
 * docs/ubuntu-selphy-print-setup.md). This service shells out to the standard
 * `lpstat`/`lp`/`lpq`/`cancel` CLI so there is nothing to bundle. On platforms
 * without CUPS (e.g. the Windows dev machine) every call surfaces
 * `available: false` and the renderer keeps using its simulated print fallback.
 *
 * It exposes both a one-shot `print()` (used by the setup test sheet and the
 * auto-print path) and lower-level job primitives (`submitFile`, `jobStatus`,
 * `queueJobs`, `cancelJob`) that the main-process PrintQueue builds on.
 */

export interface PrinterListResult {
  available: boolean;
  printers: string[];
  activeJobs: number;
  error?: string;
}

export interface PrinterStatusResult {
  available: boolean;
  state: 'idle' | 'printing' | 'stopped' | 'unknown' | 'unavailable';
  message?: string;
  error?: string;
  /** Best-effort printer-state-reasons (media-empty, paused, ...). */
  reasons?: string[];
}

export interface PrinterPrintPayload {
  dataUrl: string;
  fileName: string;
  queueName: string;
  copies?: number;
  paperSize?: string;
  mediaType?: string;
  quality?: number;
  colorMode?: 'color' | 'grayscale';
  /**
   * Explicit CUPS `-o key=value` overrides. When present these replace the
   * generic media/quality options — use this to target Gutenprint PPD keys
   * (see docs/ubuntu-selphy-print-setup.md section 6).
   */
  cupsOptions?: Record<string, string>;
}

export interface PrinterPrintResult {
  ok: boolean;
  error?: string;
  output?: string;
  /** CUPS job id parsed from `lp` stdout, e.g. `SELPHY_CP1000-42`. */
  jobId?: string;
}

export interface PrinterJobStatusResult {
  ok: boolean;
  state: 'queued' | 'processing' | 'completed' | 'canceled' | 'unknown';
  message?: string;
}

export interface PrinterQueueJob {
  id: string;
  queueName: string;
  user: string;
  size: number;
}

const execFile = (
  command: string,
  args: string[],
  timeoutMs = 15000,
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    childProcess.execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const cupssAvailable = process.platform === 'linux' || process.platform === 'darwin';

const windowedExec = async <T>(fn: () => Promise<T>) => {
  try {
    return { ok: true as const, value: await fn() };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message.replace(/\s+/g, ' ').trim() : String(error),
    };
  }
};

/** Printer-state-reason tokens the booth treats as "operator attention needed". */
const REASON_TOKENS = [
  'media-empty',
  'media-needed',
  'media-jam',
  'marker-supply-empty',
  'marker-supply-low',
  'cover-open',
  'offline',
  'paused',
];

const parseReasons = (html: string): string[] => {
  const lower = html.toLowerCase();
  return REASON_TOKENS.filter((token) => lower.includes(token));
};

const hasJob = (stdout: string, jobId: string): boolean =>
  stdout
    .split('\n')
    .some((line) => line.trim().startsWith(`${jobId} `) || line.trim() === jobId);

export class PrinterService {
  /** Lists CUPS queues (`lpstat -p`) plus the number of active jobs. */
  async listPrinters(): Promise<PrinterListResult> {
    if (!cupssAvailable) {
      return { available: false, printers: [], activeJobs: 0, error: 'CUPS is only available on Linux/macOS.' };
    }

    const probe = await windowedExec(() => execFile('lpstat', ['-p']));
    if (!probe.ok) {
      return {
        available: false,
        printers: [],
        activeJobs: 0,
        error: probe.error.includes('command not found') ? 'lpstat is not installed.' : probe.error,
      };
    }

    const printers = probe.value.stdout
      .split('\n')
      .map((line) => line.match(/^printer\s+(\S+)/)?.[1])
      .filter((name): name is string => Boolean(name));

    const jobs = await windowedExec(() => execFile('lpstat', ['-o']));
    const activeJobs = jobs.ok
      ? jobs.value.stdout
          .split('\n')
          .filter((line) => line.trim().length > 0).length
      : 0;

    return { available: true, printers, activeJobs };
  }

  /** Reports a single queue's state (`idle` / `printing` / `stopped`) + reasons. */
  async printerStatus(queueName: string): Promise<PrinterStatusResult> {
    if (!cupssAvailable || !queueName) {
      return { available: false, state: 'unavailable', message: 'CUPS is not available here.' };
    }

    const result = await windowedExec(() => execFile('lpstat', ['-p', queueName]));
    if (!result.ok) {
      return { available: false, state: 'unknown', message: result.error, error: result.error };
    }

    const lower = result.value.stdout.toLowerCase();
    let state: PrinterStatusResult['state'] = 'idle';
    if (lower.includes('disabled') || lower.includes('not') || lower.includes('stopped')) {
      state = 'stopped';
    } else if (lower.includes('printing') || lower.includes('processing')) {
      state = 'printing';
    }

    const reasons = await this.printerReasons(queueName);
    return { available: true, state, message: result.value.stdout.trim(), reasons };
  }

  /** Best-effort `printer-state-reasons` via the local CUPS web interface. */
  async printerReasons(queueName: string): Promise<string[]> {
    if (!cupssAvailable || !queueName) {
      return [];
    }
    return new Promise<string[]>((resolve) => {
      const request = http.request(
        {
          host: '127.0.0.1',
          port: 631,
          path: `/printers/${encodeURIComponent(queueName)}`,
          method: 'GET',
          timeout: 3000,
        },
        (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () => resolve(parseReasons(body)));
        },
      );
      request.on('error', () => resolve([]));
      request.on('timeout', () => {
        request.destroy();
        resolve([]);
      });
      request.end();
    });
  }

  /**
   * One-shot print: decodes the JPEG data URL to a temp file, submits it, then
   * deletes the temp file. Used by the setup test sheet and auto-print.
   */
  async print(payload: PrinterPrintPayload): Promise<PrinterPrintResult> {
    if (!cupssAvailable) {
      return { ok: false, error: 'CUPS is only available on Linux/macOS — print was skipped.' };
    }
    if (!payload.queueName) {
      return { ok: false, error: 'No printer selected.' };
    }

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-booth-print-'));
    const filePath = path.join(dir, path.basename(payload.fileName || 'print.jpg'));

    try {
      const base64 = payload.dataUrl.replace(/^data:[^,]+,/, '');
      await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
      return await this.submitFile(payload, filePath);
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * Submits an already-written file through `lp` and parses the CUPS job id from
   * stdout. The caller owns the file lifecycle (the PrintQueue deletes its temp
   * file as soon as `lp` accepts the job).
   */
  async submitFile(payload: PrinterPrintPayload, filePath: string): Promise<PrinterPrintResult> {
    if (!cupssAvailable) {
      return { ok: false, error: 'CUPS is only available on Linux/macOS — print was skipped.' };
    }
    if (!payload.queueName) {
      return { ok: false, error: 'No printer selected.' };
    }

    const args = this.buildArgs(payload, filePath);
    const result = await windowedExec(() => execFile('lp', args, 60000));
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const output = result.value.stdout.trim();
    const jobId = output.match(/request id is (\S+)/i)?.[1];
    return { ok: true, output, jobId };
  }

  /** Reports a CUPS job's state by id. */
  async jobStatus(queueName: string, jobId: string): Promise<PrinterJobStatusResult> {
    if (!cupssAvailable || !jobId) {
      return { ok: false, state: 'unknown' };
    }

    const notCompleted = await windowedExec(() => execFile('lpstat', ['-W', 'not-completed', '-o', queueName]));
    if (notCompleted.ok && hasJob(notCompleted.value.stdout, jobId)) {
      const printer = await this.printerStatus(queueName);
      return {
        ok: true,
        state: printer.state === 'printing' ? 'processing' : 'queued',
        message: 'Job is in the CUPS queue.',
      };
    }

    const completed = await windowedExec(() => execFile('lpstat', ['-W', 'completed', '-o', queueName]));
    if (completed.ok && hasJob(completed.value.stdout, jobId)) {
      return { ok: true, state: 'completed' };
    }

    const canceled = await windowedExec(() => execFile('lpstat', ['-W', 'canceled', '-o', queueName]));
    if (canceled.ok && hasJob(canceled.value.stdout, jobId)) {
      return { ok: true, state: 'canceled' };
    }

    return { ok: true, state: 'unknown', message: 'Job is no longer reported by CUPS.' };
  }

  /** Lists the jobs currently in a queue (`lpstat -o`). */
  async queueJobs(queueName: string): Promise<PrinterQueueJob[]> {
    if (!cupssAvailable || !queueName) {
      return [];
    }
    const result = await windowedExec(() => execFile('lpstat', ['-o', queueName]));
    if (!result.ok) {
      return [];
    }
    return result.value.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, user, size] = line.split(/\s+/);
        return { id: id ?? '', queueName, user: user ?? '', size: Number(size) || 0 };
      })
      .filter((job) => job.id);
  }

  /** Cancels a CUPS job by id (`cancel <id>`). */
  async cancelJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
    if (!cupssAvailable || !jobId) {
      return { ok: false, error: 'CUPS is not available here.' };
    }
    const result = await windowedExec(() => execFile('cancel', [jobId]));
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  /** Builds the `lp` argument list from a payload. */
  private buildArgs(payload: PrinterPrintPayload, filePath: string): string[] {
    const args = [`-d${payload.queueName}`];

    if (payload.cupsOptions && Object.keys(payload.cupsOptions).length > 0) {
      for (const [key, value] of Object.entries(payload.cupsOptions)) {
        args.push('-o', `${key}=${value}`);
      }
    } else {
      args.push('-o', 'position=center');
      if (payload.paperSize) {
        args.push('-o', `media=${payload.paperSize}`);
      }
      if (payload.mediaType) {
        args.push('-o', `media-type=${payload.mediaType}`);
      }
      if (payload.quality) {
        args.push('-o', `print-quality=${payload.quality}`);
      }
      if (payload.colorMode) {
        args.push('-o', `print-color-mode=${payload.colorMode}`);
      }
    }

    if (payload.copies && payload.copies > 0) {
      args.push('-n', String(payload.copies));
    }

    args.push(filePath);
    return args;
  }
}
