export const SOCKET_EVENTS = {
  JOIN_RESTAURANT: 'join_restaurant',
  TRACK_ENTRY: 'track_entry',
  QUEUE_UPDATED: 'queue_updated',
  ENTRY_UPDATED: 'entry_updated',
  ORDER_UPDATED: 'order_updated'
};

export const MAX_PARTY_SIZE = 20;
export const MIN_SERVE_MINUTES = 5;
export const DEFAULT_AVG_SERVE_MINUTES = 15;
export const ROLLING_AVERAGE_WINDOW = 20;
export const DEFAULT_MAX_QUEUE_CAPACITY = 50;
export const RATE_LIMIT_QUEUE_JOIN = 30; // per minute per IP
