import crypto from 'crypto';
import { supabase } from '../db/supabase.js';

export default async function webhookRoutes(app) {
  app.post('/razorpay', {
    config: { rawBody: true }
  }, async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'];
    const body = request.rawBody || JSON.stringify(request.body);

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(typeof body === 'string' ? body : JSON.stringify(body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    const event = typeof body === 'string' ? JSON.parse(body) : body;

    if (event.event === 'payment.captured') {
      const { order_id, id: payment_id } = event.payload.payment.entity;
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          razorpay_payment_id: payment_id,
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', order_id);
    }

    return { received: true };
  });
}
