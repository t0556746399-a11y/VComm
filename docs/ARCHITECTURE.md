# VComm — Fleet Safety Analytics Platform

> **Product Requirements Document & Architecture Guide**
> VComm-Refactored v2.0 — full redesign of the manager dashboard.
> Replaces a monolithic React app with browser-side AWS calls with a clean client/server architecture backed by PostgreSQL + PostGIS.

**Repository:** https://github.com/diversi-tech/vcomm

---

## Table of Contents

1. [Overview](#1-overview)
2. [Why This Rewrite](#2-why-this-rewrite)
3. [System Architecture](#3-system-architecture)
4. [Database — PostgreSQL + PostGIS](#4-database--postgresql--postgis)
5. [Backend — Node.js + Express](#5-backend--nodejs--express)
6. [Frontend — React + Leaflet](#6-frontend--react--leaflet)
7. [Authentication & Authorization — JWT](#7-authentication--authorization--jwt)
8. [API Reference](#8-api-reference)
9. [Directory Structure](#9-directory-structure)
10. [Local Development Setup](#10-local-development-setup)
11. [Testing Strategy](#11-testing-strategy)
12. [Environment Variables](#12-environment-variables)
13. [Migration from Legacy System](#13-migration-from-legacy-system)
14. [Admin Panel](#14-admin-panel)
15. [Success Metrics](#15-success-metrics)
16. [Work Plan — Junior Developer Program](#16-work-plan--junior-developer-program)

---

## 1. Overview

VComm is a fleet telematics and driver-safety analytics dashboard used by fleet operators to monitor:

- **Driving safety scores** per driver and per vehicle
- **Safety violations** — stop sign, pedestrian crossing, over-speed, harsh braking, dangerous approach, and 28 other event types
- **Heatmaps** of violation density on a live map
- **Trip replay** — route + events overlaid on an interactive Leaflet map
- **Aggregated KPIs** — distance, duration, speed stats, violation ratios, time-window distributions

**Target users:** Fleet managers, safety officers, company admins.

**Stack:**

| Layer | Technology |
|---|---|
| Frontend | React 18, React-Leaflet, TanStack Query, MUI v5, Tailwind CSS |
| Backend | Node.js 20 LTS, Express 4, JWT |
| Database | PostgreSQL 18 + PostGIS 3.4 |
| Auth | JWT (HS256) with role-based access control |
| Tests | Jest + Supertest (backend), React Testing Library (frontend) |

---

## 2. Why This Rewrite

The legacy codebase had critical structural and security problems that made it unmaintainable:

| Problem | Legacy State | New State |
|---|---|---|
| AWS credentials | Hardcoded in client-side JS | Server-only, via env vars |
| Data fetching | 33 sequential DynamoDB calls per page load | 1–2 REST API calls |
| Client computation | All aggregations ran in the browser | All aggregations run in Postgres |
| Largest component | `Aggregated.jsx` — 2,770 lines | `AggregatedPage.jsx` — < 200 lines |
| State management | 76 `count1..count76` useState variables | Typed response objects from API |
| Load time (typical) | 15–30 seconds | Target < 3 seconds |
| Geographic filtering | Impossible in browser | PostGIS spatial queries |
| Bundle size | > 1.5 MB gzipped (includes `aws-sdk`) | Target < 500 KB |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│                                                                 │
│  ┌──────────────┐   ┌────────────────┐   ┌──────────────────┐   │
│  │  React SPA   │   │ TanStack Query │   │  React-Leaflet   │   │
│  │  (pages /    │──▶│  (data cache & │   │  (Heatmap,       │   │
│  │  components) │   │   fetching)    │   │  PointMap, Route)│   │
│  └──────┬───────┘   └───────┬────────┘   └──────────────────┘   │
│         │                   │                                   │
│         └─────────────┬─────┘  Bearer JWT in Authorization header
└───────────────────────┼─────────────────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────▼─────────────────────────────────────────┐
│                       BACKEND (Node.js + Express)               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │  auth router │  │  aggregations│  │  drives / heatmap  │     │
│  │  /auth/\*    │  │  router      │  │  / lookups routers │     │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘     │
│         │                 │                   │                 │
│  ┌──────▼─────────────────▼───────────────────▼───────────┐     │
│  │              JWT Middleware (verify + RBAC)             │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │              pg / node-postgres (connection pool)       │    │
│  └──────────────────────────┬──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │ SQL + PostGIS
┌─────────────────────────────▼───────────────────────────────────┐
│                     PostgreSQL 18 + PostGIS 3.4                 │
│                                                                 │
│   safety_events   drives   drive_routes   users   companies     │
│                                                                 │
│   GIST indexes on geometry columns                              │
│   B-tree indexes on (event_type, driver_id, event_ts)          │
│   Materialized views: agg_daily, agg_weekly                     │
└─────────────────────────────────────────────────────────────────┘
```

### Request lifecycle — Aggregated Dashboard

```
1. User sets date range + driver filter in FiltersPanel
2. FiltersContext updates → useAggregations() hook fires
3. TanStack Query calls GET /api/aggregations?start=...&end=...&driver_id=...
4. Express auth middleware verifies JWT, extracts company_id claim
5. aggregations router runs a single CTE query in Postgres
6. Response JSON (~2 KB) returns to browser
7. React renders MetricsGrid + ViolationsSummary from the typed response
8. Separately, useHeatmap() fetches /api/heatmap → HeatmapLayer renders cells
```

---

## 4. Database — PostgreSQL + PostGIS

### 4.1 Core Tables

```sql
-- All safety events from all 33 legacy DynamoDB tables, unified
CREATE TABLE safety_events (
    id              BIGSERIAL PRIMARY KEY,
    event_type      TEXT NOT NULL,          -- 'stop_sign' | 'pedestrian' | 'over_speed' | ...
    company_id      TEXT NOT NULL,
    driver_id       TEXT NOT NULL,
    vehicle_id      TEXT NOT NULL,
    drive_uuid      UUID NOT NULL,
    event_ts        TIMESTAMPTZ NOT NULL,
    geom            GEOGRAPHY(POINT, 4326), -- replaces separate lat/lng columns
    speed_kmh       NUMERIC,
    speed_limit     NUMERIC,
    severity        SMALLINT DEFAULT 1,
    extra           JSONB                   -- event-type-specific fields
);

-- Indexes
CREATE INDEX idx_se_geom      ON safety_events USING GIST (geom);
CREATE INDEX idx_se_lookup    ON safety_events (company_id, event_type, driver_id, event_ts);
CREATE INDEX idx_se_drive     ON safety_events (drive_uuid);
CREATE INDEX idx_se_ts        ON safety_events (event_ts);

-- Drive summary records
CREATE TABLE drives (
    drive_uuid          UUID PRIMARY KEY,
    company_id          TEXT NOT NULL,
    driver_id           TEXT NOT NULL,
    vehicle_id          TEXT NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL,
    ended_at            TIMESTAMPTZ NOT NULL,
    total_distance_m    NUMERIC,
    total_duration_s    INTEGER,
    avg_speed_kmh       NUMERIC,
    score               NUMERIC CHECK (score BETWEEN 0 AND 100),
    route_geom          GEOGRAPHY(LINESTRING, 4326)
);

CREATE INDEX idx_drives_route      ON drives USING GIST (route_geom);
CREATE INDEX idx_drives_driver_ts  ON drives (company_id, driver_id, started_at);

-- Pre-computed route cache (avoids recomputing LineString on every request)
CREATE TABLE drive_routes (
    drive_uuid  UUID PRIMARY KEY REFERENCES drives(drive_uuid) ON DELETE CASCADE,
    route_geom  GEOGRAPHY(LINESTRING, 4326) NOT NULL,
    point_count INTEGER NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dr_geom ON drive_routes USING GIST (route_geom);

-- Users (JWT auth)
CREATE TABLE users (
    id                  BIGSERIAL PRIMARY KEY,
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    company_id          TEXT NOT NULL REFERENCES companies(company_id),
    role                TEXT NOT NULL DEFAULT 'viewer', -- 'admin' | 'manager' | 'viewer'
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Companies / tenants
CREATE TABLE companies (
    company_id  TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Aggregations Query Pattern

All dashboard KPIs are computed server-side in a single CTE query:

```sql
WITH filtered AS (
  SELECT *
  FROM safety_events
  WHERE company_id = $1
    AND event_ts BETWEEN $2 AND $3
    AND ($4::text IS NULL OR driver_id = $4)
    AND ($5::text[] IS NULL OR vehicle_id = ANY($5))
),
drive_stats AS (
  SELECT
    COUNT(DISTINCT drive_uuid)        AS total_drives,
    SUM(total_distance_m) / 1000.0    AS total_distance_km,
    SUM(total_duration_s)             AS total_duration_s,
    AVG(score)                        AS avg_score,
    MIN(score)                        AS min_score,
    MAX(score)                        AS max_score,
    STDDEV(score)                     AS std_score
  FROM drives
  WHERE company_id = $1
    AND started_at BETWEEN $2 AND $3
    AND ($4::text IS NULL OR driver_id = $4)
),
violations AS (
  SELECT
    event_type,
    COUNT(*) AS cnt
  FROM filtered
  GROUP BY event_type
)
SELECT
  ds.*,
  jsonb_object_agg(v.event_type, v.cnt) AS violations_by_type
FROM drive_stats ds
CROSS JOIN (SELECT jsonb_object_agg(event_type, cnt) FROM violations) v(violations_by_type)
GROUP BY ds.total_drives, ds.total_distance_km, ds.total_duration_s,
         ds.avg_score, ds.min_score, ds.max_score, ds.std_score;
```

### 4.3 Heatmap Query (PostGIS)

```sql
WITH bbox AS (
  SELECT ST_MakeEnvelope($west, $south, $east, $north, 4326)::geography AS box
),
filtered AS (
  SELECT geom
  FROM safety_events
  WHERE company_id = $1
    AND event_ts BETWEEN $2 AND $3
    AND ($4::text[] IS NULL OR event_type = ANY($4))
    AND ST_Intersects(geom, (SELECT box FROM bbox))
)
SELECT
  ST_Y(ST_Centroid(ST_Collect(geom)::geometry)) AS lat,
  ST_X(ST_Centroid(ST_Collect(geom)::geometry)) AS lng,
  COUNT(*)                                       AS weight
FROM filtered
GROUP BY ST_SnapToGrid(geom::geometry, $cell_lng, $cell_lat);
-- $cell_lng / $cell_lat derived from map zoom level sent by client
```

### 4.4 Materialized Views

```sql
-- Refreshed nightly (or on demand via REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE MATERIALIZED VIEW agg_daily AS
SELECT
  company_id,
  driver_id,
  date_trunc('day', event_ts) AS day,
  event_type,
  COUNT(*) AS event_count
FROM safety_events
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX ON agg_daily (company_id, driver_id, day, event_type);
```

---

## 5. Backend — Node.js + Express

### 5.1 Structure

```
backend/
├── src/
│   ├── app.js               ← Express app factory (no listen here — testable)
│   ├── server.js            ← Entry point: app.listen()
│   ├── config.js            ← env var validation (zod or joi)
│   ├── db.js                ← pg Pool singleton
│   │
│   ├── middleware/
│   │   ├── auth.js          ← JWT verify + attach req.user
│   │   ├── rbac.js          ← requireRole('admin') helper
│   │   ├── validate.js      ← request schema validation (zod)
│   │   └── errorHandler.js  ← centralised error formatting
│   │
│   ├── routers/
│   │   ├── auth.js          ← POST /auth/login, POST /auth/change-password
│   │   ├── aggregations.js  ← GET /api/aggregations
│   │   ├── heatmap.js       ← GET /api/heatmap
│   │   ├── drives.js        ← GET /api/drives, GET /api/drives/:id
│   │   ├── events.js        ← GET /api/events (paginated list)
│   │   ├── lookups.js       ← GET /api/drivers, GET /api/vehicles
│   │   └── admin.js         ← user/company management (admin role)
│   │
│   └── queries/             ← SQL query files (plain .sql or tagged template literals)
│       ├── aggregations.sql
│       ├── heatmap.sql
│       ├── drives.sql
│       └── events.sql
│
├── tests/
│   ├── setup.js             ← test DB setup / teardown
│   ├── auth.test.js
│   ├── aggregations.test.js
│   ├── heatmap.test.js
│   ├── drives.test.js
│   └── lookups.test.js
│
├── migrations/
│   ├── 001_initial.sql
│   └── 002_drive_routes.sql
│
├── .env.example
├── package.json
└── jest.config.js
```

### 5.2 Key Dependencies

```json
{
  "dependencies": {
    "express": "^4.19.0",
    "pg": "^8.11.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "zod": "^3.22.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.2.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "nodemon": "^3.1.0"
  }
}
```

### 5.3 Express App Setup

```js
// src/app.js
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const authRouter         = require('./routers/auth');
const aggregationsRouter = require('./routers/aggregations');
const heatmapRouter      = require('./routers/heatmap');
const drivesRouter       = require('./routers/drives');
const lookupsRouter      = require('./routers/lookups');
const eventsRouter       = require('./routers/events');
const adminRouter        = require('./routers/admin');
const { auth }           = require('./middleware/auth');
const errorHandler       = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS.split(',') }));
app.use(compression());
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use('/auth',         authRouter);
app.use('/api',          auth);             // all /api/* require valid JWT
app.use('/api',          aggregationsRouter);
app.use('/api',          heatmapRouter);
app.use('/api',          drivesRouter);
app.use('/api',          lookupsRouter);
app.use('/api',          eventsRouter);
app.use('/api/admin',    adminRouter);

app.use(errorHandler);

module.exports = app;
```

### 5.4 Auth Middleware

```js
// src/middleware/auth.js
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// requireRole('admin') — use after auth middleware
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { auth, requireRole };
```

---

## 6. Frontend — React + Leaflet

### 6.1 Component Tree

```
App
├── AuthContext (JWT token, user profile)
├── FiltersContext (date range, driver, vehicles)
├── QueryClientProvider (TanStack Query)
│
└── Router
    ├── /login            → LoginPage
    ├── /change-password  → ChangePasswordPage
    └── ProtectedRoute
        ├── Navbar
        ├── /aggregated   → AggregatedPage
        │   ├── FiltersPanel
        │   │   ├── DateRangePicker
        │   │   ├── DriverSelect
        │   │   └── VehicleMultiSelect
        │   ├── MapContainer (Leaflet)
        │   │   ├── HeatmapLayer      ← uses leaflet.heat
        │   │   └── MapZoomTracker    ← updates bbox + zoom in context
        │   ├── MetricsGrid
        │   │   └── MetricCard (×N)
        │   ├── ScoreGauge
        │   ├── ViolationsSummary
        │   │   └── ViolationItem (×N)
        │   ├── SafetyEventsToggle
        │   └── ExportCsvButton
        │
        └── /trip-summary → TripSummaryPage
            ├── DriveSelector
            ├── MapContainer (Leaflet)
            │   ├── RouteLayer        ← GeoJSON LineString
            │   ├── PointLayer        ← event markers
            │   └── ClusterLayer      ← marker cluster at low zoom
            └── MetricsGrid (drive-level)
```

### 6.2 Data Fetching Hooks

All server communication goes through TanStack Query hooks. No `fetch` or `axios` inside components.

```js
// src/hooks/useAggregations.js
import { useQuery } from '@tanstack/react-query';
import { getAggregations } from '../api/aggregations';
import { useFilters } from './useFilters';

export function useAggregations() {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['aggregations', filters],
    queryFn: () => getAggregations(filters),
    staleTime: 2 * 60 * 1000,   // 2 minutes
    enabled: !!filters.startDate && !!filters.endDate,
  });
}
```

### 6.3 Map Architecture

- **HeatmapLayer** — receives `{ lat, lng, weight }[]` cells from `/api/heatmap`, passes them to `leaflet.heat`. Never downloads raw event points.
- **PointLayer** — receives pre-filtered events array from `/api/drives/:id`. Renders markers from `violationConfig.js` icon dictionary.
- **RouteLayer** — renders a GeoJSON LineString received from `/api/drives/:id`.
- **MapZoomTracker** — watches Leaflet `moveend` / `zoomend` and writes `{ bbox, zoom }` to FiltersContext, triggering a new heatmap query.

### 6.4 violationConfig.js — Single Source of Truth for Icons

```js
// src/components/violations/violationConfig.js
export const VIOLATION_CONFIG = {
  stop_sign:           { label: 'Stop Sign',          icon: '/data/stop_sign.png',    color: '#e53935' },
  pedestrian_crossing: { label: 'Pedestrian Crossing', icon: '/data/pedestrian.png',   color: '#fb8c00' },
  over_speed:          { label: 'Over Speed',          icon: '/data/overspeed.png',    color: '#e53935' },
  harsh_braking:       { label: 'Harsh Braking',       icon: '/data/braking.png',      color: '#f4511e' },
  // ... all 33 event types
};
```

---

## 7. Authentication & Authorization — JWT

### 7.1 Flow

```
1. POST /auth/login  { email, password }
2. Server: bcrypt.compare(password, user.password_hash)
3. Server: jwt.sign({ userId, companyId, role }, JWT_SECRET, { expiresIn: '8h' })
4. Client: stores token in localStorage
5. Client: Axios interceptor attaches  Authorization: Bearer <token>  to every request
6. Server middleware: jwt.verify() on every /api/* route
7. company_id from token is injected into every DB query — users cannot cross tenant boundaries
```

### 7.2 Token Payload

```json
{
  "userId": 42,
  "companyId": "diversitech",
  "role": "manager",
  "iat": 1715000000,
  "exp": 1715028800
}
```

### 7.3 Roles

| Role | Permissions |
|---|---|
| `viewer` | Read own company data |
| `manager` | Read + export own company data |
| `admin` | Full access + user management |

### 7.4 Password Change Enforcement

If `must_change_password = true` on the user record, the `/api/*` routes return `403 { mustChangePassword: true }`. The frontend catches this and redirects to `/change-password` before rendering anything.

---

## 8. API Reference

All `/api/*` routes require `Authorization: Bearer <token>`.
All responses are `Content-Type: application/json`.

### 8.1 Auth

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | Returns `{ token, user }` |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | Updates password, clears flag |

### 8.2 Aggregations

```
GET /api/aggregations
```

Query params:

| Param | Type | Required | Description |
|---|---|---|---|
| `start_date` | ISO 8601 date | Yes | Range start |
| `end_date` | ISO 8601 date | Yes | Range end |
| `driver_id` | string | No | Filter to single driver |
| `vehicle_ids` | comma-separated | No | Filter to vehicle list |

Response:

```json
{
  "totals": {
    "total_drives": 142,
    "total_distance_km": 4821.3,
    "total_duration_s": 172800,
    "avg_speed_kmh": 52.1,
    "avg_score": 87.4,
    "min_score": 41,
    "max_score": 99,
    "std_score": 8.2,
    "unique_drivers": 14
  },
  "violations_summary": {
    "stop_sign":           { "count": 47, "ratio": 0.033 },
    "pedestrian_crossing": { "count": 12, "ratio": 0.008 },
    "over_speed":          { "count": 91, "ratio": 0.064 }
  },
  "time_windows": {
    "stop_sign": { "earliest": "07:14", "latest": "19:02" }
  }
}
```

### 8.3 Heatmap

```
GET /api/heatmap
```

| Param | Type | Required | Description |
|---|---|---|---|
| `start_date` | ISO 8601 | Yes | |
| `end_date` | ISO 8601 | Yes | |
| `event_types` | comma-separated | No | Default: all types |
| `south,west,north,east` | float | Yes | Map bounding box |
| `zoom` | integer | Yes | Leaflet zoom level (used to compute grid cell size) |

Response:

```json
{
  "cells": [
    { "lat": 32.081, "lng": 34.779, "weight": 14 },
    { "lat": 32.074, "lng": 34.791, "weight": 3 }
  ]
}
```

### 8.4 Drives

```
GET  /api/drives                  list of drives (paginated)
GET  /api/drives/:drive_uuid      single drive with route + events
```

Single drive response:

```json
{
  "drive": {
    "drive_uuid": "...",
    "driver_id": "d-42",
    "started_at": "2024-03-15T07:22:00Z",
    "ended_at": "2024-03-15T08:45:00Z",
    "score": 84,
    "total_distance_km": 38.2
  },
  "route": {
    "type": "LineString",
    "coordinates": [[34.77, 32.08], [34.78, 32.09]]
  },
  "events": [
    {
      "id": 1001,
      "event_type": "stop_sign",
      "lat": 32.082,
      "lng": 34.781,
      "ts": "2024-03-15T07:34:00Z",
      "speed_kmh": 28,
      "speed_limit": 0
    }
  ]
}
```

### 8.5 Lookups

```
GET /api/drivers    → [{ driver_id, display_name }]
GET /api/vehicles   → [{ vehicle_id, plate }]
```

### 8.6 Admin (role: admin only)

```
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id
```

---

## 9. Directory Structure

```
VComm-Refactored/
│
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config.js
│   │   ├── db.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── rbac.js
│   │   │   ├── validate.js
│   │   │   └── errorHandler.js
│   │   ├── routers/
│   │   │   ├── auth.js
│   │   │   ├── aggregations.js
│   │   │   ├── heatmap.js
│   │   │   ├── drives.js
│   │   │   ├── events.js
│   │   │   ├── lookups.js
│   │   │   └── admin.js
│   │   └── queries/
│   │       ├── aggregations.sql
│   │       ├── heatmap.sql
│   │       ├── drives.sql
│   │       └── events.sql
│   ├── tests/
│   │   ├── setup.js
│   │   ├── auth.test.js
│   │   ├── aggregations.test.js
│   │   ├── heatmap.test.js
│   │   ├── drives.test.js
│   │   └── lookups.test.js
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   └── 002_drive_routes.sql
│   ├── .env.example
│   ├── package.json
│   └── jest.config.js
│
└── frontend/
    ├── public/
    │   ├── index.html
    │   └── data/              ← all event-type icons (PNG)
    ├── src/
    │   ├── App.jsx
    │   ├── api/
    │   │   ├── client.js      ← axios instance + interceptor
    │   │   ├── auth.js
    │   │   ├── aggregations.js
    │   │   ├── heatmap.js
    │   │   ├── trips.js
    │   │   └── lookups.js
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   └── FiltersContext.jsx
    │   ├── hooks/
    │   │   ├── useAggregations.js
    │   │   ├── useHeatmap.js
    │   │   ├── useDrive.js
    │   │   ├── useEvents.js
    │   │   └── useFilters.js
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── ChangePasswordPage.jsx
    │   │   ├── AggregatedPage.jsx
    │   │   └── TripSummaryPage.jsx
    │   ├── components/
    │   │   ├── common/        (Button, Card, ErrorBoundary, LoadingSpinner)
    │   │   ├── layout/        (Navbar, PageLayout)
    │   │   ├── filters/       (FiltersPanel, DateRangePicker, DriverSelect, VehicleMultiSelect)
    │   │   ├── maps/          (MapContainer, HeatmapLayer, PointLayer, RouteLayer, ClusterLayer, icons.js)
    │   │   ├── metrics/       (MetricsGrid, MetricCard, ScoreGauge)
    │   │   ├── violations/    (ViolationsSummary, ViolationsList, ViolationItem, violationConfig.js)
    │   │   └── export/        (ExportCsvButton)
    │   └── utils/
    │       ├── constants.js
    │       └── format.js
    ├── .env.example
    ├── package.json
    └── tailwind.config.js
```

---

## 10. Local Development Setup

### Prerequisites

- Node.js 20 LTS
- PostgreSQL 18 with PostGIS 3.4 extension
- npm or yarn
- Git (version control)
- Postman (manual API testing)

### Backend

```bash
cd backend
cp .env.example .env        # fill in DB credentials and JWT_SECRET
npm install
# Run DB migrations
psql -U vcomm -d vcomm_db -f migrations/001_initial.sql
psql -U vcomm -d vcomm_db -f migrations/002_drive_routes.sql
# Start dev server (nodemon)
npm run dev
# API available at http://localhost:8000
# Auto-generated API docs (if using swagger-jsdoc): http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
cp .env.example .env        # set REACT_APP_API_BASE_URL=http://localhost:8000
npm install
npm start
# App at http://localhost:3000
```

### PostgreSQL + PostGIS (local)

```bash
# macOS (Homebrew)
brew install postgresql@15 postgis
createdb vcomm_db
psql vcomm_db -c "CREATE EXTENSION postgis;"

# Windows / Linux / macOS — via pgAdmin (GUI)
# 1. Download and install pgAdmin from https://www.pgadmin.org/download/
#    (bundles PostgreSQL server on Windows via the EDB installer:
#     https://www.postgresql.org/download/windows/ — check "pgAdmin 4" and "Stack Builder")
# 2. Launch Stack Builder → Spatial Extensions → install "PostGIS Bundle"
# 3. Open pgAdmin → connect to the local server (default port 5432)
# 4. Right-click "Databases" → Create → Database… → name: vcomm_db
# 5. Open the Query Tool on vcomm_db and run:
CREATE EXTENSION postgis;
```

### Git (local)

```bash
# Windows
# Download Git for Windows from https://git-scm.com/download/win
# Run the installer — accept defaults; this also installs "Git Bash"

# macOS
brew install git
# or install Apple's Command Line Tools: xcode-select --install

# Ubuntu / Debian
sudo apt install git

# Verify
git --version

# One-time configuration (any OS)
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

### Postman (API testing)

```bash
# 1. Download Postman from https://www.postman.com/downloads/
#    (native installers available for Windows, macOS, and Linux)
# 2. Create a free account (or skip sign-in for local-only use)
# 3. Import the VComm collection:
#    File → Import → drop the file `docs/postman/VComm.postman_collection.json`
# 4. Set the collection variable `baseUrl` to http://localhost:8000
# 5. Run POST /auth/login first — the returned token is auto-saved to the
#    `token` collection variable and attached to all subsequent requests
#    via Authorization: Bearer {{token}}
```

---

## 11. Testing Strategy

### 11.1 Naming Conventions

Consistent test names make failures readable in CI output and let teammates locate the right test from a stack trace without opening the file. All three teams ([§16](#16-work-plan--junior-developer-program)) follow the same rules.

#### File names

| Scope | Pattern | Example |
|---|---|---|
| Backend route | `<router>.test.js` | `aggregations.test.js` |
| Backend unit (helper / middleware) | `<module>.test.js` | `resolveCompany.test.js` |
| Frontend component | `<Component>.test.jsx` | `MetricCard.test.jsx` |
| Frontend hook | `<useHook>.test.js` | `useAggregations.test.js` |

Co-locate frontend tests next to the file under test; keep backend tests in `backend/tests/` mirroring the `src/` tree.

#### `describe` blocks

Name the unit under test exactly as it appears in code — the HTTP method + path for a route, the function name for a helper, the component name for a React component.

```js
describe('GET /api/aggregations', () => { ... });
describe('resolveCompany middleware', () => { ... });
describe('<MetricCard />', () => { ... });
```

#### `it` / `test` blocks — behavior-first

Start every test name with `should` followed by the **observable behavior**, never the implementation. The reader should understand the contract being verified without opening the test body.

| Pattern | Example |
|---|---|
| `should <do X> when <condition>` | `should return 401 when Authorization header is missing` |
| `should <do X> for <input>` | `should return zero totals for an empty date range` |
| `should reject <X> with <error>` | `should reject view_as for non-admin tokens with 403` |

**Good:**

```js
it('should return aggregated totals for a date range', ...);
it('should return 401 when token is missing', ...);
it('should scope results to the caller company', ...);
it('should set must_change_password=true after admin reset', ...);
```

**Avoid** — vague names, implementation details, or restating the function name:

```js
it('works');                              // ❌ what works?
it('calls the db.query function');        // ❌ implementation, not behavior
it('aggregations endpoint test');         // ❌ no contract stated
```

#### Test data identifiers

Use stable, descriptive seed values so failures point at the scenario, not at a random fixture:

- Company IDs: `'test-co'`, `'other-co'` (never UUIDs in assertions)
- Drivers: `'d-1'`, `'d-2'`
- Drive UUIDs: hard-coded constants exported from `tests/fixtures.js`

### 11.2 Backend — Jest + Supertest

Tests run against a real PostgreSQL test database (not mocks) to catch SQL regressions.

```js
// tests/aggregations.test.js
const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db');

describe('GET /api/aggregations', () => {
  let token;

  beforeAll(async () => {
    // Seed test DB + get JWT
    await db.query('INSERT INTO companies VALUES ($1, $2)', ['test-co', 'Test Co']);
    const res = await request(app).post('/auth/login')
      .send({ email: 'admin@test.com', password: 'test1234' });
    token = res.body.token;
  });

  afterAll(() => db.end());

  it('returns aggregated totals for a date range', async () => {
    const res = await request(app)
      .get('/api/aggregations?start_date=2024-01-01&end_date=2024-12-31')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totals).toHaveProperty('avg_score');
    expect(res.body.violations_summary).toHaveProperty('stop_sign');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/aggregations');
    expect(res.status).toBe(401);
  });

  it('cannot access another company data', async () => {
    // token is scoped to 'test-co'; query for 'other-co' data must return empty
    const res = await request(app)
      .get('/api/aggregations?start_date=2024-01-01&end_date=2024-12-31&company_id=other-co')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.totals.total_drives).toBe(0);
  });
});
```

Run tests:

```bash
cd backend
npm test               # all tests
npm test -- --watch    # watch mode
npm test -- --coverage # coverage report
```

### 11.3 Frontend — React Testing Library

```bash
cd frontend
npm test
```

Component tests focus on rendering with mock API responses via TanStack Query's test utilities.

---

## 12. Environment Variables

### Backend `.env.example`

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=vcomm_db
POSTGRES_USER=vcomm
POSTGRES_PASSWORD=change_me

# JWT
JWT_SECRET=replace_with_64_char_random_string
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480

# App
PORT=8000
CORS_ORIGINS=http://localhost:3000
NODE_ENV=development
```

### Frontend `.env.example`

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

---

## 13. Migration from Legacy System

The legacy system uses DynamoDB with 33 separate tables (`OSEM_Vehicle_*`). A one-time ETL script migrates all data into the unified `safety_events` table:

```
legacy DynamoDB tables (33)
    ↓  ETL script (Python / Node.js)
    ↓  maps table name → event_type string
    ↓  converts numeric ts → TIMESTAMPTZ
    ↓  converts lat/lng → GEOGRAPHY POINT
PostgreSQL safety_events (single table)
```

After the ETL:
1. Remove `aws-sdk` from frontend `package.json`
2. Remove all hardcoded AWS credentials from source
3. Delete `mendi_credentials.csv` and add to `.gitignore`
4. Rotate AWS keys in AWS Console

---

## 14. Admin Panel

The Admin Panel is a dedicated section of the UI, accessible only to users with `role = 'admin'`. It provides full control over system metadata: companies, users, and passwords. Admins can also impersonate any company's view to inspect dashboards without sharing credentials.

Access is enforced at two layers:
- **Frontend** — routes are protected by a `<AdminRoute>` guard that checks `user.role === 'admin'` from the JWT.
- **Backend** — every admin API endpoint passes through `requireRole('admin')` middleware before any DB query runs. A non-admin token receives `403 Forbidden` regardless of what the UI shows.

---

### 14.1 UI Screens

#### Companies Screen

Displays all registered companies in a searchable table.

| Column | Description |
|---|---|
| Company ID | Unique slug (e.g. `diversitech`) |
| Name | Display name |
| Users | Count of active users |
| Created | Registration date |
| Actions | Edit name · Delete |

**Create company** — inline form: `company_id` (slug, immutable after creation) + `name`.

**Delete company** — requires confirmation dialog. Cascades to all users of that company (does not delete historical event data).

#### Users Screen

Searchable/filterable table of all users across all companies.

| Column | Description |
|---|---|
| Email | User login |
| Company | Linked company name |
| Role | `viewer` / `manager` / `admin` |
| Must Change PW | Flag indicator |
| Last Login | Timestamp |
| Actions | Edit · Reset Password · Delete |

**Create user** — modal form:

```
Email           [input]
Company         [dropdown — all companies]
Role            [select: viewer / manager / admin]
Temporary PW    [input — auto-sets must_change_password = true]
```

**Edit user** — update email, company, role.

**Reset password** — admin sets a new temporary password; `must_change_password` is automatically set to `true`. User is forced to change it on next login.

**Delete user** — soft confirmation required.

#### View As Company (Dashboard Impersonation)

A dropdown in the admin Navbar lets the admin select any company. Selecting one injects `{ viewAsCompany: 'company_id' }` into FiltersContext. All subsequent API calls include `?view_as=company_id` which the backend accepts only from admin-role tokens.

This allows admins to inspect the Aggregated and TripSummary dashboards for any tenant without knowing their credentials.

```
Admin Navbar:
  [ VComm ] [ Admin ▾ ]   Viewing as: [ All Companies ▾ ]
                                        ├─ All Companies
                                        ├─ Diversitech
                                        ├─ ElectricCo
                                        └─ FC Logistics
```

---

### 14.2 Backend — RBAC Middleware

```js
// src/middleware/rbac.js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden — insufficient role' });
    next();
  };
}

module.exports = { requireRole };
```

Applied on every admin route:

```js
// src/routers/admin.js
const { requireRole } = require('../middleware/rbac');

router.use(requireRole('admin'));   // blocks all non-admins at router level

router.get('/companies',         listCompanies);
router.post('/companies',        createCompany);
router.patch('/companies/:id',   updateCompany);
router.delete('/companies/:id',  deleteCompany);

router.get('/users',             listUsers);
router.post('/users',            createUser);
router.patch('/users/:id',       updateUser);
router.delete('/users/:id',      deleteUser);
router.post('/users/:id/reset-password', resetPassword);
```

#### view_as enforcement

For dashboard endpoints, admins may pass `?view_as=company_id` to query any company's data. Non-admins who include this param get `403`:

```js
// src/middleware/resolveCompany.js
function resolveCompany(req, res, next) {
  const { role, companyId } = req.user;

  if (req.query.view_as) {
    if (role !== 'admin')
      return res.status(403).json({ error: 'view_as requires admin role' });
    req.resolvedCompanyId = req.query.view_as;
  } else {
    req.resolvedCompanyId = companyId;   // always own company for non-admins
  }
  next();
}

module.exports = { resolveCompany };
```

Used in aggregations and heatmap routers:

```js
// src/routers/aggregations.js
const { resolveCompany } = require('../middleware/resolveCompany');

router.get('/aggregations', resolveCompany, async (req, res) => {
  const { start_date, end_date, driver_id } = req.query;
  const companyId = req.resolvedCompanyId;   // safe — set by middleware
  // ... run query with companyId
});
```

---

### 14.3 Admin API Reference

All routes require `Authorization: Bearer <admin-token>` (role must be `admin`).

#### Companies

| Method | Path | Body / Params | Description |
|---|---|---|---|
| GET | `/api/admin/companies` | — | List all companies |
| POST | `/api/admin/companies` | `{ company_id, name }` | Create company |
| PATCH | `/api/admin/companies/:id` | `{ name }` | Rename company |
| DELETE | `/api/admin/companies/:id` | — | Delete company (cascades users) |

#### Users

| Method | Path | Body / Params | Description |
|---|---|---|---|
| GET | `/api/admin/users` | `?company_id=&role=` | List all users (filterable) |
| POST | `/api/admin/users` | `{ email, password, company_id, role }` | Create user — sets `must_change_password=true` |
| PATCH | `/api/admin/users/:id` | `{ email?, company_id?, role? }` | Update user metadata |
| DELETE | `/api/admin/users/:id` | — | Delete user |
| POST | `/api/admin/users/:id/reset-password` | `{ new_password }` | Reset password + set `must_change_password=true` |

#### Dashboard Impersonation

Any existing `/api/aggregations`, `/api/heatmap`, or `/api/drives` endpoint accepts `?view_as=company_id` when called with an admin token:

```
GET /api/aggregations?start_date=2024-01-01&end_date=2024-12-31&view_as=electricco
Authorization: Bearer <admin-jwt>
```

Returns data scoped to `electricco` — identical response shape, different data.

---

### 14.4 Frontend — Admin Routes & Guards

```jsx
// src/components/common/AdminRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/aggregated" replace />;
  return children;
};
```

Added to the router in `App.jsx`:

```jsx
<Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index               element={<Navigate to="companies" replace />} />
  <Route path="companies"    element={<CompaniesPage />} />
  <Route path="users"        element={<UsersPage />} />
</Route>
```

Admin pages live in:

```
src/pages/admin/
├── AdminLayout.jsx      ← sidebar nav: Companies | Users
├── CompaniesPage.jsx    ← table + create/edit/delete
└── UsersPage.jsx        ← table + create/edit/reset-password/delete
```

The `ViewAsCompany` dropdown is rendered inside `Navbar.jsx` only when `user.role === 'admin'`, and writes to `FiltersContext`:

```jsx
// Only rendered for admins
{user.role === 'admin' && (
  <ViewAsCompanySelect
    value={viewAsCompany}
    onChange={setViewAsCompany}
  />
)}
```

---

### 14.5 Password Security

- Passwords are hashed with **bcrypt** (cost factor 12) before storage — plain text is never written to the DB.
- Temporary passwords set by admin during creation or reset must be changed on first login (`must_change_password = true`).
- Minimum password length: 8 characters, validated on both client and server (zod schema on the backend).
- No password recovery by email in v1 — admin-initiated reset is the only flow.

```js
// src/routers/admin.js — reset password handler
router.post('/users/:id/reset-password', requireRole('admin'), async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const hash = await bcrypt.hash(new_password, 12);
  await db.query(
    'UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2',
    [hash, req.params.id]
  );
  res.json({ ok: true });
});
```

---

## 15. Success Metrics

| Metric | Legacy | Target |
|---|---|---|
| `Aggregated` component size | 2,770 lines | < 200 lines |
| `Pointmap` component size | 1,502 lines | < 200 lines |
| useState count per page | 76+ | < 10 |
| Network requests on page load | 33 | 1–2 |
| Initial load time (typical data) | 15–30 s | < 3 s |
| Bundle size (gzipped) | > 1.5 MB | < 500 KB |
| AWS credentials in client code | 4 locations | 0 |
| Backup/dead files (`_org`, `Copy`) | ~15 | 0 |
| Test coverage (backend) | 0% | > 80% |

---

## 16. Work Plan — Junior Developer Program

The VComm rewrite is executed by **12 junior developers** organized into **3 cross-functional teams of 3-4**. The program runs **8 weeks** end-to-end, with structured onboarding at the start and supervised production deployment at the end.

### 16.1 Team Structure

Each team is a full-stack squad responsible for one page of the product, end-to-end — database schema, backend API, and frontend UI. This means every team owns a vertical slice and can ship independently.

| Team | Page / Vertical | Members | Scope |
|---|---|---|---|
| **Team A** | Admin Page | 3-4 devs (DB · Backend · Frontend) | Companies & users CRUD, role management, view-as-company impersonation. See [§14 Admin Panel](#14-admin-panel). |
| **Team B** | Aggregated Page | 3-4 devs (DB · Backend · Frontend) | Filters, KPIs, heatmap, violations summary, CSV export. See [§8.2](#82-aggregations) and [§8.3](#83-heatmap). |
| **Team C** | Single-Drive Page | 3-4 devs (DB · Backend · Frontend) | Drive selector, route map, point/cluster layers, drive-level metrics. See [§8.4 Drives](#84-drives). |

Within each team, one (maximum two) developer owns each layer:

- **DB dev** — schema migrations, indexes, query authoring, materialized views
- **Backend dev** — Express routers, middleware, validation, tests
- **Frontend dev** — React pages, hooks, components, map layers

Pairs across teams collaborate horizontally (e.g. all three DB devs review each other's migrations).

### 16.2 Timeline — 8 Weeks

```
Week 1 ─┐
Week 2 ─┴── Onboarding (all devs together)
Week 3 ─┐
Week 4 ─┤
Week 5 ─┤── Feature development (teams work in parallel)
Week 6 ─┘
Week 7 ─┐
Week 8 ─┴── Deployment to production
```

**Cross-team sync:** every week during weeks 3–6, a 30-minute checkpoint surfaces blockers and aligns on shared concerns (auth middleware, FiltersContext, shared components).

---

#### Weeks 1–2 — Onboarding

All developers go through a shared curriculum before touching product code.

| Topic | Content |
|---|---|
| **Git & GitHub** | Branching, PRs, code review etiquette, conflict resolution, commit hygiene |
| **Fullstack Foundations** | HTTP, REST, JSON, async JavaScript, Node.js basics |
| **PostgreSQL + PostGIS** | SQL fundamentals, joins, indexes, spatial queries |
| **Express** | Routing, middleware, error handling, JWT auth |
| **React** | Components, hooks, context, TanStack Query |
| **Testing** | Jest, Supertest, React Testing Library — naming conventions per [§11.1](#111-naming-conventions) |
| **VComm walkthrough** | Architecture overview, repo tour, local setup ([§10](#10-local-development-setup)) |

**Deliverable (all devs):** working local environment and at least one merged PR to the repo.

**DOD — Onboarding:**
- `npm run dev` starts the backend without errors
- `npm start` starts the frontend without errors
- At least one commit merged via a PR with a passing CI check
- Developer can explain the JWT auth flow from login to protected route

>
> Check the following for the developer under review:
> 1. The repository has at least one merged PR authored by this developer.
> 2. The PR touches a real file (not a README typo) and passed CI.
> 3. The developer's local `.env` file exists (check `.env.example` is not the only file present).
> 4. Running `node backend/src/server.js` exits without an uncaught exception on a clean install.
>
> Do not evaluate code quality, style, or suggest what they should have done differently.
> ```

---

#### Week 3 — Foundation: Schemas, Stubs & Page Shells

Goal: every team has a runnable skeleton — real DB tables, stub API routes that return the correct HTTP status codes and shape, and navigable frontend pages.

##### Team A — Admin Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Create `companies` and `users` tables with all constraints and indexes from [§4.1](#41-core-tables). Seed 3 companies and 5 users with bcrypt-hashed passwords. | `\d users` shows all columns. `SELECT COUNT(*) FROM users` returns 5. Passwords stored as bcrypt hashes (start with `$2b$`). Migration file committed as `migrations/001_initial.sql`. | Do not fix or suggest changes. In psql run `\d users` and `\d companies` — check columns match §4.1. `SELECT COUNT(*) FROM users` — check 5 rows. Check one password hash starts with `$2b$`. Confirm `migrations/001_initial.sql` exists. Report PASS or FAIL and what is missing. |
| **Backend** | Scaffold all 9 `/api/admin/*` routes (companies CRUD + users CRUD + reset-password) returning stub `{ ok: true, stub: true }`. Wire `requireRole('admin')` at router level. | Every route returns HTTP 200 with a stub body. A request with a non-admin JWT returns 403. A request without a token returns 401. No real DB queries yet. | Do not fix or suggest changes. Call any admin route with a valid admin JWT — check HTTP 200 with JSON body. Same request with viewer JWT — check 403. No token — check 401. Report PASS or FAIL and what is missing. |
| **Frontend** | Create `AdminLayout.jsx` with sidebar (Companies \| Users links), `CompaniesPage.jsx` and `UsersPage.jsx` shells rendering a loading placeholder. Add `/admin/*` routes in `App.jsx` behind `<AdminRoute>`. | Navigating to `/admin/companies` renders the layout without a console error. `<AdminRoute>` redirects a `viewer`-role user to `/aggregated`. | Do not fix or suggest changes. Open `/admin/companies` as admin — check page renders with no console errors. Open as viewer — check redirect away from `/admin`. Report PASS or FAIL and what is missing. |

>
> 1. DB — Open psql and run: \d users AND \d companies.
>    Check: both tables exist with the columns defined in §4.1 of the architecture doc.
>    Check: at least one password hash in the users table starts with "$2b$".
>    Check: a file named migrations/001_initial.sql exists and contains CREATE TABLE statements.
>
> 2. Backend — Send GET /api/admin/users with a valid admin JWT.
>    Check: response is HTTP 200 with a JSON body.
>    Send the same request with a viewer JWT — check: response is HTTP 403.
>    Send without any token — check: response is HTTP 401.
>
> 3. Frontend — Navigate to /admin/companies in a browser logged in as admin.
>    Check: the page renders without a red error boundary or console error.
>    Log in as a viewer and navigate to /admin/companies.
>    Check: browser is redirected away from /admin.
>
> Do not comment on code style, naming, or anything not listed above.
> ```

##### Team B — Aggregated Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Create `safety_events` table with all indexes from [§4.1](#41-core-tables). Seed 50 events across 3 event types, 2 drivers, spanning 30 days. | `SELECT COUNT(*) FROM safety_events` returns 50. `EXPLAIN SELECT * FROM safety_events WHERE company_id = 'x' AND event_ts BETWEEN ... AND ...` shows an index scan (not a sequential scan). | Do not fix or suggest changes. `SELECT COUNT(*) FROM safety_events` — check 50+ rows. `EXPLAIN SELECT ... WHERE company_id='x' AND event_ts BETWEEN ...` — check plan shows index scan not seq scan. Report PASS or FAIL and what is missing. |
| **Backend** | Scaffold `GET /api/aggregations` and `GET /api/heatmap` returning stub JSON matching the documented response shapes in [§8.2](#82-aggregations) and [§8.3](#83-heatmap). Required params missing → 400. | Both routes return 200 with all top-level keys present in the stub body. A request without `start_date` or `end_date` returns 400. A request without a token returns 401. | Do not fix or suggest changes. `GET /api/aggregations?start_date=2024-01-01&end_date=2024-12-31` with JWT — check 200 with `totals` and `violations_summary` keys. Without `start_date` — check 400. Without token — check 401. Report PASS or FAIL and what is missing. |
| **Frontend** | Create `AggregatedPage.jsx` with placeholder sections for `FiltersPanel`, `MetricsGrid`, and `MapContainer`. Wire to `/aggregated` route behind `<ProtectedRoute>`. | `/aggregated` renders without errors. The `FiltersPanel` placeholder contains two date inputs that log to console on change. No `fetch` or `axios` calls inside components — use a stub `useAggregations` hook returning hard-coded data. | Do not fix or suggest changes. Open `/aggregated` — check renders without console error. Check no `fetch()` or `axios()` calls inside any component file. Check `useAggregations` is imported from `src/hooks/`. Report PASS or FAIL and what is missing. |

>
> 1. DB — Run in psql: SELECT COUNT(*) FROM safety_events;
>    Check: result is 50 or more rows.
>    Run: EXPLAIN SELECT * FROM safety_events WHERE company_id = 'test' AND event_ts BETWEEN NOW()-INTERVAL '30 days' AND NOW();
>    Check: the query plan contains "Index Scan" — not "Seq Scan".
>
> 2. Backend — Send GET /api/aggregations?start_date=2024-01-01&end_date=2024-12-31 with a valid JWT.
>    Check: response is HTTP 200 and the body contains the keys "totals" and "violations_summary".
>    Send without start_date — check: response is HTTP 400.
>    Send without a token — check: response is HTTP 401.
>
> 3. Frontend — Open /aggregated in a browser.
>    Check: page renders without a console error.
>    Check: there are no direct fetch() or axios() calls inside any .jsx component file in src/pages/ or src/components/.
>    Check: useAggregations is imported from src/hooks/ (not defined inline in the page component).
>
> Do not comment on code style, naming, or anything not listed above.
> ```

##### Team C — Single-Drive Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Create `drives` and `drive_routes` tables with GIST indexes from [§4.1](#41-core-tables). Seed 5 drives with real `GEOGRAPHY(LINESTRING)` route geometries. | `SELECT ST_AsText(route_geom) FROM drives LIMIT 1` returns a valid WKT `LINESTRING(...)`. `\d drive_routes` shows the GIST index on `route_geom`. | Do not fix or suggest changes. `SELECT ST_AsText(route_geom) FROM drives LIMIT 1` — check result is a valid WKT LINESTRING. `\d drive_routes` — check GIST index exists on `route_geom`. Report PASS or FAIL and what is missing. |
| **Backend** | Scaffold `GET /api/drives` (list) and `GET /api/drives/:id` (single) returning stub JSON matching [§8.4](#84-drives). Invalid UUID format → 400. | Both routes return 200 with stub bodies. `GET /api/drives` body contains a `drives` array. `GET /api/drives/not-a-uuid` returns 400. No token → 401. | Do not fix or suggest changes. `GET /api/drives` with JWT — check 200 with `drives` array. `GET /api/drives/not-a-uuid` — check 400. No token — check 401. Report PASS or FAIL and what is missing. |
| **Frontend** | Create `TripSummaryPage.jsx` with placeholder `DriveSelector` (a `<select>` element) and an empty `MapContainer`. Wire to `/trip-summary` route behind `<ProtectedRoute>`. | `/trip-summary` renders without errors. `DriveSelector` is a controlled component (value comes from `useState`). No direct API calls inside the component. | Do not fix or suggest changes. Open `/trip-summary` — check renders without console error. Inspect `TripSummaryPage.jsx` — check select value is controlled via `useState`. Check no `fetch()` or `axios()` inside the component. Report PASS or FAIL and what is missing. |

>
> 1. DB — Run in psql: SELECT ST_AsText(route_geom) FROM drives LIMIT 1;
>    Check: result is a LINESTRING with at least 2 coordinate pairs (not NULL, not empty).
>    Run: \d drive_routes
>    Check: output lists a GIST index on route_geom.
>
> 2. Backend — Send GET /api/drives with a valid JWT.
>    Check: response is HTTP 200 and body contains a "drives" key with an array value.
>    Send GET /api/drives/not-a-uuid — check: response is HTTP 400.
>    Send without a token — check: response is HTTP 401.
>
> 3. Frontend — Open /trip-summary in a browser.
>    Check: page renders without a console error or blank screen.
>    Inspect TripSummaryPage.jsx — check: the select element's value is controlled via useState (not uncontrolled).
>    Check: no fetch() or axios() calls inside TripSummaryPage.jsx or DriveSelector.jsx.
>
> Do not comment on code style, naming, or anything not listed above.
> ```

---

#### Week 4 — Implementation: Real Queries, Hooks & Full Components

Goal: every team replaces stubs with real DB queries, wires the frontend to the API through TanStack Query hooks, and renders real data on screen.

##### Team A — Admin Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Write parameterized SQL queries for all user and company CRUD operations. All queries use `$1, $2` placeholders — no string concatenation. | Each query file in `queries/` is tested manually with `psql`. A `SELECT` after `INSERT` returns the new row. No query builds a string with `+` or template literals containing user input. | Do not fix or suggest changes. Open any file in `queries/` — check all SQL uses `$1`/`$2` placeholders with no string concatenation or template literals embedding `req.body`/`req.params`. Report PASS or FAIL and what is missing. |
| **Backend** | Implement all 9 admin endpoints with real DB queries. Implement `POST /api/admin/users/:id/reset-password` setting `must_change_password = true`. Add zod validation for all request bodies. | Supertest tests exist for each endpoint (create, read, update, delete, reset-password). A missing required field returns 400 with a human-readable error message. Test names follow the `should <verb> when <condition>` convention from [§11.1](#111-naming-conventions). | Do not fix or suggest changes. `npm test -- --testPathPattern=admin` — check all pass. Open `admin.test.js` — check every `it()` starts with `should ` per §11.1. POST with empty body — check 400 with human-readable error. Verify `must_change_password = true` in DB after reset-password. Report PASS or FAIL and what is missing. |
| **Frontend** | Implement `CompaniesPage` with a data table, create-company modal, inline name edit, and delete with confirmation. Wire to API using `useQuery` / `useMutation` from TanStack Query. | Creating a company calls `POST /api/admin/companies` and the table row appears without a page reload. Delete requires a confirmation step. No `fetch` or `axios` inside components. `useQuery` cache is invalidated after a mutation. | Do not fix or suggest changes. Open `CompaniesPage.jsx` — check no `fetch()` or `axios()` and data uses `useQuery`. In browser create a company — check table updates without full reload. Click delete — check confirmation appears before DELETE fires. Report PASS or FAIL and what is missing. |

>
> 1. DB — Open any query file in backend/src/queries/ or backend/src/routers/admin.js.
>    Check: every SQL string uses $1/$2/... placeholders for user-supplied values.
>    Check: no query builds a string using + or a template literal that embeds req.body or req.params directly.
>
> 2. Backend — Run: npm test -- --testPathPattern=admin
>    Check: all tests pass.
>    Open admin.test.js — check every it() description starts with "should " and follows the pattern from §11.1.
>    Send POST /api/admin/users with an empty body — check: response is HTTP 400 with an "error" key in the body.
>    Send POST /api/admin/users/:id/reset-password — verify the user record in the DB has must_change_password = true afterwards.
>
> 3. Frontend — Open CompaniesPage.jsx.
>    Check: there are no fetch() or axios() calls in the file.
>    Check: data fetching uses useQuery from @tanstack/react-query.
>    In the browser, create a company and verify the table updates without a full page reload.
>    Click delete on a company — check: a confirmation dialog or modal appears before the DELETE request is sent.
>
> Do not comment on code style, naming, or anything not listed above.
> ```

##### Team B — Aggregated Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Finalize the aggregations CTE in `queries/aggregations.sql` and the heatmap PostGIS query in `queries/heatmap.sql`. Create the `agg_daily` materialized view and its unique index. | Running the aggregations query against the seeded 50 events returns a non-null `avg_score`. `REFRESH MATERIALIZED VIEW agg_daily` runs without errors. `ST_SnapToGrid` in the heatmap query produces grouped cells visible in psql output. | Do not fix or suggest changes. Run `queries/aggregations.sql` manually — check `avg_score` is non-null. `REFRESH MATERIALIZED VIEW agg_daily` — check no error. Run heatmap query — check rows contain `lat`, `lng`, `weight` columns. Report PASS or FAIL and what is missing. |
| **Backend** | Implement `/api/aggregations` and `/api/heatmap` with real SQL. Add the `resolveCompany` middleware so admins can use `?view_as=`. Add zod validation for all query params. | A request scoped to `test-co` returns no data for `other-co` events. A non-admin token with `?view_as=other-co` returns 403. An invalid `start_date` format returns 400 with message `"Invalid date format. Use YYYY-MM-DD"`. | Do not fix or suggest changes. `GET /api/aggregations` with `test-co` JWT — check data matches test-co seed. Add `?view_as=other-co` with viewer JWT — check 403. Send `start_date=not-a-date` — check 400 with message containing `YYYY-MM-DD`. Report PASS or FAIL and what is missing. |
| **Frontend** | Implement `useAggregations` and `useHeatmap` hooks. Render `MetricsGrid` with real data from the API. Add `HeatmapLayer` to the Leaflet map fed by `useHeatmap`. | `MetricsGrid` displays non-zero values fetched from `/api/aggregations`. The heatmap layer renders coloured cells on the map from `/api/heatmap`. All data fetching is through TanStack Query — no `fetch`/`axios` in components. | Do not fix or suggest changes. Open `/aggregated` — check `MetricsGrid` shows non-zero values (not `0`, `undefined`, or `--`). Check heatmap cells appear on the map. Open `MetricsGrid.jsx` and `useAggregations.js` — check no `fetch()` or `axios()` calls. Report PASS or FAIL and what is missing. |

>
> 1. DB — Run the aggregations query from queries/aggregations.sql manually in psql with real $1/$2/$3 values.
>    Check: the result contains avg_score as a non-null number.
>    Run: REFRESH MATERIALIZED VIEW agg_daily; — check: no error.
>    Run the heatmap query — check: result contains rows with lat, lng, weight columns.
>
> 2. Backend — Log in as test-co, call GET /api/aggregations for the test-co date range.
>    Check: response contains data from the seeded test-co events.
>    Now add ?view_as=other-co to the same request with a viewer JWT.
>    Check: response is HTTP 403.
>    Send start_date=not-a-date — check: response is HTTP 400 with a message containing "YYYY-MM-DD".
>
> 3. Frontend — Open the browser and navigate to /aggregated.
>    Check: MetricsGrid shows numeric values (not 0, not undefined, not "--").
>    Check: the Leaflet map shows at least one heatmap cell if seed data is in the current map viewport.
>    Open MetricsGrid.jsx and useAggregations.js — check: no fetch() or axios() calls exist in either file.
>
> Do not comment on code style, naming, or anything not listed above.
> ```

##### Team C — Single-Drive Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Write `queries/drives.sql` returning drive metadata + GeoJSON route + events array for a single UUID. Verify with `EXPLAIN ANALYZE` that the GIST index is used. | `EXPLAIN ANALYZE` output contains "Index Scan using idx_drives_route" or similar. The query returns `route` as a GeoJSON `LineString` object. Running with 5 seeded drives returns correct data for each. | Do not fix or suggest changes. `EXPLAIN ANALYZE` on `queries/drives.sql` — check output contains Index Scan on drives or drive_routes. Run query with a known UUID — check `route` value is a GeoJSON LineString. Report PASS or FAIL and what is missing. |
| **Backend** | Implement `GET /api/drives` (paginated: `limit` + `offset`) and `GET /api/drives/:id` with full route + events response. Non-existent UUID → 404. | `GET /api/drives?limit=3&offset=0` returns 3 drives and a `total` count field. `GET /api/drives/:id` returns a body with keys `drive`, `route` (GeoJSON LineString), and `events` array. An unknown UUID returns 404. | Do not fix or suggest changes. `GET /api/drives?limit=3&offset=0` — check `drives` array has 3 items and body has a `total` field. `GET /api/drives/<valid-uuid>` — check body has `drive`, `route` (type LineString), and `events` keys. Unknown UUID — check 404. Report PASS or FAIL and what is missing. |
| **Frontend** | Implement `RouteLayer` (renders GeoJSON LineString on Leaflet map) and `PointLayer` (renders event markers using icons from `violationConfig.js`). Wire `DriveSelector` to `GET /api/drives`. | Selecting a drive from `DriveSelector` renders the route polyline on the map. Event markers use the correct icon from `violationConfig.js`. No coordinates are hardcoded. Data fetching uses `useDrive` hook only. | Do not fix or suggest changes. Select a drive — check a polyline appears on the map. Check event markers use icons from `violationConfig.js` (not default Leaflet markers). Open `RouteLayer.jsx` and `PointLayer.jsx` — check no hardcoded coordinates and data comes from `useDrive` only. Report PASS or FAIL and what is missing. |

>
> 1. DB — Run EXPLAIN ANALYZE on the single-drive query from queries/drives.sql.
>    Check: the plan contains an index scan (not a sequential scan) on the drives or drive_routes table.
>    Run the query with a known drive UUID — check: the route value is a valid GeoJSON LineString object.
>
> 2. Backend — Send GET /api/drives?limit=3&offset=0 with a valid JWT.
>    Check: response body contains a "drives" array with exactly 3 items AND a "total" field.
>    Send GET /api/drives/<valid-uuid> — check: body contains "drive", "route", and "events" keys.
>    The "route" value must have type "LineString" and a "coordinates" array.
>    Send GET /api/drives/<random-uuid-not-in-db> — check: response is HTTP 404.
>
> 3. Frontend — Select a drive from DriveSelector in the browser.
>    Check: a polyline appears on the Leaflet map matching the drive route.
>    Check: event markers appear on the map and each uses an icon defined in violationConfig.js (not a default Leaflet marker).
>    Open RouteLayer.jsx and PointLayer.jsx — check: no hardcoded coordinate arrays ([34.77, 32.08] etc.).
>    Check: both files import data from useDrive hook, not from a direct fetch() call.
>
> Do not comment on code style, naming, or anything not listed above.
> ```

---

#### Week 5 — Polish: Edge Cases, Validation & Complete UI

Goal: every feature is complete and handles unhappy paths gracefully. No stubs remain.

##### Team A — Admin Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Verify cascade delete: deleting a company must cascade to all its users. Test FK constraint violations. | `DELETE FROM companies WHERE company_id = 'test-co'` removes associated users. Inserting a user with a non-existent `company_id` raises a FK error. Both scenarios are documented in the migration file as comments. | Do not fix or suggest changes. Insert a user with a non-existent `company_id` — check FK constraint error is raised. Delete a seeded company — check `SELECT COUNT(*) FROM users WHERE company_id='...'` returns 0 (cascade). Report PASS or FAIL and what is missing. |
| **Backend** | Handle edge cases: duplicate email on create → 409; delete of the only admin account → 400. Implement `resolveCompany` middleware and wire it into aggregations/heatmap routes. | A duplicate-email POST returns 409 with `{ error: "Email already exists" }`. Attempting to delete the last admin returns 400 with `{ error: "Cannot delete the only admin account" }`. Each edge case has its own test with a name following [§11.1](#111-naming-conventions). | Do not fix or suggest changes. POST `/api/admin/users` with duplicate email — check 409 with exact message `Email already exists`. Delete the only admin — check 400 with exact message `Cannot delete the only admin account`. Open `admin.test.js` — check both edge cases have `it()` blocks starting with `should `. Report PASS or FAIL and what is missing. |
| **Frontend** | Implement `UsersPage` with full CRUD (create with role select, edit role/company, reset password, delete). Implement `ViewAsCompanySelect` in `Navbar` visible only to admins. | The full user lifecycle works end-to-end in the browser. `ViewAsCompanySelect` is only rendered when `user.role === 'admin'`. Selecting a company in the dropdown updates `FiltersContext.viewAsCompany`. | Do not fix or suggest changes. Log in as viewer — check `ViewAsCompanySelect` is absent from Navbar. Log in as admin — check it is visible. Select a company — check `FiltersContext.viewAsCompany` updates (verify via React DevTools). Report PASS or FAIL and what is missing. |

>
> 1. DB — In psql, run:
>    INSERT INTO users (email,password_hash,company_id,role) VALUES ('x@x.com','hash','nonexistent','viewer');
>    Check: a foreign-key constraint error is raised (not a silent insert).
>    Run: DELETE FROM companies WHERE company_id = '<seed-company-id>';
>    Check: SELECT COUNT(*) FROM users WHERE company_id = '<seed-company-id>' returns 0 (users were cascaded).
>
> 2. Backend — POST /api/admin/users with a duplicate email.
>    Check: response is HTTP 409 with body { "error": "Email already exists" } (exact message).
>    Identify the only admin user in the DB and send DELETE /api/admin/users/:id for that user.
>    Check: response is HTTP 400 with body { "error": "Cannot delete the only admin account" }.
>    Open admin.test.js — check: both edge cases have dedicated it() blocks with names following the "should <verb> when <condition>" pattern.
>
> 3. Frontend — Log in as a viewer and inspect the Navbar.
>    Check: ViewAsCompanySelect is NOT rendered (no select/dropdown for company switching).
>    Log in as an admin — check: ViewAsCompanySelect IS visible in the Navbar.
>    Select a different company in the dropdown — check: the FiltersContext value viewAsCompany is updated (verify via React DevTools or a console.log in context).
>
> Do not comment on code style, naming, or anything not listed above.
> ```

##### Team B — Aggregated Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Test aggregations query performance with 1 000+ events. Add a comment in `agg_daily` DDL with the recommended `REFRESH` command. | `EXPLAIN ANALYZE` on the aggregations query with 1 000 events shows execution time < 100 ms. The materialized view DDL in the migration file includes a comment `-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY agg_daily`. | Do not fix or suggest changes. Seed 1000 events and `EXPLAIN ANALYZE` the aggregations query — check Execution Time < 100ms. Open the `agg_daily` DDL migration — check a comment contains `REFRESH MATERIALIZED VIEW CONCURRENTLY agg_daily`. Report PASS or FAIL and what is missing. |
| **Backend** | Add validation for all query params (date format, `driver_id` existence). Implement `GET /api/events` paginated list. | An invalid date string returns 400 with `"Invalid date format. Use YYYY-MM-DD"`. `/api/events?limit=10` returns paginated results with a `total` field. All new endpoints have tests following [§11.1](#111-naming-conventions). | Do not fix or suggest changes. `GET /api/aggregations?start_date=01-13-2024&end_date=2024-12-31` — check 400 with message containing `YYYY-MM-DD`. `GET /api/events?limit=10` — check body has `total` field and `events` array with 10 or fewer items. Open `events.test.js` — check `it()` names follow `should <verb> when <condition>` per §11.1. Report PASS or FAIL and what is missing. |
| **Frontend** | Add loading and error states to all data components. Implement `ViolationsSummary`, `ExportCsvButton`, `ScoreGauge`. Wire `MapZoomTracker` to update `FiltersContext` on map move/zoom. | All components show a spinner while loading and an error message on failure. Clicking "Export CSV" triggers a file download. Moving the map fires a new `/api/heatmap` request (verify in Network tab). | Do not fix or suggest changes. On Slow 3G open `/aggregated` — check a visible loading indicator appears. Disconnect network and reload — check error message is shown (not blank screen). Open Network tab and move the map — check a new `/api/heatmap` request fires. Click Export CSV — check file download begins. Report PASS or FAIL and what is missing. |

>
> 1. DB — Seed 1 000 events and run EXPLAIN ANALYZE on the aggregations query.
>    Check: "Execution Time" in the output is below 100ms.
>    Open the migration file containing the agg_daily CREATE MATERIALIZED VIEW statement.
>    Check: a SQL comment exists containing "REFRESH MATERIALIZED VIEW CONCURRENTLY agg_daily".
>
> 2. Backend — Send GET /api/aggregations?start_date=01-13-2024&end_date=2024-12-31 (wrong format).
>    Check: response is HTTP 400 and body contains the exact string "YYYY-MM-DD".
>    Send GET /api/events?limit=10 — check: body has a "total" numeric field and an "events" array with ≤ 10 items.
>    Open events.test.js — check: test names follow "should <verb> when <condition>" as defined in §11.1.
>
> 3. Frontend — Throttle the network to "Slow 3G" in DevTools and navigate to /aggregated.
>    Check: a visible loading indicator (spinner or skeleton) appears before data loads.
>    Disconnect the network and reload — check: an error message (not a blank screen or uncaught exception) is displayed.
>    Open the Network tab, move the Leaflet map, and check: a new request to /api/heatmap is fired.
>    Click "Export CSV" — check: a file download begins.
>
> Do not comment on code style, naming, or anything not listed above.
> ```

##### Team C — Single-Drive Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Verify `drive_routes` cache is populated for all seeded drives. Test query with a route of 500+ GPS points. | `SELECT point_count FROM drive_routes` returns a row for every drive UUID in `drives`. The single-drive query with a 500-point route returns within 200 ms. | Do not fix or suggest changes. LEFT JOIN drives with drive_routes — check no NULL in cached column. Seed a 500-point drive and run the single-drive query — check response time < 200ms. Report PASS or FAIL and what is missing. |
| **Backend** | Fall back to `drives.route_geom` if no `drive_routes` entry exists. Paginate `/api/drives` properly: out-of-range `offset` returns empty array + correct `total`. | A drive UUID with no `drive_routes` entry still returns a valid route in the response. `GET /api/drives?limit=10&offset=9999` returns `{ drives: [], total: <actual-count> }`. Edge cases have tests. | Do not fix or suggest changes. Delete a row from `drive_routes` and call `GET /api/drives/:that-uuid` — check 200 with valid non-null `route`. `GET /api/drives?limit=10&offset=9999` — check `drives: []` and `total` equals actual DB count. Open `drives.test.js` — check both edge cases have test coverage. Report PASS or FAIL and what is missing. |
| **Frontend** | Implement `ClusterLayer` for map zoom < 12 (markers cluster into groups). Add drive-level `MetricsGrid` showing score, distance, duration. Add loading/error states. | At zoom < 12, individual markers are replaced by cluster icons. Switching drives clears the previous route before rendering the new one (no ghost routes). Loading state shown while drive data fetches. | Do not fix or suggest changes. Zoom map to level 11 — check individual markers are replaced by cluster icons with count badges. Zoom above 12 — check individual markers reappear. Select drive A then drive B — check drive A polyline disappears before drive B appears (no two routes simultaneously). Report PASS or FAIL and what is missing. |

>
> 1. DB — Run: SELECT d.drive_uuid, dr.drive_uuid AS cached FROM drives d LEFT JOIN drive_routes dr ON d.drive_uuid = dr.drive_uuid;
>    Check: no row has NULL in the "cached" column (every drive has a cache entry).
>    Seed a drive with 500 points and run the single-drive query — check: response time is under 200ms.
>
> 2. Backend — Delete a row from drive_routes and call GET /api/drives/:that-uuid.
>    Check: response is still HTTP 200 and includes a valid non-null "route" object.
>    Send GET /api/drives?limit=10&offset=9999.
>    Check: response is HTTP 200 with "drives": [] and "total" equal to the actual count in the DB.
>    Open drives.test.js — check: both edge cases have test coverage.
>
> 3. Frontend — In the browser, zoom the map out to zoom level 11 or lower.
>    Check: individual event markers are replaced by cluster icons (showing a count badge).
>    Zoom back in past level 12 — check: individual markers reappear.
>    Select a drive, then select a different drive.
>    Check: the first drive's route polyline is gone before the second one appears (no two routes simultaneously).
>
> Do not comment on code style, naming, or anything not listed above.
> ```

---

#### Week 6 — Testing & Integration

Goal: each team achieves >80 % backend test coverage, all tests follow the naming convention from [§11.1](#111-naming-conventions), and cross-team integration is verified end-to-end.

##### Team A — Admin Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Finalize `migrations/001_initial.sql` covering all Admin tables. Verify it runs clean and is idempotent. | Running `psql -f migrations/001_initial.sql` on a blank DB creates all tables. Uses `CREATE TABLE IF NOT EXISTS` so running twice raises no error. | Do not fix or suggest changes. On a blank DB run `psql -f migrations/001_initial.sql` — check no error. Run it again — check still no error (idempotent). `\dt` — check all Admin tables are present. Report PASS or FAIL and what is missing. |
| **Backend** | Achieve >80 % coverage on `admin.test.js`. Add a cross-team integration test verifying `?view_as=` scopes data correctly in the aggregations route. | `npm test -- --coverage` shows ≥ 80 % for files under `routers/admin.js`. A test in `integrations/view_as.test.js` confirms an admin token with `?view_as=other-co` returns `other-co` data, not `test-co` data. All test names follow [§11.1](#111-naming-conventions). | Do not fix or suggest changes. `npm test -- --coverage --testPathPattern=admin` — check coverage >= 80%. Confirm `integrations/view_as.test.js` exists and passes. Open both test files — check every `it()` starts with `should ` per §11.1. Report PASS or FAIL and what is missing. |
| **Frontend** | Write React Testing Library tests for `CompaniesPage`, `UsersPage`, and `AdminRoute`. | Each test file covers: renders without error, loading state, error state, and one user interaction (e.g., opens modal). `AdminRoute` test confirms non-admin is redirected. Test file names follow `<Component>.test.jsx` convention from [§11.1](#111-naming-conventions). | Do not fix or suggest changes. `npm test -- --testPathPattern=Admin` — check all pass with no skipped blocks. Open `CompaniesPage.test.jsx` — check tests for loading and error states exist. `AdminRoute.test.jsx` — check a test asserts redirect for non-admin. Check all files named `<Component>.test.jsx` per §11.1. Report PASS or FAIL and what is missing. |

>
> 1. DB — On a freshly created empty database, run:
>    psql -U <user> -d <empty_db> -f migrations/001_initial.sql
>    Check: command completes with no errors.
>    Run the same command again — check: still no errors (idempotent).
>    Run \dt and check: companies, users, and any other Admin tables are present.
>
> 2. Backend — Run: npm test -- --coverage --testPathPattern=admin
>    Check: the coverage summary shows ≥ 80% for admin.js (lines or statements).
>    Open integrations/view_as.test.js — check: the file exists and contains at least one test.
>    Run that test file — check: it passes.
>    Open admin.test.js and integrations/view_as.test.js — check: every it() block starts with "should " per §11.1.
>
> 3. Frontend — Run: npm test -- --testPathPattern=Admin
>    Check: all tests pass with no skipped (xit/xtest) blocks.
>    Open CompaniesPage.test.jsx — check: it contains tests for loading state and error state (not just happy path).
>    Open AdminRoute.test.jsx — check: there is a test that renders with a non-admin user and asserts a redirect occurs.
>    Check: test file is named <ComponentName>.test.jsx (per §11.1).
>
> Do not comment on code style, naming, or anything not listed above.
> ```

##### Team B — Aggregated Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Run `ANALYZE` on `safety_events` and `agg_daily`. Load-test with 10 000 events and verify the aggregation query still completes in < 200 ms. | `EXPLAIN ANALYZE` with 10 000 rows shows execution time < 200 ms. `ANALYZE` runs without errors on both tables. | Do not fix or suggest changes. Seed 10000 events and `EXPLAIN ANALYZE` aggregations query — check Execution Time < 200ms. `ANALYZE safety_events; ANALYZE agg_daily;` — check both complete without error. Report PASS or FAIL and what is missing. |
| **Backend** | Achieve >80 % coverage on `aggregations.test.js` and `heatmap.test.js`. Add a tenant-isolation test confirming `test-co` data never appears in `other-co` responses. | `npm test -- --coverage` shows ≥ 80 % for aggregations and heatmap route files. A test explicitly seeds `test-co` and `other-co` events and asserts the API never leaks across companies. All test names follow [§11.1](#111-naming-conventions). | Do not fix or suggest changes. `npm test -- --coverage --testPathPattern=aggregations` — check coverage >= 80% for aggregations and heatmap files. Open `aggregations.test.js` — check a test seeds two companies and asserts response for A contains zero rows from B. Check every `it()` starts with `should ` per §11.1. Report PASS or FAIL and what is missing. |
| **Frontend** | Write component tests for `MetricsGrid`, `FiltersPanel`, and `ViolationsSummary`. | Each component has a test for: renders without error, renders with mock data, and handles empty/null data gracefully. Test file names follow `<Component>.test.jsx` from [§11.1](#111-naming-conventions). | Do not fix or suggest changes. `npm test -- --testPathPattern=MetricsGrid` — check all pass with no skipped blocks. Open `MetricsGrid.test.jsx` — check a test passes `null` or `undefined` data without throwing. Check all files named `<Component>.test.jsx` per §11.1. Report PASS or FAIL and what is missing. |

>
> 1. DB — Seed 10 000 events for company "test-co" and run EXPLAIN ANALYZE on the aggregations query.
>    Check: "Execution Time" is below 200ms.
>    Run: ANALYZE safety_events; ANALYZE agg_daily; — check: both complete without error.
>
> 2. Backend — Run: npm test -- --coverage --testPathPattern="aggregations|heatmap"
>    Check: coverage for both files is ≥ 80%.
>    Open aggregations.test.js — find the tenant-isolation test.
>    Check: the test seeds events for two different companies and asserts the response for company A contains zero events from company B.
>    Check: every it() block in both test files starts with "should " per §11.1.
>
> 3. Frontend — Run: npm test -- --testPathPattern="MetricsGrid|FiltersPanel|ViolationsSummary"
>    Check: all tests pass with no skipped blocks.
>    Open MetricsGrid.test.jsx — check: it contains a test case where the mock data is null or undefined, and the component does not throw.
>    Check: all three test files are named <ComponentName>.test.jsx per §11.1.
>
> Do not comment on code style, naming, or anything not listed above.
> ```

##### Team C — Single-Drive Page

| Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|
| **DB** | Run `ANALYZE` on `drives` and `drive_routes`. Verify GIST index is used for any bounding-box spatial query. | `EXPLAIN ANALYZE SELECT * FROM drive_routes WHERE ST_Intersects(route_geom, ST_MakeEnvelope(...))` shows a GIST index scan. `ANALYZE` completes without errors. | Do not fix or suggest changes. `EXPLAIN ANALYZE` with ST_Intersects on drive_routes — check plan shows GIST index scan. `ANALYZE drives; ANALYZE drive_routes;` — check no error. Report PASS or FAIL and what is missing. |
| **Backend** | Achieve >80 % coverage on `drives.test.js`. Tests cover: first page, last page, empty result, invalid UUID, missing `drive_routes` fallback. | `npm test -- --coverage` shows ≥ 80 % for drives route file. All five scenarios have dedicated tests. All test names follow [§11.1](#111-naming-conventions). | Do not fix or suggest changes. `npm test -- --coverage --testPathPattern=drives` — check coverage >= 80%. Open `drives.test.js` — check separate `it()` blocks exist for: first page, last page, empty result, invalid UUID, and missing `drive_routes` fallback. Check every `it()` starts with `should ` per §11.1. Report PASS or FAIL and what is missing. |
| **Frontend** | Write component tests for `TripSummaryPage`, `DriveSelector`, and `RouteLayer`. | `DriveSelector` test verifies one API call on mount. `RouteLayer` test renders with mock GeoJSON and asserts a `<Polyline>` element appears. Tests use `<Component>.test.jsx` naming from [§11.1](#111-naming-conventions). | Do not fix or suggest changes. `npm test -- --testPathPattern=TripSummary` — check all pass. `DriveSelector.test.jsx` — check a test asserts the API is called once on mount. `RouteLayer.test.jsx` — check a test passes mock GeoJSON and asserts a path element renders. Check all files named `<Component>.test.jsx` per §11.1. Report PASS or FAIL and what is missing. |

>
> 1. DB — Run:
>    EXPLAIN ANALYZE SELECT * FROM drive_routes WHERE ST_Intersects(route_geom, ST_MakeEnvelope(34.7,32.0,34.9,32.2,4326)::geography);
>    Check: the plan contains a GIST index scan (not a sequential scan).
>    Run: ANALYZE drives; ANALYZE drive_routes; — check: both complete without error.
>
> 2. Backend — Run: npm test -- --coverage --testPathPattern=drives
>    Check: coverage for the drives route file is ≥ 80%.
>    Open drives.test.js — check: there are separate it() blocks for each of these scenarios:
>      - first page (offset 0)
>      - last page (offset near total count)
>      - empty result (offset beyond total)
>      - invalid UUID format
>      - drive UUID with no drive_routes entry (fallback test)
>    Check: every it() block starts with "should " per §11.1.
>
> 3. Frontend — Run: npm test -- --testPathPattern="TripSummary|DriveSelector|RouteLayer"
>    Check: all tests pass.
>    Open DriveSelector.test.jsx — check: a test asserts that the API is called exactly once on initial render (not on every re-render).
>    Open RouteLayer.test.jsx — check: a test passes mock GeoJSON LineString data and asserts a map path element is rendered.
>    Check: all test files are named <ComponentName>.test.jsx per §11.1.
>
> Do not comment on code style, naming, or anything not listed above.
> ```

---

#### Weeks 7–8 — Real-World Deployment

All teams work together under senior supervision.

| Week | Role | Task | Definition of Done | **Prompt** |
|---|---|---|---|---|
| **Week 7** | All DB devs | Run ETL migration from legacy DynamoDB ([§13](#13-migration-from-legacy-system)) into `safety_events`. Verify row counts match. | `SELECT COUNT(*) FROM safety_events` matches the total event count across all 33 DynamoDB tables. No NULL `event_type` values. | Do not fix or suggest changes. `SELECT COUNT(*) FROM safety_events` — check count matches total events across all 33 DynamoDB tables. `SELECT COUNT(*) FROM safety_events WHERE event_type IS NULL` — check returns 0. Report PASS or FAIL and what is missing. |
| **Week 7** | All Backend devs | Deploy backend to staging. Run smoke tests against staging DB. | All `/api/*` routes return expected status codes against staging data. No 500 errors in logs. | Do not fix or suggest changes. Call each `/api/*` route against the staging server — check no 500 errors in responses or server logs. Report PASS or FAIL and what is missing. |
| **Week 7** | All Frontend devs | Deploy frontend to staging. Run UAT with pilot fleet managers. | Pilot users can log in, view aggregated data, and replay a drive without errors. No console errors during normal use. | Do not fix or suggest changes. Log in as a pilot fleet manager on staging. Navigate to the aggregated view, apply date filters, and replay a drive — check no console errors or blank screens at any step. Report PASS or FAIL and what is missing. |
| **Week 8** | All devs | Production cutover. Decommission legacy system. Retrospective. | AWS credentials removed from all code ([§13](#13-migration-from-legacy-system)). `mendi_credentials.csv` deleted and added to `.gitignore`. On-call rotation documented. Retrospective notes committed to repo. | Do not fix or suggest changes. `grep -r aws-sdk frontend/src/` — check empty output. `grep -r AccessKeyId .` — check empty output. Check `.gitignore` contains `.env` and `mendi_credentials.csv`. `npm test` in `backend/` — check all tests pass. Report PASS or FAIL and what is missing. |



### 16.3 Responsibility Matrix

| Layer | Team A — Admin | Team B — Aggregated | Team C — Single-Drive |
|---|---|---|---|
| **DB** | `users`, `companies` tables + indexes | Aggregations CTE query, `agg_daily` materialized view | `drives`, `drive_routes` + GIST indexes |
| **Backend** | `/api/admin/*`, `requireRole`, `resolveCompany` middleware | `/api/aggregations`, `/api/heatmap`, `/api/lookups` | `/api/drives`, `/api/drives/:id`, `/api/events` |
| **Frontend** | `AdminLayout`, `CompaniesPage`, `UsersPage`, `ViewAsCompanySelect` | `AggregatedPage`, `FiltersPanel`, `HeatmapLayer`, `MetricsGrid` | `TripSummaryPage`, `RouteLayer`, `PointLayer`, `ClusterLayer` |

### 16.4 Success Criteria for the Program

- All three pages deployed to production by end of week 8
- Test coverage targets met per [§15 Success Metrics](#15-success-metrics)
- Every junior dev has shipped to production at every layer of their team's stack
- No AWS credentials remain in the frontend bundle ([§13](#13-migration-from-legacy-system))

---

*VComm — Diversitech Fleet Safety Platform*
