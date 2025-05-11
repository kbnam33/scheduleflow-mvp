import { OpenAIApi, Configuration } from 'openai';

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set in environment variables');
  return new OpenAIApi(new Configuration({ apiKey }));
}

// SOP Prompt Templates
export const SOP_PROMPTS = {
  midFocus: `You are an expert assistant. Help the user focus on the most important task for the next hour.`,
  projectCheck: `You are an expert project manager. Review the user's project status and suggest next steps.`,
  newProjectOnboarding: `You are an expert project manager. Given a project brief, generate a structured roadmap with phases and tasks in JSON format.`,
  taskGeneration: `For each phase, list tasks as objects with title, description, and due date fields. Output a JSON array of phases and tasks.`,
  assetPrep: `You are an expert project coordinator. Given a project or meeting context, list the filenames or URLs of all files/assets the user should prepare next. Output a JSON array of objects with filename and (optional) url fields.`,
  chatDrivenHelpers: `You are an AI assistant for productivity, scheduling, and project management. Be concise, helpful, and context-aware.`,
  errorFallback: `I'm sorry, I couldn't process your request right now. Please try again or ask something else.`,
  // Add more templates as needed
}; 