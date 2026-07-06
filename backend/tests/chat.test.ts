import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db.client';
import * as geminiClient from '../src/ai/geminiClient';
import { redisClient } from '../src/config/redis.client';
import jwt from 'jsonwebtoken';

jest.mock('../src/config/db.client', () => ({
  prisma: {
    translationCache: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    chatQuery: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../src/ai/geminiClient', () => ({
  askGemini: jest.fn(),
}));

jest.mock('../src/config/redis.client', () => ({
  redisClient: {
    isOpen: true,
    get: jest.fn(),
    set: jest.fn(),
  },
}));

describe('Chat Routes /api/v1/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient.get as jest.Mock).mockReset();
    (redisClient.set as jest.Mock).mockReset();
  });

  describe('POST /query', () => {
    it('returns a cached response from Redis if key exists', async () => {
      const mockRedisVal = JSON.stringify({
        language: 'es',
        responseText: 'La puerta está al lado izquierdo (from Redis).',
      });

      const mockQueryRecord = {
        id: 'query-id',
        userId: null,
        venueId: 'venue-123',
        queryText: '¿Dónde está la puerta?',
        detectedLanguage: 'es',
        responseText: 'La puerta está al lado izquierdo (from Redis).',
        wasCached: true,
        createdAt: new Date(),
      };

      // Mock Redis hit
      (redisClient.get as jest.Mock).mockResolvedValue(mockRedisVal);
      (prisma.translationCache.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.chatQuery.create as jest.Mock).mockResolvedValue(mockQueryRecord);

      const res = await request(app)
        .post('/api/v1/chat/query')
        .send({
          queryText: '¿Dónde está la puerta?',
          venueId: 'venue-123',
          language: 'es',
        });

      expect(res.status).toBe(200);
      expect(res.body.wasCached).toBe(true);
      expect(res.body.responseText).toBe('La puerta está al lado izquierdo (from Redis).');
      expect(redisClient.get).toHaveBeenCalled();
      expect(prisma.translationCache.findUnique).not.toHaveBeenCalled();
      expect(geminiClient.askGemini).not.toHaveBeenCalled();
    });

    it('returns a cached response if DB exists but Redis is miss, and writes back to Redis', async () => {
      const mockCachedResponse = {
        id: 'cached-id',
        queryHash: 'some-hash',
        language: 'es',
        responseText: 'La puerta está al lado izquierdo.',
        hitCount: 5,
        updatedAt: new Date(),
      };

      const mockQueryRecord = {
        id: 'query-id',
        userId: null,
        venueId: 'venue-123',
        queryText: '¿Dónde está la puerta?',
        detectedLanguage: 'es',
        responseText: 'La puerta está al lado izquierdo.',
        wasCached: true,
        createdAt: new Date(),
      };

      // Mock Redis miss, DB hit
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (prisma.translationCache.findUnique as jest.Mock).mockResolvedValue(mockCachedResponse);
      (prisma.translationCache.update as jest.Mock).mockResolvedValue(mockCachedResponse);
      (prisma.chatQuery.create as jest.Mock).mockResolvedValue(mockQueryRecord);
      (redisClient.set as jest.Mock).mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/v1/chat/query')
        .send({
          queryText: '¿Dónde está la puerta?',
          venueId: 'venue-123',
          language: 'es',
        });

      expect(res.status).toBe(200);
      expect(res.body.wasCached).toBe(true);
      expect(res.body.responseText).toBe('La puerta está al lado izquierdo.');
      expect(redisClient.get).toHaveBeenCalled();
      expect(prisma.translationCache.findUnique).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('chat_cache:'),
        expect.stringContaining('La puerta está al lado izquierdo.'),
        { EX: 86400 }
      );
      expect(geminiClient.askGemini).not.toHaveBeenCalled();
    });

    it('queries Gemini and updates cache on absolute cache miss', async () => {
      const mockGeminiResponse = {
        responseText: 'Gate B is near the north exit.',
        detectedLanguage: 'en',
      };

      const mockQueryRecord = {
        id: 'query-id-new',
        userId: 'user-456',
        venueId: 'venue-123',
        queryText: 'Where is Gate B?',
        detectedLanguage: 'en',
        responseText: 'Gate B is near the north exit.',
        wasCached: false,
        createdAt: new Date(),
      };

      // Mock Redis miss, DB miss
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (prisma.translationCache.findUnique as jest.Mock).mockResolvedValue(null);
      (geminiClient.askGemini as jest.Mock).mockResolvedValue(mockGeminiResponse);
      (prisma.translationCache.create as jest.Mock).mockResolvedValue({});
      (prisma.chatQuery.create as jest.Mock).mockResolvedValue(mockQueryRecord);
      (redisClient.set as jest.Mock).mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/v1/chat/query')
        .send({
          queryText: 'Where is Gate B?',
          venueId: 'venue-123',
          userId: 'user-456',
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.wasCached).toBe(false);
      expect(res.body.responseText).toBe('Gate B is near the north exit.');
      expect(redisClient.get).toHaveBeenCalled();
      expect(prisma.translationCache.findUnique).toHaveBeenCalled();
      expect(geminiClient.askGemini).toHaveBeenCalledWith('Where is Gate B?');
      expect(prisma.translationCache.create).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('chat_cache:'),
        expect.stringContaining('Gate B is near the north exit.'),
        { EX: 86400 }
      );
    });

    it('returns 429 Too Many Requests once rate limit is exceeded', async () => {
      const testIp = '1.2.3.4';
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (prisma.translationCache.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        language: 'en',
        responseText: 'cached response',
      });

      // Send 60 requests within limit
      for (let i = 0; i < 60; i++) {
        const res = await request(app)
          .post('/api/v1/chat/query')
          .set('x-test-ip', testIp)
          .send({
            queryText: 'hello',
            venueId: 'venue-123',
          });
        expect(res.status).toBe(200);
      }

      // The 61st request should trigger 429
      const resLimit = await request(app)
        .post('/api/v1/chat/query')
        .set('x-test-ip', testIp)
        .send({
          queryText: 'hello',
          venueId: 'venue-123',
        });
      expect(resLimit.status).toBe(429);
      expect(resLimit.body).toHaveProperty('error', 'Too many requests. Please try again after a minute.');
    });
  });

  describe('GET /history/:userId', () => {
    const mockSecret = 'super-secret-jwt-signing-key-for-matchday';
    
    it('returns history if user is authenticated and matches userId', async () => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId, role: 'fan' }, mockSecret);
      
      const mockHistory = [
        {
          id: 'q1',
          userId,
          venueId: 'venue-123',
          queryText: 'Where is Gate B?',
          detectedLanguage: 'en',
          responseText: 'Gate B is near the north exit.',
          wasCached: false,
          createdAt: new Date(),
        }
      ];

      (prisma.chatQuery.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const res = await request(app)
        .get(`/api/v1/chat/history/${userId}?limit=5&offset=2`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].queryText).toBe('Where is Gate B?');
      expect(prisma.chatQuery.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        skip: 2,
      });
    });

    it('returns 403 if authenticated user does not match parameter userId', async () => {
      const userId = 'user-123';
      const token = jwt.sign({ id: 'user-different', role: 'fan' }, mockSecret);

      const res = await request(app)
        .get(`/api/v1/chat/history/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(prisma.chatQuery.findMany).not.toHaveBeenCalled();
    });

    it('returns 401 if token is missing', async () => {
      const res = await request(app).get('/api/v1/chat/history/user-123');
      expect(res.status).toBe(401);
    });
  });
});
