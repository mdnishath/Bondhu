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
    let transcript: string | null = null;
    const userId = ownerOf(ctx, accountId);
    const hasKey = userId && ctx.apiKeys.activeKey(userId);

    // Best-effort auto-translate of incoming text, only when the user has a key.
    if (userId && hasKey && !m.fromMe && m.type === 'text' && m.body) {
      const lang = ctx.langs.resolve(userId, accountId, m.chatJid);
      try { translated = await ctx.translation.translate(userId, accountId, m.msgId, m.body, lang); } catch { /* best-effort */ }
    }

    // Incoming voice: STT → translate. Cached so chat reload preserves both.
    if (userId && hasKey && !m.fromMe && (m.type === 'ptt' || m.type === 'audio')) {
      try {
        const { buffer, mime } = await ctx.manager.downloadMedia(accountId, m.msgId);
        const b64 = buffer.toString('base64');
        transcript = (await ctx.transcription.transcribe(userId, b64, mime)) || null;
        if (transcript) {
          ctx.messages.setTranscript(accountId, m.msgId, transcript);
          const lang = ctx.langs.resolve(userId, accountId, m.chatJid);
          try { translated = await ctx.translation.translate(userId, accountId, m.msgId, transcript, lang); } catch { /* best-effort */ }
        }
      } catch { /* best-effort: stay silent, original audio still plays */ }
    }

    let senderName: string | undefined;
    if (!m.fromMe && m.chatJid?.endsWith('@g.us') && m.senderJid) {
      senderName = ctx.chats.contactName(accountId, m.senderJid) || '+' + m.senderJid.split('@')[0];
    }

    toUserRoom(accountId, 'message', { ...m, transcript, translated, senderName });
  });
  ctx.manager.on('status', (accountId: string, status: string, info?: any) =>
    toUserRoom(accountId, 'status', { status, ...(info ?? {}) }),
  );
  ctx.manager.on('qr', (accountId: string, qr: string) => toUserRoom(accountId, 'status', { status: 'qr_pending', qr }));
  ctx.manager.on('pairing', (accountId: string, code: string) => toUserRoom(accountId, 'status', { status: 'pairing', code }));
  ctx.manager.on('ack', (accountId: string, msgId: string, ack: number) => toUserRoom(accountId, 'message_ack', { msgId, ack }));
  ctx.manager.on('chat_update', (accountId: string, jid: string) => toUserRoom(accountId, 'chat_update', { jid }));
  ctx.manager.on('reaction', (accountId: string, msgId: string, emoji: string, fromMe: boolean, sender: string) =>
    toUserRoom(accountId, 'message_reaction', { msgId, emoji, fromMe, sender }),
  );
  ctx.manager.on('message_delete', (accountId: string, msgId: string) =>
    toUserRoom(accountId, 'message_delete', { msgId }),
  );
  ctx.manager.on('message_edit', (accountId: string, msgId: string, text: string) =>
    toUserRoom(accountId, 'message_edit', { msgId, text }),
  );
  ctx.manager.on('presence', (accountId: string, jid: string, state: string) =>
    toUserRoom(accountId, 'presence', { jid, state }),
  );
}
