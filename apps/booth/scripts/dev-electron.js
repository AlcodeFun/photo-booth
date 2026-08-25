const { spawn } = require('child_process');
const waitOn = require('wait-on');
const path = require('path');

async function start() {
  console.log('Waiting for renderer (Vite) to start...');
  try {
    await waitOn({
      resources: ['http://localhost:5173'],
      timeout: 30000,
    });
  } catch (err) {
    console.error('Renderer did not start in time:', err);
    process.exit(1);
  }

  console.log('Renderer is up! Building Electron...');
  
  // Run tsc compile
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
      env: { ...process.env, NODE_ENV: 'development' },
    });

    electron.on('close', (code) => {
      process.exit(code);
    });
  });
}

start();
