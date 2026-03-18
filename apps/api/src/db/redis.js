import { Redis } from '@upstash/redis';

// Only use Upstash if credentials exist
const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Simple in-memory fallback for local development without Redis
const memoryStore = new Map();

class MockRedis {
  async get(key) {
    return memoryStore.get(key) || null;
  }
  async set(key, value) {
    memoryStore.set(key, value);
    return 'OK';
  }
  async incr(key) {
    const val = (memoryStore.get(key) || 0) + 1;
    memoryStore.set(key, val);
    return val;
  }
  async decr(key) {
    const val = (memoryStore.get(key) || 0) - 1;
    memoryStore.set(key, val);
    return val;
  }
  async del(key) {
    memoryStore.delete(key);
    return 1;
  }
}

export const redis = hasRedis ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
}) : new MockRedis();

