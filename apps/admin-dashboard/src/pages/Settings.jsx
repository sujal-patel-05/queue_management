import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { generateQueueUrl } from '@qflow/shared';
import { QRCodeSVG } from 'qrcode.react';
import {
  Loader2, Save, Plus, Trash2, Settings2, QrCode, Users,
  Table2, Download, Copy, Check, X
} from 'lucide-react';

export default function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const restaurantId = user?.restaurant_id;

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Tables state
  const [tables, setTables] = useState([]);
  const [newTable, setNewTable] = useState({ label: '', capacity: 4, section: 'main' });
  const [showTableForm, setShowTableForm] = useState(false);

  // Queue state
  const [queues, setQueues] = useState([]);

  const [staffList, setStaffList] = useState([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [addingStaff, setAddingStaff] = useState(false);

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  async function fetchData() {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [tableData, queueData, staffData] = await Promise.all([
        api.get(`/api/tables/${restaurantId}`),
        api.get(`/api/queue/live/${restaurantId}`),
        api.get('/api/auth/staff').catch(() => ({ staff: [user] }))
      ]);
      setTables(tableData.tables || []);
      setQueues(queueData.queues || []);
      setStaffList(staffData.staff || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function addTable(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/tables', newTable);
      setNewTable({ label: '', capacity: 4, section: 'main' });
      setShowTableForm(false);
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTable(tableId) {
    if (!confirm('Delete this table?')) return;
    try {
      await api.delete(`/api/tables/${tableId}`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAddStaff(e) {
    e.preventDefault();
    setAddingStaff(true);
    try {
      await api.post('/api/auth/add-staff', newStaff);
      setNewStaff({ name: '', email: '', password: '', role: 'staff' });
      setShowStaffForm(false);
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingStaff(false);
    }
  }

  function copyUrl(url) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: Settings2 },
    { id: 'tables', label: 'Tables', icon: Table2 },
    { id: 'qr', label: 'QR Codes', icon: QrCode },
    { id: 'staff', label: 'Staff', icon: Users },
  ];

  const queueUrl = generateQueueUrl(user?.restaurant_slug || 'demo', import.meta.env.VITE_CUSTOMER_URL || 'http://localhost:5173');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-text-primary mb-6">Settings</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-2 rounded-xl p-1 border border-surface-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card animate-fade-in space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Restaurant Profile</h3>
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1">Restaurant Name</label>
            <input value={user?.restaurant_name || ''} readOnly className="w-full opacity-70" />
          </div>
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1">Owner</label>
            <input value={user?.name || ''} readOnly className="w-full opacity-70" />
          </div>
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1">Email</label>
            <input value={user?.email || ''} readOnly className="w-full opacity-70" />
          </div>
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1">Role</label>
            <span className="badge-info capitalize">{user?.role}</span>
          </div>
        </div>
      )}

      {/* Tables Tab */}
      {activeTab === 'tables' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-text-muted text-sm">{tables.length} tables configured</p>
            <button onClick={() => setShowTableForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Table
            </button>
          </div>

          {showTableForm && (
            <form onSubmit={addTable} className="card mb-4 space-y-3 animate-fade-in">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-text-secondary text-xs font-medium mb-1">Label *</label>
                  <input
                    value={newTable.label}
                    onChange={e => setNewTable(t => ({ ...t, label: e.target.value }))}
                    placeholder="T1, Window 3..."
                    required
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs font-medium mb-1">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newTable.capacity}
                    onChange={e => setNewTable(t => ({ ...t, capacity: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs font-medium mb-1">Section</label>
                  <input
                    value={newTable.section}
                    onChange={e => setNewTable(t => ({ ...t, section: e.target.value }))}
                    placeholder="main, outdoor..."
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTableForm(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Add Table
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {tables.map(table => (
              <div key={table.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center">
                    <span className="font-mono font-bold text-text-primary text-sm">{table.label}</span>
                  </div>
                  <div>
                    <p className="text-sm text-text-primary">{table.capacity} seats · {table.section}</p>
                    <p className={`text-xs ${table.status === 'available' ? 'text-brand-400' : table.status === 'occupied' ? 'text-red-400' : 'text-amber-400'}`}>
                      {table.status}
                    </p>
                  </div>
                </div>
                <button onClick={() => deleteTable(table.id)} className="btn-ghost text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Codes Tab */}
      {activeTab === 'qr' && (
        <div className="animate-fade-in">
          <div className="card text-center max-w-sm mx-auto">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Customer QR Code</h3>
            <p className="text-text-muted text-sm mb-5">Customers scan this to join your queue</p>

            <div className="bg-white p-6 rounded-2xl inline-block mb-5">
              <QRCodeSVG
                value={queueUrl}
                size={200}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            <p className="text-text-secondary text-sm font-mono mb-4 break-all">{queueUrl}</p>

            <div className="flex items-center justify-center gap-3">
              <button onClick={() => copyUrl(queueUrl)} className="btn-secondary">
                {copied ? <Check className="w-4 h-4 text-brand-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Tab */}
      {activeTab === 'staff' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-text-muted text-sm">Manage your team members</p>
            {user?.role === 'owner' || user?.role === 'manager' ? (
              <button onClick={() => setShowStaffForm(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Invite Staff
              </button>
            ) : null}
          </div>

          {showStaffForm && (
            <form onSubmit={handleAddStaff} className="card mb-4 space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary text-xs font-medium mb-1">Name *</label>
                  <input
                    value={newStaff.name}
                    onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))}
                    placeholder="John Doe"
                    required
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={newStaff.email}
                    onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))}
                    placeholder="john@example.com"
                    required
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs font-medium mb-1">Password *</label>
                  <input
                    type="password"
                    value={newStaff.password}
                    onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs font-medium mb-1">Role *</label>
                  <select
                    value={newStaff.role}
                    onChange={e => setNewStaff(s => ({ ...s, role: e.target.value }))}
                    className="w-full rounded-xl bg-surface-3 border border-surface-border text-text-primary focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none p-2.5 text-sm"
                  >
                    <option value="staff">Staff</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowStaffForm(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={addingStaff} className="btn-primary text-xs">
                  {addingStaff ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Add Staff
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2 mt-4">
            {staffList.map(member => (
              <div key={member.id} className="card flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                    <span className="font-semibold text-brand-400 text-sm">{member.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{member.name}</p>
                    <p className="text-xs text-text-muted">{member.email}</p>
                  </div>
                </div>
                <span className={`capitalize text-xs px-2 py-1 rounded-md ${
                  member.role === 'owner' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  member.role === 'manager' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' :
                  'bg-surface-3 text-text-secondary border border-surface-border'
                }`}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
