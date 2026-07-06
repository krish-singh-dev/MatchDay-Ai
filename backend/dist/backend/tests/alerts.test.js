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
const socketEvents = __importStar(require("../src/socket/events"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
jest.mock('../src/config/db.client', () => ({
    prisma: {
        zone: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
        densityReading: {
            create: jest.fn(),
            findFirst: jest.fn(),
        },
        alert: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));
jest.mock('../src/ai/geminiClient', () => ({
    askGemini: jest.fn(),
}));
jest.mock('../src/socket/events', () => ({
    emitDensityUpdate: jest.fn(),
    emitNewAlert: jest.fn(),
    emitAlertResolved: jest.fn(),
}));
describe('Alerts and Density Ingestion /api/v1', () => {
    const mockSecret = 'super-secret-jwt-signing-key-for-matchday';
    const staffToken = jsonwebtoken_1.default.sign({ id: 'staff-123', role: 'staff' }, mockSecret);
    const fanToken = jsonwebtoken_1.default.sign({ id: 'fan-123', role: 'fan' }, mockSecret);
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('POST /density/ingest', () => {
        it('triggers a critical alert and emits socket events if density is 90%+', async () => {
            const mockZone = {
                id: 'zone-1',
                venueId: 'venue-1',
                name: 'Gate B Transit',
                zoneType: 'transit',
                maxCapacity: 1000,
            };
            const mockReading = {
                id: 'reading-1',
                zoneId: 'zone-1',
                estimatedCount: 950,
                densityPct: 0.95,
                recordedAt: new Date(),
            };
            const mockAlert = {
                id: 'alert-1',
                zoneId: 'zone-1',
                severity: 'critical',
                aiRecommendation: 'Pending',
                acknowledgedBy: null,
                createdAt: new Date(),
                resolvedAt: null,
            };
            db_client_1.prisma.zone.findUnique.mockResolvedValue(mockZone);
            db_client_1.prisma.densityReading.create.mockResolvedValue(mockReading);
            db_client_1.prisma.alert.findFirst.mockResolvedValue(null); // No existing active alert
            db_client_1.prisma.alert.create.mockResolvedValue(mockAlert);
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/density/ingest')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                zoneId: 'zone-1',
                estimatedCount: 950,
            });
            expect(res.status).toBe(201);
            expect(res.body.densityPct).toBe(0.95);
            expect(db_client_1.prisma.alert.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    severity: 'critical',
                }),
            }));
            expect(socketEvents.emitDensityUpdate).toHaveBeenCalled();
            expect(socketEvents.emitNewAlert).toHaveBeenCalled();
        });
        it('returns 403 forbidden if user role is not staff/admin', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/density/ingest')
                .set('Authorization', `Bearer ${fanToken}`)
                .send({
                zoneId: 'zone-1',
                estimatedCount: 500,
            });
            expect(res.status).toBe(403);
        });
        it('returns 400 if estimatedCount is negative', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/density/ingest')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                zoneId: 'zone-1',
                estimatedCount: -5,
            });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'estimatedCount must be a non-negative integer');
        });
        it('returns 400 if zoneId is invalid alphanumeric format', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/density/ingest')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                zoneId: 'invalid; DROP TABLE zones;',
                estimatedCount: 100,
            });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'zoneId must be a valid alphanumeric string');
        });
    });
    describe('GET /alerts/active/:venueId', () => {
        it('returns list of unresolved alerts', async () => {
            const mockAlerts = [
                {
                    id: 'alert-1',
                    severity: 'critical',
                    zone: { name: 'Gate B Transit' },
                },
            ];
            db_client_1.prisma.alert.findMany.mockResolvedValue(mockAlerts);
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/alerts/active/venue-1')
                .set('Authorization', `Bearer ${staffToken}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].severity).toBe('critical');
        });
    });
    describe('POST /alerts/:alertId/resolve', () => {
        it('marks alert as resolved and broadcasts notification', async () => {
            const mockAlert = {
                id: 'alert-1',
                resolvedAt: new Date(),
                zone: { name: 'Gate B' },
            };
            db_client_1.prisma.alert.update.mockResolvedValue(mockAlert);
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/alerts/alert-1/resolve')
                .set('Authorization', `Bearer ${staffToken}`);
            expect(res.status).toBe(200);
            expect(res.body.resolvedAt).toBeDefined();
            expect(socketEvents.emitAlertResolved).toHaveBeenCalled();
        });
    });
    describe('GET /alerts/:alertId/recommendation', () => {
        it('compiles stats, calls Gemini, saves and returns rerouting plan', async () => {
            const mockAlert = {
                id: 'alert-1',
                zoneId: 'zone-1',
                severity: 'critical',
                zone: {
                    id: 'zone-1',
                    name: 'Gate B Transit',
                    zoneType: 'transit',
                    maxCapacity: 1000,
                    venueId: 'venue-1',
                },
            };
            const mockTargetReading = {
                id: 'r1',
                zoneId: 'zone-1',
                estimatedCount: 950,
                densityPct: 0.95,
            };
            const mockOtherZones = [
                {
                    id: 'zone-2',
                    name: 'Gate A Concourse',
                    zoneType: 'concourse',
                    maxCapacity: 2000,
                    densityReadings: [
                        {
                            id: 'r2',
                            estimatedCount: 240,
                            densityPct: 0.12,
                        },
                    ],
                },
            ];
            const mockGeminiResponse = {
                responseText: 'Reroute traffic from Gate B to Gate A.',
                detectedLanguage: 'en',
            };
            db_client_1.prisma.alert.findUnique.mockResolvedValue(mockAlert);
            db_client_1.prisma.densityReading.findFirst.mockResolvedValue(mockTargetReading);
            db_client_1.prisma.zone.findMany.mockResolvedValue(mockOtherZones);
            geminiClient.askGemini.mockResolvedValue(mockGeminiResponse);
            db_client_1.prisma.alert.update.mockResolvedValue({
                id: 'alert-1',
                aiRecommendation: 'Reroute traffic from Gate B to Gate A.',
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/alerts/alert-1/recommendation')
                .set('Authorization', `Bearer ${staffToken}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('recommendation', 'Reroute traffic from Gate B to Gate A.');
            expect(geminiClient.askGemini).toHaveBeenCalledWith(expect.stringContaining('Gate B Transit'));
            expect(geminiClient.askGemini).toHaveBeenCalledWith(expect.stringContaining('Gate A Concourse'));
            expect(db_client_1.prisma.alert.update).toHaveBeenCalled();
        });
    });
});
