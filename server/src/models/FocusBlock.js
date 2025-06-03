// FILENAME: server/src/models/FocusBlock.js
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
    logger.error('Failed to log user event from FocusBlock.js', { userId, eventType, error: error.message });
  }
}

class FocusBlock {
  static async create({
    userId,
    title, // New
    description, // New
    startTime,
    endTime,
    type, // Existing: 'creative', 'meeting', 'break', 'focus', 'prep'
    status = 'pending', // Existing: 'suggested', 'confirmed', 'completed', default to 'pending'
    priority, // New
    is_protected = false, // New (maps from 'protected')
    related_project_id, // New
    related_task_id, // New
    related_meeting_id, // New
    block_type, // New - consider merging with 'type' or clarifying purpose
    notes, // New
    is_ai_suggested = false, // New (maps from 'aiSuggested')
    is_confirmed = false, // New
  }) {
    if (!userId || !startTime || !endTime || !type) {
        logger.error('FocusBlock.create called with missing required fields', { userId, startTime, endTime, type });
        throw new Error('User ID, start time, end time, and type are required for a focus block.');
    }
    try {
      const blockToInsert = {
        user_id: userId,
        title,
        description,
        start_time: startTime,
        end_time: endTime,
        type, // Main type
        status,
        priority,
        is_protected,
        related_project_id,
        related_task_id,
        related_meeting_id,
        block_type: block_type || type, // If block_type not provided, default to main type
        notes,
        is_ai_suggested,
        is_confirmed: status === 'confirmed' ? true : is_confirmed, // Ensure is_confirmed reflects status
        // created_at and updated_at handled by DB
      };

      const { data, error } = await supabase
        .from('time_blocks')
        .insert([blockToInsert])
        .select()
        .single();

      if (error) {
        logger.error('Error creating focus block in DB', { code: error.code, message: error.message, details: error.details, blockData: blockToInsert });
        throw error;
      }
      
      await logUserEvent(userId, 'focus_block_created', { focusBlockId: data.id, title, type });
      logger.info('Focus block created successfully', { focusBlockId: data.id, userId });
      return data;
    } catch (error) {
      logger.error('Critical error creating focus block', { message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getById(blockId, userId) {
    if (!blockId || !userId) {
        logger.error('FocusBlock.getById called with missing blockId or userId');
        return null;
    }
    try {
      const { data, error } = await supabase
        .from('time_blocks')
        .select(`
          *,
          project:related_project_id(id, name), 
          task:related_task_id(id, title)
        `)
        // NOTE: The project and task relations assume 'projects(id, name)' and 'tasks(id, title)' are sufficient.
        // Adjust if more fields are needed from related entities.
        .eq('id', blockId)
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('Error fetching focus block by ID from DB', { blockId, userId, code: error.code, message: error.message });
        if (error.code === 'PGRST116') return null; // Not found is a valid case
        throw error;
      }
      return data;
    } catch (error) {
      logger.error('Critical error fetching focus block by ID', { blockId, userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async update(blockId, userId, updates) {
    if (!blockId || !userId || !updates || Object.keys(updates).length === 0) {
      logger.error('FocusBlock.update called with missing ID, userId, or empty updates');
      throw new Error('Block ID, User ID, and updates are required.');
    }
    try {
      const { user_id, id, created_at, ...validUpdates } = updates;

      // If status is updated to 'confirmed', ensure 'is_confirmed' is true
      if (validUpdates.status === 'confirmed') {
        validUpdates.is_confirmed = true;
      }


      const { data, error } = await supabase
        .from('time_blocks')
        .update(validUpdates) // updated_at handled by trigger
        .eq('id', blockId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating focus block in DB', { blockId, userId, code: error.code, message: error.message, updatesAttempted: validUpdates });
        throw error;
      }
      
      await logUserEvent(userId, 'focus_block_updated', { focusBlockId: blockId, updatedFields: Object.keys(validUpdates) });
      logger.info('Focus block updated successfully', { focusBlockId: blockId, userId });
      return data;
    } catch (error) {
      logger.error('Critical error updating focus block', { blockId, userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async delete(blockId, userId) {
    if (!blockId || !userId) {
        logger.error('FocusBlock.delete called with missing blockId or userId');
        throw new Error('Block ID and User ID are required for deletion.');
    }
    try {
      const blockToDelete = await this.getById(blockId, userId);
      if (!blockToDelete) {
          logger.warn('Attempted to delete non-existent or unauthorized focus block', { blockId, userId });
          return false;
      }

      const { error } = await supabase
        .from('time_blocks')
        .delete()
        .eq('id', blockId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting focus block from DB', { blockId, userId, code: error.code, message: error.message });
        throw error;
      }
      
      await logUserEvent(userId, 'focus_block_deleted', { focusBlockId: blockId, title: blockToDelete.title });
      logger.info('Focus block deleted successfully', { focusBlockId: blockId, userId });
      return true;
    } catch (error) {
      logger.error('Critical error deleting focus block', { blockId, userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async listByUser(userId, { startDate, endDate, type, status, priority, is_ai_suggested, related_project_id, related_task_id } = {}) {
    if (!userId) {
        logger.error('FocusBlock.listByUser called without userId');
        return [];
    }
    try {
      let query = supabase
        .from('time_blocks')
        .select(`
          *,
          project:related_project_id(id, name),
          task:related_task_id(id, title)
        `)
        .eq('user_id', userId);

      if (startDate) query = query.gte('start_time', startDate.toISOString());
      if (endDate) query = query.lte('end_time', endDate.toISOString()); // Corrected to use end_time for lte
      
      // More precise range check for overlaps if needed:
      // if (startDate && endDate) {
      //   query = query.or(`start_time.lte.${endDate.toISOString()},end_time.gte.${startDate.toISOString()}`);
      // }


      if (type) query = query.eq('type', type);
      if (status) query = query.eq('status', status);
      if (priority) query = query.eq('priority', priority);
      if (is_ai_suggested !== undefined) query = query.eq('is_ai_suggested', is_ai_suggested);
      if (related_project_id) query = query.eq('related_project_id', related_project_id);
      if (related_task_id) query = query.eq('related_task_id', related_task_id);


      const { data, error } = await query.order('start_time', { ascending: true });

      if (error) {
        logger.error('Error listing focus blocks from DB', { userId, code: error.code, message: error.message, filters: {startDate, endDate, type, status, priority} });
        throw error;
      }
      return data || [];
    } catch (error) {
      logger.error('Critical error listing focus blocks', { userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  static async findOverlappingBlocks(userId, startTime, endTime, excludeBlockId = null) {
    if (!userId || !startTime || !endTime) {
        logger.error('FocusBlock.findOverlappingBlocks called with missing required fields.');
        return [];
    }
    try {
      let query = supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        // Check for blocks that start before the new one ends AND end after the new one starts
        .lt('start_time', new Date(endTime).toISOString()) 
        .gt('end_time', new Date(startTime).toISOString());

      if (excludeBlockId) {
        query = query.neq('id', excludeBlockId);
      }
      
      const { data, error } = await query.order('start_time', { ascending: true });

      if (error) {
        logger.error('Error finding overlapping focus blocks from DB', { userId, code: error.code, message: error.message });
        throw error;
      }
      return data || [];
    } catch (error) {
      logger.error('Critical error finding overlapping focus blocks', { userId, message: error.message, stack: error.stack });
      throw error;
    }
  }

  // The suggestBlocks method's core logic is AI-driven and likely belongs in AIService.
  // Kept structure, but actual generation should be delegated.
  static async suggestBlocks(userId, preferences) {
    logger.info('FocusBlock.suggestBlocks called. Note: Core suggestion logic should be in AIService.', { userId });
    // This method is a placeholder as its primary logic (AI suggestion) should be in AIService.
    // It might be refactored to call an AIService method.
    // For now, it returns an empty array as per its original stub.
    // Example: return await AIService.suggestFocusBlocks(userId, preferences);
    return [];
  }
}

module.exports = FocusBlock;