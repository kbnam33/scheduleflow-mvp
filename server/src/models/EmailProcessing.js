const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class EmailProcessing {
  static async processEmail(userId, emailData) {
    try {
      const { data, error } = await supabase
        .from('email_processing')
        .insert([{
          user_id: userId,
          email_alias: emailData.alias,
          subject: emailData.subject,
          content_summary: emailData.summary,
          full_content: emailData.content,
          action_taken: emailData.action,
          related_project_id: emailData.projectId,
          related_calendar_event_id: emailData.calendarEventId
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error processing email:', error);
      throw error;
    }
  }

  static async getProcessedEmails(userId, filters = {}) {
    try {
      let query = supabase
        .from('email_processing')
        .select(`
          *,
          project:projects(*),
          calendar_event:calendar_events(*)
        `)
        .eq('user_id', userId);

      if (filters.startDate) query = query.gte('processed_at', filters.startDate);
      if (filters.endDate) query = query.lte('processed_at', filters.endDate);
      if (filters.projectId) query = query.eq('related_project_id', filters.projectId);
      if (filters.action) query = query.eq('action_taken', filters.action);

      const { data, error } = await query.order('processed_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching processed emails:', error);
      throw error;
    }
  }

  static async getEmailTemplate(userId, templateName) {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('template_name', templateName)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching email template:', error);
      throw error;
    }
  }

  static async saveEmailTemplate(userId, templateData) {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .upsert({
          user_id: userId,
          template_name: templateData.name,
          template_content: templateData.content,
          variables: templateData.variables || {},
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error saving email template:', error);
      throw error;
    }
  }

  static async listEmailTemplates(userId) {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error listing email templates:', error);
      throw error;
    }
  }

  static async deleteEmailTemplate(userId, templateName) {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('user_id', userId)
        .eq('template_name', templateName);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error deleting email template:', error);
      throw error;
    }
  }

  static async getEmailStats(userId, timeRange = '7d') {
    try {
      const startDate = new Date();
      switch (timeRange) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const { data, error } = await supabase
        .from('email_processing')
        .select('action_taken, processed_at')
        .eq('user_id', userId)
        .gte('processed_at', startDate.toISOString());

      if (error) throw error;

      // Process stats
      const stats = {
        total: data.length,
        byAction: {},
        byDay: {}
      };

      data.forEach(email => {
        // Count by action
        stats.byAction[email.action_taken] = (stats.byAction[email.action_taken] || 0) + 1;

        // Count by day
        const day = new Date(email.processed_at).toISOString().split('T')[0];
        stats.byDay[day] = (stats.byDay[day] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting email stats:', error);
      throw error;
    }
  }
}

module.exports = EmailProcessing; 