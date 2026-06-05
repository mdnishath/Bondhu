# Server Plan 3a — Rich Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the non-AI rich-messaging features on top of Plan 2: incoming media download, image + recorded-voice send, reactions, reply, forward, delete, read receipts, and profile pictures.

**Architecture:** Messages gain a `raw` column holding the BufferJSON-encoded Baileys message so we can later download media, quote, or forward them. A new `reactions` table + `messages.reaction` handler tracks emoji. `WaConnection` gains action methods (react/reply/forward/delete/markRead/downloadMedia/sendImage/sendVoice/profilePic) that `AccountManager` exposes; new REST routes call them. Testable parts (repos, route wiring with a mocked manager) are TDD'd; live Baileys calls are verified by a smoke test.

**Tech Stack:** Builds on Plan 2. Adds `sharp` (image compress). Baileys provides `downloadMediaMessage`, `sendMessage({react|delete|forward|image|audio})`, `readMessages`, `profilePictureUrl`.

Working directory: `E:\New Whatsapp\server`. Builds on master (Plans 1+2 merged).

---

### Task 1: Install sharp

- [ ] **Step 1:** Run (in `server/`): `npm install sharp`
- [ ] **Step 2:** Verify: `node -e "import('sharp').then(s=>console.log(typeof s.default))"` → `function`
- [ ] **Step 3:** Commit: `git add server/package.json server/package-lock.json && git commit -m "chore(server): add sharp"`

---

### Task 2: messages.raw column + reactions table

**Files:**
- Modify: `server/src/db/schema.sql`
- Test: `server/src/db/schema.test.ts` (extend)

- [ ] **Step 1: Append to `schema.sql`** (after the messages index)

```sql
ALTER TABLE messages ADD COLUMN raw TEXT;

CREATE TABLE IF NOT EXISTS reactions (
  account_id TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  sender_jid TEXT NOT NULL,
  emoji TEXT NOT NULL,
  from_me INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, msg_id, sender_jid)
);
```

> NOTE: `ALTER TABLE ... ADD COLUMN` re-runs on every boot. Guard it: wrap the schema exec so a duplicate-column error is ignored. Implement in db.ts Step 2 below.

- [ ] **Step 2: Make `db.ts` tolerant of the idempotent ALTER.** Replace the `db.exec(schema)` call so each statement runs and a "duplicate column name" error is swallowed:

```typescript
// in createDb, replace `db.exec(schema)` with:
for (const stmt of schema.split(';')) {
  const sql = stmt.trim();
  if (!sql) continue;
  try {
    db.exec(sql);
  } catch (e: any) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
}
```

- [ ] **Step 3: Extend `schema.test.ts`** (append)

```typescript
test('messages.raw column and reactions table exist', () => {
  const db = createDb(':memory:');
  db.prepare('INSERT INTO messages (account_id,msg_id,chat_jid,timestamp,raw) VALUES (?,?,?,?,?)')
    .run('a1', 'm9', 'c@s.whatsapp.net', 1, '{"k":1}');
  db.prepare('INSERT INTO reactions (account_id,msg_id,sender_jid,emoji) VALUES (?,?,?,?)')
    .run('a1', 'm9', 's1', '❤️');
  expect((db.prepare('SELECT raw FROM messages WHERE msg_id=?').get('m9') as any).raw).toBe('{"k":1}');
  expect((db.prepare('SELECT emoji FROM reactions WHERE msg_id=?').get('m9') as any).emoji).toBe('❤️');
});
```

- [ ] **Step 4:** Run: `npx vitest run src/db/schema.test.ts` → PASS.
- [ ] **Step 5:** Commit: `git add server/src/db/schema.sql server/src/db/db.ts server/src/db/schema.test.ts && git commit -m "feat(server): add messages.raw column and reactions table"`

---

### Task 3: Store raw message + getRaw in MessagesRepo

**Files:**
- Modify: `server/src/db/repositories/messages.repo.ts`
- Modify: `server/src/db/repositories/messages.repo.test.ts`

- [ ] **Step 1: Add a failing test** (append)

```typescript
test('stores and returns raw message json', () => {
  const repo = new MessagesRepo(createDb(':memory:'));
  repo.upsert({ accountId: 'a1', msgId: 'm1', chatJid: 'c', senderJid: 's', fromMe: false, type: 'image', body: '[image]', timestamp: 1, ack: 0, raw: '{"x":2}' });
  expect(repo.getRaw('a1', 'm1')).toBe('{"x":2}');
  expect(repo.getRaw('a1', 'missing')).toBeUndefined();
});
```

- [ ] **Step 2:** Run → FAIL (raw not accepted / getRaw missing).

- [ ] **Step 3: Update `messages.repo.ts`** — add `raw?: string | null` to `UpsertMessage`, persist it, add `getRaw`:

In `UpsertMessage` interface add: `raw?: string | null;`

Change the `upsert` SQL to include `raw`:

```typescript
  upsert(m: UpsertMessage): void {
    this.db
      .prepare(
        `INSERT INTO messages (account_id,msg_id,chat_jid,sender_jid,from_me,type,body,timestamp,ack,raw)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(account_id,msg_id) DO UPDATE SET
           body=excluded.body, type=excluded.type, ack=MAX(messages.ack, excluded.ack),
           raw=COALESCE(excluded.raw, messages.raw)`,
      )
      .run(m.accountId, m.msgId, m.chatJid, m.senderJid, m.fromMe ? 1 : 0, m.type, m.body, m.timestamp, m.ack, m.raw ?? null);
  }

  getRaw(accountId: string, msgId: string): string | undefined {
    const r = this.db.prepare('SELECT raw FROM messages WHERE account_id=? AND msg_id=?').get(accountId, msgId) as any;
    return r?.raw ?? undefined;
  }
```

- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `git add server/src/db/repositories/messages.repo.ts server/src/db/repositories/messages.repo.test.ts && git commit -m "feat(server): store raw message json for media/reply/forward"`

---

### Task 4: Reactions repository

**Files:**
- Create: `server/src/db/repositories/reactions.repo.ts`
- Test: `server/src/db/repositories/reactions.repo.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { ReactionsRepo } from './reactions.repo.js';

test('set, replace, remove, and list reactions per message', () => {
  const repo = new ReactionsRepo(createDb(':memory:'));
  repo.set('a1', 'm1', 's1', '❤️', false);
  repo.set('a1', 'm1', 's2', '👍', false);
  expect(repo.listForMessage('a1', 'm1')).toHaveLength(2);
  repo.set('a1', 'm1', 's1', '😂', false); // replace s1's reaction
  const list = repo.listForMessage('a1', 'm1');
  expect(list.find((r) => r.senderJid === 's1')?.emoji).toBe('😂');
  repo.set('a1', 'm1', 's1', '', false); // empty removes
  expect(repo.listForMessage('a1', 'm1')).toHaveLength(1);
});
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Implement `reactions.repo.ts`**

```typescript
import type { DB } from '../db.js';

export interface Reaction {
  msgId: string;
  senderJid: string;
  emoji: string;
  fromMe: boolean;
}

export class ReactionsRepo {
  constructor(private db: DB) {}

  /** Empty emoji removes the sender's reaction (WhatsApp allows one per sender). */
  set(accountId: string, msgId: string, senderJid: string, emoji: string, fromMe: boolean): void {
    if (!emoji || !emoji.trim()) {
      this.db.prepare('DELETE FROM reactions WHERE account_id=? AND msg_id=? AND sender_jid=?')
        .run(accountId, msgId, senderJid);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO reactions (account_id,msg_id,sender_jid,emoji,from_me) VALUES (?,?,?,?,?)
         ON CONFLICT(account_id,msg_id,sender_jid) DO UPDATE SET emoji=excluded.emoji, from_me=excluded.from_me`,
      )
      .run(accountId, msgId, senderJid, emoji, fromMe ? 1 : 0);
  }

  listForMessage(accountId: string, msgId: string): Reaction[] {
    return (this.db.prepare('SELECT * FROM reactions WHERE account_id=? AND msg_id=?').all(accountId, msgId) as any[])
      .map((r) => ({ msgId: r.msg_id, senderJid: r.sender_jid, emoji: r.emoji, fromMe: !!r.from_me }));
  }

  listForChat(accountId: string, msgIds: string[]): Record<string, Reaction[]> {
    const out: Record<string, Reaction[]> = {};
    for (const id of msgIds) {
      const list = this.listForMessage(accountId, id);
      if (list.length) out[id] = list;
    }
    return out;
  }
}
```

- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `git add server/src/db/repositories/reactions.repo.ts server/src/db/repositories/reactions.repo.test.ts && git commit -m "feat(server): add reactions repository"`

---

### Task 5: WaConnection — store raw, action methods, reaction event

**Files:**
- Modify: `server/src/whatsapp/wa-connection.ts`
- Test: none (live); type-checked.

- [ ] **Step 1: Import BufferJSON + downloadMediaMessage** at the top:

```typescript
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  BufferJSON,
} from '@whiskeysockets/baileys';
import type { WASocket, proto, WAMessageKey } from '@whiskeysockets/baileys';
```

- [ ] **Step 2: Attach raw JSON to emitted messages.** In BOTH the `messages.upsert` and `messaging-history.set` handlers, set `norm.raw` before emitting:

In `messages.upsert`:
```typescript
        const norm = normalizeMessage(this.accountId, m);
        if (!norm) continue;
        norm.raw = JSON.stringify(m, BufferJSON.replacer);
```
In `messaging-history.set` message loop:
```typescript
        const norm = normalizeMessage(this.accountId, m);
        if (norm) {
          norm.raw = JSON.stringify(m, BufferJSON.replacer);
          this.emit('message', norm, true);
        }
```

- [ ] **Step 3: Add the reaction event handler** (after `messages.update`):

```typescript
    sock.ev.on('messages.reaction', (reactions) => {
      for (const r of reactions) {
        const msgId = r.key?.id;
        const emoji = r.reaction?.text ?? '';
        const fromMe = !!r.key?.fromMe;
        const sender = (r.reaction as any)?.key?.participant || (fromMe ? 'me' : (r.key?.remoteJid ?? 'unknown'));
        if (msgId) this.emit('reaction', msgId, emoji, fromMe, String(sender));
      }
    });
```

- [ ] **Step 4: Add action methods** (after `sendText`):

```typescript
  private keyFor(stored: { msgId: string; chatJid: string; fromMe: boolean; senderJid: string | null }): WAMessageKey {
    const key: WAMessageKey = { id: stored.msgId, remoteJid: stored.chatJid, fromMe: stored.fromMe };
    if (stored.chatJid.endsWith('@g.us') && stored.senderJid) key.participant = stored.senderJid;
    return key;
  }

  private parseRaw(raw: string): proto.IWebMessageInfo {
    return JSON.parse(raw, BufferJSON.reviver);
  }

  async react(stored: any, emoji: string): Promise<void> {
    if (!this.sock) throw new Error('Not connected');
    await this.sock.sendMessage(stored.chatJid, { react: { text: emoji, key: this.keyFor(stored) } });
  }

  async reply(jid: string, text: string, rawQuoted: string): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const quoted = this.parseRaw(rawQuoted);
    const sent = await this.sock.sendMessage(jid, { text }, { quoted });
    return sent?.key?.id ?? null;
  }

  async forward(targetJid: string, rawMsg: string): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const msg = this.parseRaw(rawMsg);
    const sent = await this.sock.sendMessage(targetJid, { forward: msg });
    return sent?.key?.id ?? null;
  }

  async deleteMessage(stored: any): Promise<void> {
    if (!this.sock) throw new Error('Not connected');
    await this.sock.sendMessage(stored.chatJid, { delete: this.keyFor(stored) });
  }

  async markRead(stored: any): Promise<void> {
    if (!this.sock) return;
    await this.sock.readMessages([this.keyFor(stored)]);
  }

  async sendImage(jid: string, buffer: Buffer, caption?: string): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const sent = await this.sock.sendMessage(jid, { image: buffer, caption: caption || undefined });
    return sent?.key?.id ?? null;
  }

  async sendVoice(jid: string, buffer: Buffer): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const sent = await this.sock.sendMessage(jid, { audio: buffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' });
    return sent?.key?.id ?? null;
  }

  async downloadMedia(rawMsg: string): Promise<{ buffer: Buffer; mime: string }> {
    const msg = this.parseRaw(rawMsg);
    const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
    const content: any = msg.message ?? {};
    const mime =
      content.imageMessage?.mimetype || content.audioMessage?.mimetype ||
      content.videoMessage?.mimetype || content.documentMessage?.mimetype || 'application/octet-stream';
    return { buffer, mime };
  }

  async profilePicUrl(jid: string): Promise<string | null> {
    if (!this.sock) return null;
    try {
      return await this.sock.profilePictureUrl(jid, 'image');
    } catch {
      return null;
    }
  }
```

- [ ] **Step 5: Type-check.** Run: `npx tsc --noEmit` → no errors. (If `WAMessageKey`/`proto` import names differ, adjust; current Baileys exports both.)
- [ ] **Step 6:** Commit: `git add server/src/whatsapp/wa-connection.ts && git commit -m "feat(server): add rich-messaging action methods to WaConnection"`

---

### Task 6: AccountManager — wire reactions, expose action methods

**Files:**
- Modify: `server/src/whatsapp/account-manager.ts`
- Modify: `server/src/whatsapp/account-manager.test.ts`

- [ ] **Step 1: Add a failing test** (append; uses the fake conn, extended with action spies)

```typescript
test('reaction event is stored and re-emitted', async () => {
  const { mgr, accounts, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  const got: any[] = [];
  mgr.on('reaction', (id, msgId, emoji) => got.push({ id, msgId, emoji }));
  conns[0].emit('reaction', 'm1', '❤️', false, 's1');
  expect(mgr.reactionsFor(acc.id, ['m1'])['m1']?.[0].emoji).toBe('❤️');
  expect(got[0]).toMatchObject({ msgId: 'm1', emoji: '❤️' });
});

test('action methods delegate to the connection with stored message', async () => {
  const { mgr, accounts, messages, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  conns[0].react = vi.fn(async () => {});
  conns[0].deleteMessage = vi.fn(async () => {});
  messages.upsert({ accountId: acc.id, msgId: 'm1', chatJid: 'c@s.whatsapp.net', senderJid: 's', fromMe: false, type: 'text', body: 'hi', timestamp: 1, ack: 0 });
  await mgr.react(acc.id, 'm1', '👍');
  await mgr.deleteForEveryone(acc.id, 'm1');
  expect(conns[0].react).toHaveBeenCalled();
  expect(conns[0].deleteMessage).toHaveBeenCalled();
});
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Update `account-manager.ts`** — accept a `ReactionsRepo`, wire the reaction event, and add delegating methods. Change the constructor signature to take `reactions`:

```typescript
import type { ReactionsRepo } from '../db/repositories/reactions.repo.js';
// ...
  constructor(
    private db: DB,
    private accounts: AccountsRepo,
    private chats: ChatsRepo,
    private messages: MessagesRepo,
    private reactions: ReactionsRepo,
    private factory: ConnFactory = (id, db) => new WaConnection(id, db),
  ) {
    super();
  }
```

In `wire()` add (after the `ack` handler):

```typescript
    conn.on('reaction', (msgId: string, emoji: string, fromMe: boolean, sender: string) => {
      this.reactions.set(id, msgId, sender, emoji, fromMe);
      this.emit('reaction', id, msgId, emoji, sender);
    });
```

Add these methods (after `sendText`):

```typescript
  private storedOrThrow(accountId: string, msgId: string) {
    const list = this.messages.listByChat; // ensure import present
    const row = (this as any).messages.getByIdRow?.(accountId, msgId);
    if (!row) throw new Error('message not found');
    return row;
  }

  reactionsFor(accountId: string, msgIds: string[]) {
    return this.reactions.listForChat(accountId, msgIds);
  }

  private getStored(accountId: string, msgId: string) {
    const m = this.messages.getById(accountId, msgId);
    if (!m) throw new Error('message not found');
    return m;
  }

  async react(accountId: string, msgId: string, emoji: string): Promise<void> {
    const conn = this.requireConn(accountId);
    const m = this.getStored(accountId, msgId);
    await conn.react(m, emoji);
    this.reactions.set(accountId, msgId, 'me', emoji, true);
  }

  async reply(accountId: string, jid: string, msgId: string, text: string): Promise<string | null> {
    const conn = this.requireConn(accountId);
    const raw = this.messages.getRaw(accountId, msgId);
    if (!raw) throw new Error('original message unavailable');
    const sentId = await conn.reply(jid, text, raw);
    if (sentId) this.storeOutgoing(accountId, jid, sentId, text);
    return sentId;
  }

  async forward(accountId: string, msgIds: string[], targetJids: string[]): Promise<number> {
    const conn = this.requireConn(accountId);
    let count = 0;
    for (const msgId of msgIds) {
      const raw = this.messages.getRaw(accountId, msgId);
      if (!raw) continue;
      for (const jid of targetJids) {
        try { await conn.forward(jid, raw); count++; } catch { /* skip */ }
      }
    }
    return count;
  }

  async deleteForEveryone(accountId: string, msgId: string): Promise<void> {
    const conn = this.requireConn(accountId);
    const m = this.getStored(accountId, msgId);
    await conn.deleteMessage(m);
    this.messages.markDeleted(accountId, msgId);
  }

  async markRead(accountId: string, jid: string): Promise<void> {
    this.chats.clearUnread(accountId, jid);
    const conn = this.conns.get(accountId);
    if (!conn) return;
    const latest = this.messages.listByChat(accountId, jid, 1).find((x) => !x.fromMe);
    if (latest) { try { await conn.markRead(this.messages.getById(accountId, latest.msgId)); } catch {} }
  }

  async sendImage(accountId: string, jid: string, buffer: Buffer, caption?: string): Promise<string | null> {
    const conn = this.requireConn(accountId);
    const sentId = await conn.sendImage(jid, buffer, caption);
    if (sentId) this.storeOutgoing(accountId, jid, sentId, caption ?? '[image]', 'image');
    return sentId;
  }

  async sendVoice(accountId: string, jid: string, buffer: Buffer): Promise<string | null> {
    const conn = this.requireConn(accountId);
    const sentId = await conn.sendVoice(jid, buffer);
    if (sentId) this.storeOutgoing(accountId, jid, sentId, '[voice]', 'ptt');
    return sentId;
  }

  async downloadMedia(accountId: string, msgId: string): Promise<{ buffer: Buffer; mime: string }> {
    const conn = this.requireConn(accountId);
    const raw = this.messages.getRaw(accountId, msgId);
    if (!raw) throw new Error('media unavailable');
    return conn.downloadMedia(raw);
  }

  async profilePic(accountId: string, jid: string): Promise<string | null> {
    const conn = this.conns.get(accountId);
    return conn ? conn.profilePicUrl(jid) : null;
  }

  private requireConn(accountId: string): any {
    const conn = this.conns.get(accountId);
    if (!conn) throw new Error('Account not connected');
    return conn;
  }

  private storeOutgoing(accountId: string, jid: string, msgId: string, body: string, type = 'text'): void {
    const ts = Date.now();
    this.messages.upsert({ accountId, msgId, chatJid: jid, senderJid: null, fromMe: true, type, body, timestamp: ts, ack: 1 });
    this.chats.touch(accountId, jid, { lastMessageAt: ts, preview: body });
    this.emit('chat_update', accountId, jid);
  }
```

> Remove the now-unused `storedOrThrow` helper if your linter complains — it is replaced by `getStored`. (Kept out of the final file.)

- [ ] **Step 4: Add `getById` and `markDeleted` to MessagesRepo** (needed above):

In `messages.repo.ts` add:
```typescript
  getById(accountId: string, msgId: string): Message | undefined {
    const r = this.db.prepare('SELECT * FROM messages WHERE account_id=? AND msg_id=?').get(accountId, msgId) as any;
    return r ? this.map(r) : undefined;
  }

  markDeleted(accountId: string, msgId: string): void {
    this.db.prepare('UPDATE messages SET body=?, type=? WHERE account_id=? AND msg_id=?')
      .run('[deleted]', 'deleted', accountId, msgId);
  }
```

And delete the `storedOrThrow` stub from the manager (do not ship it).

- [ ] **Step 5: Update all `new AccountManager(...)` call sites** to pass `reactions`:
- `app-context.ts`: create `const reactions = new ReactionsRepo(db);` and pass it; export `reactions` on the context.
- `account-manager.test.ts` `makeManager()`: create `new ReactionsRepo(db)` and pass it.

- [ ] **Step 6:** Run: `npx vitest run src/whatsapp/account-manager.test.ts` → PASS.
- [ ] **Step 7:** Commit: `git add server/src/whatsapp/account-manager.ts server/src/whatsapp/account-manager.test.ts server/src/db/repositories/messages.repo.ts server/src/app-context.ts server/src/app-context.test.ts && git commit -m "feat(server): wire reactions + rich-messaging methods in manager"`

---

### Task 7: Attach reactions to message reads + context wiring

**Files:**
- Modify: `server/src/app-context.ts` (add `reactions` field — done in Task 6 Step 5)
- Modify: `server/src/api/socket-gateway.ts` (relay `reaction` event)

- [ ] **Step 1: Relay reactions over the socket.** In `socket-gateway.ts` add:

```typescript
  ctx.manager.on('reaction', (accountId: string, msgId: string, emoji: string, sender: string) =>
    toUserRoom(accountId, 'message_reaction', { msgId, emoji, sender }),
  );
```

- [ ] **Step 2:** Run full suite: `npm test` → PASS.
- [ ] **Step 3:** Commit: `git add server/src/api/socket-gateway.js server/src/api/socket-gateway.ts && git commit -m "feat(server): relay reactions over socket"` (only the .ts exists; adjust).

---

### Task 8: Rich-messaging routes

**Files:**
- Modify: `server/src/api/routes/whatsapp.routes.ts`
- Modify: `server/src/api/whatsapp.routes.test.ts`

- [ ] **Step 1: Add failing tests** (append; manager methods stubbed)

```typescript
test('react, reply, delete, forward, send-image, send-recorded routes call the manager', async () => {
  const { ctx, app, token } = await authed();
  ctx.manager.react = vi.fn(async () => {}) as any;
  ctx.manager.reply = vi.fn(async () => 'r1') as any;
  ctx.manager.deleteForEveryone = vi.fn(async () => {}) as any;
  ctx.manager.forward = vi.fn(async () => 2) as any;
  ctx.manager.sendImage = vi.fn(async () => 'i1') as any;
  ctx.manager.sendVoice = vi.fn(async () => 'v1') as any;
  const created = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({});
  const acc = created.body.accountId;
  const H = { Authorization: `Bearer ${token}` };

  expect((await request(app).post(`/api/react?account=${acc}`).set(H).send({ msgId: 'm1', emoji: '❤️' })).body.success).toBe(true);
  expect((await request(app).post(`/api/reply?account=${acc}`).set(H).send({ chatId: 'c', msgId: 'm1', text: 'yo' })).body.success).toBe(true);
  expect((await request(app).post(`/api/delete-message?account=${acc}`).set(H).send({ msgId: 'm1', forEveryone: true })).body.success).toBe(true);
  expect((await request(app).post(`/api/forward?account=${acc}`).set(H).send({ msgIds: ['m1'], targetChatIds: ['c'] })).body.forwarded).toBe(2);

  const b64 = Buffer.from('hello').toString('base64');
  expect((await request(app).post(`/api/send-image?account=${acc}`).set(H).send({ chatId: 'c', imageBase64: b64, mimeType: 'image/png' })).body.success).toBe(true);
  expect((await request(app).post(`/api/send-recorded?account=${acc}`).set(H).send({ chatId: 'c', audioBase64: b64, mimeType: 'audio/ogg' })).body.success).toBe(true);
});
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Add routes** to `whatsappRoutes` (before `return r;`). Add `import sharp from 'sharp';` at top.

```typescript
  r.post('/react', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { msgId, emoji } = req.body ?? {};
    try { await ctx.manager.react(accountId, msgId, emoji ?? ''); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/reply', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { chatId, msgId, text } = req.body ?? {};
    try { const id = await ctx.manager.reply(accountId, chatId, msgId, text); res.json({ success: true, msgId: id }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/delete-message', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { msgId } = req.body ?? {};
    try { await ctx.manager.deleteForEveryone(accountId, msgId); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/forward', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { msgIds, targetChatIds } = req.body ?? {};
    try { const n = await ctx.manager.forward(accountId, msgIds ?? [], targetChatIds ?? []); res.json({ success: true, forwarded: n }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/send-image', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { chatId, imageBase64, caption } = req.body ?? {};
    if (!chatId || !imageBase64) return res.status(400).json({ error: 'chatId and imageBase64 required' });
    try {
      const input = Buffer.from(imageBase64, 'base64');
      const jpeg = await sharp(input).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
      const id = await ctx.manager.sendImage(accountId, chatId, jpeg, caption);
      res.json({ success: true, msgId: id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/send-recorded', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { chatId, audioBase64 } = req.body ?? {};
    if (!chatId || !audioBase64) return res.status(400).json({ error: 'chatId and audioBase64 required' });
    try {
      const buf = Buffer.from(audioBase64, 'base64');
      const id = await ctx.manager.sendVoice(accountId, chatId, buf);
      res.json({ success: true, msgId: id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.get('/media/:msgId', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    try {
      const { buffer, mime } = await ctx.manager.downloadMedia(accountId, req.params.msgId);
      res.setHeader('Content-Type', mime);
      res.send(buffer);
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  r.get('/profile-pic', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const id = req.query.id as string;
    res.json({ id, url: await ctx.manager.profilePic(accountId, id) });
  });
```

Also update the existing `mark-read` route body to push the WA receipt:
```typescript
  r.post('/chats/:chatId/mark-read', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    await ctx.manager.markRead(accountId, req.params.chatId);
    res.json({ success: true });
  });
```

- [ ] **Step 4:** Run: `npx vitest run src/api/whatsapp.routes.test.ts` → PASS.
- [ ] **Step 5:** Commit: `git add server/src/api/routes/whatsapp.routes.ts server/src/api/whatsapp.routes.test.ts && git commit -m "feat(server): add rich-messaging routes (react/reply/delete/forward/media/image/voice)"`

---

### Task 9: Attach reactions to message list responses

**Files:**
- Modify: `server/src/api/routes/whatsapp.routes.ts` (the `/messages/:chatId` handler)

- [ ] **Step 1: Enrich the messages response with reactions.** Replace the `/messages/:chatId` handler body:

```typescript
  r.get('/messages/:chatId', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const limit = Number(req.query.limit ?? 50);
    const before = req.query.before ? Number(req.query.before) : undefined;
    const messages = ctx.messages.listByChat(accountId, req.params.chatId, limit, before);
    const reactions = ctx.manager.reactionsFor(accountId, messages.map((m) => m.msgId));
    res.json({ messages: messages.map((m) => ({ ...m, reactions: reactions[m.msgId] ?? [] })) });
  });
```

- [ ] **Step 2:** Run: `npm test` → PASS (existing messages test still green; reactions default to []).
- [ ] **Step 3:** Commit: `git add server/src/api/routes/whatsapp.routes.ts && git commit -m "feat(server): include reactions in message list responses"`

---

### Task 10: Full suite + type-check + live smoke test

- [ ] **Step 1:** Run: `npm test` → all PASS.
- [ ] **Step 2:** Run: `npx tsc --noEmit` → no errors.
- [ ] **Step 3: Live smoke test (requires the user's phone — re-pair as in Plan 2):**
  1. Start server, register, create account, pair (pairing code), connect, wait for history sync.
  2. Pick a chat with media; `GET /api/media/<imageMsgId>?account=<id>&token=<jwt>` → returns the image bytes.
  3. `POST /api/react {msgId, emoji:"❤️"}` → reaction appears in WhatsApp.
  4. `POST /api/send-image {chatId, imageBase64, mimeType}` → image arrives.
  5. `POST /api/reply {chatId, msgId, text}` → quoted reply arrives.
  6. `POST /api/delete-message {msgId, forEveryone:true}` → message deleted in WhatsApp.
  7. `GET /api/profile-pic?id=<jid>` → returns a URL.
  Expected: each action reflects in the real WhatsApp app.
- [ ] **Step 4:** Final commit if any cleanup: `git commit -am "chore(server): plan 3a verified"` (skip if nothing changed).

---

## Self-Review

- **Spec coverage (server/DESIGN.md §4.5, §6 media/actions):** media download (Task 8 `/media`), image send (8), recorded-voice send (8), reactions store+send+relay (4,5,6,7,8,9), reply (6,8), forward (6,8), delete (6,8), read receipts (6,8 mark-read), profile pics (6,8), raw storage enabling all of the above (2,3,5). AI (translation/TTS/STT), text→voice, retry queue, per-chat language → Plan 3b.
- **Placeholder scan:** none — every code step is complete. (Task 6 Step 3 includes a `storedOrThrow` stub that Step 4 explicitly says to delete before shipping.)
- **Type consistency:** `AccountManager` constructor gains `reactions: ReactionsRepo` (updated at all call sites: app-context, test). `getStored`/`getById` return the `Message` row used by `keyFor`. `UpsertMessage.raw` flows normalize→WaConnection→MessagesRepo. Routes use the same `ownAccount` guard + `?account=` pattern as Plan 2.
- **Live-only risk:** Task 5 Baileys calls (`downloadMediaMessage`, `sendMessage({react|delete|forward})`, `readMessages`, `profilePictureUrl`) are verified by Task 10 smoke test; adjust import names if the installed version differs.
