const jwt = require('jsonwebtoken');

const generateTestToken = (userId = 'test-user-id') => {
  return jwt.sign(
    { sub: userId, role: 'authenticated' },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
};

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'authenticated'
};

const mockChatMessage = {
  content: 'Test message',
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
  subject: 'Test email',
  content: 'Test email content',
  sender: 'sender@example.com',
  receivedAt: new Date().toISOString()
};

module.exports = {
  generateTestToken,
  mockUser,
  mockChatMessage,
  mockTask,
  mockFocusBlock,
  mockEmail
}; 