import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { createContext } from './app-context.js';
import { createApp } from './api/server.js';
import { attachGateway } from './api/socket-gateway.js';
import { config } from './config.js';

const ctx = createContext(config.dbPath);
const app = createApp(ctx);
const http = createServer(app);
const io = new IOServer(http, { cors: { origin: '*' } });
attachGateway(io, ctx);

// Re-start every previously-linked account on boot.
for (const acc of ctx.db.prepare('SELECT id FROM accounts').all() as { id: string }[]) {
  ctx.manager.start(acc.id).catch((e) =>
    process.stderr.write(`[Bondhu] start ${acc.id} failed: ${e?.message}\n`),
  );
}

http.listen(config.port, () => {
  process.stderr.write(`[Bondhu] API + Socket.IO on http://localhost:${config.port}\n`);
});
