// server/src/services/ai-service.js
// REASONING: Changed model from "gpt-4" to "gpt-3.5-turbo" to address model access issues.
// Also ensured all direct OpenAI calls use chat completions for consistency with turbo models.

const OpenAI = require('openai');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const AIContext = require('../models/AIContext');
const UserPreferences = require('../models/UserPreferences');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Consistent model choice
const DEFAULT_MODEL = "gpt-3.5-turbo"; 

class AIService {
  async processChat(userId, message, context = {}) {
    try {
      const contextForAI = await AIContext.getContextForAI(userId);
      
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL, // Using gpt-3.5-turbo
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

      const response = completion.choices[0].message.content;
      
      await AIContext.updateContext(
        userId,
        'communication_style',
        { lastInteraction: new Date().toISOString(), message, response },
        AIContext.calculateConfidenceScore({ message, response })
      );

      return {
        message: response,
        suggestedActions: this.extractSuggestedActions(response)
      };
    } catch (error) {
      // Log the specific error from OpenAI if available
      if (error.response) {
        logger.error('OpenAI API Error in processChat:', { status: error.response.status, data: error.response.data, userId });
      } else {
        logger.error('Error processing chat:', { message: error.message, stack: error.stack, userId });
      }
      // Re-throw a more generic error or the original one
      throw new Error(`Failed to process chat message with AI: ${error.message}`);
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
      const preferences = await UserPreferences.getPreferences(userId);

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

        Return as JSON object with a "suggestions" key containing an array: {"suggestions": [{
          "title": "Task name",
          "description": "Detailed description",
          "priority": "high|medium|low",
          "estimatedHours": "number (e.g., 2 or 0.5)",
          "deadline": "ISO date string or null",
          "tags": ["tag1", "tag2"]
        }]}
      `;
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
      const suggestions = JSON.parse(responseContent.trim()).suggestions || [];
      
      await AIContext.updateContext(
        userId,
        'project_preference',
        { lastTaskGeneration: new Date().toISOString(), projectId, suggestionCount: suggestions.length },
        AIContext.calculateConfidenceScore(suggestions)
      );
      return suggestions;
    } catch (error) {
      if (error.response) {
        logger.error('OpenAI API Error in generateTaskSuggestions:', { status: error.response.status, data: error.response.data, userId, projectId });
      } else {
        logger.error('Error generating task suggestions:', { message: error.message, stack: error.stack, userId, projectId });
      }
      throw new Error(`Failed to generate task suggestions: ${error.message}`);
    }
  }

  async suggestFocusBlocks(userId, startDate, endDate) {
    try {
      const context = await AIContext.getContextForAI(userId);
      const preferences = await UserPreferences.getPreferences(userId);

      const prompt = `
        Given the following context:
        Date range: ${startDate.toISOString()} to ${endDate.toISOString()}
        User preferences: ${JSON.stringify(preferences)}
        Work pattern: ${JSON.stringify(context.workPattern)}
        Focus time preferences: ${JSON.stringify(context.preferences?.focus_time_preferences)}

        Generate focus block suggestions that:
        1. Respect user's work hours and preferences
        2. Consider existing tasks and priorities
        3. Include appropriate breaks
        4. Optimize for productivity

        Return as JSON object with a "suggestions" key containing an array: {"suggestions": [{
          "title": "Focus block title",
          "startTime": "ISO date string",
          "endTime": "ISO date string",
          "priority": "high|medium|low",
          "type": "focus|break",
          "relatedTaskId": "task-id or null"
        }]}
      `;
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
      const suggestions = JSON.parse(responseContent.trim()).suggestions || [];
      
      await AIContext.updateContext(
        userId,
        'work_pattern',
        { lastFocusBlockGeneration: new Date().toISOString(), suggestionCount: suggestions.length },
        AIContext.calculateConfidenceScore(suggestions)
      );
      return suggestions;
    } catch (error) {
       if (error.response) {
        logger.error('OpenAI API Error in suggestFocusBlocks:', { status: error.response.status, data: error.response.data, userId });
      } else {
        logger.error('Error suggesting focus blocks:', { message: error.message, stack: error.stack, userId });
      }
      throw new Error(`Failed to suggest focus blocks: ${error.message}`);
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

        Provide:
        1. A concise summary
        2. Action items with priorities
        3. Suggested calendar events
        4. Recommended follow-up actions

        Return as JSON with format:
        {
          "summary": "Brief summary",
          "actionItems": [{
            "title": "Action item",
            "priority": "high|medium|low",
            "dueDate": "ISO date string or null"
          }],
          "calendarEvents": [{
            "title": "Event title",
            "startTime": "ISO date string",
            "endTime": "ISO date string",
            "type": "meeting|reminder|task"
          }],
          "followUpActions": ["action1", "action2"]
        }
      `;
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
      if (error.response) {
        logger.error('OpenAI API Error in processEmail:', { status: error.response.status, data: error.response.data, userId });
      } else {
        logger.error('Error processing email:', { message: error.message, stack: error.stack, userId });
      }
      throw new Error(`Failed to process email: ${error.message}`);
    }
  }

  async suggestMeetingPrepBlocks(userId) {
    // This method doesn't use OpenAI directly, so no model change needed here.
    try {
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(10);
      
      if (!meetings || meetings.length === 0) return [];
      
      const { data: prepBlocks } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .eq('block_type', 'prep')
        .gte('start_time', new Date().toISOString());
      
      const prepBlocksByMeetingId = {};
      if (prepBlocks) {
        prepBlocks.forEach(block => {
          if (block.related_meeting_id) {
            prepBlocksByMeetingId[block.related_meeting_id] = true;
          }
        });
      }
      
      const meetingsNeedingPrep = meetings.filter(
        meeting => !prepBlocksByMeetingId[meeting.id]
      );
      
      const suggestions = [];
      for (const meeting of meetingsNeedingPrep) {
        const prepDuration = 30 * 60 * 1000; 
        const meetingStart = new Date(meeting.start_time);
        const idealPrepStart = new Date(meetingStart.getTime() - 2 * 60 * 60 * 1000);
        
        suggestions.push({
          user_id: userId,
          title: `Prep: ${meeting.title}`,
          start_time: idealPrepStart.toISOString(),
          end_time: new Date(idealPrepStart.getTime() + prepDuration).toISOString(),
          block_type: 'prep',
          related_meeting_id: meeting.id,
          notes: `Preparation time for ${meeting.title}`,
          is_ai_suggested: true,
          is_confirmed: false
        });
      }
      return suggestions;
    } catch (error) {
      logger.error('Error suggesting meeting prep blocks:', { message: error.message, stack: error.stack, userId });
      return [];
    }
  }

  async generateProactiveSuggestions(userId) {
    // This method primarily uses Supabase, no OpenAI model change needed here.
    // (Code for this method remains the same)
    try {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      const { data: logs } = await supabase
        .from('event_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      const { data: pendingTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('priority', { ascending: false });
      
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);
      
      const suggestions = [];
      
      const overdueTasks = pendingTasks?.filter(task => 
        task.due_date && new Date(task.due_date) < new Date()
      ) || [];
      
      if (overdueTasks.length > 0) {
        suggestions.push({
          user_id: userId,
          suggestion_type: 'task',
          title: 'Overdue tasks need attention',
          description: `You have ${overdueTasks.length} overdue tasks. Would you like to reschedule them?`,
          priority: 'high',
          action_endpoint: '/api/tasks/reschedule',
          action_payload: { task_ids: overdueTasks.map(t => t.id) }
        });
      }
      
      const meetingsWithoutPrep = await this.getMeetingsWithoutPrep(userId);
      
      if (meetingsWithoutPrep.length > 0) {
        const nextMeeting = meetingsWithoutPrep[0];
        suggestions.push({
          user_id: userId,
          suggestion_type: 'prep',
          title: 'Schedule prep time for upcoming meeting',
          description: `You have a meeting "${nextMeeting.title}" coming up. Would you like to schedule prep time?`,
          priority: 'medium',
          related_meeting_id: nextMeeting.id,
          action_endpoint: '/api/calendar/suggest-prep',
          action_payload: { meeting_id: nextMeeting.id }
        });
      }
      
      const { data: focusBlocks } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .eq('block_type', 'focus')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });
      
      if (!focusBlocks || focusBlocks.length === 0) {
        suggestions.push({
          user_id: userId,
          suggestion_type: 'focus_block',
          title: 'Schedule focus time',
          description: `You don't have any focus blocks scheduled. Would you like to add some to protect your creative flow?`,
          priority: 'medium',
          action_endpoint: '/api/calendar/suggest-focus',
          action_payload: {}
        });
      }
      
      return suggestions;
    } catch (error) {
      logger.error('Error generating proactive suggestions:', { message: error.message, stack: error.stack, userId });
      return [];
    }
  }

  async getMeetingsWithoutPrep(userId) {
    // This method uses Supabase, no OpenAI model change needed here.
    // (Code for this method remains the same)
    try {
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(10);
      
      if (!meetings || meetings.length === 0) {
        return [];
      }
      
      const { data: prepBlocks } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .eq('block_type', 'prep')
        .gte('start_time', new Date().toISOString());
      
      const prepBlocksByMeetingId = {};
      if (prepBlocks) {
        prepBlocks.forEach(block => {
          if (block.related_meeting_id) {
            prepBlocksByMeetingId[block.related_meeting_id] = true;
          }
        });
      }
      
      return meetings.filter(
        meeting => !prepBlocksByMeetingId[meeting.id]
      );
    } catch (error) {
      logger.error('Error getting meetings without prep:', { message: error.message, stack: error.stack, userId });
      return [];
    }
  }

  async suggestAssetsForMeeting(userId, meetingId) {
    try {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();
      
      if (!meeting) throw new Error('Meeting not found');
      
      const { data: projects } = await supabase
        .from('projects')
        .select('*, assets(*)') 
        .eq('user_id', userId);
      
      if (!projects || projects.length === 0) return [];
      
      const allAssets = [];
      projects.forEach(project => {
        if (project.assets) {
          project.assets.forEach(asset => {
            allAssets.push({ ...asset, project_name: project.name });
          });
        }
      });
      
      if (allAssets.length === 0) return [];
      
      const prompt = `
        Based on this upcoming meeting, suggest relevant assets/files that the user might need:
        MEETING DETAILS:
        - Title: ${meeting.title}
        - Description: ${meeting.description || 'No description available'}
        - Attendees: ${JSON.stringify(meeting.attendees) || 'Not specified'}
        - Date/Time: ${new Date(meeting.start_time).toLocaleString()}
        AVAILABLE ASSETS:
        ${allAssets.map(asset => 
          `- "${asset.name}" (from project "${asset.project_name}") - ${asset.description || 'No description'}`
        ).join('\n')}
        Based on the meeting details and available assets, suggest up to 3 most relevant assets.
        Return as JSON object with a "suggestions" key: {"suggestions": [{"assetId": "...", "reason": "..."}]}.
      `;
      
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL, // Changed to gpt-3.5-turbo
        messages: [
          { role: 'system', content: 'You are an expert assistant. Respond in JSON format.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0].message.content;
      const suggestions = JSON.parse(content).suggestions || [];
      const assetSuggestions = [];
      
      for (const suggestion of suggestions) {
        const matchingAsset = allAssets.find(asset => 
          asset.id.toString() === (suggestion.assetId ? suggestion.assetId.toString() : '')
        );
        
        if (matchingAsset) {
          assetSuggestions.push({
            asset_id: matchingAsset.id,
            meeting_id: meetingId,
            user_id: userId,
            reason: suggestion.reason,
            is_ai_suggested: true,
            is_confirmed: false
          });
        }
      }
      return assetSuggestions;
    } catch (error) {
      if (error.response) {
        logger.error('OpenAI API Error in suggestAssetsForMeeting:', { status: error.response.status, data: error.response.data, userId, meetingId });
      } else {
        logger.error('Error suggesting assets for meeting:', { message: error.message, stack: error.stack, userId, meetingId });
      }
      return [];
    }
  }

  async suggestMeetingPrep(userId, meetingData) {
    try {
      const context = await AIContext.getContextForAI(userId);
      const prompt = `
        Given the following meeting details:
        ${JSON.stringify(meetingData)}
        User context:
        Work pattern: ${JSON.stringify(context.workPattern)}
        Communication style: ${JSON.stringify(context.communicationStyle)}
        Suggest preparation tasks and focus blocks for this meeting.
        Return as JSON with format:
        {
          "preparationTasks": [{"title": "Task title", "description": "Task details", "estimatedMinutes": 0, "priority": "medium"}],
          "focusBlocks": [{"title": "Focus block title", "startTime": "ISO date string", "endTime": "ISO date string", "type": "preparation"}]
        }
      `;
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL, // Changed to gpt-3.5-turbo
        messages: [
            { role: "system", content: "You are a helpful assistant. Respond in JSON format." },
            { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const suggestions = JSON.parse(completion.choices[0].message.content.trim());
      
      await AIContext.updateContext(
        userId,
        'work_pattern',
        { lastMeetingPrep: new Date().toISOString(), meetingId: meetingData.id },
        AIContext.calculateConfidenceScore(suggestions)
      );
      return suggestions;
    } catch (error) {
      if (error.response) {
        logger.error('OpenAI API Error in suggestMeetingPrep:', { status: error.response.status, data: error.response.data, userId });
      } else {
        logger.error('Error suggesting meeting prep:', { message: error.message, stack: error.stack, userId });
      }
      throw new Error(`Failed to suggest meeting prep: ${error.message}`);
    }
  }

  async analyzeProjectBrief(userId, projectId) {
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (!project) throw new Error('Project not found');
      
      const prompt = `
Analyze this creative project brief and provide insights:
PROJECT DETAILS:
- Name: ${project.name}
- Description: ${project.description || 'No description provided'}
- Client: ${project.client_name || 'Not specified'}
- Deadline: ${project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Not specified'}
- Budget: ${project.budget || 'Not specified'}
- Scope: ${project.scope || 'Not specified'}
As an experienced creative professional, analyze this brief and provide:
1. Key insights (3-5 points)
2. Potential challenges
3. Initial task breakdown (5-7 high-level tasks)
4. Time estimate
5. Clarification questions
Provide your response structured clearly.`;
      
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL, // Changed to gpt-3.5-turbo (gpt-4-turbo could also be an option for quality if access permits)
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert creative director.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });
      
      const analysis = response.choices[0].message.content;
      
      await supabase.from('project_analyses').insert({
        user_id: userId,
        project_id: projectId,
        analysis_content: analysis,
        created_at: new Date().toISOString()
      });
      
      return { analysis, project_id: projectId };
    } catch (error) {
      if (error.response) {
        logger.error('OpenAI API Error in analyzeProjectBrief:', { status: error.response.status, data: error.response.data, userId, projectId });
      } else {
        logger.error('Error analyzing project brief:', { message: error.message, stack: error.stack, userId, projectId });
      }
      return { analysis: "Could not analyze project brief.", error: true };
    }
  }

  async generateWeeklySummary(userId) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      const { data: completedTasks } = await supabase
        .from('tasks').select('*').eq('user_id', userId).eq('status', 'completed')
        .gte('completed_at', startDate.toISOString()).lte('completed_at', endDate.toISOString());
      
      const { data: meetings } = await supabase
        .from('meetings').select('*').eq('user_id', userId)
        .gte('start_time', startDate.toISOString()).lte('end_time', endDate.toISOString());
      
      const { data: focusBlocks } = await supabase
        .from('time_blocks').select('*').eq('user_id', userId).eq('block_type', 'focus')
        .gte('start_time', startDate.toISOString()).lte('end_time', endDate.toISOString());
      
      const completedTaskCount = completedTasks?.length || 0;
      const meetingCount = meetings?.length || 0;
      let totalFocusMinutes = 0;
      if (focusBlocks && focusBlocks.length > 0) {
        focusBlocks.forEach(block => {
          const start = new Date(block.start_time);
          const end = new Date(block.end_time);
          const durationMs = end.getTime() - start.getTime();
          totalFocusMinutes += durationMs / (1000 * 60);
        });
      }
      const focusHours = Math.round(totalFocusMinutes / 60 * 10) / 10;
      
      const weekData = {
        completedTasks: completedTasks || [],
        meetings: meetings || [],
        focusBlocks: focusBlocks || [],
        metrics: { completedTaskCount, meetingCount, focusHours }
      };
      
      const insights = await this.generateInsightsFromWeekData(userId, weekData);
      
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        metrics: weekData.metrics,
        insights
      };
    } catch (error) {
      logger.error('Error generating weekly summary:', { message: error.message, stack: error.stack, userId });
      return { error: true, message: "Couldn't generate weekly summary." };
    }
  }
  
  async generateInsightsFromWeekData(userId, weekData) {
    try {
      const { completedTasks, meetings, metrics } = weekData;
      const prompt = `
Analyze this creative professional's week:
METRICS: Completed Tasks: ${metrics.completedTaskCount}, Meetings: ${metrics.meetingCount}, Focus Time: ${metrics.focusHours} hours.
COMPLETED TASKS:
${(completedTasks || []).map(task => `- ${task.title}`).join('\n')}
MEETINGS:
${(meetings || []).map(meeting => `- ${meeting.title} (${new Date(meeting.start_time).toLocaleString()})`).join('\n')}
Provide: 1. 3 key insights. 2. 2 suggestions for next week. 3. Patterns/imbalances.
Keep insights actionable for creatives valuing deep work.`;
      
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL, // Changed to gpt-3.5-turbo
        messages: [
          { role: 'system', content: 'You are a productivity coach for creative professionals.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      const insightsText = response.choices[0].message.content;
      
      await supabase.from('user_insights').insert({
        user_id: userId,
        insight_type: 'weekly',
        content: insightsText,
        created_at: new Date().toISOString()
      });
      return insightsText;
    } catch (error) {
      if (error.response) {
        logger.error('OpenAI API Error in generateInsightsFromWeekData:', { status: error.response.status, data: error.response.data, userId });
      } else {
        logger.error('Error generating insights from week data:', { message: error.message, stack: error.stack, userId });
      }
      return "Unable to generate insights.";
    }
  }
}

module.exports = new AIService();