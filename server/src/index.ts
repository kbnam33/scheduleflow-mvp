import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import { getOpenAIClient, SOP_PROMPTS } from '../../app/lib/openai';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/events route
app.post('/api/events', async (req, res) => {
  const { userId, type, payload, timestamp } = req.body;
  if (!userId || !type || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields: userId, type, timestamp' });
  }
  try {
    // Insert into user_events table
    const { error } = await supabase.from('user_events').insert([
      { userId, type, payload, timestamp }
    ]);
    if (error && error.code === '42P01') {
      // Table does not exist
      return res.status(500).json({
        error: 'user_events table does not exist',
        sql: `create table user_events (\n  id uuid primary key default uuid_generate_v4(),\n  userId text not null,\n  type text not null,\n  payload jsonb,\n  timestamp timestamptz not null\n);`
      });
    }
    if (error) throw error;
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/suggestions (fetch unread for userId)
app.get('/api/suggestions', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId query param' });
  try {
    const { data, error } = await supabase
      .from('proactive_suggestions')
      .select('*')
      .eq('userId', userId)
      .eq('read', false)
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return res.json({ suggestions: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/suggestions/:id/read (mark as read)
app.post('/api/suggestions/:id/read', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Missing id param' });
  try {
    const { error } = await supabase
      .from('proactive_suggestions')
      .update({ read: true })
      .eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/suggest-prep-slot
app.post('/api/suggest-prep-slot', async (req, res) => {
  const { userId, meetingId } = req.body;
  if (!userId || !meetingId) return res.status(400).json({ error: 'Missing userId or meetingId' });
  try {
    // Pull calendar context (stub: fetch user's events for next 7 days)
    const { data: events, error: calErr } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('userId', userId)
      .gte('start', new Date().toISOString());
    if (calErr) throw calErr;
    // Build prompt
    const prompt = `Suggest 3 optimal 30-min prep slots for meeting ${meetingId} based on this calendar: ${JSON.stringify(events)}. Format: ["YYYY-MM-DDTHH:MM", ...]`;
    let slots = [];
    let fallback = false;
    try {
      const openai = getOpenAIClient();
      const resp = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 100,
      });
      const text = resp.data.choices[0].message?.content || '';
      slots = JSON.parse(text);
      if (!Array.isArray(slots)) throw new Error('Not an array');
    } catch (err) {
      fallback = true;
      slots = [];
    }
    if (fallback || slots.length === 0) {
      return res.json({ slots: [], message: 'Could not generate slots. Please try again later.' });
    }
    return res.json({ slots });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to suggest prep slots. Please try again.' });
  }
});

// POST /api/confirm-prep-slot
app.post('/api/confirm-prep-slot', async (req, res) => {
  const { suggestionId, chosenTime } = req.body;
  if (!suggestionId || !chosenTime) return res.status(400).json({ error: 'Missing suggestionId or chosenTime' });
  try {
    // Mark suggestion confirmed
    const { error } = await supabase
      .from('proactive_suggestions')
      .update({ confirmed: true, confirmedTime: chosenTime })
      .eq('id', suggestionId);
    if (error) throw error;
    // Optionally create a calendar event (stub)
    // await supabase.from('calendar_events').insert([{ userId, start: chosenTime, ... }]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to confirm prep slot. Please try again.' });
  }
});

// POST /api/generate-tasks
app.post('/api/generate-tasks', async (req, res) => {
  const { projectBrief, userId, projectId } = req.body;
  if (!projectBrief || !userId || !projectId) return res.status(400).json({ error: 'Missing projectBrief, userId, or projectId' });
  let tasks = [];
  let retries = 3;
  let errorMsg = '';
  while (retries > 0) {
    try {
      const openai = getOpenAIClient();
      const prompt = `${SOP_PROMPTS.newProjectOnboarding}\n${SOP_PROMPTS.taskGeneration}\nProject: ${projectBrief}`;
      const resp = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 500,
      });
      const text = resp.data.choices[0].message?.content || '';
      tasks = JSON.parse(text);
      if (!Array.isArray(tasks)) throw new Error('Not an array');
      break;
    } catch (err) {
      retries--;
      errorMsg = err.message || 'OpenAI error';
      if (retries === 0) return res.status(500).json({ error: errorMsg });
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  // Insert tasks into tasks table
  try {
    const inserts = tasks.map((t: any) => ({
      ...t,
      userId,
      projectId,
      aiSuggested: true
    }));
    const { data, error } = await supabase.from('tasks').insert(inserts).select();
    if (error) throw error;
    return res.json({ tasks: data });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to insert tasks' });
  }
});

// POST /api/assets-query
app.post('/api/assets-query', async (req, res) => {
  const { projectId, meetingId } = req.body;
  if (!projectId && !meetingId) return res.status(400).json({ error: 'Missing projectId or meetingId' });
  let assets = [];
  let errorMsg = '';
  try {
    const openai = getOpenAIClient();
    const context = projectId ? `Project ID: ${projectId}` : `Meeting ID: ${meetingId}`;
    const prompt = `${SOP_PROMPTS.assetPrep}\n${context}`;
    const resp = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 200,
    });
    const text = resp.data.choices[0].message?.content || '';
    try {
      assets = JSON.parse(text);
      if (!Array.isArray(assets)) throw new Error('Not an array');
    } catch {
      assets = [];
    }
  } catch (err) {
    errorMsg = err.message || 'OpenAI error';
    assets = [];
  }
  // Store as suggested assets
  if (assets.length > 0) {
    try {
      await supabase.from('suggested_assets').insert(assets.map((a: any) => ({
        ...a,
        projectId,
        meetingId,
        aiSuggested: true
      })));
    } catch {}
  }
  return res.json({ assets });
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { userId, message, history } = req.body;
  if (!userId || !message) return res.status(400).json({ error: 'Missing userId or message' });
  try {
    const openai = getOpenAIClient();
    const systemPrompt = SOP_PROMPTS.chatDrivenHelpers;
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10),
      { role: 'user', content: message }
    ];
    const resp = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 200,
    });
    const reply = resp.data.choices[0].message?.content || '';
    if (!reply || reply.toLowerCase().includes('error')) throw new Error('Low confidence');
    return res.json({ reply });
  } catch (err) {
    // Fallback
    return res.json({ reply: SOP_PROMPTS.errorFallback });
  }
});

// Background worker: every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('[CRON] Running suggestion generator...');
  try {
    // 1. Load recent user events (last 30 min)
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: events, error: eventsError } = await supabase
      .from('user_events')
      .select('*')
      .gte('timestamp', since);
    if (eventsError) throw eventsError;
    // 2. Detect triggers (example: Home opened mid-focus 4x)
    const userEventCounts: Record<string, number> = {};
    for (const e of events) {
      if (e.type === 'home_opened') {
        userEventCounts[e.userId] = (userEventCounts[e.userId] || 0) + 1;
      }
    }
    for (const userId in userEventCounts) {
      if (userEventCounts[userId] >= 4) {
        // 3. Fill SOP template and call OpenAI
        const prompt = SOP_PROMPTS.midFocus.replace(/\{userId\}/g, userId);
        let suggestion = '';
        let retries = 3;
        while (retries > 0) {
          try {
            const openai = getOpenAIClient();
            const resp = await openai.createChatCompletion({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'system', content: prompt }],
              max_tokens: 80,
            });
            suggestion = resp.data.choices[0].message?.content || '';
            break;
          } catch (err) {
            retries--;
            if (retries === 0) throw err;
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        // 4. Insert suggestion
        if (suggestion) {
          await supabase.from('proactive_suggestions').insert([
            { userId, message: suggestion, read: false }
          ]);
          console.log(`[CRON] Inserted suggestion for user ${userId}`);
        }
      }
    }
  } catch (err) {
    console.error('[CRON] Suggestion generation failed:', err);
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 