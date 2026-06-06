// One-off: trigger the /merge-lid-chats repair on the running server for each
// connected account. Reads jwt_secret + accounts straight from the DB (a second
// read-only connection — the actual writes happen inside the server endpoint, so
// there is no WAL write race). Run with the dev server up on :3050.
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const db = new Database('bondhu.db', { readonly: true });
const secret = db.prepare("SELECT value FROM settings WHERE key='jwt_secret'").get().value;

const accounts = db.prepare("SELECT id, user_id, phone, status FROM accounts").all();
const countPhone = (acc) =>
  db.prepare("SELECT COUNT(*) c FROM chats WHERE account_id=? AND jid LIKE '%@s.whatsapp.net'").get(acc).c;
const countLid = (acc) =>
  db.prepare("SELECT COUNT(*) c FROM chats WHERE account_id=? AND jid LIKE '%@lid'").get(acc).c;

for (const a of accounts) {
  console.log(`\n=== account ${a.id} (phone=${a.phone} status=${a.status})`);
  console.log(`   before: phone-chats=${countPhone(a.id)} lid-chats=${countLid(a.id)}`);
  const token = jwt.sign({ sub: a.user_id }, secret, { expiresIn: '1h' });
  const res = await fetch(`http://localhost:3050/api/merge-lid-chats?account=${a.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  console.log(`   endpoint ${res.status}: scanned=${body.scanned} merged=${body.count}`);
  if (body.merged?.length) {
    for (const m of body.merged.slice(0, 5)) console.log(`     ${m.from}  ->  ${m.to}  (${m.moved} msgs)`);
    if (body.merged.length > 5) console.log(`     ...and ${body.merged.length - 5} more`);
  }
}

// Re-open fresh to see committed after-state.
const db2 = new Database('bondhu.db', { readonly: true });
console.log('\n=== AFTER ===');
for (const a of accounts) {
  const phone = db2.prepare("SELECT COUNT(*) c FROM chats WHERE account_id=? AND jid LIKE '%@s.whatsapp.net'").get(a.id).c;
  const lid = db2.prepare("SELECT COUNT(*) c FROM chats WHERE account_id=? AND jid LIKE '%@lid'").get(a.id).c;
  console.log(`   ${a.id}: phone-chats=${phone} lid-chats=${lid}`);
}
