import webpush from 'web-push';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || 'admin@qflow.in'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('VAPID keys not configured, push notifications disabled');
}

export async function sendPushNotification(subscription, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return { success: false, reason: 'push_disabled' };
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200],
        data: { url: payload.url || '/' },
        actions: [
          { action: 'open', title: 'View Status' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      })
    );
    return { success: true };
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { success: false, reason: 'subscription_expired' };
    }
    console.error('Push notification failed:', err.message);
    return { success: false, reason: err.message };
  }
}

export async function sendBulkPushNotifications(subscriptions, payload) {
  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushNotification(sub, payload))
  );
  return results;
}
