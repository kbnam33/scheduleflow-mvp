const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Generate test token for authentication
const generateTestToken = () => {
  return jwt.sign(
    { 
      sub: 'test-user-id',
      email: 'test@example.com',
      role: 'authenticated'
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Mock data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'authenticated'
};

const mockChatMessage = {
  message: 'Test message',
  role: 'user',
  timestamp: new Date().toISOString()
};

const mockTask = {
  title: 'Test task',
  description: 'Test task description',
  priority: 'medium',
  dueDate: new Date().toISOString()
};

const mockFocusBlock = {
  startTime: new Date().toISOString(),
  duration: 60,
  taskId: 'test-task-id',
  type: 'focus'
};

const mockEmail = {
  sender: 'sender@example.com',
  subject: 'Test email',
  body: 'Test email content',
  receivedAt: new Date().toISOString()
};

// Helper function to make authenticated requests with retry
const authenticatedRequest = (method) => async (url, data = null, retries = 3, headers = {}) => {
  const token = generateTestToken();
  let req = request(app)[method](url)
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json');

  // Apply custom headers
  for (const [key, value] of Object.entries(headers)) {
    req = req.set(key, value);
  }

  if (data && (method === 'post' || method === 'put')) {
    req.send(data);
  }

  try {
    return await req;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return authenticatedRequest(method)(url, data, retries - 1, headers);
    }
    throw error;
  }
};

// Helper function to make rate limit test requests with better error handling
const makeRateLimitRequests = async (endpoint, method = 'get', data = null) => {
  const batchSize = 10; // Process requests in smaller batches
  const totalRequests = 100;
  const results = [];

  for (let i = 0; i < totalRequests; i += batchSize) {
    const batch = Array(Math.min(batchSize, totalRequests - i))
      .fill()
      .map(() => {
        const req = request(app)[method](endpoint)
          .set('Authorization', `Bearer ${generateTestToken()}`)
          .set('Accept', 'application/json');

        if (data && (method === 'post' || method === 'put')) {
          return req.send(data);
        }
        return req;
      });

    try {
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : r.reason));
    } catch (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error);
    }

    // Small delay between batches to prevent overwhelming the server
    if (i + batchSize < totalRequests) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
};

// Helper function to clean up after tests
const cleanup = async () => {
  // Add any cleanup logic here (e.g., closing database connections)
  await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to allow pending requests to complete
};

// Helper function to validate response
const validateResponse = (response, expectedStatus = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  return response.body;
};

module.exports = {
  app,
  generateTestToken,
  mockUser,
  mockChatMessage,
  mockTask,
  mockFocusBlock,
  mockEmail,
  authenticatedRequest,
  makeRateLimitRequests,
  cleanup,
  validateResponse,
  authToken: generateTestToken()
}; 