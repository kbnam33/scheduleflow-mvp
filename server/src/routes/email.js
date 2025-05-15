const express = require('express');
const router = express.Router();
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 requests per windowMs
  message: 'Too many email processing requests, please try again later.'
});

// Process email with AI
router.post('/process', emailLimiter, async (req, res) => {
  const startTime = Date.now();
  try {
    const userId = req.user?.id;
    const { email } = req.body;

    if (!userId) {
      logger.warn('Unauthorized email processing attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!email || !email.sender || !email.subject || !email.body) {
      logger.warn('Invalid email data received', { userId });
      return res.status(400).json({ error: 'Valid email data is required' });
    }

    logger.ai.request('Process email', { 
      userId, 
      emailSubject: email.subject,
      sender: email.sender
    });
    
    const response = await AIService.processEmail(userId, email);
    
    const duration = Date.now() - startTime;
    logger.ai.response('Email processed', { 
      userId, 
      duration,
      hasError: !!response.error,
      suggestedActions: response.suggestedActions?.length || 0,
      emailSubject: email.subject
    });
    
    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
      userId: req.user?.id,
      duration,
      endpoint: '/email/process',
      emailSubject: req.body.email?.subject
    });
    
    res.status(500).json({ 
      error: 'Failed to process email',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 