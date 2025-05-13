# Project Context

## Overview

This document outlines the high-level context for the ScheduleFlow MVP (new) project. It describes the intended behavior of each screen (Home, Calendar, Chat, Projects, Tasks, and Assets) and the design specs (safe area, margins, fonts, colors, animations, bottom navigation, and screen-specific layouts) as well as the data storage (user profile, auth tokens, event logs, meetings, projects, assets, chat history, and proactive suggestions) and the user flow (onboarding, home, chat, calendar, projects, and proactive engine).

---

## Screen & Element Behavior

### Home Screen

- **Greeting & Date:** Static text (from user profile & system date).
- **Today's Meetings & Schedule Cards:** Fetch from /api/meetings and /api/schedule. If empty, auto-switch to "Upcoming."
- **Pending Tasks Card:** Fetch incomplete tasks via /api/tasks?state=pending.
- **Chat Prompt Badge:** Query /api/suggestions?read=false to show a blue dot on the Chat tab.
- **Input Bar:** Sends text to /api/chat; on success, the response is inserted into history and rendered as a new bubble.

### Calendar Screen

- **Day/Week/Month Toggle:** Local state switch—refetch /api/meetings and /api/calendar/suggest?view=….
- **Grid & Blocks:** Render confirmed blocks (solid) versus suggestions (dashed).
- **Accept/Edit Buttons:**
  - Accept → POST /api/calendar/confirm (suggestionId).
  - Edit → open a date-picker, then POST /api/calendar/confirm with the new time.

### Chat Screen

- **Quick-Action Bubbles:** On first (or alternate) opens, derive suggestions from /api/suggestions.
- **Message List:**
  - User messages → POST /api/chat (with the last 10 messages history).
  - AI replies → appended on success; low-confidence fallback from Error-Fallback SOP.
- **Inline Asset Previews:** If the response includes files, render them with download buttons linking to storage URLs.

### Projects Screen

- **Projects List:** GET /api/projects, render cards (with progress bars).
- **Tap → Tasks:** Navigate (passing projectId) to the Tasks screen.

### Tasks Screen

- **AI-Suggested Tasks Card:** GET /api/tasks?projectId=…&suggested=true. Confirm → POST /api/tasks/confirm; Reject → /api/tasks/reject. Animations on each action.
- **In-Progress & Completed Cards:** GET tasks by state.
- **Checkbox / Drag-Handle:**
  - Checking → POST /api/tasks/complete.
  - Drag end → POST /api/tasks/reorder (with new order).
- **Add Task Button:** Opens a modal → POST /api/tasks/new.

---

## Detailed Design Specs

### 1. Safe Area & Global Layout

- **Status Bar & Notch:** All content respects platform safe areas. No elements (headers, nav, buttons) underlap the status bar or bottom gesture bar.
- **Margins & Padding:** Global horizontal margins = 16px. Vertical spacing:
  - Between major sections (headers, cards) = 24px.
  - Between list items = 16px.
- **Font & Colors:**
  - Primary text: 16px, weight 500, #FFFFFF.
  - Secondary text: 14px, weight 400, #B0B0B0.
  - Heading text: 24px, weight 600, #FFFFFF.
  - Surface background: #121212.
  - Card background: #1E1E1E.
- **Micro-animations:** fade-ins, slide-ups (per spec in project_context).

### 2. Bottom Tab Navigation

- **Position:** Fixed at bottom safe area, occupying full width, height 56px + safe inset.
- **Icons & Labels:** 24px icons, labels hidden on all tabs except the active (label appears on active, bold 12px text #FFFFFF).
- **Active State:** Icon tint #00E0B0, label visible.
- **Unread Indicator:** Small 6px blue dot at top-right of icon if notification unread.
- **No extra buttons (e.g., "Suggest Prep") appear in nav.**

### 3. Home Screen

#### 3.1 Header

- **Elements:** User avatar (40px circle, left), title "Welcome back, {Name}" (24px), subtitle date (14px).
- **Right Icons:** Clipboard icon then bell icon (24px each, spacing 16px).

#### 3.2 Stats Cards

- Two side-by-side cards, each 48px tall, width = (screenWidth – 48px)/2, background #1E1E1E, border-radius 12px.
- Left: "Today's Meetings" label + count; Right: "Pending Tasks" label + count.

#### 3.3 Today's Schedule

- Title "Today's Schedule" (18px, weight 500), "View All" link (14px) aligned right.
- List items: card height 72px, border-radius 12px, 16px vertical margin.
- Left: time (16px, 14px secondary), center: event title 16px, details 14px secondary.
- Right: calendar icon button (24px).

#### 3.4 Chat Prompt

- Last-thread pill: rounded 20px height, padding 8px 12px, background #2A2A2A, label text 14px.
- Input: full-width text field 48px tall with mic icon left and send arrow right.

### 4. Calendar Screen

#### 4.1 Header

- Back arrow (24px) + "Calendar" title (24px), three-dot menu (24px).

#### 4.2 Month Selector

- Full-width calendar widget with day names 14px, date numbers 16px, selected date circle 32px (white bg).

#### 4.3 Today's Events List

- Title "Today's Events" (18px) with 24px top margin.
- Event cards: same style as Home list items (without bottom nav).

#### 4.4 Suggestion Strip

- Removed: No persistent "Suggest Prep" button—proactive suggestions appear inline (as dashed blocks).

### 5. Chat Screen

#### 5.1 Header

- Back arrow + avatar + title "AI Assistant" + overflow menu.

#### 5.2 Quick Actions

- Four bubbles in 2×2 grid; each bubble 120×48px, rounded 12px, 12px margin.

#### 5.3 Message List

- User bubbles: right-aligned, background #2A2A2A.
- Assistant bubbles: left-aligned, background #1E1E1E.
- Text 16px, timestamps 12px (bottom-right of bubble).

#### 5.4 Document Cards

- When assistant sends assets: card height 80px, icon-left, title 16px, subtitle 14px, two action buttons below.

#### 5.5 Input & Nav

- Same as Home input. Bottom nav active state for Chat.

### 6. Projects Screen

#### 6.1 Header

- Back arrow + "Projects" title + menu.

#### 6.2 Project List

- Vertical list of cards: height 88px, margin 16px vertical.
- Inside card: number + title 16px, due-date 14px (secondary), horizontal progress bar (4px tall) at bottom, phase badge right.

#### 6.3 Floating Add Button

- 56px circle (bottom-right above nav), + icon 24px.

### 7. Tasks Screen

#### 7.1 Header

- Back arrow + project title + subtitle "Projects / Tasks" + menu.

#### 7.2 Phase Tabs

- Three pills: All / Pending / Completed, 32px tall, spacing 8px.

#### 7.3 Task Cards

- Card: 80px height, 12px radius, margin 12px vertical.
- Title 16px, description 14px (secondary) below.
- Badge for priority (High=red, Medium=amber, Low=green) top-left.
- Due date 14px (right-aligned).
- Drag handle 24px on right.
- Confirm/Reject icons (✔/✖) overlay on right of card (when suggestedByAI).

#### 7.4 Floating Add

- Same as Projects.

#### 7.5 Bottom Action

- Removed: No persistent "Generate Tasks" button; AI suggestions appear inline.

### 8. Interaction Animations & AI Communication

1. **Global Navigation Transitions**
   - **Screen-to-screen Swipe:** Horizontal slide: new screen slides in from right over 200 ms ease-out; previous slides out to left in parallel.
   - **Tab Bar Selection:** Icon color fades (gray → white) and label scales from 0.9→1.0 over 150 ms. Underline "pill" grows from width 0 to full icon+label width in 200 ms.

2. **AI "Typing…" Indicator**
   - **Appearance & Position:** Three dots centered beneath last user bubble, 8 px below its bottom edge.
   - **Animation:** Sequential "dot pulse": each dot scales 0.6→1.0 and opacity 0.3→1.0 in 300 ms, offset by 100 ms. Loop continuously until AI response arrives.
   - **Entrance/Exit:** Fade in + slide up (opacity 0→1, translateY +8→0) in 150 ms. On response, fade out + slide down (opacity 1→0, translateY 0→+8) in 150 ms, then remove.

3. **Chat Bubble Animations**
   - **User Message:** On send: bubble expands vertically (scaleY 0.8→1.0) and fades in (opacity 0→1) over 200 ms.
   - **AI Reply:** After typing indicator disappears, bubble fades in and slides up from 8 px below over 200 ms.
   - **Quick-Action Tiles (Chat Screen):** On initial load: each tile pops (scale 0→1) in 4×2 grid, staggered 50 ms, over 150 ms.

4. **Task & Asset Operations**
   - **Adding a Task:** "+ Add" Button Tap: button scales 1→0.95 over 100 ms, then back over 100 ms. Task Card Insert: new card slides down from top of list (–16 px→0) and fades in (opacity 0→1) over 200 ms. Success Toast: bottom-center toast fades in + slide up (opacity 0→1, translateY +20→0) in 200 ms, auto-dismiss after 1.5 s with reverse animation.
   - **Completing or Rejecting AI-Suggested Task:** ✔/✖ tap: icon ripples (circle scale 0→1.5, opacity 0.4→0) in 200 ms. Card row then fades out + height collapses (200 ms), then removed or moved.

5. **Calendar & Home Animations**
   - **Time-Block Suggestion:** Suggested block card expands from dashed-border outline to full solid-border card (border-width animates 1→2 px) over 200 ms. "Accept" button color fades in (opacity 0→1) over 150 ms.
   - **Calendar Date Toggle:** Date pill background morphs color fill over 150 ms (ease-in-out).
   - **Home List Load:** Meeting/task cards slide up from +16 px with 50 ms stagger, 200 ms each.

6. **Subtle Background & Overlay Effects**
   - **Screen Dimming:** Whenever AI background processing occurs (e.g. generating tasks), apply a semitransparent overlay (black α 0.2) that fades in over 200 ms and disables interactions; fade out when done.
   - **Overlay Spinner:** Centered spinner: circle rotating 360° in 800 ms loop, 2 px stroke, 24 px diameter.

7. **Contextual Micro-Interactions**
   - **Bottom Nav AI-Alert Dot:** When AI has new proactive suggestion unseen: small 8 px diameter teal dot appears at top-right of Chat tab icon, faint pop (scale 0→1) in 150 ms.
   - **Quick-Reply Buttons:** Appear with fade in + scale 0.8→1 over 150 ms, collapse similarly on use.

---

## Data Storage

| Data Type                     | Purpose                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| **User Profile**              | Email, password hash, role, creative hours prefs                                         |
| **Auth Tokens / Connections** | OAuth tokens for calendar & video-call services                                          |
| **Event Logs**                | `screen_open`, `task_completed`, `chat_opened`, `email_replied` (for proactivity triggers) |
| **Meetings & Blocks**         | Confirmed events + AI-suggested time blocks                                              |
| **Projects & Tasks**          | Project meta, AI-suggested tasks, status, priority                                       |
| **Assets**                    | File URLs, suggested vs. uploaded, tags                                                  |
| **Chat History**              | Full conversation (for context and recall)                                               |
| **Proactive Suggestions**     | AI messages, timestamps, read/unread state                                               |

---

## User Flow Context

- **Onboard & Connect:** User signs up, connects their calendar (Google/Outlook/Apple), links video-call apps (Zoom/Meet/Teams), and answers two quick questions (role and peak creative/meeting hours).
- **Home & Quick Tasks:** At launch, Home shows today's (or upcoming) meetings + schedule, a summary of pending tasks, and an input bar for conversational commands. Unread AI suggestions light up the Chat tab.
- **Chat & Commands:** The Chat screen is the universal command center—free-form or quick-action bubbles drive everything (e.g. "Plan my next project" or "Suggest a focus block"). Files and follow-up AI tips appear inline.
- **Calendar:** Day/Week/Month toggle view of confirmed events (solid blocks) and AI-suggested prep/work blocks (dashed). Tapping suggestions expands inline "Accept/Edit" controls.
- **Projects & Tasks:** Projects list shows progress bars and phase badges. Tapping a project opens its Tasks screen, where AI-generated tasks await confirmation, can be reordered (by drag-handle), and move between "Pending," "In-Progress," and "Completed" (with animated feedback).
- **Proactive Engine:** In the background, your server logs every screen open, task completion, and client-email reply—running a cron job to detect patterns (e.g. repeated project checks, mid-focus opens) and inject new AI suggestions into the Chat tab (via a badge and inline messages).

--- 