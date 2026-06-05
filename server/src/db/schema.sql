CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT,
  phone TEXT,
  status TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_state (
  account_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (account_id, key)
);

CREATE TABLE IF NOT EXISTS chats (
  account_id TEXT NOT NULL,
  jid TEXT NOT NULL,
  name TEXT,
  is_group INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, jid)
);

CREATE TABLE IF NOT EXISTS messages (
  account_id TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  sender_jid TEXT,
  from_me INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  timestamp INTEGER NOT NULL,
  ack INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, msg_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat
  ON messages (account_id, chat_jid, timestamp);

ALTER TABLE messages ADD COLUMN raw TEXT;

CREATE TABLE IF NOT EXISTS reactions (
  account_id TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  sender_jid TEXT NOT NULL,
  emoji TEXT NOT NULL,
  from_me INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, msg_id, sender_jid)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_value TEXT NOT NULL,
  label TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_lang (
  user_id TEXT PRIMARY KEY,
  lang TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_lang (
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  lang TEXT NOT NULL,
  PRIMARY KEY (user_id, account_id, chat_jid)
);

CREATE TABLE IF NOT EXISTS translations (
  account_id TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, msg_id, lang)
);

CREATE TABLE IF NOT EXISTS tts_cache (
  account_id TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  audio_base64 TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, msg_id, lang)
);
