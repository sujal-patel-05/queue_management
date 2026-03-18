import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Users, ChevronRight, Clock, Utensils, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { usePush } from '../hooks/usePush';
import { useQueueStore } from '../store/queueStore';
import { formatWaitTime } from '@qflow/shared';

export default function Join() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { subscribe, supported } = usePush();
  const setEntry = useQueueStore(s => s.setEntry);

  const [restaurant, setRestaurant] = useState(null);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [selectedQueue, setSelectedQueue] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!slug) {
      setError('Welcome to QFlow. Please scan a restaurant QR code to join their virtual queue.');
      setLoading(false);
      return;
    }
    loadRestaurant();
  }, [slug]);

  async function loadRestaurant() {
    try {
      setLoading(true);
      const data = await api.get(`/api/queue/restaurant/${slug}`);
      setRestaurant(data.restaurant);
      setQueues(data.queues || []);
      if (data.queues?.length === 1) setSelectedQueue(data.queues[0].id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedQueue || !name.trim()) return;

    try {
      setSubmitting(true);
      const pushSub = supported ? await subscribe() : null;

      const data = await api.post('/api/queue/join', {
        queue_id: selectedQueue,
        customer_name: name.trim(),
        customer_phone: phone.trim() || undefined,
        party_size: partySize,
        notes: notes.trim() || undefined,
        push_subscription: pushSub || undefined
      });

      if (pushSub) {
        await api.post('/api/push/subscribe', {
          entry_id: data.entry_id,
          subscription: pushSub
        }).catch(() => {});
      }

      setEntry(data);
      navigate(`/queue/${data.entry_id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-text-secondary text-sm">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 p-6">
        <div className="card text-center max-w-sm animate-fade-in">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Restaurant Not Found</h2>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-surface-0 to-surface-0" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative px-6 pt-12 pb-8">
          <div className="flex items-center gap-4 mb-6 animate-fade-in">
            {restaurant?.logo_url ? (
              <img src={restaurant.logo_url} alt="" className="w-14 h-14 rounded-2xl object-cover border border-surface-border" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Utensils className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{restaurant?.name}</h1>
              <p className="text-text-secondary text-sm">Virtual Queue</p>
            </div>
          </div>

          {/* Queue Stats */}
          {queues.length > 0 && (
            <div className="flex gap-3 animate-slide-up">
              {queues.map(q => (
                <div key={q.id} className="flex-1 glass rounded-xl p-3">
                  <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{q.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono text-text-primary">{q.waiting_count}</span>
                    <span className="text-text-secondary text-xs">waiting</span>
                  </div>
                  <p className="text-text-muted text-xs mt-1">
                    ~{formatWaitTime(q.waiting_count * (q.avg_serve_minutes / 4))} wait
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Join Form */}
      <main className="flex-1 px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          
          {/* Queue Selection */}
          {queues.length > 1 && (
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-2">Select Queue</label>
              <div className="grid grid-cols-2 gap-3">
                {queues.map(q => (
                  <button
                    type="button"
                    key={q.id}
                    onClick={() => setSelectedQueue(q.id)}
                    disabled={q.is_paused}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      selectedQueue === q.id
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-surface-border bg-surface-2 hover:border-surface-4'
                    } ${q.is_paused ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <p className="font-semibold text-text-primary">{q.name}</p>
                    {q.description && <p className="text-text-muted text-xs mt-1">{q.description}</p>}
                    {q.is_paused && <p className="text-amber-400 text-xs mt-1">Currently paused</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Your Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={100}
              required
              className="w-full"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Phone Number <span className="text-text-muted">(optional)</span></label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full"
            />
          </div>

          {/* Party Size */}
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Party Size</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPartySize(Math.max(1, partySize - 1))}
                className="w-12 h-12 rounded-xl bg-surface-3 border border-surface-border text-text-primary hover:bg-surface-4 transition-colors flex items-center justify-center text-lg font-bold"
              >
                −
              </button>
              <div className="flex items-center gap-2 px-4">
                <Users className="w-5 h-5 text-brand-500" />
                <span className="text-2xl font-bold font-mono text-text-primary w-8 text-center">{partySize}</span>
              </div>
              <button
                type="button"
                onClick={() => setPartySize(Math.min(20, partySize + 1))}
                className="w-12 h-12 rounded-xl bg-surface-3 border border-surface-border text-text-primary hover:bg-surface-4 transition-colors flex items-center justify-center text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Special Requests <span className="text-text-muted">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Dietary requirements, wheelchair access, etc."
              rows={2}
              maxLength={500}
              className="w-full resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !selectedQueue || !name.trim()}
            className="btn-primary w-full text-lg py-4"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining Queue...
              </>
            ) : (
              <>
                Join Queue
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          {supported && (
            <p className="text-center text-text-muted text-xs">
              📱 You&apos;ll receive a push notification when your table is ready
            </p>
          )}
        </form>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-text-muted text-xs">
          Powered by <span className="gradient-text font-semibold">QFlow</span>
        </p>
      </footer>
    </div>
  );
}
