"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const sanitize_middleware_1 = require("../middleware/sanitize.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const db_client_1 = require("../config/db.client");
const geminiClient_1 = require("../ai/geminiClient");
const redis_client_1 = require("../config/redis.client");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const router = (0, express_1.Router)();
/**
 * Normalizes a query string and returns its SHA-256 hash.
 */
function computeQueryHash(query, language) {
    const normalized = query
        .toLowerCase()
        .trim()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿¡]/g, '') // remove punctuation
        .replace(/\s+/g, ' '); // collapse spacing
    return crypto_1.default
        .createHash('sha256')
        .update(`${normalized}_${language.toLowerCase()}`)
        .digest('hex');
}
// POST /api/v1/chat/query - Submit user chat query (checks Redis cache first)
router.post('/query', rateLimit_middleware_1.rateLimiter, sanitize_middleware_1.sanitizeInput, async (req, res) => {
    try {
        const { queryText, venueId, userId, language } = req.body;
        if (!queryText || !venueId) {
            res.status(400).json({ error: 'Missing queryText or venueId parameters' });
            return;
        }
        const preferredLanguage = language || 'en';
        const hash = computeQueryHash(queryText, preferredLanguage);
        const redisCacheKey = `chat_cache:${hash}`;
        let cachedVal = null;
        // 1. Try Redis cache first (fail-safe)
        try {
            if (redis_client_1.redisClient.isOpen) {
                cachedVal = await redis_client_1.redisClient.get(redisCacheKey);
            }
        }
        catch (err) {
            console.warn('Redis read failed, falling back to database:', err);
        }
        if (cachedVal) {
            try {
                const { language: detectedLang, responseText: cachedResponseText } = JSON.parse(cachedVal);
                // Update database hit count statistics asynchronously
                db_client_1.prisma.translationCache.updateMany({
                    where: { queryHash: hash },
                    data: { hitCount: { increment: 1 } },
                }).catch((e) => console.error('Failed to increment DB hit count:', e));
                // Log the query execution with wasCached: true
                const queryRecord = await db_client_1.prisma.chatQuery.create({
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
            }
            catch (err) {
                console.error('Failed to parse cached Redis value:', err);
            }
        }
        // 2. Check PostgreSQL database cache next
        const cachedResponse = await db_client_1.prisma.translationCache.findUnique({
            where: { queryHash: hash },
        });
        if (cachedResponse) {
            // Set in Redis for future hits (fail-safe, 24 hour TTL)
            try {
                if (redis_client_1.redisClient.isOpen) {
                    await redis_client_1.redisClient.set(redisCacheKey, JSON.stringify({
                        language: cachedResponse.language,
                        responseText: cachedResponse.responseText,
                    }), { EX: 86400 });
                }
            }
            catch (err) {
                console.warn('Redis write failed:', err);
            }
            // Update cache hit count
            await db_client_1.prisma.translationCache.update({
                where: { id: cachedResponse.id },
                data: { hitCount: { increment: 1 } },
            });
            // Log the query execution with wasCached: true
            const queryRecord = await db_client_1.prisma.chatQuery.create({
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
        const geminiResult = await (0, geminiClient_1.askGemini)(queryText);
        // Save translation in database cache for future hits
        await db_client_1.prisma.translationCache.create({
            data: {
                queryHash: hash,
                language: geminiResult.detectedLanguage,
                responseText: geminiResult.responseText,
                hitCount: 0,
            },
        });
        // Write-back to Redis cache (fail-safe, 24 hour TTL)
        try {
            if (redis_client_1.redisClient.isOpen) {
                await redis_client_1.redisClient.set(redisCacheKey, JSON.stringify({
                    language: geminiResult.detectedLanguage,
                    responseText: geminiResult.responseText,
                }), { EX: 86400 });
            }
        }
        catch (err) {
            console.warn('Redis write failed on cache miss:', err);
        }
        // Save chat query record with wasCached: false
        const queryRecord = await db_client_1.prisma.chatQuery.create({
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
    }
    catch (error) {
        console.error('Error handling chat query:', error);
        res.status(500).json({ error: 'Failed to process chat query' });
    }
});
// GET /api/v1/chat/history/:userId - Get query history for user
router.get('/history/:userId', auth_middleware_1.requireAuth, async (req, res) => {
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
        const history = await db_client_1.prisma.chatQuery.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 100), // Restrict maximum payload chunk size
            skip: offset,
        });
        res.status(200).json(history);
    }
    catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});
exports.default = router;
