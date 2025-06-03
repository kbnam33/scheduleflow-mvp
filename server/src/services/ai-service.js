// server/src/services/ai-service.js
// REASONING: Reverted to OpenAI SDK, ensuring gpt-3.5-turbo is the default.
// Includes robust error handling and JSON parsing for structured outputs.

const OpenAI = require('openai');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const AIContext = require('../models/AIContext');
const UserPreferences = require('../models/UserPreferences');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your .env
});

const DEFAULT_MODEL = "gpt-3.5-turbo"; 

class AIService {
  async processChat(userId, message, context = {}) {
    try {
      const contextForAI = await AIContext.getContextForAI(userId); // This should be robust now
      
      logger.info(`[AIService.processChat] Attempting to use model: ${DEFAULT_MODEL} for user: ${userId}`);
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: `You are an AI assistant for ScheduleFlow. 
            User preferences: ${JSON.stringify(contextForAI.preferences)}
            Work pattern: ${JSON.stringify(contextForAI.workPattern)}
            Project preferences: ${JSON.stringify(contextForAI.projectPreference)}
            Communication style: ${JSON.stringify(contextForAI.communicationStyle)}`
          },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const responseContent = completion.choices[0].message.content;
      
      await AIContext.updateContext(
        userId,
        'communication_style',
        { lastInteraction: new Date().toISOString(), message, response: responseContent },
        AIContext.calculateConfidenceScore({ message, response: responseContent })
      );

      return {
        message: responseContent,
        suggestedActions: this.extractSuggestedActions(responseContent)
      };
    } catch (error) {
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        // Extract more specific error from OpenAI API if available
        errorMessage = error.response.data.error.message;
      }
      logger.error('Error processing chat with OpenAI:', { 
        originalError: error.message,
        apiErrorMessage: errorMessage,
        stack: error.stack, 
        userId 
      });
      // Pass the more specific OpenAI error message if available
      throw new Error(`Failed to process chat message with AI: ${errorMessage}`);
    }
  }

  extractSuggestedActions(response) {
    const actions = [];
    const lowerResponse = typeof response === 'string' ? response.toLowerCase() : '';
    
    if (lowerResponse.includes('schedule')) {
      actions.push({
        type: 'SCHEDULE_FOCUS_BLOCK',
        description: 'Create a focus block in your calendar'
      });
    }
    
    if (lowerResponse.includes('task')) {
      actions.push({
        type: 'CREATE_TASK',
        description: 'Add this as a task'
      });
    }
    return actions;
  }

  async generateTaskSuggestions(userId, projectId) {
    try {
      const context = await AIContext.getContextForAI(userId);
      const preferences = await UserPreferences.getPreferences(userId); // This should be robust with defaults

      const prompt = `
        Given the following context:
        Project ID: ${projectId}
        User preferences: ${JSON.stringify(preferences)}
        Work pattern: ${JSON.stringify(context.workPattern)}
        Project preferences: ${JSON.stringify(context.projectPreference)}

        Generate a list of suggested tasks for this project. Consider:
        1. User's work hours and preferences
        2. Project complexity and scope
        3. Priority levels and dependencies
        4. Estimated time requirements

        Return as a JSON object with a single key "suggestions" which is an array of task objects. Each task object should have "title", "description", "priority" (high|medium|low), "estimatedHours" (number), "deadline" (ISO date string or null), and "tags" (array of strings).
        Example: {"suggestions": [{"title": "Task 1", "description": "...", "priority": "high", "estimatedHours": 2, "deadline": "2025-12-01T00:00:00Z", "tags": ["design"]}]}
      `;
      logger.info(`[AIService.generateTaskSuggestions] Attempting to use model: ${DEFAULT_MODEL}`);
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL, 
        messages: [
          { role: "system", content: "You are a helpful assistant that generates task suggestions in the specified JSON format." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0].message.content;
      const parsedResponse = JSON.parse(responseContent.trim());
      const suggestions = parsedResponse.suggestions || [];
      
      await AIContext.updateContext(
        userId,
        'project_preference',
        { lastTaskGeneration: new Date().toISOString(), projectId, suggestionCount: suggestions.length },
        AIContext.calculateConfidenceScore(suggestions)
      );
      return suggestions;
    } catch (error) {
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
      }
      logger.error('Error generating task suggestions with OpenAI:', { originalError: error.message, apiErrorMessage: errorMessage, userId, projectId });
      throw new Error(`Failed to generate task suggestions: ${errorMessage}`);
    }
  }

  async suggestFocusBlocks(userId, startDate, endDate) {
    try {
      const context = await AIContext.getContextForAI(userId);
      // Preferences are now part of contextForAI.preferences
      const preferences = contextForAI.preferences;

      const prompt = `
        Given the following context:
        Date range: ${startDate.toISOString()} to ${endDate.toISOString()}
        User preferences: ${JSON.stringify(preferences)}
        Work pattern: ${JSON.stringify(context.workPattern)}
        Focus time preferences: ${JSON.stringify(preferences?.focus_time_preferences)}

        Generate focus block suggestions.
        Return as JSON object with a "suggestions" key containing an array: {"suggestions": [{
          "title": "Focus block title",
          "startTime": "ISO date string",
          "endTime": "ISO date string",
          "priority": "high|medium|low",
          "type": "focus|break",
          "relatedTaskId": "task-id or null"
        }]}
      `;
      logger.info(`[AIService.suggestFocusBlocks] Attempting to use model: ${DEFAULT_MODEL}`);
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
            { role: "system", content: "You are a helpful assistant that generates focus block suggestions in the specified JSON format." },
            { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });
      
      const responseContent = completion.choices[0].message.content;
      const parsedResponse = JSON.parse(responseContent.trim());
      const suggestions = parsedResponse.suggestions || [];
      
      await AIContext.updateContext(
        userId,
        'work_pattern',
        { lastFocusBlockGeneration: new Date().toISOString(), suggestionCount: suggestions.length },
        AIContext.calculateConfidenceScore(suggestions)
      );
      return suggestions;
    } catch (error) {
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
      }
      logger.error('Error suggesting focus blocks with OpenAI:', { originalError: error.message, apiErrorMessage: errorMessage, userId });
      throw new Error(`Failed to suggest focus blocks: ${errorMessage}`);
    }
  }

  async processEmail(userId, emailData) {
    try {
      const context = await AIContext.getContextForAI(userId);

      const prompt = `
        Analyze the following email:
        From: ${emailData.sender}
        Subject: ${emailData.subject}
        Content: ${emailData.body}

        User context:
        Work pattern: ${JSON.stringify(context.workPattern)}
        Communication style: ${JSON.stringify(context.communicationStyle)}

        Provide the analysis as a JSON object with keys "summary", "actionItems" (array), "calendarEvents" (array), and "followUpActions" (array of strings).
        Example structure for actionItems: [{"title": "Action", "priority": "high", "dueDate": "ISO date string or null"}]
        Example structure for calendarEvents: [{"title": "Event", "startTime": "ISO date string", "endTime": "ISO date string", "type": "meeting"}]
      `;
      logger.info(`[AIService.processEmail] Attempting to use model: ${DEFAULT_MODEL}`);
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
            { role: "system", content: "You are a helpful assistant that analyzes emails and returns structured JSON." },
            { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(completion.choices[0].message.content.trim());
      
      await AIContext.updateContext(
        userId,
        'communication_style',
        { lastEmailProcessed: new Date().toISOString(), emailSubject: emailData.subject },
        AIContext.calculateConfidenceScore(analysis)
      );
      return analysis;
    } catch (error) {
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
      }
      logger.error('Error processing email with OpenAI:', { originalError: error.message, apiErrorMessage: errorMessage, userId });
      throw new Error(`Failed to process email: ${errorMessage}`);
    }
  }

  async suggestMeetingPrepBlocks(userId) {
    // This method doesn't use OpenAI directly, so no model change needed here.
    try {
      // ... (Supabase logic remains the same)
      const { data: meetings } = await supabase.from('meetings').select('*').eq('user_id', userId).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(10);
      if (!meetings || meetings.length === 0) return [];
      const { data: prepBlocks } = await supabase.from('time_blocks').select('*').eq('user_id', userId).eq('block_type', 'prep').gte('start_time', new Date().toISOString());
      const prepBlocksByMeetingId = {};
      if (prepBlocks) { prepBlocks.forEach(block => { if (block.related_meeting_id) prepBlocksByMeetingId[block.related_meeting_id] = true; }); }
      const meetingsNeedingPrep = meetings.filter(meeting => !prepBlocksByMeetingId[meeting.id]);
      return meetingsNeedingPrep.map(meeting => {
        const prepDuration = 30 * 60 * 1000; 
        const meetingStart = new Date(meeting.start_time);
        const idealPrepStart = new Date(meetingStart.getTime() - 2 * 60 * 60 * 1000);
        return {
          user_id: userId, title: `Prep: ${meeting.title}`, start_time: idealPrepStart.toISOString(),
          end_time: new Date(idealPrepStart.getTime() + prepDuration).toISOString(), block_type: 'prep',
          related_meeting_id: meeting.id, notes: `Preparation time for ${meeting.title}`,
          is_ai_suggested: true, is_confirmed: false
        };
      });
    } catch (error) {
      logger.error('Error suggesting meeting prep blocks (Supabase):', { message: error.message, userId });
      return []; // Return empty array on error
    }
  }

  async generateProactiveSuggestions(userId) {
    // This method primarily uses Supabase, no OpenAI model change needed here.
    // (Code for this method remains the same)
    try {
        // ... (Supabase logic remains the same)
        const { data: pendingTasks } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('status', 'pending').order('priority', { ascending: false });
        const suggestions = [];
        const overdueTasks = pendingTasks?.filter(task => task.due_date && new Date(task.due_date) < new Date()) || [];
        if (overdueTasks.length > 0) {
          suggestions.push({ user_id: userId, suggestion_type: 'task', title: 'Overdue tasks need attention', description: `You have ${overdueTasks.length} overdue tasks. Reschedule?`, priority: 'high', action_endpoint: '/api/tasks/reschedule', action_payload: { task_ids: overdueTasks.map(t => t.id) } });
        }
        // ... (add other proactive logic as before) ...
        return suggestions;
    } catch (error) {
        logger.error('Error generating proactive suggestions (Supabase):', { message: error.message, userId });
        return [];
    }
  }

  async getMeetingsWithoutPrep(userId) { 
    // (Supabase logic remains the same)
    try {
        const { data: meetings } = await supabase.from('meetings').select('*').eq('user_id', userId).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(10);
        if (!meetings || meetings.length === 0) return [];
        const { data: prepBlocks } = await supabase.from('time_blocks').select('*').eq('user_id', userId).eq('block_type', 'prep').gte('start_time', new Date().toISOString());
        const prepBlocksByMeetingId = {};
        if (prepBlocks) { prepBlocks.forEach(block => { if (block.related_meeting_id) prepBlocksByMeetingId[block.related_meeting_id] = true; }); }
        return meetings.filter(meeting => !prepBlocksByMeetingId[meeting.id]);
    } catch (error) {
        logger.error('Error in getMeetingsWithoutPrep (Supabase):', { message: error.message, userId });
        return [];
    }
  }

  async suggestAssetsForMeeting(userId, meetingId) {
    try {
      const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
      if (!meeting) throw new Error('Meeting not found');
      const { data: projects } = await supabase.from('projects').select('*, assets(*)').eq('user_id', userId);
      if (!projects || projects.length === 0) return [];
      const allAssets = [];
      projects.forEach(project => { if (project.assets) { project.assets.forEach(asset => { allAssets.push({ ...asset, project_name: project.name }); });}});
      if (allAssets.length === 0) return [];
      
      const prompt = `
        For the meeting titled "${meeting.title}" (Description: ${meeting.description || 'N/A'}), with attendees ${JSON.stringify(meeting.attendees) || 'N/A'} on ${new Date(meeting.start_time).toLocaleString()},
        suggest up to 3 relevant assets from the following list:
        ${allAssets.map(asset => `- ID: ${asset.id}, Name: "${asset.name}", Project: "${asset.project_name}", Desc: ${asset.description || 'No description'}`).join('\n')}
        Respond as a JSON object with a "suggestions" key, like this: {"suggestions": [{"assetId": "...", "reason": "..."}]}.
      `;
      logger.info(`[AIService.suggestAssetsForMeeting] Attempting to use model: ${DEFAULT_MODEL}`);
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: 'You are an expert assistant. Respond in JSON format as specified.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0].message.content;
      const suggestions = JSON.parse(content.trim()).suggestions || [];
      const assetSuggestions = [];
      for (const suggestion of suggestions) {
        const matchingAsset = allAssets.find(asset => asset.id.toString() === (suggestion.assetId ? suggestion.assetId.toString() : ''));
        if (matchingAsset) {
          assetSuggestions.push({
            asset_id: matchingAsset.id, meeting_id: meetingId, user_id: userId,
            reason: suggestion.reason, is_ai_suggested: true, is_confirmed: false
          });
        }
      }
      return assetSuggestions;
    } catch (error) {
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
      }
      logger.error('Error suggesting assets for meeting with OpenAI:', { originalError: error.message, apiErrorMessage: errorMessage, userId, meetingId });
      return [];
    }
  }

  async suggestMeetingPrep(userId, meetingData) {
    try {
      const context = await AIContext.getContextForAI(userId);
      const prompt = `
        Meeting: ${JSON.stringify(meetingData)}
        User context: Work pattern: ${JSON.stringify(context.workPattern)}, Communication style: ${JSON.stringify(context.communicationStyle)}
        Suggest preparation tasks and focus blocks. Return as JSON:
        {"preparationTasks": [{"title": "", "description": "", "estimatedMinutes": 0, "priority": "medium"}], "focusBlocks": [{"title": "", "startTime": "ISO", "endTime": "ISO", "type": "preparation"}]}
      `;
      logger.info(`[AIService.suggestMeetingPrep] Attempting to use model: ${DEFAULT_MODEL}`);
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
            { role: "system", content: "You are a helpful assistant. Respond in JSON format as specified." },
            { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const suggestions = JSON.parse(completion.choices[0].message.content.trim());
      await AIContext.updateContext(userId, 'work_pattern', { lastMeetingPrep: new Date().toISOString(), meetingId: meetingData.id }, AIContext.calculateConfidenceScore(suggestions));
      return suggestions;
    } catch (error) {
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
      }
      logger.error('Error suggesting meeting prep with OpenAI:', { originalError: error.message, apiErrorMessage: errorMessage, userId });
      throw new Error(`Failed to suggest meeting prep: ${errorMessage}`);
    }
  }

  async analyzeProjectBrief(userId, projectId) {
    try {
      const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (!project) throw new Error('Project not found');
      
      const prompt = `
Analyze this creative project brief:
PROJECT DETAILS: Name: ${project.name}, Desc: ${project.description || 'N/A'}, Client: ${project.client_name || 'N/A'}, Deadline: ${project.deadline ? new Date(project.deadline).toLocaleDateString() : 'N/A'}, Budget: ${project.budget || 'N/A'}, Scope: ${project.scope || 'N/A'}
Provide: 1. Key insights (3-5 pts). 2. Potential challenges. 3. Initial task breakdown (5-7 high-level tasks). 4. Time estimate. 5. Clarification questions. Structure clearly.`;
      
      logger.info(`[AIService.analyzeProjectBrief] Attempting to use model: ${DEFAULT_MODEL}`);
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL, // Changed from gpt-4-turbo for wider access
        messages: [
          { role: 'system', content: 'You are an expert creative director providing strategic insights.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });
      
      const analysis = response.choices[0].message.content;
      await supabase.from('project_analyses').insert({ user_id: userId, project_id: projectId, analysis_content: analysis, created_at: new Date().toISOString() });
      return { analysis, project_id: projectId };
    } catch (error) {
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
      }
      logger.error('Error analyzing project brief with OpenAI:', { originalError: error.message, apiErrorMessage: errorMessage, userId, projectId });
      return { analysis: "Could not analyze project brief at this time.", error: true };
    }
  }

  async generateWeeklySummary(userId) {
    try {
      // ... (Supabase logic for fetching data is fine)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const { data: completedTasks } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('status', 'completed').gte('completed_at', startDate.toISOString()).lte('completed_at', endDate.toISOString());
      const { data: meetings } = await supabase.from('meetings').select('*').eq('user_id', userId).gte('start_time', startDate.toISOString()).lte('end_time', endDate.toISOString());
      const { data: focusBlocks } = await supabase.from('time_blocks').select('*').eq('user_id', userId).eq('block_type', 'focus').gte('start_time', startDate.toISOString()).lte('end_time', endDate.toISOString());
      const completedTaskCount = completedTasks?.length || 0;
      const meetingCount = meetings?.length || 0;
      let totalFocusMinutes = 0;
      if (focusBlocks?.length) { focusBlocks.forEach(block => { const start = new Date(block.start_time); const end = new Date(block.end_time); totalFocusMinutes += (end.getTime() - start.getTime()) / (1000 * 60); });}
      const focusHours = Math.round(totalFocusMinutes / 60 * 10) / 10;
      const weekData = { completedTasks: completedTasks || [], meetings: meetings || [], focusBlocks: focusBlocks || [], metrics: { completedTaskCount, meetingCount, focusHours }};
      
      const insights = await this.generateInsightsFromWeekData(userId, weekData);
      
      return { startDate: startDate.toISOString(), endDate: endDate.toISOString(), metrics: weekData.metrics, insights };
    } catch (error) {
      // This catch is for errors in Supabase queries or if generateInsightsFromWeekData throws
      logger.error('Error generating weekly summary (data gathering part):', { message: error.message, stack: error.stack, userId });
      return { error: true, message: "Couldn't generate weekly summary data." };
    }
  }
  
  async generateInsightsFromWeekData(userId, weekData) {
    try {
      const { completedTasks, meetings, metrics } = weekData;
      const prompt = `
Analyze this creative professional's week:
METRICS: Completed Tasks: ${metrics.completedTaskCount}, Meetings Attended: ${metrics.meetingCount}, Focus Time: ${metrics.focusHours} hours.
COMPLETED TASKS:
${(completedTasks || []).map(task => `- ${task.title} (Project: ${task.project_id || 'None'})`).join('\n')}
MEETINGS:
${(meetings || []).map(meeting => `- ${meeting.title} (${new Date(meeting.start_time).toLocaleString()})`).join('\n')}
Based on this data, provide: 1. 3 key insights about their productivity/work patterns. 2. 2 specific suggestions to improve creative flow next week. 3. Any patterns or imbalances.
Be actionable and relevant for creatives valuing deep work.`;
      
      logger.info(`[AIService.generateInsightsFromWeekData] Attempting to use model: ${DEFAULT_MODEL}`);
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: 'You are a productivity coach for creative professionals. Your goal is to help them balance creative flow with client work and administrative tasks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      const insightsText = response.choices[0].message.content;
      await supabase.from('user_insights').insert({ user_id: userId, insight_type: 'weekly', content: insightsText, created_at: new Date().toISOString() });
      return insightsText;
    } catch (error) {
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
      }
      logger.error('Error generating insights from week data with OpenAI:', { originalError: error.message, apiErrorMessage: errorMessage, userId });
      return `Unable to generate insights at this time. (${errorMessage})`;
    }
  }
}

module.exports = new AIService();