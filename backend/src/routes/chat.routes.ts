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
 * Normalizes a query string and returns its SHA-256 hash for use as a cache key.
 * Normalization: lowercased, trimmed, punctuation stripped, whitespace collapsed.
 * @param query — raw user query text
 * @param language — ISO 639-1 preferred language code (e.g. 'en', 'es')
 * @returns 64-character hex SHA-256 digest
 */
function computeQueryHash(query: string, language: string): string {
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^\&\*;:{}=\-_`~()?¿¡]/g, '') // remove punctuation
    .replace(/\s+/g, ' '); // collapse spacing

  return crypto
    .createHash('sha256')
    .update(`${normalized}_${language.toLowerCase()}`)
    .digest('hex');
}

/**
 * Writes a `{ language, responseText }` pair to the Redis cache with a 24-hour TTL.
 * Fail-safe: any Redis error is logged as a warning without propagating to the caller.
 */
async function writeToRedisCache(
  key: string,
  language: string,
  responseText: string
): Promise<void> {
  try {
    if (redisClient.isOpen) {
      await redisClient.set(
        key,
        JSON.stringify({ language, responseText }),
        { EX: 86400 }
      );
    }
  } catch (err) {
    console.warn('Redis write failed:', err);
  }
}

/**
 * Handles a Redis cache hit: parses the cached value, asynchronously increments the DB
 * hit counter, creates a ChatQuery record marked as cached, and sends the 200 response.
 * @returns true if the hit was processed and a response sent; false on parse error.
 */
async function handleRedisCacheHit(
  cachedVal: string,
  hash: string,
  userId: string | undefined,
  venueId: string,
  queryText: string,
  res: Response
): Promise<boolean> {
  try {
    const { language: detectedLang, responseText: cachedResponseText } = JSON.parse(cachedVal);

    // Update database hit count statistics asynchronously (non-blocking)
    prisma.translationCache.updateMany({
      where: { queryHash: hash },
      data: { hitCount: { increment: 1 } },
    }).catch((e) => console.error('Failed to increment DB hit count:', e));

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
    return true;
  } catch (err) {
    console.error('Failed to parse cached Redis value:', err);
    return false;
  }
}

/**
 * Handles a PostgreSQL database cache hit: writes the result back to Redis (fail-safe),
 * increments the synchronous hit counter, creates a ChatQuery record, and sends the response.
 * @returns true if a DB cache entry was found and a response sent; false on cache miss.
 */
async function handleDbCacheHit(
  redisCacheKey: string,
  hash: string,
  userId: string | undefined,
  venueId: string,
  queryText: string,
  res: Response
): Promise<boolean> {
  const cachedResponse = await prisma.translationCache.findUnique({
    where: { queryHash: hash },
  });

  if (!cachedResponse) return false;

  // Write back to Redis so the next request is served from the faster cache tier
  await writeToRedisCache(redisCacheKey, cachedResponse.language, cachedResponse.responseText);

  // Update cache hit count (synchronous — the stat is used for cache eviction decisions)
  await prisma.translationCache.update({
    where: { id: cachedResponse.id },
    data: { hitCount: { increment: 1 } },
  });

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
  return true;
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
    let redisCachedValue: string | null = null;

    // 1. Try Redis cache first (fail-safe)
    try {
      if (redisClient.isOpen) {
        redisCachedValue = await redisClient.get(redisCacheKey);
      }
    } catch (err) {
      console.warn('Redis read failed, falling back to database:', err);
    }

    if (redisCachedValue) {
      const handled = await handleRedisCacheHit(redisCachedValue, hash, userId, venueId, queryText, res);
      if (handled) return;
    }

    // 2. Check PostgreSQL database cache next
    const dbHandled = await handleDbCacheHit(redisCacheKey, hash, userId, venueId, queryText, res);
    if (dbHandled) return;

    // 3. Absolute cache miss: call Gemini API
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

    // Write-back to Redis cache (fail-safe, 24-hour TTL)
    await writeToRedisCache(redisCacheKey, geminiResult.detectedLanguage, geminiResult.responseText);

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
