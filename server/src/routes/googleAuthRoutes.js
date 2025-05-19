const express = require('express');
const router = express.Router();
const { getGoogleAuthUrl, getTokensFromCode } = require('../services/googleAuthService');
const logger = require('../utils/logger');

// Redirect user to Google's OAuth consent screen
router.get('/google', (req, res) => {
  try {
    const authUrl = getGoogleAuthUrl();
    logger.info('Redirecting to Google OAuth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error generating Google Auth URL:', error);
    res.status(500).send('Error initiating Google authentication.');
  }
});

// Handle the OAuth 2.0 callback from Google
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    logger.error('Google OAuth callback error:', error);
    return res.status(400).send(`Error during Google authentication: ${error}`);
  }

  if (!code) {
    logger.warn('No code received in Google OAuth callback.');
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    const tokens = await getTokensFromCode(code);
    // IMPORTANT: In a real app, you would now associate these tokens
    // with the logged-in user (e.g., req.user.id from your authMiddleware)
    // and store them securely in your database (Supabase).
    // For MVP, tokens are stored in memory by googleAuthService for simplicity.

    // Redirect user to a success page or back to the app settings
    logger.info('Successfully authenticated with Google and received tokens.');
    // For now, just send a success message. Frontend would ideally handle this.
    res.send('Google Authentication Successful! You can close this window.');
  } catch (err) {
    logger.error('Failed to exchange Google auth code for tokens:', err);
    res.status(500).send('Failed to authenticate with Google.');
  }
});

module.exports = router;