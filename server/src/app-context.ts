import { createDb, type DB } from './db/db.js';
import { UsersRepo } from './db/repositories/users.repo.js';
import { SettingsRepo } from './db/repositories/settings.repo.js';
import { AuthService } from './services/auth.service.js';

export interface AppContext {
  db: DB;
  users: UsersRepo;
  settings: SettingsRepo;
  auth: AuthService;
}

export function createContext(dbPath: string): AppContext {
  const db = createDb(dbPath);
  const users = new UsersRepo(db);
  const settings = new SettingsRepo(db);
  const auth = new AuthService(users, settings);
  return { db, users, settings, auth };
}
