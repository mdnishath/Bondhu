import { randomBytes } from 'crypto';
import type { DB } from '../db.js';

export class SettingsRepo {
  constructor(private db: DB) {}

  get(key: string): string | undefined {
    const r = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any;
    return r ? r.value : undefined;
  }

  set(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, value);
  }

  getOrCreateJwtSecret(): string {
    let s = this.get('jwt_secret');
    if (!s) {
      s = randomBytes(48).toString('hex');
      this.set('jwt_secret', s);
    }
    return s;
  }
}
