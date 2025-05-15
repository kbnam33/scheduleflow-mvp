const express = require('express');
const router = express.Router();
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const taskLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 requests per windowMs
  message: 'Too many task suggestions requested, please try again later.'
});

// Get AI task suggestions for a project
router.get('/suggest/:projectId', taskLimiter, async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      logger.warn('Unauthorized task suggestion attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.ai.request('Generate task suggestions', { userId, projectId });
    
    const suggestions = await AIService.generateTaskSuggestions(userId, projectId);
    
    const duration = Date.now() - startTime;
    logger.ai.response('Task suggestions generated', { 
      userId, 
      projectId,
      duration,
      suggestionCount: suggestions.length
    });
    
    res.json({ suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
      userId: req.user?.id,
      projectId: req.params.projectId,
      duration,
      endpoint: '/tasks/suggest'
    });
    
    res.status(500).json({ 
      error: 'Failed to generate task suggestions',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Confirm AI-suggested task
router.post('/confirm/:taskId', taskLimiter, async (req, res) => {
  const startTime = Date.now();
  try {
    const { taskId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      logger.warn('Unauthorized task confirmation attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('Task confirmation request', { userId, taskId });
    
    // TODO: Implement task confirmation logic
    // This would typically update the task status in the database
    
    const duration = Date.now() - startTime;
    logger.info('Task confirmed', { 
      userId, 
      taskId,
      duration
    });
    
    res.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Task confirmation failed', { 
      userId: req.user?.id,
      taskId: req.params.taskId,
      duration,
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to confirm task',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 