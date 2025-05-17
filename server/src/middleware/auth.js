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
      throw new AuthError('No token provided');
    }

    const token = validateToken(authHeader.split(' ')[1]);
    
    // Special handling for test environment
    if (process.env.NODE_ENV === 'test' && token === 'test-token') {
      req.user = { 
        id: 'test-user-id', 
        email: 'test@example.com',
        role: 'authenticated'
      };
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Validate decoded token structure
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
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError('Token expired', 401);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      logger.warn('Authentication failed', {
        error: error.message,
        ip: req.ip,
        path: req.path
      });
      return res.status(error.status).json({ error: error.message });
    }

    logger.error('Auth middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      path: req.path
    });
    
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = authMiddleware; 