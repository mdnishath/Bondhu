# Bondhu — Auth Security + UI Elegance + Smoothness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the real auth vulnerabilities (revocable tokens, brute-force resistance, strong passwords, constant-time login, security headers, hardened Android token storage), then elevate the Android app's visual polish (motion, accent discipline, typography, hero auth screen) and runtime smoothness (immutable models, recomposition scoping, append fast-path, Coil tuning).

**Architecture:** Three phases. (A) Server auth changes are TDD (vitest, `server/`). (B+) Android changes are build-verified (`gradlew assembleDebug` + unit tests where they exist). The server auth model gains a `token_version` column for revocation; the Android JWT moves to `EncryptedSharedPreferences`; the Compose layer gains nav transitions, `animateItem()`, `@Immutable` models, and a custom Coil `ImageLoader`.

**Tech Stack:** Node 20 + TS + Express + better-sqlite3 + bcryptjs + jsonwebtoken + helmet (new) + vitest. Android: Kotlin + Compose (Material3) + Hilt + Retrofit + Coil + Media3 + DataStore + androidx.security-crypto (new).

---

## File Structure

**Server (modify):**
- `server/src/db/schema.sql` — add `token_version` column to `users`
- `server/src/db/repositories/users.repo.ts` — map + bump `tokenVersion`
- `server/src/services/auth.service.ts` — password policy, email normalize, constant-time login, per-email lockout, `tv` claim, revocation check, `logout`
- `server/src/services/auth.service.test.ts` — extend
- `server/src/api/routes/auth.routes.ts` — add `POST /logout`
- `server/src/api/middleware/rate-limit.ts` — key on `req.ip`
- `server/src/api/server.ts` — helmet + dedicated `/login` limiter
- `server/package.json` — add `helmet`

**Android (modify/create):**
- `android/app/build.gradle.kts` — add security-crypto dep, bump version
- `android/app/src/main/AndroidManifest.xml` — cleartext off, allowBackup off, network config
- `android/app/src/main/res/xml/network_security_config.xml` — **create**
- `android/app/src/main/java/com/bondhu/app/data/store/Prefs.kt` — encrypted JWT
- `android/app/src/main/java/com/bondhu/app/data/repository/AuthRepository.kt` — logout call
- `android/app/src/main/java/com/bondhu/app/ui/theme/Tokens.kt` — `Radii` scale + contrast nudge
- `android/app/src/main/java/com/bondhu/app/ui/theme/Type.kt` — lineHeight/letterSpacing
- `android/app/src/main/java/com/bondhu/app/ui/common/Atoms.kt` — button loading/press/disabled, field error, EmptyState glyph
- `android/app/src/main/java/com/bondhu/app/ui/nav/BondhuNavHost.kt` — transitions
- `android/app/src/main/java/com/bondhu/app/ui/chatlist/ChatListScreen.kt` — animateItem, unread styling
- `android/app/src/main/java/com/bondhu/app/ui/chat/ChatScreen.kt` — animateItem
- `android/app/src/main/java/com/bondhu/app/ui/chat/MessageBubble.kt` — pop-in, animated selection
- `android/app/src/main/java/com/bondhu/app/ui/settings/SettingsScreen.kt` — de-lime headers
- `android/app/src/main/java/com/bondhu/app/ui/auth/AuthScreen.kt` — hero treatment
- `android/app/src/main/java/com/bondhu/app/data/model/UiModels.kt` — `@Immutable`
- `android/app/src/main/java/com/bondhu/app/data/audio/AudioPlayer.kt` — 500ms tick
- `android/app/src/main/java/com/bondhu/app/ui/chat/ChatViewModel.kt` — append fast-path
- `android/app/src/main/java/com/bondhu/app/App.kt` — Coil ImageLoaderFactory

---

# PHASE A — Server Auth Security (TDD)

### Task A1: Strong password policy + email normalization

**Files:**
- Modify: `server/src/services/auth.service.ts:14-21` (register), `:23-29` (login)
- Test: `server/src/services/auth.service.test.ts`

- [ ] **Step 1: Write failing tests** — add to `auth.service.test.ts`:

```ts
test('register enforces >=8 char password and rejects common passwords', async () => {
  const svc = makeService();
  await expect(svc.register('a@b.com', 'short', 'A')).rejects.toThrow(/at least 8/);
  await expect(svc.register('a@b.com', 'password', 'A')).rejects.toThrow(/too common/);
  const res = await svc.register('a@b.com', 'g00d-pass-1', 'A');
  expect(res.token).toBeTruthy();
});

test('email is normalized (lowercased + trimmed) for storage and login', async () => {
  const svc = makeService();
  await svc.register('  User@Example.COM ', 'g00d-pass-1', 'A');
  const res = await svc.login('user@example.com', 'g00d-pass-1');
  expect(res.user.email).toBe('user@example.com');
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "E:/New Whatsapp/server" && npm test -- auth.service`
Expected: FAIL (`at least 8` / normalization not implemented).

- [ ] **Step 3: Implement** — replace the top of `register` and add a helper. New `auth.service.ts` register/login section:

```ts
const COMMON = new Set([
  'password','12345678','123456789','qwerty123','11111111','iloveyou',
  '12345678910','password1','qwertyuiop','1q2w3e4r','football','baseball',
]);

function normEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

// inside class:
async register(email: string, password: string, name?: string): Promise<AuthResult> {
  const e = normEmail(email);
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Invalid email');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');
  if (COMMON.has(password.toLowerCase())) throw new Error('Password is too common — pick a stronger one');
  if (this.users.findByEmail(e)) throw new Error('Email already registered');
  const hash = await bcrypt.hash(password, 12);
  const user = this.users.create({ email: e, passwordHash: hash, name });
  return this.result(user);
}
```

(login's `normEmail(email)` is added in Task A3; for now also wrap login's lookup: `const user = this.users.findByEmail(normEmail(email));`)

- [ ] **Step 4: Run, verify pass**

Run: `cd "E:/New Whatsapp/server" && npm test -- auth.service`
Expected: PASS. (The pre-existing test uses `'secret1'` (7 chars) → it will now fail; update that test's passwords to `'secret12'` in the same commit.)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/auth.service.ts server/src/services/auth.service.test.ts
git commit -m "feat(auth): strong password policy + email normalization"
```

---

### Task A2: Token revocation — `token_version` column + `tv` claim

**Files:**
- Modify: `server/src/db/schema.sql` (after line 7), `server/src/db/repositories/users.repo.ts`, `server/src/services/auth.service.ts`
- Test: `server/src/services/auth.service.test.ts`

- [ ] **Step 1: Write failing test**:

```ts
test('verifyToken rejects a token after the user token_version is bumped', async () => {
  const db = createDb(':memory:');
  const users = new UsersRepo(db);
  const svc = new AuthService(users, new SettingsRepo(db));
  const { token, user } = await svc.register('a@b.com', 'g00d-pass-1', 'A');
  expect(svc.verifyToken(token).userId).toBe(user.id);
  users.bumpTokenVersion(user.id);
  expect(() => svc.verifyToken(token)).toThrow();
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- auth.service` → FAIL (`bumpTokenVersion` undefined).

- [ ] **Step 3a: Schema** — add to `server/src/db/schema.sql` after line 7 (idempotent ALTER, tolerated by the statement-by-statement runner):

```sql
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3b: Repo** — in `users.repo.ts`: add `tokenVersion: number` to the `User` interface; in `create` add `tokenVersion: 0` and include it in the INSERT (`INSERT INTO users (id,email,password_hash,name,created_at,token_version) VALUES (?,?,?,?,?,?)` + `user.tokenVersion`); in `map` add `tokenVersion: r.token_version ?? 0`; add:

```ts
bumpTokenVersion(id: string): void {
  this.db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id=?').run(id);
}
```

- [ ] **Step 3c: Service** — in `auth.service.ts` `result()` embed the version, and in `verifyToken` re-check it:

```ts
private result(user: User): AuthResult {
  const token = jwt.sign(
    { sub: user.id, tv: user.tokenVersion },
    this.settings.getOrCreateJwtSecret(),
    { expiresIn: config.jwtExpiresIn },
  );
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

verifyToken(token: string): { userId: string } {
  const payload = jwt.verify(token, this.settings.getOrCreateJwtSecret()) as any;
  const user = this.users.findById(payload.sub);
  if (!user || (payload.tv ?? 0) !== user.tokenVersion) throw new Error('Token revoked');
  return { userId: payload.sub };
}
```

Add `import { config } from '../config.js';` at the top of `auth.service.ts`.

- [ ] **Step 4: Run, verify pass** — `npm test -- auth.service` → PASS. Also run full `npm test` to confirm `requireAuth`-dependent route tests still pass (they register fresh users, so `tv` matches).

- [ ] **Step 5: Commit**

```bash
git add server/src/db/schema.sql server/src/db/repositories/users.repo.ts server/src/services/auth.service.ts server/src/services/auth.service.test.ts
git commit -m "feat(auth): revocable JWTs via token_version claim"
```

---

### Task A3: Constant-time login (kill timing user-enumeration) + per-email lockout

**Files:**
- Modify: `server/src/services/auth.service.ts` (login)
- Test: `server/src/services/auth.service.test.ts`

- [ ] **Step 1: Write failing test**:

```ts
test('login locks an email after repeated failures', async () => {
  const svc = makeService();
  await svc.register('a@b.com', 'g00d-pass-1', 'A');
  for (let i = 0; i < 8; i++) await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow(/Invalid credentials/);
  await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow(/Too many/);
});
```

- [ ] **Step 2: Run, verify fail** — FAIL (no lockout message).

- [ ] **Step 3: Implement** — add a module-level dummy hash + a per-email failure tracker, and rewrite `login`:

```ts
// module scope, after imports:
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO0u7jX7lQ1n0Y8m9aQ0bq1c2d3e4f5g'; // bcrypt of a random string
const fails = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 8, LOCK_MS = 10 * 60_000;

// inside class:
async login(email: string, password: string): Promise<AuthResult> {
  const e = normEmail(email);
  const rec = fails.get(e);
  if (rec && rec.until > Date.now()) throw new Error('Too many attempts — try again later');
  const user = this.users.findByEmail(e);
  // Always run bcrypt (dummy hash when user is missing) so timing is constant.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    const n = (rec?.until && rec.until > Date.now() ? rec.n : (rec?.n ?? 0)) + 1;
    fails.set(e, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    throw new Error('Invalid credentials');
  }
  fails.delete(e);
  return this.result(user);
}
```

Generate the real `DUMMY_HASH` with: `node -e "console.log(require('bcryptjs').hashSync('x'+Math.random(),12))"` and paste the output (do not ship the placeholder above).

- [ ] **Step 4: Run, verify pass** — `npm test -- auth.service` → PASS. Run full `npm test`.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/auth.service.ts server/src/services/auth.service.test.ts
git commit -m "feat(auth): constant-time login + per-email lockout"
```

---

### Task A4: Logout endpoint (sign-out-everywhere)

**Files:**
- Modify: `server/src/api/routes/auth.routes.ts`
- Test: `server/src/api/server.test.ts` (or auth route test — find where `/api/auth/login` is exercised)

- [ ] **Step 1: Write failing test** — add an integration test hitting `POST /api/auth/logout` with a Bearer token, asserting `200 {ok:true}` and that the *same* token then returns 401 on `GET /api/auth/me`. Use the existing supertest pattern in `server.test.ts`.

- [ ] **Step 2: Run, verify fail** — FAIL (404 on logout).

- [ ] **Step 3: Implement** — in `auth.routes.ts` add before `return r;`:

```ts
r.post('/logout', requireAuth(ctx), (req: AuthedRequest, res) => {
  ctx.users.bumpTokenVersion(req.userId!);
  res.json({ ok: true });
});
```

- [ ] **Step 4: Run, verify pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/api/routes/auth.routes.ts server/src/api/server.test.ts
git commit -m "feat(auth): logout endpoint revokes all tokens"
```

---

### Task A5: Rate-limit keys on validated IP + dedicated strict /login limiter

**Files:**
- Modify: `server/src/api/middleware/rate-limit.ts:12`, `server/src/api/server.ts:41`

- [ ] **Step 1: Implement (no unit test — middleware is skipped under NODE_ENV=test)**. In `rate-limit.ts` replace line 12:

```ts
// req.ip is derived by Express from X-Forwarded-For using `trust proxy` (1 hop = nginx),
// so it is NOT attacker-spoofable the way the raw left-most XFF entry is.
const ip = req.ip || 'unknown';
```

- [ ] **Step 2: Add dedicated login limiter** in `server.ts` — insert before line 44 (`app.use('/api/auth', authRoutes(ctx))`):

```ts
// Stricter, separate bucket on the brute-force-sensitive login route.
app.use('/api/auth/login', rateLimit({ windowMs: 60_000, max: 10, bucket: 'login' }));
```

(Keep the existing broad `/api/auth` 30/15min limiter at line 41.)

- [ ] **Step 3: Verify build** — `cd "E:/New Whatsapp/server" && npx tsc --noEmit` → clean. Run `npm test` → all green (limiters skip under test).

- [ ] **Step 4: Commit**

```bash
git add server/src/api/middleware/rate-limit.ts server/src/api/server.ts
git commit -m "fix(auth): rate-limit on validated req.ip + strict login bucket"
```

---

### Task A6: Security headers (helmet)

**Files:**
- Modify: `server/package.json`, `server/src/api/server.ts`

- [ ] **Step 1: Install** — `cd "E:/New Whatsapp/server" && npm install helmet`

- [ ] **Step 2: Implement** — in `server.ts`, add `import helmet from 'helmet';` and after `const app = express();` (line 22):

```ts
app.use(helmet({
  // The SPA is served same-origin; a tuned CSP is future work, so disable the
  // default (which would block the SPA's inline styles/scripts). Keep the rest.
  contentSecurityPolicy: false,
  // Media (/api/media, /api/profile-pic) is loaded cross-origin by Coil/ExoPlayer.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
```

- [ ] **Step 3: Verify** — `npm test` (server tests still pass; helmet just adds headers). Optionally assert `x-content-type-options: nosniff` on `/api/health` in `server.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/package-lock.json server/src/api/server.ts
git commit -m "feat(security): add helmet security headers"
```

---

# PHASE B — Android Security Hardening

### Task B1: Store JWT in EncryptedSharedPreferences

**Files:**
- Modify: `android/app/build.gradle.kts` (deps), `android/gradle/libs.versions.toml` (if used for deps), `Prefs.kt`

- [ ] **Step 1: Add dependency** — in `build.gradle.kts` dependencies block:

```kotlin
implementation("androidx.security:security-crypto:1.1.0-alpha06")
```

- [ ] **Step 2: Implement encrypted JWT in `Prefs.kt`** — add an `EncryptedSharedPreferences`-backed store for the token, keep DataStore for everything else, and migrate any legacy DataStore token on first construction:

```kotlin
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

// inside Prefs, replace the jwt flow/cache wiring:
private val secure by lazy {
    val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
    EncryptedSharedPreferences.create(
        context, "bondhu_secure", key,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
}

@Volatile private var cJwt: String? = run {
    // one-time migration: pull a legacy plaintext token out of DataStore.
    val legacy = runBlocking { ds.data.first()[Keys.JWT] }
    if (legacy != null && secure.getString("jwt", null) == null) {
        secure.edit().putString("jwt", legacy).apply()
        runBlocking { ds.edit { it.remove(Keys.JWT) } }
    }
    secure.getString("jwt", null)
}

suspend fun setJwt(v: String?) {
    cJwt = v
    secure.edit().apply { if (v == null) remove("jwt") else putString("jwt", v) }.apply()
}
```

Remove the old `val jwt: Flow<String?>` DataStore-backed reads of `Keys.JWT` and any other `Keys.JWT` writes. `jwtBlocking()` keeps returning `cJwt`.

- [ ] **Step 3: Build** — `$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; cd "E:\New Whatsapp\android"; .\gradlew.bat :app:assembleDebug` → BUILD SUCCESSFUL. (Confirm no other file reads `prefs.jwt` as a Flow; if `SocketManager`/interceptors use `jwtBlocking()` they're unaffected.)

- [ ] **Step 4: Commit**

```bash
git add android/app/build.gradle.kts android/app/src/main/java/com/bondhu/app/data/store/Prefs.kt
git commit -m "feat(android-security): store JWT in EncryptedSharedPreferences"
```

---

### Task B2: Disable cleartext + allowBackup, add network-security-config

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml:19,24`
- Create: `android/app/src/main/res/xml/network_security_config.xml`

- [ ] **Step 1: Create** `network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

- [ ] **Step 2: Edit manifest** — set `android:allowBackup="false"`, remove `android:usesCleartextTraffic="true"`, and add `android:networkSecurityConfig="@xml/network_security_config"` to `<application>`.

- [ ] **Step 3: Build** — `.\gradlew.bat :app:assembleDebug` → SUCCESS. (The app only talks to `https://wa.client-flow.xyz`, so no cleartext path is used.)

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml android/app/src/main/res/xml/network_security_config.xml
git commit -m "feat(android-security): disable cleartext + backups, add network config"
```

---

### Task B3: Wire logout to the new endpoint

**Files:**
- Modify: `android/app/src/main/java/com/bondhu/app/data/repository/AuthRepository.kt`, the API interface, and the Settings logout path

- [ ] **Step 1: Read** `AuthRepository.kt` and the Retrofit API interface to find the logout flow (Settings calls something to clear the token). Add an API method `@POST("api/auth/logout") suspend fun logout()` and have the repository call it (wrapped in try/catch — local clear must still happen if the call fails) before clearing the local token.

- [ ] **Step 2: Implement** — in the repo's existing `logout()` (or Settings logout handler):

```kotlin
suspend fun logout() {
    try { api.logout() } catch (_: Exception) { /* revoke best-effort; clear locally regardless */ }
    prefs.setJwt(null)
    prefs.setActiveAccount(null)
}
```

- [ ] **Step 3: Build** — `.\gradlew.bat :app:assembleDebug` → SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/bondhu/app/data/repository/AuthRepository.kt android/app/src/main/java/com/bondhu/app/data/api/*
git commit -m "feat(android-security): logout revokes server token"
```

---

# PHASE C — Android UI Elegance

### Task C1: Radius token scale + standardize card/dialog radii

**Files:**
- Modify: `Tokens.kt` (add `Radii`), then sweep card surfaces to use it

- [ ] **Step 1: Add** to `Tokens.kt` (after the `Tokens` object), an import `import androidx.compose.ui.unit.dp` and:

```kotlin
/** Canonical corner-radius scale — replaces scattered magic dp values. */
object Radii {
    val xs = 8.dp    // chips, small tags
    val sm = 12.dp   // fields, search, small surfaces
    val md = 16.dp   // cards, sheets, list rows
    val lg = 20.dp   // dialogs, hero cards, bubbles
    val pill = 50    // pills / FABs (Int for RoundedCornerShape(50))
}
```

- [ ] **Step 2: Sweep** — change chat-row / settings / account card shapes from `RoundedCornerShape(18.dp)` to `RoundedCornerShape(Radii.md)`, and dialog/auth cards from `RoundedCornerShape(20.dp)` to `RoundedCornerShape(Radii.lg)`. Use Grep for `RoundedCornerShape(18` and `RoundedCornerShape(20` under `ui/` and update the card surfaces (NOT bubbles — those stay 20/6 asymmetric).

- [ ] **Step 3: Build** — `.\gradlew.bat :app:assembleDebug` → SUCCESS.

- [ ] **Step 4: Commit** — `git commit -am "refactor(ui): canonical radius scale"`

---

### Task C2: Typography rhythm + contrast nudge

**Files:**
- Modify: `Type.kt`, `Tokens.kt` (TextFaint)

- [ ] **Step 1: Edit `Type.kt`** — add lineHeight + letterSpacing:

```kotlin
import androidx.compose.ui.unit.em

val BondhuTypography = Typography(
    titleLarge  = TextStyle(fontFamily = InterFamily, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 26.sp, letterSpacing = (-0.2).sp),
    titleMedium = TextStyle(fontFamily = InterFamily, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge   = TextStyle(fontFamily = InterFamily, fontWeight = FontWeight.Normal,   fontSize = 15.sp, lineHeight = 21.sp),
    bodyMedium  = TextStyle(fontFamily = InterFamily, fontWeight = FontWeight.Normal,   fontSize = 14.sp, lineHeight = 20.sp),
    labelSmall  = TextStyle(fontFamily = InterFamily, fontWeight = FontWeight.Medium,   fontSize = 11.sp, lineHeight = 14.sp),
)
```

- [ ] **Step 2: Nudge `TextFaint`** in `Tokens.kt` DarkColors from `0xFF5E6A5C` to `0xFF788471` (raises 10–11sp timestamp contrast toward WCAG without losing subtlety).

- [ ] **Step 3: Build + Commit** — `.\gradlew.bat :app:assembleDebug` → SUCCESS → `git commit -am "feat(ui): typographic rhythm + faint-text contrast"`

---

### Task C3: BondhuButton loading/press/disabled + BondhuField error + EmptyState glyph

**Files:**
- Modify: `Atoms.kt`

- [ ] **Step 1: Rewrite `BondhuButton`** with loading spinner, press-scale, disabled colors:

```kotlin
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.draw.scale

@Composable
fun BondhuButton(
    text: String, onClick: () -> Unit, modifier: Modifier = Modifier,
    enabled: Boolean = true, loading: Boolean = false,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, label = "btnScale")
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        interactionSource = interaction,
        modifier = modifier.height(52.dp).scale(scale),
        shape = PillShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary,
            disabledContainerColor = Tokens.Field, disabledContentColor = Tokens.TextFaint,
        ),
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Tokens.OnPrimary)
        else Text(text, fontWeight = FontWeight.SemiBold)
    }
}
```

- [ ] **Step 2: Add `isError`/`supportingText` to `BondhuField`**:

```kotlin
@Composable
fun BondhuField(
    value: String, onValueChange: (String) -> Unit, label: String,
    modifier: Modifier = Modifier, isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    isError: Boolean = false, supportingText: String? = null,
) {
    OutlinedTextField(
        value = value, onValueChange = onValueChange, label = { Text(label) },
        singleLine = true, modifier = modifier.fillMaxWidth(), isError = isError,
        supportingText = supportingText?.let { { Text(it, color = Tokens.Danger) } },
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Tokens.Field, unfocusedContainerColor = Tokens.Field,
            focusedBorderColor = Tokens.Primary, unfocusedBorderColor = Color.Transparent,
            errorBorderColor = Tokens.Danger, errorContainerColor = Tokens.Field,
            focusedLabelColor = Tokens.Primary, unfocusedLabelColor = Tokens.TextMut,
            cursorColor = Tokens.Primary,
        ),
        shape = RoundedCornerShape(Radii.sm),
    )
}
```

- [ ] **Step 3: EmptyState glyph** — add an optional leading icon:

```kotlin
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.Icon
import androidx.compose.ui.graphics.vector.ImageVector

@Composable
fun EmptyState(
    text: String, modifier: Modifier = Modifier,
    icon: ImageVector? = Icons.Outlined.ChatBubbleOutline,
    cta: String? = null, onCta: (() -> Unit)? = null,
) {
    Box(modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (icon != null) {
                Icon(icon, null, tint = Tokens.TextFaint.copy(alpha = 0.5f), modifier = Modifier.size(72.dp))
                Spacer(Modifier.height(16.dp))
            }
            Text(text, color = Tokens.TextMut, textAlign = TextAlign.Center)
            if (cta != null && onCta != null) { Spacer(Modifier.height(16.dp)); BondhuButton(cta, onCta) }
        }
    }
}
```

Add `import com.bondhu.app.ui.theme.Radii`.

- [ ] **Step 4: Build** — `.\gradlew.bat :app:assembleDebug` → SUCCESS.

- [ ] **Step 5: Commit** — `git commit -am "feat(ui): button loading/press/disabled, field errors, empty-state glyph"`

---

### Task C4: Navigation transitions

**Files:**
- Modify: `BondhuNavHost.kt:35`

- [ ] **Step 1: Add transitions** to the `NavHost`:

```kotlin
import androidx.compose.animation.*
import androidx.compose.animation.core.tween

NavHost(
    navController = nav,
    startDestination = start!!,
    enterTransition = { slideInHorizontally(initialOffsetX = { it / 4 }, animationSpec = tween(280)) + fadeIn(tween(280)) },
    exitTransition  = { fadeOut(tween(180)) + scaleOut(targetScale = 0.97f, animationSpec = tween(180)) },
    popEnterTransition = { fadeIn(tween(200)) + scaleIn(initialScale = 0.97f, animationSpec = tween(200)) },
    popExitTransition  = { slideOutHorizontally(targetOffsetX = { it / 4 }, animationSpec = tween(220)) + fadeOut(tween(220)) },
) { /* unchanged composable{} entries */ }
```

- [ ] **Step 2: Build + Commit** — `.\gradlew.bat :app:assembleDebug` → SUCCESS → `git commit -am "feat(ui): slide+fade navigation transitions"`

---

### Task C5: animateItem() on both lists

**Files:**
- Modify: `ChatListScreen.kt` (the `items(...)` row), `ChatScreen.kt` (the `itemsIndexed(...)` row)

- [ ] **Step 1: Read** both `items` blocks to find each row's root modifier. Add `Modifier.animateItem()` to the row root (Compose 1.7+ — verify the BOM supports it; if it resolves to `animateItemPlacement()`, use that instead inside `LazyItemScope`).

- [ ] **Step 2: Build** — `.\gradlew.bat :app:assembleDebug` → SUCCESS. If `animateItem` is unresolved, fall back to `Modifier.animateItemPlacement()`.

- [ ] **Step 3: Commit** — `git commit -am "feat(ui): animate list item placement (chat list + chat)"`

---

### Task C6: Send-bubble pop-in + animated selection

**Files:**
- Modify: `MessageBubble.kt`

- [ ] **Step 1: Read** `MessageBubble.kt` to locate the bubble `Column`/container and the selection highlight + `m.pending` usage.

- [ ] **Step 2: Pop-in** — add near the top of the bubble composable:

```kotlin
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Spring
import androidx.compose.ui.graphics.graphicsLayer

val popScale by animateFloatAsState(
    targetValue = if (m.pending) 0.94f else 1f,
    animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
    label = "popIn",
)
// apply to the bubble container modifier: .graphicsLayer { scaleX = popScale; scaleY = popScale }
```

- [ ] **Step 3: Animated selection** — replace the instant selection color with `animateColorAsState`:

```kotlin
import androidx.compose.animation.animateColorAsState
val selBg by animateColorAsState(
    if (selected) Tokens.Primary.copy(alpha = 0.12f) else Color.Transparent, label = "selBg",
)
// use selBg as the row background instead of the conditional color
```

- [ ] **Step 4: Build + Commit** — `.\gradlew.bat :app:assembleDebug` → SUCCESS → `git commit -am "feat(ui): bubble pop-in + animated selection highlight"`

---

### Task C7: De-lime Settings headers + emphasize unread chat rows

**Files:**
- Modify: `SettingsScreen.kt`, `ChatListScreen.kt`

- [ ] **Step 1: Settings headers** — find the section header `Text(...)` calls colored `Tokens.Primary` ("API keys", "Default language", "Updates", "Appearance", "Account") and change to a muted uppercase label:

```kotlin
Text(
    "API keys".uppercase(),
    color = Tokens.TextMut, fontSize = 12.sp,
    fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp,
)
```

- [ ] **Step 2: Unread emphasis** — in the chat-row composable, when `row.unread > 0` make the title `FontWeight.Bold` and the preview `color = Tokens.TextMain` (vs `TextMut` for read) so unread rows are visually distinct beyond the badge.

- [ ] **Step 3: Build + Commit** — `.\gradlew.bat :app:assembleDebug` → SUCCESS → `git commit -am "feat(ui): accent discipline in settings + unread row emphasis"`

---

### Task C8: Auth screen hero treatment

**Files:**
- Modify: `AuthScreen.kt`, `AuthViewModel.kt` (per-field validation surface, optional)

- [ ] **Step 1: Logo glow + radial background** — wrap the screen `Column` in a `Box` with a faint radial lime glow behind the logo, and add a shadow to the logo Surface:

```kotlin
import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.draw.shadow

// Background glow (place as first child of a Box wrapping the scroll Column):
Box(
    Modifier.fillMaxSize().background(
        Brush.radialGradient(
            colors = listOf(Tokens.Primary.copy(alpha = 0.10f), Tokens.AppBg),
            radius = 900f,
        )
    )
)
// Logo Surface — add a lime glow:
Surface(
    color = Tokens.Primary, shape = LogoShape,
    modifier = Modifier.size(64.dp).shadow(24.dp, LogoShape, spotColor = Tokens.Primary.copy(alpha = 0.6f)),
) { /* "B" */ }
```

- [ ] **Step 2: Real spinner CTA** — change the button call to use the new `loading` param:

```kotlin
BondhuButton(
    text = if (s.isRegister) "Create account" else "Log in",
    onClick = vm::submit, loading = s.loading,
    modifier = Modifier.fillMaxWidth(),
)
```

- [ ] **Step 3: Segmented pill toggle** — replace the `TabRow` with a custom two-segment pill (Row of two clickable, pill-shaped Boxes; selected = `Tokens.Primary`/`OnPrimary`, unselected = transparent/`TextMut`), matching the composer's mode toggle style. Keep `vm.toggleMode()` wiring.

- [ ] **Step 4: Build** — `.\gradlew.bat :app:assembleDebug` → SUCCESS.

- [ ] **Step 5: Commit** — `git commit -am "feat(ui): premium auth hero (glow, radial bg, segmented toggle, spinner CTA)"`

---

# PHASE D — Android Smoothness

### Task D1: `@Immutable` model annotations

**Files:**
- Modify: `UiModels.kt`, `AudioPlayer.kt` (Playback)

- [ ] **Step 1: Annotate** — add `import androidx.compose.runtime.Immutable` and `@Immutable` to `Account`, `ChatRow`, `ReactionUi`, `Message` in `UiModels.kt`, and to `Playback` in `AudioPlayer.kt`. (All fields are `val`; the `List<ReactionUi>` is treated as immutable under the annotation contract — never mutate it in place.)

- [ ] **Step 2: Build** — `.\gradlew.bat :app:assembleDebug` → SUCCESS.

- [ ] **Step 3: Commit** — `git commit -am "perf(ui): mark UI models @Immutable to enable skipping"`

---

### Task D2: Append fast-path instead of full re-sort

**Files:**
- Modify: `ChatViewModel.kt` (the `upsert` ~line 252 and other `sortedBy { it.timestamp }` on single-insert paths)

- [ ] **Step 1: Read** `ChatViewModel.kt` around the `upsert`/insert helpers to find each `sortedBy { it.timestamp }`.

- [ ] **Step 2: Implement a fast-path helper** and use it where a single message is added:

```kotlin
private fun insertSorted(list: List<Message>, m: Message): List<Message> {
    val last = list.lastOrNull()
    // Common case: the new message is the newest → just append, no sort.
    if (last == null || m.timestamp >= last.timestamp) return list + m
    return (list + m).sortedBy { it.timestamp }
}
```

Replace `(next).sortedBy { it.timestamp }` on the single-message add paths with `insertSorted(prev, m)`. Keep full `sortedBy` only on bulk merge (`loadOlder`, reconnect `mergeLatest`).

- [ ] **Step 3: Build + sanity** — `.\gradlew.bat :app:assembleDebug` → SUCCESS. Run `.\gradlew.bat :app:testDebugUnitTest` (24 tests) → green.

- [ ] **Step 4: Commit** — `git commit -am "perf(chat): append fast-path for newest message (skip O(n log n) sort)"`

---

### Task D3: Scope playback recomposition + slow the tick

**Files:**
- Modify: `AudioPlayer.kt:31` (tick interval), `ChatScreen.kt` (don't recompute every row from screen-level `playback`)

- [ ] **Step 1: Slow the ticker** — in `AudioPlayer.kt`, change `main.postDelayed(this, 250)` to `main.postDelayed(this, 400)` (smooth enough for a 28-bar waveform; cuts full-screen recompositions ~40%).

- [ ] **Step 2: Scope the read** — read `ChatScreen.kt` to confirm `playback` is read at screen scope and passed into rows. Wrap the per-row derivation so only the active bubble recomposes: compute `val activeId = playback.id` once, and for each row pass `isPlaying = playback.isPlaying && playback.id == m.id` and `progress = if (playback.id == m.id) ... else 0f` — these are already cheap, but ensure the `playback`-derived values are computed inside a `remember(playback, m.id)` or guarded so non-active bubbles don't recompute their waveform. If a deeper refactor is risky, at minimum keep Step 1 (the tick slowdown) which is the safe high-value win.

- [ ] **Step 3: Build + Commit** — `.\gradlew.bat :app:assembleDebug` → SUCCESS → `git commit -am "perf(chat): slower playback tick + scoped recomposition"`

---

### Task D4: Custom Coil ImageLoader (stop avatar flicker)

**Files:**
- Modify: `App.kt`

- [ ] **Step 1: Read** `App.kt` to see if it's `@HiltAndroidApp class App : Application()`. Implement `ImageLoaderFactory`:

```kotlin
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache

@HiltAndroidApp
class App : Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .memoryCache { MemoryCache.Builder(this).maxSizePercent(0.25).build() }
        .diskCache { DiskCache.Builder().directory(cacheDir.resolve("image_cache")).maxSizeBytes(60L * 1024 * 1024).build() }
        .respectCacheHeaders(false) // token-query URLs lack cache headers; cache them anyway
        .crossfade(true)
        .build()
}
```

(Keep the existing `App` body — just add the interface + method.)

- [ ] **Step 2: Build + Commit** — `.\gradlew.bat :app:assembleDebug` → SUCCESS → `git commit -am "perf(images): app-wide Coil ImageLoader with memory+disk cache"`

---

# PHASE E — Version bump, build, verify, deploy, deliver

### Task E1: Bump version + full build + unit tests

- [ ] **Step 1:** In `android/app/build.gradle.kts` set `versionCode = 35`, `versionName = "1.12.0"`.
- [ ] **Step 2:** `.\gradlew.bat :app:assembleDebug` → BUILD SUCCESSFUL; APK at `android/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] **Step 3:** `.\gradlew.bat :app:testDebugUnitTest` → all green.
- [ ] **Step 4:** `cd "E:/New Whatsapp/server" && npm test && npx tsc --noEmit` → all green, clean.
- [ ] **Step 5: Commit** — `git commit -am "chore(android): bump to v1.12.0"`

### Task E2: Merge + push + deploy server + deliver APK

- [ ] **Step 1:** Merge the feature branch to `master`, `git push origin master`.
- [ ] **Step 2:** Deploy server (auth changes are live-facing): `ssh root@144.79.218.148 'bash /opt/bondhu/deploy.sh'`. **Note:** the `users` table gains `token_version` via idempotent ALTER on boot — existing tokens carry no `tv` claim (treated as `0`), which matches the new column default, so live sessions keep working; logout/sign-out-everywhere starts bumping from there.
- [ ] **Step 3:** Build the release APK if delivering release (`.\gradlew.bat :app:assembleRelease`) or hand over the debug APK path. Upload to GitHub Releases per project convention (`gh release create v1.12.0`).
- [ ] **Step 4:** Tell the user (Banglish) what changed: revocable login + brute-force lockout + stronger passwords + encrypted token storage; smoother animations + premium auth screen + faster chat; APK path / release link.

---

## Self-Review Notes

- **Spec coverage:** Security H1 (A2+A4 revocation), H2 (A1 policy), H3 (A5 limiter), M1 (A3 constant-time), M2/M3 (B1/B2), M4 (A6 helmet). UI motion (C4/C5/C6), accent discipline (C7), typography (C2), components (C3), auth hero (C8), radii (C1). Smoothness D1–D4. All review findings mapped.
- **Backward-compat:** `token_version` default 0 == missing `tv` claim → no forced logout on deploy. Encrypted-prefs migration moves the legacy DataStore token once.
- **Risk notes:** `animateItem` API name depends on the Compose BOM version (fallback `animateItemPlacement`). helmet CSP left off to avoid breaking the SPA (future task). The D3 deep scoping is optional beyond the tick slowdown.
- **Out of scope (deferred):** refresh-token rotation (bigger client rebuild), certificate pinning, consecutive-message bubble grouping, light-theme avatar/sender palette audit — note these to the user as follow-ups.
