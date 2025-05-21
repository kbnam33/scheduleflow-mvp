// server/src/models/AIContext.js
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const UserPreferences = require('./UserPreferences'); // Make sure this path is correct

class AIContext {
  static async getContext(userId, contextType) {
    try {
      const { data, error } = await supabase
        .from('ai_context')
        .select('*')
        .eq('user_id', userId)
        .eq('context_type', contextType)
        .maybeSingle(); // Changed to maybeSingle to handle no row gracefully

      if (error) {
        logger.error('Error fetching AI context (getContext):', { userId, contextType, code: error.code, message: error.message });
        throw error;
      }
      return data; // Will be null if not found
    } catch (error) {
      logger.error('Critical error in getContext:', { userId, contextType, message: error.message });
      throw error;
    }
  }

  static async updateContext(userId, contextType, contextData, confidenceScore) {
    try {
      const { data, error } = await supabase
        .from('ai_context')
        .upsert({
          user_id: userId,
          context_type: contextType,
          context_data: contextData,
          confidence_score: confidenceScore,
          last_updated: new Date().toISOString()
        })
        .select()
        .single(); // Upsert followed by select and single is okay if upsert guarantees a row.

      if (error) {
        logger.error('Error upserting AI context:', { userId, contextType, code: error.code, message: error.message });
        throw error;
      }
      return data;
    } catch (error) {
      logger.error('Critical error in updateContext:', { userId, contextType, message: error.message });
      throw error;
    }
  }

  static async getAllContexts(userId) {
    try {
      const { data, error } = await supabase
        .from('ai_context')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        logger.error('Error fetching all AI contexts:', { userId, code: error.code, message: error.message });
        throw error;
      }
      return data || []; // Return empty array if no contexts found
    } catch (error) {
      logger.error('Critical error in getAllContexts:', { userId, message: error.message });
      throw error;
    }
  }

  // ... (updateWorkPattern, etc. remain the same, they call updateContext)

  static calculateConfidenceScore(data) {
    // Placeholder
    const factors = {
      dataCompleteness: 0.3,
      dataConsistency: 0.3,
      dataRecency: 0.2,
      dataVolume: 0.2
    };
    let score = 0;
    if (data && typeof data === 'object') {
      score += factors.dataCompleteness;
      if (Object.keys(data).length > 5) score += factors.dataVolume;
      if (data.lastUpdated) {
        const daysSinceUpdate = (Date.now() - new Date(data.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 7) score += factors.dataRecency;
      }
    }
    return Math.min(Math.max(score, 0), 1);
  }

  static async getContextForAI(userId) {
    try {
      const contexts = await this.getAllContexts(userId); // This should return [] if no contexts, not error
      
      // Fetch user preferences, handle if not found
      let userPrefsData;
      try {
        const { data: preferencesResult, error: prefError } = await supabase
          .from('user_preferences')
          .select('work_hours, focus_time_preferences, notification_preferences, theme') // Select all relevant fields
          .eq('user_id', userId)
          .maybeSingle(); // Use maybeSingle to prevent error if no row

        if (prefError) {
          logger.error('Error fetching user preferences in getContextForAI:', { userId, code: prefError.code, message: prefError.message });
          // Do not throw, use defaults
        }
        userPrefsData = preferencesResult; // Will be null if not found
      } catch (e) {
          logger.error('Catastrophic error fetching user preferences', { userId, message: e.message });
          userPrefsData = null; // Ensure defaults are used
      }


      // Provide default preferences if none are found or an error occurred
      const finalPreferences = userPrefsData || {
        work_hours: UserPreferences.getDefaultWorkHours(),
        focus_time_preferences: UserPreferences.getDefaultFocusTimePreferences(),
        notification_preferences: UserPreferences.getDefaultNotificationPreferences(),
        // Add any other preference fields that UserPreferences model might default or AIService might expect
      };
      
      return {
        workPattern: contexts.find(c => c.context_type === 'work_pattern')?.context_data || {},
        projectPreference: contexts.find(c => c.context_type === 'project_preference')?.context_data || {},
        communicationStyle: contexts.find(c => c.context_type === 'communication_style')?.context_data || {},
        preferences: finalPreferences
      };
    } catch (error) {
      // This catch is for errors from getAllContexts or if UserPreferences model itself throws non-Supabase error
      logger.error('Error constructing full context for AI:', { userId, message: error.message, stack: error.stack });
      throw error; // Re-throw to be caught by AIService.processChat
    }
  }
}

module.exports = AIContext;