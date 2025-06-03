// FILENAME: server/src/routes/events.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// POST /api/events
router.post('/', async (req, res) => {
  const { type, payload, timestamp } = req.body;
  const userId = req.user?.id; // Assuming authMiddleware sets req.user.id

  if (!userId || !type || !timestamp) {
    logger.warn('Missing required fields for /api/events', { userId, type, timestamp });
    return res.status(400).json({ error: 'Missing required fields: userId, type, timestamp' });
  }

  try {
    const { data, error } = await supabase.from('user_events').insert([
      { user_id: userId, type, payload, timestamp } // Ensure column name matches DB: user_id
    ]).select(); // Added select to potentially return the created event

    if (error) {
      logger.error('Error inserting user event to Supabase', { code: error.code, message: error.message, userId, type });
      // Check for specific table non-existence error code if needed (e.g., '42P01' for PostgreSQL)
      if (error.code === '42P01') {
        return res.status(500).json({
          error: 'user_events table does not exist. Please ensure database migrations have run.',
          details: error.message
        });
      }
      throw error;
    }
    logger.info('User event logged successfully', { userId, type, eventId: data ? data[0]?.id : null });
    res.status(201).json({ success: true, event: data ? data[0] : null });
  } catch (err) {
    logger.error('Critical error in POST /api/events', { message: err.message, stack: err.stack, userId, type });
    res.status(500).json({ error: 'Failed to log event due to server error' });
  }
});

module.exports = router;