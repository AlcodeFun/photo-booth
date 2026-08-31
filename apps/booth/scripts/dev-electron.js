const { spawn } = require('child_process');
const path = require('path');

const preferPort = Number(process.env.VITE_PORT || 5173);
const candidatePorts = Array.from({ length: 20 }, (_, index) => preferPort + index);

async function fetchHtml(port) {
  try {
    const response = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1500) });
    const text = await response.text();
    return text;
  } catch {
    return '';
  }
}

async function findRendererPort() {
  for (const port of candidatePorts) {
    const html = await fetchHtml(port);
    if (html.includes('/src/main.tsx') || html.includes('/@vite/client')) {
      return String(port);
    }
  }

  throw new Error(`Renderer never became reachable on ports ${candidatePorts.join(', ')}`);
}

async function start() {
  let rendererPort;

  try {
    rendererPort = await findRendererPort();
    console.log(`Renderer is up on http://localhost:${rendererPort}! Building Electron...`);
  } catch (err) {
    console.error('Renderer did not start in time:', err.message || err);
    process.exit(1);
  }

  const tsc = spawn('npx', ['tsc', '-p', 'electron/tsconfig.json'], {
    shell: true,
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });

  tsc.on('close', (code) => {
    if (code !== 0) {
      console.error('Electron compilation failed');
      process.exit(1);
    }

    console.log('Electron built successfully. Spawning Electron...');

    const electron = spawn('npx', ['electron', '.'], {
      shell: true,
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'development', VITE_PORT: rendererPort },
    });

    electron.on('close', (code) => {
      process.exit(code);
    });
  });
}

start();
