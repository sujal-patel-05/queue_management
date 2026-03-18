import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import api from '../lib/api';
import { formatPaise, getElapsedMinutes } from '@qflow/shared';
import { Loader2, Clock, ChefHat, CheckCircle2, ArrowRight, Volume2, VolumeX } from 'lucide-react';

export default function Kitchen() {
  const user = useAuthStore(s => s.user);
  const restaurantId = user?.restaurant_id;
  const { onOrderUpdate } = useSocket(restaurantId);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await api.get(`/api/orders/kitchen/${restaurantId}`);
      setOrders(data.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();
    const cleanup = onOrderUpdate((data) => {
      fetchOrders();
      if (soundEnabled && data?.status === 'pending') {
        try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + 'tvT19').play().catch(() => {}); } catch {}
      }
    });
    const interval = setInterval(fetchOrders, 10000);
    return () => { cleanup(); clearInterval(interval); };
  }, [fetchOrders, onOrderUpdate, soundEnabled]);

  async function updateOrderStatus(orderId, newStatus) {
    setActionLoading(orderId);
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status: newStatus });
      fetchOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const pending = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'confirmed' || o.status === 'preparing');
  const ready = orders.filter(o => o.status === 'ready');

  const columns = [
    { title: 'New Orders', items: pending, nextStatus: 'preparing', nextLabel: 'Start Preparing', color: 'amber' },
    { title: 'Preparing', items: preparing, nextStatus: 'ready', nextLabel: 'Mark Ready', color: 'blue' },
    { title: 'Ready', items: ready, nextStatus: 'delivered', nextLabel: 'Delivered', color: 'emerald' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <ChefHat className="w-6 h-6 text-brand-500" />
          <div>
            <h2 className="text-lg font-bold text-text-primary">Kitchen Display</h2>
            <p className="text-text-muted text-xs">{orders.length} active orders</p>
          </div>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="btn-ghost"
          title={soundEnabled ? 'Mute sound' : 'Enable sound'}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      {/* KDS Columns */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex h-full min-w-[900px]">
          {columns.map(col => (
            <div key={col.title} className="flex-1 border-r border-surface-border last:border-r-0 flex flex-col">
              {/* Column Header */}
              <div className={`px-4 py-3 bg-${col.color}-500/5 border-b border-surface-border`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-text-primary">{col.title}</h3>
                  <span className={`w-6 h-6 rounded-full bg-${col.color}-500/20 text-${col.color}-400 text-xs font-bold flex items-center justify-center`}>
                    {col.items.length}
                  </span>
                </div>
              </div>

              {/* Order Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {col.items.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-text-muted text-sm">No orders</p>
                  </div>
                ) : (
                  col.items.map((order, idx) => {
                    const elapsed = getElapsedMinutes(order.placed_at);
                    const entryInfo = order.queue_entries;
                    return (
                      <div key={order.id} className="card animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                        {/* Order Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-brand-400 text-lg">
                              #{entryInfo?.token_number || '—'}
                            </span>
                            <span className="text-text-secondary text-sm">{entryInfo?.customer_name}</span>
                          </div>
                          <span className={`text-xs font-mono ${elapsed > 15 ? 'text-red-400' : elapsed > 8 ? 'text-amber-400' : 'text-text-muted'}`}>
                            {elapsed}m
                          </span>
                        </div>

                        {/* Items */}
                        <div className="space-y-1.5 mb-3">
                          {(order.order_items || []).map(item => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-text-primary w-6">{item.quantity}×</span>
                                <span className="text-text-primary">{item.item_name}</span>
                              </div>
                              {item.customization && (
                                <span className="text-text-muted text-xs italic">{item.customization}</span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Special Instructions */}
                        {order.special_instructions && (
                          <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 mb-3">
                            <p className="text-amber-400 text-xs">📝 {order.special_instructions}</p>
                          </div>
                        )}

                        {/* Total & Action */}
                        <div className="flex items-center justify-between pt-2 border-t border-surface-border">
                          <span className="text-text-secondary text-xs font-medium">{formatPaise(order.total_paise)}</span>
                          <button
                            onClick={() => updateOrderStatus(order.id, col.nextStatus)}
                            disabled={actionLoading === order.id}
                            className="btn-primary text-xs py-1.5 px-3"
                          >
                            {actionLoading === order.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                {col.nextLabel}
                                <ArrowRight className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
