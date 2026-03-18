import { useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL;
let socket;

function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

export function useSocket() {
  useEffect(() => {
    const s = getSocket();
    s.connect();
    return () => {};
  }, []);

  const trackEntry = useCallback((entryId) => {
    getSocket().emit('track_entry', entryId);
  }, []);

  const onEntryUpdate = useCallback((callback) => {
    const s = getSocket();
    s.on('entry_updated', callback);
    return () => s.off('entry_updated', callback);
  }, []);

  const onQueueUpdate = useCallback((callback) => {
    const s = getSocket();
    s.on('queue_updated', callback);
    return () => s.off('queue_updated', callback);
  }, []);

  return { trackEntry, onEntryUpdate, onQueueUpdate };
}
