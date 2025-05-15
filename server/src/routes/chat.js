const express = require('express');
const router = express.Router();
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Process chat message
router.post('/', chatLimiter, async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, context } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      logger.warn('Unauthorized chat attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message) {
      logger.warn('Empty message received', { userId });
      return res.status(400).json({ error: 'Message is required' });
    }

    logger.ai.request(message, { userId, context });
    
    const response = await AIService.processChat(userId, message, context);
    
    const duration = Date.now() - startTime;
    logger.ai.response(response.message, { 
      userId, 
      duration,
      hasError: !!response.error,
      suggestedActions: response.suggestedActions?.length || 0
    });
    
    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
      userId: req.user?.id,
      duration,
      endpoint: '/chat',
      message: req.body.message
    });
    
    res.status(500).json({ 
      error: 'Failed to process chat message',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 