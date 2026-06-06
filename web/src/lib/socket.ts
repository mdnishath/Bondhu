import { io, type Socket } from 'socket.io-client';
import { auth } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (!auth.isAuthed()) return null;
  if (socket && socket.connected) return socket;
  if (!socket) {
    socket = io('/', { auth: { token: auth.token() }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
