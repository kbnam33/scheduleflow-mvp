# Development Lessons (Updated)

## Architecture Decisions

### Mobile App
- Expo managed workflow for rapid iteration
- NativeWind for cross-platform styling
- React Navigation with strict type safety
- Context + AsyncStorage for state and persistence
- Feature-based folder structure, all screens in app/screens
- Axios for all API calls

### Backend
- Express with TypeScript for type safety
- Supabase for database, auth, and event logging
- OpenAI API for all AI-driven features
- Background worker (cron) for proactive suggestions
- All API endpoints versioned and documented

## Best Practices

### Code Organization
- Feature-based folders, no stray files
- Shared components and types
- Constants and SOP prompts in dedicated files
- All code and file operations strictly within the correct app/server folders

### State Management
- Context for global state
- AsyncStorage for chat and persistent context
- Local state for UI and loading
- Proper error handling and toasts for all network actions

### API Integration
- Axios for HTTP
- Type-safe API responses
- Loading and error states for all network calls
- All endpoints return clear JSON and handle fallbacks

### Testing
- Integration tests for all new endpoints
- Manual and automated error/fallback testing
- UI feedback for all async actions

## Common Issues & Solutions

### Performance
- Loading spinners for all async UI
- Toasts for user feedback
- Efficient polling for badges

### Security
- .env for all secrets, never committed
- API key protection
- Input validation on all endpoints
- Error fallback for all AI calls

### Development Workflow
- Git for all changes, clear commit messages
- No manual file moves—everything scripted
- User always wants a single, correct iteration

## What I Have Learned About the User
- You are extremely detail-oriented and want pixel-perfect UI and correct folder structure
- You require all code and file operations to be strictly within the correct folders (no stray files)
- You want all errors fixed in a single iteration, with no back-and-forth
- You expect all integrations (AI, backend, UI) to be fully functional before moving on
- You prefer not to be asked for manual steps unless absolutely necessary
- You want clear, actionable instructions for any manual steps (e.g., .env, git)
- You value best practices, type safety, and robust error handling
- You want the assistant to remember your preferences for all future steps

## Future Improvements
- Refactor for even stricter type safety
- More automated tests
- Further UI polish and animation
- More robust error and fallback handling
- Expand SOP prompt library for new features

## Feature Roadmap
- More AI-driven features
- Deeper Supabase integration
- More proactive and context-aware suggestions
- Improved asset and task management flows 