import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { formatPaise } from '@qflow/shared';
import {
  Loader2, Plus, Edit3, Trash2, ToggleLeft, ToggleRight,
  Leaf, X, Save, ImagePlus, UtensilsCrossed
} from 'lucide-react';

export default function MenuManage() {
  const user = useAuthStore(s => s.user);
  const restaurantId = user?.restaurant_id;

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  // Item form state
  const [itemForm, setItemForm] = useState({
    name: '', description: '', price_paise: '', category_id: '',
    is_veg: true, is_featured: false, preparation_minutes: 10, image_url: ''
  });

  // Category form state
  const [catName, setCatName] = useState('');

  useEffect(() => {
    fetchMenu();
  }, [restaurantId]);

  async function fetchMenu() {
    if (!restaurantId) return;
    try {
      const data = await api.get(`/api/menu/${restaurantId}`);
      setCategories(data.categories || []);
      setItems(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openNewItem() {
    setEditingItem(null);
    setItemForm({
      name: '', description: '', price_paise: '', category_id: categories[0]?.id || '',
      is_veg: true, is_featured: false, preparation_minutes: 10, image_url: ''
    });
    setShowItemModal(true);
  }

  function openEditItem(item) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || '',
      price_paise: (item.price_paise / 100).toString(),
      category_id: item.category_id || '',
      is_veg: item.is_veg,
      is_featured: item.is_featured,
      preparation_minutes: item.preparation_minutes || 10,
      image_url: item.image_url || ''
    });
    setShowItemModal(true);
  }

  async function saveItem(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...itemForm,
      price_paise: Math.round(parseFloat(itemForm.price_paise) * 100)
    };

    try {
      if (editingItem) {
        await api.patch(`/api/menu/item/${editingItem.id}`, payload);
      } else {
        await api.post('/api/menu/item', payload);
      }
      setShowItemModal(false);
      fetchMenu();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/menu/category', { name: catName });
      setCatName('');
      setShowCatModal(false);
      fetchMenu();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item) {
    try {
      await api.patch(`/api/menu/item/${item.id}/toggle`);
      fetchMenu();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Menu Management</h2>
          <p className="text-text-muted text-sm">{items.length} items across {categories.length} categories</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCatModal(true)} className="btn-secondary">
            <Plus className="w-4 h-4" />
            Category
          </button>
          <button onClick={openNewItem} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Categories & Items */}
      {categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id);
        return (
          <div key={cat.id} className="mb-8">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
              {cat.name}
              <span className="text-text-muted">({catItems.length})</span>
            </h3>
            
            {catItems.length === 0 ? (
              <p className="text-text-muted text-sm pl-1">No items in this category</p>
            ) : (
              <div className="space-y-2">
                {catItems.map(item => (
                  <div key={item.id} className={`card flex items-center gap-4 ${!item.is_available ? 'opacity-50' : ''}`}>
                    {/* Image */}
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-surface-3 flex items-center justify-center">
                        <UtensilsCrossed className="w-6 h-6 text-text-muted" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center ${item.is_veg ? 'border-green-500' : 'border-red-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                        </span>
                        <span className="font-medium text-text-primary text-sm">{item.name}</span>
                        {item.is_featured && <span className="badge-warning text-[10px]">Featured</span>}
                        {!item.is_available && <span className="badge-danger text-[10px]">Sold Out</span>}
                      </div>
                      <p className="text-text-muted text-xs mt-0.5 truncate">{item.description}</p>
                    </div>

                    {/* Price & Actions */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-text-primary">{formatPaise(item.price_paise)}</span>
                      <button onClick={() => toggleAvailability(item)} className="btn-ghost" title="Toggle availability">
                        {item.is_available ? (
                          <ToggleRight className="w-5 h-5 text-brand-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-text-muted" />
                        )}
                      </button>
                      <button onClick={() => openEditItem(item)} className="btn-ghost">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Uncategorized */}
      {items.filter(i => !i.category_id).length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Uncategorized</h3>
          <div className="space-y-2">
            {items.filter(i => !i.category_id).map(item => (
              <div key={item.id} className="card flex items-center justify-between">
                <span className="text-text-primary text-sm">{item.name}</span>
                <span className="font-mono text-text-secondary">{formatPaise(item.price_paise)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowItemModal(false)}>
          <form onSubmit={saveItem} className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-text-primary">{editingItem ? 'Edit Item' : 'New Item'}</h3>
              <button type="button" onClick={() => setShowItemModal(false)} className="btn-ghost">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-text-secondary text-sm font-medium mb-1">Name *</label>
                <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} required className="w-full" />
              </div>
              <div>
                <label className="block text-text-secondary text-sm font-medium mb-1">Description</label>
                <textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} className="w-full" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary text-sm font-medium mb-1">Price (₹) *</label>
                  <input type="number" step="0.01" min="0" value={itemForm.price_paise} onChange={e => setItemForm(f => ({ ...f, price_paise: e.target.value }))} required className="w-full" />
                </div>
                <div>
                  <label className="block text-text-secondary text-sm font-medium mb-1">Category</label>
                  <select value={itemForm.category_id} onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))} className="w-full">
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-text-secondary text-sm font-medium mb-1">Image URL</label>
                <input value={itemForm.image_url} onChange={e => setItemForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." className="w-full" />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={itemForm.is_veg} onChange={e => setItemForm(f => ({ ...f, is_veg: e.target.checked }))} className="w-4 h-4 rounded border-surface-border bg-surface-4 text-brand-500 focus:ring-brand-500" />
                  <span className="text-sm text-text-secondary">Vegetarian</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={itemForm.is_featured} onChange={e => setItemForm(f => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4 rounded border-surface-border bg-surface-4 text-brand-500 focus:ring-brand-500" />
                  <span className="text-sm text-text-secondary">Featured</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-surface-border">
              <button type="button" onClick={() => setShowItemModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCatModal(false)}>
          <form onSubmit={saveCategory} className="card w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">New Category</h3>
            <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Starters, Main Course" required className="w-full mb-4" />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCatModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
