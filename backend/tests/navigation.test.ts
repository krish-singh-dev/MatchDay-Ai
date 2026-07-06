import request from 'supertest';
import app from '../src/app';
import * as stadiumGraph from '../src/config/stadiumGraph';

describe('Navigation Routes /api/v1/navigation', () => {
  describe('GET /zones', () => {
    it('returns the list of stadium zones', async () => {
      const res = await request(app).get('/api/v1/navigation/zones');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('x');
      expect(res.body[0]).toHaveProperty('y');
    });
  });

  describe('POST /route', () => {
    it('calculates route between gate-a and concessions successfully', async () => {
      const res = await request(app)
        .post('/api/v1/navigation/route')
        .send({
          startZoneId: 'gate-a',
          endZoneId: 'concessions',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('path');
      expect(res.body).toHaveProperty('directions');
      expect(res.body).toHaveProperty('coordinates');
      expect(res.body.path[0]).toBe('gate-a');
      expect(res.body.path[res.body.path.length - 1]).toBe('concessions');
      expect(res.body.directions.length).toBe(res.body.path.length - 1);
    });

    it('returns 400 on missing parameters', async () => {
      const res = await request(app)
        .post('/api/v1/navigation/route')
        .send({
          startZoneId: 'gate-a',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing startZoneId or endZoneId parameters');
    });

    it('returns 404 if no route found', async () => {
      // Mock findRoute to return null
      const originalFindRoute = stadiumGraph.findRoute;
      (stadiumGraph as any).findRoute = () => null;

      const res = await request(app)
        .post('/api/v1/navigation/route')
        .send({
          startZoneId: 'gate-a',
          endZoneId: 'transit-exit',
        });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'No route found between the selected zones');

      // Restore
      (stadiumGraph as any).findRoute = originalFindRoute;
    });
  });
});
