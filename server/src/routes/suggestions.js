// FILENAME: server/src/routes/suggestions.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/suggestions (fetch unread for userId)
router.get('/', async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    // This case should ideally be caught by authMiddleware if it's configured to deny unauthenticated
    logger.warn('Attempt to get suggestions without userId (unauthenticated or misconfigured auth)', { ip: req.ip });
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const { data, error } = await supabase
      .from('proactive_suggestions')
      .select('*')
      .eq('user_id', userId) // Ensure column name 'user_id' matches your DB
      .eq('read', false)
      .order('created_at', { ascending: false }); // Ensure column name 'created_at' matches

    if (error) {
      logger.error('Error fetching proactive suggestions from Supabase', { code: error.code, message: error.message, userId });
      throw error;
    }
    logger.info(`Fetched ${data?.length || 0} unread suggestions for user`, { userId });
    res.json({ suggestions: data || [] });
  } catch (err) {
    logger.error('Critical error in GET /api/suggestions', { message: err.message, stack: err.stack, userId });
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// POST /api/suggestions/:id/read (mark as read)
router.post('/:id/read', async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    logger.warn('Attempt to mark suggestion as read without userId (unauthenticated)', { suggestionId: id, ip: req.ip });
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (!id) {
    return res.status(400).json({ error: 'Missing suggestion ID' });
  }

  try {
    const { data, error } = await supabase
      .from('proactive_suggestions')
      .update({ read: true, updated_at: new Date().toISOString() }) // Ensure 'updated_at' column exists or remove
      .eq('id', id)
      .eq('user_id', userId) // Ensure user can only mark their own suggestions
      .select(); // To check if any row was updated

    if (error) {
      logger.error('Error marking suggestion as read in Supabase', { code: error.code, message: error.message, userId, suggestionId: id });
      throw error;
    }

    if (!data || data.length === 0) {
      logger.warn('Attempt to mark non-existent or unauthorized suggestion as read', { userId, suggestionId: id });
      return res.status(404).json({ error: 'Suggestion not found or not authorized to update' });
    }
    
    logger.info('Suggestion marked as read', { userId, suggestionId: id });
    res.json({ success: true, updatedSuggestion: data[0] });
  } catch (err) {
    logger.error('Critical error in POST /api/suggestions/:id/read', { message: err.message, stack: err.stack, userId, suggestionId: id });
    res.status(500).json({ error: 'Failed to mark suggestion as read' });
  }
});

module.exports = router;