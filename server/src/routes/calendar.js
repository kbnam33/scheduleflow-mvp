const express = require('express');
const router = express.Router();
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const calendarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 requests per windowMs
  message: 'Too many calendar suggestions requested, please try again later.'
});

// Get AI focus block suggestions
router.get('/suggest-focus', calendarLimiter, async (req, res) => {
  const startTime = Date.now();
  try {
    const userId = req.user?.id;
    const { startDate, endDate } = req.query;

    if (!userId) {
      logger.warn('Unauthorized focus block suggestion attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!startDate || !endDate) {
      logger.warn('Missing date range for focus suggestions', { userId });
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    logger.ai.request('Generate focus block suggestions', { 
      userId, 
      startDate, 
      endDate 
    });
    
    const suggestions = await AIService.suggestFocusBlocks(
      userId,
      new Date(startDate),
      new Date(endDate)
    );
    
    const duration = Date.now() - startTime;
    logger.ai.response('Focus block suggestions generated', { 
      userId, 
      duration,
      suggestionCount: suggestions.length,
      dateRange: { startDate, endDate }
    });
    
    res.json({ suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
      userId: req.user?.id,
      duration,
      endpoint: '/calendar/suggest-focus',
      dateRange: req.query
    });
    
    res.status(500).json({ 
      error: 'Failed to generate focus block suggestions',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get AI meeting prep suggestions
router.get('/suggest-prep', calendarLimiter, async (req, res) => {
  const startTime = Date.now();
  try {
    const userId = req.user?.id;

    if (!userId) {
      logger.warn('Unauthorized meeting prep suggestion attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.ai.request('Generate meeting prep suggestions', { userId });
    
    const suggestions = await AIService.suggestMeetingPrepBlocks(userId);
    
    const duration = Date.now() - startTime;
    logger.ai.response('Meeting prep suggestions generated', { 
      userId, 
      duration,
      suggestionCount: suggestions.length
    });
    
    res.json({ suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
      userId: req.user?.id,
      duration,
      endpoint: '/calendar/suggest-prep'
    });
    
    res.status(500).json({ 
      error: 'Failed to generate meeting prep suggestions',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 