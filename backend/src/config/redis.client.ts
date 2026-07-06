import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('connect', () => {
  console.log('Redis client successfully connected to: ' + redisUrl);
});

redisClient.on('error', (err) => {
  console.error('Redis client error:', err);
});

// Self-invoking connection logic for runtime verification
export async function initRedis(): Promise<void> {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.error('Failed to initialize Redis connection:', error);
  }
}
