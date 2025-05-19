// In auth.js
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Create a Supabase client for JWT verification
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
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
      // Verify using Supabase's JWT approach
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        throw new AuthError('Invalid token');
      }
      
      if (!user) {
        throw new AuthError('User not found');
      }
      
      req.user = {
        id: user.id,
        email: user.email,
        role: 'authenticated'
      };
      
      next();
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Authentication failed');
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