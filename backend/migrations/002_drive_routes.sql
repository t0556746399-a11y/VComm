-- 002_drive_routes.sql — Geometry migrations + cache table

-- 1. Fix geometry types for existing tables
ALTER TABLE safety_events
    ALTER COLUMN geom TYPE GEOMETRY(Point, 4326) USING geom::GEOMETRY(Point, 4326);

ALTER TABLE drives
    ALTER COLUMN route_geom TYPE GEOMETRY(LineString, 4326) USING route_geom::GEOMETRY(LineString, 4326);

-- 2. Create a drive_routes cache table for precomputed route geometry
CREATE TABLE IF NOT EXISTS drive_routes (
    drive_uuid UUID PRIMARY KEY REFERENCES drives(drive_uuid) ON DELETE CASCADE,
    route_geom GEOMETRY(LineString, 4326) NOT NULL,
    point_count INTEGER NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dr_geom ON drive_routes USING GIST (route_geom);
