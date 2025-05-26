// server/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = 'production' === process.env.NODE_ENV ? null : require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth'); 
const chatRoutes = require('./routes/chat');
const taskRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/email');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/user'); // Correctly imported

// Create Express app
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

app.use('/api/auth', authRoutes);

const apiRateLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000, 
  max: process.env.NODE_ENV === 'test' ? 100 : 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) return true;
    if (req.path === '/health' || req.path.startsWith('/api/auth')) return true;
    return false;
  },
  keyGenerator: (req) => req.user ? req.user.id : req.ip,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, userId: req.user?.id, path: req.path });
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

app.use('/api', apiRateLimiter);
app.use('/api', authMiddleware); 

// Protected API routes
app.use('/api/chat', chatRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/ai', aiRoutes);
// REASONING: Mounting userRoutes at /api/users to match frontend call /api/users/me/preferences
app.use('/api/users', userRoutes); 

app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    logger.warn('Validation Error', { error: err.message, path: req.path, details: err.details });
    return res.status(400).json({ error: 'Validation Error', details: err.message });
  }
  next(err);
});

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

app.use('/api', (req, res) => {
  logger.warn('API Route not found', { path: req.path, method: req.method, ip: req.ip, userId: req.user?.id });
  res.status(404).json({ error: 'API route not found' });
});

app.use((req, res) => {
    logger.warn('Non-API Route not found', { path: req.path, method: req.method, ip: req.ip });
    res.status(404).send('Resource not found');
});

module.exports = app;