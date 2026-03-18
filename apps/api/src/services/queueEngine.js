import { supabase } from '../db/supabase.js';

export function calculateWaitTime(position, avgServeMinutes = 15) {
  const parallelTables = 4;
  const slotsAhead = Math.ceil(position / parallelTables);
  const minutes = Math.round(slotsAhead * avgServeMinutes);
  return {
    minutes: Math.max(minutes, 1),
    confidence: position === 0 ? 'immediate' : 'estimated'
  };
}

export async function updateRollingAverage(queueId, joinedAt, seatedAt) {
  if (!joinedAt || !seatedAt) return;

  const durationMinutes = Math.round(
    (new Date(seatedAt) - new Date(joinedAt)) / 60000
  );

  const { data: recent } = await supabase
    .from('queue_entries')
    .select('joined_at, seated_at')
    .eq('queue_id', queueId)
    .eq('status', 'completed')
    .not('seated_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(20);

  const durations = (recent || []).map(e =>
    Math.round((new Date(e.seated_at) - new Date(e.joined_at)) / 60000)
  );
  durations.push(durationMinutes);

  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  await supabase
    .from('queues')
    .update({ avg_serve_minutes: Math.max(avg, 5) })
    .eq('id', queueId);
}
