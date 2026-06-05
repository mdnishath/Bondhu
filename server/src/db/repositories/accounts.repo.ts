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

  /** Set the revealed phone number WITHOUT changing the primary id.
   *  Keeping the id stable avoids an auth_state migration race while the
   *  socket is live (renaming mid-connection split creds across ids). */
  setPhone(id: string, phone: string): void {
    this.db.prepare('UPDATE accounts SET phone=? WHERE id=?').run(phone, id);
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
