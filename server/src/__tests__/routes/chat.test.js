const request = require('supertest');
const app = require('../../app');
const { generateTestToken, mockChatMessage } = require('../utils/testUtils');

describe('Chat Routes', () => {
  let authToken;

  beforeEach(() => {
    authToken = generateTestToken();
  });

  describe('POST /api/chat', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send(mockChatMessage);

      expect(response.status).toBe(401);
    });

    it('should process chat message with valid token', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockChatMessage);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('suggestedActions');
      expect(Array.isArray(response.body.suggestedActions)).toBe(true);
    });

    it('should return 400 with invalid message format', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'format' });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests after threshold', async () => {
      const requests = Array(100).fill().map(() => 
        request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send(mockChatMessage)
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
}); 