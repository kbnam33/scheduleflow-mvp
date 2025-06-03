// FILENAME: server/src/routes/email.js
// REASONING: Adding /inbound-email webhook from server/src/index.ts
const express = require('express');
const router = express.Router();
const AIService = require('../services/ai-service');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase'); // For direct DB interactions
const authMiddleware = require('../middleware/auth'); // For protected routes

// Rate limiting middleware (applied per route as needed)
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, 
  message: 'Too many email processing requests, please try again later.'
});

const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Allow more for webhooks, but still protect
    message: 'Too many webhook requests, please try again later.'
});


// Existing /api/email/process (protected by authMiddleware and aiLimiter via app.js)
router.post('/process', async (req, res) => { // Removed emailLimiter here as it's applied globally in app.js for /api
  const startTime = Date.now();
  try {
    const userId = req.user?.id; // Provided by authMiddleware
    const { emailData } = req.body; // Changed from `email` to `emailData` to match ai.js

    if (!emailData || !emailData.sender || !emailData.subject || !emailData.body) {
      logger.warn('Invalid email data received for /process', { userId });
      return res.status(400).json({ error: 'Valid email data (sender, subject, body) is required' });
    }

    logger.ai.request('Process email (manual)', { userId, emailSubject: emailData.subject, sender: emailData.sender });
    const response = await AIService.processEmail(userId, emailData);
    const duration = Date.now() - startTime;
    logger.ai.response('Email processed (manual)', { userId, duration, hasError: !!response.error, suggestedActions: response.suggestedActions?.length || 0, emailSubject: emailData.subject });
    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.ai.error(error, { userId: req.user?.id, duration, endpoint: '/email/process', emailSubject: req.body.emailData?.subject });
    res.status(500).json({ error: 'Failed to process email', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});


// NEW from index.ts: POST /api/email/inbound-email (webhook)
// This route should NOT have the standard authMiddleware if it's a public webhook
// It might need its own API key validation if called by an external service.
// For now, assuming it might be called internally or with a specific API key not covered by user JWT.
// If it requires user context, it needs a way to identify the user (e.g. target email address mapping to userId).
router.post('/inbound-webhook', webhookLimiter, async (req, res) => { // Renamed route for clarity, applied webhookLimiter
  const startTime = Date.now();
  // IMPORTANT: Webhooks typically need a way to identify the target user.
  // This example assumes `req.body.userId` is provided by the webhook caller or derived.
  // In a real scenario, you'd map `to` email address to a `userId` or use a specific per-user webhook URL.
  const { userId, subject, body, attachments, sender } = req.body; 

  if (!userId || !body) { // Subject and sender might be optional depending on use case
    logger.warn('Missing userId or body for inbound email webhook', { bodyKeys: Object.keys(req.body) });
    return res.status(400).json({ error: 'Missing userId or body for inbound email' });
  }
  logger.info('Inbound email webhook received', { userId, subject });
  try {
    // Log event
    const { error: eventError } = await supabase.from('user_events').insert([
      { user_id: userId, type: 'email_replied_webhook', payload: { subject, body, attachments, sender }, timestamp: new Date().toISOString() }
    ]);
    if (eventError) {
        logger.error('Error logging email_replied_webhook event via webhook', { userId, error: eventError.message });
        // Continue processing even if event logging fails
    }

    // Placeholder: The original code in index.ts tried to generate a suggestion.
    // This logic should likely be in AIService or a dedicated email processing service.
    // For now, just logging and acknowledging.
    // Example: await AIService.processInboundWebhookEmail(userId, { subject, body, sender, attachments });

    const duration = Date.now() - startTime;
    logger.info('Inbound email webhook processed', { userId, subject, duration });
    res.status(200).json({ success: true, message: "Email processing initiated" });
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('Critical error processing inbound email webhook', { message: err.message, stack: err.stack, userId, subject, duration });
    res.status(500).json({ error: 'Failed to process inbound email webhook' });
  }
});


module.exports = router;