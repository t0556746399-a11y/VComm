const puppeteer = require('puppeteer');
const db = require('../db');

const POOL_SIZE = 2;
const MAX_QUEUE = 20;

class BrowserPool {
  constructor(size = POOL_SIZE) {
    this.size = size;
    this.browsers = [];
    this.activeCount = 0;
    this.queue = [];
    this.initializing = false;
  }

  async initialize() {
    if (this.initializing || this.browsers.length > 0) return;
    this.initializing = true;

    try {
      for (let i = 0; i < this.size; i += 1) {
        const browser = await puppeteer.launch({ headless: 'new' });
        this.browsers.push(browser);
      }
    } finally {
      this.initializing = false;
    }
  }

  async acquire() {
    if (this.browsers.length > 0) {
      this.activeCount += 1;
      return this.browsers.pop();
    }

    if (this.queue.length >= MAX_QUEUE) {
      throw new Error(`Browser pool queue full (max ${MAX_QUEUE})`);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, timestamp: Date.now() });
    });
  }

  release(browser) {
    this.activeCount -= 1;

    if (this.queue.length > 0) {
      const { resolve } = this.queue.shift();
      this.activeCount += 1;
      resolve(browser);
      return;
    }

    this.browsers.push(browser);
  }

  async shutdown() {
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (err) {
        console.error('Failed to close browser:', err);
      }
    }
    this.browsers = [];
    this.activeCount = 0;
    this.queue = [];
  }
}

const browserPool = new BrowserPool();
let browserPoolInitialized = false;

async function ensureBrowserPool() {
  if (!browserPoolInitialized) {
    await browserPool.initialize();
    browserPoolInitialized = true;
  }
}

async function fetchCompanySafetyData(companyId, startDate, endDate) {
  const start = startDate || '1970-01-01T00:00:00Z';
  const end = endDate || new Date().toISOString();

  const companyRes = await db.query('SELECT name FROM companies WHERE company_id = $1', [companyId]);
  const company_name = companyRes.rows[0]?.name || companyId;
  const company_logo_url = null;

  const drivesRes = await db.query(
    `SELECT COUNT(*)::int AS total_drives FROM drives WHERE company_id = $1 AND started_at BETWEEN $2 AND $3`,
    [companyId, start, end]
  );
  const total_drives = drivesRes.rows[0]?.total_drives || 0;

  const violationsRes = await db.query(
    `SELECT COUNT(*)::int AS total_violations FROM safety_events WHERE company_id = $1 AND event_ts BETWEEN $2 AND $3`,
    [companyId, start, end]
  );
  const total_violations = violationsRes.rows[0]?.total_violations || 0;

  const byTypeRes = await db.query(
    `SELECT event_type, COUNT(*)::int AS count FROM safety_events WHERE company_id = $1 AND event_ts BETWEEN $2 AND $3 GROUP BY event_type ORDER BY count DESC`,
    [companyId, start, end]
  );
  const violations = byTypeRes.rows.map((row) => ({ type: row.event_type, count: row.count }));

  const driverRes = await db.query(
    `SELECT d.driver_id,
            COUNT(DISTINCT d.drive_uuid)::int AS drive_count,
            COUNT(se.event_id)::int AS violation_count,
            CASE
              WHEN COUNT(DISTINCT d.drive_uuid) = 0 THEN 100
              ELSE GREATEST(0, ROUND(100 - COUNT(se.event_id)::numeric / COUNT(DISTINCT d.drive_uuid) * 100))
            END AS score
     FROM drives d
     LEFT JOIN safety_events se
       ON se.drive_uuid = d.drive_uuid
       AND se.event_ts BETWEEN $2 AND $3
     WHERE d.company_id = $1
       AND d.started_at BETWEEN $2 AND $3
     GROUP BY d.driver_id
     ORDER BY score ASC, violation_count DESC
     LIMIT 5`,
    [companyId, start, end]
  );

  const worst_drivers = driverRes.rows.map((row) => ({
    driver_id: row.driver_id,
    drives: row.drive_count,
    violations: row.violation_count,
    score: Number(row.score),
  }));

  let avg_score = 100;
  if (total_drives > 0) {
    avg_score = Math.max(0, Math.round(100 - (total_violations / total_drives) * 100));
  }

  const report_date = new Date().toISOString();
  const logo = company_name
    .split(' ')
    .map((word) => word[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    company_name,
    company_logo: logo,
    company_logo_url,
    report_date,
    period: `${start} to ${end}`,
    avg_score,
    total_violations,
    total_drives,
    violations,
    worst_drivers,
  };
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildReportHTML(data) {
  const violationsRows = data.violations.length
    ? data.violations.map((violation) => `<tr><td>${escapeHtml(violation.type)}</td><td style="text-align:right">${violation.count}</td></tr>`).join('')
    : `<tr><td colspan="2">No violations</td></tr>`;

  const driversRows = data.worst_drivers.length
    ? data.worst_drivers.map((driver) =>
        `<tr><td>${escapeHtml(driver.driver_id)}</td><td style="text-align:right">${driver.score}</td><td style="text-align:right">${driver.drives}</td><td style="text-align:right">${driver.violations}</td></tr>`
      ).join('')
    : `<tr><td colspan="4">No drivers found for this period</td></tr>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Safety Report — ${escapeHtml(data.company_name)}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; margin: 36px; color: #222; }
      .header { display:flex; align-items:center; gap:16px; }
      .logo { width:64px; height:64px; background:#0b74de; color:#fff; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; font-weight:700; }
      .logo-img { width:64px; height:64px; object-fit:cover; border-radius:8px; }
      h1 { margin:0; font-size:20px; }
      .meta { margin-top:8px; color:#555; }
      .card { margin-top:20px; padding:16px; border:1px solid #eee; border-radius:6px; }
      table { width:100%; border-collapse:collapse; margin-top:12px; }
      th, td { border:1px solid #ddd; padding:8px; }
      th { background:#f7f7f7; text-align:left; }
    </style>
  </head>
  <body>
    <div class="header">
      ${data.company_logo_url ? `<img src="${escapeHtml(data.company_logo_url)}" class="logo-img" alt="${escapeHtml(data.company_name)} logo"/>` : `<div class="logo">${escapeHtml(data.company_logo)}</div>`}
      <div>
        <h1>${escapeHtml(data.company_name)}</h1>
        <div class="meta">Report date: ${escapeHtml(formatDate(data.report_date))}</div>
        <div class="meta">Report period: ${escapeHtml(data.period)}</div>
      </div>
    </div>

    <div class="card">
      <h2>Summary</h2>
      <p>Safety Score: <strong>${data.avg_score}</strong></p>
      <p>Total Drives: <strong>${data.total_drives}</strong></p>
      <p>Total Violations: <strong>${data.total_violations}</strong></p>
    </div>

    <div class="card">
      <h2>Violations by Type</h2>
      <table>
        <thead>
          <tr><th>Type</th><th>Count</th></tr>
        </thead>
        <tbody>
          ${violationsRows}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Lowest Safety Scores</h2>
      <table>
        <thead>
          <tr><th>Driver ID</th><th style="text-align:right">Score</th><th style="text-align:right">Drives</th><th style="text-align:right">Violations</th></tr>
        </thead>
        <tbody>
          ${driversRows}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
}

async function generateReportPDF({ company_id, start_date, end_date }) {
  const companyId = company_id;
  const startDate = start_date;
  const endDate = end_date;

  const data = await fetchCompanySafetyData(companyId, startDate, endDate);
  const html = buildReportHTML(data);

  await ensureBrowserPool();

  const browser = await browserPool.acquire();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    return pdfBuffer;
  } finally {
    browserPool.release(browser);
  }
}

async function shutdownBrowserPool() {
  await browserPool.shutdown();
}

module.exports = {
  generateReportPDF,
  shutdownBrowserPool,
};
