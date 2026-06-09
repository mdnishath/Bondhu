import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { MaintenanceRepo } from './maintenance.repo.js';

function seed(db: ReturnType<typeof createDb>) {
  // two old + one fresh row in each regenerable cache
  db.prepare('INSERT INTO translations (account_id,msg_id,lang,text,created_at) VALUES (?,?,?,?,?)').run('a', 'old1', 'bn', 'x', 1_000);
  db.prepare('INSERT INTO translations (account_id,msg_id,lang,text,created_at) VALUES (?,?,?,?,?)').run('a', 'new1', 'bn', 'y', 9_000);
  db.prepare('INSERT INTO tts_cache (account_id,msg_id,lang,audio_base64,mime,created_at) VALUES (?,?,?,?,?,?)').run('a', 'old1', 'bn', 'AAA', 'audio/wav', 1_000);
  db.prepare('INSERT INTO tts_cache (account_id,msg_id,lang,audio_base64,mime,created_at) VALUES (?,?,?,?,?,?)').run('a', 'new1', 'bn', 'BBB', 'audio/wav', 9_000);
  db.prepare('INSERT INTO profile_pics (account_id,jid,mime,data,ok,fetched_at) VALUES (?,?,?,?,?,?)').run('a', 'j1', 'image/jpeg', Buffer.from('x'), 1, 1_000);
  db.prepare('INSERT INTO profile_pics (account_id,jid,mime,data,ok,fetched_at) VALUES (?,?,?,?,?,?)').run('a', 'j2', 'image/jpeg', Buffer.from('y'), 1, 9_000);
}

test('pruneOldCaches deletes only rows older than the cutoff and reports counts', () => {
  const db = createDb(':memory:');
  seed(db);
  const repo = new MaintenanceRepo(db);

  const deleted = repo.pruneOldCaches(5_000); // cutoff between old (1000) and fresh (9000)

  expect(deleted).toEqual({ translations: 1, tts: 1, profilePics: 1 });
  expect(db.prepare('SELECT COUNT(*) c FROM translations').get()).toMatchObject({ c: 1 });
  expect(db.prepare('SELECT COUNT(*) c FROM tts_cache').get()).toMatchObject({ c: 1 });
  expect(db.prepare('SELECT COUNT(*) c FROM profile_pics').get()).toMatchObject({ c: 1 });
  // the surviving rows are the fresh ones
  expect((db.prepare('SELECT msg_id FROM translations').get() as any).msg_id).toBe('new1');
});

test('pruneOldCaches with a cutoff below everything deletes nothing', () => {
  const db = createDb(':memory:');
  seed(db);
  const repo = new MaintenanceRepo(db);
  const deleted = repo.pruneOldCaches(500);
  expect(deleted).toEqual({ translations: 0, tts: 0, profilePics: 0 });
});
