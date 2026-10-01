import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { completeEnvironment } from './environment.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';

completeEnvironment(path.resolve(scriptDir, '..'));

const command = isWindows ? 'powershell' : 'bash';
const args = isWindows
  ? ['-ExecutionPolicy', 'Bypass', '-File', path.join(scriptDir, 'setup.ps1')]
  : [path.join(scriptDir, 'setup.sh')];

const result = spawnSync(command, args, { stdio: 'inherit' });
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
