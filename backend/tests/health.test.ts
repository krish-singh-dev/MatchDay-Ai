import request from 'supertest';
import app from '../src/app';

describe('GET /api/v1/health', () => {
  it('should return 200 and status healthy', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
  });
});
