import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { createServer } from 'http';

import queueRoutes from './routes/queue.js';
import orderRoutes from './routes/orders.js';
import tableRoutes from './routes/tables.js';
import menuRoutes from './routes/menu.js';
import pushRoutes from './routes/push.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhooks.js';
import analyticsRoutes from './routes/analytics.js';
import { initSocketService } from './services/socketService.js';

const app = Fastify({ logger: true });

// Dynamic CORS: allow Vercel previews, localhost, and any explicit env origins
const allowedOrigins = [
  process.env.CUSTOMER_PWA_URL,
  process.env.ADMIN_DASHBOARD_URL,
  'http://localhost:5173',
  'http://localhost:5174'
].filter(Boolean);

function checkOrigin(origin, cb) {
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) return cb(null, true);
  // Allow any Vercel preview/production domain
  if (origin.endsWith('.vercel.app')) return cb(null, true);
  // Allow any explicitly configured origins
  if (allowedOrigins.includes(origin)) return cb(null, true);
  // Allow localhost for development
  if (origin.startsWith('http://localhost:')) return cb(null, true);
  cb(new Error('Not allowed by CORS'), false);
}

// Socket.io setup
const io = new Server(app.server, {
  cors: {
    origin: checkOrigin,
    credentials: true
  }
});
initSocketService(io);
app.decorate('io', io);

// Plugins
await app.register(cors, {
  origin: checkOrigin,
  credentials: true
});
await app.register(jwt, { secret: process.env.JWT_SECRET });
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip
});

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
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '1.0.0'
}));

const PORT = process.env.PORT || 3001;

// Fastify listen
app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`⚡ QFlow API running on port ${PORT}`);
});

// Force restart to load updated service role key

