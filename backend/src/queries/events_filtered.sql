SELECT
  event_id, event_type, driver_id, vehicle_id, drive_uuid,
  ST_Y(geom::geometry) AS latitude,
  ST_X(geom::geometry) AS longitude,
  event_ts,
  speed_kmh, speed_limit, severity, extra,
  COUNT(*) OVER() AS total
FROM safety_events
WHERE company_id = $1
  AND event_ts BETWEEN $2 AND $3
  AND ($4::text[] IS NULL OR event_type = ANY($4))
  AND ($5::text IS NULL OR severity = $5)
  AND ($6::text IS NULL OR driver_id = $6)
  AND ($7::text IS NULL OR vehicle_id = $7)
ORDER BY event_ts DESC
LIMIT $8 OFFSET $9