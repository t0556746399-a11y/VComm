SELECT
    event_id,
    event_type,
    driver_id,
    vehicle_id,
    drive_uuid,
    ST_Y(geom::geometry) AS lat,
    ST_X(geom::geometry) AS lng,
    event_ts,
    speed_kmh,
    speed_limit,
    severity,
    extra
FROM safety_events
ORDER BY event_ts DESC
LIMIT 1000;
