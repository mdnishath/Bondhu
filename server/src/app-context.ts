import { createDb, type DB } from './db/db.js';
import { UsersRepo } from './db/repositories/users.repo.js';
import { SettingsRepo } from './db/repositories/settings.repo.js';
import { AccountsRepo } from './db/repositories/accounts.repo.js';
import { ChatsRepo } from './db/repositories/chats.repo.js';
import { MessagesRepo } from './db/repositories/messages.repo.js';
import { ReactionsRepo } from './db/repositories/reactions.repo.js';
import { AuthService } from './services/auth.service.js';
import { AccountManager } from './whatsapp/account-manager.js';

export interface AppContext {
  db: DB;
  users: UsersRepo;
  settings: SettingsRepo;
  accounts: AccountsRepo;
  chats: ChatsRepo;
  messages: MessagesRepo;
  reactions: ReactionsRepo;
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
  const reactions = new ReactionsRepo(db);
  const auth = new AuthService(users, settings);
  const manager = new AccountManager(db, accounts, chats, messages, reactions);
  return { db, users, settings, accounts, chats, messages, reactions, auth, manager };
}
