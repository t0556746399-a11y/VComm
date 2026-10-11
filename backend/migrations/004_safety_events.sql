-- 004_safety_events.sql — extend schema for merged codebase (idempotent)

ALTER TABLE drives ADD COLUMN IF NOT EXISTS total_distance_m NUMERIC;
ALTER TABLE drives ADD COLUMN IF NOT EXISTS total_duration_s INTEGER;
ALTER TABLE drives ADD COLUMN IF NOT EXISTS avg_speed_kmh NUMERIC;
ALTER TABLE drives ADD COLUMN IF NOT EXISTS score NUMERIC;

ALTER TABLE safety_events ADD COLUMN IF NOT EXISTS vehicle_id TEXT;
ALTER TABLE safety_events ADD COLUMN IF NOT EXISTS speed_kmh NUMERIC;
ALTER TABLE safety_events ADD COLUMN IF NOT EXISTS speed_limit NUMERIC;
ALTER TABLE safety_events ADD COLUMN IF NOT EXISTS extra JSONB;
