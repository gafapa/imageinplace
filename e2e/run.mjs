// Runs the browser regressions in sequence against TEST_URL (default: production preview on port 4180).
// Usage: node e2e/run.mjs [suite ...]   e.g. node e2e/run.mjs metadata privacy-transforms
import { spawnSync } from 'node:child_process';

const ALL = ['features', 'history-editor', 'workflow-print', 'individual-actions', 'export-regressions', 'background-trim', 'project-safety',
  'geometry-offline', 'offline-lifecycle', 'usability', 'on-device-ai', 'recovery-detection', 'privacy-transforms', 'metadata', 'restoration', 'security-regressions'];
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
for (const suite of suites) {
  console.log(`\n▶ ${suite}`);
  const { status } = spawnSync(process.execPath, [`e2e/${suite}.mjs`], { stdio: 'inherit' });
  if (status !== 0) { console.error(`✗ ${suite} failed`); process.exit(status ?? 1); }
}
console.log(`\n✓ ${suites.length} browser suites passed`);
