// scheduleflow-mvp/server/src/app.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = 'morgan'; // This was a string, should be: const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');

// Import routes
const chatRoutes = require('./routes/chat');
const taskRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/email'); // For processing pasted email text
const aiRoutes = require('./routes/ai');
// const googleAuthRoutes = require('./routes/googleAuthRoutes'); // DEFERRED for MVP

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Corrected Morgan import
const actualMorgan = require('morgan');
app.use(actualMorgan('combined', {
  stream: {
    write: (message) => {
      if (typeof logger.info === 'function') {
        logger.info(message.trim());
      } else {
        console.log(message.trim());
      }
    }
  },
}));

app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// app.use('/api/auth', googleAuthRoutes); // DEFERRED for MVP - Google OAuth specific routes

const apiRateLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 100, // Allow more for testing locally
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path
    });
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

app.use('/api', apiRateLimiter);

const protectedApiRouter = express.Router();
protectedApiRouter.use(authMiddleware);

protectedApiRouter.use('/chat', chatRoutes);
protectedApiRouter.use('/tasks', taskRoutes);
protectedApiRouter.use('/calendar', calendarRoutes);
protectedApiRouter.use('/email', emailRoutes); // For processing pasted/described email text
protectedApiRouter.use('/ai', aiRoutes);

app.use('/api', protectedApiRouter);

app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    logger.warn('Validation Error:', { message: err.message, details: err.details, path: req.path });
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details || err.message
    });
  }
  next(err);
});

app.use((err, req, res, next) => {
  const requestDuration = req.startTime ? Date.now() - req.startTime : 'N/A';
  logger.error('Unhandled error in Express:', {
    error_message: err.message,
    error_stack: err.stack,
    error_status: err.status,
    request_path: req.path,
    request_method: req.method,
    duration_ms: requestDuration,
    user_id: req.user?.id,
    ip_address: req.ip
  });
  const errorResponse = {
    error: 'Internal Server Error',
    message: (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') ? err.message : 'An unexpected error occurred.',
    ...((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && { stack: err.stack })
  };
  res.status(err.status || 500).json(errorResponse);
});

app.use((req, res, next) => {
  logger.warn('Route not found (404):', {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });
  res.status(404).json({ error: 'Not Found', message: `The requested route ${req.originalUrl} does not exist.` });
});

module.exports = app;