import { supabase } from '../db/supabase.js';
import { redis } from '../db/redis.js';
import { calculateWaitTime, updateRollingAverage } from '../services/queueEngine.js';
import { broadcastQueueUpdate, broadcastEntryUpdate } from '../services/socketService.js';
import { requireAuth } from '../plugins/auth.js';
import { logEvent } from '../services/analyticsService.js';
import { sendPushNotification } from '../services/pushService.js';

export default async function queueRoutes(app) {

  // PUBLIC: Get restaurant + queue info by slug
  app.get('/restaurant/:slug', async (request, reply) => {
    const { slug } = request.params;
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, logo_url, slug, settings')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    if (!restaurant) return reply.status(404).send({ error: 'Restaurant not found' });

    const { data: queues } = await supabase
      .from('queues')
      .select('id, name, type, description, is_paused, now_serving, avg_serve_minutes')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true);

    for (const q of (queues || [])) {
      const count = await redis.get(`queue:${q.id}:waiting_count`) || 0;
      q.waiting_count = parseInt(count);
    }

    return { restaurant, queues };
  });

  // PUBLIC: Join a queue
  app.post('/join', {
    schema: {
      body: {
        type: 'object',
        required: ['queue_id', 'customer_name'],
        properties: {
          queue_id: { type: 'string' },
          customer_name: { type: 'string', maxLength: 100 },
          customer_phone: { type: 'string' },
          party_size: { type: 'integer', minimum: 1, maximum: 20 },
          notes: { type: 'string', maxLength: 500 },
          push_subscription: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { queue_id, customer_name, customer_phone, party_size = 1, notes, push_subscription } = request.body;

    const { data: queue } = await supabase
      .from('queues')
      .select('*, restaurants(id, name, slug)')
      .eq('id', queue_id)
      .single();

    if (!queue) return reply.status(404).send({ error: 'Queue not found' });
    if (queue.is_paused) return reply.status(400).send({ error: 'This queue is currently paused' });

    let currentLastToken = await redis.get(`queue:${queue_id}:last_token`);
    if (!currentLastToken || parseInt(currentLastToken) === 0) {
      // Sync from DB if Redis was cleared (e.g. server restart with MockRedis)
      const { data: maxEntry } = await supabase
        .from('queue_entries')
        .select('token_number')
        .eq('queue_id', queue_id)
        .order('token_number', { ascending: false })
        .limit(1)
        .single();
      
      const { count: currentWaiters } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('queue_id', queue_id)
        .eq('status', 'waiting');

      if (maxEntry) await redis.set(`queue:${queue_id}:last_token`, maxEntry.token_number);
      if (currentWaiters !== null) await redis.set(`queue:${queue_id}:waiting_count`, currentWaiters);
    }

    const tokenNumber = await redis.incr(`queue:${queue_id}:last_token`);
    const waitingCount = await redis.incr(`queue:${queue_id}:waiting_count`);
    const position = parseInt(waitingCount);
    const waitEstimate = calculateWaitTime(position, queue.avg_serve_minutes);

    const { data: entry, error } = await supabase
      .from('queue_entries')
      .insert({
        queue_id,
        restaurant_id: queue.restaurant_id,
        token_number: tokenNumber,
        customer_name,
        customer_phone,
        party_size,
        notes,
        push_subscription,
        estimated_wait_minutes: waitEstimate.minutes,
        status: 'waiting'
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: 'Failed to join queue' });

    if (push_subscription) {
      await supabase.from('push_subscriptions').insert({
        entry_id: entry.id,
        restaurant_id: queue.restaurant_id,
        subscription: push_subscription
      });
    }

    broadcastQueueUpdate(queue.restaurant_id, queue_id);
    await logEvent(queue.restaurant_id, 'queue_join', { queue_id, party_size, token: tokenNumber });

    return {
      entry_id: entry.id,
      token_number: tokenNumber,
      position,
      estimated_wait_minutes: waitEstimate.minutes,
      queue_name: queue.name,
      restaurant_name: queue.restaurants.name,
      restaurant_slug: queue.restaurants.slug
    };
  });

  // PUBLIC: Get live status for a queue entry
  app.get('/status/:entry_id', async (request, reply) => {
    const { entry_id } = request.params;
    const { data: entry } = await supabase
      .from('queue_entries')
      .select('*, queues(now_serving, avg_serve_minutes, is_paused, name)')
      .eq('id', entry_id)
      .single();

    if (!entry) return reply.status(404).send({ error: 'Entry not found' });

    const { count: ahead } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('queue_id', entry.queue_id)
      .eq('status', 'waiting')
      .lt('token_number', entry.token_number);

    const position = (ahead || 0);
    const waitEstimate = calculateWaitTime(position, entry.queues.avg_serve_minutes);

    return {
      entry_id: entry.id,
      token_number: entry.token_number,
      customer_name: entry.customer_name,
      status: entry.status,
      position,
      now_serving: entry.queues.now_serving,
      estimated_wait_minutes: waitEstimate.minutes,
      queue_name: entry.queues.name,
      queue_id: entry.queue_id,
      restaurant_id: entry.restaurant_id,
      joined_at: entry.joined_at
    };
  });

  // STAFF: Call next token
  app.post('/call-next', { preHandler: requireAuth }, async (request, reply) => {
    const { queue_id } = request.body;
    const restaurantId = request.user.restaurant_id;

    const { data: next } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('queue_id', queue_id)
      .eq('status', 'waiting')
      .order('token_number', { ascending: true })
      .limit(1)
      .single();

    if (!next) return reply.status(404).send({ error: 'No one waiting in queue' });

    await supabase
      .from('queue_entries')
      .update({ status: 'called', called_at: new Date().toISOString() })
      .eq('id', next.id);

    await supabase
      .from('queues')
      .update({ now_serving: next.token_number })
      .eq('id', queue_id);

    await redis.decr(`queue:${queue_id}:waiting_count`);

    if (next.push_subscription) {
      await sendPushNotification(next.push_subscription, {
        title: 'Your table is ready! 🎉',
        body: `Token #${next.token_number} — please proceed to the counter.`,
        url: `/status/${next.id}`
      });
    }

    broadcastQueueUpdate(restaurantId, queue_id);
    broadcastEntryUpdate(next.id, { status: 'called', token_number: next.token_number });
    await logEvent(restaurantId, 'token_called', { token: next.token_number });

    return { called_entry: next };
  });

  // STAFF: Call specific token
  app.post('/call/:entry_id', { preHandler: requireAuth }, async (request, reply) => {
    const { entry_id } = request.params;
    const restaurantId = request.user.restaurant_id;

    const { data: entry } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('id', entry_id)
      .single();

    if (!entry) return reply.status(404).send({ error: 'Entry not found' });

    await supabase
      .from('queue_entries')
      .update({ status: 'called', called_at: new Date().toISOString() })
      .eq('id', entry_id);

    await supabase
      .from('queues')
      .update({ now_serving: entry.token_number })
      .eq('id', entry.queue_id);

    if (entry.push_subscription) {
      await sendPushNotification(entry.push_subscription, {
        title: 'Your table is ready! 🎉',
        body: `Token #${entry.token_number} — please proceed to the counter now.`,
        url: `/status/${entry_id}`
      });
    }

    broadcastQueueUpdate(restaurantId, entry.queue_id);
    broadcastEntryUpdate(entry_id, { status: 'called', token_number: entry.token_number });
    return { success: true };
  });

  // STAFF: Update entry status (seated, no-show, cancelled, completed)
  app.patch('/entry/:entry_id/status', { preHandler: requireAuth }, async (request, reply) => {
    const { entry_id } = request.params;
    const { status, table_id } = request.body;
    const restaurantId = request.user.restaurant_id;

    const updates = {
      status,
      ...(status === 'seated' && { seated_at: new Date().toISOString() }),
      ...(status === 'completed' && { completed_at: new Date().toISOString() })
    };

    await supabase.from('queue_entries').update(updates).eq('id', entry_id);

    if (status === 'seated' && table_id) {
      await supabase.from('tables')
        .update({ status: 'occupied', current_entry_id: entry_id })
        .eq('id', table_id);
    }

    if (status === 'completed') {
      const { data: entry } = await supabase.from('queue_entries').select('*').eq('id', entry_id).single();
      if (entry) await updateRollingAverage(entry.queue_id, entry.joined_at, entry.seated_at);
    }

    broadcastQueueUpdate(restaurantId);
    broadcastEntryUpdate(entry_id, { status });
    await logEvent(restaurantId, `entry_${status}`, { entry_id });

    return { success: true };
  });

  // STAFF: Get full queue for a restaurant
  app.get('/live/:restaurant_id', { preHandler: requireAuth }, async (request, reply) => {
    const { restaurant_id } = request.params;

    const { data: entries } = await supabase
      .from('queue_entries')
      .select('*, orders(id, status, total_paise)')
      .eq('restaurant_id', restaurant_id)
      .in('status', ['waiting', 'called'])
      .order('token_number', { ascending: true });

    const { data: queues } = await supabase
      .from('queues')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true);

    return { entries: entries || [], queues: queues || [] };
  });

  // STAFF: Toggle queue pause
  app.patch('/queue/:queue_id/pause', { preHandler: requireAuth }, async (request, reply) => {
    const { queue_id } = request.params;
    const { is_paused } = request.body;
    await supabase.from('queues').update({ is_paused }).eq('id', queue_id);
    broadcastQueueUpdate(request.user.restaurant_id, queue_id);
    return { success: true };
  });
}
