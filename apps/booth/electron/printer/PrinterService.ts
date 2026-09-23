import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

/**
 * CUPS-backed printer bridge for the Canon Selphy CP1000 (dye-sub) printer.
 *
 * The booth's production device runs Ubuntu, where the Selphy is a normal CUPS
 * queue (typically installed via the generic `selphycp1000.ppd` driver). This
 * service shells out to the standard `lpstat`/`lp` CLI so there is nothing to
 * bundle. On platforms without CUPS (e.g. Windows dev machines) every call
 * surfaces `available: false` and the renderer keeps using its simulated
 * print fallback.
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
}

export interface PrinterPrintResult {
  ok: boolean;
  error?: string;
  output?: string;
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

  /** Reports a single queue's state (`idle` / `printing` / `stopped`). */
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
    return { available: true, state, message: result.value.stdout.trim() };
  }

  /**
   * Sends a composed framed photo to the Selphy. The renderer passes a JPEG
   * data URL; it is decoded to a temp file and submitted through `lp` with the
   * configured copies/media/quality options.
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

    const base64 = payload.dataUrl.replace(/^data:[^,]+,/, '');
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'));

    const args = [`-d${payload.queueName}`, '-o position=center'];
    if (payload.copies && payload.copies > 0) {
      args.push('-n', String(payload.copies));
    }
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
    args.push(filePath);

    const result = await windowedExec(() => execFile('lp', args, 60000));
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, output: result.value.stdout.trim() };
  }
}