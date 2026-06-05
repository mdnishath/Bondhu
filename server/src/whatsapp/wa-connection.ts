import { EventEmitter } from 'events';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import type { DB } from '../db/db.js';
import { useSqliteAuthState } from './auth-state.js';
import { normalizeMessage } from './normalize.js';

const logger = P({ level: 'silent' });

export type WaStatus = 'disconnected' | 'qr_pending' | 'authenticating' | 'connected';

/** Wraps a single Baileys socket for one account. Emits:
 *  'qr'(qr), 'pairing'(code), 'status'(status, info), 'message'(UpsertMessage),
 *  'ack'(msgId, ack), 'chat'(jid, name, isGroup), 'phone'(number),
 *  'ready'(), 'logged_out'() */
export class WaConnection extends EventEmitter {
  private sock?: WASocket;
  private _status: WaStatus = 'disconnected';
  private _qr: string | null = null;
  private _stopping = false;
  private pairPhone?: string;

  constructor(public accountId: string, private db: DB) {
    super();
  }

  get status(): WaStatus {
    return this._status;
  }
  get qr(): string | null {
    return this._qr;
  }

  /** Pass a phone number to request a pairing code instead of QR. */
  async start(pairPhone?: string): Promise<void> {
    this._stopping = false;
    this.pairPhone = pairPhone;
    const { state, saveCreds } = await useSqliteAuthState(this.db, this.accountId);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ version, auth: state, logger });
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        this._qr = qr;
        this._status = 'qr_pending';
        this.emit('qr', qr);
        this.emit('status', this._status);
        if (this.pairPhone && !sock.authState.creds.registered) {
          try {
            const code = await sock.requestPairingCode(this.pairPhone);
            this.emit('pairing', code);
          } catch (e: any) {
            process.stderr.write(`[Wa:${this.accountId}] pairing code error: ${e?.message}\n`);
          }
        }
      }

      if (connection === 'connecting') {
        this._status = 'authenticating';
        this.emit('status', this._status);
      }

      if (connection === 'open') {
        this._qr = null;
        this._status = 'connected';
        const phone = sock.user?.id?.split(':')[0]?.split('@')[0];
        if (phone) this.emit('phone', phone);
        this.emit('status', this._status, { phone });
        this.emit('ready');
      }

      if (connection === 'close') {
        this._status = 'disconnected';
        this.emit('status', this._status);
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        if (this._stopping) return;
        if (code === DisconnectReason.loggedOut) {
          this.emit('logged_out');
          return;
        }
        setTimeout(() => this.start(this.pairPhone).catch(() => {}), 3000);
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const m of messages) {
        const norm = normalizeMessage(this.accountId, m);
        if (!norm) continue;
        const name = m.pushName ?? undefined;
        const isGroup = norm.chatJid.endsWith('@g.us');
        this.emit('chat', norm.chatJid, name, isGroup);
        this.emit('message', norm);
      }
    });

    sock.ev.on('messages.update', (updates) => {
      for (const upd of updates) {
        const ack = upd.update?.status;
        if (upd.key?.id && typeof ack === 'number') this.emit('ack', upd.key.id, ack);
      }
    });
  }

  async sendText(jid: string, text: string): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const sent = await this.sock.sendMessage(jid, { text });
    return sent?.key?.id ?? null;
  }

  async stop(): Promise<void> {
    this._stopping = true;
    try {
      this.sock?.end(undefined);
    } catch {}
    this._status = 'disconnected';
  }
}
