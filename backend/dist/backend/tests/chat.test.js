"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const db_client_1 = require("../src/config/db.client");
const geminiClient = __importStar(require("../src/ai/geminiClient"));
const redis_client_1 = require("../src/config/redis.client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
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
        redis_client_1.redisClient.get.mockReset();
        redis_client_1.redisClient.set.mockReset();
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
            redis_client_1.redisClient.get.mockResolvedValue(mockRedisVal);
            db_client_1.prisma.translationCache.updateMany.mockResolvedValue({ count: 1 });
            db_client_1.prisma.chatQuery.create.mockResolvedValue(mockQueryRecord);
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/chat/query')
                .send({
                queryText: '¿Dónde está la puerta?',
                venueId: 'venue-123',
                language: 'es',
            });
            expect(res.status).toBe(200);
            expect(res.body.wasCached).toBe(true);
            expect(res.body.responseText).toBe('La puerta está al lado izquierdo (from Redis).');
            expect(redis_client_1.redisClient.get).toHaveBeenCalled();
            expect(db_client_1.prisma.translationCache.findUnique).not.toHaveBeenCalled();
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
            redis_client_1.redisClient.get.mockResolvedValue(null);
            db_client_1.prisma.translationCache.findUnique.mockResolvedValue(mockCachedResponse);
            db_client_1.prisma.translationCache.update.mockResolvedValue(mockCachedResponse);
            db_client_1.prisma.chatQuery.create.mockResolvedValue(mockQueryRecord);
            redis_client_1.redisClient.set.mockResolvedValue('OK');
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/chat/query')
                .send({
                queryText: '¿Dónde está la puerta?',
                venueId: 'venue-123',
                language: 'es',
            });
            expect(res.status).toBe(200);
            expect(res.body.wasCached).toBe(true);
            expect(res.body.responseText).toBe('La puerta está al lado izquierdo.');
            expect(redis_client_1.redisClient.get).toHaveBeenCalled();
            expect(db_client_1.prisma.translationCache.findUnique).toHaveBeenCalled();
            expect(redis_client_1.redisClient.set).toHaveBeenCalledWith(expect.stringContaining('chat_cache:'), expect.stringContaining('La puerta está al lado izquierdo.'), { EX: 86400 });
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
            redis_client_1.redisClient.get.mockResolvedValue(null);
            db_client_1.prisma.translationCache.findUnique.mockResolvedValue(null);
            geminiClient.askGemini.mockResolvedValue(mockGeminiResponse);
            db_client_1.prisma.translationCache.create.mockResolvedValue({});
            db_client_1.prisma.chatQuery.create.mockResolvedValue(mockQueryRecord);
            redis_client_1.redisClient.set.mockResolvedValue('OK');
            const res = await (0, supertest_1.default)(app_1.default)
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
            expect(redis_client_1.redisClient.get).toHaveBeenCalled();
            expect(db_client_1.prisma.translationCache.findUnique).toHaveBeenCalled();
            expect(geminiClient.askGemini).toHaveBeenCalledWith('Where is Gate B?');
            expect(db_client_1.prisma.translationCache.create).toHaveBeenCalled();
            expect(redis_client_1.redisClient.set).toHaveBeenCalledWith(expect.stringContaining('chat_cache:'), expect.stringContaining('Gate B is near the north exit.'), { EX: 86400 });
        });
        it('returns 429 Too Many Requests once rate limit is exceeded', async () => {
            const testIp = '1.2.3.4';
            redis_client_1.redisClient.get.mockResolvedValue(null);
            db_client_1.prisma.translationCache.findUnique.mockResolvedValue({
                id: 'c1',
                language: 'en',
                responseText: 'cached response',
            });
            // Send 60 requests within limit
            for (let i = 0; i < 60; i++) {
                const res = await (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/chat/query')
                    .set('x-test-ip', testIp)
                    .send({
                    queryText: 'hello',
                    venueId: 'venue-123',
                });
                expect(res.status).toBe(200);
            }
            // The 61st request should trigger 429
            const resLimit = await (0, supertest_1.default)(app_1.default)
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
            const token = jsonwebtoken_1.default.sign({ id: userId, role: 'fan' }, mockSecret);
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
            db_client_1.prisma.chatQuery.findMany.mockResolvedValue(mockHistory);
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/chat/history/${userId}?limit=5&offset=2`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].queryText).toBe('Where is Gate B?');
            expect(db_client_1.prisma.chatQuery.findMany).toHaveBeenCalledWith({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                skip: 2,
            });
        });
        it('returns 403 if authenticated user does not match parameter userId', async () => {
            const userId = 'user-123';
            const token = jsonwebtoken_1.default.sign({ id: 'user-different', role: 'fan' }, mockSecret);
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/chat/history/${userId}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
            expect(db_client_1.prisma.chatQuery.findMany).not.toHaveBeenCalled();
        });
        it('returns 401 if token is missing', async () => {
            const res = await (0, supertest_1.default)(app_1.default).get('/api/v1/chat/history/user-123');
            expect(res.status).toBe(401);
        });
    });
});
