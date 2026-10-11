// ─────────────────────────────────────────────
// routers/heatmap.js — map heatmap cells (Team B)
// Reference: README §4.3, §8.3
//
// Endpoint:
//   GET /api/heatmap
//     ?start_date, ?end_date              (required ISO 8601)
//     ?south, ?west, ?north, ?east        (required — map bbox)
//     ?zoom                               (required — drives ST_SnapToGrid cell size)
//     ?event_types=stop_sign,over_speed   (optional comma-separated)
//     ?view_as=<company_id>               (optional, admin only)
//
// Returns: { cells: [{ lat, lng, weight }, ...] }
//
// Implementation notes:
//   - Use the PostGIS ST_MakeEnvelope + ST_Intersects + ST_SnapToGrid query
//     from queries/heatmap.sql.
//   - Derive $cell_lng / $cell_lat from `zoom` (smaller cells as zoom grows).
//   - Never return raw event points — only aggregated cells (README §6.3).
// ─────────────────────────────────────────────

// TODO: const router = require('express').Router();
// TODO: router.get('/heatmap', resolveCompany, validate(schema, 'query'), handler);
// TODO: module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res, next) => {
    try {
        // שליפת הנתונים
        const query = "SELECT ST_X(geom) as lng, ST_Y(geom) as lat FROM safety_events WHERE driver_id = $1";
        const { driver_id } = req.query; // הפרמטר שמגיע מה-Frontend
        const { rows } = await db.query(query, [driver_id]);

        res.json(rows); // החזרת המערך כ-JSON
    } catch (err) {
        next(err);
    }
});

module.exports = router;