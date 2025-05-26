// server/src/routes/user.js
const express = require('express');
const router = express.Router();
const UserPreferences = require('../models/UserPreferences');
const logger = require('../utils/logger');

// POST /api/user/preferences (called from onboarding.tsx as /api/users/me/preferences)
// REASONING: Changed route to match what onboarding.tsx expects (/users/me/preferences).
// We can make a more generic /api/user/preferences and have the client adapt,
// or create an alias. For now, let's align with client.
// This means this router might need to be mounted at /api/users for the 'me/preferences' part.
// OR we change the client. Let's change the route here for simplicity for now and adjust mount point.

router.post('/me/preferences', async (req, res) => {
    const userId = req.user.id; // From authMiddleware
    const preferences = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({ error: 'Invalid preferences data' });
    }

    try {
        // Sanitize or validate preferences if necessary
        const { role, calendarConnected, videoConnected, creativityTime, ...otherPrefs } = preferences;

        const currentPrefs = await UserPreferences.getPreferences(userId) || {};

        // Merge strategically: onboarding might send partial updates.
        const updates = { ...currentPrefs };
        if (role !== undefined) updates.role = role; // Assuming 'role' is a top-level field in user_preferences or users table
        if (calendarConnected !== undefined) updates.calendar_connected = calendarConnected; // Adjust field names to match DB schema
        if (videoConnected !== undefined) updates.video_connected = videoConnected;
        if (creativityTime !== undefined) updates.creativity_time_pref = creativityTime; // Adjust field name

        // For other preferences, directly update the JSONB field if your schema has one
        // For instance, if 'user_preferences' table has a 'settings' JSONB column:
        // updates.settings = { ...currentPrefs.settings, ...otherPrefs };
        // Or if each preference is a column:
        // Object.assign(updates, otherPrefs);

        // For now, assuming preferences from onboarding are top-level fields in user_preferences table or a general JSONB field
        // The UserPreferences.updatePreferences method handles upserting.
        // We need to make sure the UserPreferences.updatePreferences method can handle individual fields
        // or a general 'preferences' JSONB blob.
        // The current UserPreferences.updatePreferences spreads `...updates` so it should handle new top-level fields.

        const updatedPreferences = await UserPreferences.updatePreferences(userId, updates);
        logger.info('User preferences updated', { userId, newPrefs: updatedPreferences });
        res.json(updatedPreferences);
    } catch (error) {
        logger.error('Failed to update user preferences', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Could not update preferences' });
    }
});

// GET /api/user/preferences
router.get('/me/preferences', async (req, res) => {
    const userId = req.user.id;
     if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    try {
        const preferences = await UserPreferences.getPreferences(userId);
        if (!preferences) {
            // This case should be handled by getPreferences returning defaults if no row exists
            return res.status(404).json({ error: 'Preferences not found for user, and no defaults available.'});
        }
        res.json(preferences);
    } catch (error) {
        logger.error('Failed to get user preferences', { userId, error: error.message });
        res.status(500).json({ error: 'Could not retrieve preferences' });
    }
});


module.exports = router;