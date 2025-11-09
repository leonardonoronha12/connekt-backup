import { execSync } from 'node:child_process';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', shell: true });
}

try {
  run('node tools/generate-llms.js');
} catch (err) {
  console.warn('generate-llms falhou, continuando com build:', err?.message || err);
}

run('vite build');