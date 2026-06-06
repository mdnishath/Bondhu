import { io, type Socket } from 'socket.io-client';
import { auth } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (!auth.isAuthed()) return null;
  if (socket) return socket;
  socket = io('/', { auth: { token: auth.token() }, transports: ['websocket', 'polling'] });
  // Lightweight diagnostics — visible in the browser console (F12).
  socket.on('connect', () => console.log('[socket] connected', socket?.id));
  socket.on('disconnect', (r) => console.log('[socket] disconnected:', r));
  socket.on('connect_error', (e) => console.log('[socket] connect_error:', (e as Error).message));
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
