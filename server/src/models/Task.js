const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class Task {
  static async create({ userId, projectId, title, description, status, priority, estimatedHours, deadline, aiGenerated, tags }) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          user_id: userId,
          project_id: projectId,
          title,
          description,
          status,
          priority,
          estimated_hours: estimatedHours,
          deadline,
          ai_generated: aiGenerated,
          tags
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating task:', error);
      throw error;
    }
  }

  static async getById(taskId, userId) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(*),
          dependencies:task_dependencies(
            depends_on_task:tasks(*)
          ),
          comments:task_comments(*)
        `)
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching task:', error);
      throw error;
    }
  }

  static async update(taskId, userId, updates) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating task:', error);
      throw error;
    }
  }

  static async delete(taskId, userId) {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error deleting task:', error);
      throw error;
    }
  }

  static async listByUser(userId, filters = {}) {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          project:projects(*),
          dependencies:task_dependencies(
            depends_on_task:tasks(*)
          )
        `)
        .eq('user_id', userId);

      // Apply filters
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.projectId) query = query.eq('project_id', filters.projectId);
      if (filters.aiGenerated !== undefined) query = query.eq('ai_generated', filters.aiGenerated);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error listing tasks:', error);
      throw error;
    }
  }

  static async addDependency(taskId, dependsOnTaskId, userId) {
    try {
      // Verify both tasks belong to the user
      const [task1, task2] = await Promise.all([
        this.getById(taskId, userId),
        this.getById(dependsOnTaskId, userId)
      ]);

      if (!task1 || !task2) {
        throw new Error('One or both tasks not found');
      }

      const { data, error } = await supabase
        .from('task_dependencies')
        .insert([{
          task_id: taskId,
          depends_on_task_id: dependsOnTaskId
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error adding task dependency:', error);
      throw error;
    }
  }

  static async removeDependency(taskId, dependsOnTaskId, userId) {
    try {
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('task_id', taskId)
        .eq('depends_on_task_id', dependsOnTaskId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error removing task dependency:', error);
      throw error;
    }
  }

  static async addComment(taskId, userId, comment) {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert([{
          task_id: taskId,
          user_id: userId,
          comment
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error adding task comment:', error);
      throw error;
    }
  }
}

module.exports = Task; 