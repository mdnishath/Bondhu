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
