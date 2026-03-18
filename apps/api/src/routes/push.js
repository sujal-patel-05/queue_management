import { supabase } from '../db/supabase.js';
import { requireAuth } from '../plugins/auth.js';

export default async function pushRoutes(app) {

  // Store push subscription for a queue entry
  app.post('/subscribe', async (request, reply) => {
    const { entry_id, subscription } = request.body;

    if (!entry_id || !subscription) {
      return reply.status(400).send({ error: 'entry_id and subscription are required' });
    }

    const { data: entry } = await supabase
      .from('queue_entries')
      .select('restaurant_id')
      .eq('id', entry_id)
      .single();

    if (!entry) return reply.status(404).send({ error: 'Entry not found' });

    // Update on queue entry
    await supabase.from('queue_entries')
      .update({ push_subscription: subscription })
      .eq('id', entry_id);

    // Store in push_subscriptions table
    await supabase.from('push_subscriptions').upsert({
      entry_id,
      restaurant_id: entry.restaurant_id,
      subscription,
      user_agent: request.headers['user-agent']
    }, { onConflict: 'entry_id' });

    return { success: true };
  });

  // STAFF: Get VAPID public key
  app.get('/vapid-key', async () => {
    return { key: process.env.VAPID_PUBLIC_KEY };
  });
}
