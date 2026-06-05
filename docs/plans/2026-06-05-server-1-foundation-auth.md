# Server Plan 1 — Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Node/TypeScript server skeleton with a SQLite data layer and working email/password auth (register, login, JWT-protected `/me`).

**Architecture:** Express HTTP server. A thin `better-sqlite3` data layer with a migration runner and per-entity repositories. An `AuthService` (bcrypt + JWT) consumed by `/api/auth/*` routes. JWT verification middleware guards protected routes. No WhatsApp/Baileys yet — that is Plan 2.

**Tech Stack:** Node 20+, TypeScript, Express 4, better-sqlite3, bcryptjs, jsonwebtoken, zod, vitest + supertest.

Working directory for all paths: `E:\New Whatsapp\server`.

---

### Task 1: Project scaffolding

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/src/index.ts`
- Create: `server/.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bondhu-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^12.9.0",
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
*.db
*.db-*
.env
```

- [ ] **Step 5: Create a placeholder `src/index.ts`**

```typescript
console.log('Bondhu server booting...');
```

- [ ] **Step 6: Install dependencies**

Run: `npm install` (in `server/`)
Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "chore(server): scaffold project"
```

---

### Task 2: Config module

**Files:**
- Create: `server/src/config.ts`
- Test: `server/src/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { config } from './config.js';

test('config provides defaults', () => {
  expect(config.port).toBeTypeOf('number');
  expect(config.dbPath).toContain('.db');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config.test.ts`
Expected: FAIL (cannot find `./config.js`).

- [ ] **Step 3: Implement `config.ts`**

```typescript
export const config = {
  port: Number(process.env.PORT ?? 3050),
  dbPath: process.env.DB_PATH ?? 'bondhu.db',
  jwtExpiresIn: '30d',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/config.ts server/src/config.test.ts
git commit -m "feat(server): add config module"
```

---

### Task 3: Database layer + migrations

**Files:**
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/db.ts`
- Test: `server/src/db/db.test.ts`

- [ ] **Step 1: Create `schema.sql`** (full schema; later plans add data to these tables)

```sql
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
```

- [ ] **Step 2: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from './db.js';

test('createDb applies schema and supports CRUD', () => {
  const db = createDb(':memory:');
  db.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)')
    .run('u1', 'a@b.com', 'hash', 1);
  const row = db.prepare('SELECT email FROM users WHERE id=?').get('u1') as any;
  expect(row.email).toBe('a@b.com');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/db/db.test.ts`
Expected: FAIL (cannot find `./db.js`).

- [ ] **Step 4: Implement `db.ts`**

```typescript
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
  db.exec(schema);
  return db;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/db/db.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/
git commit -m "feat(server): add sqlite db layer with schema"
```

---

### Task 4: User repository

**Files:**
- Create: `server/src/db/repositories/users.repo.ts`
- Test: `server/src/db/repositories/users.repo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { UsersRepo } from './users.repo.js';

test('create and find user by email', () => {
  const repo = new UsersRepo(createDb(':memory:'));
  const u = repo.create({ email: 'a@b.com', passwordHash: 'h', name: 'A' });
  expect(u.id).toBeTruthy();
  const found = repo.findByEmail('a@b.com');
  expect(found?.name).toBe('A');
  expect(repo.findByEmail('none@x.com')).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/repositories/users.repo.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `users.repo.ts`**

```typescript
import { randomUUID } from 'crypto';
import type { DB } from '../db.js';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  createdAt: number;
}

export class UsersRepo {
  constructor(private db: DB) {}

  create(input: { email: string; passwordHash: string; name?: string }): User {
    const user: User = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      createdAt: Date.now(),
    };
    this.db
      .prepare('INSERT INTO users (id,email,password_hash,name,created_at) VALUES (?,?,?,?,?)')
      .run(user.id, user.email, user.passwordHash, user.name, user.createdAt);
    return user;
  }

  findByEmail(email: string): User | undefined {
    const r = this.db.prepare('SELECT * FROM users WHERE email=?').get(email) as any;
    return r ? this.map(r) : undefined;
  }

  findById(id: string): User | undefined {
    const r = this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as any;
    return r ? this.map(r) : undefined;
  }

  private map(r: any): User {
    return { id: r.id, email: r.email, passwordHash: r.password_hash, name: r.name, createdAt: r.created_at };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/repositories/users.repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/repositories/
git commit -m "feat(server): add users repository"
```

---

### Task 5: Settings repository + JWT secret bootstrap

**Files:**
- Create: `server/src/db/repositories/settings.repo.ts`
- Test: `server/src/db/repositories/settings.repo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { SettingsRepo } from './settings.repo.js';

test('get/set and getOrCreateJwtSecret is stable', () => {
  const repo = new SettingsRepo(createDb(':memory:'));
  expect(repo.get('missing')).toBeUndefined();
  repo.set('k', 'v');
  expect(repo.get('k')).toBe('v');
  const s1 = repo.getOrCreateJwtSecret();
  const s2 = repo.getOrCreateJwtSecret();
  expect(s1).toBe(s2);
  expect(s1.length).toBeGreaterThan(20);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/repositories/settings.repo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `settings.repo.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/repositories/settings.repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/repositories/settings.repo.ts server/src/db/repositories/settings.repo.test.ts
git commit -m "feat(server): add settings repo with jwt secret bootstrap"
```

---

### Task 6: AuthService (register/login/verify)

**Files:**
- Create: `server/src/services/auth.service.ts`
- Test: `server/src/services/auth.service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createDb } from '../db/db.js';
import { UsersRepo } from '../db/repositories/users.repo.js';
import { SettingsRepo } from '../db/repositories/settings.repo.js';
import { AuthService } from './auth.service.js';

function makeService() {
  const db = createDb(':memory:');
  return new AuthService(new UsersRepo(db), new SettingsRepo(db));
}

test('register returns token + user, rejects short password and duplicates', async () => {
  const svc = makeService();
  await expect(svc.register('a@b.com', '123', 'A')).rejects.toThrow();
  const res = await svc.register('a@b.com', 'secret1', 'A');
  expect(res.token).toBeTruthy();
  expect(res.user.email).toBe('a@b.com');
  await expect(svc.register('a@b.com', 'secret1', 'A')).rejects.toThrow();
});

test('login verifies password and verifyToken round-trips', async () => {
  const svc = makeService();
  await svc.register('a@b.com', 'secret1', 'A');
  await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow();
  const res = await svc.login('a@b.com', 'secret1');
  const decoded = svc.verifyToken(res.token);
  expect(decoded.userId).toBe(res.user.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/auth.service.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `auth.service.ts`**

```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UsersRepo, User } from '../db/repositories/users.repo.js';
import type { SettingsRepo } from '../db/repositories/settings.repo.js';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string | null };
}

export class AuthService {
  constructor(private users: UsersRepo, private settings: SettingsRepo) {}

  async register(email: string, password: string, name?: string): Promise<AuthResult> {
    if (!email || !email.includes('@')) throw new Error('Invalid email');
    if (!password || password.length < 6) throw new Error('Password too short');
    if (this.users.findByEmail(email)) throw new Error('Email already registered');
    const hash = await bcrypt.hash(password, 10);
    const user = this.users.create({ email, passwordHash: hash, name });
    return this.result(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = this.users.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new Error('Invalid credentials');
    return this.result(user);
  }

  verifyToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.settings.getOrCreateJwtSecret()) as any;
    return { userId: payload.sub };
  }

  private result(user: User): AuthResult {
    const token = jwt.sign({ sub: user.id }, this.settings.getOrCreateJwtSecret(), { expiresIn: '30d' });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/auth.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/auth.service.ts server/src/services/auth.service.test.ts
git commit -m "feat(server): add auth service (register/login/jwt)"
```

---

### Task 7: App container (wire db + services)

**Files:**
- Create: `server/src/app-context.ts`
- Test: `server/src/app-context.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import { createContext } from './app-context.js';

test('context exposes services', () => {
  const ctx = createContext(':memory:');
  expect(ctx.auth).toBeTruthy();
  expect(ctx.users).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app-context.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `app-context.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app-context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/app-context.ts server/src/app-context.test.ts
git commit -m "feat(server): add app context wiring"
```

---

### Task 8: Auth middleware

**Files:**
- Create: `server/src/api/middleware/auth.ts`
- Test: covered via Task 10 route tests.

- [ ] **Step 1: Implement `auth.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { AppContext } from '../../app-context.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(ctx: AppContext) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer ?? (req.query.token as string | undefined);
    if (!token) return res.status(401).json({ error: 'Authorization token required' });
    try {
      req.userId = ctx.auth.verifyToken(token).userId;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/api/middleware/auth.ts
git commit -m "feat(server): add jwt auth middleware"
```

---

### Task 9: Auth routes

**Files:**
- Create: `server/src/api/routes/auth.routes.ts`

- [ ] **Step 1: Implement `auth.routes.ts`**

```typescript
import { Router } from 'express';
import type { AppContext } from '../../app-context.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export function authRoutes(ctx: AppContext): Router {
  const r = Router();

  r.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body ?? {};
      res.json(await ctx.auth.register(email, password, name));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      res.json(await ctx.auth.login(email, password));
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  });

  r.get('/me', requireAuth(ctx), (req: AuthedRequest, res) => {
    const user = ctx.users.findById(req.userId!);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ id: user.id, email: user.email, name: user.name });
  });

  return r;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/api/routes/auth.routes.ts
git commit -m "feat(server): add auth routes"
```

---

### Task 10: Express app factory + integration tests

**Files:**
- Create: `server/src/api/server.ts`
- Test: `server/src/api/server.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from 'vitest';
import request from 'supertest';
import { createContext } from '../app-context.js';
import { createApp } from './server.js';

function app() {
  return createApp(createContext(':memory:'));
}

test('register -> login -> me flow', async () => {
  const a = app();
  const reg = await request(a).post('/api/auth/register').send({ email: 'a@b.com', password: 'secret1', name: 'A' });
  expect(reg.status).toBe(200);
  const token = reg.body.token;

  const me = await request(a).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  expect(me.status).toBe(200);
  expect(me.body.email).toBe('a@b.com');

  const noauth = await request(a).get('/api/auth/me');
  expect(noauth.status).toBe(401);

  const login = await request(a).post('/api/auth/login').send({ email: 'a@b.com', password: 'secret1' });
  expect(login.status).toBe(200);
  expect(login.body.user.id).toBe(reg.body.user.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/server.test.ts`
Expected: FAIL (cannot find `./server.js`).

- [ ] **Step 3: Implement `server.ts`**

```typescript
import express, { type Express } from 'express';
import cors from 'cors';
import type { AppContext } from '../app-context.js';
import { authRoutes } from './routes/auth.routes.js';

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(ctx));
  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/server.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add server/src/api/server.ts server/src/api/server.test.ts
git commit -m "feat(server): add express app factory + auth integration tests"
```

---

### Task 11: Boot entrypoint

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Replace `index.ts`**

```typescript
import { createContext } from './app-context.js';
import { createApp } from './api/server.js';
import { config } from './config.js';

const ctx = createContext(config.dbPath);
const app = createApp(ctx);
app.listen(config.port, () => {
  process.stderr.write(`[Bondhu] API listening on http://localhost:${config.port}\n`);
});
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
Then in another terminal:
`curl -X POST http://localhost:3050/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"a@b.com\",\"password\":\"secret1\",\"name\":\"A\"}"`
Expected: JSON with `token` and `user`.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): wire boot entrypoint"
```

---

## Self-Review

- **Spec coverage (server/DESIGN.md §3,5,6,9):** Phase 1 (DB + schema, auth register/login/JWT, Express skeleton, config) — covered by Tasks 1–11. The `accounts`/`auth_state` tables are created now (schema.sql) but used in Plan 2.
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `AppContext`, `AuthResult`, `User`, `UsersRepo`, `SettingsRepo`, `AuthService.verifyToken → {userId}` are consistent across tasks. Routes mount at `/api/auth/*` matching the spec.
- **Deferred to later plans:** accounts/messages/chats repos, Baileys, Socket.IO, AI services, FCM.
