// File Path: scheduleflow-mvp/server/src/services/ai-service.js

const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const AIContext = require('../models/AIContext');
const UserPreferences = require('../models/UserPreferences');
const Task = require('../models/Task'); // Ensure this path is correct

// Initialize Langchain Chat Model
// Ensure OPENAI_API_KEY is in your .env file
const lcChatModel = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.OPENAI_MODEL_NAME || "gpt-4o", // Allow model to be set via .env or default
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7, // Allow temperature to be set via .env
});

class AIService {
  /**
   * Process a chat message and generate a response using Langchain.
   * It now includes intent detection for task creation.
   * @param {string} userId - User ID
   * @param {string} message - User's message
   * @param {Array<Object>} chatHistory - Optional: array of previous messages [{role: 'user'/'assistant', content: '...'}, ...]
   * @returns {Promise<Object>} - AI response, potentially including a created task or suggested actions
   */
  async processChat(userId, userMessage, chatHistory = []) {
    try {
      logger.ai.request(`Processing chat for user: ${userId}`, { message: userMessage });
      const contextForAI = await AIContext.getContextForAI(userId);

      // Basic Intent Detection for Task Creation
      const lowerMessage = userMessage.toLowerCase();
      let isTaskCreationIntent = false;
      const taskKeywords = ['create task', 'new task', 'add task', 'make a task for', 'task:'];
      
      let taskDescriptionNL = userMessage;
      for (const keyword of taskKeywords) {
        if (lowerMessage.startsWith(keyword)) {
          isTaskCreationIntent = true;
          taskDescriptionNL = userMessage.substring(keyword.length).trim();
          break;
        } else if (lowerMessage.includes(keyword)) { // More general check if not a direct command
          isTaskCreationIntent = true; 
          // taskDescriptionNL remains the full message for broader context parsing
        }
      }
      
      if (isTaskCreationIntent && taskDescriptionNL) {
        logger.info(`Task creation intent detected. Description: "${taskDescriptionNL}"`);
        const taskResult = await this.createTaskFromNaturalLanguage(userId, taskDescriptionNL /*, projectId if available from context */);
        
        if (taskResult && !taskResult.error) {
          return {
            message: `OK, I've created the task: "${taskResult.title}". You can view it in your tasks list.`,
            suggestedActions: [{ type: 'VIEW_TASK', taskId: taskResult.id, description: 'View the new task' }],
            createdTask: taskResult // Send back the created task object to the frontend
          };
        } else if (taskResult && taskResult.error) {
          // If AI couldn't create the task and asks for clarification
          return {
            message: taskResult.error + (taskResult.askClarification ? " Could you provide more details or rephrase?" : ""),
            suggestedActions: []
          };
        } else {
           // Generic failure if taskResult is null or unexpected
           return {
            message: "I tried to create that task, but something went wrong. Please try rephrasing your request.",
            suggestedActions: []
          };
        }
      } else {
        // Proceed with Regular Chat Processing if no task creation intent detected
        const systemMessageContent = `You are an expert executive assistant for ScheduleFlow. Be concise, helpful, and context-aware.
        User preferences: ${JSON.stringify(contextForAI.preferences || {})}
        Work pattern: ${JSON.stringify(contextForAI.workPattern || {})}
        Project preferences: ${JSON.stringify(contextForAI.projectPreference || {})}
        Communication style: ${JSON.stringify(contextForAI.communicationStyle || {})}
        Current date and time: ${new Date().toISOString()}`;

        const messages = [new SystemMessage(systemMessageContent)];

        (chatHistory || []).forEach(histMsg => {
          if (histMsg.role === 'user' && histMsg.content) {
            messages.push(new HumanMessage(histMsg.content));
          } else if (histMsg.role === 'assistant' && histMsg.content) {
            messages.push(new SystemMessage(histMsg.content)); // Using SystemMessage for AI responses in history for this model
          }
        });
        messages.push(new HumanMessage(userMessage));
        
        const response = await lcChatModel.invoke(messages);
        const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

        logger.ai.response(`Langchain chat response for user ${userId}`, { responseText });

        await AIContext.updateContext(
          userId,
          'communication_style',
          { lastInteraction: new Date().toISOString(), message: userMessage, response: responseText },
          AIContext.calculateConfidenceScore({ message: userMessage, response: responseText })
        );

        const suggestedActions = await this.extractSuggestedActions(responseText, userId, userMessage);

        return {
          message: responseText,
          suggestedActions,
        };
      }
    } catch (error) {
      logger.ai.error(error, { userId, message: userMessage, source: 'processChat Langchain Enhanced' });
      return {
        message: "I'm having a little trouble processing that. Could you try rephrasing or try again in a moment?",
        suggestedActions: [],
        error: true,
      };
    }
  }

  /**
   * Extract suggested actions from AI response.
   * This is called when no specific intent (like task creation) was handled directly in processChat.
   */
  async extractSuggestedActions(responseText, userId, originalUserMessage) {
    const actions = [];
    const lowerResponse = responseText.toLowerCase();
    const lowerUserMessage = originalUserMessage.toLowerCase();
    
    // Suggest creating a task if relevant keywords appear but weren't part of an explicit creation command
    const taskKeywords = ['task', 'to-do', 'action item'];
    if (taskKeywords.some(keyword => lowerResponse.includes(keyword) || lowerUserMessage.includes(keyword))) {
       actions.push({
         type: 'CREATE_TASK_SUGGESTION',
         description: 'Create a task based on this?',
         payload: { originalMessage: originalUserMessage, aiResponse: responseText }
       });
    }
    
    const scheduleKeywords = ['schedule', 'calendar', 'meeting', 'block out time'];
    if (scheduleKeywords.some(keyword => lowerResponse.includes(keyword) || lowerUserMessage.includes(keyword))) {
      actions.push({
        type: 'SCHEDULE_FOCUS_BLOCK_SUGGESTION',
        description: 'Schedule this or create a focus block?',
        payload: { originalMessage: originalUserMessage, aiResponse: responseText }
      });
    }
    // Add more sophisticated action extraction logic as needed
    return actions;
  }

  /**
   * Create a task via AI/Langchain based on natural language.
   */
  async createTaskFromNaturalLanguage(userId, taskDescriptionNL, projectId = null) {
    logger.ai.request(`Attempting to create task from NL: "${taskDescriptionNL}" for user ${userId}`, { projectId });
    try {
      const contextForAI = await AIContext.getContextForAI(userId);

      const systemPromptContent = `You are an expert task creation assistant. Parse the following natural language input and extract structured task details.
      The output MUST be a single JSON object with ONLY the following fields: "title" (string, concise and actionable), "description" (string, optional detailed description, default to empty string if not clear from input), "dueDate" (string, ISO 8601 format YYYY-MM-DD if a date is mentioned or can be clearly inferred, otherwise null), "priority" (string: "high", "medium", or "low"; inferred if possible, default "medium").
      If no specific due date is mentioned but a relative term like "next Friday", "tomorrow", "end of week" is used, calculate it based on the current date: ${new Date().toISOString()}.
      If the input is too vague to create a meaningful task title, return a JSON object like this: {"error": "The task description is too vague. Please provide a more specific title or action."}
      If a title can be formed but other details are missing, provide defaults as specified.
      Respond ONLY with the JSON object, nothing else. Example for "remind me to call John tomorrow about the proposal": {"title": "Call John about the proposal", "description": "", "dueDate": "YYYY-MM-DD (tomorrow's date)", "priority": "medium"}`;
      
      const humanPromptContent = `User input for task: "${taskDescriptionNL}"`;

      const jsonParsingModel = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        modelName: process.env.OPENAI_MODEL_NAME_JSON || "gpt-4o", // Use a specific model if configured, or default
        temperature: 0.1, // Low temperature for structured output
        // For newer OpenAI models that support JSON mode reliably with Langchain:
        // modelKwargs: { response_format: { type: "json_object" } },
      });

      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemPromptContent),
        new HumanMessage(humanPromptContent),
      ]);
      
      const parser = new StringOutputParser();
      const chain = promptTemplate.pipe(jsonParsingModel).pipe(parser);
      
      const structuredTaskString = await chain.invoke({});
      logger.ai.response(`Structured task string from LLM for NL task creation: ${structuredTaskString}`);

      let taskData;
      try {
        // Attempt to parse, cleaning potential markdown ```json ... ``` blocks
        const cleanedString = structuredTaskString.replace(/^```json\s*|```\s*$/g, '').trim();
        taskData = JSON.parse(cleanedString);
      } catch (e) {
        logger.ai.error(e, { source: 'createTaskFromNaturalLanguage JSON.parse', structuredTaskString });
        return { error: "I had trouble understanding the task details. Could you phrase it differently?", askClarification: true };
      }

      if (taskData.error) {
        logger.warn(`AI could not parse task from NL: ${taskData.error}`, { userId, taskDescriptionNL });
        return { error: taskData.error, askClarification: true }; 
      }

      if (!taskData.title || String(taskData.title).trim() === "") {
        logger.warn(`AI did not return a valid title for the task from NL.`, { userId, taskData });
        return { error: "I couldn't determine a title for the task. Please be more specific.", askClarification: true };
      }
      
      const newTaskPayload = {
        userId,
        project_id: projectId, // Ensure your Task.create model uses 'project_id'
        title: taskData.title,
        description: taskData.description || '',
        status: 'pending',
        priority: ['high', 'medium', 'low'].includes(taskData.priority?.toLowerCase()) ? taskData.priority.toLowerCase() : 'medium',
        estimated_hours: taskData.estimatedHours || null, 
        deadline: taskData.dueDate || null, // Ensure this is ISO format if not null
        ai_generated: true,
        tags: taskData.tags || [], // Assuming Task model can handle tags
      };

      const newTask = await Task.create(newTaskPayload);
      logger.info('Task created successfully via NL', { taskId: newTask.id, userId });
      return newTask;

    } catch (error) {
      logger.ai.error(error, { userId, taskDescriptionNL, source: 'createTaskFromNaturalLanguage' });
      return { error: "Failed to create task due to an internal error. Please try again.", askClarification: false };
    }
  }

  /**
   * Generate task suggestions for a project using Langchain.
   */
  async generateTaskSuggestions(userId, projectId, projectBrief = '') {
    try {
      logger.ai.request(`Generating task suggestions for project: ${projectId}`, { userId, projectBrief });
      const context = await AIContext.getContextForAI(userId);
      const preferences = await UserPreferences.getPreferences(userId);

      const systemPromptContent = `You are an expert project manager. Given the project details and user preferences, generate a list of 3-5 actionable tasks.
      User preferences: ${JSON.stringify(preferences || {})}
      Work pattern: ${JSON.stringify(context.workPattern || {})}
      Project preferences: ${JSON.stringify(context.projectPreference || {})}
      Return tasks as a VALID JSON array of objects. Each object MUST have ONLY "title" (string), "description" (string), "priority" (string: "high", "medium", or "low"), and "estimatedHours" (number, optional).
      Do not include any other text, preamble, or explanation outside the JSON array itself. The response should be directly parsable as JSON.`;
      
      const humanPromptContent = `Project ID: ${projectId}. ${projectBrief ? `Project Brief: ${projectBrief}` : 'Based on general project knowledge for this type of project.'}`;

      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemPromptContent),
        new HumanMessage(humanPromptContent),
      ]);
      
      const modelForJson = new ChatOpenAI({ // Potentially use a model fine-tuned for JSON or with specific JSON mode
        apiKey: process.env.OPENAI_API_KEY,
        modelName: process.env.OPENAI_MODEL_NAME_JSON || "gpt-4o",
        temperature: 0.2,
        // modelKwargs: { response_format: { type: "json_object" } }, // If supported
      });
      const parser = new StringOutputParser();
      const chain = promptTemplate.pipe(modelForJson).pipe(parser);

      const responseString = await chain.invoke({});
      let suggestions = [];
      try {
        const cleanedString = responseString.replace(/^```json\s*|```\s*$/g, '').trim();
        suggestions = JSON.parse(cleanedString);
        if (!Array.isArray(suggestions)) { // Ensure it's an array
            logger.warn('Task suggestions from AI was not an array, attempting fallback.', { suggestions });
            suggestions = this.extractTasksFromTextFallback(cleanedString);
        }
      } catch (parseError) {
        logger.ai.error(parseError, { source: 'generateTaskSuggestions JSON.parse', responseString });
        suggestions = this.extractTasksFromTextFallback(responseString.trim()); 
      }
      
      logger.ai.response(`Task suggestions generated for project ${projectId}`, { suggestionCount: suggestions.length });
      
      if (suggestions.length > 0) {
        await AIContext.updateContext(
          userId,
          'project_preference',
          { lastTaskGeneration: new Date().toISOString(), projectId, suggestionCount: suggestions.length },
          AIContext.calculateConfidenceScore(suggestions) // This score might need adjustment
        );
      }
      return suggestions;
    } catch (error) {
      logger.ai.error(error, { userId, projectId, source: 'generateTaskSuggestions Langchain' });
      return [];
    }
  }

  /**
   * Fallback helper to extract tasks if AI doesn't return perfect JSON.
   */
  extractTasksFromTextFallback(text) {
    logger.warn('Falling back to rudimentary text extraction for tasks from malformed JSON.', { text });
    const tasks = [];
    try {
        // This is a very naive attempt and likely needs to be much more robust
        // For example, if AI returns a list of objects within a larger text
        const jsonArrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (jsonArrayMatch && jsonArrayMatch[0]) {
            const parsedFromArray = JSON.parse(jsonArrayMatch[0]);
            if (Array.isArray(parsedFromArray)) {
                logger.info(`Fallback found ${parsedFromArray.length} tasks by extracting JSON array.`);
                return parsedFromArray.filter(t => t.title); // Basic validation
            }
        }
    } catch (e) {
        logger.error('Error during fallback task extraction', e);
    }
    // If the above fails, try line-by-line (very simplistic)
    const lines = text.split('\n');
    let currentTask = {};
    lines.forEach(line => {
      if (line.toLowerCase().includes('"title":')) {
        if (currentTask.title) tasks.push({...currentTask}); // save previous
        try { currentTask = { title: JSON.parse(`{${line}}`).title }; } catch (e) { /* ignore */ }
      } else if (currentTask.title && line.toLowerCase().includes('"description":')) {
        try { currentTask.description = JSON.parse(`{${line}}`).description; } catch (e) { /* ignore */ }
      }
    });
    if (currentTask.title) tasks.push({...currentTask});
    return tasks.filter(t => t.title);
  }

  /**
   * Fetch recent emails using Gmail API (via Langchain Tool/Agent in future)
   */
  async fetchRecentEmails(userId, count = 5) {
    logger.info(`AIService.fetchRecentEmails called for user ${userId} to fetch ${count} emails.`);
    // TODO (Future Step): Implement actual Gmail API call using googleAuthService.
    // This requires user OAuth tokens to be securely retrieved for the given userId.
    // For now, returning placeholder data.
    return Promise.resolve([
      { id: 'placeholderEmail1', subject: 'Project Alpha Update', snippet: 'Meeting notes and next steps for Project Alpha...' },
      { id: 'placeholderEmail2', subject: 'Client Feedback on Design V2', snippet: 'Overall positive, but a few minor tweaks requested...' },
    ]);
  }

  /**
   * Process email content (pasted or described by user) using Langchain.
   */
  async processEmail(userId, emailData) {
    try {
      logger.ai.request('Processing email content with Langchain', { userId, emailSubject: emailData.subject });
      const contextForAI = await AIContext.getContextForAI(userId);

      const systemPromptContent = `You are an expert email analyst. Analyze the provided email content and user context.
      Return a JSON object with ONLY the following fields: "summary" (string, a concise 1-2 sentence summary of the email's purpose), "actionItems" (array of objects: {title: string, priority: "high|medium|low", dueDate: "ISO date or null" or null if not applicable}), "calendarEvents" (array of objects: {title: string, startTime: "ISO date", endTime: "ISO date", type: "meeting|reminder|task"} or null if not applicable), and "followUpActions" (array of strings suggesting next steps for the user, or null).
      User context: Work pattern: ${JSON.stringify(contextForAI.workPattern || {})}, Communication style: ${JSON.stringify(contextForAI.communicationStyle || {})}.
      Current date: ${new Date().toISOString()}.
      Respond ONLY with the JSON object, no other text or explanation. If no specific action items, calendar events, or follow-up actions are identifiable, their corresponding fields should be empty arrays or null.`;
      
      const humanPromptContent = `Analyze this email:
      From: ${emailData.sender}
      Subject: ${emailData.subject}
      Body: ${emailData.body}`;

      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemPromptContent),
        new HumanMessage(humanPromptContent),
      ]);
      
      const modelForJson = new ChatOpenAI({
          apiKey: process.env.OPENAI_API_KEY, 
          modelName: process.env.OPENAI_MODEL_NAME_JSON || "gpt-4o", 
          temperature: 0.1,
          // modelKwargs: { response_format: { type: "json_object" } },
      });
      const parser = new StringOutputParser();
      const chain = promptTemplate.pipe(modelForJson).pipe(parser);
      
      const responseString = await chain.invoke({});
      logger.ai.response(`Structured email analysis string from LLM: ${responseString}`);
      
      let analysis;
      try {
        const cleanedString = responseString.replace(/^```json\s*|```\s*$/g, '').trim();
        analysis = JSON.parse(cleanedString);
      } catch (e) {
        logger.ai.error(e, { source: 'processEmail JSON.parse', responseString });
        throw new Error("AI returned malformed JSON for email analysis.");
      }

      await AIContext.updateContext(
        userId,
        'communication_style',
        { lastEmailProcessed: new Date().toISOString(), emailSubject: emailData.subject, actionItemCount: analysis.actionItems?.length || 0 },
        AIContext.calculateConfidenceScore(analysis)
      );

      return analysis;
    } catch (error) {
      logger.ai.error(error, { userId, emailSubject: emailData.subject, source: 'processEmail Langchain' });
      throw error;
    }
  }

  /**
   * Suggest focus blocks based on user's schedule using Langchain.
   */
  async suggestFocusBlocks(userId, startDate, endDate) {
    try {
      logger.ai.request(`Suggesting focus blocks for user ${userId}`, { startDate: startDate.toISOString(), endDate: endDate.toISOString() });
      const context = await AIContext.getContextForAI(userId);
      const preferences = await UserPreferences.getPreferences(userId);

      const systemPromptContent = `You are a productivity expert specializing in time blocking for creative professionals. Generate focus block suggestions.
      User preferences: ${JSON.stringify(preferences || {})}
      Work pattern: ${JSON.stringify(context.workPattern || {})}
      Focus time preferences: ${JSON.stringify(context.preferences?.focus_time_preferences || {})}
      Date range for suggestions: ${startDate.toISOString()} to ${endDate.toISOString()}
      Return as a VALID JSON array of objects. Each object MUST have "title" (string, e.g., "Deep Work: Project X"), "startTime" (ISO string), "endTime" (ISO string), "priority" ("high"|"medium"|"low"), "type" ("focus"|"break"), "relatedTaskId" (string ID or null).
      Consider user's work hours, avoid conflicts with known meetings (assume none are provided in this call, focus on preferences), and include short breaks (e.g., 10-15 mins after 90-120 mins of focus).
      Respond ONLY with the JSON array. If no suitable blocks can be suggested, return an empty array.`;
      
      const humanPromptContent = `Suggest focus blocks for the period from ${startDate.toISOString()} to ${endDate.toISOString()}.`;

      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemPromptContent),
        new HumanMessage(humanPromptContent),
      ]);
      const parser = new StringOutputParser();
      const chain = promptTemplate.pipe(lcChatModel).pipe(parser); // Use standard model, can be refined for JSON
      const responseString = await chain.invoke({});
      let suggestions = [];
       try {
        const cleanedString = responseString.replace(/^```json\s*|```\s*$/g, '').trim();
        suggestions = JSON.parse(cleanedString);
        if (!Array.isArray(suggestions)) {
            logger.warn('Focus block suggestions from AI was not an array.', { suggestions });
            suggestions = []; // Or attempt a fallback extraction
        }
      } catch (parseError) {
        logger.ai.error(parseError, { source: 'suggestFocusBlocks JSON.parse', responseString });
        suggestions = []; // Or try a fallback extraction
      }
      
      if (suggestions.length > 0) {
        await AIContext.updateContext(
          userId,
          'work_pattern',
          { lastFocusBlockGeneration: new Date().toISOString(), suggestionCount: suggestions.length, range: {start: startDate, end: endDate} },
          AIContext.calculateConfidenceScore(suggestions)
        );
      }
      return suggestions;
    } catch (error) {
      logger.ai.error(error, { userId, source: 'suggestFocusBlocks Langchain' });
      return [];
    }
  }

  // TODO: Refactor other methods like suggestMeetingPrepBlocks, analyzeProjectBrief, generateWeeklySummary
  // to use Langchain and lcChatModel similar to the examples above.
  // For brevity, the original stubs/logic for those are omitted here but should be
  // reviewed and updated in your actual file.

} // End of AIService Class

module.exports = new AIService();