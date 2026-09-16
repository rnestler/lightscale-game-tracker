import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(directory, '../../.env'), quiet: true });

const { createServer } = await import('./server.js');
const { loadBuiltFrontend } = await import('./frontend.js');
const { startFileSweep } = await import('./file-sweep.js');

const port = Number(process.env.PORT ?? 3500);
createServer(await loadBuiltFrontend(false)).listen(port, () => {
  console.log(`Listening on port ${port}`);
  startFileSweep();
});
