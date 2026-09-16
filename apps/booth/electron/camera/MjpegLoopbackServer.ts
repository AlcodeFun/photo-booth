import * as http from 'http';

const MJPEG_BOUNDARY = 'photo-booth-frame';

/**
 * Exposes the tethered DSLR's live view as a localhost MJPEG stream
 * (`http://127.0.0.1:<port>/feed.mjpeg`) — the Windows-native equivalent of
 * v4l2loopback. Any program can treat that URL as the "webcam" feed (a browser,
 * ffmpeg, OBS Media Source). Combined with OBS Start Virtual Camera, the DSLR
 * then appears as a system-wide webcam device. Frames are served straight from
 * memory: no files are ever written for the live view.
 */
export class MjpegLoopbackServer {
  private server: http.Server | null = null;
  private clients = new Set<http.ServerResponse>();
  private latest: Buffer | null = null;

  isRunning(): boolean {
    return this.server !== null;
  }

  port(): number {
    if (!this.server) {
      return 0;
    }
    const address = this.server.address();
    return address && typeof address === 'object' ? address.port : 0;
  }

  start(): void {
    if (this.server) {
      return;
    }
    this.server = http.createServer((req, res) => {
      if (req.url !== '/feed.mjpeg') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(
          `photo-booth DSLR loopback (clients: ${this.clients.size})\n` +
            'Use /feed.mjpeg for the MJPEG stream.\n',
        );
        return;
      }
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      this.clients.add(res);
      if (this.latest) {
        this.writeFrame(res, this.latest);
      }
      req.on('close', () => this.clients.delete(res));
    });
    this.server.listen(0, '127.0.0.1');
  }

  push(frame: Buffer): void {
    this.latest = frame;
    for (const client of this.clients) {
      this.writeFrame(client, frame);
    }
  }

  stop(): void {
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
    this.latest = null;
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private writeFrame(res: http.ServerResponse, frame: Buffer): void {
    res.write(
      Buffer.concat([
        Buffer.from(
          `--${MJPEG_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`,
        ),
        frame,
        Buffer.from('\r\n'),
      ]),
    );
  }
}