import { supabase } from '../db/supabase.js';
import { requireAuth } from '../plugins/auth.js';

export default async function menuRoutes(app) {

  // PUBLIC: Get menu for a restaurant
  app.get('/public/:restaurant_id', async (request, reply) => {
    const { restaurant_id } = request.params;

    const { data: categories } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    return { categories: categories || [], items: items || [] };
  });

  // STAFF: Get all menu items (including unavailable)
  app.get('/:restaurant_id', { preHandler: requireAuth }, async (request, reply) => {
    const { restaurant_id } = request.params;

    const { data: categories } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('sort_order', { ascending: true });

    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('sort_order', { ascending: true });

    return { categories: categories || [], items: items || [] };
  });

  // STAFF: Create category
  app.post('/category', { preHandler: requireAuth }, async (request, reply) => {
    const restaurantId = request.user.restaurant_id;
    const { name, sort_order } = request.body;

    const { data: category, error } = await supabase
      .from('menu_categories')
      .insert({ restaurant_id: restaurantId, name, sort_order: sort_order || 0 })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: 'Failed to create category' });
    return { category };
  });

  // STAFF: Update category
  app.patch('/category/:category_id', { preHandler: requireAuth }, async (request, reply) => {
    const { category_id } = request.params;
    const { name, sort_order, is_active } = request.body;

    const { data: category, error } = await supabase
      .from('menu_categories')
      .update({ name, sort_order, is_active })
      .eq('id', category_id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: 'Failed to update category' });
    return { category };
  });

  // STAFF: Create menu item
  app.post('/item', { preHandler: requireAuth }, async (request, reply) => {
    const restaurantId = request.user.restaurant_id;
    const { name, description, price_paise, category_id, image_url, is_veg, is_featured, preparation_minutes, sort_order } = request.body;

    const { data: item, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        name,
        description,
        price_paise,
        category_id,
        image_url,
        is_veg: is_veg !== false,
        is_featured: is_featured || false,
        preparation_minutes: preparation_minutes || 10,
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: 'Failed to create item' });
    return { item };
  });

  // STAFF: Update menu item
  app.patch('/item/:item_id', { preHandler: requireAuth }, async (request, reply) => {
    const { item_id } = request.params;
    const updates = request.body;
    delete updates.id;
    delete updates.restaurant_id;

    const { data: item, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', item_id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: 'Failed to update item' });
    return { item };
  });

  // STAFF: Toggle item availability
  app.patch('/item/:item_id/toggle', { preHandler: requireAuth }, async (request, reply) => {
    const { item_id } = request.params;
    const { data: current } = await supabase.from('menu_items').select('is_available').eq('id', item_id).single();
    if (!current) return reply.status(404).send({ error: 'Item not found' });

    const { data: item } = await supabase
      .from('menu_items')
      .update({ is_available: !current.is_available })
      .eq('id', item_id)
      .select()
      .single();

    return { item };
  });

  // STAFF: Delete menu item (soft-delete)
  app.delete('/item/:item_id', { preHandler: requireAuth }, async (request, reply) => {
    const { item_id } = request.params;
    await supabase.from('menu_items').update({ is_available: false }).eq('id', item_id);
    return { success: true };
  });
}
