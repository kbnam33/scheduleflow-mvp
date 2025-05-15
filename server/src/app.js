const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');

// Import routes
const chatRoutes = require('./routes/chat');
const taskRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/email');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected API routes
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/calendar', authMiddleware, calendarRoutes);
app.use('/api/email', authMiddleware, emailRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  const duration = Date.now() - req.startTime;
  
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    duration,
    userId: req.user?.id
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app; 