import { Router, Response } from 'express';
import crypto from 'crypto';
import { sanitizeInput } from '../middleware/sanitize.middleware';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/db.client';
import { askGemini } from '../ai/geminiClient';
import { redisClient } from '../config/redis.client';
import { rateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

/**
 * Normalizes a query string and returns its SHA-256 hash.
 */
function computeQueryHash(query: string, language: string): string {
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿¡]/g, '') // remove punctuation
    .replace(/\s+/g, ' '); // collapse spacing
  
  return crypto
    .createHash('sha256')
    .update(`${normalized}_${language.toLowerCase()}`)
    .digest('hex');
}

// POST /api/v1/chat/query - Submit user chat query (checks Redis cache first)
router.post('/query', rateLimiter, sanitizeInput, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { queryText, venueId, userId, language } = req.body;

    if (!queryText || !venueId) {
      res.status(400).json({ error: 'Missing queryText or venueId parameters' });
      return;
    }

    const preferredLanguage = language || 'en';
    const hash = computeQueryHash(queryText, preferredLanguage);
    const redisCacheKey = `chat_cache:${hash}`;
    let cachedVal: string | null = null;

    // 1. Try Redis cache first (fail-safe)
    try {
      if (redisClient.isOpen) {
        cachedVal = await redisClient.get(redisCacheKey);
      }
    } catch (err) {
      console.warn('Redis read failed, falling back to database:', err);
    }

    if (cachedVal) {
      try {
        const { language: detectedLang, responseText: cachedResponseText } = JSON.parse(cachedVal);

        // Update database hit count statistics asynchronously
        prisma.translationCache.updateMany({
          where: { queryHash: hash },
          data: { hitCount: { increment: 1 } },
        }).catch((e) => console.error('Failed to increment DB hit count:', e));

        // Log the query execution with wasCached: true
        const queryRecord = await prisma.chatQuery.create({
          data: {
            userId: userId || null,
            venueId,
            queryText,
            detectedLanguage: detectedLang,
            responseText: cachedResponseText,
            wasCached: true,
          },
        });

        res.status(200).json(queryRecord);
        return;
      } catch (err) {
        console.error('Failed to parse cached Redis value:', err);
      }
    }

    // 2. Check PostgreSQL database cache next
    const cachedResponse = await prisma.translationCache.findUnique({
      where: { queryHash: hash },
    });

    if (cachedResponse) {
      // Set in Redis for future hits (fail-safe, 24 hour TTL)
      try {
        if (redisClient.isOpen) {
          await redisClient.set(
            redisCacheKey,
            JSON.stringify({
              language: cachedResponse.language,
              responseText: cachedResponse.responseText,
            }),
            { EX: 86400 }
          );
        }
      } catch (err) {
        console.warn('Redis write failed:', err);
      }

      // Update cache hit count
      await prisma.translationCache.update({
        where: { id: cachedResponse.id },
        data: { hitCount: { increment: 1 } },
      });

      // Log the query execution with wasCached: true
      const queryRecord = await prisma.chatQuery.create({
        data: {
          userId: userId || null,
          venueId,
          queryText,
          detectedLanguage: cachedResponse.language,
          responseText: cachedResponse.responseText,
          wasCached: true,
        },
      });

      res.status(200).json(queryRecord);
      return;
    }

    // 3. Absolute cache miss: Call Gemini API
    const geminiResult = await askGemini(queryText);

    // Save translation in database cache for future hits
    await prisma.translationCache.create({
      data: {
        queryHash: hash,
        language: geminiResult.detectedLanguage,
        responseText: geminiResult.responseText,
        hitCount: 0,
      },
    });

    // Write-back to Redis cache (fail-safe, 24 hour TTL)
    try {
      if (redisClient.isOpen) {
        await redisClient.set(
          redisCacheKey,
          JSON.stringify({
            language: geminiResult.detectedLanguage,
            responseText: geminiResult.responseText,
          }),
          { EX: 86400 }
        );
      }
    } catch (err) {
      console.warn('Redis write failed on cache miss:', err);
    }

    // Save chat query record with wasCached: false
    const queryRecord = await prisma.chatQuery.create({
      data: {
        userId: userId || null,
        venueId,
        queryText,
        detectedLanguage: geminiResult.detectedLanguage,
        responseText: geminiResult.responseText,
        wasCached: false,
      },
    });

    res.status(200).json(queryRecord);
  } catch (error) {
    console.error('Error handling chat query:', error);
    res.status(500).json({ error: 'Failed to process chat query' });
  }
});

// GET /api/v1/chat/history/:userId - Get query history for user
router.get('/history/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Enforce that authenticated users can only view their own history (unless admin)
    if (req.user?.id !== userId && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Access denied to query history' });
      return;
    }

    // Parse pagination inputs with safe defaults and limits
    const limit = parseInt(req.query.limit?.toString() || '20', 10);
    const offset = parseInt(req.query.offset?.toString() || '0', 10);

    const history = await prisma.chatQuery.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100), // Restrict maximum payload chunk size
      skip: offset,
    });

    res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export default router;
