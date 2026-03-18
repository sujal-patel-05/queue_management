import { supabase } from '../db/supabase.js';
import { requireAuth } from '../plugins/auth.js';
import { broadcastOrderUpdate } from '../services/socketService.js';
import { sendPushNotification } from '../services/pushService.js';
import Razorpay from 'razorpay';

const razorpay = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

export default async function orderRoutes(app) {

  // PUBLIC: Place order
  app.post('/place', {
    schema: {
      body: {
        type: 'object',
        required: ['entry_id', 'items'],
        properties: {
          entry_id: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['menu_item_id', 'quantity'],
              properties: {
                menu_item_id: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                customization: { type: 'string' }
              }
            }
          },
          special_instructions: { type: 'string' },
          payment_method: { type: 'string', enum: ['online', 'cash', 'upi'] }
        }
      }
    }
  }, async (request, reply) => {
    const { entry_id, items, special_instructions, payment_method } = request.body;

    const { data: entry } = await supabase
      .from('queue_entries')
      .select('*, restaurants(id)')
      .eq('id', entry_id)
      .single();

    if (!entry) return reply.status(404).send({ error: 'Queue entry not found' });

    const itemIds = items.map(i => i.menu_item_id);
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, name, price_paise, is_available')
      .in('id', itemIds);

    const itemMap = Object.fromEntries((menuItems || []).map(m => [m.id, m]));

    for (const item of items) {
      const mi = itemMap[item.menu_item_id];
      if (!mi || !mi.is_available) {
        return reply.status(400).send({ error: `Item ${item.menu_item_id} is not available` });
      }
    }

    const total_paise = items.reduce((sum, item) => {
      return sum + (itemMap[item.menu_item_id].price_paise * item.quantity);
    }, 0);

    const { data: order } = await supabase
      .from('orders')
      .insert({
        entry_id,
        restaurant_id: entry.restaurant_id,
        total_paise,
        special_instructions,
        payment_method: payment_method || 'cash',
        status: 'pending'
      })
      .select()
      .single();

    await supabase.from('order_items').insert(
      items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price_paise: itemMap[item.menu_item_id].price_paise,
        item_name: itemMap[item.menu_item_id].name,
        customization: item.customization
      }))
    );

    let razorpayOrder = null;
    if (payment_method === 'online' || payment_method === 'upi') {
      razorpayOrder = await razorpay.orders.create({
        amount: total_paise,
        currency: 'INR',
        receipt: order.id.substring(0, 20)
      });
      await supabase.from('orders')
        .update({ razorpay_order_id: razorpayOrder.id })
        .eq('id', order.id);
    }

    broadcastOrderUpdate(entry.restaurant_id, { ...order, items });

    return {
      order_id: order.id,
      total_paise,
      total_inr: (total_paise / 100).toFixed(2),
      razorpay_order: razorpayOrder,
      razorpay_key: process.env.RAZORPAY_KEY_ID
    };
  });

  // STAFF: Update order status
  app.patch('/:order_id/status', { preHandler: requireAuth }, async (request, reply) => {
    const { order_id } = request.params;
    const { status, item_id } = request.body;
    const restaurantId = request.user.restaurant_id;

    if (item_id) {
      await supabase.from('order_items').update({ status }).eq('id', item_id);
    } else {
      const updates = {
        status,
        ...(status === 'confirmed' && { confirmed_at: new Date().toISOString() }),
        ...(status === 'ready' && { ready_at: new Date().toISOString() })
      };
      await supabase.from('orders').update(updates).eq('id', order_id);

      if (status === 'ready') {
        const { data: order } = await supabase
          .from('orders')
          .select('*, queue_entries(push_subscription, token_number, id)')
          .eq('id', order_id)
          .single();

        if (order?.queue_entries?.push_subscription) {
          await sendPushNotification(order.queue_entries.push_subscription, {
            title: 'Your order is ready! 🍽️',
            body: `Token #${order.queue_entries.token_number} — your food is being brought to your table.`,
            url: `/status/${order.queue_entries.id}`
          });
        }
      }
    }

    const { data: updatedOrder } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order_id)
      .single();

    broadcastOrderUpdate(restaurantId, updatedOrder);
    return { success: true, order: updatedOrder };
  });

  // STAFF: Get all active orders for KDS
  app.get('/kitchen/:restaurant_id', { preHandler: requireAuth }, async (request, reply) => {
    const { restaurant_id } = request.params;

    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*), queue_entries(token_number, customer_name)')
      .eq('restaurant_id', restaurant_id)
      .in('status', ['pending', 'confirmed', 'preparing'])
      .order('placed_at', { ascending: true });

    return { orders: orders || [] };
  });

  // STAFF: Get order by ID
  app.get('/:order_id', { preHandler: requireAuth }, async (request, reply) => {
    const { order_id } = request.params;
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*), queue_entries(token_number, customer_name)')
      .eq('id', order_id)
      .single();

    if (!order) return reply.status(404).send({ error: 'Order not found' });
    return { order };
  });
}
