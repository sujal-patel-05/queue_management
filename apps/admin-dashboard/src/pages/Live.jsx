import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import api from '../lib/api';
import { getElapsedMinutes, formatWaitTime } from '@qflow/shared';
import {
  Loader2, PhoneCall, UserCheck, UserX, Users, Clock, ArrowRight,
  Pause, Play, RefreshCw, Hash
} from 'lucide-react';

function getWaitColor(minutes) {
  if (minutes < 10) return 'text-emerald-400';
  if (minutes < 20) return 'text-amber-400';
  return 'text-red-400';
}

function getWaitBg(minutes) {
  if (minutes < 10) return 'border-emerald-500/20 bg-emerald-500/5';
  if (minutes < 20) return 'border-amber-500/20 bg-amber-500/5';
  return 'border-red-500/20 bg-red-500/5';
}

function statusBadge(status) {
  const map = {
    waiting: 'badge-warning',
    called: 'badge-info',
    seated: 'badge-success',
    no_show: 'badge-danger',
    completed: 'badge-success',
    cancelled: 'badge-neutral'
  };
  return map[status] || 'badge-neutral';
}

export default function Live() {
  const user = useAuthStore(s => s.user);
  const restaurantId = user?.restaurant_id;
  const { onQueueUpdate } = useSocket(restaurantId);

  const [entries, setEntries] = useState([]);
  const [queues, setQueues] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [queueData, tableData] = await Promise.all([
        api.get(`/api/queue/live/${restaurantId}`),
        api.get(`/api/tables/${restaurantId}`)
      ]);
      setEntries(queueData.entries || []);
      setQueues(queueData.queues || []);
      setTables(tableData.tables || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchData();
    const cleanup = onQueueUpdate(() => fetchData());
    const interval = setInterval(fetchData, 15000);
    return () => { cleanup(); clearInterval(interval); };
  }, [fetchData, onQueueUpdate]);

  async function callNext(queueId) {
    setActionLoading('call-next');
    try {
      await api.post('/api/queue/call-next', { queue_id: queueId });
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function callSpecific(entryId) {
    setActionLoading(entryId);
    try {
      await api.post(`/api/queue/call/${entryId}`);
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function updateEntryStatus(entryId, status, tableId = null) {
    setActionLoading(entryId);
    try {
      await api.patch(`/api/queue/entry/${entryId}/status`, {
        status,
        table_id: tableId
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function togglePause(queueId, isPaused) {
    try {
      await api.patch(`/api/queue/queue/${queueId}/pause`, { is_paused: !isPaused });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function releaseTable(tableId) {
    try {
      await api.post(`/api/tables/${tableId}/release`, {});
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  }

  const waitingEntries = entries.filter(e => e.status === 'waiting');
  const calledEntries = entries.filter(e => e.status === 'called');
  const availableTables = tables.filter(t => t.status === 'available');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Queue Panel */}
      <div className="flex-1 lg:border-r border-surface-border overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Live Queue</h2>
              <p className="text-text-muted text-sm">{waitingEntries.length} waiting · {calledEntries.length} called</p>
            </div>
            <button onClick={fetchData} className="btn-ghost">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Queue Controls */}
          {queues.map(q => (
            <div key={q.id} className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-text-primary">{q.name}</h3>
                  {q.is_paused && <span className="badge-warning">Paused</span>}
                  <span className="text-text-muted text-xs">Now serving: #{q.now_serving || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePause(q.id, q.is_paused)}
                    className="btn-ghost text-xs"
                  >
                    {q.is_paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {q.is_paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => callNext(q.id)}
                    disabled={actionLoading === 'call-next'}
                    className="btn-primary text-xs py-2"
                  >
                    {actionLoading === 'call-next' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                    Call Next
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Called Section */}
          {calledEntries.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">Called — Waiting to be Seated</h4>
              <div className="space-y-2">
                {calledEntries.map(entry => {
                  const elapsed = getElapsedMinutes(entry.joined_at);
                  return (
                    <div key={entry.id} className={`card border-2 ${getWaitBg(elapsed)} flex items-center justify-between animate-fade-in`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <span className="font-mono font-bold text-blue-400 text-lg">#{entry.token_number}</span>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">{entry.customer_name}</p>
                          <div className="flex items-center gap-3 text-xs text-text-muted">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{entry.party_size}</span>
                            <span className={`flex items-center gap-1 ${getWaitColor(elapsed)}`}><Clock className="w-3 h-3" />{elapsed}m</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          onChange={e => {
                            if (e.target.value) updateEntryStatus(entry.id, 'seated', e.target.value);
                          }}
                          defaultValue=""
                          className="text-xs py-1.5 px-2"
                        >
                          <option value="" disabled>Assign Table</option>
                          {availableTables.map(t => (
                            <option key={t.id} value={t.id}>{t.label} ({t.capacity} seats)</option>
                          ))}
                        </select>
                        <button
                          onClick={() => updateEntryStatus(entry.id, 'no_show')}
                          disabled={actionLoading === entry.id}
                          className="btn-ghost text-red-400 text-xs"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Waiting Section */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
              Waiting ({waitingEntries.length})
            </h4>
            {waitingEntries.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-text-muted">No one waiting in queue 🎉</p>
              </div>
            ) : (
              <div className="space-y-2">
                {waitingEntries.map((entry, idx) => {
                  const elapsed = getElapsedMinutes(entry.joined_at);
                  return (
                    <div key={entry.id} className={`card flex items-center justify-between animate-fade-in`} style={{ animationDelay: `${idx * 0.03}s` }}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center">
                          <span className="font-mono font-bold text-text-primary text-sm">#{entry.token_number}</span>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary text-sm">{entry.customer_name}</p>
                          <div className="flex items-center gap-3 text-xs text-text-muted">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{entry.party_size}</span>
                            <span className={`flex items-center gap-1 ${getWaitColor(elapsed)}`}><Clock className="w-3 h-3" />{elapsed}m</span>
                            {entry.notes && <span title={entry.notes}>📝</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => callSpecific(entry.id)}
                          disabled={actionLoading === entry.id}
                          className="btn-ghost text-xs"
                          title="Call this token"
                        >
                          {actionLoading === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => updateEntryStatus(entry.id, 'cancelled')}
                          className="btn-ghost text-red-400 text-xs"
                          title="Cancel"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floor Map Panel */}
      <div className="lg:w-[400px] border-t lg:border-t-0 border-surface-border overflow-y-auto bg-surface-1">
        <div className="p-6">
          <h3 className="text-lg font-bold text-text-primary mb-1">Floor Map</h3>
          <p className="text-text-muted text-xs mb-4">
            {availableTables.length} of {tables.length} tables available
          </p>

          <div className="grid grid-cols-2 gap-3">
            {tables.map(table => {
              const isOccupied = table.status === 'occupied';
              const isCleaning = table.status === 'cleaning';
              const entryData = table.queue_entries;
              const occupiedMinutes = entryData?.seated_at ? getElapsedMinutes(entryData.seated_at) : 0;

              return (
                <div
                  key={table.id}
                  className={`rounded-xl border-2 p-3 transition-all duration-200 ${
                    isOccupied
                      ? 'border-red-500/30 bg-red-500/5'
                      : isCleaning
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-brand-500/20 bg-brand-500/5 hover:border-brand-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-text-primary text-sm">{table.label}</span>
                    <span className="text-xs text-text-muted">{table.capacity} 👤</span>
                  </div>

                  {isOccupied && entryData ? (
                    <div className="mt-2">
                      <p className="text-xs text-text-secondary">#{entryData.token_number} · {entryData.customer_name}</p>
                      <p className="text-xs text-text-muted">{occupiedMinutes}m seated</p>
                      <button
                        onClick={() => releaseTable(table.id)}
                        className="mt-2 text-xs text-brand-400 hover:text-brand-300 font-medium"
                      >
                        Release Table
                      </button>
                    </div>
                  ) : isCleaning ? (
                    <div className="mt-2">
                      <p className="text-xs text-amber-400">Cleaning</p>
                      <button
                        onClick={() => releaseTable(table.id)}
                        className="mt-1 text-xs text-brand-400 hover:text-brand-300 font-medium"
                      >
                        Mark Available
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-brand-400 mt-2">Available</p>
                  )}
                </div>
              );
            })}
          </div>

          {tables.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-text-muted text-sm">No tables configured</p>
              <p className="text-text-muted text-xs mt-1">Add tables in Settings</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
