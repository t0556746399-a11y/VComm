-- 003_materialized_views.sql — Materialized views and nightly refresh schedule

DROP MATERIALIZED VIEW IF EXISTS agg_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS agg_weekly CASCADE;

CREATE MATERIALIZED VIEW agg_daily AS
SELECT
    se.company_id,
    se.driver_id,
    DATE_TRUNC('day', se.event_ts) AS day,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE se.event_type = 'brake') AS brake_events,
    COUNT(*) FILTER (WHERE se.event_type = 'acceleration') AS acceleration_events,
    COUNT(*) FILTER (WHERE se.event_type = 'speeding') AS speeding_events,
    COUNT(*) FILTER (WHERE se.severity = 'high') AS high_severity_events,
    COUNT(DISTINCT se.drive_uuid) AS total_drives
FROM safety_events se
GROUP BY se.company_id, se.driver_id, DATE_TRUNC('day', se.event_ts)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS agg_daily_uq ON agg_daily (company_id, driver_id, day);
CREATE INDEX IF NOT EXISTS idx_agg_daily_driver_day ON agg_daily (driver_id, day);

CREATE MATERIALIZED VIEW agg_weekly AS
SELECT
    se.company_id,
    se.driver_id,
    DATE_TRUNC('week', se.event_ts) AS week,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE se.event_type = 'brake') AS brake_events,
    COUNT(*) FILTER (WHERE se.event_type = 'acceleration') AS acceleration_events,
    COUNT(*) FILTER (WHERE se.event_type = 'speeding') AS speeding_events,
    COUNT(*) FILTER (WHERE se.severity = 'high') AS high_severity_events,
    COUNT(DISTINCT se.drive_uuid) AS total_drives
FROM safety_events se
GROUP BY se.company_id, se.driver_id, DATE_TRUNC('week', se.event_ts)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS agg_weekly_uq ON agg_weekly (company_id, driver_id, week);
CREATE INDEX IF NOT EXISTS idx_agg_weekly_driver_week ON agg_weekly (driver_id, week);

-- Refresh the materialized views once after creation
REFRESH MATERIALIZED VIEW CONCURRENTLY agg_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY agg_weekly;
