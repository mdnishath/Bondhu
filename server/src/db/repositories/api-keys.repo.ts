import { randomUUID } from 'crypto';
import type { DB } from '../db.js';

export interface ApiKeyView { id: string; label: string | null; keyMasked: string; isActive: boolean; }

function mask(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export class ApiKeysRepo {
  constructor(private db: DB) {}

  add(userId: string, keyValue: string, label?: string): ApiKeyView {
    const hasActive = !!this.db.prepare('SELECT 1 FROM api_keys WHERE user_id=? AND is_active=1').get(userId);
    const id = randomUUID();
    this.db.prepare('INSERT INTO api_keys (id,user_id,key_value,label,is_active,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, userId, keyValue, label ?? null, hasActive ? 0 : 1, Date.now());
    return { id, label: label ?? null, keyMasked: mask(keyValue), isActive: !hasActive };
  }

  list(userId: string): ApiKeyView[] {
    return (this.db.prepare('SELECT * FROM api_keys WHERE user_id=? ORDER BY created_at').all(userId) as any[])
      .map((r) => ({ id: r.id, label: r.label, keyMasked: mask(r.key_value), isActive: !!r.is_active }));
  }

  activeKey(userId: string): string | undefined {
    const r = (this.db.prepare('SELECT key_value FROM api_keys WHERE user_id=? AND is_active=1').get(userId) as any)
      ?? (this.db.prepare('SELECT key_value FROM api_keys WHERE user_id=? ORDER BY created_at LIMIT 1').get(userId) as any);
    return r?.key_value;
  }

  allKeys(userId: string): string[] {
    return (this.db.prepare('SELECT key_value FROM api_keys WHERE user_id=? ORDER BY is_active DESC, created_at').all(userId) as any[])
      .map((r) => r.key_value);
  }

  activate(userId: string, id: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE api_keys SET is_active=0 WHERE user_id=?').run(userId);
      this.db.prepare('UPDATE api_keys SET is_active=1 WHERE user_id=? AND id=?').run(userId, id);
    });
    tx();
  }

  remove(userId: string, id: string): void {
    const wasActive = !!this.db.prepare('SELECT is_active FROM api_keys WHERE user_id=? AND id=?').get(userId, id);
    this.db.prepare('DELETE FROM api_keys WHERE user_id=? AND id=?').run(userId, id);
    if (wasActive) {
      const next = this.db.prepare('SELECT id FROM api_keys WHERE user_id=? ORDER BY created_at LIMIT 1').get(userId) as any;
      if (next) this.activate(userId, next.id);
    }
  }
}
