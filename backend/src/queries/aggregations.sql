-- ─────────────────────────────────────────────
-- queries/aggregations.sql — single CTE for dashboard KPIs
-- ─────────────────────────────────────────────

WITH filtered AS (
  SELECT se.event_type
  FROM safety_events se
  JOIN drives d ON d.drive_uuid::text = se.drive_uuid::text
  WHERE se.company_id::text = $1::text
    AND se.event_ts BETWEEN $2::timestamptz AND ($3::text || ' 23:59:59')::timestamptz
    AND ($4::text IS NULL OR se.driver_id::text = $4::text)
    AND ($5::text[] IS NULL OR d.vehicle_id::text = ANY($5::text[]))
),
drive_stats AS (
  SELECT
    COUNT(DISTINCT drive_uuid::text) AS total_drives,
    COUNT(DISTINCT driver_id::text) AS active_drivers,
    COALESCE(SUM(total_distance_m), 0) / 1000.0 AS total_distance_km,
    COALESCE(SUM(total_duration_s), 0) AS total_duration_s,
    COALESCE(AVG(avg_speed_kmh), 0) AS avg_speed_kmh,
    COALESCE(AVG(score), 0) AS avg_score,
    COALESCE(MIN(score), 0) AS min_score,
    COALESCE(MAX(score), 0) AS max_score,
    COALESCE(STDDEV(score), 0) AS std_score
  FROM drives
  WHERE company_id::text = $1::text
    AND started_at BETWEEN $2::timestamptz AND ($3::text || ' 23:59:59')::timestamptz
    AND ($4::text IS NULL OR driver_id::text = $4::text)
    AND ($5::text[] IS NULL OR vehicle_id::text = ANY($5::text[]))
),
violations AS (
  SELECT event_type, COUNT(*)::INT AS cnt
  FROM filtered
  GROUP BY event_type
),
most_dangerous AS (
  SELECT driver_id
  FROM drives
  WHERE company_id::text = $1::text
    AND started_at BETWEEN $2::timestamptz AND ($3::text || ' 23:59:59')::timestamptz
    AND score IS NOT NULL
    AND ($4::text IS NULL OR driver_id::text = $4::text)
    AND ($5::text[] IS NULL OR vehicle_id::text = ANY($5::text[]))
  GROUP BY driver_id
  ORDER BY AVG(score) ASC
  LIMIT 1
)
SELECT
  ds.*,
  COALESCE((SELECT driver_id::text FROM most_dangerous), 'N/A') AS most_dangerous_driver,
  COALESCE(
    (SELECT jsonb_object_agg(event_type, cnt) FROM violations),
    '{}'::jsonb
  ) AS violations_by_type
FROM drive_stats ds;