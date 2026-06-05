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
