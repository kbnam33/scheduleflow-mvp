// Import Jest globals
const { afterEach, jest } = require('@jest/globals');

// Load environment variables for testing
require('dotenv').config({ path: '.env.test' });

// Mock logger to prevent actual file writing during tests
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  ai: {
    request: jest.fn(),
    response: jest.fn(),
    error: jest.fn()
  }
};

jest.mock('../utils/logger', () => mockLogger);

// Mock Supabase config
jest.mock('../config/supabase', () => ({
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null
    })
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockResolvedValue({ data: [], error: null })
}));

// Mock AI service
jest.mock('../services/ai-service', () => {
  const { 
    mockAIResponse, 
    mockTaskSuggestions, 
    mockFocusBlockSuggestions, 
    mockEmailAnalysis 
  } = require('./mocks/ai-service.mock');

  return {
    processChat: jest.fn().mockResolvedValue(mockAIResponse),
    generateTaskSuggestions: jest.fn().mockResolvedValue(mockTaskSuggestions),
    suggestFocusBlocks: jest.fn().mockResolvedValue(mockFocusBlockSuggestions),
    processEmail: jest.fn().mockResolvedValue(mockEmailAnalysis)
  };
});

// Mock OpenAI client
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        })
      }
    }
  }))
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
}); 