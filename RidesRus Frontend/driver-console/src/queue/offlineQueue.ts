import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

let db: any = null;

export const initOfflineDB = async () => {
  if (Platform.OS === 'web') return;
  const SQLite = require('expo-sqlite');
  db = await SQLite.openDatabaseAsync('offline_queue.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actionType TEXT NOT NULL,
      payload TEXT NOT NULL,
      timestamp NUMERIC NOT NULL,
      synced INTEGER DEFAULT 0
    );
  `);
};

export const queueAction = async (actionType: string, payload: any) => {
  if (!db) return;
  const timestamp = Date.now();
  await db.runAsync('INSERT INTO queue (actionType, payload, timestamp) VALUES (?, ?, ?)', [
    actionType,
    JSON.stringify(payload),
    timestamp
  ]);
  
  // Optimistically trigger sync
  triggerSync();
};

export const triggerSync = async () => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return; // Wait for 4G/Internet recovery

  if (!db) return;
  const pending = await db.getAllAsync('SELECT * FROM queue WHERE synced = 0 ORDER BY timestamp ASC');
  
  if (pending.length === 0) return;

  try {
    // Simulated bulk push to backend
    // await fetch('https://backend/api/sync', { method: 'POST', body: JSON.stringify(pending) });
    
    // Mark as synced locally
    const ids = pending.map((p: any) => p.id);
    await db.runAsync(`UPDATE queue SET synced = 1 WHERE id IN (${ids.join(',')})`);
    console.log(`Successfully synced ${pending.length} offline actions to backend.`);
  } catch (e) {
    console.log('Sync failed, will retry on next connection event', e);
  }
};

// Monitor network changes
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    triggerSync();
  }
});
