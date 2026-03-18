import { supabase } from '../db/supabase.js';

export async function logEvent(restaurantId, eventType, payload = {}) {
  await supabase.from('analytics_events').insert({
    restaurant_id: restaurantId,
    event_type: eventType,
    payload
  });
}

export async function getDailyStats(restaurantId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: entries }, { data: orders }, { data: noShows }] = await Promise.all([
    supabase.from('queue_entries')
      .select('joined_at, seated_at, status')
      .eq('restaurant_id', restaurantId)
      .gte('joined_at', since),

    supabase.from('orders')
      .select('total_paise, placed_at, status')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'paid')
      .gte('placed_at', since),

    supabase.from('queue_entries')
      .select('joined_at')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'no_show')
      .gte('joined_at', since)
  ]);

  const totalRevenue = (orders || []).reduce((sum, o) => sum + o.total_paise, 0);
  const seatedEntries = (entries || []).filter(e => e.seated_at);
  const avgWaitMinutes = seatedEntries.length > 0
    ? seatedEntries.reduce((sum, e) => {
        return sum + Math.round((new Date(e.seated_at) - new Date(e.joined_at)) / 60000);
      }, 0) / seatedEntries.length
    : 0;

  return {
    total_customers: (entries || []).length,
    total_seated: (entries || []).filter(e => e.status === 'seated' || e.status === 'completed').length,
    total_no_shows: (noShows || []).length,
    total_revenue_paise: totalRevenue,
    total_revenue_inr: (totalRevenue / 100).toFixed(2),
    avg_wait_minutes: Math.round(avgWaitMinutes),
    no_show_rate: (entries || []).length > 0 ? Math.round(((noShows || []).length / (entries || []).length) * 100) : 0
  };
}

export async function getHourlyDistribution(restaurantId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: entries } = await supabase
    .from('queue_entries')
    .select('joined_at')
    .eq('restaurant_id', restaurantId)
    .gte('joined_at', since);

  const distribution = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  (entries || []).forEach(e => {
    const hour = new Date(e.joined_at).getHours();
    distribution[hour].count++;
  });

  return distribution;
}
