-- name: get_user_notifications
-- שליפת התראות למשתמש ספציפי
SELECT id, title, message, type, severity, is_read, created_at 
FROM notifications 
WHERE user_id = $1 
ORDER BY created_at DESC;

-- name: mark_notification_as_read
-- סימון התראה כנקראה
UPDATE notifications 
SET is_read = TRUE, read_at = NOW() 
WHERE id = $1 AND user_id = $2;