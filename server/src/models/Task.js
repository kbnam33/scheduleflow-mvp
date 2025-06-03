// FILENAME: server/src/models/Task.js
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

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
    logger.error('Failed to log user event from Task.js', { userId, eventType, error: error.message });
  }
}

class Task {
  static async create({
    userId,
    projectId, // New: ensure this is passed and is FK to projects table
    title,
    description,
    status = 'pending', // Default status
    priority,
    estimated_hours, // New
    due_date,        // Kept as due_date, ensure it's TIMESTAMPTZ if needed
    ai_suggested = false, // New
    tags,            // New
    order_index,     // New
  }) {
    if (!userId || !title) {
      logger.error('Task.create called with missing userId or title', { userId, title });
      throw new Error('User ID and Title are required to create a task.');
    }
    try {
      const taskToInsert = {
        user_id: userId,
        project_id: projectId,
        title,
        description,
        status,
        priority,
        estimated_hours,
        due_date,
        ai_suggested,
        tags,
        order_index,
        // created_at and updated_at are handled by DB defaults/triggers
      };
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskToInsert])
        .select() // Select the inserted row
        .single();

      if (error) {
        logger.error('Error creating task in DB', { code: error.code, message: error.message, details: error.details, taskData: taskToInsert });
        throw error;
      }
      
      await logUserEvent(userId, 'task_created', { taskId: data.id, title, projectId });
      logger.info('Task created successfully', { taskId: data.id, userId });
      return data;
    } catch (error) {
      logger.error('Critical error creating task', { message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getById(taskId, userId) {
    if (!taskId || !userId) {
      logger.error('Task.getById called with missing taskId or userId');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, name, status), 
          dependencies:task_dependencies(depends_on_task_id, task_dependency:tasks(id, title, status)),
          comments:task_comments(id, comment, created_at, user:users(id, full_name))
        `)
        // NOTE: 'task_dependencies' and 'task_comments' tables and their relations need to be defined in your DB schema.
        // The query assumes 'task_dependency' is the alias for the related task in task_dependencies.
        // And 'user' is an alias for users related to comments.
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('Error fetching task by ID from DB', { taskId, userId, code: error.code, message: error.message });
        // PGRST116 means no rows found, which is a valid case for maybeSingle, single will error.
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    } catch (error) {
      logger.error('Critical error fetching task by ID', { taskId, userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async update(taskId, userId, updates) {
    if (!taskId || !userId || !updates || Object.keys(updates).length === 0) {
      logger.error('Task.update called with missing taskId, userId, or empty updates');
      throw new Error('Task ID, User ID, and updates are required.');
    }
    try {
      // Ensure user_id is not part of updates payload directly for security
      const { user_id, id, created_at, ...validUpdates } = updates;
      
      // Handle specific updates like task completion
      if (validUpdates.status === 'completed' && !validUpdates.completed_at) {
        validUpdates.completed_at = new Date().toISOString();
      }
      if (validUpdates.status !== 'completed' && validUpdates.hasOwnProperty('completed_at')) {
        // If status is changed from completed, nullify completed_at unless explicitly provided
         if (validUpdates.completed_at === undefined) validUpdates.completed_at = null;
      }


      const { data, error } = await supabase
        .from('tasks')
        .update(validUpdates) // updated_at will be handled by trigger
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating task in DB', { taskId, userId, code: error.code, message: error.message, updatesAttempted: validUpdates});
        throw error;
      }
      
      await logUserEvent(userId, 'task_updated', { taskId, updatedFields: Object.keys(validUpdates) });
      logger.info('Task updated successfully', { taskId, userId });
      return data;
    } catch (error) {
      logger.error('Critical error updating task', { taskId, userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async delete(taskId, userId) {
    if (!taskId || !userId) {
      logger.error('Task.delete called with missing taskId or userId');
      throw new Error('Task ID and User ID are required for deletion.');
    }
    try {
      // Optionally fetch task first to log details, or handle if it doesn't exist
      const taskToDelete = await this.getById(taskId, userId);
      if (!taskToDelete) {
          logger.warn('Attempted to delete non-existent or unauthorized task', { taskId, userId });
          return false; // Or throw a 404 type error
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting task from DB', { taskId, userId, code: error.code, message: error.message });
        throw error;
      }
      
      await logUserEvent(userId, 'task_deleted', { taskId, title: taskToDelete.title });
      logger.info('Task deleted successfully', { taskId, userId });
      return true;
    } catch (error) {
      logger.error('Critical error deleting task', { taskId, userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async listByUser(userId, filters = {}) {
    if (!userId) {
      logger.error('Task.listByUser called without userId');
      return [];
    }
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, name)
        `)
        // NOTE: The original 'dependencies' join was complex and might need specific tables.
        // Simplified for now to focus on task fields. Add back if 'task_dependencies' is ready.
        // dependencies:task_dependencies(depends_on_task:tasks(*))
        .eq('user_id', userId);

      // Apply filters
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.projectId) query = query.eq('project_id', filters.projectId);
      if (filters.ai_suggested !== undefined) query = query.eq('ai_suggested', filters.ai_suggested);
      if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
        // Assuming tags is an array of strings and you want to match tasks containing any of these tags
        query = query.overlaps('tags', filters.tags); // or .contains for all tags
      }
      
      const sortOrder = filters.sortOrder || 'asc'; // 'asc' or 'desc'
      const sortBy = filters.sortBy || 'order_index'; // Default sort by order_index, then due_date, then created_at

      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
                   .order('due_date', { ascending: true, nullsFirst: false }) // Tasks with due dates sooner first
                   .order('created_at', { ascending: true });


      const { data, error } = await query;

      if (error) {
        logger.error('Error listing tasks from DB', { userId, code: error.code, message: error.message, filters });
        throw error;
      }
      return data || [];
    } catch (error) {
      logger.error('Critical error listing tasks', { userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  // Methods for dependencies and comments rely on 'task_dependencies' and 'task_comments' tables.
  // These tables need to be defined. For now, these methods are placeholders or will error if tables don't exist.
  // Ensure these methods also include user_event logging if implemented.

  static async addDependency(taskId, dependsOnTaskId, userId) {
    logger.warn('Task.addDependency called, but task_dependencies table schema and logic needs review/implementation.', { taskId, dependsOnTaskId });
    // Placeholder - requires 'task_dependencies' table
    // ... (original logic) ...
    // await logUserEvent(userId, 'task_dependency_added', { taskId, dependsOnTaskId });
    return null;
  }

  static async removeDependency(taskId, dependsOnTaskId, userId) {
    logger.warn('Task.removeDependency called, but task_dependencies table schema and logic needs review/implementation.', { taskId, dependsOnTaskId });
    // Placeholder - requires 'task_dependencies' table
    // ... (original logic) ...
    // await logUserEvent(userId, 'task_dependency_removed', { taskId, dependsOnTaskId });
    return false;
  }

  static async addComment(taskId, userId, comment) {
    logger.warn('Task.addComment called, but task_comments table schema and logic needs review/implementation.', { taskId });
    // Placeholder - requires 'task_comments' table
    // ... (original logic) ...
    // await logUserEvent(userId, 'task_comment_added', { taskId, commentId: data.id });
    return null;
  }
}

module.exports = Task;