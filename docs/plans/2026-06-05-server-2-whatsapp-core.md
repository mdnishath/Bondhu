# Server Plan 2 — WhatsApp Core (Baileys) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link real WhatsApp accounts via Baileys (QR + pairing code), persist chats/messages in SQLite, and expose them over REST + Socket.IO with live text send/receive.

**Architecture:** A SQLite-backed Baileys auth-state adapter persists credentials. `WaConnection` wraps one `makeWASocket` per account and emits normalized domain events. `EventBridge` writes those events into `chats`/`messages` repos and re-emits to a socket gateway. `AccountManager` owns all connections. New REST routes expose accounts, chats, messages, and send-text; the unit-testable parts (repos, auth adapter, message normalization, routes with a mocked manager) are TDD'd, while the live socket is verified by a manual smoke test (scan QR → see chats).

**Tech Stack:** @whiskeysockets/baileys, @hapi/boom, pino, socket.io (adds to Plan 1's Express/SQLite stack).

Working directory for all paths: `E:\New Whatsapp\server`. This plan builds on Plan 1 (merged to master).

---

### Task 1: Install Baileys deps

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Add dependencies**

Run (in `server/`):
`npm install @whiskeysockets/baileys @hapi/boom pino socket.io`
`npm install -D @types/qrcode`

- [ ] **Step 2: Verify Baileys imports**

Run: `node -e "import('@whiskeysockets/baileys').then(m=>console.log(typeof m.default, typeof m.initAuthCreds))"`
Expected: `function function`

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore(server): add baileys, socket.io deps"
```

---

### Task 2: Extend schema with chats + messages tables

**Files:**
- Modify: `server/src/db/schema.sql`
- Test: `server/src/db/schema.test.ts`

- [ ] **Step 1: Append tables to `schema.sql`** (after the existing tables)

```sql
CREATE TABLE IF NOT EXISTS chats (
  account_id TEXT NOT NULL,
  jid TEXT NOT NULL,
  name TEXT,
  is_group INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, jid)
);

CREATE TABLE IF NOT EXISTS messages (
  account_id TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  sender_jid TEXT,
  from_me INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  timestamp INTEGER NOT NULL,
  ack INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, msg_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat
  ON messages (account_id, chat_jid, timestamp);
```

- [ ] **Step 2: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from './db.js';

test('chats and messages tables exist', () => {
  const db = createDb(':memory:');
  db.prepare('INSERT INTO chats (account_id,jid) VALUES (?,?)').run('a1', 'j@s.whatsapp.net');
  db.prepare('INSERT INTO messages (account_id,msg_id,chat_jid,timestamp) VALUES (?,?,?,?)')
    .run('a1', 'm1', 'j@s.whatsapp.net', 1);
  const c = db.prepare('SELECT jid FROM chats WHERE account_id=?').get('a1') as any;
  const m = db.prepare('SELECT msg_id FROM messages WHERE account_id=?').get('a1') as any;
  expect(c.jid).toBe('j@s.whatsapp.net');
  expect(m.msg_id).toBe('m1');
});
```

- [ ] **Step 3: Run test to verify it fails (before editing schema) then passes (after)**

Run: `npx vitest run src/db/schema.test.ts`
Expected after Step 1 edit: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/schema.sql server/src/db/schema.test.ts
git commit -m "feat(server): add chats and messages tables"
```

---

### Task 3: Accounts repository

**Files:**
- Create: `server/src/db/repositories/accounts.repo.ts`
- Test: `server/src/db/repositories/accounts.repo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { AccountsRepo } from './accounts.repo.js';

test('create, list by user, update status, rename, delete', () => {
  const repo = new AccountsRepo(createDb(':memory:'));
  const acc = repo.create({ userId: 'u1', label: 'Primary' });
  expect(acc.id).toMatch(/^account-/);
  expect(repo.listByUser('u1')).toHaveLength(1);
  repo.updateStatus(acc.id, 'connected');
  expect(repo.findById(acc.id)?.status).toBe('connected');
  repo.rename(acc.id, '8801700000000', '8801700000000');
  const renamed = repo.findById('8801700000000');
  expect(renamed?.phone).toBe('8801700000000');
  expect(repo.findById(acc.id)).toBeUndefined();
  repo.remove('8801700000000');
  expect(repo.listByUser('u1')).toHaveLength(0);
});

test('isOwnedByUser guards ownership', () => {
  const repo = new AccountsRepo(createDb(':memory:'));
  const acc = repo.create({ userId: 'u1' });
  expect(repo.isOwnedByUser(acc.id, 'u1')).toBe(true);
  expect(repo.isOwnedByUser(acc.id, 'u2')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/repositories/accounts.repo.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `accounts.repo.ts`**

```typescript
import { randomUUID } from 'crypto';
import type { DB } from '../db.js';

export interface Account {
  id: string;
  userId: string;
  label: string | null;
  phone: string | null;
  status: string | null;
  createdAt: number;
}

export class AccountsRepo {
  constructor(private db: DB) {}

  create(input: { userId: string; label?: string }): Account {
    const acc: Account = {
      id: `account-${randomUUID()}`,
      userId: input.userId,
      label: input.label ?? null,
      phone: null,
      status: 'disconnected',
      createdAt: Date.now(),
    };
    this.db
      .prepare('INSERT INTO accounts (id,user_id,label,phone,status,created_at) VALUES (?,?,?,?,?,?)')
      .run(acc.id, acc.userId, acc.label, acc.phone, acc.status, acc.createdAt);
    return acc;
  }

  listByUser(userId: string): Account[] {
    return (this.db.prepare('SELECT * FROM accounts WHERE user_id=? ORDER BY created_at').all(userId) as any[])
      .map((r) => this.map(r));
  }

  findById(id: string): Account | undefined {
    const r = this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id) as any;
    return r ? this.map(r) : undefined;
  }

  updateStatus(id: string, status: string): void {
    this.db.prepare('UPDATE accounts SET status=? WHERE id=?').run(status, id);
  }

  /** Rename ephemeral id -> phone-based id once WhatsApp reveals the number. */
  rename(oldId: string, newId: string, phone: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE accounts SET id=?, phone=? WHERE id=?').run(newId, phone, oldId);
      this.db.prepare('UPDATE auth_state SET account_id=? WHERE account_id=?').run(newId, oldId);
    });
    tx();
  }

  remove(id: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM accounts WHERE id=?').run(id);
      this.db.prepare('DELETE FROM auth_state WHERE account_id=?').run(id);
      this.db.prepare('DELETE FROM chats WHERE account_id=?').run(id);
      this.db.prepare('DELETE FROM messages WHERE account_id=?').run(id);
    });
    tx();
  }

  isOwnedByUser(id: string, userId: string): boolean {
    const r = this.db.prepare('SELECT 1 FROM accounts WHERE id=? AND user_id=?').get(id, userId);
    return !!r;
  }

  private map(r: any): Account {
    return { id: r.id, userId: r.user_id, label: r.label, phone: r.phone, status: r.status, createdAt: r.created_at };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/repositories/accounts.repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/repositories/accounts.repo.ts server/src/db/repositories/accounts.repo.test.ts
git commit -m "feat(server): add accounts repository"
```

---

### Task 4: Chats repository

**Files:**
- Create: `server/src/db/repositories/chats.repo.ts`
- Test: `server/src/db/repositories/chats.repo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { ChatsRepo } from './chats.repo.js';

test('upsert merges and list orders by recency', () => {
  const repo = new ChatsRepo(createDb(':memory:'));
  repo.upsert('a1', { jid: 'x@s.whatsapp.net', name: 'X', isGroup: false });
  repo.upsert('a1', { jid: 'y@s.whatsapp.net', name: 'Y', isGroup: false });
  repo.touch('a1', 'x@s.whatsapp.net', { lastMessageAt: 100, preview: 'hi', incUnread: true });
  repo.touch('a1', 'y@s.whatsapp.net', { lastMessageAt: 200, preview: 'yo' });
  const list = repo.list('a1', 10, 0);
  expect(list[0].jid).toBe('y@s.whatsapp.net');
  expect(list[1].unreadCount).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/repositories/chats.repo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `chats.repo.ts`**

```typescript
import type { DB } from '../db.js';

export interface Chat {
  jid: string;
  name: string | null;
  isGroup: boolean;
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export class ChatsRepo {
  constructor(private db: DB) {}

  upsert(accountId: string, c: { jid: string; name?: string; isGroup?: boolean }): void {
    this.db
      .prepare(
        `INSERT INTO chats (account_id,jid,name,is_group) VALUES (?,?,?,?)
         ON CONFLICT(account_id,jid) DO UPDATE SET
           name=COALESCE(excluded.name, chats.name),
           is_group=excluded.is_group`,
      )
      .run(accountId, c.jid, c.name ?? null, c.isGroup ? 1 : 0);
  }

  touch(
    accountId: string,
    jid: string,
    o: { lastMessageAt: number; preview: string; incUnread?: boolean },
  ): void {
    this.upsert(accountId, { jid });
    this.db
      .prepare(
        `UPDATE chats SET last_message_at=?, last_message_preview=?,
           unread_count=unread_count + ?
         WHERE account_id=? AND jid=?`,
      )
      .run(o.lastMessageAt, o.preview, o.incUnread ? 1 : 0, accountId, jid);
  }

  clearUnread(accountId: string, jid: string): void {
    this.db.prepare('UPDATE chats SET unread_count=0 WHERE account_id=? AND jid=?').run(accountId, jid);
  }

  list(accountId: string, limit: number, offset: number): Chat[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM chats WHERE account_id=?
           ORDER BY COALESCE(last_message_at,0) DESC LIMIT ? OFFSET ?`,
        )
        .all(accountId, limit, offset) as any[]
    ).map((r) => this.map(r));
  }

  private map(r: any): Chat {
    return {
      jid: r.jid,
      name: r.name,
      isGroup: !!r.is_group,
      lastMessageAt: r.last_message_at,
      lastMessagePreview: r.last_message_preview,
      unreadCount: r.unread_count,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/repositories/chats.repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/repositories/chats.repo.ts server/src/db/repositories/chats.repo.test.ts
git commit -m "feat(server): add chats repository"
```

---

### Task 5: Messages repository

**Files:**
- Create: `server/src/db/repositories/messages.repo.ts`
- Test: `server/src/db/repositories/messages.repo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { MessagesRepo } from './messages.repo.js';

test('upsert is idempotent and list returns newest-first within a chat', () => {
  const repo = new MessagesRepo(createDb(':memory:'));
  const base = { accountId: 'a1', chatJid: 'c@s.whatsapp.net', senderJid: 's', fromMe: false, type: 'text' };
  repo.upsert({ ...base, msgId: 'm1', body: 'one', timestamp: 100, ack: 0 });
  repo.upsert({ ...base, msgId: 'm2', body: 'two', timestamp: 200, ack: 0 });
  repo.upsert({ ...base, msgId: 'm1', body: 'one', timestamp: 100, ack: 0 }); // dup
  const list = repo.listByChat('a1', 'c@s.whatsapp.net', 10);
  expect(list).toHaveLength(2);
  expect(list[0].msgId).toBe('m2');
  repo.setAck('a1', 'm2', 3);
  expect(repo.listByChat('a1', 'c@s.whatsapp.net', 10).find((m) => m.msgId === 'm2')?.ack).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/repositories/messages.repo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `messages.repo.ts`**

```typescript
import type { DB } from '../db.js';

export interface Message {
  msgId: string;
  chatJid: string;
  senderJid: string | null;
  fromMe: boolean;
  type: string;
  body: string | null;
  timestamp: number;
  ack: number;
}

export interface UpsertMessage {
  accountId: string;
  msgId: string;
  chatJid: string;
  senderJid: string | null;
  fromMe: boolean;
  type: string;
  body: string | null;
  timestamp: number;
  ack: number;
}

export class MessagesRepo {
  constructor(private db: DB) {}

  upsert(m: UpsertMessage): void {
    this.db
      .prepare(
        `INSERT INTO messages (account_id,msg_id,chat_jid,sender_jid,from_me,type,body,timestamp,ack)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(account_id,msg_id) DO UPDATE SET
           body=excluded.body, type=excluded.type, ack=MAX(messages.ack, excluded.ack)`,
      )
      .run(m.accountId, m.msgId, m.chatJid, m.senderJid, m.fromMe ? 1 : 0, m.type, m.body, m.timestamp, m.ack);
  }

  setAck(accountId: string, msgId: string, ack: number): void {
    this.db
      .prepare('UPDATE messages SET ack=MAX(ack,?) WHERE account_id=? AND msg_id=?')
      .run(ack, accountId, msgId);
  }

  listByChat(accountId: string, chatJid: string, limit: number, before?: number): Message[] {
    const beforeTs = before ?? Number.MAX_SAFE_INTEGER;
    return (
      this.db
        .prepare(
          `SELECT * FROM messages WHERE account_id=? AND chat_jid=? AND timestamp < ?
           ORDER BY timestamp DESC LIMIT ?`,
        )
        .all(accountId, chatJid, beforeTs, limit) as any[]
    ).map((r) => this.map(r));
  }

  private map(r: any): Message {
    return {
      msgId: r.msg_id,
      chatJid: r.chat_jid,
      senderJid: r.sender_jid,
      fromMe: !!r.from_me,
      type: r.type,
      body: r.body,
      timestamp: r.timestamp,
      ack: r.ack,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/repositories/messages.repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/repositories/messages.repo.ts server/src/db/repositories/messages.repo.test.ts
git commit -m "feat(server): add messages repository"
```

---

### Task 6: Message normalization (pure function)

**Files:**
- Create: `server/src/whatsapp/normalize.ts`
- Test: `server/src/whatsapp/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { normalizeMessage } from './normalize.js';

test('normalizes a plain text message', () => {
  const waMsg = {
    key: { id: 'ABC', remoteJid: 'c@s.whatsapp.net', fromMe: false },
    pushName: 'Alice',
    messageTimestamp: 1700,
    message: { conversation: 'hello' },
  };
  const n = normalizeMessage('a1', waMsg);
  expect(n).toEqual({
    accountId: 'a1',
    msgId: 'ABC',
    chatJid: 'c@s.whatsapp.net',
    senderJid: 'c@s.whatsapp.net',
    fromMe: false,
    type: 'text',
    body: 'hello',
    timestamp: 1700000,
    ack: 0,
  });
});

test('extracts extended text and falls back to placeholder for media', () => {
  const ext = normalizeMessage('a1', {
    key: { id: 'X', remoteJid: 'c@s.whatsapp.net', fromMe: true },
    messageTimestamp: 1,
    message: { extendedTextMessage: { text: 'hi there' } },
  });
  expect(ext.body).toBe('hi there');
  expect(ext.fromMe).toBe(true);

  const img = normalizeMessage('a1', {
    key: { id: 'Y', remoteJid: 'c@s.whatsapp.net', fromMe: false },
    messageTimestamp: 1,
    message: { imageMessage: { caption: 'pic' } },
  });
  expect(img.type).toBe('image');
  expect(img.body).toBe('pic');
});

test('returns null for messages without a key id', () => {
  expect(normalizeMessage('a1', { message: { conversation: 'x' } } as any)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/whatsapp/normalize.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `normalize.ts`**

```typescript
import type { UpsertMessage } from '../db/repositories/messages.repo.js';

/** Convert a Baileys WAMessage-ish object into our domain UpsertMessage.
 *  Returns null if the message has no usable id. */
export function normalizeMessage(accountId: string, m: any): UpsertMessage | null {
  const msgId = m?.key?.id;
  const chatJid = m?.key?.remoteJid;
  if (!msgId || !chatJid) return null;

  const fromMe = !!m.key.fromMe;
  const content = m.message ?? {};
  let type = 'text';
  let body: string | null = null;

  if (typeof content.conversation === 'string') {
    body = content.conversation;
  } else if (content.extendedTextMessage?.text != null) {
    body = content.extendedTextMessage.text;
  } else if (content.imageMessage) {
    type = 'image';
    body = content.imageMessage.caption ?? '[image]';
  } else if (content.videoMessage) {
    type = 'video';
    body = content.videoMessage.caption ?? '[video]';
  } else if (content.audioMessage) {
    type = content.audioMessage.ptt ? 'ptt' : 'audio';
    body = '[voice]';
  } else if (content.documentMessage) {
    type = 'document';
    body = content.documentMessage.fileName ?? '[document]';
  } else if (content.stickerMessage) {
    type = 'sticker';
    body = '[sticker]';
  } else {
    body = '[message]';
  }

  // sender: in groups it's key.participant; in 1:1 it's the remoteJid
  const senderJid = fromMe ? chatJid : (m.key.participant ?? chatJid);

  const tsRaw = Number(m.messageTimestamp ?? 0);
  const timestamp = tsRaw < 1e12 ? tsRaw * 1000 : tsRaw; // seconds -> ms

  return { accountId, msgId, chatJid, senderJid, fromMe, type, body, timestamp, ack: 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/whatsapp/normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/whatsapp/normalize.ts server/src/whatsapp/normalize.test.ts
git commit -m "feat(server): add message normalization"
```

---

### Task 7: SQLite-backed Baileys auth-state adapter

**Files:**
- Create: `server/src/whatsapp/auth-state.ts`
- Test: `server/src/whatsapp/auth-state.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from '../db/db.js';
import { useSqliteAuthState } from './auth-state.js';

test('persists creds and signal keys across reloads', async () => {
  const db = createDb(':memory:');
  const a = await useSqliteAuthState(db, 'acc1');
  expect(a.state.creds).toBeTruthy();
  await a.state.keys.set({ 'pre-key': { '1': { public: new Uint8Array([1, 2, 3]) } as any } });
  await a.saveCreds();

  const b = await useSqliteAuthState(db, 'acc1');
  const got = await b.state.keys.get('pre-key', ['1']);
  expect(got['1']).toBeTruthy();
  // creds object is restored (same registration id type)
  expect(b.state.creds.registrationId).toBe(a.state.creds.registrationId);
});

test('isolates keys per account', async () => {
  const db = createDb(':memory:');
  const a = await useSqliteAuthState(db, 'accA');
  await a.state.keys.set({ session: { 's1': { foo: 1 } as any } });
  const other = await useSqliteAuthState(db, 'accB');
  const got = await other.state.keys.get('session', ['s1']);
  expect(got['s1']).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/whatsapp/auth-state.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `auth-state.ts`**

```typescript
import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import type { AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys';
import type { DB } from '../db/db.js';

/** SQLite implementation of Baileys' multi-file auth state.
 *  Rows live in auth_state(account_id, key, value) where value is BufferJSON. */
export async function useSqliteAuthState(
  db: DB,
  accountId: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const readData = (key: string): any => {
    const row = db.prepare('SELECT value FROM auth_state WHERE account_id=? AND key=?').get(accountId, key) as any;
    return row ? JSON.parse(row.value, BufferJSON.reviver) : null;
  };
  const writeData = (key: string, value: any): void => {
    const json = JSON.stringify(value, BufferJSON.replacer);
    db.prepare(
      `INSERT INTO auth_state (account_id,key,value) VALUES (?,?,?)
       ON CONFLICT(account_id,key) DO UPDATE SET value=excluded.value`,
    ).run(accountId, key, json);
  };
  const removeData = (key: string): void => {
    db.prepare('DELETE FROM auth_state WHERE account_id=? AND key=?').run(accountId, key);
  };

  const creds = readData('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const out: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            let value = readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            if (value) out[id] = value;
          }
          return out;
        },
        set: async (data: any) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) writeData(key, value);
              else removeData(key);
            }
          }
        },
      },
    },
    saveCreds: async () => writeData('creds', creds),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/whatsapp/auth-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/whatsapp/auth-state.ts server/src/whatsapp/auth-state.test.ts
git commit -m "feat(server): add sqlite baileys auth-state adapter"
```

---

### Task 8: WaConnection (Baileys socket wrapper)

**Files:**
- Create: `server/src/whatsapp/wa-connection.ts`
- Test: none (live socket; verified by smoke test in Task 13). Type-checked only.

- [ ] **Step 1: Implement `wa-connection.ts`**

```typescript
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
 *  'ack'(msgId, ack), 'chat'(jid, name, isGroup), 'phone'(number), 'ready'() */
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

    const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        this._qr = qr;
        this._status = 'qr_pending';
        this.emit('qr', qr);
        this.emit('status', this._status);
        // If a pairing phone was supplied and we're not yet registered, request a code.
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
          return; // do not reconnect; caller clears auth
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
      for (const u of updates) {
        const ack = u.update?.status;
        if (u.key?.id && typeof ack === 'number') this.emit('ack', u.key.id, ack);
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If Baileys type names differ in the installed version, adjust the `import type` line — `WASocket` is exported by current Baileys.)

- [ ] **Step 3: Commit**

```bash
git add server/src/whatsapp/wa-connection.ts
git commit -m "feat(server): add WaConnection baileys wrapper"
```

---

### Task 9: AccountManager + EventBridge

**Files:**
- Create: `server/src/whatsapp/account-manager.ts`
- Test: `server/src/whatsapp/account-manager.test.ts` (uses a fake connection factory)

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { createDb } from '../db/db.js';
import { AccountsRepo } from '../db/repositories/accounts.repo.js';
import { ChatsRepo } from '../db/repositories/chats.repo.js';
import { MessagesRepo } from '../db/repositories/messages.repo.js';
import { AccountManager } from './account-manager.js';

function fakeConn(accountId: string) {
  const e = new EventEmitter() as any;
  e.accountId = accountId;
  e.status = 'disconnected';
  e.qr = null;
  e.start = vi.fn(async () => {});
  e.stop = vi.fn(async () => {});
  e.sendText = vi.fn(async () => 'sent-1');
  return e;
}

function makeManager() {
  const db = createDb(':memory:');
  const accounts = new AccountsRepo(db);
  const chats = new ChatsRepo(db);
  const messages = new MessagesRepo(db);
  const conns: any[] = [];
  const mgr = new AccountManager(db, accounts, chats, messages, (id) => {
    const c = fakeConn(id);
    conns.push(c);
    return c;
  });
  return { mgr, accounts, chats, messages, conns };
}

test('start persists incoming message + chat and re-emits', async () => {
  const { mgr, accounts, chats, messages, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  const conn = conns[0];

  const events: any[] = [];
  mgr.on('message', (m) => events.push(m));

  conn.emit('chat', 'c@s.whatsapp.net', 'C', false);
  conn.emit('message', {
    accountId: acc.id, msgId: 'm1', chatJid: 'c@s.whatsapp.net', senderJid: 'c@s.whatsapp.net',
    fromMe: false, type: 'text', body: 'hi', timestamp: 1000, ack: 0,
  });

  expect(messages.listByChat(acc.id, 'c@s.whatsapp.net', 10)).toHaveLength(1);
  expect(chats.list(acc.id, 10, 0)[0].lastMessagePreview).toBe('hi');
  expect(events).toHaveLength(1);
});

test('phone event renames account', async () => {
  const { mgr, accounts, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  conns[0].emit('phone', '8801711111111');
  expect(accounts.findById('8801711111111')?.phone).toBe('8801711111111');
});

test('sendText stores an outgoing message', async () => {
  const { mgr, accounts, messages, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  const id = await mgr.sendText(acc.id, 'c@s.whatsapp.net', 'yo');
  expect(id).toBe('sent-1');
  expect(messages.listByChat(acc.id, 'c@s.whatsapp.net', 10)[0].body).toBe('yo');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/whatsapp/account-manager.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `account-manager.ts`**

```typescript
import { EventEmitter } from 'events';
import type { DB } from '../db/db.js';
import type { AccountsRepo } from '../db/repositories/accounts.repo.js';
import type { ChatsRepo } from '../db/repositories/chats.repo.js';
import type { MessagesRepo } from '../db/repositories/messages.repo.js';
import type { UpsertMessage } from '../db/repositories/messages.repo.js';
import { WaConnection } from './wa-connection.js';

export type ConnFactory = (accountId: string, db: DB) => any;

/** Owns all WaConnections, persists their events, and re-emits for the gateway.
 *  Re-emitted events: 'message'(accountId,msg), 'status'(accountId,status,info),
 *  'qr'(accountId,qr), 'pairing'(accountId,code), 'ack'(accountId,msgId,ack),
 *  'chat_update'(accountId,jid). */
export class AccountManager extends EventEmitter {
  private conns = new Map<string, any>();

  constructor(
    private db: DB,
    private accounts: AccountsRepo,
    private chats: ChatsRepo,
    private messages: MessagesRepo,
    private factory: ConnFactory = (id, db) => new WaConnection(id, db),
  ) {
    super();
  }

  get(accountId: string): any | undefined {
    return this.conns.get(accountId);
  }

  async start(accountId: string, pairPhone?: string): Promise<void> {
    if (this.conns.has(accountId)) return;
    const conn = this.factory(accountId, this.db);
    this.conns.set(accountId, conn);
    this.wire(conn);
    await conn.start(pairPhone);
  }

  private wire(conn: any): void {
    const id = conn.accountId;

    conn.on('qr', (qr: string) => this.emit('qr', id, qr));
    conn.on('pairing', (code: string) => this.emit('pairing', id, code));

    conn.on('status', (status: string, info?: any) => {
      this.accounts.updateStatus(id, status);
      this.emit('status', id, status, info);
    });

    conn.on('chat', (jid: string, name: string | undefined, isGroup: boolean) => {
      this.chats.upsert(id, { jid, name, isGroup });
      this.emit('chat_update', id, jid);
    });

    conn.on('message', (m: UpsertMessage) => {
      this.messages.upsert(m);
      this.chats.touch(id, m.chatJid, {
        lastMessageAt: m.timestamp,
        preview: m.body ?? '',
        incUnread: !m.fromMe,
      });
      this.emit('message', id, m);
      this.emit('chat_update', id, m.chatJid);
    });

    conn.on('ack', (msgId: string, ack: number) => {
      this.messages.setAck(id, msgId, ack);
      this.emit('ack', id, msgId, ack);
    });

    conn.on('phone', (phone: string) => {
      const current = conn.accountId;
      if (current !== phone && this.accounts.findById(current)) {
        this.accounts.rename(current, phone, phone);
        conn.accountId = phone;
        this.conns.delete(current);
        this.conns.set(phone, conn);
      }
    });

    conn.on('logged_out', () => {
      this.accounts.updateStatus(conn.accountId, 'disconnected');
      this.emit('status', conn.accountId, 'disconnected');
    });
  }

  async sendText(accountId: string, jid: string, text: string): Promise<string | null> {
    const conn = this.conns.get(accountId);
    if (!conn) throw new Error('Account not connected');
    const msgId = await conn.sendText(jid, text);
    if (msgId) {
      const ts = Date.now();
      this.messages.upsert({
        accountId, msgId, chatJid: jid, senderJid: null, fromMe: true,
        type: 'text', body: text, timestamp: ts, ack: 1,
      });
      this.chats.touch(accountId, jid, { lastMessageAt: ts, preview: text });
      this.emit('chat_update', accountId, jid);
    }
    return msgId;
  }

  async stop(accountId: string): Promise<void> {
    const conn = this.conns.get(accountId);
    if (conn) {
      await conn.stop();
      this.conns.delete(accountId);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/whatsapp/account-manager.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/whatsapp/account-manager.ts server/src/whatsapp/account-manager.test.ts
git commit -m "feat(server): add account manager + event bridge"
```

---

### Task 10: Extend AppContext with WhatsApp layer

**Files:**
- Modify: `server/src/app-context.ts`
- Test: `server/src/app-context.test.ts` (extend)

- [ ] **Step 1: Add to the failing test** (append)

```typescript
test('context exposes whatsapp layer', () => {
  const ctx = createContext(':memory:');
  expect(ctx.accounts).toBeTruthy();
  expect(ctx.chats).toBeTruthy();
  expect(ctx.messages).toBeTruthy();
  expect(ctx.manager).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app-context.test.ts`
Expected: FAIL (ctx.accounts undefined).

- [ ] **Step 3: Update `app-context.ts`**

```typescript
import { createDb, type DB } from './db/db.js';
import { UsersRepo } from './db/repositories/users.repo.js';
import { SettingsRepo } from './db/repositories/settings.repo.js';
import { AccountsRepo } from './db/repositories/accounts.repo.js';
import { ChatsRepo } from './db/repositories/chats.repo.js';
import { MessagesRepo } from './db/repositories/messages.repo.js';
import { AuthService } from './services/auth.service.js';
import { AccountManager } from './whatsapp/account-manager.js';

export interface AppContext {
  db: DB;
  users: UsersRepo;
  settings: SettingsRepo;
  accounts: AccountsRepo;
  chats: ChatsRepo;
  messages: MessagesRepo;
  auth: AuthService;
  manager: AccountManager;
}

export function createContext(dbPath: string): AppContext {
  const db = createDb(dbPath);
  const users = new UsersRepo(db);
  const settings = new SettingsRepo(db);
  const accounts = new AccountsRepo(db);
  const chats = new ChatsRepo(db);
  const messages = new MessagesRepo(db);
  const auth = new AuthService(users, settings);
  const manager = new AccountManager(db, accounts, chats, messages);
  return { db, users, settings, accounts, chats, messages, auth, manager };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app-context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/app-context.ts server/src/app-context.test.ts
git commit -m "feat(server): wire whatsapp layer into app context"
```

---

### Task 11: Account + chat + message + send routes

**Files:**
- Create: `server/src/api/routes/whatsapp.routes.ts`
- Modify: `server/src/api/server.ts`
- Test: `server/src/api/whatsapp.routes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect, vi } from 'vitest';
import request from 'supertest';
import { createContext } from '../app-context.js';
import { createApp } from './server.js';

async function authed() {
  const ctx = createContext(':memory:');
  // stub manager.start so no real socket is opened
  ctx.manager.start = vi.fn(async () => {}) as any;
  ctx.manager.sendText = vi.fn(async () => 'sent-1') as any;
  const app = createApp(ctx);
  const reg = await request(app).post('/api/auth/register').send({ email: 'a@b.com', password: 'secret1' });
  return { ctx, app, token: reg.body.token, userId: reg.body.user.id };
}

test('create account, list, status, send', async () => {
  const { ctx, app, token, userId } = await authed();

  const created = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ label: 'P' });
  expect(created.status).toBe(200);
  const accId = created.body.accountId;
  expect(ctx.manager.start).toHaveBeenCalledWith(accId, undefined);

  const list = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
  expect(list.body.accounts).toHaveLength(1);

  // seed a chat + message directly
  ctx.chats.upsert(accId, { jid: 'c@s.whatsapp.net', name: 'C' });
  ctx.chats.touch(accId, 'c@s.whatsapp.net', { lastMessageAt: 5, preview: 'hi' });
  ctx.messages.upsert({ accountId: accId, msgId: 'm1', chatJid: 'c@s.whatsapp.net', senderJid: 'c@s.whatsapp.net', fromMe: false, type: 'text', body: 'hi', timestamp: 5, ack: 0 });

  const chats = await request(app).get(`/api/chats?account=${accId}`).set('Authorization', `Bearer ${token}`);
  expect(chats.body.chats[0].jid).toBe('c@s.whatsapp.net');

  const msgs = await request(app).get(`/api/messages/${encodeURIComponent('c@s.whatsapp.net')}?account=${accId}`).set('Authorization', `Bearer ${token}`);
  expect(msgs.body.messages).toHaveLength(1);

  const sent = await request(app).post(`/api/send?account=${accId}`).set('Authorization', `Bearer ${token}`).send({ chatId: 'c@s.whatsapp.net', message: 'yo' });
  expect(sent.body.success).toBe(true);
  expect(ctx.manager.sendText).toHaveBeenCalledWith(accId, 'c@s.whatsapp.net', 'yo');
});

test('rejects access to another user account', async () => {
  const { ctx, app } = await authed();
  const other = await request(app).post('/api/auth/register').send({ email: 'z@z.com', password: 'secret1' });
  // create account under z
  const acc = await request(app).post('/api/accounts').set('Authorization', `Bearer ${other.body.token}`).send({});
  // first user tries to read z's chats
  const first = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'secret1' });
  const res = await request(app).get(`/api/chats?account=${acc.body.accountId}`).set('Authorization', `Bearer ${first.body.token}`);
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/whatsapp.routes.test.ts`
Expected: FAIL (cannot find module / 404s).

- [ ] **Step 3: Implement `whatsapp.routes.ts`**

```typescript
import { Router } from 'express';
import type { AppContext } from '../../app-context.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export function whatsappRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth(ctx));

  // resolve + authorize the ?account= param against the caller
  const ownAccount = (req: AuthedRequest, res: any): string | null => {
    const accountId = (req.query.account as string) || (req.body?.account as string);
    if (!accountId) {
      res.status(400).json({ error: 'account required' });
      return null;
    }
    if (!ctx.accounts.isOwnedByUser(accountId, req.userId!)) {
      res.status(403).json({ error: 'forbidden' });
      return null;
    }
    return accountId;
  };

  r.get('/accounts', (req: AuthedRequest, res) => {
    const accounts = ctx.accounts.listByUser(req.userId!).map((a) => {
      const conn = ctx.manager.get(a.id);
      return { id: a.id, label: a.label, phone: a.phone, status: a.status, qr: conn?.qr ?? null };
    });
    res.json({ accounts });
  });

  r.post('/accounts', async (req: AuthedRequest, res) => {
    const acc = ctx.accounts.create({ userId: req.userId!, label: req.body?.label });
    await ctx.manager.start(acc.id, undefined);
    res.json({ accountId: acc.id });
  });

  r.post('/accounts/:id/pair', async (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!ctx.accounts.isOwnedByUser(id, req.userId!)) return res.status(403).json({ error: 'forbidden' });
    const phone = String(req.body?.phone ?? '').replace(/[^0-9]/g, '');
    if (!phone) return res.status(400).json({ error: 'phone required' });
    await ctx.manager.stop(id);
    await ctx.manager.start(id, phone);
    res.json({ success: true });
  });

  r.delete('/accounts/:id', async (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!ctx.accounts.isOwnedByUser(id, req.userId!)) return res.status(403).json({ error: 'forbidden' });
    await ctx.manager.stop(id);
    ctx.accounts.remove(id);
    res.json({ success: true });
  });

  r.get('/status', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const acc = ctx.accounts.findById(accountId)!;
    const conn = ctx.manager.get(accountId);
    res.json({ connected: acc.status === 'connected', state: acc.status, phoneNumber: acc.phone, qr: conn?.qr ?? null });
  });

  r.get('/chats', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const limit = Number(req.query.limit ?? 30);
    const offset = Number(req.query.offset ?? 0);
    res.json({ chats: ctx.chats.list(accountId, limit, offset) });
  });

  r.get('/messages/:chatId', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const limit = Number(req.query.limit ?? 50);
    const before = req.query.before ? Number(req.query.before) : undefined;
    const messages = ctx.messages.listByChat(accountId, req.params.chatId, limit, before);
    res.json({ messages });
  });

  r.post('/send', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const { chatId, message } = req.body ?? {};
    if (!chatId || !message) return res.status(400).json({ error: 'chatId and message required' });
    try {
      const msgId = await ctx.manager.sendText(accountId, chatId, message);
      res.json({ success: true, msgId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/chats/:chatId/mark-read', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    ctx.chats.clearUnread(accountId, req.params.chatId);
    res.json({ success: true });
  });

  return r;
}
```

- [ ] **Step 4: Mount it in `server.ts`** (add the import + use line)

```typescript
import { whatsappRoutes } from './routes/whatsapp.routes.js';
// ...after app.use('/api/auth', authRoutes(ctx)); add:
app.use('/api', whatsappRoutes(ctx));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/api/whatsapp.routes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/api/routes/whatsapp.routes.ts server/src/api/server.ts server/src/api/whatsapp.routes.test.ts
git commit -m "feat(server): add account/chat/message/send routes"
```

---

### Task 12: Socket.IO gateway

**Files:**
- Create: `server/src/api/socket-gateway.ts`
- Test: `server/src/api/socket-gateway.test.ts`

- [ ] **Step 1: Write the failing test** (verifies JWT room join + event fan-out logic without a real socket server, by testing the helper that maps a manager event to a room emit)

```typescript
import { test, expect, vi } from 'vitest';
import { createContext } from '../app-context.js';
import { attachGateway } from './socket-gateway.js';

test('manager message event is emitted to the owning user room', () => {
  const ctx = createContext(':memory:');
  const acc = ctx.accounts.create({ userId: 'u1' });

  const emitted: any[] = [];
  const io: any = {
    on: vi.fn(),
    to: (room: string) => ({ emit: (ev: string, payload: any) => emitted.push({ room, ev, payload }) }),
    use: vi.fn(),
  };

  attachGateway(io, ctx);
  ctx.manager.emit('message', acc.id, { msgId: 'm1', chatJid: 'c', body: 'hi' });

  expect(emitted[0]).toMatchObject({ room: 'user:u1', ev: 'message' });
  expect(emitted[0].payload.accountId).toBe(acc.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/socket-gateway.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `socket-gateway.ts`**

```typescript
import type { Server as IOServer } from 'socket.io';
import type { AppContext } from '../app-context.js';

/** Look up the owning userId for an account (cached-free; cheap SQLite read). */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/socket-gateway.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/api/socket-gateway.ts server/src/api/socket-gateway.test.ts
git commit -m "feat(server): add socket.io gateway"
```

---

### Task 13: Boot wiring + live smoke test

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Update `index.ts` to create an HTTP server, attach Socket.IO, and auto-start existing accounts**

```typescript
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
```

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests PASS (Plan 1 + Plan 2 suites).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Live smoke test (requires the user's phone)**

1. `npm run dev`
2. `curl -X POST http://localhost:3050/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"t@t.com\",\"password\":\"secret1\"}"` → save `token`.
3. `curl -X POST http://localhost:3050/api/accounts -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"label\":\"Primary\"}"` → save `accountId`.
4. Poll `curl "http://localhost:3050/api/status?account=<accountId>" -H "Authorization: Bearer <token>"` until a `qr` string appears.
5. Render that QR (e.g. paste into any "text to QR" tool or `npx qrcode-terminal "<qr>"`) and scan it in WhatsApp → Linked Devices. (Or use the pairing-code flow: `POST /api/accounts/<id>/pair {"phone":"8801..."}` then enter the returned code in WhatsApp.)
6. After it connects, `status` shows `connected` with `phoneNumber`.
7. `curl "http://localhost:3050/api/chats?account=<accountId>" -H "Authorization: Bearer <token>"` → returns your real chats.
8. Send a text to yourself: `POST /api/send?account=<id> {"chatId":"<your-jid>@s.whatsapp.net","message":"Bondhu test"}` → arrives in WhatsApp.

Expected: real chats listed, message delivered, incoming messages appear in `/api/messages/<chatId>`.

- [ ] **Step 5: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): boot http+socket.io and auto-start accounts"
```

---

## Self-Review

- **Spec coverage (server/DESIGN.md §4–7):** Baileys connection + QR + pairing (Task 8), auth-state adapter (Task 7), EventBridge + chats/messages store (Tasks 4,5,9), normalization (Task 6), accounts (Task 3), REST accounts/chats/messages/send/status/mark-read (Task 11), Socket.IO real-time (Task 12), boot + auto-start (Task 13). Reactions/voice/image/AI are Plan 3.
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `UpsertMessage` shape is identical across normalize.ts, messages.repo.ts, account-manager.ts. `AccountManager` re-emits `(accountId, ...)` consistently consumed by the gateway. Routes use `?account=` + `isOwnedByUser` ownership guard matching the spec. `WaConnection` event names (`qr`/`pairing`/`status`/`chat`/`message`/`ack`/`phone`/`logged_out`) match what AccountManager.wire() listens for.
- **Live-only risk:** Task 8 (`WaConnection`) is not unit-tested; the installed Baileys version may rename a type/export (`WASocket`, `fetchLatestBaileysVersion`, `requestPairingCode`). Task 8 Step 2 (tsc) and Task 13 Step 4 (smoke) catch this — adjust imports if the version differs.
