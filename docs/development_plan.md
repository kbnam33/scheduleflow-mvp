# ScheduleFlow: Comprehensive Development & Enhancement Plan

## Overall Architecture Philosophy:
ScheduleFlow will be a sophisticated, **Context-Aware AI Agent** built around a robust **Model Context Protocol (MCP)** implementation. The MCP will serve as the central nervous system for managing, processing, and leveraging diverse contextual information to enable deep personalization, intelligent proactivity, and truly adaptive user support. The backend will be the primary orchestrator of the MCP and AI logic, with the frontend providing a rich, interactive experience.

---

## Phase 0: Foundational MCP & Core Data Model Enhancement

**Objective:** Establish a solid, scalable foundation for all contextual and proactive features. Ensure backend and database can support the advanced capabilities.

**A. Backend - MCP Core & Database Schema:**
1.  **Reconcile Server Entry Points & Worker:**
    * **Task:** Consolidate API endpoint logic. Designate `server/src/app.js` (Express app) as the primary API server.
    * **Task:** Adapt the cron job logic from `server/src/index.ts` into a separate worker script (e.g., `server/src/worker.js`) that can be run independently (e.g., `node server/src/worker.js`) or integrated into the main app process if appropriate for the deployment environment. Ensure it uses the same Supabase client and logger.
    * **Refactor:** Ensure all Supabase interactions across `app.js`, routes, models, services, and the worker use the centralized Supabase client from `server/src/config/supabase.js`.
2.  **Define/Refine Core MCP-related DB Schemas (Supabase):**
    * **`ai_context` Table (New or Refine if `AIContext.js` implies a different structure):**
        * `id` (UUID, PK)
        * `user_id` (UUID, FK to `users.id`, indexed)
        * `context_type` (TEXT, e.g., 'work_pattern', 'project_trajectory_model', 'flow_state_model', 'user_energy_model', 'communication_style_summary', 'client_context_graph_node')
        * `context_key` (TEXT, nullable, e.g., project_id for project-specific context, client_id for client-specific context)
        * `context_data` (JSONB, stores the actual contextual model/data)
        * `confidence_score` (FLOAT, 0.0-1.0)
        * `last_updated` (TIMESTAMPTZ)
        * `version` (INTEGER, for model versioning)
        * *Index on `(user_id, context_type, context_key)` for efficient lookups.*
    * **`user_events` Table (New, as per `server/src/index.ts` logic):**
        * `id` (UUID, PK)
        * `user_id` (UUID, FK to `users.id`, indexed)
        * `event_type` (TEXT, e.g., 'app_open', 'task_started', 'task_completed', 'flow_state_entered', 'client_email_received', 'meeting_scheduled')
        * `event_data` (JSONB, details of the event)
        * `timestamp` (TIMESTAMPTZ, indexed)
    * **`proactive_suggestions` Table (New, as per `server/src/index.ts` logic):**
        * `id` (UUID, PK)
        * `user_id` (UUID, FK to `users.id`, indexed)
        * `suggestion_type` (TEXT, e.g., 'schedule_block', 'prioritize_task', 'client_follow_up', 'well_being_check')
        * `title` (TEXT, short summary for display)
        * `description` (TEXT, detailed suggestion)
        * `action_payload` (JSONB, data needed to execute the suggestion, e.g., `{ "task_id": "...", "new_due_date": "..." }`)
        * `priority` (TEXT, 'high', 'medium', 'low')
        * `status` (TEXT, 'pending', 'accepted', 'rejected', 'dismissed', 'expired')
        * `created_at` (TIMESTAMPTZ)
        * `expires_at` (TIMESTAMPTZ, nullable)
        * `read` (BOOLEAN, default false)
        * `confirmed` (BOOLEAN, default false)
        * `confirmedTime` (TIMESTAMPTZ, nullable)
    * **Enhance `tasks` Table:**
        * Add `actual_start_time` (TIMESTAMPTZ, nullable)
        * Add `actual_end_time` (TIMESTAMPTZ, nullable)
        * Add `completion_timestamp_utc` (TIMESTAMPTZ, nullable)
        * Add `completion_timestamp_user_timezone` (TEXT, nullable)
        * Add `time_taken_seconds` (INTEGER, nullable)
        * Add `original_estimated_hours` (FLOAT, nullable, to compare with `estimated_hours` which might change)
        * Add `task_type_learned` (TEXT, nullable, e.g., 'conceptual_design', 'revision_minor', 'admin_comms')
        * Add `dependencies` (JSONB, array of `task_id`s this task depends on) - *Replaces separate `task_dependencies` table for simpler direct queries if complex graph queries aren't immediately needed. If complex graph ops are common, keep the separate table.*
    * **Enhance `users` Table (schema from `PROJECT_CONTEXT.md`):**
        * Add `role` (TEXT, nullable) - *Already in `PROJECT_CONTEXT.md` schema and `auth.js`.*
        * Ensure `preferences` (JSONB) is used by `UserPreferences.js` model correctly for all preferences.
    * **Enhance `time_blocks` Table (schema from `PROJECT_CONTEXT.md`):**
        * Add `title` (TEXT, nullable)
        * Add `priority` (TEXT, 'high', 'medium', 'low', nullable)
        * Add `protected` (BOOLEAN, default false, for "Interruption Shield")
        * Add `related_task_id` (UUID, FK to `tasks.id`, nullable)
        * Add `ai_suggested` (BOOLEAN, default false)
        * Add `context_snapshot` (JSONB, nullable, e.g., user's perceived energy, specific goal for the block)
3.  **Refactor Backend Models for MCP:**
    * **`AIContext.js`:**
        * Ensure methods align with the refined `ai_context` schema.
        * Develop more sophisticated `calculateConfidenceScore` logic based on data freshness, volume, direct user feedback on context accuracy, etc.
        * Implement methods for versioning and retrieving specific versions of contextual models.
    * **`UserPreferences.js`:** Ensure it robustly handles defaults and updates to the `preferences` JSONB in the `users` table (or individual columns if schema differs).
    * **All Models (`Task.js`, `FocusBlock.js`, etc.):** Integrate creation/update of `user_events` for relevant actions.
4.  **`ai-service.js` - Initial MCP Integration:**
    * Refactor all methods (`processChat`, `generateTaskSuggestions`, etc.) to explicitly fetch comprehensive context via `AIContext.getContextForAI(userId)`.
    * Ensure prompts sent to OpenAI include this rich contextual data for better-tailored responses.
    * Implement logic to update relevant parts of the `ai_context` store after AI interactions (e.g., user preferences inferred from chat, updated communication style summary).

**B. Frontend - Context Provider & Initial Setup:**
1.  **MCP Context Provider:**
    * Create a global React Context provider for ScheduleFlow that can hold and distribute aspects of the MCP relevant to the UI (e.g., current user state, high-level proactive alerts). This is distinct from backend MCP store but is informed by it.
2.  **Event Logging:**
    * Implement frontend event tracking for key user actions (screen views, button clicks related to core features) that send data to the `/api/events` endpoint (which needs to be robustly part of `server/src/app.js`).

---

## Phase 1: Implementing Remaining MVP Core Functionality (with MCP Integration)

**Objective:** Complete all specified MVP features, ensuring they are built with context-awareness from the start.

**A. Backend:**
1.  **Calendar & Video App OAuth Integration:**
    * **Task:** Implement server-side OAuth 2.0 flows for Google Calendar, Outlook Calendar, Zoom, and Google Meet (as per `PROJECT_CONTEXT.md` and `onboarding.tsx`).
    * **Task:** Securely store access/refresh tokens in `calendar_integrations` and `video_integrations` tables.
    * **Task:** Develop service methods to fetch calendar events and create/update events via the respective APIs.
    * **MCP:** Store sync status and high-level calendar patterns (e.g., typical meeting density) in `ai_context`.
2.  **Full CRUD for Projects, Tasks, Assets:**
    * Ensure all routes in `tasks.js`, `projects.js` (if it exists, or add it), `assets.js` (if it exists, or add it) are complete for creating, reading, updating, and deleting these entities, referencing the DB schemas in `PROJECT_CONTEXT.md`.
    * Implement task reordering and completion logic as per `CONTEXT.md`.
3.  **Confirm/Reject AI Suggestions:**
    * Implement backend logic for `/api/tasks/confirm` and `/api/tasks/reject` (as per `Tasks.tsx` and `CONTEXT.md`).
    * Similarly for calendar suggestions (`/api/calendar/confirm`).
    * **MCP:** User confirmations/rejections are critical feedback to update the `confidence_score` and data in the `ai_context` for the related suggestions and models. Log these as `user_events`.
4.  **Proactive Engine (Cron Worker):**
    * Ensure the cron job logic (from `server/src/index.ts`) for detecting patterns and injecting suggestions into `proactive_suggestions` table is functional and robust.
    * Expand event types logged in `user_events` to include more triggers (e.g., 'focus_block_started', 'focus_block_completed_early', 'project_deadline_approaching').

**B. Frontend:**
1.  **Onboarding Flow Completion:**
    * Implement UI for actual OAuth connections for Calendar and Video apps (not just selecting provider).
    * Ensure role and creative hours preferences from `onboarding.tsx` are correctly saved via `/api/users/me/preferences`.
2.  **Home Screen - Dynamic Content:**
    * Fetch and display actual meetings and tasks, not just stubs.
    * Implement the "Dynamic Purpose Bar" to fetch and display content (client queries, AI suggestions, confirmations) based on priority from relevant API endpoints (likely `/api/suggestions` or a new dedicated one).
    * Implement the Message Container for status updates.
    * Chat prompt badge based on unread suggestions.
3.  **Calendar Screen - Full Functionality:**
    * Fetch and display real calendar events and AI-suggested blocks from the backend.
    * Implement "Accept/Edit" for suggestions, calling `/api/calendar/confirm`.
4.  **Chat Screen - Enhancements:**
    * Ensure chat history is passed to `/api/ai/chat`.
    * Render inline asset previews if AI response contains file information.
5.  **Projects & Tasks Screens - Full CRUD & AI Interaction:**
    * Implement full CRUD UI for projects and tasks.
    * Display AI-suggested tasks and implement confirm/reject calling `/api/tasks/confirm` and `/api/tasks/reject`.
    * Implement task completion and reordering.
6.  **Assets Screen:** Implement "Prepare Docs" functionality to call `/api/assets-query` and display suggestions.

---

## Phase 2: Deep Contextual Enhancements (Flow State & Project Intelligence)

**Objective:** Implement the advanced MCP-driven features for deep work and project understanding.

**A. Backend & MCP:**
1.  **Dynamic Flow Potential Assessment Model (`ai_context`):**
    * **Task:** Design `context_data` schema for `flow_state_model`. Include fields for learned rhythms (per task type), project urgency/excitement scores, impact of preceding activities, task complexity scores.
    * **Task:** Develop `ai-service.js` logic to update this model based on `user_events` (task completions, block durations, user feedback).
    * **Task:** `AIContext.js` methods to retrieve and update this model.
2.  **Intelligent Interruption Shield Protocol (MCP Rules Engine):**
    * **Task:** Design `context_data` schema in `user_preferences` (or `ai_context`) for user-defined "shield-piercing" rules (e.g., keywords, senders, project tags).
    * **Task:** `ai-service.js` logic to evaluate incoming notifications (conceptual, as direct notification access isn't planned for MVP) against these rules and the current "Flow State" (see frontend).
3.  **Contextual Project Trajectory Forecasting Model (`ai_context`):**
    * **Task:** Design `context_data` schema for `project_trajectory_model`. Store as a graph or structured JSON: project types, typical tasks, user-specific effort per task type, common dependencies, roadblock patterns, client communication patterns per phase.
    * **Task:** `ai-service.js` logic to update this model based on completed projects, task durations, user feedback from Post-Project Reviews.
4.  **Resource & Energy Management Model (`ai_context`):**
    * **Task:** Design `context_data` schema for `user_energy_model`. Track energy patterns vs. time of day, day of week, task types.
    * **Task:** `ai-service.js` logic to update this based on task completion speed, break frequency, reported flow levels.

**B. Frontend & `ai-service.js` (Prompts & UI):**
1.  **Flow State UI & Interaction:**
    * **Task:** On the "Active Work Screen" (to be designed/implemented), allow users to manually indicate "I'm in deep flow."
    * **Task:** When scheduling, `ai-service.js` (prompt enhancement) to use "Flow Potential Score" from MCP to rank/suggest slots. Frontend to display these (e.g., "Peak Flow Slot!").
    * **Task:** UI for managing interruption shield settings. When shield is active, display minimal info about batched notifications.
2.  **Proactive Project Intelligence UI:**
    * **Task:** `ai-service.js` (prompt enhancement for task generation/prioritization) to use "Project Trajectory Forecasting" and "Resource & Energy Management" models.
    * **Task:** Frontend to display AI warnings about project risks (e.g., "Heads up: Based on similar projects, client feedback might delay the next phase. Draft a check-in email?").
    * **Task:** Frontend to display energy-aware scheduling suggestions (e.g., "This is a heavy design task. Your energy is usually highest in the mornings. Schedule then?").

---

## Phase 3: Advanced Proactivity, Personalization & Adaptation

**Objective:** Implement features for pace monitoring, well-being, cold start, and truly adaptive communication/asset management.

**A. Backend & MCP:**
1.  **Pace Monitoring & Adaptive Strategy Engine:**
    * **Task:** `ai-service.js` logic for continuous pace analysis (actual vs. estimated task times from MCP).
    * **Task:** Develop algorithms/prompts for generating "Intelligent Re-Prioritization" and "Flow-Optimized Push Strategies" when deadlines are at risk. These strategies are stored/updated in MCP.
    * **Task:** Logic for drafting client communication about delays, using communication style from MCP.
2.  **Cold Start Solution Enhancement:**
    * **Task:** Implement backend mechanisms to securely store and query anonymized, aggregated archetype data for professions.
    * **Task:** Refine `AIContext.js` and `UserPreferences.js` to use this archetype data for new users of known professions.
    * **Task:** Develop the "Guided Contextual Interview" flow within `ai-service.js` for new user professions, with logic to parse responses and seed initial MCP models.
3.  **Proactive Well-being & Burnout Prevention Model (`ai_context`):**
    * **Task:** Design `context_data` schema for `user_well_being_model`. Track long-term work hours, break patterns, reported stress, flow achievement frequency.
    * **Task:** Cron worker job to analyze this model and generate `proactive_suggestions` for well-being.
4.  **Post-Project Review & Knowledge Capitalization:**
    * **Task:** Backend endpoint to receive structured feedback from post-project reviews.
    * **Task:** `ai-service.js` logic to process this feedback and update relevant MCP models (project trajectories, task estimates, client interaction patterns).
5.  **Hyper-Contextual Communication & Asset Management (Backend Logic):**
    * **Task:** `ai-service.js` logic for "Proactive Meeting Context Package" generation. This involves fetching data from multiple sources (calendar event details, project assets linked to the meeting's project, recent communication summaries for that client/project from `ai_context`) and synthesizing a brief.
    * **Task:** `ai-service.js` logic for "Anticipatory Asset Retrieval." When a task is marked active, this service uses MCP (task type, project context, learned associations) to predict and list relevant asset IDs.

**B. Frontend & `ai-service.js` (Prompts & UI):**
1.  **Pace Monitoring UI:**
    * **Task:** Display warnings and suggestions from the AI when deadlines are at risk.
    * **Task:** UI for user to choose between re-prioritization, a "push strategy" (displaying the AI's new plan), or drafting client communication.
2.  **Cold Start Onboarding UI:**
    * **Task:** Implement the "Guided Contextual Interview" UI flow during onboarding for new professions.
    * **Task:** Allow users to import/paste project templates.
3.  **Well-being UI:**
    * **Task:** Display proactive well-being suggestions (e.g., as a card on Home or a high-priority chat suggestion).
4.  **Post-Project Review UI:**
    * **Task:** Simple form/flow for users to provide feedback after project completion.
5.  **Enhanced "Active Work Screen" & Meeting Prep UI:**
    * **Task (Active Screen):** Implement features from previous phase discussion: "Active Task Focus," "Micro-Commitments," "Flow Journal Snippets," "Dynamic Resource Panel," "Brain Dump," "Intelligent Break Management," "Smarter Completion & Reflection." These heavily interact with backend MCP updates.
    * **Task (Meeting Prep):** Display the "Meeting Context Package" clearly. UI to show "Anticipated Assets" when a task starts.

---

## Phase 4: Polish, Testing, and Launch Readiness

**Objective:** Ensure a high-quality, robust, and polished application.

**A. Core Development:**
1.  **Comprehensive Error Handling & Fallbacks:** Implement robust error handling for all API calls, AI interactions, and backend processes, leveraging `errorFallback` SOP prompts where appropriate.
2.  **Performance Optimization:**
    * Optimize database queries (add indexes identified in Phase 0).
    * Implement caching strategies where appropriate (e.g., for user preferences, stable AI context models).
    * Frontend performance: optimize list rendering, reduce re-renders.
3.  **Security Hardening:** Review all authentication, authorization, data validation, and API key handling. Ensure Supabase Row Level Security is appropriately configured.
4.  **UI Polish:** Implement all micro-animations and ensure pixel-perfect UI based on design specs (or intuitive design if specs are missing for new elements).
5.  **Thorough Logging:** Ensure all critical paths, errors, and AI interactions are logged effectively using the Winston logger.

**B. Testing:**
1.  **Unit Tests:** For complex business logic in `ai-service.js`, MCP model manipulation, and critical utility functions.
2.  **Integration Tests:** For all API endpoints, ensuring they interact correctly with models and external services (mocked OpenAI/Calendar APIs).
3.  **End-to-End Testing (Manual & Automated if possible):**
    * Onboarding flow.
    * Core scheduling and task management with AI suggestions.
    * Proactive features (interruption shield, deadline warnings, well-being prompts).
    * Contextual help and asset management.
4.  **User Acceptance Testing (UAT):** With a small group of target creative freelancers.

**C. Documentation:**
1.  Finalize API documentation.
2.  User guides for key features, especially proactive and AI-driven ones.
3.  Deployment and maintenance guides.

---

This plan is ambitious but lays the groundwork for a truly exceptional AI agent. We will iterate and adapt as needed. The key is to build the MCP foundation correctly, as all advanced features depend on it.