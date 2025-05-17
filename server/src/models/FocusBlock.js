const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class FocusBlock {
  static async create({ userId, title, startTime, endTime, priority, protected: isProtected, relatedProjectId, aiSuggested }) {
    try {
      const { data, error } = await supabase
        .from('focus_blocks')
        .insert([{
          user_id: userId,
          title,
          start_time: startTime,
          end_time: endTime,
          priority,
          protected: isProtected,
          related_project_id: relatedProjectId,
          ai_suggested: aiSuggested
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating focus block:', error);
      throw error;
    }
  }

  static async getById(blockId, userId) {
    try {
      const { data, error } = await supabase
        .from('focus_blocks')
        .select(`
          *,
          project:projects(*)
        `)
        .eq('id', blockId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching focus block:', error);
      throw error;
    }
  }

  static async update(blockId, userId, updates) {
    try {
      const { data, error } = await supabase
        .from('focus_blocks')
        .update(updates)
        .eq('id', blockId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating focus block:', error);
      throw error;
    }
  }

  static async delete(blockId, userId) {
    try {
      const { error } = await supabase
        .from('focus_blocks')
        .delete()
        .eq('id', blockId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error deleting focus block:', error);
      throw error;
    }
  }

  static async listByUser(userId, { startDate, endDate, priority, aiSuggested } = {}) {
    try {
      let query = supabase
        .from('focus_blocks')
        .select(`
          *,
          project:projects(*)
        `)
        .eq('user_id', userId);

      if (startDate && endDate) {
        query = query
          .gte('start_time', startDate)
          .lte('end_time', endDate);
      }

      if (priority) query = query.eq('priority', priority);
      if (aiSuggested !== undefined) query = query.eq('ai_suggested', aiSuggested);

      const { data, error } = await query.order('start_time', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error listing focus blocks:', error);
      throw error;
    }
  }

  static async findOverlappingBlocks(userId, startTime, endTime) {
    try {
      const { data, error } = await supabase
        .from('focus_blocks')
        .select('*')
        .eq('user_id', userId)
        .or(`start_time.lte.${endTime},end_time.gte.${startTime}`)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding overlapping focus blocks:', error);
      throw error;
    }
  }

  static async suggestBlocks(userId, preferences) {
    try {
      // Get user's work hours and preferences
      const { data: userPrefs, error: prefError } = await supabase
        .from('user_preferences')
        .select('work_hours, focus_time_preferences')
        .eq('user_id', userId)
        .single();

      if (prefError) throw prefError;

      // Get existing focus blocks for the next 7 days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const existingBlocks = await this.listByUser(userId, { startDate, endDate });

      // Get user's tasks that need focus blocks
      const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'not_started')
        .order('priority', { ascending: false });

      if (taskError) throw taskError;

      // Generate suggested blocks based on preferences and existing schedule
      const suggestions = [];
      const workHours = userPrefs.work_hours;
      const focusPreferences = userPrefs.focus_time_preferences;

      // Implementation of block suggestion logic would go here
      // This is a placeholder for the actual AI-driven suggestion logic
      // that would be implemented in the AI service

      return suggestions;
    } catch (error) {
      logger.error('Error suggesting focus blocks:', error);
      throw error;
    }
  }
}

module.exports = FocusBlock; 