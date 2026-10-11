const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { resolveCompany } = require('../middleware/resolveCompany');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

const schema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  driver_id: z.string().optional().or(z.literal('')),
  vehicle_ids: z.string().optional()
});

const handler = async (req, res) => {
  try {
    const { start_date, end_date, driver_id, vehicle_ids } = req.query;
    const companyId = req.resolvedCompanyId;
    
    // מוודא שאם נשלח ערך ריק או לא תקין, הוא יועבר כ-null ולא יכשיל את ה-Casting ב-DB
    const cleanDriverId = (driver_id && driver_id.trim() !== '' && driver_id !== 'undefined') ? driver_id : null;
    
    // טיפול במערך הרכבים
    let vehicleIdsArray = null;
    if (vehicle_ids && vehicle_ids.trim() !== '' && vehicle_ids !== 'undefined') {
      vehicleIdsArray = vehicle_ids.split(',').map(id => id.trim()).filter(id => id !== '');
      if (vehicleIdsArray.length === 0) vehicleIdsArray = null;
    }

    const sqlPath = path.join(__dirname, '../queries/aggregations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const result = await db.query(sql, [
      companyId,
      start_date,
      end_date,
      cleanDriverId,
      vehicleIdsArray
    ]);

    const row = result.rows[0];
    if (!row) {
      return res.json({
        totals: {},
        violations_summary: {},
        time_windows: {}
      });
    }

    const totalViolations = Object.values(row.violations_by_type || {}).reduce((sum, count) => sum + Number(count), 0);

    const responseData = {
      totals: {
        total_drives: Number(row.total_drives || 0),
        active_drivers: Number(row.active_drivers || 0),
        total_violations: totalViolations,
        total_distance_km: Number(row.total_distance_km || 0),
        total_duration_s: Number(row.total_duration_s || 0),
        avg_speed_kmh: Number(row.avg_speed_kmh || 0),
        avg_score: Number(row.avg_score || 0),
        min_score: Number(row.min_score || 0),
        max_score: Number(row.max_score || 0),
        std_score: Number(row.std_score || 0),
        most_dangerous_driver: row.most_dangerous_driver
      },
      violations_summary: row.violations_by_type || {},
      time_windows: {}
    };

    return res.json(responseData);

  } catch (error) {
    console.error("Error in aggregations handler:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

router.get('/aggregations', resolveCompany, validate(schema, 'query'), handler);
module.exports = router;