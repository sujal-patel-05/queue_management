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

export function useSocket(restaurantId) {
  useEffect(() => {
    if (!restaurantId) return;
    const s = getSocket();
    s.connect();
    s.emit('join_restaurant', restaurantId);
    return () => {};
  }, [restaurantId]);

  const onQueueUpdate = useCallback((callback) => {
    const s = getSocket();
    s.on('queue_updated', callback);
    return () => s.off('queue_updated', callback);
  }, []);

  const onOrderUpdate = useCallback((callback) => {
    const s = getSocket();
    s.on('order_updated', callback);
    return () => s.off('order_updated', callback);
  }, []);

  return { onQueueUpdate, onOrderUpdate };
}
