-- Create notifications table (referenced in dataService.js, useSupabase.js, Notifications.jsx)
-- This table stores in-app notifications for users

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    read BOOLEAN NOT NULL DEFAULT false,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR
SELECT USING (auth.uid () = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications FOR
UPDATE USING (auth.uid () = user_id)
WITH
    CHECK (auth.uid () = user_id);

-- Service role / system can insert notifications for any user
CREATE POLICY "Service can insert notifications" ON notifications FOR
INSERT
WITH
    CHECK (true);

-- Admins can view all notifications for monitoring
CREATE POLICY "Admins can view all notifications" ON notifications FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = auth.uid ()
                AND users.is_admin = true
        )
    );

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid () = user_id);

-- Enable realtime for notifications table (used by subscribeToNotifications)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;