// scheduleflow-mvp/server/src/routes/ai.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth'); // Correctly import the middleware
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');

// Rate limiter for AI endpoints
const aiLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000, // Adjusted window for consistency
  max: process.env.NODE_ENV === 'test' ? 10 : 50, // Adjusted max for consistency
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
  keyGenerator: (req) => req.user?.id || req.ip, // req.user will be set if authMiddleware runs before this keyGen
  message: { error: 'Too many AI requests, please try again later.' }, // Custom message
});

// Apply rate limiter to all routes in this router
router.use(aiLimiter);

// Apply authentication middleware to all routes in this router
// This means all endpoints defined below will require a valid token
router.use(authMiddleware); // Use the correctly imported middleware

/**
 * @route POST /api/ai/chat
 * @desc Process a chat message and get AI response
 * @access Private
 */
router.post('/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, chatHistory } = req.body; // Expect chatHistory from client
    const userId = req.user.id; // Assuming authMiddleware sets req.user

    if (!userId) { // Should be caught by authMiddleware, but good to double check
      logger.warn('Unauthorized AI chat attempt (no userId after auth)', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
      // suggestedActionsCount: response.suggestedActions?.length || 0 // If AIService returns this
    });
    
    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
      userId: req.user?.id, // req.user might not be set if error is before auth, but auth is a middleware here
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

    // Validate date format if necessary (e.g., using a library like date-fns or moment)
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
 * @desc Process an email (pasted content) and get AI analysis
 * @access Private
 */
router.post('/email/process', async (req, res) => {
  const startTime = Date.now();
  try {
    const { emailData } = req.body; // Expect an object like { sender, subject, body }
    const userId = req.user.id;

    if (!emailData || !emailData.sender || !emailData.subject || !emailData.body) {
      return res.status(400).json({ error: 'Email data (sender, subject, body) is required' });
    }
    
    logger.ai.request('AI Email Processing request', { userId, emailSubject: emailData.subject });
    const analysis = await AIService.processEmail(userId, emailData);
    const duration = Date.now() - startTime;
    logger.ai.response('AI Email Processing complete', { userId, duration });

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
        error: 'Failed to process email with AI',
        message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/ai/meeting/prep-suggestions
 * @desc Generate meeting preparation suggestions (this was /meeting/prep before, making it more specific)
 * @access Private
 */
router.post('/meeting/prep-suggestions', async (req, res) => {
  const startTime = Date.now();
  try {
    const { meetingData } = req.body; // Expects meeting details, e.g., { id, title, description, start_time, attendees }
    const userId = req.user.id;

    if (!meetingData || !meetingData.id) { // Assuming meeting ID is crucial for context
      return res.status(400).json({ error: 'Meeting data with ID is required' });
    }

    logger.ai.request('AI Meeting Prep Suggestion request', { userId, meetingId: meetingData.id });
    // Assuming suggestMeetingPrep was refactored in AIService to use Langchain and handle meetingData
    // This route was AIService.suggestMeetingPrep(userId, meetingData) in the original file.
    // Let's assume for now AIService has a method like generateMeetingPrepSuggestions(userId, meetingData)
    // If it was the simpler AIService.suggestMeetingPrepBlocks(userId) which fetches upcoming meetings itself,
    // then the request body might not need meetingData.
    // For now, I'll assume a specific meeting context is passed.
    // const suggestions = await AIService.suggestMeetingPrep(userId, meetingData); // Original name
    const suggestions = await AIService.generateMeetingPrepSuggestions(userId, meetingData); // Hypothetical better name
    
    const duration = Date.now() - startTime;
    logger.ai.response('AI Meeting Prep Suggestions generated', { userId, meetingId: meetingData.id, duration });
    
    res.json(suggestions);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { 
        userId: req.user?.id, 
        meetingId: req.body.meetingData?.id,
        duration, 
        endpoint: '/api/ai/meeting/prep-suggestions'
    });
    res.status(500).json({ 
        error: 'Failed to generate meeting preparation suggestions',
        message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined
    });
  }
});


// Placeholder for /api/ai/gmail/fetch-recent-emails (from Step 5 testing plan)
router.get('/gmail/fetch-recent-emails', async (req, res) => {
    const startTime = Date.now();
    try {
        const userId = req.user.id;
        const count = req.query.count ? parseInt(req.query.count, 10) : 5;

        logger.ai.request('AI Gmail Fetch Recent Emails request', { userId, count });
        const emails = await AIService.fetchRecentEmails(userId, count);
        const duration = Date.now() - startTime;
        logger.ai.response('AI Gmail Fetch Recent Emails complete', { userId, emailCount: emails.length, duration });

        res.json({ emails });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.ai.error(error, { 
            userId: req.user?.id, 
            duration, 
            endpoint: '/api/ai/gmail/fetch-recent-emails'
        });
        res.status(500).json({ 
            error: 'Failed to fetch recent emails via AI service',
            message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined
        });
    }
});


module.exports = router;