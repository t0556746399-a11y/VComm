// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const fs = require('fs');
// const path = require('path');
// const { auth } = require('../middleware/auth');
// const { resolveCompany } = require('../middleware/resolveCompany');

// // ---------- helpers ----------

// const loadQuery = (file) => {
//     const filePath = path.join(__dirname, '../queries', file);
//     return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
// };

// // ---------- inline SQL ----------

// const LIST_DRIVES_SQL = `
//     SELECT drive_uuid, driver_id, vehicle_id, started_at, ended_at
//     FROM drives
//     WHERE company_id = $1
//         AND ($2::text IS NULL OR driver_id = $2)
//         AND ($3::timestamptz IS NULL OR started_at >= $3)
//         AND ($4::timestamptz IS NULL OR started_at <= $4)
//     ORDER BY started_at DESC
//     LIMIT $5 OFFSET $6
// `;

// const COUNT_DRIVES_SQL = `
//     SELECT COUNT(*) AS total
//     FROM drives
//     WHERE company_id = $1
//         AND ($2::text IS NULL OR driver_id = $2)
//         AND ($3::timestamptz IS NULL OR started_at >= $3)
//         AND ($4::timestamptz IS NULL OR started_at <= $4)
// `;

// const GET_DRIVE_SQL = `
//     SELECT d.drive_uuid,
//         d.driver_id,
//         d.vehicle_id,
//         d.started_at,
//         d.ended_at,
//         ST_AsGeoJSON(COALESCE(dr.route_geom, d.route_geom))::json AS route
//     FROM drives d
//     LEFT JOIN drive_routes dr ON dr.drive_uuid = d.drive_uuid
//     WHERE d.company_id = $1
//         AND d.drive_uuid = $2
// `;

// const GET_DRIVE_EVENTS_SQL = `
//     SELECT event_id,
//         event_type,
//         driver_id,
//         vehicle_id,
//         drive_uuid,
//         ST_Y(geom::geometry) AS lat,
//         ST_X(geom::geometry) AS lng,
//         event_ts
//     FROM safety_events
//     WHERE company_id = $1
//         AND drive_uuid = $2
//     ORDER BY event_ts ASC
// `;

// const DRIVER_RANKING_SQL = `
//     WITH driver_base AS (
//         SELECT
//             driver_id,
//             COUNT(drive_uuid) AS total_drives,
//             COALESCE(AVG(score), 0) AS avg_score
//         FROM drives
//         WHERE company_id = $1
//           AND ($2::timestamptz IS NULL OR started_at >= $2)
//           AND ($3::timestamptz IS NULL OR started_at <= $3)
//         GROUP BY driver_id
//     ),
//     driver_violations AS (
//         SELECT
//             se.driver_id,
//             COUNT(*) AS total_violations
//         FROM safety_events se
//         WHERE se.company_id = $1
//           AND ($2::timestamptz IS NULL OR se.event_ts >= $2)
//           AND ($3::timestamptz IS NULL OR se.event_ts <= $3)
//         GROUP BY se.driver_id
//     ),
//     ranked_drivers AS (
//         SELECT
//             b.driver_id,
//             b.total_drives,
//             ROUND(b.avg_score::numeric, 2)::float AS avg_score,
//             COALESCE(v.total_violations, 0)::int AS total_violations,
//             ROUND((COALESCE(v.total_violations, 0) * (100 - b.avg_score))::numeric, 2)::float AS risk_index,
//             COUNT(*) OVER() AS total_count
//         FROM driver_base b
//         LEFT JOIN driver_violations v ON b.driver_id = v.driver_id
//     )
//     SELECT * FROM ranked_drivers
//     ORDER BY
//         CASE WHEN $4 = 'score_asc'       THEN avg_score        END ASC,
//         CASE WHEN $4 = 'score_desc'      THEN avg_score        END DESC,
//         CASE WHEN $4 = 'violations_desc' THEN total_violations  END DESC,
//         CASE WHEN $4 = 'risk_desc'       THEN risk_index        END DESC,
//         avg_score DESC
//     LIMIT $5 OFFSET $6
// `;

// // ---------- routes ----------

// // 1. Heatmap — משתמש בקובץ SQL חיצוני
// router.get('/heatmap', auth, async (req, res, next) => {
//     try {
//         const {
//             company_id, start_date, end_date, event_types,
//             west, south, east, north, cell_lng, cell_lat,
//         } = req.query;

//         const query = loadQuery('heatmap.sql');
//         if (!query) return res.status(500).json({ error: 'heatmap.sql not found' });

//         const result = await db.query(query, [
//             company_id, start_date, end_date, event_types,
//             west, south, east, north, cell_lng, cell_lat,
//         ]);
//         res.json(result.rows);
//     } catch (err) { next(err); }
// });

// // 2. דירוג נהגים — חייב להיות לפני /:drive_uuid
// router.get('/ranking', auth, async (req, res, next) => {
//     try {
//         const companyId = req.user?.companyId;
//         const {
//             start_date, end_date,
//             sort_by = 'score_desc',
//             limit = '10', offset = '0',
//         } = req.query;

//         const limitInt  = Math.min(100, Math.max(1, parseInt(limit,  10) || 10));
//         const offsetInt = Math.max(0,            parseInt(offset, 10) || 0);

//         const result = await db.query(DRIVER_RANKING_SQL, [
//             companyId,
//             start_date || null,
//             end_date   || null,
//             sort_by,
//             limitInt,
//             offsetInt,
//         ]);

//         const total   = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
//         const drivers = result.rows.map(({ total_count, ...rest }) => rest);

//         res.json({ drivers, total });
//     } catch (err) { next(err); }
// });

// // 3. רשימת נסיעות — pagination אמיתי עם count
// router.get('/', auth, resolveCompany, async (req, res, next) => {
//     try {
//         const companyId = req.resolvedCompanyId ?? req.user?.companyId;
//         const {
//             driver_id, start_date, end_date,
//             limit = '20', offset = '0',
//         } = req.query;

//         const limitInt  = Math.min(100, Math.max(1, parseInt(limit,  10) || 20));
//         const offsetInt = Math.max(0,            parseInt(offset, 10) || 0);

//         const params = [companyId, driver_id || null, start_date || null, end_date || null];

//         const [drivesResult, countResult] = await Promise.all([
//             db.query(LIST_DRIVES_SQL,  [...params, limitInt, offsetInt]),
//             db.query(COUNT_DRIVES_SQL, params),
//         ]);

//         res.json({
//             drives: drivesResult.rows,
//             total:  Number(countResult.rows[0]?.total ?? 0),
//         });
//     } catch (err) { next(err); }
// });

// // 4. נסיעה בודדת + אירועים
// router.get('/:drive_uuid', auth, resolveCompany, async (req, res, next) => {
//     try {
//         const { drive_uuid } = req.params;
//         const companyId = req.resolvedCompanyId ?? req.user?.companyId;

//         if (!/^[0-9a-fA-F-]{36}$/.test(drive_uuid)) {
//             return res.status(400).json({ error: 'Invalid drive UUID' });
//         }

//         const driveResult = await db.query(GET_DRIVE_SQL, [companyId, drive_uuid]);
//         if (driveResult.rows.length === 0) {
//             return res.status(404).json({ error: 'Drive not found' });
//         }

//         const eventsResult = await db.query(GET_DRIVE_EVENTS_SQL, [companyId, drive_uuid]);
//         const drive = driveResult.rows[0];
//         drive.events = eventsResult.rows;

//         // fallback: בנה route מאירועים אם ה-DB לא מחזיר route
//         if (!drive.route && eventsResult.rows.length > 0) {
//             drive.route = {
//                 type: 'LineString',
//                 coordinates: eventsResult.rows.map(e => [parseFloat(e.lng), parseFloat(e.lat)]),
//             };
//         }

//         res.json(drive);
//     } catch (err) { next(err); }
// });

// module.exports = router;

// ─────────────────────────────────────────────
// routers/drives.js — unified version (heatmap + drives + ranking + single drive)
// ─────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

const { auth } = require('../middleware/auth');
const { resolveCompany } = require('../middleware/resolveCompany');

// ---------- helpers ----------

const loadQuery = (file) => {
    const filePath = path.join(__dirname, '../queries', file);
    return fs.existsSync(filePath)
        ? fs.readFileSync(filePath, 'utf8')
        : null;
};

// ---------- SQL ----------

const LIST_DRIVES_SQL = `
    SELECT drive_uuid, driver_id, vehicle_id, started_at, ended_at
    FROM drives
    WHERE company_id = $1
      AND ($2::text IS NULL OR driver_id = $2)
      AND ($3::timestamptz IS NULL OR started_at >= $3)
      AND ($4::timestamptz IS NULL OR started_at <= $4)
    ORDER BY started_at DESC
    LIMIT $5 OFFSET $6
`;

const COUNT_DRIVES_SQL = `
    SELECT COUNT(*) AS total
    FROM drives
    WHERE company_id = $1
      AND ($2::text IS NULL OR driver_id = $2)
      AND ($3::timestamptz IS NULL OR started_at >= $3)
      AND ($4::timestamptz IS NULL OR started_at <= $4)
`;

const GET_DRIVE_SQL = `
    SELECT d.drive_uuid,
           d.driver_id,
           d.vehicle_id,
           d.started_at,
           d.ended_at,
           ST_AsGeoJSON(COALESCE(dr.route_geom, d.route_geom))::json AS route
    FROM drives d
    LEFT JOIN drive_routes dr ON dr.drive_uuid = d.drive_uuid
    WHERE d.company_id = $1
      AND d.drive_uuid = $2
`;

const GET_DRIVE_EVENTS_SQL = `
    SELECT event_id,
           event_type,
           driver_id,
           vehicle_id,
           drive_uuid,
           ST_Y(geom::geometry) AS lat,
           ST_X(geom::geometry) AS lng,
           event_ts
    FROM safety_events
    WHERE company_id = $1
      AND drive_uuid = $2
    ORDER BY event_ts ASC
`;

const DRIVER_RANKING_SQL = `
    WITH driver_base AS (
        SELECT driver_id,
               COUNT(drive_uuid) AS total_drives,
               COALESCE(AVG(score), 0) AS avg_score
        FROM drives
        WHERE company_id = $1
          AND ($2::timestamptz IS NULL OR started_at >= $2)
          AND ($3::timestamptz IS NULL OR started_at <= $3)
        GROUP BY driver_id
    ),
    driver_violations AS (
        SELECT driver_id,
               COUNT(*) AS total_violations
        FROM safety_events
        WHERE company_id = $1
          AND ($2::timestamptz IS NULL OR event_ts >= $2)
          AND ($3::timestamptz IS NULL OR event_ts <= $3)
        GROUP BY driver_id
    ),
    ranked AS (
        SELECT b.driver_id,
               b.total_drives,
               ROUND(b.avg_score::numeric, 2)::float AS avg_score,
               COALESCE(v.total_violations, 0)::int AS total_violations,
               ROUND((COALESCE(v.total_violations, 0) * (100 - b.avg_score))::numeric, 2)::float AS risk_index,
               COUNT(*) OVER() AS total_count
        FROM driver_base b
        LEFT JOIN driver_violations v ON b.driver_id = v.driver_id
    )
    SELECT *
    FROM ranked
    ORDER BY
        CASE WHEN $4 = 'score_asc' THEN avg_score END ASC,
        CASE WHEN $4 = 'score_desc' THEN avg_score END DESC,
        CASE WHEN $4 = 'violations_desc' THEN total_violations END DESC,
        CASE WHEN $4 = 'risk_desc' THEN risk_index END DESC,
        avg_score DESC
    LIMIT $5 OFFSET $6
`;

// ---------- Heatmap ----------

router.get('/heatmap', auth, async (req, res, next) => {
    try {
        const {
            company_id,
            start_date,
            end_date,
            event_types,
            west, south, east, north,
            cell_lng, cell_lat
        } = req.query;

        const query = loadQuery('heatmap.sql');
        if (!query) {
            return res.status(500).json({ error: 'heatmap.sql not found' });
        }

        const result = await db.query(query, [
            company_id,
            start_date,
            end_date,
            event_types,
            west, south, east, north,
            cell_lng, cell_lat
        ]);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ---------- Ranking ----------

router.get('/ranking', auth, async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const {
            start_date,
            end_date,
            sort_by = 'score_desc',
            limit = 10,
            offset = 0
        } = req.query;

        const limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const offsetInt = Math.max(0, parseInt(offset, 10) || 0);

        const result = await db.query(DRIVER_RANKING_SQL, [
            companyId,
            start_date || null,
            end_date || null,
            sort_by,
            limitInt,
            offsetInt
        ]);

        const total = result.rows[0]?.total_count || 0;

        res.json({
            drivers: result.rows.map(({ total_count, ...rest }) => rest),
            total
        });
    } catch (err) {
        next(err);
    }
});

// ---------- List Drives ----------

router.get('/', auth, resolveCompany, async (req, res, next) => {
    try {
        const companyId = req.resolvedCompanyId ?? req.user?.companyId;

        const {
            driver_id,
            start_date,
            end_date,
            limit = 20,
            offset = 0
        } = req.query;

        const limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const offsetInt = Math.max(0, parseInt(offset, 10) || 0);

        const params = [
            companyId,
            driver_id || null,
            start_date || null,
            end_date || null
        ];

        const [drivesResult, countResult] = await Promise.all([
            db.query(LIST_DRIVES_SQL, [...params, limitInt, offsetInt]),
            db.query(COUNT_DRIVES_SQL, params)
        ]);

        res.json({
            drives: drivesResult.rows,
            total: Number(countResult.rows[0]?.total ?? 0)
        });
    } catch (err) {
        next(err);
    }
});

// ---------- Single Drive ----------

router.get('/:drive_uuid', auth, resolveCompany, async (req, res, next) => {
    try {
        const { drive_uuid } = req.params;
        const companyId = req.resolvedCompanyId ?? req.user?.companyId;

        const uuidRegex = /^[0-9a-fA-F-]{36}$/;
        if (!uuidRegex.test(drive_uuid)) {
            return res.status(400).json({ error: 'Invalid UUID format' });
        }

        const driveResult = await db.query(GET_DRIVE_SQL, [
            companyId,
            drive_uuid
        ]);

        if (!driveResult.rows.length) {
            return res.status(404).json({ error: 'Drive not found' });
        }

        const eventsResult = await db.query(GET_DRIVE_EVENTS_SQL, [
            companyId,
            drive_uuid
        ]);

        const drive = driveResult.rows[0];
        drive.events = eventsResult.rows;

        // fallback route אם אין מה-DB
        if (!drive.route && eventsResult.rows.length > 0) {
            drive.route = {
                type: 'LineString',
                coordinates: eventsResult.rows.map(e => [
                    parseFloat(e.lng),
                    parseFloat(e.lat)
                ])
            };
        }

        res.json(drive);
    } catch (err) {
        next(err);
    }
});

module.exports = router;