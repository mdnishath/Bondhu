import { createDb, type DB } from './db/db.js';
import { UsersRepo } from './db/repositories/users.repo.js';
import { SettingsRepo } from './db/repositories/settings.repo.js';
import { AccountsRepo } from './db/repositories/accounts.repo.js';
import { ChatsRepo } from './db/repositories/chats.repo.js';
import { MessagesRepo } from './db/repositories/messages.repo.js';
import { ReactionsRepo } from './db/repositories/reactions.repo.js';
import { ApiKeysRepo } from './db/repositories/api-keys.repo.js';
import { LangRepo } from './db/repositories/lang.repo.js';
import { DevicesRepo } from './db/repositories/devices.repo.js';
import { AuthService } from './services/auth.service.js';
import { AccountManager } from './whatsapp/account-manager.js';
import { KeyRing } from './ai/key-ring.js';
import { TranslationService } from './ai/translation.service.js';
import { TtsService } from './ai/tts.service.js';
import { TranscriptionService } from './ai/transcription.service.js';
import { PushService } from './ai/push.service.js';

export interface AppContext {
  db: DB;
  users: UsersRepo;
  settings: SettingsRepo;
  accounts: AccountsRepo;
  chats: ChatsRepo;
  messages: MessagesRepo;
  reactions: ReactionsRepo;
  apiKeys: ApiKeysRepo;
  langs: LangRepo;
  devices: DevicesRepo;
  auth: AuthService;
  manager: AccountManager;
  translation: TranslationService;
  tts: TtsService;
  transcription: TranscriptionService;
  push: PushService;
}

export function createContext(dbPath: string): AppContext {
  const db = createDb(dbPath);
  const users = new UsersRepo(db);
  const settings = new SettingsRepo(db);
  const accounts = new AccountsRepo(db);
  const chats = new ChatsRepo(db);
  const messages = new MessagesRepo(db);
  const reactions = new ReactionsRepo(db);
  const apiKeys = new ApiKeysRepo(db);
  const langs = new LangRepo(db);
  const devices = new DevicesRepo(db);
  const auth = new AuthService(users, settings);
  const manager = new AccountManager(db, accounts, chats, messages, reactions);
  const keyRing = new KeyRing(apiKeys);
  const translation = new TranslationService(db, keyRing);
  const tts = new TtsService(db, keyRing);
  const transcription = new TranscriptionService(keyRing);
  const push = new PushService(devices);
  return {
    db, users, settings, accounts, chats, messages, reactions, apiKeys, langs, devices,
    auth, manager, translation, tts, transcription, push,
  };
}
