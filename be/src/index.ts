import { config } from './config';
import { connectDb, closeDb } from './db';
import { ensureIndexes } from './db/collections';
import { createApp } from './app';

async function main() {
  await connectDb();
  await ensureIndexes();

  createApp().listen(config.server.port, () => {
    console.log(`[server] http://localhost:${config.server.port} (${config.env})`);
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await closeDb();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[server] 기동 실패:', err);
  process.exit(1);
});
