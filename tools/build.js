import { execSync } from 'node:child_process';
import path from 'node:path';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', shell: true });
}

try {
  run('node tools/generate-llms.js');
} catch (err) {
  console.warn('generate-llms falhou, continuando com build:', err?.message || err);
}

try {
  run('vite build');
} catch (_) {
  const viteJs = path.join('node_modules', 'vite', 'bin', 'vite.js');
  run(`node "${viteJs}" build`);
}
