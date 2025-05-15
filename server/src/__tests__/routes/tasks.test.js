const request = require('supertest');
const app = require('../../app');
const { generateTestToken, mockTask } = require('../utils/testUtils');

describe('Tasks Routes', () => {
  let authToken;

  beforeEach(() => {
    authToken = generateTestToken();
  });

  describe('GET /api/tasks/suggestions', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/tasks/suggestions');

      expect(response.status).toBe(401);
    });

    it('should return task suggestions with valid token', async () => {
      const response = await request(app)
        .get('/api/tasks/suggestions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });
  });

  describe('POST /api/tasks/confirm', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/tasks/confirm')
        .send(mockTask);

      expect(response.status).toBe(401);
    });

    it('should confirm task with valid token and data', async () => {
      const response = await request(app)
        .post('/api/tasks/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockTask);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('taskId');
    });

    it('should return 400 with invalid task data', async () => {
      const response = await request(app)
        .post('/api/tasks/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests after threshold', async () => {
      const requests = Array(100).fill().map(() => 
        request(app)
          .get('/api/tasks/suggestions')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
}); 