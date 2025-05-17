const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class AIContext {
  static async getContext(userId, contextType) {
    try {
      const { data, error } = await supabase
        .from('ai_context')
        .select('*')
        .eq('user_id', userId)
        .eq('context_type', contextType)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching AI context:', error);
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
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating AI context:', error);
      throw error;
    }
  }

  static async getAllContexts(userId) {
    try {
      const { data, error } = await supabase
        .from('ai_context')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching all AI contexts:', error);
      throw error;
    }
  }

  static async updateWorkPattern(userId, patternData) {
    try {
      return await this.updateContext(
        userId,
        'work_pattern',
        patternData,
        this.calculateConfidenceScore(patternData)
      );
    } catch (error) {
      logger.error('Error updating work pattern:', error);
      throw error;
    }
  }

  static async updateProjectPreference(userId, preferenceData) {
    try {
      return await this.updateContext(
        userId,
        'project_preference',
        preferenceData,
        this.calculateConfidenceScore(preferenceData)
      );
    } catch (error) {
      logger.error('Error updating project preference:', error);
      throw error;
    }
  }

  static async updateCommunicationStyle(userId, styleData) {
    try {
      return await this.updateContext(
        userId,
        'communication_style',
        styleData,
        this.calculateConfidenceScore(styleData)
      );
    } catch (error) {
      logger.error('Error updating communication style:', error);
      throw error;
    }
  }

  static calculateConfidenceScore(data) {
    // Implement confidence score calculation based on data quality and quantity
    // This is a placeholder implementation
    const factors = {
      dataCompleteness: 0.3,
      dataConsistency: 0.3,
      dataRecency: 0.2,
      dataVolume: 0.2
    };

    let score = 0;
    
    // Example scoring logic
    if (data && typeof data === 'object') {
      score += factors.dataCompleteness;
      if (Object.keys(data).length > 5) score += factors.dataVolume;
      if (data.lastUpdated) {
        const daysSinceUpdate = (Date.now() - new Date(data.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 7) score += factors.dataRecency;
      }
      // Add more sophisticated scoring logic here
    }

    return Math.min(Math.max(score, 0), 1); // Ensure score is between 0 and 1
  }

  static async getContextForAI(userId) {
    try {
      const contexts = await this.getAllContexts(userId);
      
      // Get user preferences
      const { data: preferences, error: prefError } = await supabase
        .from('user_preferences')
        .select('work_hours, focus_time_preferences')
        .eq('user_id', userId)
        .single();

      if (prefError) throw prefError;

      // Combine all context data for AI processing
      return {
        workPattern: contexts.find(c => c.context_type === 'work_pattern')?.context_data || {},
        projectPreference: contexts.find(c => c.context_type === 'project_preference')?.context_data || {},
        communicationStyle: contexts.find(c => c.context_type === 'communication_style')?.context_data || {},
        preferences: preferences || {}
      };
    } catch (error) {
      logger.error('Error getting context for AI:', error);
      throw error;
    }
  }
}

module.exports = AIContext; 