import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3005';

let socket: Socket | null = null;

export const connectDriverSocket = (busId: string): Socket => {
  if (socket && socket.connected) return socket;

  socket = io(BACKEND_URL, {
    transports: ['websocket'],
    reconnectionAttempts: 20,    // More retries for intermittent Lagos connectivity
    reconnectionDelay: 3000,
  });

  socket.on('connect', () => {
    console.log('[Driver Socket] Connected to backend');
    // Join this driver's private room so hail alerts reach only this bus
    socket?.emit('driver_online', { busId });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Driver Socket] Disconnected:', reason);
    // Socket.io auto-reconnects - actions are queued in SQLite meanwhile
  });

  return socket;
};

export const getDriverSocket = (): Socket | null => socket;
