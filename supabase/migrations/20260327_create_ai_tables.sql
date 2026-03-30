-- =============================================================================
-- DoGoods AI Agent — Database Tables
-- Migration: 20260327_create_ai_tables.sql
-- Creates: ai_conversations, ai_reminders, ai_feedback
-- =============================================================================

-- =============================================
-- 1. AI CONVERSATIONS — Chat history per user
-- =============================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (
        role IN ('user', 'assistant', 'system')
    ),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations (user_id, created_at DESC);

-- =============================================
-- 2. AI REMINDERS — AI-triggered reminders
-- =============================================

CREATE TABLE IF NOT EXISTS ai_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    trigger_time TIMESTAMP
    WITH
        TIME ZONE NOT NULL,
        reminder_type TEXT DEFAULT 'general' CHECK (
            reminder_type IN (
                'pickup',
                'listing_expiry',
                'distribution_event',
                'general'
            )
        ),
        sent BOOLEAN DEFAULT false,
        sent_at TIMESTAMP
    WITH
        TIME ZONE,
        related_id UUID,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_reminders_pending ON ai_reminders (trigger_time)
WHERE
    sent = false;

CREATE INDEX idx_ai_reminders_user ON ai_reminders (user_id);

-- =============================================
-- 3. AI FEEDBACK — Thumbs up/down on responses
-- =============================================

CREATE TABLE IF NOT EXISTS ai_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    conversation_id UUID REFERENCES ai_conversations (id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    rating TEXT CHECK (
        rating IN ('helpful', 'not_helpful')
    ),
    comment TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_feedback_conversation ON ai_feedback (conversation_id);

CREATE INDEX idx_ai_feedback_user ON ai_feedback (user_id);

-- =============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_reminders ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. RLS POLICIES — ai_conversations
-- =============================================

-- Users can read their own conversations
CREATE POLICY "Users can view own AI conversations" ON ai_conversations FOR
SELECT TO authenticated USING (
        (
            select auth.uid ()
        ) = user_id
    );

-- Users can insert their own messages
CREATE POLICY "Users can insert own AI messages" ON ai_conversations FOR
INSERT
    TO authenticated
WITH
    CHECK (
        (
            select auth.uid ()
        ) = user_id
    );

-- Users can delete their own conversation history
CREATE POLICY "Users can delete own AI conversations" ON ai_conversations FOR DELETE TO authenticated USING (
    (
        select auth.uid ()
    ) = user_id
);

-- Admins can read all conversations (for monitoring)
CREATE POLICY "Admins can view all AI conversations" ON ai_conversations FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = (
                    select auth.uid ()
                )
                AND users.is_admin = true
        )
    );

-- =============================================
-- 6. RLS POLICIES — ai_reminders
-- =============================================

-- Users can read their own reminders
CREATE POLICY "Users can view own AI reminders" ON ai_reminders FOR
SELECT TO authenticated USING (
        (
            select auth.uid ()
        ) = user_id
    );

-- Users can create their own reminders
CREATE POLICY "Users can insert own AI reminders" ON ai_reminders FOR
INSERT
    TO authenticated
WITH
    CHECK (
        (
            select auth.uid ()
        ) = user_id
    );

-- Users can update their own reminders (e.g., cancel)
CREATE POLICY "Users can update own AI reminders" ON ai_reminders FOR
UPDATE TO authenticated USING (
    (
        select auth.uid ()
    ) = user_id
);

-- Users can delete their own reminders
CREATE POLICY "Users can delete own AI reminders" ON ai_reminders FOR DELETE TO authenticated USING (
    (
        select auth.uid ()
    ) = user_id
);

-- Admins can read all reminders
CREATE POLICY "Admins can view all AI reminders" ON ai_reminders FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = (
                    select auth.uid ()
                )
                AND users.is_admin = true
        )
    );

-- Service role can update reminders (for cron job marking sent)
CREATE POLICY "Service can update AI reminders" ON ai_reminders FOR
UPDATE TO service_role USING (true);

-- =============================================
-- 7. RLS POLICIES — ai_feedback
-- =============================================

-- Users can read their own feedback
CREATE POLICY "Users can view own AI feedback" ON ai_feedback FOR
SELECT TO authenticated USING (
        (
            select auth.uid ()
        ) = user_id
    );

-- Users can submit feedback on their conversations
CREATE POLICY "Users can insert own AI feedback" ON ai_feedback FOR
INSERT
    TO authenticated
WITH
    CHECK (
        (
            select auth.uid ()
        ) = user_id
    );

-- Admins can read all feedback
CREATE POLICY "Admins can view all AI feedback" ON ai_feedback FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = (
                    select auth.uid ()
                )
                AND users.is_admin = true
        )
    );

-- =============================================
-- 8. ALLOW ANONYMOUS CONVERSATIONS (no user_id)
-- =============================================

-- Anonymous users can insert messages (user_id = NULL)
CREATE POLICY "Anonymous can insert AI messages" ON ai_conversations FOR
INSERT
    TO anon
WITH
    CHECK (user_id IS NULL);

-- Anonymous users can read their session messages (handled client-side by session ID in metadata)
CREATE POLICY "Anonymous can read anonymous AI messages" ON ai_conversations FOR
SELECT TO anon USING (user_id IS NULL);