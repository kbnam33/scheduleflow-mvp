const request = require('supertest');
const app = require('../../app');
const { createTestUser, getAuthToken } = require('../utils/testUtils');
const AIService = require('../../services/ai-service');

// Mock the AI service
jest.mock('../../services/ai-service');

describe('AI Routes', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/ai/chat', () => {
    it('should process chat message successfully', async () => {
      const mockResponse = {
        message: 'Test response',
        suggestedActions: [{ type: 'CREATE_TASK', description: 'Create a task' }]
      };
      AIService.processChat.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Test message' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(AIService.processChat).toHaveBeenCalledWith(testUser.id, 'Test message');
    });

    it('should return 400 if message is missing', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message is required');
    });

    it('should handle AI service errors', async () => {
      AIService.processChat.mockRejectedValue(new Error('AI service error'));

      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Test message' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to process chat message');
    });
  });

  describe('POST /api/ai/tasks/suggest', () => {
    it('should generate task suggestions successfully', async () => {
      const mockSuggestions = [
        {
          title: 'Test task',
          description: 'Test description',
          priority: 'high',
          estimatedHours: 2
        }
      ];
      AIService.generateTaskSuggestions.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .post('/api/ai/tasks/suggest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'test-project' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ suggestions: mockSuggestions });
      expect(AIService.generateTaskSuggestions).toHaveBeenCalledWith(testUser.id, 'test-project');
    });

    it('should return 400 if projectId is missing', async () => {
      const response = await request(app)
        .post('/api/ai/tasks/suggest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Project ID is required');
    });
  });

  describe('POST /api/ai/focus-blocks/suggest', () => {
    it('should generate focus block suggestions successfully', async () => {
      const mockSuggestions = [
        {
          title: 'Focus block',
          startTime: '2024-03-20T10:00:00Z',
          endTime: '2024-03-20T11:00:00Z',
          priority: 'high'
        }
      ];
      AIService.suggestFocusBlocks.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .post('/api/ai/focus-blocks/suggest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startDate: '2024-03-20T00:00:00Z',
          endDate: '2024-03-20T23:59:59Z'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ suggestions: mockSuggestions });
      expect(AIService.suggestFocusBlocks).toHaveBeenCalledWith(
        testUser.id,
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should return 400 if dates are missing', async () => {
      const response = await request(app)
        .post('/api/ai/focus-blocks/suggest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Start date and end date are required');
    });
  });

  describe('POST /api/ai/email/process', () => {
    it('should process email successfully', async () => {
      const mockAnalysis = {
        summary: 'Test summary',
        actionItems: [{ title: 'Test action', priority: 'high' }]
      };
      AIService.processEmail.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/ai/email/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sender: 'test@example.com',
          subject: 'Test Subject',
          body: 'Test email body'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnalysis);
      expect(AIService.processEmail).toHaveBeenCalledWith(testUser.id, {
        sender: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test email body'
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/ai/email/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sender: 'test@example.com'
          // Missing subject and body
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Sender, subject, and body are required');
    });
  });

  describe('POST /api/ai/meeting/prep', () => {
    it('should generate meeting prep suggestions successfully', async () => {
      const mockSuggestions = {
        preparationTasks: [{ title: 'Prep task', priority: 'high' }],
        focusBlocks: [{ title: 'Prep block', type: 'preparation' }]
      };
      AIService.suggestMeetingPrep.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .post('/api/ai/meeting/prep')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          meetingData: {
            id: 'test-meeting',
            title: 'Test Meeting'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSuggestions);
      expect(AIService.suggestMeetingPrep).toHaveBeenCalledWith(
        testUser.id,
        { id: 'test-meeting', title: 'Test Meeting' }
      );
    });

    it('should return 400 if meeting data is missing', async () => {
      const response = await request(app)
        .post('/api/ai/meeting/prep')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Meeting data with ID is required');
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests after threshold', async () => {
      // Make 6 requests (5 is the limit in test environment)
      const requests = Array(6).fill().map(() =>
        request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .set('x-test-ratelimit', '1')
          .send({ message: 'Test message' })
      );

      const responses = await Promise.all(requests);
      
      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(200);
      }
      
      // 6th request should be rate limited
      expect(responses[5].status).toBe(429);
    });

    it('should reset rate limit after window', async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .set('x-test-ratelimit', '1')
          .send({ message: 'Test message' });
      }

      // Wait for rate limit window to reset (1 second in test)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Make another request
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-ratelimit', '1')
        .send({ message: 'Test message' });

      expect(response.status).toBe(200);
    });

    it('should not apply rate limiting without x-test-ratelimit header in test environment', async () => {
      // Make 6 requests without the header
      const requests = Array(6).fill().map(() =>
        request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'Test message' })
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
}); 