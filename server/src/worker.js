// FILENAME: server/src/worker.js
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // Ensure .env is loaded relative to server root
const cron = require('node-cron');
const path = require('path');
const supabase = require('./config/supabase'); // Adjusted path
const logger = require('./utils/logger'); // Adjusted path
// Assuming app/lib/openai.ts is compiled to app/lib/openai.js and accessible
// The server/tsconfig.json includes ../app/lib/**/* and outputs to dist.
// If running from dist/src/worker.js, path would be ../../app/lib/openai
// If running directly from src/worker.js without build, this might need adjustment
// or direct OpenAI client initialization like in ai-service.js.
// For now, let's initialize OpenAI client directly for clarity in the worker.
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SOP Prompts - ideally, these would also be managed more centrally or via DB as planned
const SOP_PROMPTS = {
  midFocus: `You are an expert assistant. Help the user focus on the most important task for the next hour.`,
  // Add other SOP_PROMPTS if used by cron jobs from index.ts, or fetch from DB
};


// Background worker: every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  logger.info('[CRON] Running suggestion generator...');
  try {
    // 1. Load recent user events (last 30 min)
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: events, error: eventsError } = await supabase
      .from('user_events')
      .select('*')
      .gte('timestamp', since);

    if (eventsError) {
      logger.error('[CRON] Error fetching user events', { code: eventsError.code, message: eventsError.message });
      throw eventsError;
    }

    if (!events) {
      logger.info('[CRON] No recent user events found.');
      return;
    }

    // 2. Detect triggers (example: Home opened mid-focus 4x)
    const userEventCounts = {};
    for (const e of events) {
      if (e.type === 'home_opened') { // Assuming 'home_opened' is a valid event type
        userEventCounts[e.userId] = (userEventCounts[e.userId] || 0) + 1;
      }
    }

    for (const userId in userEventCounts) {
      if (userEventCounts[userId] >= 4) {
        // 3. Fill SOP template and call OpenAI
        const prompt = SOP_PROMPTS.midFocus.replace(/\{userId\}/g, userId); // Ensure SOP_PROMPTS.midFocus is defined
        let suggestion = '';
        let retries = 3;
        while (retries > 0) {
          try {
            const resp = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo', // Ensure this model is appropriate and available
              messages: [{ role: 'system', content: prompt }],
              max_tokens: 80,
            });
            suggestion = resp.choices[0].message?.content || '';
            break;
          } catch (err) {
            retries--;
            logger.warn(`[CRON] OpenAI call failed for user ${userId}, retries left: ${retries}`, { error: err.message });
            if (retries === 0) throw err;
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        // 4. Insert suggestion
        if (suggestion) {
          const { error: insertError } = await supabase.from('proactive_suggestions').insert([
            { userId, message: suggestion, read: false, created_at: new Date().toISOString() } // Ensure schema matches
          ]);
          if (insertError) {
            logger.error('[CRON] Error inserting proactive suggestion', { userId, code: insertError.code, message: insertError.message });
          } else {
            logger.info(`[CRON] Inserted suggestion for user ${userId}`);
          }
        }
      }
    }
    logger.info('[CRON] Suggestion generator run completed.');
  } catch (err) {
    logger.error('[CRON] Suggestion generation failed critically', { message: err.message, stack: err.stack });
  }
});

logger.info('Cron job worker started and scheduled.');