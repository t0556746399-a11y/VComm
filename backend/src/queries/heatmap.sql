-- ─────────────────────────────────────────────
-- queries/heatmap.sql — PostGIS heatmap grid
-- Reference: README §4.3
--
-- Parameters:
--   $1 = company_id        (TEXT)
--   $2 = start_date        (TIMESTAMPTZ)
--   $3 = end_date          (TIMESTAMPTZ)
--   $4 = event_types       (TEXT[], nullable — null means "all types")
--   $5 = west              (FLOAT)   bbox
--   $6 = south             (FLOAT)
--   $7 = east              (FLOAT)
--   $8 = north             (FLOAT)
--   $9 = cell_lng          (FLOAT)   grid cell width  — derived from zoom level
--   $10 = cell_lat         (FLOAT)   grid cell height — derived from zoom level
--
-- Returns: rows of (lat FLOAT, lng FLOAT, weight INTEGER).
--
-- Implementation hints:
--   - ST_MakeEnvelope($5,$6,$7,$8,4326)::geography → bbox
--   - ST_Intersects(geom, bbox)                    → spatial filter
--   - GROUP BY ST_SnapToGrid(geom::geometry, $9, $10)
-- ─────────────────────────────────────────────

-- TODO: WITH bbox AS ( ... ), filtered AS ( ... )
-- TODO: SELECT ST_Y(...) AS lat, ST_X(...) AS lng, COUNT(*) AS weight ...
-- name: get_heatmap
WITH bbox AS (
    SELECT ST_MakeEnvelope($5, $6, $7, $8, 4326)::geography AS geom
),
filtered AS (
    SELECT geom FROM safety_events 
    WHERE company_id = $1 
    AND created_at BETWEEN $2 AND $3
    AND ($4 IS NULL OR event_type = ANY($4))
    AND ST_Intersects(geom::geography, (SELECT geom FROM bbox))
)
SELECT ST_Y(ST_SnapToGrid(geom::geometry, $9, $10)) AS lat, 
       ST_X(ST_SnapToGrid(geom::geometry, $9, $10)) AS lng, 
       COUNT(*) AS weight 
FROM filtered 
GROUP BY lat, lng;