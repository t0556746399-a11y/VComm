SELECT 
    d.drive_uuid,
    d.driver_id,
    d.vehicle_id,
    d.started_at,
    d.ended_at,
    d.total_distance_m,
    d.total_duration_s,
    d.score
FROM drives d
WHERE d.company_id = $1
ORDER BY d.started_at DESC
LIMIT $2 OFFSET $3;