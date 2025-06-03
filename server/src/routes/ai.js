// FILENAME: server/src/routes/ai.js
// REASONING: Adding new AI-driven endpoints previously in server/src/index.ts
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');
const supabase = require('../config/supabase'); // For direct DB interactions if needed by new routes

const aiLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'test' ? 1000 : 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many AI requests, please try again later.' },
});

router.use(aiLimiter);
router.use(authMiddleware);

// Existing /api/ai/chat
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
    logger.ai.response('AI Chat response', { userId, duration, hasError: !!response.error });
    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { userId: req.user?.id, duration, endpoint: '/api/ai/chat', message: req.body.message });
    res.status(500).json({ error: 'Failed to process chat message with AI', message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined });
  }
});

// Existing /api/ai/tasks/suggest (from original ai.js)
router.post('/tasks/suggest', async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, projectBrief } = req.body;
    const userId = req.user.id;
    if (!projectId) return res.status(400).json({ error: 'Project ID is required' });
    logger.ai.request('AI Task Suggestion request', { userId, projectId, projectBriefExists: !!projectBrief });
    const suggestions = await AIService.generateTaskSuggestions(userId, projectId, projectBrief);
    const duration = Date.now() - startTime;
    logger.ai.response('AI Task Suggestions generated', { userId, projectId, suggestionCount: suggestions?.length, duration });
    res.json({ suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { userId: req.user?.id, projectId: req.body.projectId, duration, endpoint: '/api/ai/tasks/suggest' });
    res.status(500).json({ error: 'Failed to generate task suggestions', message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined });
  }
});

// NEW from index.ts: POST /api/ai/tasks/generate-and-create (adapted from /api/generate-tasks)
router.post('/tasks/generate-and-create', async (req, res) => {
  const startTime = Date.now();
  const { projectBrief, projectId } = req.body;
  const userId = req.user.id;

  if (!projectBrief || !userId || !projectId) {
    return res.status(400).json({ error: 'Missing projectBrief, userId, or projectId' });
  }
  logger.ai.request('AI Generate and Create Tasks request', { userId, projectId, projectBrief });
  try {
    // Placeholder for a new AIService method that generates AND inserts tasks
    // For now, adapting logic from index.ts; actual insertion should be robust
    const generatedTasks = await AIService.generateAndInsertTasks(userId, projectId, projectBrief); // Assumed new AIService method
    
    const duration = Date.now() - startTime;
    logger.ai.response('AI Tasks generated and created', { userId, projectId, taskCount: generatedTasks?.length, duration });
    res.json({ tasks: generatedTasks });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { userId, projectId, duration, endpoint: '/api/ai/tasks/generate-and-create' });
    res.status(500).json({ error: 'Failed to generate and create tasks', message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined });
  }
});

// Existing /api/ai/focus-blocks/suggest
router.post('/focus-blocks/suggest', async (req, res) => {
  // ... (existing logic from ai.js, seems fine) ...
  const startTime = Date.now();
  try {
    const { startDate, endDate } = req.body;
    const userId = req.user.id;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start date and end date are required' });
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) return res.status(400).json({ error: 'Invalid date format.' });
    logger.ai.request('AI Focus Block Suggestion request', { userId, startDate, endDate });
    const suggestions = await AIService.suggestFocusBlocks(userId, parsedStartDate, parsedEndDate);
    const duration = Date.now() - startTime;
    logger.ai.response('AI Focus Blocks generated', { userId, suggestionCount: suggestions?.length, duration });
    res.json({ suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { userId: req.user?.id, dates: { startDate: req.body.startDate, endDate: req.body.endDate }, duration, endpoint: '/api/ai/focus-blocks/suggest' });
    res.status(500).json({ error: 'Failed to generate focus block suggestions', message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined });
  }
});

// Existing /api/ai/email/process
router.post('/email/process', async (req, res) => {
  // ... (existing logic from ai.js, seems fine) ...
  const startTime = Date.now();
  try {
    const { emailData } = req.body;
    const userId = req.user.id;
    if (!emailData || !emailData.sender || !emailData.subject || !emailData.body) return res.status(400).json({ error: 'Email data (sender, subject, body) is required' });
    logger.ai.request('AI Email (Pasted Text) Processing request', { userId, emailSubject: emailData.subject });
    const analysis = await AIService.processEmail(userId, emailData);
    const duration = Date.now() - startTime;
    logger.ai.response('AI Email (Pasted Text) Processing complete', { userId, duration });
    res.json(analysis);
  } catch (error) {
    const duration = Date.now() - startTime;
     logger.ai.error(error, { userId: req.user?.id, emailSubject: req.body.emailData?.subject, duration, endpoint: '/api/ai/email/process'});
    res.status(500).json({ error: 'Failed to process email content with AI', message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined});
  }
});


// NEW from index.ts: POST /api/ai/assets/query (adapted from /api/assets-query)
router.post('/assets/query', async (req, res) => {
  const startTime = Date.now();
  const { projectId, meetingId } = req.body;
  const userId = req.user.id;

  if (!projectId && !meetingId) {
    return res.status(400).json({ error: 'Missing projectId or meetingId' });
  }
  logger.ai.request('AI Asset Query request', { userId, projectId, meetingId });
  try {
    // Placeholder for a new AIService method
    const assets = await AIService.queryAssets(userId, projectId, meetingId); // Assumed new AIService method

    // Store suggested assets (logic from index.ts)
    if (assets && assets.length > 0) {
      const assetsToInsert = assets.map((a) => ({
        ...a, // Expecting a to be { filename, url?, ... }
        project_id: projectId, // ensure these columns exist in suggested_assets
        meeting_id: meetingId,
        user_id: userId,
        ai_suggested: true,
        created_at: new Date().toISOString()
      }));
      const { error: insertError } = await supabase.from('suggested_assets').insert(assetsToInsert);
      if (insertError) {
        logger.error('Failed to store AI suggested assets', { userId, projectId, meetingId, error: insertError.message });
        // Non-fatal, still return suggestions
      }
    }
    const duration = Date.now() - startTime;
    logger.ai.response('AI Asset Query complete', { userId, projectId, meetingId, assetCount: assets?.length, duration });
    res.json({ assets: assets || [] });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { userId, projectId, meetingId, duration, endpoint: '/api/ai/assets/query' });
    res.status(500).json({ error: 'Failed to query assets with AI', message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined });
  }
});

// NEW from index.ts: POST /api/ai/calendar/suggest-prep-slot (adapted from /api/suggest-prep-slot)
router.post('/calendar/suggest-prep-slot', async (req, res) => {
  const startTime = Date.now();
  const { meetingId } = req.body; // userId comes from authMiddleware
  const userId = req.user.id;

  if (!meetingId) {
    return res.status(400).json({ error: 'Missing meetingId' });
  }
  logger.ai.request('AI Suggest Prep Slot request', { userId, meetingId });
  try {
    // Placeholder for a new AIService method
    const result = await AIService.suggestCalendarPrepSlot(userId, meetingId); // Assumed new AIService method
    const duration = Date.now() - startTime;
    logger.ai.response('AI Prep Slot suggestion complete', { userId, meetingId, slotCount: result?.slots?.length, duration });
    res.json(result); // Expects { slots: [], message?: '...' }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { userId, meetingId, duration, endpoint: '/api/ai/calendar/suggest-prep-slot' });
    res.status(500).json({ error: 'Failed to suggest prep slots', message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined });
  }
});

// NEW from index.ts: POST /api/ai/calendar/confirm-prep-slot (adapted from /api/confirm-prep-slot)
router.post('/calendar/confirm-prep-slot', async (req, res) => {
  const startTime = Date.now();
  const { suggestionId, chosenTime } = req.body;
  const userId = req.user.id;

  if (!suggestionId || !chosenTime) {
    return res.status(400).json({ error: 'Missing suggestionId or chosenTime' });
  }
  logger.info('Confirm Prep Slot request', { userId, suggestionId, chosenTime });
  try {
    // This is a direct DB operation, could be in a model or service layer
    const { error } = await supabase
      .from('proactive_suggestions') // Assuming prep slots are stored as proactive_suggestions
      .update({ confirmed: true, confirmed_time: chosenTime, updated_at: new Date().toISOString() })
      .eq('id', suggestionId)
      .eq('user_id', userId); // Security: ensure user owns the suggestion

    if (error) throw error;
    
    // Optionally create a calendar event here
    // await AIService.createCalendarEventForPrepSlot(userId, chosenTime, suggestionId);
    
    const duration = Date.now() - startTime;
    logger.info('Prep Slot confirmed', { userId, suggestionId, chosenTime, duration });
    res.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to confirm prep slot', { userId, suggestionId, chosenTime, error: error.message, duration, endpoint: '/api/ai/calendar/confirm-prep-slot' });
    res.status(500).json({ error: 'Failed to confirm prep slot', message: (process.env.NODE_ENV === 'development' && error.message) ? error.message : undefined });
  }
});


module.exports = router;