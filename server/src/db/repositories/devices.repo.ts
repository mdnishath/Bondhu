import type { DB } from '../db.js';

/** Push device tokens per user (for FCM background notifications). */
export class DevicesRepo {
  constructor(private db: DB) {}

  register(userId: string, token: string, platform = 'android'): void {
    this.db
      .prepare(
        `INSERT INTO device_tokens (token, user_id, platform, created_at) VALUES (?,?,?,?)
         ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id, platform=excluded.platform`,
      )
      .run(token, userId, platform, Date.now());
  }

  remove(token: string): void {
    this.db.prepare('DELETE FROM device_tokens WHERE token=?').run(token);
  }

  tokensForUser(userId: string): string[] {
    return (this.db.prepare('SELECT token FROM device_tokens WHERE user_id=?').all(userId) as Array<{ token: string }>)
      .map((r) => r.token);
  }
}
