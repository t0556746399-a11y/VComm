SELECT
    id,
    event_type,
    8 AS severity,
    ST_Y(geom::geometry) AS lat,
    ST_X(geom::geometry) AS lng
FROM safety_events
WHERE company_id = $1
AND ST_Contains(ST_GeomFromText($2, 4326), ST_SetSRID(geom::geometry, 4326))
AND ($3::text IS NULL OR event_type = ANY($3::text[]));
