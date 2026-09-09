const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const mainEntry = path.join(root, 'dist', 'electron', 'main.js');

function compile() {
  return new Promise((resolve, reject) => {
    const tsc = spawn('npx', ['tsc', '-p', 'electron/tsconfig.json'], {
      shell: true,
      stdio: 'inherit',
      cwd: root,
    });
    tsc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('Electron compilation failed'))));
  });
}

async function start() {
  if (!fs.existsSync(mainEntry) || process.argv.includes('--rebuild')) {
    console.log('Compiling Electron main process...');
    await compile();
  }

  console.log('Launching Electron in production mode...');
  const electron = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
  });

  electron.on('close', (code) => process.exit(code ?? 0));
}

start().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
