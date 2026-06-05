import { test, expect, vi } from 'vitest';
import { createContext } from '../app-context.js';
import { attachGateway } from './socket-gateway.js';

test('manager message event is emitted to the owning user room', () => {
  const ctx = createContext(':memory:');
  const acc = ctx.accounts.create({ userId: 'u1' });

  const emitted: any[] = [];
  const io: any = {
    on: vi.fn(),
    to: (room: string) => ({ emit: (ev: string, payload: any) => emitted.push({ room, ev, payload }) }),
    use: vi.fn(),
  };

  attachGateway(io, ctx);
  ctx.manager.emit('message', acc.id, { msgId: 'm1', chatJid: 'c', body: 'hi' });

  expect(emitted[0]).toMatchObject({ room: 'user:u1', ev: 'message' });
  expect(emitted[0].payload.accountId).toBe(acc.id);
});
