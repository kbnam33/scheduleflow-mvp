// AI Service for ScheduleFlow MVP
// This service handles all interactions with OpenAI API

const { Configuration, OpenAIApi } = require('openai');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const AIContext = require('../models/AIContext');
const UserPreferences = require('../models/UserPreferences');

// Initialize OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/**
 * AI Service for handling all OpenAI interactions
 */
class AIService {
  /**
   * Process a chat message and generate a response
   * @param {string} userId - User ID
   * @param {string} message - User's message
   * @param {Object} context - Additional context (projects, tasks, etc.)
   * @returns {Promise<Object>} - AI response
   */
  async processChat(userId, message, context = {}) {
    try {
      const contextForAI = await AIContext.getContextForAI(userId);
      
      const completion = await openai.createChatCompletion({
        model: "gpt-4",
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

      const response = completion.data.choices[0].message.content;
      
      // Log the interaction
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
      logger.error('Error processing chat:', error);
      throw error;
    }
  }

  /**
   * Extract suggested actions from AI response
   * @param {string} response - AI response text
   * @returns {Array} - Extracted action objects
   */
  extractSuggestedActions(response) {
    const actions = [];
    
    if (response.toLowerCase().includes('schedule')) {
      actions.push({
        type: 'SCHEDULE_FOCUS_BLOCK',
        description: 'Create a focus block in your calendar'
      });
    }
    
    if (response.toLowerCase().includes('task')) {
      actions.push({
        type: 'CREATE_TASK',
        description: 'Add this as a task'
      });
    }

    return actions;
  }

  /**
   * Generate task suggestions for a project
   * @param {string} userId - User ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} - Array of suggested tasks
   */
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

        Return as JSON array with format:
        [{
          "title": "Task name",
          "description": "Detailed description",
          "priority": "high|medium|low",
          "estimatedHours": number,
          "deadline": "ISO date",
          "tags": ["tag1", "tag2"]
        }]
      `;

      const completion = await openai.createCompletion({
        model: "gpt-4",
        prompt,
        max_tokens: 1000,
        temperature: 0.5
      });

      const suggestions = JSON.parse(completion.data.choices[0].text.trim());
      
      // Update AI context with the generated suggestions
      await AIContext.updateContext(
        userId,
        'project_preference',
        { lastTaskGeneration: new Date().toISOString(), projectId, suggestionCount: suggestions.length },
        AIContext.calculateConfidenceScore(suggestions)
      );

      return suggestions;
    } catch (error) {
      logger.error('Error generating task suggestions:', error);
      throw error;
    }
  }

  /**
   * Suggest focus blocks based on user's schedule
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date for suggestions
   * @param {Date} endDate - End date for suggestions
   * @returns {Promise<Array>} - Array of suggested focus blocks
   */
  async suggestFocusBlocks(userId, startDate, endDate) {
    try {
      const context = await AIContext.getContextForAI(userId);
      const preferences = await UserPreferences.getPreferences(userId);

      const prompt = `
        Given the following context:
        Date range: ${startDate.toISOString()} to ${endDate.toISOString()}
        User preferences: ${JSON.stringify(preferences)}
        Work pattern: ${JSON.stringify(context.workPattern)}
        Focus time preferences: ${JSON.stringify(context.preferences.focus_time_preferences)}

        Generate focus block suggestions that:
        1. Respect user's work hours and preferences
        2. Consider existing tasks and priorities
        3. Include appropriate breaks
        4. Optimize for productivity

        Return as JSON array with format:
        [{
          "title": "Focus block title",
          "startTime": "ISO date",
          "endTime": "ISO date",
          "priority": "high|medium|low",
          "type": "focus|break",
          "relatedTaskId": "task-id or null"
        }]
      `;

      const completion = await openai.createCompletion({
        model: "gpt-4",
        prompt,
        max_tokens: 1000,
        temperature: 0.5
      });

      const suggestions = JSON.parse(completion.data.choices[0].text.trim());
      
      // Update AI context with the generated suggestions
      await AIContext.updateContext(
        userId,
        'work_pattern',
        { lastFocusBlockGeneration: new Date().toISOString(), suggestionCount: suggestions.length },
        AIContext.calculateConfidenceScore(suggestions)
      );

      return suggestions;
    } catch (error) {
      logger.error('Error suggesting focus blocks:', error);
      throw error;
    }
  }

  /**
   * Process email and generate an appropriate response
   * @param {string} userId - User ID 
   * @param {Object} email - Email object with subject, body, sender
   * @returns {Promise<Object>} - Response data with suggested reply
   */
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
            "dueDate": "ISO date or null"
          }],
          "calendarEvents": [{
            "title": "Event title",
            "startTime": "ISO date",
            "endTime": "ISO date",
            "type": "meeting|reminder|task"
          }],
          "followUpActions": ["action1", "action2"]
        }
      `;

      const completion = await openai.createCompletion({
        model: "gpt-4",
        prompt,
        max_tokens: 1000,
        temperature: 0.5
      });

      const analysis = JSON.parse(completion.data.choices[0].text.trim());
      
      // Update AI context with the email processing
      await AIContext.updateContext(
        userId,
        'communication_style',
        { lastEmailProcessed: new Date().toISOString(), emailSubject: emailData.subject },
        AIContext.calculateConfidenceScore(analysis)
      );

      return analysis;
    } catch (error) {
      logger.error('Error processing email:', error);
      throw error;
    }
  }

  /**
   * Suggest meeting preparation blocks
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of suggested prep blocks
   */
  async suggestMeetingPrepBlocks(userId) {
    try {
      // Fetch upcoming meetings without prep blocks
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
      
      // Fetch existing prep blocks
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
      
      // Filter meetings that don't have prep blocks
      const meetingsNeedingPrep = meetings.filter(
        meeting => !prepBlocksByMeetingId[meeting.id]
      );
      
      // Generate prep block suggestions
      const suggestions = [];
      
      for (const meeting of meetingsNeedingPrep) {
        // Calculate prep time (30 min by default)
        const prepDuration = 30 * 60 * 1000; // 30 minutes
        
        // Find a good time for prep (ideally 1-3 hours before the meeting)
        const meetingStart = new Date(meeting.start_time);
        const idealPrepStart = new Date(meetingStart.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
        
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
      logger.error('Error suggesting meeting prep blocks:', error);
      return [];
    }
  }

  /**
   * Generate proactive suggestions based on user activity
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of suggestions
   */
  async generateProactiveSuggestions(userId) {
    try {
      // Get user context
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      // Get recent activity logs
      const { data: logs } = await supabase
        .from('event_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Get pending tasks
      const { data: pendingTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('priority', { ascending: false });
      
      // Get upcoming meetings
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);
      
      // Check for trigger conditions and generate suggestions
      const suggestions = [];
      
      // 1. Check for overdue tasks
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
      
      // 2. Check for upcoming meetings without prep time
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
      
      // 3. Check for unscheduled focus time
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
      logger.error('Error generating proactive suggestions:', error);
      return [];
    }
  }

  /**
   * Get meetings without preparation blocks
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Meetings without prep blocks
   */
  async getMeetingsWithoutPrep(userId) {
    try {
      // Fetch upcoming meetings
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
      
      // Fetch existing prep blocks
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
      
      // Filter meetings that don't have prep blocks
      return meetings.filter(
        meeting => !prepBlocksByMeetingId[meeting.id]
      );
    } catch (error) {
      logger.error('Error getting meetings without prep:', error);
      return [];
    }
  }

  /**
   * Generate asset suggestions for a meeting
   * @param {string} userId - User ID
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Array>} - Array of suggested assets
   */
  async suggestAssetsForMeeting(userId, meetingId) {
    try {
      // Fetch meeting details
      const { data: meeting } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();
      
      if (!meeting) {
        throw new Error('Meeting not found');
      }
      
      // Fetch user's projects and assets
      const { data: projects } = await supabase
        .from('projects')
        .select('*, assets(*)') // Note: This uses 'assets' table rather than 'project_assets'
        .eq('user_id', userId);
      
      if (!projects || projects.length === 0) {
        return [];
      }
      
      // Extract all assets
      const allAssets = [];
      projects.forEach(project => {
        if (project.assets) {
          project.assets.forEach(asset => {
            allAssets.push({
              ...asset,
              project_name: project.name
            });
          });
        }
      });
      
      if (allAssets.length === 0) {
        return [];
      }
      
      // Prepare prompt for OpenAI
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

Based on the meeting details and available assets, suggest up to 3 most relevant assets that the user should have prepared for this meeting.
For each suggested asset, provide:
1. Asset ID
2. A brief reason why it's relevant (1-2 sentences)

Format each suggestion in JSON without explanation:
`;
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are an expert assistant that helps creative professionals prepare for meetings by suggesting relevant assets.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });
      
      // Parse response
      const content = response.choices[0].message.content;
      const suggestions = JSON.parse(content).suggestions || [];
      // Process each suggestion to match with actual assets
      const assetSuggestions = [];
      
      for (const suggestion of suggestions) {
        // Find the asset by ID
        const matchingAsset = allAssets.find(asset => 
          asset.id.toString() === suggestion.assetId.toString()
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
      logger.error('Error suggesting assets for meeting:', error);
      return [];
    }
  }

  /**
   * Suggest meeting preparation blocks
   * @param {string} userId - User ID
   * @param {Object} meetingData - Meeting data
   * @returns {Promise<Object>} - Suggested prep blocks
   */
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
        Consider:
        1. Meeting type and importance
        2. Required materials and research
        3. User's work style and preferences
        4. Available time before meeting

        Return as JSON with format:
        {
          "preparationTasks": [{
            "title": "Task title",
            "description": "Task details",
            "estimatedMinutes": number,
            "priority": "high|medium|low"
          }],
          "focusBlocks": [{
            "title": "Focus block title",
            "startTime": "ISO date",
            "endTime": "ISO date",
            "type": "preparation|review"
          }]
        }
      `;

      const completion = await openai.createCompletion({
        model: "gpt-4",
        prompt,
        max_tokens: 1000,
        temperature: 0.5
      });

      const suggestions = JSON.parse(completion.data.choices[0].text.trim());
      
      // Update AI context with the meeting prep suggestions
      await AIContext.updateContext(
        userId,
        'work_pattern',
        { lastMeetingPrep: new Date().toISOString(), meetingId: meetingData.id },
        AIContext.calculateConfidenceScore(suggestions)
      );

      return suggestions;
    } catch (error) {
      logger.error('Error suggesting meeting prep:', error);
      throw error;
    }
  }

  /**
   * Analyze project brief and generate insights
   * @param {string} userId - User ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} - Project insights and suggestions
   */
  async analyzeProjectBrief(userId, projectId) {
    try {
      // Fetch project details
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Prepare prompt for OpenAI
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
1. Key insights (3-5 points that stand out about this project)
2. Potential challenges or risks to be aware of
3. Initial task breakdown (5-7 high-level tasks that would be needed)
4. Time estimate for completion (based on typical creative workflow)
5. Questions that should be asked for clarification (if brief is incomplete)

Provide your response structured clearly under these headings.
`;
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert creative director with extensive experience in managing design, content, and creative projects. Help analyze this brief and provide strategic insights.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });
      
      // Extract response
      const analysis = response.choices[0].message.content;
      
      // Save analysis to database
      await supabase.from('project_analyses').insert({
        user_id: userId,
        project_id: projectId,
        analysis_content: analysis,
        created_at: new Date().toISOString()
      });
      
      return {
        analysis,
        project_id: projectId
      };
    } catch (error) {
      logger.error('Error analyzing project brief:', error);
      return {
        analysis: "Could not analyze the project brief at this time.",
        error: true
      };
    }
  }

  /**
   * Generate weekly summary and insights for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Weekly summary and insights
   */
  async generateWeeklySummary(userId) {
    try {
      // Calculate date range for the past week
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      // Fetch completed tasks
      const { data: completedTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString());
      
      // Fetch meetings attended
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString());
      
      // Fetch focus blocks used
      const { data: focusBlocks } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .eq('block_type', 'focus')
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString());
      
      // Calculate metrics
      const completedTaskCount = completedTasks?.length || 0;
      const meetingCount = meetings?.length || 0;
      
      // Calculate total focus time in hours
      let totalFocusMinutes = 0;
      if (focusBlocks && focusBlocks.length > 0) {
        focusBlocks.forEach(block => {
          const start = new Date(block.start_time);
          const end = new Date(block.end_time);
          const durationMs = end - start;
          totalFocusMinutes += durationMs / (1000 * 60); // Convert ms to minutes
        });
      }
      const focusHours = Math.round(totalFocusMinutes / 60 * 10) / 10; // Round to 1 decimal
      
      // Prepare data for analysis
      const weekData = {
        completedTasks: completedTasks || [],
        meetings: meetings || [],
        focusBlocks: focusBlocks || [],
        metrics: {
          completedTaskCount,
          meetingCount,
          focusHours
        }
      };
      
      // Generate insights from the data
      const insights = await this.generateInsightsFromWeekData(userId, weekData);
      
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        metrics: weekData.metrics,
        insights
      };
    } catch (error) {
      logger.error('Error generating weekly summary:', error);
      return {
        error: true,
        message: "Couldn't generate weekly summary at this time."
      };
    }
  }
  
  /**
   * Generate insights from weekly data
   * @param {string} userId - User ID
   * @param {Object} weekData - Weekly activity data
   * @returns {Promise<Array>} - Insights and suggestions
   */
  async generateInsightsFromWeekData(userId, weekData) {
    try {
      const { completedTasks, meetings, focusBlocks, metrics } = weekData;
      
      // Prepare prompt for OpenAI
      const prompt = `
Analyze this creative professional's week and provide helpful insights:

WEEKLY METRICS:
- Completed Tasks: ${metrics.completedTaskCount}
- Meetings Attended: ${metrics.meetingCount}
- Focus Time: ${metrics.focusHours} hours

COMPLETED TASKS:
${completedTasks.map(task => `- ${task.title} (Project: ${task.project_id || 'None'})`).join('\n')}

MEETINGS:
${meetings.map(meeting => `- ${meeting.title} (${new Date(meeting.start_time).toLocaleString()})`).join('\n')}

Based on this data, provide:
1. 3 key insights about their productivity and work patterns
2. 2 specific suggestions to improve their creative flow next week
3. Any patterns or imbalances between focus time and meetings

Keep insights actionable and relevant to creative professionals who value deep work time.
`;
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are a productivity coach for creative professionals. Your goal is to help them balance creative flow with client work and administrative tasks. Provide insights that help protect their deep work time while still meeting obligations.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      // Extract insights
      const insightsText = response.choices[0].message.content;
      
      // Save insights to database
      await supabase.from('user_insights').insert({
        user_id: userId,
        insight_type: 'weekly',
        content: insightsText,
        created_at: new Date().toISOString()
      });
      
      return insightsText;
    } catch (error) {
      logger.error('Error generating insights from week data:', error);
      return "Unable to generate insights at this time.";
    }
  }
}

module.exports = new AIService();