// scheduleflow-mvp/server/src/routes/ai.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth'); // Correctly import the middleware
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');

// Rate limiter for AI endpoints
const aiLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 50, // Adjusted for potentially more test calls
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many AI requests, please try again later.' },
});

router.use(aiLimiter);
router.use(authMiddleware); // Apply auth to all AI routes

/**
 * @route POST /api/ai/chat
 * @desc Process a chat message and get AI response, potentially creating tasks.
 * @access Private
 */
router.post('/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, chatHistory } = req.body; 
    const userId = req.user.id;

    if (!message) {
      logger.warn('Empty message received for AI chat', { userId });
      return res.status(400).json({ error: 'Message is required' });
    }

    logger.ai.request(`AI Chat request for user ${userId}`, { message, chatHistoryLength: chatHistory?.length });

    const response = await AIService.processChat(userId, message, chatHistory);

    const duration = Date.now() - startTime;
    logger.ai.response('AI Chat response', { 
      userId, 
      duration,
      hasError: !!response.error,
    });

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
      userId: req.user?.id,
      duration,
      endpoint: '/api/ai/chat',
      message: req.body.message
    });
    res.status(500).json({ 
      error: 'Failed to process chat message with AI',
      message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/ai/tasks/suggest
 * @desc Generate task suggestions for a project
 * @access Private
 */
router.post('/tasks/suggest', async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, projectBrief } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    logger.ai.request('AI Task Suggestion request', { userId, projectId, projectBriefExists: !!projectBrief });
    const suggestions = await AIService.generateTaskSuggestions(userId, projectId, projectBrief);
    const duration = Date.now() - startTime;
    logger.ai.response('AI Task Suggestions generated', { userId, projectId, suggestionCount: suggestions.length, duration });

    res.json({ suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
        userId: req.user?.id, 
        projectId: req.body.projectId, 
        duration, 
        endpoint: '/api/ai/tasks/suggest' 
    });
    res.status(500).json({ 
        error: 'Failed to generate task suggestions',
        message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/ai/focus-blocks/suggest
 * @desc Generate focus block suggestions
 * @access Private
 */
router.post('/focus-blocks/suggest', async (req, res) => {
  const startTime = Date.now();
  try {
    const { startDate, endDate } = req.body;
    const userId = req.user.id;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format for start or end date.' });
    }

    logger.ai.request('AI Focus Block Suggestion request', { userId, startDate, endDate });
    const suggestions = await AIService.suggestFocusBlocks(
      userId,
      parsedStartDate,
      parsedEndDate
    );
    const duration = Date.now() - startTime;
    logger.ai.response('AI Focus Blocks generated', { userId, suggestionCount: suggestions.length, duration });

    res.json({ suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
        userId: req.user?.id, 
        dates: { startDate: req.body.startDate, endDate: req.body.endDate }, 
        duration, 
        endpoint: '/api/ai/focus-blocks/suggest' 
    });
    res.status(500).json({ 
        error: 'Failed to generate focus block suggestions',
        message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/ai/email/process
 * @desc Process user-provided email text (not via Gmail API for MVP)
 * @access Private
 */
router.post('/email/process', async (req, res) => {
  const startTime = Date.now();
  try {
    const { emailData } = req.body; // Expects { sender, subject, body }
    const userId = req.user.id;

    if (!emailData || !emailData.sender || !emailData.subject || !emailData.body) {
      return res.status(400).json({ error: 'Email data (sender, subject, body) is required' });
    }

    logger.ai.request('AI Email (Pasted Text) Processing request', { userId, emailSubject: emailData.subject });
    const analysis = await AIService.processEmail(userId, emailData);
    const duration = Date.now() - startTime;
    logger.ai.response('AI Email (Pasted Text) Processing complete', { userId, duration });

    res.json(analysis);
  } catch (error) {
    const duration = Date.now() - startTime;
     logger.ai.error(error, { 
        userId: req.user?.id, 
        emailSubject: req.body.emailData?.subject, 
        duration, 
        endpoint: '/api/ai/email/process'
    });
    res.status(500).json({ 
        error: 'Failed to process email content with AI',
        message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined
    });
  }
});

// NOTE: /api/ai/meeting/prep-suggestions and /api/ai/gmail/fetch-recent-emails
// have been removed as direct Gmail API integration is deferred.
// We can add back meeting prep suggestions if it doesn't rely on direct email fetching for context.

module.exports = router;