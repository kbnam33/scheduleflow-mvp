// scheduleflow-mvp/server/src/app.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth'); // Your existing auth middleware

// Import routes
const chatRoutes = require('./routes/chat');
const taskRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/email');
const aiRoutes = require('./routes/ai');
const googleAuthRoutes = require('./routes/googleAuthRoutes'); // Import the new Google OAuth routes

// Create Express app
const app = express();

// Security middleware
app.use(helmet()); // Helps secure your apps by setting various HTTP headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Control which origins can access your API
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true // If you need to handle cookies or authorization headers with credentials
}));

// Request parsing
app.use(express.json()); // Parses incoming requests with JSON payloads
app.use(express.urlencoded({ extended: true })); // Parses incoming requests with URL-encoded payloads

// Logging middleware (Morgan)
// Log HTTP requests to the console (or a stream) for debugging and monitoring
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      // Morgan logs to info level, ensure logger.info is a function
      if (typeof logger.info === 'function') {
        logger.info(message.trim());
      } else {
        console.log(message.trim()); // Fallback to console.log if logger.info is not available
      }
    }
  },
  // Optionally skip logging for health checks or other noisy endpoints
  // skip: (req, res) => req.path === '/health' && process.env.NODE_ENV !== 'development'
}));

// Request timing middleware (simple example)
app.use((req, res, next) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    // Log request duration, you might want to use logger.debug for less verbosity
    // logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// --- PUBLIC ROUTES (No Auth Required) ---

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Google OAuth Routes (public for initiation and callback)
// These routes handle the redirection to Google and the callback from Google.
// They should generally not be protected by your standard API authMiddleware initially,
// as Google needs to be able to redirect the user back.
// The callback handler itself will then process the authorization code.
app.use('/api/auth', googleAuthRoutes); // Mounted at /api/auth, so URLs will be /api/auth/google and /api/auth/google/callback

// --- END PUBLIC ROUTES ---


// --- RATE LIMITING & AUTHENTICATION FOR PROTECTED API ROUTES ---

// General API rate limiter
const apiRateLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000, // 1 sec in test, 15 mins in prod
  max: process.env.NODE_ENV === 'test' ? 15 : 100, // High for tests, adjust for prod
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for tests not specifically targeting it
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) return true;
    // Skip for health check if desired
    // if (req.path === '/health') return true; // Health is already public, no need to skip here
    return false;
  },
  keyGenerator: (req) => {
    // Use user ID if available (after auth), otherwise use IP
    return req.user ? req.user.id : req.ip;
  },
  handler: (req, res /*, next, options*/) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id, // req.user might not be set yet if limiter is before auth
      path: req.path
    });
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

// Apply the general rate limiter to all routes starting with /api
// Note: If '/api/auth' (for Google OAuth) should NOT be rate-limited this way,
// ensure it's mounted BEFORE this apiRateLimiter or this limiter has specific skips.
// For now, Google OAuth routes are under /api/auth, which is fine if the rate limit is generous.
app.use('/api', apiRateLimiter);

// Apply authentication middleware to all /api routes that need protection
// IMPORTANT: This authMiddleware is for YOUR app's users (e.g., validating JWTs issued by your app/Supabase).
// It should NOT block the /api/auth/google/callback route.
// One way to handle this is to apply authMiddleware more granularly or make it conditional.
// For simplicity, let's assume your authMiddleware checks for a token and if not present,
// it doesn't immediately reject but allows routes like the callback to proceed if they don't strictly require req.user.
// OR, better, apply authMiddleware only to specific protected route groups.

// Protected API routes - Auth middleware will be applied here
const protectedApiRouter = express.Router();
protectedApiRouter.use(authMiddleware); // Apply auth to all routes defined on protectedApiRouter

protectedApiRouter.use('/chat', chatRoutes);
protectedApiRouter.use('/tasks', taskRoutes);
protectedApiRouter.use('/calendar', calendarRoutes);
protectedApiRouter.use('/email', emailRoutes);
protectedApiRouter.use('/ai', aiRoutes); // General AI routes

// Mount the protected router
app.use('/api', protectedApiRouter);


// --- ERROR HANDLING MIDDLEWARE (Should be last) ---

// Custom Validation Error Handler (Example - if you use a validation library that throws 'ValidationError')
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') { // Customize for your validation library
    logger.warn('Validation Error:', { message: err.message, details: err.details, path: req.path });
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details || err.message
    });
  }
  next(err); // Pass to next error handler if not a validation error
});

// General error handling middleware
app.use((err, req, res, next) => {
  const requestDuration = req.startTime ? Date.now() - req.startTime : 'N/A';
  
  logger.error('Unhandled error in Express:', {
    error_message: err.message,
    error_stack: err.stack,
    error_status: err.status,
    request_path: req.path,
    request_method: req.method,
    duration_ms: requestDuration,
    user_id: req.user?.id, // If authMiddleware added user to req
    ip_address: req.ip
  });

  // Avoid exposing internal error details in production
  const errorResponse = {
    error: 'Internal Server Error',
    message: (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') ? err.message : 'An unexpected error occurred.',
    ...( (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && { stack: err.stack } )
  };
  
  res.status(err.status || 500).json(errorResponse);
});

// 404 Not Found Handler (if no routes matched)
app.use((req, res, next) => {
  logger.warn('Route not found (404):', {
    path: req.originalUrl, // Use originalUrl to see the full path
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });
  
  res.status(404).json({ error: 'Not Found', message: `The requested route ${req.originalUrl} does not exist.` });
});

module.exports = app;