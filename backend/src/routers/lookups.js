const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const { resolveCompany } = require('../middleware/resolveCompany');

// helper
function getCompanyId(req) {
  const viewAs = req.query.view_as;

  if (viewAs) {
    if (req.user?.role !== 'admin') {
      return null; // יסמן ל־403
    }
    return viewAs;
  }

  return req.resolvedCompanyId;
}

function handleCompany(req, res, next) {
  const companyId = getCompanyId(req);

  if (!req.user) {
    return res.status(401).send(); // חשוב לטסטים
  }

  if (companyId === null) {
    return res.status(403).send();
  }

  req.finalCompanyId = companyId;
  next();
}

// ---------------- DRIVERS ----------------
router.get('/drivers', auth, resolveCompany, handleCompany, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT driver_id, driver_id AS display_name
       FROM drives
       WHERE company_id = $1
       ORDER BY driver_id`,
      [req.finalCompanyId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).send();
  }
});

// ---------------- VEHICLES ----------------
router.get('/vehicles', auth, resolveCompany, handleCompany, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT vehicle_id, vehicle_id AS plate
       FROM drives
       WHERE company_id = $1
       ORDER BY vehicle_id`,
      [req.finalCompanyId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).send();
  }
});

module.exports = router;