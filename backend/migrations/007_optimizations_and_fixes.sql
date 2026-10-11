-- 1. יצירת הפונקציה קודם לכן בצורה מפורשת (עם הסכמה הציבורית)
CREATE OR REPLACE FUNCTION public.text_to_uuid(text) 
RETURNS uuid AS $$
    SELECT CAST($1 AS uuid);
$$ LANGUAGE sql IMMUTABLE STRICT;

-- 2. יצירת ה-CAST תוך הפניה מדויקת לפונקציה שיצרנו
CREATE CAST (text AS uuid) 
WITH FUNCTION public.text_to_uuid(text) 
AS IMPLICIT;