const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');

// Import routes
const chatRoutes = require('./routes/chat');
const taskRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/email');
const aiRoutes = require('./routes/ai');

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
    write: (message) => {
      if (typeof logger.info === 'function') {
        logger.info(message.trim());
      }
    }
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

// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000, // 1 second in test, 15 minutes in production
  max: process.env.NODE_ENV === 'test' ? 5 : 100, // 5 requests per second in test, 100 per window in production
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for most tests except explicit rate limit tests
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) return true;
    // Also skip health check
    if (process.env.NODE_ENV === 'test' && req.path === '/health') return true;
    return false;
  },
  keyGenerator: (req) => {
    // Use user ID if available, otherwise use IP
    return req.user ? req.user.id : req.ip;
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path
    });
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

// Apply rate limiter to all routes except health check
app.use('/api', rateLimiter);

// Apply auth middleware to all API routes
app.use('/api', authMiddleware);

// Protected API routes
app.use('/api/chat', chatRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/ai', aiRoutes);

// Validation error handler
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }
  next(err);
});

// Authentication error handler
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid or expired token'
    });
  }
  next(err);
});

// General error handling middleware
app.use((err, req, res, next) => {
  const duration = Date.now() - req.startTime;
  
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    duration,
    userId: req.user?.id,
    ip: req.ip
  });

  // Don't expose internal errors in production
  const errorResponse = {
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      message: err.message,
      stack: err.stack 
    })
  };

  res.status(err.status || 500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });
  
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app; 