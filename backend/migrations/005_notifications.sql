-- יצירת טבלת התראות - ניהול מרכז התראות
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, 
    severity TEXT DEFAULT 'info', -- אפשרויות: info, warning, critical
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    metadata JSONB -- כאן נשמור מידע נוסף בפורמט גמיש
);

-- אינדקסים לשיפור ביצועי השליפה (חשוב מאוד עבור ה-UI)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);