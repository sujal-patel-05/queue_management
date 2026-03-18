import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, UtensilsCrossed, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { formatPaise } from '@qflow/shared';

export default function OrderConfirmation() {
  const { entryId, orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  async function loadOrder() {
    try {
      // For public access, we'll just show a confirmation with the order ID
      // In production, you'd have a public order status endpoint
      setOrder({ id: orderId });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-6">
      <div className="text-center animate-fade-in max-w-sm w-full">
        {/* Success Icon */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-brand-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-brand-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2">Order Placed!</h1>
        <p className="text-text-secondary mb-8">Your order is being prepared. We'll notify you when it's ready.</p>

        {/* Status Card */}
        <div className="card space-y-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-text-primary font-medium">Being Prepared</p>
              <p className="text-text-muted text-xs">Your food is being prepared in the kitchen</p>
            </div>
          </div>

          <div className="h-px bg-surface-border" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center">
              <Clock className="w-5 h-5 text-text-muted" />
            </div>
            <div className="text-left">
              <p className="text-text-primary font-medium">Estimated Time</p>
              <p className="text-text-muted text-xs">~15-20 minutes</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link to={`/queue/${entryId}`} className="btn-primary w-full">
            <ArrowLeft className="w-5 h-5" />
            Back to Queue Status
          </Link>
        </div>

        <p className="text-text-muted text-xs mt-6">
          Powered by <span className="gradient-text font-semibold">QFlow</span>
        </p>
      </div>
    </div>
  );
}
