# DoGoods AI Agent — Full Build Scope

**Platform**: DoGoods / All Good Living Foundation
**Date**: March 27, 2026
**Budget**: $1,200 over 4 Weeks | $300/Week

---

## Current Platform Inventory

What DoGoods already has:

| Layer                   | Technology                                                                    | Status                        |
| ----------------------- | ----------------------------------------------------------------------------- | ----------------------------- |
| Frontend                | React 18.2 + Vite 5.4 + Tailwind CSS 3.4                                      | ✅ Production                 |
| Backend                 | Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)            | ✅ Production                 |
| AI Engine               | DeepSeek API (`deepseek-chat` model) with circuit breaker + rate limiter      | ✅ Integrated                 |
| AI Chat UI              | `AIAssistant.jsx` component ("Nourish" assistant with streaming)              | ✅ Built (disabled in layout) |
| AI Hooks                | `useAI()` → `chatWithNourish()`, `getRecipeSuggestions()`, `getStorageTips()` | ✅ Built                      |
| AI Matching             | `MatchingEngine.js` with distance-based food matching                         | ✅ Built                      |
| Maps                    | Mapbox GL 2.15 with geocoding, markers, geolocation                           | ✅ Production                 |
| SMS                     | Twilio via Supabase Edge Function (`send-sms`) with opt-in checks             | ✅ Production                 |
| User Chat               | `UserChatWidget.jsx` — user-to-admin messaging with real-time                 | ✅ Production                 |
| Auth                    | Supabase Auth + `AuthContext` + `authService` singleton                       | ✅ Production                 |
| Data Layer              | `dataService.js` (2,269 lines) — all CRUD, subscriptions, real-time           | ✅ Production                 |
| Location                | `locationService.js` + `useGeoLocation()` hook                                | ✅ Production                 |
| Voice/Speech            | Nothing                                                                       | ❌ Not built                  |
| AI Context Awareness    | AI has no access to user data, listings, or platform state                    | ❌ Not built                  |
| AI Reminders            | No AI-triggered reminder system                                               | ❌ Not built                  |
| AI Conversations DB     | No persistent AI chat storage                                                 | ❌ Not built                  |
| Proactive Notifications | No AI-initiated outreach                                                      | ❌ Not built                  |

**Key Difference from FoodMaps Plan**: DoGoods has NO Python/FastAPI backend. Everything runs through Supabase (PostgreSQL + Edge Functions) and client-side JavaScript. The AI agent must be built within this architecture — Supabase Edge Functions (Deno/TypeScript) for server-side logic, React components for UI.

---

## What We're Building

An AI assistant ("Nourish") that lives inside the DoGoods platform, understands each user's context, reads their data, and helps them take action — through text and voice.

### Architecture Decision

| FoodMaps Plan              | DoGoods Adaptation                                              | Reason                                                          |
| -------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Python FastAPI backend     | Supabase Edge Functions (TypeScript/Deno)                       | No Python server exists; Supabase is the backend                |
| MySQL on AWS RDS           | Supabase PostgreSQL                                             | Already the database                                            |
| New EC2 server routes      | Supabase Edge Functions + client-side                           | Keep existing infra                                             |
| OpenAI GPT-4o              | DeepSeek API (already integrated) + OpenAI as upgrade option    | DeepSeek already configured with rate limiter + circuit breaker |
| Sesame AI for voice        | Web Speech API (browser-native TTS/STT) + ElevenLabs as upgrade | Simpler, no extra cost to start                                 |
| LangChain function calling | DeepSeek function calling (JSON mode)                           | Matches existing AI stack                                       |

---

## AI Agent Capabilities

### For Recipients (Finding Food)

- "What food is near me?" → Agent checks location via `locationService`, queries `food_listings`, responds with nearby items including pickup times and claim links
- Auto-filters by dietary restrictions from user profile
- Suggests recipes from available/claimed items
- "When is my pickup?" → Reads `receipts` + `food_claims` for user's upcoming pickups

### For Donors / Food Sharers

- "I have leftover bread" → Agent drafts a food listing, sets category, suggests pickup window
- "How is my listing doing?" → Reads claim count, views, status from `food_listings`

### For All Users

- Reminders: "Remind me about my pickup tomorrow" → Stores reminder, triggers via SMS or in-app notification
- Location search: GPS-based nearby food discovery with urgency ranking
- Platform help: Navigates users to the right page, explains how things work
- Spanish support: Detects language and responds in Spanish
- Recipe generation: Creates recipes from available/claimed food items
- Storage tips: Food preservation advice based on items

### For Admins

- "How many claims this week?" → Reads `food_claims` aggregate data
- "Show me pending verifications" → Queries `verification_logs`
- Summary metrics on demand

---

## Database Changes

### New Tables

```sql
-- AI conversation history (persistent per user)
CREATE TABLE ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',  -- tool calls, function results, context used
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, created_at DESC);

-- AI-set reminders
CREATE TABLE ai_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    trigger_time TIMESTAMPTZ NOT NULL,
    reminder_type TEXT DEFAULT 'general' CHECK (reminder_type IN ('pickup', 'listing_expiry', 'distribution_event', 'general')),
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    related_id UUID,  -- optional FK to food_claims, food_listings, distribution_events
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_reminders_pending ON ai_reminders(trigger_time) WHERE sent = false;
CREATE INDEX idx_ai_reminders_user ON ai_reminders(user_id);

-- AI feedback (thumbs up/down on responses)
CREATE TABLE ai_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rating TEXT CHECK (rating IN ('helpful', 'not_helpful')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies

- Users can only read/write their own `ai_conversations` and `ai_reminders`
- Admin can read all for monitoring
- `ai_feedback` writable by the conversation owner

---

## New Files

| File                                                | Purpose                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260327_create_ai_tables.sql` | Database migration for ai_conversations, ai_reminders, ai_feedback                                       |
| `supabase/functions/ai-chat/index.ts`               | Edge Function: receives message + user context → calls DeepSeek with function calling → returns response |
| `supabase/functions/ai-reminders/index.ts`          | Edge Function (cron): checks pending reminders, sends SMS/notifications                                  |
| `utils/services/aiChatService.js`                   | Client-side service: manages AI conversations, sends messages, loads history                             |
| `utils/hooks/useAIChat.js`                          | React hook: exposes `sendMessage()`, `messages`, `isLoading`, `startVoice()`, `stopVoice()`              |
| `components/assistant/AIChatPanel.jsx`              | New chat panel UI: floating bubble, conversation thread, voice input/output, typing indicator            |
| `components/assistant/VoiceInput.jsx`               | Web Speech API microphone component                                                                      |
| `components/assistant/VoiceOutput.jsx`              | Browser TTS speech synthesis component                                                                   |
| `backend/ai_training_data.json`                     | DoGoods knowledge base: platform rules, food safety, user roles, tone guidelines, Spanish                |

### Modified Files

| File                               | Changes                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/layout/MainLayout.jsx` | Add `<AIChatPanel />` to all pages (replace commented-out AIAssistant)                                                                     |
| `utils/config.js`                  | Add `OPENAI_API_KEY` config option (optional upgrade from DeepSeek)                                                                        |
| `utils/dataService.js`             | Add methods: `getAIConversations()`, `saveAIMessage()`, `getAIReminders()`, `createAIReminder()`, `markReminderSent()`, `saveAIFeedback()` |
| `app.jsx`                          | No route changes needed — chat panel lives in MainLayout                                                                                   |

---

## Week-by-Week Plan

### Week 1 — $300: Core Engine + Chat UI

**Goal**: Working AI chat bubble on every page. Text input → intelligent context-aware response. Voice input/output functional. Conversation history saved to database.

**Days 1–3: Backend + Database**

- Create `20260327_create_ai_tables.sql` migration
- Run migration against Supabase (local + production)
- Create `supabase/functions/ai-chat/index.ts` Edge Function:
  - Receives: `{ message, user_id, conversation_history[] }`
  - Loads user profile from `users` table (name, dietary restrictions, location, role)
  - Injects `ai_training_data.json` as system prompt
  - Calls DeepSeek API with function-calling format
  - Tool definitions (shells): `search_food_nearby`, `get_user_profile`, `get_pickup_status`, `create_reminder`
  - Saves conversation to `ai_conversations` table
  - Returns: `{ response, tool_results?, audio_text? }`
- Create/update `backend/ai_training_data.json` with DoGoods-specific knowledge:
  - Platform overview, community food sharing model
  - User roles (recipients, donors, admins)
  - Food safety rules, pickup processes
  - Tone: warm, helpful, community-focused
  - Spanish response guidelines

**Days 4–7: Client-Side + UI**

- Create `utils/services/aiChatService.js`:
  - `sendMessage(message)` → calls Edge Function, saves to DB
  - `getHistory(userId, limit)` → loads from `ai_conversations`
  - `clearHistory(userId)` → deletes conversations
- Create `utils/hooks/useAIChat.js`:
  - Returns: `{ messages, sendMessage, isLoading, isStreaming, clearHistory }`
  - Manages local state + DB persistence
  - Auto-loads recent history on mount
- Create `components/assistant/AIChatPanel.jsx`:
  - Floating chat bubble (bottom-right, above existing UserChatWidget)
  - Expandable panel with message thread
  - Text input with send button
  - Typing indicator during AI response
  - Message bubbles (user vs assistant styling)
  - Close/minimize toggle
  - Mobile responsive
- Create `components/assistant/VoiceInput.jsx`:
  - Web Speech API (`SpeechRecognition`) for mic input
  - Push-to-talk button in chat panel
  - Language detection (English/Spanish)
  - Transcript → sends as text message
- Create `components/assistant/VoiceOutput.jsx`:
  - Browser `SpeechSynthesis` API for TTS
  - Auto-reads assistant responses (mutable)
  - Spanish voice selection when Spanish detected
- Wire into `MainLayout.jsx` — AIChatPanel visible on all pages
- 5 unit tests: message send/receive, history load, voice transcript, Spanish detection, error handling

**Week 1 Deliverables**:

- ✅ Database tables created (ai_conversations, ai_reminders, ai_feedback)
- ✅ Edge Function responding to chat messages with DeepSeek
- ✅ Training data injected per conversation
- ✅ Chat bubble visible on all pages with conversation thread
- ✅ Voice input (mic) and output (TTS) functional
- ✅ Conversation history persisted to database
- ✅ 5 passing tests

---

### Week 2 — $300: Platform Data Integration + Spanish

**Goal**: AI reads live platform data to give expert answers. Spanish fully supported. Anonymous mode for non-logged-in users.

**Days 1–2: Food & Location Tools**

- Implement `search_food_nearby` tool in Edge Function:
  - Receives user's lat/lon (from `locationService`)
  - Queries `food_listings` with status IN ('approved', 'active')
  - Calculates distance (haversine), filters by radius
  - Formats natural language response with item names, distances, pickup times
  - Respects user's dietary restrictions from profile
- Implement `get_mapbox_directions` tool:
  - Proxies Mapbox Directions API for route summaries
  - Returns walking/driving time + distance to food
- Implement `query_distribution_events` tool:
  - Queries `distribution_events` for upcoming events
  - Returns schedules, locations, capacity

**Days 3–5: User Data + Reminders**

- Implement `get_user_dashboard` tool:
  - Reads user profile, claimed foods, active receipts, favorites
  - Personalizes responses based on user history
- Implement `get_pickup_status` tool:
  - Reads `receipts` + `food_claims` for the user
  - Returns upcoming pickups, deadlines, status
- Implement `create_reminder` tool:
  - Writes to `ai_reminders` table
  - Creates `supabase/functions/ai-reminders/index.ts` Edge Function:
    - Cron job (every 15 minutes)
    - Queries `ai_reminders WHERE trigger_time <= now() AND sent = false`
    - Sends SMS via existing `send-sms` Edge Function
    - Marks reminder as sent

**Days 6–7: Spanish + Fallbacks**

- DeepSeek system prompt includes Spanish detection + response rules
- Voice output selects Spanish `SpeechSynthesis` voice when detected
- Voice input recognizes Spanish via `SpeechRecognition.lang = 'es-ES'`
- Fallback chain:
  - If DeepSeek fails → circuit breaker activates → friendly "I'm having trouble, try again" message
  - If voice fails → text-only mode (hide mic button)
  - If location unavailable → ask for zip code/address fallback
  - If user not logged in → anonymous mode (limited to general info, no personal data)

**Week 2 Deliverables**:

- ✅ `search_food_nearby` returns real food listings with distances
- ✅ `get_mapbox_directions` provides route info
- ✅ `query_distribution_events` shows upcoming distributions
- ✅ `get_user_dashboard` personalizes AI responses
- ✅ `get_pickup_status` shows user's claim/receipt status
- ✅ `create_reminder` writes to DB, cron job sends SMS
- ✅ Spanish end-to-end (detection → response → voice)
- ✅ Graceful fallbacks for all failure modes
- ✅ Anonymous mode for unauthenticated users

---

### Week 3 — $300: Launch + Advanced Features

**Goal**: AI live for all users. Proactive notifications, recipe generation, role-specific behaviors, voice-location search.

**Days 1–2: Launch + Proactive Messaging**

- Full QA across user types (recipient, donor, admin), browsers, mobile
- Proactive notification system:
  - Cron Edge Function checks for new nearby listings
  - Drafts personalized messages based on user preferences and dietary restrictions
  - Sends via existing notification system (in-app) + SMS for opted-in users
  - Admin approval toggle for broadcast messages

**Days 3–4: Role-Specific Intelligence**

- **Recipients**: "You have food ready for pickup" nudges, claim suggestions based on dietary profile, "New produce 0.5 miles away" alerts
- **Donors/Sharers**: "Your listing has 3 claims" updates, expiration warnings, "Consider sharing again — your last listing helped 5 people"
- **Admins**: Dashboard summaries on demand, "12 pending verifications", "Claims up 20% this week"
- Profile gap detection: AI prompts users to fill missing info (dietary needs, location, phone for SMS)

**Days 5–6: Recipes, Voice-Location, Smart Suggestions**

- **Recipe generation**: AI creates recipes from user's claimed/available items, household-aware, low-resource friendly, culturally appropriate
- **Voice-location search**: "What food is near me?" via mic → GPS lookup → ranked results by urgency + distance
- **Smart suggestions**: Based on browsing pattern and claim history — "People who claimed X also found Y useful"
- **Natural language queries**: "Show me all vegan food within 2 miles" → parsed into structured food listing query

**Day 7: End-to-End Testing**

- Test all user roles with real data
- Test English + Spanish flows
- Test voice input/output on Chrome, Safari, Firefox, mobile
- Test reminder delivery (SMS + in-app)
- Test anonymous vs authenticated behavior
- Test edge cases: empty results, expired food, no location, slow network

**Week 3 Deliverables**:

- ✅ AI live in production on all pages
- ✅ Proactive notifications with admin approval
- ✅ Role-specific personalized behaviors
- ✅ Profile gap detection + prompts
- ✅ Recipe generation from available items
- ✅ Voice-location food search
- ✅ Natural language query system
- ✅ Full journey tests passing

---

### Week 4 — $300: Bug Fixes, Polish, Operational Readiness

**Goal**: Reliable, production-grade AI. Address edge cases, refine based on usage, finalize monitoring.

**Bug Fixes & Edge Cases**

- Context drift: Sliding window (last 20 messages) + re-inject system prompt + user profile each turn
- Reminder race conditions: `sent` flag with row-level locking in PostgreSQL
- iOS audio: "Tap to hear" button (Safari restrictions on auto-play)
- Spanish pronunciation: Normalize text before TTS synthesis
- Tool failures: Validate all tool results, handle empty/error with friendly messages
- Anonymous limits: Require login for personal data, reminders, claims

**Polish & Refinements**

- Thumbs up/down feedback on each AI response → saves to `ai_feedback` table
- Smooth open/close animations on chat panel
- Fast loading: lazy-load chat panel component
- Accessibility: keyboard navigation, screen reader labels, high contrast support
- Mobile: full-screen chat mode on small screens

**Admin Monitoring**

- Admin panel section: AI usage logs (anonymized conversation stats)
- Metrics: total conversations, avg messages per session, tool usage breakdown, feedback scores
- Admin can view flagged conversations (low-rated responses)
- Error rate tracking dashboard

**Training Data Refinement**

- Update `ai_training_data.json` based on:
  - Common user questions that got poor responses
  - New platform features added
  - Feedback patterns from `ai_feedback` table
  - No model retraining needed — just system prompt updates

**Final Operational Checklist**

- [ ] Error rate < 5% on AI responses
- [ ] Voice works: Chrome, Safari, Firefox (desktop + mobile)
- [ ] Spanish mobile end-to-end (voice in → Spanish response → Spanish TTS)
- [ ] Reminders fire within 15 min of trigger time
- [ ] SMS respects opt-out preferences
- [ ] Admin logs viewable at `/admin/ai-logs`
- [ ] Feedback logging active
- [ ] No duplicate conversation entries
- [ ] Chat panel loads < 500ms on mobile
- [ ] Graceful behavior when not authenticated
- [ ] Rate limiter prevents abuse (50 req/min per user)

---

## Complete File Inventory

### New Files (10)

| File                                                | Purpose                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `supabase/migrations/20260327_create_ai_tables.sql` | ai_conversations, ai_reminders, ai_feedback tables + RLS           |
| `supabase/functions/ai-chat/index.ts`               | Edge Function: AI chat endpoint with DeepSeek + function calling   |
| `supabase/functions/ai-reminders/index.ts`          | Edge Function: cron job to send pending reminders via SMS          |
| `utils/services/aiChatService.js`                   | Client service: conversation management, message send/receive      |
| `utils/hooks/useAIChat.js`                          | React hook: chat state, voice control, history management          |
| `components/assistant/AIChatPanel.jsx`              | Chat bubble + panel UI with message thread                         |
| `components/assistant/VoiceInput.jsx`               | Web Speech API microphone input component                          |
| `components/assistant/VoiceOutput.jsx`              | Browser SpeechSynthesis TTS output component                       |
| `backend/ai_training_data.json`                     | DoGoods knowledge base (platform info, tone, food safety, Spanish) |
| `pages/admin/AILogs.jsx`                            | Admin page: AI usage metrics + conversation monitoring             |

### Modified Files (5)

| File                               | Changes                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `components/layout/MainLayout.jsx` | Add `<AIChatPanel />` component to layout                    |
| `utils/config.js`                  | Add optional `OPENAI_API_KEY` for future GPT-4o upgrade path |
| `utils/dataService.js`             | Add AI-related CRUD methods (6 new methods)                  |
| `app.jsx`                          | Add `/admin/ai-logs` route to admin section                  |
| `index.html`                       | No changes needed (chat lives in React component tree)       |

---

## Cost Summary

| Item                                | Cost       |
| ----------------------------------- | ---------- |
| Week 1 — Core Engine + Chat UI      | $300       |
| Week 2 — Data Integration + Spanish | $300       |
| Week 3 — Launch + Advanced Features | $300       |
| Week 4 — Bug Fixes + Polish         | $300       |
| **Total Build**                     | **$1,200** |

### Ongoing API Costs

| Service                          | Purpose                          | Estimated Monthly Cost                   |
| -------------------------------- | -------------------------------- | ---------------------------------------- |
| DeepSeek API                     | AI reasoning + responses         | $10–$30 (much cheaper than GPT-4o)       |
| OpenAI GPT-4o (optional upgrade) | Premium reasoning if needed      | $20–$40/month                            |
| Mapbox                           | Maps + geocoding + directions    | Free tier (50K req/month)                |
| Twilio                           | SMS reminders triggered by AI    | ~$0.0079/message (already set up)        |
| Supabase                         | Database + Edge Functions + Auth | Current plan (no increase for AI tables) |
| ElevenLabs (optional upgrade)    | Premium voice TTS                | $5–$22/month                             |
| **Total Ongoing**                |                                  | **$10–$70/month** (DeepSeek base)        |

---

## What's NOT Included (Future Phases)

| Feature                                      | Why Deferred                                  |
| -------------------------------------------- | --------------------------------------------- |
| Predictive analytics                         | Needs 3–6 months of conversation + claim data |
| Custom fine-tuned model                      | Requires labeled training data + higher cost  |
| Full autonomy (auto-claim, auto-post)        | Requires careful trust/safety review          |
| Additional languages (Vietnamese, Cantonese) | DeepSeek supports them; needs UX testing      |
| Mobile app (React Native)                    | Platform-specific voice handling              |
| Custom voice model (ElevenLabs clone)        | Premium cost, post-launch optimization        |
| AI-powered admin analytics dashboard         | Phase 2 after data collection                 |

---

## Key Technical Decisions

1. **Supabase Edge Functions over Python FastAPI** — DoGoods has no Python server. Adding one would double infrastructure complexity. Edge Functions run on Deno (TypeScript), deploy alongside the database, and scale automatically.

2. **DeepSeek over GPT-4o (initial)** — Already integrated with rate limiter and circuit breaker. 10x cheaper than GPT-4o. Upgrade path to OpenAI is a config change (same API format). Can switch per-request based on complexity.

3. **Web Speech API over Sesame AI** — Browser-native speech recognition and synthesis has zero cost, works offline for TTS, and requires no additional API keys. ElevenLabs can be added later for premium voice quality.

4. **Client-side voice, server-side reasoning** — Voice capture and playback happen in the browser (VoiceInput/VoiceOutput components). Text is sent to the Edge Function for AI processing. This keeps latency low and costs down.

5. **Function calling over RAG** — DeepSeek's function-calling mode lets the AI invoke specific platform actions (search food, check schedule, create reminder) with structured JSON. More reliable than retrieval-augmented generation for action-oriented tasks.

6. **Conversation stored in Supabase** — Not just for history display, but for context injection. Each turn re-loads the last N messages + user profile + system prompt. This prevents context drift without a persistent server process.

---

_Plan Written: March 27, 2026_
_Platform: DoGoods / All Good Living Foundation_
_Stack: React 18 (JS) Frontend · Supabase (PostgreSQL + Edge Functions) Backend · DeepSeek AI (Reasoning) · Web Speech API (Voice) · Mapbox (Maps) · Twilio (SMS)_
