const request = require('supertest');
const { 
  app, 
  authToken, 
  mockTask, 
  makeRateLimitRequests,
  authenticatedRequest,
  validateResponse,
  cleanup
} = require('../utils/testUtils');

describe('Tasks Routes', () => {
  afterEach(async () => {
    await cleanup();
  });

  describe('GET /api/tasks/suggest/:projectId', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/tasks/suggest/test-project')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return task suggestions with valid token', async () => {
      const response = await authenticatedRequest('get')('/api/tasks/suggest/test-project');
      const body = validateResponse(response);
      
      expect(body).toHaveProperty('suggestions');
      expect(Array.isArray(body.suggestions)).toBe(true);
    });

    it('should handle server errors gracefully', async () => {
      // Mock AIService to throw an error
      jest.spyOn(require('../../services/ai-service'), 'generateTaskSuggestions')
        .mockRejectedValueOnce(new Error('Test error'));

      const response = await authenticatedRequest('get')('/api/tasks/suggest/test-project');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/tasks/confirm/:taskId', () => {
    const validTask = { ...mockTask, status: 'confirmed' };
    const invalidTask = { status: 'invalid' };
    const incompleteTask = { title: 'Test task' };

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/tasks/confirm/test-task')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should confirm task with valid token and data', async () => {
      const response = await authenticatedRequest('post')('/api/tasks/confirm/test-task', validTask);
      const body = validateResponse(response);
      
      expect(body).toHaveProperty('success', true);
    });

    it('should return 400 with invalid task data', async () => {
      const response = await authenticatedRequest('post')('/api/tasks/confirm/test-task', invalidTask);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate required task fields', async () => {
      const response = await authenticatedRequest('post')('/api/tasks/confirm/test-task', incompleteTask);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/required/i);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests after threshold', async () => {
      const makeRequests = async (count) => {
        const requests = Array(count).fill().map(() => 
          authenticatedRequest('get')('/api/tasks/suggest/test-project', null, 1, { 'x-test-ratelimit': '1' })
        );
        return Promise.all(requests);
      };

      // Make requests up to the limit (5 requests per second in test)
      const responses = await makeRequests(6);
      
      // The last request should be rate limited
      const limitedResponse = responses[responses.length - 1];
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toHaveProperty('error');
      expect(limitedResponse.body.error).toMatch(/Too many requests/i);
    });

    it('should reset rate limit after window', async () => {
      // Wait for rate limit window to reset (1 second in test)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const response = await authenticatedRequest('get')('/api/tasks/suggest/test-project', null, 1, { 'x-test-ratelimit': '1' });
      expect(response.status).toBe(200);
    });
  });
}); 