import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export const connectSocket = (): Socket => {
  if (socket && socket.connected) return socket;

  socket = io(BACKEND_URL, {
    transports: ['websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => console.log('[Socket] Connected to RidesRus Backend'));
  socket.on('disconnect', () => console.log('[Socket] Disconnected'));

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};
