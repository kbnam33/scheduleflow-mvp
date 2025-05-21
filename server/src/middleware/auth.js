// server/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const validateToken = (token) => {
  if (!token) {
    throw new AuthError('No token provided');
  }
  if (typeof token !== 'string') {
    throw new AuthError('Invalid token format');
  }
  return token;
};

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('No token provided or Bearer scheme missing');
    }

    const token = validateToken(authHeader.split(' ')[1]);
    
    // REASONING: Using a valid UUID for test-user-id to match Supabase schema.
    // Replace 'YOUR_VALID_TEST_USER_UUID_HERE' with an actual UUID from your users table.
    const actualTestUserId = '5d02f972-ecd0-45ac-a3e4-b09fa7a56bd6'; // <--- PASTE YOUR GENERATED UUID HERE

    if ((process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') && token === 'test-token') {
      req.user = { 
        id: actualTestUserId, // <--- USE THE VARIABLE HERE
        email: 'test@example.com', // You can adjust this if needed
        role: 'authenticated'
      };
      logger.info('Using test-token for development/test environment', { userId: req.user.id, path: req.path });
      return next();
    }

    try {
      if (!process.env.JWT_SECRET) {
        logger.error('JWT_SECRET is not defined in environment variables.');
        throw new AuthError('Authentication configuration error', 500);
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (!decoded.sub || !decoded.role) {
        throw new AuthError('Invalid token structure');
      }

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      if (error instanceof AuthError) throw error;

      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError('Token expired', 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('JWT Verification Error', { error: error.message, tokenUsed: token ? 'Exists' : 'Not provided', path: req.path });
        throw new AuthError('Invalid token', 401);
      }
      throw error;
    }
  } catch (error) {
    const logDetails = {
      errorMessage: error.message,
      errorStatus: error.status,
      errorName: error.name,
      ip: req.ip,
      path: req.path
    };
    if (error instanceof AuthError) {
      logger.warn('Authentication failed', logDetails);
      return res.status(error.status).json({ error: error.message });
    }

    logger.error('Critical auth middleware error', { ...logDetails, stack: error.stack });
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = authMiddleware;