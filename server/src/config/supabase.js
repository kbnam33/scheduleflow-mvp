const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  logger.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

// Test the connection
supabase.from('tasks').select('count', { count: 'exact', head: true })
  .then(() => {
    logger.info('Successfully connected to Supabase');
  })
  .catch(error => {
    logger.error('Failed to connect to Supabase:', error);
    process.exit(1);
  });

module.exports = supabase; 