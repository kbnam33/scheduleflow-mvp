const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class UserPreferences {
  static async getPreferences(userId) {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle() instead of single()

      if (error && error.code !== 'PGRST116') { // PGRST116 means 0 rows, which maybeSingle handles by returning null data
        logger.error('Error fetching user preferences:', { userId, code: error.code, message: error.message });
        throw error;
      }
      // If data is null (no row found), return a default structure or null
      // The calling function (AIContext.getContextForAI) should handle this
      return data || { 
        /* provide a structure with all expected keys, possibly with default values */
        work_hours: this.getDefaultWorkHours(),
        notification_preferences: this.getDefaultNotificationPreferences(),
        focus_time_preferences: this.getDefaultFocusTimePreferences(),
        theme: 'dark' // example default
        // Ensure all fields expected by AIContext.getContextForAI are present
      };
    } catch (error) {
      logger.error('Critical error fetching user preferences:', { userId, message: error.message });
      throw error; // Re-throw if it's an unexpected error
    }
  }

  static async updatePreferences(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  static async updateWorkHours(userId, workHours) {
    try {
      return await this.updatePreferences(userId, { work_hours: workHours });
    } catch (error) {
      logger.error('Error updating work hours:', error);
      throw error;
    }
  }

  static async updateNotificationPreferences(userId, notificationPrefs) {
    try {
      return await this.updatePreferences(userId, { notification_preferences: notificationPrefs });
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  static async updateFocusTimePreferences(userId, focusTimePrefs) {
    try {
      return await this.updatePreferences(userId, { focus_time_preferences: focusTimePrefs });
    } catch (error) {
      logger.error('Error updating focus time preferences:', error);
      throw error;
    }
  }

  static async updateTheme(userId, theme) {
    try {
      return await this.updatePreferences(userId, { theme });
    } catch (error) {
      logger.error('Error updating theme:', error);
      throw error;
    }
  }

  static async getWorkHours(userId) {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('work_hours')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data?.work_hours || this.getDefaultWorkHours();
    } catch (error) {
      logger.error('Error fetching work hours:', error);
      throw error;
    }
  }

  static async getNotificationPreferences(userId) {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('notification_preferences')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data?.notification_preferences || this.getDefaultNotificationPreferences();
    } catch (error) {
      logger.error('Error fetching notification preferences:', error);
      throw error;
    }
  }

  static async getFocusTimePreferences(userId) {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('focus_time_preferences')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data?.focus_time_preferences || this.getDefaultFocusTimePreferences();
    } catch (error) {
      logger.error('Error fetching focus time preferences:', error);
      throw error;
    }
  }

  static getDefaultWorkHours() {
    return {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: null,
      sunday: null
    };
  }

  static getDefaultNotificationPreferences() {
    return {
      email: true,
      app: true,
      sms: false
    };
  }

  static getDefaultFocusTimePreferences() {
    return {
      morning: true,
      afternoon: false,
      evening: false
    };
  }

  static async logActivity(userId, activityType, description, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .insert([{
          user_id: userId,
          activity_type: activityType,
          description,
          metadata
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error logging activity:', error);
      throw error;
    }
  }

  static async getActivityLog(userId, filters = {}) {
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', userId);

      if (filters.startDate) query = query.gte('created_at', filters.startDate);
      if (filters.endDate) query = query.lte('created_at', filters.endDate);
      if (filters.activityType) query = query.eq('activity_type', filters.activityType);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching activity log:', error);
      throw error;
    }
  }
}

module.exports = UserPreferences; 