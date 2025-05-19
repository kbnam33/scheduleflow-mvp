// scheduleflow-mvp/server/src/services/googleAuthService.js
const { google } = require('googleapis');
const logger = require('../utils/logger');

// Temporary in-memory store for demo/testing of OAuth flow.
// NOT SUITABLE FOR PRODUCTION OR MULTI-USER.
// Tokens should be stored securely per user in a database (e.g., Supabase).
let temporaryUserGoogleTokens = null;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI
);

// Scopes define the level of access you are requesting.
// Ensure these match what you configured in your Google Cloud Console OAuth Consent Screen.
const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  // 'https://www.googleapis.com/auth/gmail.send', // Add when send functionality is needed
];

function getGoogleAuthUrl() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request a refresh token.
    scope: GOOGLE_OAUTH_SCOPES,
    prompt: 'consent', // Ensures the consent screen is always shown (good for dev/testing).
  });
  logger.info('Generated Google OAuth URL for redirection.');
  return authUrl;
}

async function getTokensFromCode(code) {
  try {
    logger.info(`Attempting to get tokens from Google with authorization code.`);
    const { tokens } = await oauth2Client.getToken(code);

    logger.info('Google OAuth tokens received successfully.');
    if (tokens.access_token) {
      logger.info(`Access Token received.`);
    }
    if (tokens.refresh_token) {
      logger.info(`Refresh Token received. This should be stored securely.`);
      // Storing in temporary variable for this session/MVP step.
      temporaryUserGoogleTokens = tokens;
    } else if (temporaryUserGoogleTokens && temporaryUserGoogleTokens.refresh_token && !tokens.refresh_token) {
      // If we already have a refresh token and the new set doesn't provide one (common on re-auth),
      // preserve the existing refresh token.
      tokens.refresh_token = temporaryUserGoogleTokens.refresh_token;
      temporaryUserGoogleTokens = tokens; // Update with new access token and potentially expiry.
      logger.info('Access token refreshed; re-using existing refresh token.');
    } else {
      logger.warn('No new refresh token received. If this was the first authorization, check OAuth settings (access_type: "offline").');
      temporaryUserGoogleTokens = tokens; // Store whatever was received.
    }

    if (tokens.expiry_date) {
      logger.info(`Token expiry_date: ${new Date(tokens.expiry_date).toISOString()}`);
    }

    // TODO (Future Step): Securely store tokens (access_token, refresh_token, expiry_date)
    // in your database (e.g., Supabase user_integrations table) associated with the ScheduleFlow user.
    // For example: await UserGoogleCredentials.saveUserTokens(scheduleFlowUserId, tokens);

    return tokens;
  } catch (error) {
    logger.error('Error retrieving Google access token from authorization code:', {
      message: error.message,
      response_data: error.response?.data,
    });
    throw new Error('Failed to retrieve access token from Google.');
  }
}

/**
 * Returns an OAuth2 client instance configured with the provided user tokens.
 * @param {object} userTokens - The user's OAuth tokens (access_token, refresh_token, etc.).
 * @returns {google.auth.OAuth2} Configured OAuth2 client.
 */
function getOAuth2ClientWithUserTokens(userTokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  if (userTokens && userTokens.access_token) {
    client.setCredentials(userTokens);

    // Event listener for automatic token refresh by the googleapis library.
    client.on('tokens', (newTokens) => {
      logger.info('Google OAuth tokens were refreshed automatically by the client library.');
      let updatedTokens = { ...userTokens, ...newTokens };

      if (newTokens.refresh_token) {
        logger.info('New refresh token received during auto-refresh. This should be persisted.');
      }
      
      // TODO (Future Step): Persist these updated tokens for the user in your database.
      // e.g., UserGoogleCredentials.updateUserTokens(scheduleFlowUserId, updatedTokens);
      temporaryUserGoogleTokens = updatedTokens; // Update temporary store for current session
    });
  }
  return client;
}

/**
 * Returns a base OAuth2 client instance without user-specific tokens set.
 * Useful for initiating the auth flow.
 */
function getBaseOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

module.exports = {
  getGoogleAuthUrl,
  getTokensFromCode,
  getOAuth2ClientWithUserTokens,
  getBaseOAuth2Client,
  GOOGLE_OAUTH_SCOPES,
  // For demo/MVP steps, allowing access to the temporarily stored tokens.
  // In a production app, tokens would be fetched from a secure DB store.
  getTemporaryStoredTokens: () => temporaryUserGoogleTokens,
  clearTemporaryStoredTokens: () => { temporaryUserGoogleTokens = null; }
};