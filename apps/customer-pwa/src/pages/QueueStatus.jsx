import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Clock, UtensilsCrossed, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import { useQueueStore } from '../store/queueStore';
import { formatWaitTime, getElapsedMinutes } from '@qflow/shared';

export default function QueueStatus() {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const { trackEntry, onEntryUpdate } = useSocket();
  const { setEntry, updateStatus } = useQueueStore();

  const [entry, setLocalEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get(`/api/queue/status/${entryId}`);
      setLocalEntry(data);
      setEntry(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entryId, setEntry]);

  useEffect(() => {
    fetchStatus();
    trackEntry(entryId);

    const cleanup = onEntryUpdate((data) => {
      setLocalEntry(prev => ({ ...prev, ...data }));
      updateStatus(data);
    });

    // Poll every 30s as fallback
    const interval = setInterval(fetchStatus, 30000);
    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [entryId, fetchStatus, trackEntry, onEntryUpdate, updateStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-text-secondary text-sm">Loading your position...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 p-6">
        <div className="card text-center max-w-sm animate-fade-in">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Entry Not Found</h2>
          <p className="text-text-secondary text-sm mb-4">{error}</p>
          <Link to="/" className="btn-primary">Go Back</Link>
        </div>
      </div>
    );
  }

  const isCalled = entry?.status === 'called';
  const isSeated = entry?.status === 'seated';
  const isCompleted = entry?.status === 'completed' || entry?.status === 'cancelled';
  const elapsed = entry?.joined_at ? getElapsedMinutes(entry.joined_at) : 0;

  // Called state — pulsing green "Go to counter!"
  if (isCalled) {
    return (
      <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-6">
        <div className="text-center animate-fade-in">
          {/* Pulsing ring */}
          <div className="relative inline-flex items-center justify-center mb-8">
            <div className="absolute inset-0 w-48 h-48 rounded-full bg-brand-500/10 animate-pulse-ring" />
            <div className="absolute inset-4 w-40 h-40 rounded-full bg-brand-500/5 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
            <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-2xl shadow-brand-500/30 animate-glow">
              <span className="font-mono text-5xl font-bold text-white">#{entry.token_number}</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-brand-400 mb-2">Your Table is Ready!</h1>
          <p className="text-text-secondary text-lg mb-8">Please proceed to the counter now</p>

          <div className="glass rounded-2xl p-5 max-w-xs mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-muted text-sm">Queue</span>
              <span className="text-text-primary font-medium">{entry.queue_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-sm">Wait Time</span>
              <span className="text-text-primary font-medium">{elapsed} min</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Seated/Completed state
  if (isSeated || isCompleted) {
    return (
      <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-6">
        <div className="text-center animate-fade-in">
          <CheckCircle2 className="w-20 h-20 text-brand-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            {isSeated ? 'Enjoy your meal!' : 'Thanks for visiting!'}
          </h1>
          <p className="text-text-secondary text-lg mb-8">
            {isSeated ? "You've been seated. We hope you enjoy!" : 'We hope to see you again soon.'}
          </p>
          <p className="text-text-muted text-sm">
            Powered by <span className="gradient-text font-semibold">QFlow</span>
          </p>
        </div>
      </div>
    );
  }

  // Waiting state — main view
  const progressPercent = entry?.position > 0 
    ? Math.max(5, Math.min(95, ((entry.now_serving || 0) / ((entry.now_serving || 0) + entry.position)) * 100))
    : 95;

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Header */}
      <header className="px-6 pt-10 pb-2">
        <div className="flex items-center justify-between mb-2 animate-fade-in">
          <div>
            <p className="text-text-muted text-xs uppercase tracking-widest mb-1">{entry?.queue_name}</p>
            <h1 className="text-lg font-semibold text-text-primary">{entry?.customer_name || 'Your Queue'}</h1>
          </div>
          <div className="badge-success">
            <span className="relative flex h-2 w-2 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </div>
        </div>
      </header>

      {/* Token Display */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-6">
        <div className="text-center mb-10 animate-count-up">
          <p className="text-text-muted text-sm mb-3 uppercase tracking-widest">Your Token</p>
          <div className="relative">
            <div className="token-display animate-glow rounded-3xl inline-block px-8 py-4">
              #{entry?.token_number}
            </div>
          </div>
        </div>

        {/* Position Info */}
        <div className="w-full max-w-sm space-y-6 animate-slide-up">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">Queue Progress</span>
              <span className="text-brand-400 font-mono font-semibold">{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-3 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <p className="text-text-muted text-xs mb-1">Position</p>
              <p className="text-2xl font-bold font-mono text-text-primary">
                {entry?.position === 0 ? 'Next!' : `#${entry?.position}`}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-text-muted text-xs mb-1">Serving</p>
              <p className="text-2xl font-bold font-mono text-brand-400">
                #{entry?.now_serving || '—'}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-text-muted text-xs mb-1">Est. Wait</p>
              <p className="text-lg font-bold text-text-primary flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-text-muted" />
                {formatWaitTime(entry?.estimated_wait_minutes || 0)}
              </p>
            </div>
          </div>

          {/* Elapsed Time */}
          <div className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-muted" />
              <span className="text-text-secondary text-sm">Waiting for</span>
            </div>
            <span className="font-mono font-semibold text-text-primary">{elapsed} min</span>
          </div>

          {/* Browse Menu CTA */}
          <Link
            to={`/queue/${entryId}/menu`}
            className="btn-secondary w-full text-center"
          >
            <UtensilsCrossed className="w-5 h-5" />
            Browse Menu & Pre-Order
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-text-muted text-xs flex items-center justify-center gap-1">
          <Bell className="w-3 h-3" />
          We&apos;ll notify you when your table is ready
        </p>
      </footer>
    </div>
  );
}
