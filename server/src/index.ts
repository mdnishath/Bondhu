import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { createContext } from './app-context.js';
import { createApp } from './api/server.js';
import { attachGateway } from './api/socket-gateway.js';
import { config } from './config.js';
import { MaintenanceRepo } from './db/repositories/maintenance.repo.js';

// Never let an unhandled async error take down the whole process silently.
process.on('unhandledRejection', (reason: any) => {
  process.stderr.write(`[Bondhu] unhandledRejection: ${reason?.stack || reason}\n`);
});
process.on('uncaughtException', (err: any) => {
  process.stderr.write(`[Bondhu] uncaughtException: ${err?.stack || err}\n`);
});

const ctx = createContext(config.dbPath);
const app = createApp(ctx);
const http = createServer(app);
const io = new IOServer(http, {
  cors: {
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
  },
});
attachGateway(io, ctx);

// Re-start every previously-linked account on boot, staggered so we don't open a
// burst of Baileys sockets at once (thundering herd on the WhatsApp servers).
const accounts = ctx.db.prepare('SELECT id FROM accounts').all() as { id: string }[];
accounts.forEach((acc, i) => {
  setTimeout(() => {
    ctx.manager.start(acc.id).catch((e) =>
      process.stderr.write(`[Bondhu] start ${acc.id} failed: ${e?.message}\n`),
    );
  }, i * 1500);
});

// Daily housekeeping: prune regenerable caches (translations / TTS / profile pics)
// older than the retention window so the SQLite file doesn't grow without bound on
// a long-lived account. All pruned data is re-derivable on demand; history is kept.
const maintenance = new MaintenanceRepo(ctx.db);
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
function runPrune() {
  try {
    const n = maintenance.pruneOldCaches(Date.now() - RETENTION_MS);
    if (n.translations || n.tts || n.profilePics)
      process.stderr.write(`[Bondhu] pruned caches: ${JSON.stringify(n)}\n`);
  } catch (e: any) {
    process.stderr.write(`[Bondhu] cache prune failed: ${e?.message}\n`);
  }
}
runPrune();
setInterval(runPrune, 24 * 60 * 60 * 1000).unref();

http.listen(config.port, () => {
  process.stderr.write(`[Bondhu] API + Socket.IO on http://localhost:${config.port}\n`);
});
