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
