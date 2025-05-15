const request = require('supertest');
const app = require('../../app');
const { generateTestToken, mockFocusBlock } = require('../utils/testUtils');

describe('Calendar Routes', () => {
  let authToken;

  beforeEach(() => {
    authToken = generateTestToken();
  });

  describe('GET /api/calendar/focus-blocks', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/calendar/focus-blocks');

      expect(response.status).toBe(401);
    });

    it('should return focus block suggestions with valid token', async () => {
      const response = await request(app)
        .get('/api/calendar/focus-blocks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });
  });

  describe('GET /api/calendar/meeting-prep', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/calendar/meeting-prep');

      expect(response.status).toBe(401);
    });

    it('should return meeting preparation suggestions with valid token', async () => {
      const response = await request(app)
        .get('/api/calendar/meeting-prep')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });
  });

  describe('POST /api/calendar/focus-blocks/confirm', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/calendar/focus-blocks/confirm')
        .send(mockFocusBlock);

      expect(response.status).toBe(401);
    });

    it('should confirm focus block with valid token and data', async () => {
      const response = await request(app)
        .post('/api/calendar/focus-blocks/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockFocusBlock);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('blockId');
    });

    it('should return 400 with invalid focus block data', async () => {
      const response = await request(app)
        .post('/api/calendar/focus-blocks/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests after threshold', async () => {
      const requests = Array(100).fill().map(() => 
        request(app)
          .get('/api/calendar/focus-blocks')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
}); 