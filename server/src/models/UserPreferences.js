// FILENAME: server/src/models/UserPreferences.js
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

// Helper function to log user events - can be centralized later
async function logUserEvent(userId, eventType, payload = {}) {
  try {
    await supabase.from('user_events').insert({
      user_id: userId,
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to log user event', { userId, eventType, error: error.message });
  }
}

class UserPreferences {
  static getDefaultPreferences() {
    return {
      work_hours: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
        saturday: null,
        sunday: null,
      },
      notification_preferences: {
        email: true,
        app: true,
        sms: false,
      },
      focus_time_preferences: {
        morning: true,
        afternoon: false,
        evening: false,
      },
      theme: 'dark',
      role: null, // Default role if not specified during onboarding
      calendar_connected: false,
      video_connected: false,
      creativity_time_pref: null,
    };
  }

  static async getPreferences(userId) {
    if (!userId) {
      logger.error('getPreferences called without userId');
      return this.getDefaultPreferences();
    }
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
        logger.error('Error fetching user preferences from DB', { userId, code: error.code, message: error.message });
        // Fallback to defaults but log the error
        return this.getDefaultPreferences();
      }
      
      if (!data) {
        // No preferences row exists, return a default structure
        // A new row will be created on the first updatePreferences call
        logger.info('No preferences found for user, returning defaults.', { userId });
        return this.getDefaultPreferences();
      }
      
      // Merge fetched data with defaults to ensure all keys are present
      const defaults = this.getDefaultPreferences();
      return {
        ...defaults, // Start with defaults
        ...data, // Override with fetched data
        // Ensure nested JSONB fields are also properly defaulted if they could be null from DB
        work_hours: data.work_hours || defaults.work_hours,
        notification_preferences: data.notification_preferences || defaults.notification_preferences,
        focus_time_preferences: data.focus_time_preferences || defaults.focus_time_preferences,
      };

    } catch (error) {
      logger.error('Critical error fetching user preferences', { userId, message: error.message, stack: error.stack });
      return this.getDefaultPreferences(); // Fallback in case of any other error
    }
  }

  static async updatePreferences(userId, updates) {
    if (!userId) {
      logger.error('updatePreferences called without userId');
      throw new Error('User ID is required to update preferences.');
    }
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      logger.warn('updatePreferences called with empty or invalid updates object', { userId });
      return this.getPreferences(userId); // Return current preferences if updates are empty
    }

    try {
      const preferencesToUpdate = {
        user_id: userId,
        ...updates,
        // updated_at is handled by the trigger
      };

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(preferencesToUpdate, { onConflict: 'user_id' }) // Specify conflict target
        .select()
        .single();

      if (error) {
        logger.error('Error upserting user preferences to DB', { userId, code: error.code, message: error.message, updatesSent: updates });
        throw error;
      }
      
      logger.info('User preferences updated successfully', { userId, updatedFields: Object.keys(updates) });
      await logUserEvent(userId, 'user_preferences_updated', { updatedFields: Object.keys(updates), newValues: data });
      
      // Merge with defaults to ensure a complete object is returned
      const defaults = this.getDefaultPreferences();
      return {
          ...defaults,
          ...data,
          work_hours: data.work_hours || defaults.work_hours,
          notification_preferences: data.notification_preferences || defaults.notification_preferences,
          focus_time_preferences: data.focus_time_preferences || defaults.focus_time_preferences,
      };
    } catch (error) {
      logger.error('Critical error updating user preferences', { userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  // Specific update methods for convenience, calling the generic updatePreferences

  static async updateWorkHours(userId, workHours) {
    return this.updatePreferences(userId, { work_hours: workHours });
  }

  static async updateNotificationPreferences(userId, notificationPrefs) {
    return this.updatePreferences(userId, { notification_preferences: notificationPrefs });
  }

  static async updateFocusTimePreferences(userId, focusTimePrefs) {
    return this.updatePreferences(userId, { focus_time_preferences: focusTimePrefs });
  }

  static async updateTheme(userId, theme) {
    return this.updatePreferences(userId, { theme });
  }
  
  static async updateUserRolePreference(userId, role) {
    return this.updatePreferences(userId, { role });
  }

  static async updateCalendarConnectedStatus(userId, status) {
    return this.updatePreferences(userId, { calendar_connected: status });
  }
  
  static async updateVideoConnectedStatus(userId, status) {
    return this.updatePreferences(userId, { video_connected: status });
  }
  
  static async updateCreativityTimePreference(userId, pref) {
    return this.updatePreferences(userId, { creativity_time_pref: pref });
  }


  // Getters for specific preferences, falling back to defaults
  // These might be less necessary if getPreferences always returns a full object

  static async getWorkHours(userId) {
    const prefs = await this.getPreferences(userId);
    return prefs.work_hours;
  }

  static async getNotificationPreferences(userId) {
    const prefs = await this.getPreferences(userId);
    return prefs.notification_preferences;
  }

  static async getFocusTimePreferences(userId) {
    const prefs = await this.getPreferences(userId);
    return prefs.focus_time_preferences;
  }
  
  // logActivity and getActivityLog seem more generic and might belong to a different utility or UserActivity model
  // For now, keeping them here if they were intended to be part of UserPreferences context.
  // Consider moving if a more general UserActivity service is created.

  static async logActivity(userId, activityType, description, metadata = {}) {
    if (!userId || !activityType) {
        logger.error('logActivity called with missing userId or activityType', { userId, activityType });
        return null;
    }
    try {
      const { data, error } = await supabase
        .from('activity_log') // Ensure 'activity_log' table exists with these columns
        .insert([{
          user_id: userId,
          activity_type: activityType,
          description,
          metadata,
          // created_at will default in DB
        }])
        .select()
        .single();

      if (error) {
        logger.error('Error logging user activity to DB', { userId, activityType, code: error.code, message: error.message });
        throw error;
      }
      logger.info('User activity logged', { userId, activityType, activityId: data.id });
      return data;
    } catch (error) {
      logger.error('Critical error logging activity', { userId, activityType, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getActivityLog(userId, filters = {}) {
    if (!userId) {
        logger.error('getActivityLog called without userId');
        return [];
    }
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', userId);

      if (filters.startDate) query = query.gte('created_at', filters.startDate);
      if (filters.endDate) query = query.lte('created_at', filters.endDate);
      if (filters.activityType) query = query.eq('activity_type', filters.activityType);
      if (filters.limit) query = query.limit(filters.limit);


      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching activity log from DB', { userId, code: error.code, message: error.message });
        throw error;
      }
      return data || [];
    } catch (error) {
      logger.error('Critical error fetching activity log', { userId, message: error.message, stack: error.stack });
      throw error;
    }
  }
}

module.exports = UserPreferences;