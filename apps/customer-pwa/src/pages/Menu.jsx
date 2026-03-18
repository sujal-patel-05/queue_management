import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, ShoppingCart, Plus, Minus, Leaf, Drumstick, X, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { formatPaise } from '@qflow/shared';

export default function Menu() {
  const { entryId } = useParams();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restaurantId, setRestaurantId] = useState(null);

  useEffect(() => {
    loadMenu();
  }, [entryId]);

  async function loadMenu() {
    try {
      const statusData = await api.get(`/api/queue/status/${entryId}`);
      setRestaurantId(statusData.restaurant_id);
      const data = await api.get(`/api/menu/public/${statusData.restaurant_id}`);
      setCategories(data.categories || []);
      setItems(data.items || []);
      if (data.categories?.length > 0) setActiveCategory(data.categories[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (!activeCategory) return items;
    return items.filter(i => i.category_id === activeCategory);
  }, [items, activeCategory]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = items.find(i => i.id === id);
        return { ...item, quantity: qty };
      })
      .filter(Boolean);
  }, [cart, items]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price_paise * item.quantity, 0);
  }, [cartItems]);

  const cartCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  function addToCart(itemId) {
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  }

  function removeFromCart(itemId) {
    setCart(prev => {
      const next = { ...prev };
      if (next[itemId] > 1) next[itemId]--;
      else delete next[itemId];
      return next;
    });
  }

  async function placeOrder(paymentMethod = 'cash') {
    try {
      setSubmitting(true);
      const orderItems = cartItems.map(item => ({
        menu_item_id: item.id,
        quantity: item.quantity
      }));

      const data = await api.post('/api/orders/place', {
        entry_id: entryId,
        items: orderItems,
        payment_method: paymentMethod
      });

      navigate(`/queue/${entryId}/order/${data.order_id}`);
    } catch (err) {
      alert(err.message);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 glass px-4 py-3 flex items-center gap-3 border-b border-surface-border">
        <Link to={`/queue/${entryId}`} className="p-2 rounded-lg hover:bg-surface-3 transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <h1 className="text-lg font-semibold text-text-primary flex-1">Menu</h1>
      </header>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="sticky top-[57px] z-20 glass border-b border-surface-border">
          <div className="flex overflow-x-auto gap-1 px-4 py-2 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  activeCategory === cat.id
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                    : 'bg-surface-3 text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <main className="flex-1 px-4 py-4 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted">No items available in this category</p>
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <div
              key={item.id}
              className="card flex gap-4 animate-fade-in"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              {/* Image */}
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      {item.is_veg ? (
                        <span className="w-4 h-4 border-2 border-green-500 rounded-sm flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                        </span>
                      ) : (
                        <span className="w-4 h-4 border-2 border-red-500 rounded-sm flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                        </span>
                      )}
                      <h3 className="font-semibold text-text-primary text-sm">{item.name}</h3>
                    </div>
                    {item.description && (
                      <p className="text-text-muted text-xs line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-text-primary">{formatPaise(item.price_paise)}</span>

                  {cart[item.id] ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 rounded-lg bg-surface-4 border border-surface-border flex items-center justify-center hover:bg-red-500/20 transition-colors"
                      >
                        <Minus className="w-4 h-4 text-text-primary" />
                      </button>
                      <span className="font-mono font-bold text-brand-400 w-6 text-center">{cart[item.id]}</span>
                      <button
                        onClick={() => addToCart(item.id)}
                        className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center hover:bg-brand-600 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item.id)}
                      className="px-4 py-1.5 rounded-lg border-2 border-brand-500 text-brand-400 text-sm font-semibold hover:bg-brand-500/10 transition-colors"
                    >
                      ADD
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Cart Bottom Sheet */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 animate-slide-up">
          {showCart ? (
            <div className="card-elevated max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-primary">Your Order</h3>
                <button onClick={() => setShowCart(false)} className="p-1 rounded-lg hover:bg-surface-4">
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary text-sm">{item.name}</span>
                      <span className="text-text-muted text-xs">× {item.quantity}</span>
                    </div>
                    <span className="text-text-primary font-medium text-sm">
                      {formatPaise(item.price_paise * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-surface-border pt-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-primary font-bold">Total</span>
                  <span className="text-xl font-bold gradient-text">{formatPaise(cartTotal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => placeOrder('cash')}
                  disabled={submitting}
                  className="btn-secondary text-sm py-3"
                >
                  Pay at Counter
                </button>
                <button
                  onClick={() => placeOrder('online')}
                  disabled={submitting}
                  className="btn-primary text-sm py-3"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pay Online'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCart(true)}
              className="btn-primary w-full py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <span>{cartCount} item{cartCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{formatPaise(cartTotal)}</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          )}
        </div>
      )}

      {/* No scrollbar styles */}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}
