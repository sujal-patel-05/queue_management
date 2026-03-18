export const QueueEntryStatus = {
  WAITING: 'waiting',
  CALLED: 'called',
  SEATED: 'seated',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled'
};

export const OrderStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

export const TableStatus = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  CLEANING: 'cleaning',
  BLOCKED: 'blocked'
};

export const StaffRole = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  KITCHEN: 'kitchen'
};

export const PaymentStatus = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  REFUNDED: 'refunded'
};

export const PaymentMethod = {
  UPI: 'upi',
  CARD: 'card',
  CASH: 'cash',
  ONLINE: 'online'
};
