-- ─────────────────────────────────────────────
-- 001_initial.sql — initial schema (Teams A + B + C)
-- ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS companies (
    company_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer',
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drives (
    drive_uuid UUID PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    route_geom GEOMETRY(LineString, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety_events (
    event_id BIGSERIAL PRIMARY KEY,
    drive_uuid UUID REFERENCES drives(drive_uuid) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_ts TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(Point, 4326),
    severity TEXT DEFAULT 'low'
);

CREATE INDEX IF NOT EXISTS idx_drives_route ON drives USING GIST (route_geom);
CREATE INDEX IF NOT EXISTS idx_drives_driver_ts ON drives (company_id, driver_id, started_at);
CREATE INDEX IF NOT EXISTS idx_se_geom ON safety_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_se_lookup ON safety_events (company_id, event_type, driver_id, event_ts);
CREATE INDEX IF NOT EXISTS idx_se_drive ON safety_events (drive_uuid);
CREATE INDEX IF NOT EXISTS idx_se_ts ON safety_events (event_ts);

INSERT INTO companies (company_id, name)
VALUES 
    ('comp-1', 'Diversitech HQ'),
    ('comp-2', 'Fleet Logistics'),
    ('comp-3', 'Safe Drive Co')
ON CONFLICT (company_id) DO NOTHING;




