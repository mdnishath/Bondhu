import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UsersRepo, User } from '../db/repositories/users.repo.js';
import type { SettingsRepo } from '../db/repositories/settings.repo.js';
import { config } from '../config.js';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string | null };
}

const COMMON = new Set([
  'password','12345678','123456789','qwerty123','11111111','iloveyou',
  '12345678910','password1','qwertyuiop','1q2w3e4r','football','baseball',
]);
function normEmail(email: string): string { return (email ?? '').trim().toLowerCase(); }

// A real bcrypt hash compared against when the email is unknown, so login takes
// roughly the same time whether or not the account exists (no user-enumeration
// timing oracle).
const DUMMY_HASH = '$2b$12$zBIQDtzrXYi6xpEsE88Z.OGn0iROgvNmOU/SLYqi3DcRBKs3Mn9gO';
const fails = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 8, LOCK_MS = 10 * 60_000;

export class AuthService {
  constructor(private users: UsersRepo, private settings: SettingsRepo) {}

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

  async login(email: string, password: string): Promise<AuthResult> {
    const e = normEmail(email);
    const rec = fails.get(e);
    if (rec && rec.until > Date.now()) throw new Error('Too many attempts — try again later');
    const user = this.users.findByEmail(e);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      const prior = (rec?.n ?? 0);
      const n = prior + 1;
      fails.set(e, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
      // Opportunistic cleanup so a unique-email enumeration flood can't grow the
      // map unbounded: keep only still-active locks (until in the future), drop
      // expired locks and not-yet-locked counters.
      if (fails.size > 5000) { const t = Date.now(); for (const [k, v] of fails) if (v.until < t) fails.delete(k); }
      throw new Error('Invalid credentials');
    }
    fails.delete(e);
    return this.result(user);
  }

  verifyToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.settings.getOrCreateJwtSecret()) as any;
    const user = this.users.findById(payload.sub);
    if (!user || (payload.tv ?? 0) !== user.tokenVersion) throw new Error('Token revoked');
    return { userId: payload.sub };
  }

  private result(user: User): AuthResult {
    const token = jwt.sign({ sub: user.id, tv: user.tokenVersion }, this.settings.getOrCreateJwtSecret(), { expiresIn: config.jwtExpiresIn });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }
}
