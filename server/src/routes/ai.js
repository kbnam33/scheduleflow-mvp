const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');

// Rate limiter for AI endpoints
const aiLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 60 * 60 * 1000, // 1 second in test, 1 hour in production
  max: process.env.NODE_ENV === 'test' ? 5 : 50, // 5 requests in test, 50 in production
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
  keyGenerator: (req) => req.user?.id || req.ip
});

// Apply rate limiter to all AI routes
router.use(aiLimiter);

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route POST /api/ai/chat
 * @desc Process a chat message and get AI response
 * @access Private
 */
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await AIService.processChat(req.user.id, message);
    res.json(result);
  } catch (error) {
    logger.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

/**
 * @route POST /api/ai/tasks/suggest
 * @desc Generate task suggestions for a project
 * @access Private
 */
router.post('/tasks/suggest', async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const suggestions = await AIService.generateTaskSuggestions(req.user.id, projectId);
    res.json({ suggestions });
  } catch (error) {
    logger.error('Error generating task suggestions:', error);
    res.status(500).json({ error: 'Failed to generate task suggestions' });
  }
});

/**
 * @route POST /api/ai/focus-blocks/suggest
 * @desc Generate focus block suggestions
 * @access Private
 */
router.post('/focus-blocks/suggest', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const suggestions = await AIService.suggestFocusBlocks(
      req.user.id,
      new Date(startDate),
      new Date(endDate)
    );
    res.json({ suggestions });
  } catch (error) {
    logger.error('Error suggesting focus blocks:', error);
    res.status(500).json({ error: 'Failed to generate focus block suggestions' });
  }
});

/**
 * @route POST /api/ai/email/process
 * @desc Process an email and get AI analysis
 * @access Private
 */
router.post('/email/process', async (req, res) => {
  try {
    const { sender, subject, body } = req.body;
    if (!sender || !subject || !body) {
      return res.status(400).json({ error: 'Sender, subject, and body are required' });
    }

    const analysis = await AIService.processEmail(req.user.id, { sender, subject, body });
    res.json(analysis);
  } catch (error) {
    logger.error('Error processing email:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

/**
 * @route POST /api/ai/meeting/prep
 * @desc Generate meeting preparation suggestions
 * @access Private
 */
router.post('/meeting/prep', async (req, res) => {
  try {
    const { meetingData } = req.body;
    if (!meetingData || !meetingData.id) {
      return res.status(400).json({ error: 'Meeting data with ID is required' });
    }

    const suggestions = await AIService.suggestMeetingPrep(req.user.id, meetingData);
    res.json(suggestions);
  } catch (error) {
    logger.error('Error suggesting meeting prep:', error);
    res.status(500).json({ error: 'Failed to generate meeting preparation suggestions' });
  }
});

module.exports = router; 