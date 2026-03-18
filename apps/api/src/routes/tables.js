import { supabase } from '../db/supabase.js';
import { requireAuth } from '../plugins/auth.js';
import { broadcastQueueUpdate } from '../services/socketService.js';

export default async function tableRoutes(app) {

  // Get all tables for a restaurant
  app.get('/:restaurant_id', { preHandler: requireAuth }, async (request, reply) => {
    const { restaurant_id } = request.params;
    const { data: tables } = await supabase
      .from('tables')
      .select('*, queue_entries(token_number, customer_name, party_size, seated_at)')
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .order('label', { ascending: true });

    return { tables: tables || [] };
  });

  // Create a table
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const restaurantId = request.user.restaurant_id;
    const { label, capacity, section, position_x, position_y } = request.body;

    const { data: table, error } = await supabase
      .from('tables')
      .insert({ restaurant_id: restaurantId, label, capacity, section, position_x, position_y })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: 'Failed to create table' });
    return { table };
  });

  // Update a table
  app.patch('/:table_id', { preHandler: requireAuth }, async (request, reply) => {
    const { table_id } = request.params;
    const updates = request.body;
    delete updates.id;
    delete updates.restaurant_id;

    const { data: table, error } = await supabase
      .from('tables')
      .update(updates)
      .eq('id', table_id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: 'Failed to update table' });
    broadcastQueueUpdate(request.user.restaurant_id);
    return { table };
  });

  // Release a table (mark as available/cleaning)
  app.post('/:table_id/release', { preHandler: requireAuth }, async (request, reply) => {
    const { table_id } = request.params;
    const { mark_cleaning } = request.body || {};

    await supabase.from('tables')
      .update({
        status: mark_cleaning ? 'cleaning' : 'available',
        current_entry_id: null
      })
      .eq('id', table_id);

    broadcastQueueUpdate(request.user.restaurant_id);
    return { success: true };
  });

  // Delete a table
  app.delete('/:table_id', { preHandler: requireAuth }, async (request, reply) => {
    const { table_id } = request.params;
    await supabase.from('tables')
      .update({ is_active: false })
      .eq('id', table_id);
    return { success: true };
  });
}
