import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { createContext } from './app-context.js';
import { createApp } from './api/server.js';
import { attachGateway } from './api/socket-gateway.js';
import { config } from './config.js';

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

http.listen(config.port, () => {
  process.stderr.write(`[Bondhu] API + Socket.IO on http://localhost:${config.port}\n`);
});
