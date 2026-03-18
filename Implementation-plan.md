# QFlow — Full Product Build Prompt
### Paste this into Cursor / Windsurf as your project system prompt or first message.

---

## PROJECT OVERVIEW

Build **QFlow** — a production-level, full-stack SaaS restaurant queue and order management platform. This is a multi-app monorepo. The product eliminates physical queues in restaurants by giving customers a live virtual token via a Progressive Web App (PWA), with real-time updates via Socket.io and background push notifications via the Web Push API (no WhatsApp API, no SMS — zero notification cost).

The system has three frontends and one backend API, all in a single monorepo managed by `pnpm workspaces`.

---

## MONOREPO STRUCTURE

```
qflow/
├── package.json                  ← root pnpm workspace config
├── pnpm-workspace.yaml
├── .env.example                  ← all env vars documented
├── apps/
│   ├── customer-pwa/             ← React + Vite PWA (customer phone)
│   ├── admin-dashboard/          ← React + Vite (restaurant staff + owner)
│   └── api/                      ← Node.js + Fastify (backend)
└── packages/
    └── shared/                   ← shared types, constants, utils
```

---

## TECH STACK (ALL FREE TIER)

### Backend — `apps/api`
- **Runtime:** Node.js 20+
- **Framework:** Fastify v4 (faster than Express, built-in schema validation)
- **WebSockets:** Socket.io v4 (real-time queue state broadcast)
- **Push Notifications:** `web-push` npm package with VAPID keys (completely free, no API needed)
- **Database ORM:** Supabase JS client v2
- **Cache / Queue State:** `@upstash/redis` (Upstash Redis REST client — 10K free requests/day)
- **Payments:** `razorpay` npm package
- **Email:** `resend` npm package
- **Image uploads:** `cloudinary` npm package
- **Auth:** JWT via `@fastify/jwt`
- **Validation:** `zod` for all request/response schemas
- **Environment:** `dotenv`

### Frontend — both React apps
- **Framework:** React 18 + Vite 5
- **Routing:** React Router v6
- **State management:** Zustand (lightweight, no boilerplate)
- **Data fetching:** TanStack Query v5 (React Query)
- **Styling:** Tailwind CSS v3 with a custom design system
- **Components:** Radix UI primitives (accessible, unstyled)
- **Charts (admin):** Recharts
- **Real-time:** Socket.io-client v4
- **HTTP:** Axios with interceptors
- **Forms:** React Hook Form + Zod resolver
- **Dates:** date-fns
- **QR codes (admin):** `qrcode.react`
- **Icons:** Lucide React

### Infrastructure (all free)
- **Backend hosting:** Railway (free $5/month credit, sufficient for MVP)
- **Frontend hosting:** Vercel (both PWA and dashboard — unlimited free)
- **Database:** Supabase (free tier: 500MB PostgreSQL + Auth + Realtime)
- **Cache:** Upstash Redis (free tier)
- **Images:** Cloudinary (free: 25GB storage)
- **Email:** Resend (free: 3,000 emails/month)
- **Payments:** Razorpay (no monthly fee — 2% per transaction only)

---

## DATABASE SCHEMA

Run this as Supabase SQL migrations. Create a `/apps/api/supabase/migrations/` folder and put each file there.

### Migration 001 — core tables

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Restaurants (each paying customer = one restaurant record)
create table restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,         -- used in URLs: qflow.app/r/biryani-bros
  address text,
  phone text,
  timezone text default 'Asia/Kolkata',
  logo_url text,
  settings jsonb default '{
    "max_party_size": 10,
    "queue_pause_enabled": false,
    "auto_call_enabled": false,
    "currency": "INR"
  }'::jsonb,
  subscription_tier text default 'starter', -- starter | growth | pro
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Queues (a restaurant can have multiple queues: dine-in, takeaway, etc.)
create table queues (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,                 -- "Dine-in", "Takeaway", "VIP"
  type text default 'dine_in',        -- dine_in | takeaway | pre_order
  description text,
  is_active boolean default true,
  is_paused boolean default false,
  current_token int default 0,        -- last issued token number
  now_serving int default 0,          -- currently being served
  avg_serve_minutes int default 15,   -- rolling average, updated by algorithm
  max_capacity int default 50,        -- max people in queue at once
  created_at timestamptz default now()
);

-- Queue entries (one per customer visit)
create table queue_entries (
  id uuid primary key default uuid_generate_v4(),
  queue_id uuid references queues(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade,
  token_number int not null,
  customer_name text not null,
  customer_phone text,
  party_size int default 1,
  status text default 'waiting',      -- waiting | called | seated | completed | no_show | cancelled
  push_subscription jsonb,            -- Web Push subscription object (stored server-side)
  notes text,                         -- special requests from customer
  estimated_wait_minutes int,         -- calculated at join time
  joined_at timestamptz default now(),
  called_at timestamptz,
  seated_at timestamptz,
  completed_at timestamptz,
  unique(queue_id, token_number)
);

-- Tables (physical restaurant tables)
create table tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  label text not null,                -- "T1", "T2", "Window 3", "Outdoor 1"
  capacity int default 4,
  section text default 'main',        -- for multi-section restaurants
  position_x int default 0,          -- for floor map drag-and-drop (percentage 0-100)
  position_y int default 0,
  status text default 'available',    -- available | occupied | reserved | cleaning | blocked
  current_entry_id uuid references queue_entries(id) on delete set null,
  notes text,
  is_active boolean default true
);

-- Menu categories
create table menu_categories (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  is_active boolean default true
);

-- Menu items
create table menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price_paise int not null,           -- store in paise (1 INR = 100 paise) to avoid float issues
  image_url text,
  is_veg boolean default true,
  is_available boolean default true,
  is_featured boolean default false,
  preparation_minutes int default 10,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Orders
create table orders (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid references queue_entries(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade,
  status text default 'pending',      -- pending | confirmed | preparing | ready | delivered | cancelled
  total_paise int default 0,
  payment_status text default 'unpaid', -- unpaid | paid | refunded
  payment_method text,                -- upi | card | cash | online
  razorpay_order_id text,
  razorpay_payment_id text,
  special_instructions text,
  placed_at timestamptz default now(),
  confirmed_at timestamptz,
  ready_at timestamptz
);

-- Order items
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete restrict,
  quantity int default 1,
  price_paise int not null,           -- snapshot of price at order time
  item_name text not null,            -- snapshot of name (in case menu changes)
  customization text,
  status text default 'pending'       -- pending | preparing | ready
);

-- Push subscriptions (separate table for bulk sending)
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid references queue_entries(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade,
  subscription jsonb not null,        -- full Web Push subscription JSON
  user_agent text,
  created_at timestamptz default now()
);

-- Staff accounts
create table staff (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text default 'staff',          -- owner | manager | staff | kitchen
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Analytics events (lightweight event log for reports)
create table analytics_events (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  event_type text not null,           -- queue_join | table_seated | order_placed | no_show
  payload jsonb default '{}',
  occurred_at timestamptz default now()
);
```

### Migration 002 — indexes and RLS

```sql
-- Indexes for common queries
create index idx_queue_entries_queue_status on queue_entries(queue_id, status);
create index idx_queue_entries_restaurant on queue_entries(restaurant_id, joined_at);
create index idx_orders_entry on orders(entry_id);
create index idx_orders_restaurant_status on orders(restaurant_id, status);
create index idx_menu_items_restaurant on menu_items(restaurant_id, is_available);
create index idx_tables_restaurant on tables(restaurant_id, status);
create index idx_analytics_restaurant_date on analytics_events(restaurant_id, occurred_at);

-- Row Level Security (enable but bypass with service role key in API)
alter table restaurants enable row level security;
alter table queues enable row level security;
alter table queue_entries enable row level security;
alter table tables enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
```

---

## BACKEND — `apps/api`

### Entry point: `src/server.js`

```javascript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';

import queueRoutes from './routes/queue.js';
import orderRoutes from './routes/orders.js';
import tableRoutes from './routes/tables.js';
import menuRoutes from './routes/menu.js';
import pushRoutes from './routes/push.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhooks.js';
import analyticsRoutes from './routes/analytics.js';
import { initSocketService } from './services/socketService.js';

dotenv.config();

const app = Fastify({ logger: true });
const httpServer = createServer(app.server);

// Socket.io setup
const io = new Server(httpServer, {
  cors: { origin: [process.env.CUSTOMER_PWA_URL, process.env.ADMIN_DASHBOARD_URL], credentials: true }
});
initSocketService(io);
app.decorate('io', io);

// Plugins
await app.register(cors, {
  origin: [process.env.CUSTOMER_PWA_URL, process.env.ADMIN_DASHBOARD_URL],
  credentials: true
});
await app.register(jwt, { secret: process.env.JWT_SECRET });

// Routes
app.register(authRoutes, { prefix: '/api/auth' });
app.register(queueRoutes, { prefix: '/api/queue' });
app.register(orderRoutes, { prefix: '/api/orders' });
app.register(tableRoutes, { prefix: '/api/tables' });
app.register(menuRoutes, { prefix: '/api/menu' });
app.register(pushRoutes, { prefix: '/api/push' });
app.register(webhookRoutes, { prefix: '/api/webhooks' });
app.register(analyticsRoutes, { prefix: '/api/analytics' });

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`QFlow API running on port ${PORT}`);
});
```

### Auth middleware: `src/plugins/auth.js`

```javascript
export async function requireAuth(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function requireOwnerOrManager(request, reply) {
  await requireAuth(request, reply);
  if (!['owner', 'manager'].includes(request.user.role)) {
    reply.status(403).send({ error: 'Insufficient permissions' });
  }
}
```

### Queue routes: `src/routes/queue.js`

```javascript
import { supabase } from '../db/supabase.js';
import { redis } from '../db/redis.js';
import { calculateWaitTime } from '../services/queueEngine.js';
import { broadcastQueueUpdate } from '../services/socketService.js';
import { requireAuth } from '../plugins/auth.js';
import { logEvent } from '../services/analyticsService.js';

export default async function queueRoutes(app) {

  // PUBLIC: Get restaurant + queue info by slug (for customer PWA landing)
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

    // Get live counts from Redis
    for (const q of queues) {
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

    // Get queue and check capacity
    const { data: queue } = await supabase
      .from('queues')
      .select('*, restaurants(id, name, slug)')
      .eq('id', queue_id)
      .single();

    if (!queue) return reply.status(404).send({ error: 'Queue not found' });
    if (queue.is_paused) return reply.status(400).send({ error: 'This queue is currently paused' });

    // Atomically increment token using Redis
    const tokenNumber = await redis.incr(`queue:${queue_id}:last_token`);

    // Get current position
    const waitingCount = await redis.incr(`queue:${queue_id}:waiting_count`);
    const position = parseInt(waitingCount);
    const waitEstimate = calculateWaitTime(position, queue.avg_serve_minutes);

    // Save entry to DB
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

    // Store push subscription separately for easy bulk queries
    if (push_subscription) {
      await supabase.from('push_subscriptions').insert({
        entry_id: entry.id,
        restaurant_id: queue.restaurant_id,
        subscription: push_subscription
      });
    }

    // Broadcast queue update to all staff sockets
    broadcastQueueUpdate(queue.restaurant_id, queue_id);

    // Log analytics event
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

  // PUBLIC: Get live status for a queue entry (polling + socket fallback)
  app.get('/status/:entry_id', async (request, reply) => {
    const { entry_id } = request.params;
    const { data: entry } = await supabase
      .from('queue_entries')
      .select('*, queues(now_serving, avg_serve_minutes, is_paused, name)')
      .eq('id', entry_id)
      .single();

    if (!entry) return reply.status(404).send({ error: 'Entry not found' });

    // Calculate current position in queue
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

    // Send push notification to customer
    if (next.push_subscription) {
      const { sendPushNotification } = await import('../services/pushService.js');
      await sendPushNotification(next.push_subscription, {
        title: 'Your table is ready!',
        body: `Token #${next.token_number} — please proceed to the counter.`,
        url: `/status/${next.id}`
      });
    }

    broadcastQueueUpdate(restaurantId, queue_id);
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
      const { sendPushNotification } = await import('../services/pushService.js');
      await sendPushNotification(entry.push_subscription, {
        title: 'Your table is ready!',
        body: `Token #${entry.token_number} — please proceed to the counter now.`,
        url: `/status/${entry_id}`
      });
    }

    broadcastQueueUpdate(restaurantId, entry.queue_id);
    return { success: true };
  });

  // STAFF: Mark as seated, no-show, or cancelled
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

    // Update rolling average when customer completes
    if (status === 'completed') {
      const { updateRollingAverage } = await import('../services/queueEngine.js');
      const { data: entry } = await supabase.from('queue_entries').select('*').eq('id', entry_id).single();
      if (entry) await updateRollingAverage(entry.queue_id, entry.joined_at, entry.seated_at);
    }

    broadcastQueueUpdate(restaurantId);
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

    return { entries, queues };
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
```

### Queue Engine Service: `src/services/queueEngine.js`

```javascript
import { supabase } from '../db/supabase.js';

// Simple, self-improving wait time calculation
export function calculateWaitTime(position, avgServeMinutes = 15) {
  // Assume average restaurant has ~4 tables turning simultaneously
  const parallelTables = 4;
  const slotsAhead = Math.ceil(position / parallelTables);
  const minutes = Math.round(slotsAhead * avgServeMinutes);
  return {
    minutes: Math.max(minutes, 1),
    confidence: position === 0 ? 'immediate' : 'estimated'
  };
}

// Called when customer completes — updates rolling average for this queue
export async function updateRollingAverage(queueId, joinedAt, seatedAt) {
  if (!joinedAt || !seatedAt) return;

  const durationMinutes = Math.round(
    (new Date(seatedAt) - new Date(joinedAt)) / 60000
  );

  // Get current 20-entry rolling average
  const { data: recent } = await supabase
    .from('queue_entries')
    .select('joined_at, seated_at')
    .eq('queue_id', queueId)
    .eq('status', 'completed')
    .not('seated_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(20);

  const durations = recent.map(e =>
    Math.round((new Date(e.seated_at) - new Date(e.joined_at)) / 60000)
  );
  durations.push(durationMinutes);

  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  await supabase
    .from('queues')
    .update({ avg_serve_minutes: Math.max(avg, 5) }) // minimum 5 min
    .eq('id', queueId);
}
```

### Push Notification Service: `src/services/pushService.js`

```javascript
import webpush from 'web-push';

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_CONTACT_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function sendPushNotification(subscription, payload) {
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
    // Handle expired or invalid subscriptions gracefully
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
```

### Socket Service: `src/services/socketService.js`

```javascript
let io;

export function initSocketService(socketIoInstance) {
  io = socketIoInstance;

  io.on('connection', (socket) => {
    // Staff joins restaurant room
    socket.on('join_restaurant', (restaurantId) => {
      socket.join(`restaurant:${restaurantId}`);
    });

    // Customer tracks their specific entry
    socket.on('track_entry', (entryId) => {
      socket.join(`entry:${entryId}`);
    });

    socket.on('disconnect', () => {});
  });
}

// Broadcast queue state change to all staff in restaurant
export function broadcastQueueUpdate(restaurantId, queueId = null) {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('queue_updated', {
    restaurant_id: restaurantId,
    queue_id: queueId,
    timestamp: new Date().toISOString()
  });
}

// Send update to specific customer tracking their entry
export function broadcastEntryUpdate(entryId, data) {
  if (!io) return;
  io.to(`entry:${entryId}`).emit('entry_updated', data);
}

// Send KDS update to kitchen display
export function broadcastOrderUpdate(restaurantId, order) {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('order_updated', order);
}
```

### Orders routes: `src/routes/orders.js`

```javascript
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../plugins/auth.js';
import { broadcastOrderUpdate } from '../services/socketService.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export default async function orderRoutes(app) {

  // PUBLIC: Place order (customer places order while waiting)
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

    // Fetch current prices from DB (never trust client-sent prices)
    const itemIds = items.map(i => i.menu_item_id);
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, name, price_paise, is_available')
      .in('id', itemIds);

    const itemMap = Object.fromEntries(menuItems.map(m => [m.id, m]));

    // Validate all items are available
    for (const item of items) {
      const mi = itemMap[item.menu_item_id];
      if (!mi || !mi.is_available) {
        return reply.status(400).send({ error: `Item ${item.menu_item_id} is not available` });
      }
    }

    // Calculate total
    const total_paise = items.reduce((sum, item) => {
      return sum + (itemMap[item.menu_item_id].price_paise * item.quantity);
    }, 0);

    // Create order
    const { data: order } = await supabase
      .from('orders')
      .insert({
        entry_id,
        restaurant_id: entry.restaurants.id,
        total_paise,
        special_instructions,
        payment_method: payment_method || 'cash',
        status: 'pending'
      })
      .select()
      .single();

    // Create order items
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

    // If online payment, create Razorpay order
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

    // Broadcast to KDS
    broadcastOrderUpdate(entry.restaurants.id, { ...order, items });

    return {
      order_id: order.id,
      total_paise,
      total_inr: (total_paise / 100).toFixed(2),
      razorpay_order: razorpayOrder,
      razorpay_key: process.env.RAZORPAY_KEY_ID
    };
  });

  // STAFF/KDS: Update order status
  app.patch('/:order_id/status', { preHandler: requireAuth }, async (request, reply) => {
    const { order_id } = request.params;
    const { status, item_id } = request.body;
    const restaurantId = request.user.restaurant_id;

    if (item_id) {
      // Update individual item status
      await supabase.from('order_items').update({ status }).eq('id', item_id);
    } else {
      // Update whole order status
      const updates = {
        status,
        ...(status === 'confirmed' && { confirmed_at: new Date().toISOString() }),
        ...(status === 'ready' && { ready_at: new Date().toISOString() })
      };
      await supabase.from('orders').update(updates).eq('id', order_id);

      // If order is ready, push notify the customer
      if (status === 'ready') {
        const { data: order } = await supabase
          .from('orders')
          .select('*, queue_entries(push_subscription, token_number, id)')
          .eq('id', order_id)
          .single();

        if (order?.queue_entries?.push_subscription) {
          const { sendPushNotification } = await import('../services/pushService.js');
          await sendPushNotification(order.queue_entries.push_subscription, {
            title: 'Your order is ready!',
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
      .select('*, order_items(*), queue_entries(token_number, customer_name, table_id:tables(label))')
      .eq('restaurant_id', restaurant_id)
      .in('status', ['pending', 'confirmed', 'preparing'])
      .order('placed_at', { ascending: true });

    return { orders };
  });
}
```

### Razorpay Webhook: `src/routes/webhooks.js`

```javascript
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';

export default async function webhookRoutes(app) {
  app.post('/razorpay', {
    config: { rawBody: true } // need raw body for signature verification
  }, async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'];
    const body = request.rawBody;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);

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
```

### Analytics Service: `src/services/analyticsService.js`

```javascript
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

  const totalRevenue = orders.reduce((sum, o) => sum + o.total_paise, 0);
  const avgWaitMinutes = entries
    .filter(e => e.seated_at)
    .reduce((sum, e, _, arr) => {
      return sum + Math.round((new Date(e.seated_at) - new Date(e.joined_at)) / 60000) / arr.length;
    }, 0);

  return {
    total_customers: entries.length,
    total_seated: entries.filter(e => e.status === 'seated' || e.status === 'completed').length,
    total_no_shows: noShows.length,
    total_revenue_paise: totalRevenue,
    total_revenue_inr: (totalRevenue / 100).toFixed(2),
    avg_wait_minutes: Math.round(avgWaitMinutes),
    no_show_rate: entries.length > 0 ? Math.round((noShows.length / entries.length) * 100) : 0
  };
}
```

---

## CUSTOMER PWA — `apps/customer-pwa`

### Service Worker: `public/sw.js`

```javascript
const CACHE_NAME = 'qflow-customer-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) return; // Never cache API calls
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// WEB PUSH: Receive push notification
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/badge-72.png',
      vibrate: data.vibrate || [200, 100, 200],
      data: data.data || {},
      actions: data.actions || []
    })
  );
});

// WEB PUSH: Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windows => {
      const existing = windows.find(w => w.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
```

### PWA Manifest: `public/manifest.json`

```json
{
  "name": "QFlow Queue",
  "short_name": "QFlow",
  "description": "Track your restaurant queue in real time",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#10b981",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Push Hook: `src/hooks/usePush.js`

```javascript
import { useState, useEffect } from 'react';
import api from '../lib/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePush() {
  const [subscription, setSubscription] = useState(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  async function subscribe() {
    if (!supported) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
      });
      setSubscription(sub.toJSON());
      return sub.toJSON();
    } catch (err) {
      console.warn('Push subscription failed:', err.message);
      return null;
    }
  }

  return { subscribe, subscription, supported };
}
```

### Socket Hook: `src/hooks/useSocket.js`

```javascript
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL;
let socket;

export function useSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });
  }

  useEffect(() => {
    socket.connect();
    return () => {}; // Keep alive across route changes
  }, []);

  function trackEntry(entryId) {
    socket.emit('track_entry', entryId);
  }

  function onEntryUpdate(callback) {
    socket.on('entry_updated', callback);
    return () => socket.off('entry_updated', callback);
  }

  function onQueueUpdate(callback) {
    socket.on('queue_updated', callback);
    return () => socket.off('queue_updated', callback);
  }

  return { trackEntry, onEntryUpdate, onQueueUpdate };
}
```

### Customer Pages to Build

**`src/pages/Join.jsx`** — the landing page when customer scans QR code
- URL: `/r/:slug` — loads restaurant info and available queues
- Show restaurant name + logo
- If multiple queues, show selection (Dine-in / Takeaway)
- Form fields: customer name (required), phone number (optional), party size (stepper: 1–10)
- Special notes textarea (dietary requirements, wheelchair access, etc.)
- On submit: call `POST /api/queue/join`, subscribe to Web Push, save `entry_id` to localStorage
- On success: redirect to `/queue/:entry_id`

**`src/pages/QueueStatus.jsx`** — live token tracker
- URL: `/queue/:entry_id`
- Large token number display centered on screen
- Animated progress bar: "You are #X in line"
- "Now serving: #Y" counter
- Estimated wait time badge with confidence indicator
- Real-time updates via Socket.io (`onEntryUpdate`)
- Status states: `waiting` (show progress), `called` (pulsing green "Go to counter!"), `seated` (thank you screen)
- "Browse Menu" CTA button if restaurant has menu items

**`src/pages/Menu.jsx`** — menu browsing + ordering
- URL: `/queue/:entry_id/menu`
- Grid of menu items with images (from Cloudinary), price, veg/non-veg badge
- Category tabs at top
- Cart with quantity controls
- Order summary with total in INR
- Payment options: Pay Now (Razorpay popup) or Pay at Counter
- On order placed: show confirmation + return to queue status

**`src/pages/OrderConfirmation.jsx`** — order placed screen
- Order summary with items and total
- "Your food is being prepared" status
- Token number reminder
- Push notification test button

---

## ADMIN DASHBOARD — `apps/admin-dashboard`

### Pages to Build

**`src/pages/auth/Login.jsx`** — staff login
- Email + password form
- JWT token stored in memory (not localStorage — use Zustand)
- Redirect to `/live` on success

**`src/pages/Live.jsx`** — main operational screen (most important page)
- Split layout: Queue panel (left 60%) + Floor map (right 40%)
- Queue panel: live list of tokens with status badges, party size, wait time elapsed
  - Each token card has quick actions: Call, Seat (with table selector), No-show
  - Draggable to reorder if needed
  - Color coded: green = just joined, amber = waiting long, red = been waiting >30 min
- Floor map panel: visual table grid
  - Each table shows label, capacity, current token, time occupied
  - Click table → assign to called customer or mark as cleaning/available
  - Add/edit tables via settings
- Real-time via Socket.io — joins `restaurant:{id}` room on mount
- "Call Next" button at top for each active queue

**`src/pages/Kitchen.jsx`** — KDS (Kitchen Display System)
- Designed for a mounted tablet in the kitchen
- Large cards for each active order in columns: Pending | Preparing | Ready
- Each card shows: token number, customer name, items with quantities, special instructions, time elapsed
- Tap order card to move to next status
- Individual item checkboxes to mark items ready separately
- Sound alert option for new orders (HTML5 Audio API)
- Auto-refresh socket-driven

**`src/pages/Menu.jsx`** (admin) — menu management
- List view of all categories and items
- Add / Edit / Delete items with image upload (Cloudinary)
- Toggle availability on/off per item (for sold-out items)
- Drag-to-reorder within category
- Mark items as featured (shows in customer PWA highlights)

**`src/pages/Analytics.jsx`** — reporting dashboard
- Date range picker (today / last 7 days / last 30 days / custom)
- Key metrics cards: Total customers, Avg wait time, Revenue, No-show rate
- Charts via Recharts:
  - Line chart: customers per hour (peak hour analysis)
  - Bar chart: daily revenue for last 7 days
  - Pie chart: order types (dine-in vs takeaway)
- Data table: today's queue entries with status
- Export to CSV button

**`src/pages/Settings.jsx`** — restaurant configuration
- Restaurant profile: name, logo upload, address, phone
- Table management: add/edit/delete tables, set capacity per table, drag to set floor map positions
- Queue configuration: create/edit queues, set max capacity, enable/disable
- QR code generator: shows QR codes for each queue that can be printed
- Staff management: invite staff by email, set roles (owner/manager/staff/kitchen)
- Opening hours configuration

**`src/pages/TokenDisplay.jsx`** — fullscreen lobby display
- Designed to run on a TV or monitor mounted in the restaurant lobby
- Full screen large text: "Now Serving: #47"
- Scrolling ticker of recently called tokens
- No controls — pure display mode
- Route: `/display/:restaurant_id` — staff visits this URL on the lobby TV
- Auto-refreshes via Socket.io

---

## SHARED PACKAGE — `packages/shared/src`

### `types.js`
```javascript
export const QueueEntryStatus = {
  WAITING: 'waiting',
  CALLED: 'called',
  SEATED: 'seated',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled'
};

export const OrderStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

export const TableStatus = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  CLEANING: 'cleaning',
  BLOCKED: 'blocked'
};
```

### `utils.js`
```javascript
export function formatWaitTime(minutes) {
  if (minutes === 0) return 'Ready now';
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

export function formatPaise(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(paise / 100);
}

export function generateQueueUrl(restaurantSlug, baseUrl = 'https://app.qflow.in') {
  return `${baseUrl}/r/${restaurantSlug}`;
}

export function getElapsedMinutes(joinedAt) {
  return Math.floor((Date.now() - new Date(joinedAt)) / 60000);
}
```

---

## ENVIRONMENT VARIABLES

### `apps/api/.env`
```
NODE_ENV=development
PORT=3001

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://YOUR.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...

# VAPID Keys — generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=BNxx...
VAPID_PRIVATE_KEY=xxxx...
VAPID_CONTACT_EMAIL=admin@qflow.in

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# Resend
RESEND_API_KEY=re_xxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=qflow
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# JWT
JWT_SECRET=minimum-32-character-random-string-here

# CORS origins
CUSTOMER_PWA_URL=http://localhost:5173
ADMIN_DASHBOARD_URL=http://localhost:5174
```

### `apps/customer-pwa/.env`
```
VITE_API_URL=http://localhost:3001
VITE_VAPID_PUBLIC_KEY=BNxx...  ← same as above
```

### `apps/admin-dashboard/.env`
```
VITE_API_URL=http://localhost:3001
VITE_RAZORPAY_KEY_ID=rzp_test_xxx
```

---

## ROOT PACKAGE.JSON

```json
{
  "name": "qflow",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "build": "pnpm --parallel -r build",
    "dev:api": "pnpm --filter api dev",
    "dev:customer": "pnpm --filter customer-pwa dev",
    "dev:admin": "pnpm --filter admin-dashboard dev"
  }
}
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## DESIGN SYSTEM

Both frontend apps share the same Tailwind config and design language.

### Design Direction
Aesthetic: **"Precision Operations"** — dark-dominant, monochrome base with a single vibrant accent (emerald green `#10b981`). Think Linear meets a restaurant POS. Ultra-clean, data-dense, zero decorative elements. Every pixel serves a function.

### Tailwind Config
```javascript
// tailwind.config.js (shared by both frontends)
export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        surface: {
          0: '#0a0a0a',   // deepest bg
          1: '#111111',   // page bg
          2: '#1a1a1a',   // card bg
          3: '#222222',   // elevated card
          4: '#2a2a2a',   // input/control bg
          border: '#2e2e2e',
        },
        text: {
          primary: '#f5f5f5',
          secondary: '#a3a3a3',
          muted: '#525252',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      }
    }
  }
}
```

### Customer PWA Design Notes
- Dark background (`#0a0a0a`) — reduces eye strain while waiting in a bright restaurant
- Token number displayed in a giant `font-mono` with a subtle pulsing ring animation
- Progress indicator: horizontal segmented bar, filled segments = served customers
- Emerald green as the primary action color and success state
- Status transitions use smooth CSS animations (no jarring reloads)
- Bottom-sheet style menu for mobile UX

### Admin Dashboard Design Notes
- Sidebar navigation on desktop, bottom nav on mobile
- Dense data tables with hover states
- Status badges: color-coded pills (green=available, amber=waiting, red=urgent, blue=called)
- Card-based queue tokens with a horizontal scrollable lane view (like a kanban)
- Charts in a muted style — axes gray, fill emerald
- Toast notifications for real-time events (new customer joined, order placed)

---

## API RESPONSE CONTRACTS

All API responses follow this envelope:
```javascript
// Success
{ data: {...}, error: null }

// Error
{ data: null, error: { code: 'QUEUE_PAUSED', message: 'This queue is currently paused' } }
```

All timestamps are ISO 8601 UTC strings. All monetary values are in paise (integers). Never send floating point money.

---

## SECURITY REQUIREMENTS

1. **JWT Auth:** All staff routes require `Authorization: Bearer <token>` header. Never expose service role key to frontend.
2. **Restaurant isolation:** Every DB query from staff routes must filter by `restaurant_id` from the JWT payload — never trust request body for this.
3. **Input validation:** Use Zod schema on every route. Fastify's `schema` option handles this automatically.
4. **Rate limiting:** Add `@fastify/rate-limit` to public routes — max 30 requests/minute per IP on `/queue/join`.
5. **Webhook verification:** Always verify Razorpay webhook signatures with HMAC SHA256.
6. **CORS:** Only allow configured origins, no wildcard in production.
7. **Customer privacy:** Phone numbers stored encrypted in DB (`pgcrypto`). Push subscriptions are opaque objects — never log or expose them.

---

## DEPLOYMENT

### Backend (Railway)
- Connect GitHub repo
- Set root directory to `apps/api`
- Add all env vars in Railway dashboard
- Railway auto-deploys on push to main

### Frontend (Vercel)
- Two separate Vercel projects: one for `customer-pwa`, one for `admin-dashboard`
- Set root directory accordingly in Vercel settings
- Add env vars in Vercel project settings
- Custom domains: `app.qflow.in` (customer), `admin.qflow.in` (dashboard)

### Generate VAPID keys (one-time setup)
```bash
npx web-push generate-vapid-keys
# Copy public key to both API and customer-pwa .env files
```

---

## BUILD ORDER (implement in this exact sequence)

1. **Supabase setup** — run migrations, get connection strings
2. **API scaffold** — Fastify server, Supabase client, Redis client, Socket.io init
3. **Auth routes** — login, refresh token, staff registration
4. **Queue routes** — join, status, call-next (core loop)
5. **Customer PWA basic** — Join page → QueueStatus page with Socket.io live updates
6. **Service worker + Web Push** — sw.js, usePush hook, VAPID setup, sendPushNotification
7. **Admin Live page** — queue list + call next button (full operational loop working end-to-end)
8. **Menu routes + Menu pages** (admin + customer)
9. **Order routes + Order flow** (customer cart → place order → KDS)
10. **Table manager** — floor map, assign/release
11. **Kitchen display (KDS)** — `Kitchen.jsx` with socket updates
12. **Razorpay payment flow** — create order, handle webhook, mark paid
13. **Analytics routes + Analytics page**
14. **Settings page** — QR generator, table CRUD, staff management
15. **Token Display page** — lobby TV screen
16. **Polish** — toast notifications, loading states, error boundaries, PWA install prompt, offline support

---

## TESTING STRATEGY

- **Unit tests:** `vitest` for queue engine algorithm and utility functions
- **API tests:** `supertest` + `vitest` for all routes with mocked Supabase/Redis
- **E2E:** Not required for MVP — manual test with two browser windows (one = customer, one = admin)
- **Manual test flow:** 
  1. Admin creates restaurant, configures 3 tables, adds menu items
  2. Customer scans QR → joins queue → sees token #1
  3. Admin clicks "Call Next" → customer gets push notification
  4. Customer places order while waiting
  5. Admin assigns table → KDS shows order
  6. KDS marks order ready → customer gets second push notification
  7. Admin marks entry completed → table becomes available

---

## IMPORTANT NOTES FOR AI ASSISTANT

- Never use WhatsApp API, Twilio, or any paid messaging service. Web Push API is the ONLY notification mechanism.
- All amounts are in paise (integer). Use `formatPaise()` from shared utils to display.
- Socket.io rooms: `restaurant:{id}` for staff, `entry:{id}` for individual customer tracking.
- The `push_subscription` is the full JSON object from `PushManager.subscribe().toJSON()`. Store it as jsonb in Postgres, pass it directly to `webpush.sendNotification()`.
- Redis is used ONLY for live queue state (token counters, waiting counts) because it's atomic and fast. All persistent data goes to Postgres.
- The Supabase client in the API uses the `service_role` key (bypasses RLS). The frontend never has this key.
- Customer PWA uses `entry_id` in localStorage to remember their position across page refreshes.
- The admin dashboard auth token should be stored in Zustand (in-memory), not localStorage — for security.
- Every page that shows money must use `formatPaise()` — never divide by 100 inline.
- Use `date-fns` for all date manipulation. Never use `moment.js`.

---

*End of QFlow build prompt. Total scope: ~3,500 lines of production code across 3 apps.*