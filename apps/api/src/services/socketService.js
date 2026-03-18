let io;

export function initSocketService(socketIoInstance) {
  io = socketIoInstance;

  io.on('connection', (socket) => {
    // Staff joins restaurant room
    socket.on('join_restaurant', (restaurantId) => {
      socket.join(`restaurant:${restaurantId}`);
    });

    // Customer tracks their specific entry
    socket.on('track_entry', (entryId) => {
      socket.join(`entry:${entryId}`);
    });

    socket.on('disconnect', () => {});
  });
}

export function broadcastQueueUpdate(restaurantId, queueId = null) {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('queue_updated', {
    restaurant_id: restaurantId,
    queue_id: queueId,
    timestamp: new Date().toISOString()
  });
}

export function broadcastEntryUpdate(entryId, data) {
  if (!io) return;
  io.to(`entry:${entryId}`).emit('entry_updated', data);
}

export function broadcastOrderUpdate(restaurantId, order) {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('order_updated', order);
}
