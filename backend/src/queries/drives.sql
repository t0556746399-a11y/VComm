
-- SELECT d.drive_uuid, d.driver_id,
--        ST_AsGeoJSON(COALESCE(dr.route_geom, d.route_geom))::json AS route
-- FROM drives d
-- LEFT JOIN drive_routes dr ON d.drive_uuid = dr.drive_uuid
-- WHERE d.company_id = $1 AND d.drive_uuid = $2;


-- name: list_drives
SELECT
    drive_uuid,
    driver_id,
    vehicle_id,
    started_at,
    ended_at,
    COUNT(*) OVER() AS total
FROM drives
WHERE company_id = $1
  AND ($2::text IS NULL OR driver_id = $2)
  AND ($3::timestamptz IS NULL OR started_at >= $3)
  AND ($4::timestamptz IS NULL OR started_at <= $4)
ORDER BY started_at DESC
LIMIT $5 OFFSET $6;

-- name: get_drive
SELECT
    d.drive_uuid,
    d.driver_id,
    d.vehicle_id,
    d.started_at,
    d.ended_at,
    d.total_distance_m,
    d.total_duration_s,
    d.score,
    ST_AsGeoJSON(
        COALESCE(dr.route_geom, d.route_geom)
    )::json AS route
FROM drives d
LEFT JOIN drive_routes dr
    ON d.drive_uuid = dr.drive_uuid
WHERE d.company_id = $1
  AND d.drive_uuid = $2;







