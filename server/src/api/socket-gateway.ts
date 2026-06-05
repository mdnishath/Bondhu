import type { Server as IOServer } from 'socket.io';
import type { AppContext } from '../app-context.js';

/** Look up the owning userId for an account (cheap SQLite read). */
function ownerOf(ctx: AppContext, accountId: string): string | undefined {
  return ctx.accounts.findById(accountId)?.userId;
}

/** Wire AccountManager events to per-user Socket.IO rooms, and authenticate
 *  incoming sockets by JWT (handshake auth.token or query token). */
export function attachGateway(io: IOServer, ctx: AppContext): void {
  io.use((socket: any, next: any) => {
    const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
    try {
      socket.data.userId = ctx.auth.verifyToken(token).userId;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: any) => {
    socket.join(`user:${socket.data.userId}`);
  });

  const toUserRoom = (accountId: string, ev: string, payload: any) => {
    const userId = ownerOf(ctx, accountId);
    if (userId) io.to(`user:${userId}`).emit(ev, { accountId, ...payload });
  };

  ctx.manager.on('message', async (accountId: string, m: any) => {
    let translated: string | null = null;
    const userId = ownerOf(ctx, accountId);
    // Best-effort auto-translate of incoming text, only when the user has a key.
    if (userId && !m.fromMe && m.type === 'text' && m.body && ctx.apiKeys.activeKey(userId)) {
      const lang = ctx.langs.resolve(userId, accountId, m.chatJid);
      try { translated = await ctx.translation.translate(userId, accountId, m.msgId, m.body, lang); } catch { /* best-effort */ }
    }
    toUserRoom(accountId, 'message', { ...m, translated });
  });
  ctx.manager.on('status', (accountId: string, status: string, info?: any) =>
    toUserRoom(accountId, 'status', { status, ...(info ?? {}) }),
  );
  ctx.manager.on('qr', (accountId: string, qr: string) => toUserRoom(accountId, 'status', { status: 'qr_pending', qr }));
  ctx.manager.on('pairing', (accountId: string, code: string) => toUserRoom(accountId, 'status', { status: 'pairing', code }));
  ctx.manager.on('ack', (accountId: string, msgId: string, ack: number) => toUserRoom(accountId, 'message_ack', { msgId, ack }));
  ctx.manager.on('chat_update', (accountId: string, jid: string) => toUserRoom(accountId, 'chat_update', { jid }));
  ctx.manager.on('reaction', (accountId: string, msgId: string, emoji: string, sender: string) =>
    toUserRoom(accountId, 'message_reaction', { msgId, emoji, sender }),
  );
}
