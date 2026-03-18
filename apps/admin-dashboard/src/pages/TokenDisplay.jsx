import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import api from '../lib/api';
import { Loader2, Zap } from 'lucide-react';

export default function TokenDisplay() {
  const { restaurantId: paramId } = useParams();
  const user = useAuthStore(s => s.user);
  const restaurantId = paramId || user?.restaurant_id;
  const { onQueueUpdate } = useSocket(restaurantId);

  const [queues, setQueues] = useState([]);
  const [recentCalled, setRecentCalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await api.get(`/api/queue/live/${restaurantId}`);
      setQueues(data.queues || []);
      const called = (data.entries || [])
        .filter(e => e.status === 'called')
        .slice(0, 5);
      setRecentCalled(called);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchData();
    const cleanup = onQueueUpdate(() => fetchData());
    const interval = setInterval(fetchData, 10000);
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => { cleanup(); clearInterval(interval); clearInterval(clock); };
  }, [fetchData, onQueueUpdate]);

  // Enter fullscreen on mount
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  const mainQueue = queues[0];
  const nowServing = mainQueue?.now_serving;

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-8 select-none cursor-none overflow-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-2xl shadow-brand-500/30">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">QFlow</h1>
        </div>
        <p className="text-text-muted text-lg">
          {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Now Serving */}
      <div className="relative text-center mb-16">
        <p className="text-text-muted text-xl uppercase tracking-[0.3em] mb-6">Now Serving</p>
        <div className="relative inline-block">
          {/* Pulsing rings */}
          <div className="absolute inset-0 -m-8 rounded-full bg-brand-500/5 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="relative font-mono text-[12rem] leading-none font-bold bg-gradient-to-b from-brand-400 via-emerald-400 to-brand-600 bg-clip-text text-transparent drop-shadow-2xl">
            #{nowServing || '—'}
          </div>
        </div>
      </div>

      {/* Recently Called Ticker */}
      {recentCalled.length > 0 && (
        <div className="relative w-full max-w-2xl">
          <p className="text-text-muted text-sm uppercase tracking-wider text-center mb-4">Recently Called</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {recentCalled.map((entry, idx) => (
              <div
                key={entry.id}
                className="bg-surface-2 border border-surface-border rounded-2xl px-6 py-3 animate-fade-in"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <span className="font-mono font-bold text-2xl text-brand-400">#{entry.token_number}</span>
                <p className="text-text-muted text-xs mt-1">{entry.customer_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-6 left-0 right-0 text-center">
        <p className="text-text-muted/50 text-xs">
          Powered by QFlow • Please wait for your number to be called
        </p>
      </div>
    </div>
  );
}
