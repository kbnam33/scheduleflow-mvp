// FILENAME: server/src/models/AIContext.js
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const UserPreferences = require('./UserPreferences'); // For fetching user preferences

// Helper function to log user events
async function logUserEvent(userId, eventType, payload = {}) {
  try {
    await supabase.from('user_events').insert({
      user_id: userId,
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to log user event from AIContext', { userId, eventType, error: error.message });
  }
}

class AIContext {
  static async getContext(userId, contextType) {
    if (!userId || !contextType) {
      logger.error('AIContext.getContext called with missing userId or contextType', { userId, contextType });
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('ai_context')
        .select('*')
        .eq('user_id', userId)
        .eq('context_type', contextType)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching AI context from DB (getContext)', { userId, contextType, code: error.code, message: error.message });
        // Do not throw, allow service to handle null
      }
      return data; // Will be null if not found or if error (logged)
    } catch (error) {
      logger.error('Critical error in AIContext.getContext', { userId, contextType, message: error.message, stack: error.stack });
      return null; // Return null on critical failure
    }
  }

  static async updateContext(userId, contextType, contextData, confidenceScoreInput) {
    if (!userId || !contextType || contextData === undefined) { // contextData can be {}
      logger.error('AIContext.updateContext called with missing userId, contextType, or contextData', { userId, contextType, contextDataProvided: contextData !== undefined });
      throw new Error('User ID, context type, and context data are required to update AI context.');
    }

    // Ensure confidenceScoreInput is a number between 0 and 1, or calculate it
    let finalConfidenceScore;
    if (typeof confidenceScoreInput === 'number' && confidenceScoreInput >= 0 && confidenceScoreInput <= 1) {
        finalConfidenceScore = confidenceScoreInput;
    } else {
        finalConfidenceScore = this.calculateConfidenceScore(contextData, await this.getContext(userId, contextType));
    }
    
    try {
      const contextToUpsert = {
        user_id: userId,
        context_type: contextType,
        context_data: contextData,
        confidence_score: finalConfidenceScore,
        last_updated: new Date().toISOString(), // Explicitly set last_updated here
        // updated_at is handled by the trigger
      };

      const { data, error } = await supabase
        .from('ai_context')
        .upsert(contextToUpsert, { onConflict: 'user_id, context_type' }) // Use composite key for conflict
        .select()
        .single();

      if (error) {
        logger.error('Error upserting AI context to DB', { userId, contextType, code: error.code, message: error.message });
        throw error;
      }
      
      logger.info(`AI context '${contextType}' updated for user`, { userId });
      await logUserEvent(userId, 'ai_context_updated', { contextType, newContextId: data.id, confidence: finalConfidenceScore });
      return data;
    } catch (error) {
      logger.error('Critical error in AIContext.updateContext', { userId, contextType, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getAllContexts(userId) {
    if (!userId) {
      logger.error('AIContext.getAllContexts called without userId');
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('ai_context')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        logger.error('Error fetching all AI contexts from DB', { userId, code: error.code, message: error.message });
        return []; // Return empty on error
      }
      return data || [];
    } catch (error) {
      logger.error('Critical error in AIContext.getAllContexts', { userId, message: error.message, stack: error.stack });
      return []; // Return empty on critical failure
    }
  }

  /**
   * Calculates a confidence score for a given piece of context data.
   * @param newData The new data being considered.
   * @param existingContext The existing context for this type, if any.
   * @returns {number} A score between 0 and 1.
   */
  static calculateConfidenceScore(newData, existingContext = null) {
    let score = 0;
    const MAX_SCORE = 1.0;
    const MIN_SCORE = 0.0;

    if (newData === null || newData === undefined) return MIN_SCORE;

    // Factor 1: Data presence and basic validity (max 0.3)
    if (typeof newData === 'object' && Object.keys(newData).length > 0) {
      score += 0.2;
      if (JSON.stringify(newData) !== '{}') { // More than just an empty object
          score += 0.1;
      }
    } else if (Array.isArray(newData) && newData.length > 0) {
      score += 0.3;
    } else if (newData) { // For primitive types that are not empty strings or zero
      score += 0.1;
    }
    
    // Factor 2: Data Completeness (max 0.2) - Example: check for specific expected keys
    // This needs to be tailored per context_type if we want it to be truly "sophisticated"
    // For a generic example, let's say if it's an object with more than 2 keys, it's more "complete"
    if (typeof newData === 'object' && !Array.isArray(newData) && Object.keys(newData).length > 2) {
        score += 0.2;
    } else if (Array.isArray(newData) && newData.length > 1) { // For arrays, more than one item
        score += 0.15;
    }


    // Factor 3: Consistency with existing context (if available) (max 0.3)
    if (existingContext && existingContext.context_data) {
      // Simple consistency: if new data is very different from old, confidence might be lower initially
      // This is a placeholder; true consistency checks are complex.
      // For example, if a string value changes drastically, or a numeric value changes by a large percentage.
      // Here, let's assume if new data is non-empty and old data was also non-empty, there's some consistency.
      if (JSON.stringify(newData) !== '{}' && JSON.stringify(existingContext.context_data) !== '{}') {
        score += 0.15;
        // A more sophisticated check would compare structure or key values if an object.
        // For now, just having both new and old data contributes.
      }
      // If previous confidence was high, and new data is similar, it could boost current confidence.
      if (existingContext.confidence_score && existingContext.confidence_score > 0.7) {
          score += 0.1;
      }
    } else if (JSON.stringify(newData) !== '{}') {
        // New context being added for the first time, gets some base confidence for being new and non-empty
        score += 0.1;
    }

    // Factor 4: Explicit User Action / Feedback (max 0.2)
    // This would typically be passed in or inferred if the context update is a direct result of user confirmation
    if (newData.isUserVerified === true || newData.source === 'user_direct_input') {
        score += 0.2;
    }
    
    // Ensure score is within bounds [0, 1] and round to a few decimal places
    return parseFloat(Math.min(Math.max(score, MIN_SCORE), MAX_SCORE).toFixed(3));
  }

  static async getContextForAI(userId) {
    if (!userId) {
      logger.error('AIContext.getContextForAI called without userId');
      // Fallback to empty context structure or throw error depending on desired strictness
      return {
        preferences: UserPreferences.getDefaultPreferences(), // Ensure defaults are complete
        workPattern: {},
        projectPreference: {},
        communicationStyle: {},
        // Add other planned MCP models as empty objects or with default structures
        flowStateModel: {},
        userEnergyModel: {},
        // ... etc.
      };
    }
    try {
      const [contexts, preferences] = await Promise.all([
        this.getAllContexts(userId),
        UserPreferences.getPreferences(userId) // This now returns a complete object with defaults
      ]);
      
      const aiContextObject = {
        preferences: preferences, // UserPreferences.getPreferences now handles defaults robustly
        workPattern: contexts.find(c => c.context_type === 'work_pattern')?.context_data || {},
        projectPreference: contexts.find(c => c.context_type === 'project_preference')?.context_data || {},
        communicationStyle: contexts.find(c => c.context_type === 'communication_style')?.context_data || {},
        // Initialize other planned MCP context types here, fetching from `contexts` or providing defaults
        flowStateModel: contexts.find(c => c.context_type === 'flow_state_model')?.context_data || {},
        interruptionShieldRules: contexts.find(c => c.context_type === 'interruption_shield_rules')?.context_data || {},
        projectTrajectoryModel: contexts.find(c => c.context_type === 'project_trajectory_model')?.context_data || {},
        userEnergyModel: contexts.find(c => c.context_type === 'user_energy_model')?.context_data || {},
        userWellBeingModel: contexts.find(c => c.context_type === 'user_well_being_model')?.context_data || {},
        // Add any other context types as needed
      };
      
      logger.info('Successfully constructed full context for AI', { userId, contextTypesProvided: Object.keys(aiContextObject) });
      return aiContextObject;
    } catch (error) {
      logger.error('Error constructing full context for AI (getContextForAI)', { userId, message: error.message, stack: error.stack });
      // Fallback to a default structure on critical error
      return {
        preferences: UserPreferences.getDefaultPreferences(),
        workPattern: {}, projectPreference: {}, communicationStyle: {},
        flowStateModel: {}, userEnergyModel: {}
      };
    }
  }
}

module.exports = AIContext;