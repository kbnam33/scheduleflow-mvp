// AI Service for ScheduleFlow MVP
// This service handles all interactions with OpenAI API

const { OpenAI } = require('openai');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      // Fetch recent chat history for context
      const { data: chatHistory, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Error fetching chat history:', error);
        throw new Error('Failed to fetch chat history');
      }

      // Format chat history for OpenAI
      const formattedHistory = chatHistory
        .reverse()
        .map(chat => ({
          role: chat.is_user ? 'user' : 'assistant',
          content: chat.message
        }));

      // Prepare system message with user context
      const systemMessage = await this.prepareSystemMessage(userId, context);

      // Combine all messages
      const messages = [
        { role: 'system', content: systemMessage },
        ...formattedHistory,
        { role: 'user', content: message }
      ];

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      // Extract response content
      const aiResponse = response.choices[0].message.content;

      // Save the conversation to the database
      await this.saveConversation(userId, message, aiResponse, context);

      return {
        message: aiResponse,
        suggestedActions: this.extractSuggestedActions(aiResponse)
      };
    } catch (error) {
      logger.error('Error in AI chat processing:', error);
      return {
        message: "I'm having trouble connecting right now. Please try again in a moment.",
        error: true
      };
    }
  }

  /**
   * Prepare the system message with user context
   * @param {string} userId - User ID
   * @param {Object} context - Additional context
   * @returns {Promise<string>} - System message
   */
  async prepareSystemMessage(userId, context) {
    try {
      // Fetch user details
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      // Fetch upcoming meetings
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      // Fetch pending tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .limit(10);

      // Construct system message
      const systemMessage = `
You are ScheduleFlow, an intelligent AI assistant for creative freelancers. You help with scheduling, task management, and project organization. 

USER INFORMATION:
- Name: ${user.full_name}
- Profession: ${user.profession || 'Creative Freelancer'}
- Preferences: ${JSON.stringify(user.creative_preferences || {})}

CONTEXT:
${meetings && meetings.length > 0 ? `- Upcoming Meetings: ${meetings.length}` : '- No upcoming meetings'}
${tasks && tasks.length > 0 ? `- Pending Tasks: ${tasks.length}` : '- No pending tasks'}
${context.currentProject ? `- Current Project: ${context.currentProject.name}` : ''}

Your goal is to help the user stay in their creative flow by managing their schedule and tasks. Be proactive with suggestions but concise in your responses. You can suggest:
1. Focus blocks for deep work
2. Preparation time for meetings
3. Task prioritization
4. Project organization

For scheduling, suggest specific times based on their calendar. For tasks, be concrete and actionable.

Keep responses friendly but brief. If asked about features beyond your capabilities, explain what you can do instead.
`;

      return systemMessage;
    } catch (error) {
      logger.error('Error preparing system message:', error);
      // Return a default system message if error occurs
      return `You are ScheduleFlow, an intelligent AI assistant for creative freelancers. Help the user with scheduling, task management, and project organization.`;
    }
  }

  /**
   * Extract suggested actions from AI response
   * @param {string} response - AI response text
   * @returns {Array} - Extracted action objects
   */
  extractSuggestedActions(response) {
    const actions = [];
    
    // Check for scheduling suggestions
    if (response.includes('schedule') || response.includes('block time') || response.includes('focus block')) {
      actions.push({
        type: 'SCHEDULE_FOCUS_BLOCK',
        description: 'Create a focus block in your calendar'
      });
    }
    
    // Check for task suggestions
    if (response.includes('task') || response.includes('to-do') || response.includes('todo')) {
      actions.push({
        type: 'CREATE_TASK',
        description: 'Add this as a task'
      });
    }
    
    return actions;
  }

  /**
   * Save conversation to database
   * @param {string} userId - User ID
   * @param {string} userMessage - User's message
   * @param {string} aiResponse - AI response
   * @param {Object} context - Conversation context
   */
  async saveConversation(userId, userMessage, aiResponse, context) {
    try {
      // Save user message
      await supabase.from('chat_history').insert({
        user_id: userId,
        message: userMessage,
        is_user: true,
        related_project_id: context.projectId || null,
        related_context: context
      });
      
      // Save AI response
      await supabase.from('chat_history').insert({
        user_id: userId,
        message: aiResponse,
        is_user: false,
        related_project_id: context.projectId || null,
        related_context: context
      });
    } catch (error) {
      logger.error('Error saving conversation:', error);
    }
  }

  /**
   * Generate task suggestions for a project
   * @param {string} userId - User ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} - Array of suggested tasks
   */
  async generateTaskSuggestions(userId, projectId) {
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
      
      // Fetch existing tasks for context
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId);
      
      // Prepare prompt for OpenAI
      const prompt = `
Based on this creative project, suggest 5 specific tasks that would help complete it.

PROJECT DETAILS:
- Name: ${project.name}
- Description: ${project.description || 'No description'}
- Client: ${project.client_name || 'No client specified'}
- Deadline: ${project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline'}

EXISTING TASKS (DO NOT DUPLICATE):
${existingTasks && existingTasks.length > 0 
  ? existingTasks.map(task => `- ${task.title}`).join('\n')
  : 'No existing tasks.'}

Suggest 5 specific, actionable tasks that would help complete this project successfully. For each task, include:
1. A clear, concise title (10 words or less)
2. A brief description (1-2 sentences)
3. Estimated hours to complete (1-8)
4. Priority level (high, medium, low)

Format each task in JSON without explanation:
`;

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are a project management assistant that helps creative freelancers plan their projects effectively.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      // Parse response
      const content = response.choices[0].message.content;
      const suggestions = JSON.parse(content).tasks || [];
      
      return suggestions.map(task => ({
        ...task,
        project_id: projectId,
        user_id: userId,
        is_ai_suggested: true
      }));
    } catch (error) {
      logger.error('Error generating task suggestions:', error);
      return [];
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
      // Fetch existing time blocks
      const { data: existingBlocks } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString());
      
      // Fetch meetings
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString());
      
      // Fetch pending tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('priority', { ascending: false });
      
      // Fetch user preferences
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      // Prepare data for the algorithm
      const schedule = {
        existingBlocks: existingBlocks || [],
        meetings: meetings || [],
        tasks: tasks || [],
        preferences: user?.creative_preferences || {}
      };
      
      // Process schedule to find free slots
      const availableSlots = this.findAvailableTimeSlots(schedule, startDate, endDate);
      
      // Generate focus block suggestions
      const suggestedBlocks = this.generateFocusBlockSuggestions(
        availableSlots, 
        schedule.tasks,
        schedule.preferences
      );
      
      return suggestedBlocks.map(block => ({
        ...block,
        user_id: userId,
        is_ai_suggested: true,
        is_confirmed: false
      }));
    } catch (error) {
      logger.error('Error suggesting focus blocks:', error);
      return [];
    }
  }

  /**
   * Find available time slots in the schedule
   * @param {Object} schedule - User's schedule data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} - Available time slots
   */
  findAvailableTimeSlots(schedule, startDate, endDate) {
    // Combine all calendar events
    const allEvents = [
      ...schedule.existingBlocks,
      ...schedule.meetings
    ].map(event => ({
      start: new Date(event.start_time),
      end: new Date(event.end_time)
    })).sort((a, b) => a.start - b.start);
    
    // Define working hours (default: 9 AM to 5 PM)
    const workingHours = {
      start: 9, // 9 AM
      end: 17   // 5 PM
    };
    
    // Override with user preferences if available
    if (schedule.preferences.workingHours) {
      workingHours.start = schedule.preferences.workingHours.start || workingHours.start;
      workingHours.end = schedule.preferences.workingHours.end || workingHours.end;
    }
    
    const availableSlots = [];
    const currentDate = new Date(startDate);
    
    // Iterate through each day
    while (currentDate <= endDate) {
      // Skip weekends (0 = Sunday, 6 = Saturday)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Set working hours for the day
        const dayStart = new Date(currentDate);
        dayStart.setHours(workingHours.start, 0, 0, 0);
        
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(workingHours.end, 0, 0, 0);
        
        // Filter events for current day
        const dayEvents = allEvents.filter(event => 
          event.start.toDateString() === currentDate.toDateString()
        );
        
        // Find free slots between events
        let currentTime = dayStart;
        
        for (const event of dayEvents) {
          // If there's time before the event, add it as an available slot
          if (event.start > currentTime && event.start - currentTime >= 30 * 60 * 1000) { // 30 min minimum
            availableSlots.push({
              start: new Date(currentTime),
              end: new Date(event.start)
            });
          }
          // Move current time to after this event
          currentTime = new Date(Math.max(currentTime.getTime(), event.end.getTime()));
        }
        
        // Add time after the last event until end of day
        if (dayEnd > currentTime && dayEnd - currentTime >= 30 * 60 * 1000) {
          availableSlots.push({
            start: new Date(currentTime),
            end: new Date(dayEnd)
          });
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }
    
    return availableSlots;
  }

  /**
   * Generate focus block suggestions from available slots
   * @param {Array} availableSlots - Available time slots
   * @param {Array} tasks - Pending tasks
   * @param {Object} preferences - User preferences
   * @returns {Array} - Suggested focus blocks
   */
  generateFocusBlockSuggestions(availableSlots, tasks, preferences) {
    const suggestedBlocks = [];
    const minFocusBlockDuration = 60 * 60 * 1000; // 1 hour in milliseconds
    const optimalFocusBlockDuration = 90 * 60 * 1000; // 1.5 hours in milliseconds
    
    // Apply user preferences if available
    const preferredFocusTime = preferences.optimalFocusTime || optimalFocusBlockDuration / (60 * 60 * 1000);
    const optimalDuration = preferredFocusTime * 60 * 60 * 1000;
    
    // Prioritize high-priority tasks
    const highPriorityTasks = tasks.filter(task => 
      task.priority === 'high' || task.priority >= 8
    );
    
    // For each available slot, try to create focus blocks
    for (const slot of availableSlots) {
      const slotDuration = slot.end - slot.start;
      
      // Skip if slot is too short
      if (slotDuration < minFocusBlockDuration) {
        continue;
      }
      
      // Determine how many focus blocks can fit in this slot
      const numBlocksPossible = Math.floor(slotDuration / optimalDuration);
      const remainingTime = slotDuration % optimalDuration;
      
      // Create optimal focus blocks
      let currentStart = new Date(slot.start);
      
      for (let i = 0; i < numBlocksPossible; i++) {
        // Find a relevant task if possible
        const relatedTask = highPriorityTasks.length > 0 
          ? highPriorityTasks.shift() 
          : (tasks.length > 0 ? tasks.shift() : null);
        
        const blockEnd = new Date(currentStart.getTime() + optimalDuration);
        
        suggestedBlocks.push({
          title: relatedTask 
            ? `Focus: ${relatedTask.title}` 
            : 'Deep Work Focus Block',
          start_time: currentStart.toISOString(),
          end_time: blockEnd.toISOString(),
          block_type: 'focus',
          related_task_id: relatedTask?.id || null,
          notes: relatedTask 
            ? `Focus time for: ${relatedTask.title}` 
            : 'Protected time for deep work'
        });
        
        currentStart = blockEnd;
      }
      
      // Add one more block if there's enough remaining time
      if (remainingTime >= minFocusBlockDuration) {
        const relatedTask = highPriorityTasks.length > 0 
          ? highPriorityTasks.shift() 
          : (tasks.length > 0 ? tasks.shift() : null);
        
        const blockEnd = new Date(currentStart.getTime() + remainingTime);
        
        suggestedBlocks.push({
          title: relatedTask 
            ? `Focus: ${relatedTask.title}` 
            : 'Deep Work Focus Block',
          start_time: currentStart.toISOString(),
          end_time: blockEnd.toISOString(),
          block_type: 'focus',
          related_task_id: relatedTask?.id || null,
          notes: relatedTask 
            ? `Focus time for: ${relatedTask.title}` 
            : 'Protected time for deep work'
        });
      }
    }
    
    // Limit number of suggestions to avoid overwhelming the user
    return suggestedBlocks.slice(0, 5);
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
   * Process email and generate an appropriate response
   * @param {string} userId - User ID 
   * @param {Object} email - Email object with subject, body, sender
   * @returns {Promise<Object>} - Response data with suggested reply
   */
  async processEmail(userId, email) {
    try {
      // Fetch user details
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Prepare prompt for OpenAI
      const prompt = `
Analyze this email and help me respond appropriately:

FROM: ${email.sender}
SUBJECT: ${email.subject}
BODY:
${email.body}

First, determine if this is regarding:
1. A meeting request/scheduling
2. A project update/feedback request
3. A general inquiry
4. Something else (specify)

Then, based on the category:
- For meeting requests: Suggest available times based on my schedule preferences
- For project updates: Acknowledge receipt and suggest next steps
- For inquiries: Provide a professional response that builds client relationships

Your response should include:
1. Email category (from above)
2. A suggested response that I can send (in a professional, friendly tone)
3. Any follow-up actions I should take (e.g., schedule a meeting, update project timeline)
`;
      
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { 
            role: 'system', 
            content: `You are an email assistant for a creative freelancer (${user.profession || 'designer'}). Your goal is to help them maintain professional client relationships while protecting their creative flow time. Be concise but warm in your suggested responses.` 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      // Extract and process response
      const aiResponse = response.choices[0].message.content;
      
      // Save to email history
      await supabase.from('email_history').insert({
        user_id: userId,
        sender: email.sender,
        subject: email.subject,
        body: email.body,
        ai_analysis: aiResponse
      });
      
      return {
        analysis: aiResponse,
        suggestedActions: this.extractEmailActions(aiResponse, email)
      };
    } catch (error) {
      logger.error('Error processing email:', error);
      return {
        analysis: "I couldn't process this email properly. Please try again later.",
        error: true
      };
    }
  }
  
  /**
   * Extract suggested actions from email analysis
   * @param {string} analysis - AI analysis of the email
   * @param {Object} email - Original email object
   * @returns {Array} - Suggested actions
   */
  extractEmailActions(analysis, email) {
    const actions = [];
    
    // Check for meeting-related emails
    if (analysis.toLowerCase().includes('meeting') || 
        email.subject.toLowerCase().includes('meeting') ||
        email.subject.toLowerCase().includes('call') ||
        analysis.toLowerCase().includes('schedule')) {
      actions.push({
        type: 'SCHEDULE_MEETING',
        description: 'Schedule a meeting based on this email'
      });
    }
    
    // Check for project-related emails
    if (analysis.toLowerCase().includes('project') || 
        analysis.toLowerCase().includes('task') ||
        email.subject.toLowerCase().includes('project')) {
      actions.push({
        type: 'CREATE_TASK',
        description: 'Create task from this email'
      });
    }
    
    // Check for follow-up reminders
    if (analysis.toLowerCase().includes('follow') || 
        analysis.toLowerCase().includes('respond') ||
        analysis.toLowerCase().includes('reply')) {
      actions.push({
        type: 'SET_REMINDER',
        description: 'Set a reminder to follow up'
      });
    }
    
    return actions;
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