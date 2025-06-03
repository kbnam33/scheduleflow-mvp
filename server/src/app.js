// FILENAME: server/src/app.js
// REASONING: Mounting new route files events.js and suggestions.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = 'production' === process.env.NODE_ENV ? null : require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth'); 
const chatRoutes = require('./routes/chat'); // Note: original app.js had this, but /api/ai/chat seems primary
const taskRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/email');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/user');
const eventRoutes = require('./routes/events'); // <-- NEW
const suggestionRoutes = require('./routes/suggestions'); // <-- NEW

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Added OPTIONS for preflight
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Test-RateLimit'], // Added X-Test-RateLimit
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (morgan) {
    app.use(morgan('dev', {
        stream: {
            write: (message) => {
            logger.info(message.trim());
            }
        }
    }));
}

app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes); // Public auth routes

// Rate limiter for all /api routes (except /api/auth and /health)
const apiRateLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000, 
  max: process.env.NODE_ENV === 'test' ? 100 : 100, // Default limit
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) return true;
    if (req.path === '/health' || req.path.startsWith('/api/auth') || req.path.startsWith('/api/email/inbound-webhook') /* Webhook might have its own limiter */) return true;
    return false;
  },
  keyGenerator: (req) => req.user?.id || req.ip, // Prioritize userId if authenticated
  handler: (req, res, next, options) => { // Ensure next is called or response is sent
    logger.warn('Rate limit exceeded', { ip: req.ip, userId: req.user?.id, path: req.path });
    res.status(options.statusCode).json(options.message);
  }
});

app.use('/api', apiRateLimiter); // Apply general rate limiter
app.use('/api', authMiddleware);  // Apply auth to all subsequent /api routes

// Protected API routes
app.use('/api/ai', aiRoutes); // Mount AI routes which includes its own more specific limiter + chat
// app.use('/api/chat', chatRoutes); // This seems redundant if /api/ai/chat is used. Consolidate chat logic.
app.use('/api/tasks', taskRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/email', emailRoutes); // Contains /process (authed) and /inbound-webhook (potentially public/different auth)
app.use('/api/users', userRoutes); 
app.use('/api/events', eventRoutes); // <-- NEW
app.use('/api/suggestions', suggestionRoutes); // <-- NEW

// Centralized Validation Error Handler
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError' || (err.isJoi && err.name === 'ValidationError')) { // Added check for Joi
    logger.warn('Validation Error', { error: err.message, path: req.path, details: err.details || err.errors });
    return res.status(400).json({ error: 'Validation Error', details: err.message, specificErrors: err.details || err.errors });
  }
  next(err);
});

// General Error Handler
app.use((err, req, res, next) => {
  const duration = Date.now() - (req.startTime || Date.now());
  logger.error('Unhandled error caught by general error handler', {
    error: err.message, status: err.status,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path, method: req.method, duration, userId: req.user?.id, ip: req.ip
  });
  const errorResponse = {
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { messageDetails: err.message })
  };
  res.status(err.status || 500).json(errorResponse);
});

// 404 Handler for API routes
app.use('/api', (req, res, next) => { // next is important for it not to be the final handler
  logger.warn('API Route not found', { path: req.path, method: req.method, ip: req.ip, userId: req.user?.id });
  res.status(404).json({ error: 'API route not found' });
});

// Catch-all 404 for non-API routes (should be last)
app.use((req, res) => {
    logger.warn('Non-API Route not found', { path: req.path, method: req.method, ip: req.ip });
    res.status(404).send('Resource not found');
});

module.exports = app;