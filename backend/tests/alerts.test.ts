import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db.client';
import * as geminiClient from '../src/ai/geminiClient';
import * as socketEvents from '../src/socket/events';
import jwt from 'jsonwebtoken';

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
  const staffToken = jwt.sign({ id: 'staff-123', role: 'staff' }, mockSecret);
  const fanToken = jwt.sign({ id: 'fan-123', role: 'fan' }, mockSecret);

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

      (prisma.zone.findUnique as jest.Mock).mockResolvedValue(mockZone);
      (prisma.densityReading.create as jest.Mock).mockResolvedValue(mockReading);
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null); // No existing active alert
      (prisma.alert.create as jest.Mock).mockResolvedValue(mockAlert);

      const res = await request(app)
        .post('/api/v1/density/ingest')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          zoneId: 'zone-1',
          estimatedCount: 950,
        });

      expect(res.status).toBe(201);
      expect(res.body.densityPct).toBe(0.95);
      
      expect(prisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'critical',
          }),
        })
      );
      expect(socketEvents.emitDensityUpdate).toHaveBeenCalled();
      expect(socketEvents.emitNewAlert).toHaveBeenCalled();
    });

    it('returns 403 forbidden if user role is not staff/admin', async () => {
      const res = await request(app)
        .post('/api/v1/density/ingest')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          zoneId: 'zone-1',
          estimatedCount: 500,
        });

      expect(res.status).toBe(403);
    });

    it('returns 400 if estimatedCount is negative', async () => {
      const res = await request(app)
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
      const res = await request(app)
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

      (prisma.alert.findMany as jest.Mock).mockResolvedValue(mockAlerts);

      const res = await request(app)
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

      (prisma.alert.update as jest.Mock).mockResolvedValue(mockAlert);

      const res = await request(app)
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

      (prisma.alert.findUnique as jest.Mock).mockResolvedValue(mockAlert);
      (prisma.densityReading.findFirst as jest.Mock).mockResolvedValue(mockTargetReading);
      (prisma.zone.findMany as jest.Mock).mockResolvedValue(mockOtherZones);
      (geminiClient.askGemini as jest.Mock).mockResolvedValue(mockGeminiResponse);
      (prisma.alert.update as jest.Mock).mockResolvedValue({
        id: 'alert-1',
        aiRecommendation: 'Reroute traffic from Gate B to Gate A.',
      });

      const res = await request(app)
        .get('/api/v1/alerts/alert-1/recommendation')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('recommendation', 'Reroute traffic from Gate B to Gate A.');
      expect(geminiClient.askGemini).toHaveBeenCalledWith(expect.stringContaining('Gate B Transit'));
      expect(geminiClient.askGemini).toHaveBeenCalledWith(expect.stringContaining('Gate A Concourse'));
      expect(prisma.alert.update).toHaveBeenCalled();
    });
  });
});
