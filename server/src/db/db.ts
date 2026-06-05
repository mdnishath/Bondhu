import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type DB = Database.Database;

export function createDb(path: string): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  // Run statement-by-statement so the idempotent `ALTER TABLE ... ADD COLUMN`
  // (which has no IF NOT EXISTS) can be re-run on every boot without failing.
  for (const stmt of schema.split(';')) {
    const sql = stmt.trim();
    if (!sql) continue;
    try {
      db.exec(sql);
    } catch (e: any) {
      if (!/duplicate column name/i.test(e.message)) throw e;
    }
  }
  return db;
}
