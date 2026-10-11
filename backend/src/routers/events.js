
const express = require('express');
const pool = require('../db');
const fs = require('fs');
const path = require('path');
const { LRUCache } = require('lru-cache');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use((req, res, next) => {
  next();
});

// 🌟 קאש שרתי חכם, מוגן זיכרון וחסין נפילות
const serverCache = new LRUCache({
  max: 1000,
  ttl: 60 * 1000, // דקה אחת
});


router.get('/map-events', async (req, res) => {
  try {
    // ---------- Validation: zoom ----------
    let zoom = parseInt(req.query.zoom);
    if (isNaN(zoom) || zoom < 0 || zoom > 18) zoom = 12;

    // ---------- Validation: bounds ----------
    let north = parseFloat(req.query.north);
    let south = parseFloat(req.query.south);
    const east = parseFloat(req.query.east);
    const west = parseFloat(req.query.west);

    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
      return res.status(200).json([]);
    }

    // Clamp latitude לטווח תקין
    north = Math.min(90, Math.max(-90, north));
    south = Math.min(90, Math.max(-90, south));

    // הגנה: north תמיד גדול או שווה ל-south
    if (north < south) {
      const temp = north;
      north = south;
      south = temp;
    }

    const eventType = req.query.event_type || '';
    const severity = req.query.severity || '';
    const polygonParam = req.query.polygon || '';

    // ---------- פירוק/נרמול הפוליגון (אם קיים) ----------
    let polygonPoints = null;
    if (polygonParam) {
      try {
        const parsed = JSON.parse(polygonParam);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          polygonPoints = parsed;
        }
      } catch (e) {
        console.error('Error parsing polygon param:', e);
      }
    }

    // ---------- נרמול הגבולות + הפוליגון כדי שמשתמשים באותו אזור יחלקו את אותו הקאש ----------
    const normalize = (num) => (Math.round(num / 0.05) * 0.05).toFixed(2);
    const cacheNorth = normalize(north);
    const cacheSouth = normalize(south);
    const cacheEast = normalize(east);
    const cacheWest = normalize(west);

    let polygonCacheKey = '';
    if (polygonPoints) {
      polygonCacheKey = polygonPoints
        .map((p) => `${normalize(p.lat)}:${normalize(p.lng)}`)
        .join('|');
    }

    const cacheKey = `${zoom}_${cacheNorth}_${cacheSouth}_${cacheEast}_${cacheWest}_${eventType}_${severity}_${polygonCacheKey}`;

    const cachedData = serverCache.get(cacheKey);
    if (cachedData) {
      console.log('⚡ [Server Cache Hit] הגנה מפני עומס: מריץ מהזיכרון וחוסך פנייה ל-PostgreSQL.');
      return res.json(cachedData);
    }

    // ---------- בניית השאילתה ----------
    let queryParams = [west, south, east, north];

    let envelopeSql = west <= east
      ? `geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)`
      : `(geom && ST_MakeEnvelope($1, $2, 180, $4, 4326) OR geom && ST_MakeEnvelope(-180, $2, $3, $4, 4326))`;

    let filterSql = '';

    if (eventType) {
      queryParams.push(eventType);
      filterSql += ` AND event_type = $${queryParams.length}`;
    }
    if (severity) {
      queryParams.push(severity);
      filterSql += ` AND severity = $${queryParams.length}`;
    }

    // ברירת המחדל: נקודת המרכז היא מרכז המסך (bbox)
    let centroidSql = `ST_Centroid(ST_MakeEnvelope($1, $2, $3, $4, 4326))`;

    // 🎯 אם יש פוליגון: לסנן רק את מה שבתוכו, ולהזיז את נקודת הייחוס למרכז הפוליגון
    if (polygonPoints) {
      const points = [...polygonPoints];
      const first = points[0];
      const last = points[points.length - 1];
      if (first.lat !== last.lat || first.lng !== last.lng) {
        points.push(first);
      }
      const wktPoints = points.map((p) => `${p.lng} ${p.lat}`).join(', ');
      const wktPolygon = `POLYGON((${wktPoints}))`;

      queryParams.push(wktPolygon);
      const polyParamIndex = queryParams.length;

      filterSql += ` AND ST_Contains(ST_GeomFromText($${polyParamIndex}, 4326), ST_SetSRID(geom::geometry, 4326))`;
      centroidSql = `ST_Centroid(ST_GeomFromText($${polyParamIndex}, 4326))`;
    }

    // ---------- Zoom-aware Strategy: grid size + limit (ללא שום שינוי בלוגיקה המקורית) ----------
    let gridSize = 0;
    let limit = 200;

    if (zoom <= 2) { gridSize = 8.0; limit = 50; }
    else if (zoom <= 5) { gridSize = 2.0; limit = 200; }
    else if (zoom <= 8) { gridSize = 0.5; limit = 300; }
    else if (zoom <= 10) { gridSize = 0.05; limit = 350; }
    else if (zoom === 11) { gridSize = 0.05; limit = 300; }
    else if (zoom === 12) { gridSize = 0.02; limit = 200; }
    else if (zoom === 13) { gridSize = 0.015; limit = 150; }
    else if (zoom === 14) { gridSize = 0.01; limit = 250; }
    else { gridSize = 0; limit = 250; }

    let query = '';

    if (gridSize > 0) {
      queryParams.push(gridSize);
      const gridParamIndex = queryParams.length;
      queryParams.push(limit);
      const limitParamIndex = queryParams.length;

      // באגרגציה (זום נמוך) - המיון הראשון הוא grid_cell כפי שפוסטגרס דורש
      query = `
        SELECT DISTINCT ON (grid_cell)
               event_id, event_type, severity, event_ts, lat, lng
        FROM (
          SELECT event_id, event_type, severity, event_ts,
                 ST_Y(geom::geometry) as lat,
                 ST_X(geom::geometry) as lng,
                 ST_SnapToGrid(geom::geometry, $${gridParamIndex}) as grid_cell,
                 geom::geometry as single_geom
          FROM safety_events
          WHERE ${envelopeSql}${filterSql}
        ) as subquery
        ORDER BY grid_cell,
                 single_geom <-> ${centroidSql} ASC,
                 CASE WHEN severity = 'High' THEN 1 WHEN severity = 'Medium' THEN 2 ELSE 3 END ASC,
                 event_ts DESC
        LIMIT $${limitParamIndex};
      `;
    } else {
      queryParams.push(limit);
      const limitParamIndex = queryParams.length;

      // ביצועים לזום גבוה: ללא DISTINCT ON (geom), המיון המרחבי משתמש באינדקס <->
      query = `
        SELECT event_id, drive_uuid, company_id, driver_id, event_type, severity, event_ts,
               ST_Y(geom::geometry) as lat,
               ST_X(geom::geometry) as lng
        FROM safety_events
        WHERE ${envelopeSql}${filterSql}
        ORDER BY geom::geometry <-> ${centroidSql} ASC,
                 CASE WHEN severity = 'High' THEN 1 WHEN severity = 'Medium' THEN 2 ELSE 3 END ASC,
                 event_ts DESC
        LIMIT $${limitParamIndex};
      `;
    }

    const result = await pool.query(query, queryParams);
    serverCache.set(cacheKey, result.rows);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching map events:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


router.post('/polygon', async (req, res) => {
  try {
    const { polygon_coordinates } = req.body;
    if (!polygon_coordinates || polygon_coordinates.length < 3) {
      return res.status(400).json({ success: false, error: 'יש לספק לפחות 3 נקודות עבור פוליגון תקין' });
    }

    const points = [...polygon_coordinates];
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    if (firstPoint.lat !== lastPoint.lat || firstPoint.lng !== lastPoint.lng) {
      points.push(firstPoint);
    }

    const wktCoords = points.map(p => `${p.lng} ${p.lat}`).join(', ');
    const wktPolygon = `POLYGON((${wktCoords}))`;
    console.log('Executing polygon query with WKT:', wktPolygon);

    const query = `SELECT event_id, event_type, severity, event_ts, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng FROM safety_events WHERE ST_Contains(ST_GeomFromText($1, 4326), ST_SetSRID(geom::geometry, 4326)) LIMIT 1000`;
    const result = await pool.query(query, [wktPolygon]);
    res.json({ success: true, events: result.rows });
  } catch (error) {
    console.error('Error fetching polygon events:', error);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// ===================================================================
// LEGACY ENDPOINT: GET /events - קורא שאילתה מקובץ SQL חיצוני
// ===================================================================
const queryPath = path.join(__dirname, '../queries/events.sql');
let queryText = '';
try {
  queryText = fs.readFileSync(queryPath, 'utf8');
} catch (fErr) {
  console.error('לא ניתן לקרוא את קובץ ה-SQL:', queryPath);
}

router.get('/events', async (req, res) => {
  console.log('🎯 הבקשה הגיעה בהצלחה לשרת! מפעילים את ה-try...');
  try {
    console.log('⚡ מריצים את השאילתה המלאה (כולל קואורדינטות) מול בסיס הנתונים...');
    const result = await pool.query(queryText);
    console.log(`✅ השאילתה הצליחה! חזרו ${result.rows.length} שורות.`);
    res.json({
      events: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    console.error('ERROR MESSAGE:', err.message);
    console.error('FULL ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===================================================================
// LEGACY ENDPOINT (auth-protected): GET / - רשימת אירועים עם פילטרים + pagination
// ===================================================================
router.get('/', auth, async (req, res) => {
  try {
    const { start_date, end_date, limit = 1000, offset = 0,
            event_type, severity_min, driver_id, vehicle_id } = req.query;

    const result = await pool.query(
     `SELECT
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
    LIMIT $8 OFFSET $9`,
      [
        req.user.companyId,
        start_date || '2000-01-01',
        end_date ? end_date + ' 23:59:59' : new Date().toISOString(),
        event_type ? event_type.split(',') : null,
        severity_min || null,
        driver_id || null,
        vehicle_id || null,
        parseInt(limit),
        parseInt(offset),
      ]
    );

    res.json({ events: result.rows, total: result.rows[0]?.total ?? 0 });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});
// פונקציות הגנה כדי למנוע מהשרת לקרוס
router.startCacheCleaner = function() {
    console.log("ℹ️ Cache cleaner started (placeholder)");
};

router.stopCacheCleaner = function() {
    console.log("ℹ️ Cache cleaner stopped (placeholder)");
};
module.exports = router;