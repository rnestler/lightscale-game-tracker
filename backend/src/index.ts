import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(directory, '../../.env'), quiet: true });

const { requireMigratedDatabase } = await import('./database-release.js');
await requireMigratedDatabase();
const { createServer } = await import('./server.js');
const { loadBuiltFrontend } = await import('./frontend.js');
const { startFileSweep } = await import('./file-sweep.js');
const { startOutboxDispatcher } = await import('./outbox.js');

const port = Number(process.env.PORT ?? 3500);
createServer(await loadBuiltFrontend(false)).listen(port, () => {
  console.log(`Listening on port ${port}`);
  startFileSweep();
  startOutboxDispatcher();
});
