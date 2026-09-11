'use strict';

// Runs the backend API server and the Vite dev server together in one terminal.
// Used by `npm run dev:all`. Either process exiting tears down the other so you
// never end up with a half-running stack.

const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const targets = [
  { name: 'server', color: '\x1b[36m', args: ['run', 'dev:server'] },
  { name: 'client', color: '\x1b[35m', args: ['run', 'dev'] },
];

const reset = '\x1b[0m';
const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

for (const target of targets) {
  const child = spawn(npmCommand, target.args, { cwd: rootDir, shell: process.platform === 'win32' });
  children.push(child);

  const prefix = `${target.color}[${target.name}]${reset} `;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code}\n`);
    shutdown(code || 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
