const request = require('supertest');
const app = require('../../app');
const { generateTestToken, mockEmail } = require('../utils/testUtils');

describe('Email Routes', () => {
  let authToken;

  beforeEach(() => {
    authToken = generateTestToken();
  });

  describe('POST /api/email/process', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/email/process')
        .send(mockEmail);

      expect(response.status).toBe(401);
    });

    it('should process email with valid token and data', async () => {
      const response = await request(app)
        .post('/api/email/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockEmail);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('actionItems');
      expect(Array.isArray(response.body.actionItems)).toBe(true);
    });

    it('should return 400 with invalid email data', async () => {
      const response = await request(app)
        .post('/api/email/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' });

      expect(response.status).toBe(400);
    });

    it('should handle empty email content', async () => {
      const response = await request(app)
        .post('/api/email/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...mockEmail, content: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests after threshold', async () => {
      const requests = Array(100).fill().map(() => 
        request(app)
          .post('/api/email/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(mockEmail)
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
}); 