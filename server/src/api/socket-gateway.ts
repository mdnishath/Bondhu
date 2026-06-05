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

  ctx.manager.on('message', (accountId: string, m: any) => toUserRoom(accountId, 'message', m));
  ctx.manager.on('status', (accountId: string, status: string, info?: any) =>
    toUserRoom(accountId, 'status', { status, ...(info ?? {}) }),
  );
  ctx.manager.on('qr', (accountId: string, qr: string) => toUserRoom(accountId, 'status', { status: 'qr_pending', qr }));
  ctx.manager.on('pairing', (accountId: string, code: string) => toUserRoom(accountId, 'status', { status: 'pairing', code }));
  ctx.manager.on('ack', (accountId: string, msgId: string, ack: number) => toUserRoom(accountId, 'message_ack', { msgId, ack }));
  ctx.manager.on('chat_update', (accountId: string, jid: string) => toUserRoom(accountId, 'chat_update', { jid }));
}
