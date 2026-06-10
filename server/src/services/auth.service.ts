import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UsersRepo, User } from '../db/repositories/users.repo.js';
import type { SettingsRepo } from '../db/repositories/settings.repo.js';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string | null };
}

const COMMON = new Set([
  'password','12345678','123456789','qwerty123','11111111','iloveyou',
  '12345678910','password1','qwertyuiop','1q2w3e4r','football','baseball',
]);
function normEmail(email: string): string { return (email ?? '').trim().toLowerCase(); }

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
    const user = this.users.findByEmail(normEmail(email));
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
