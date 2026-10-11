const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  host: config.POSTGRES_HOST,
  port: config.POSTGRES_PORT,
  database: config.POSTGRES_DB,
  user: config.POSTGRES_USER,
  password: config.POSTGRES_PASSWORD,
  max: config.POSTGRES_MAX_CONNECTIONS,
  idleTimeoutMillis: 30000,

  // התיקון כאן: מאחר והשרת מרוחק, אנחנו מחזירים את דרישת ה-SSL לפעולה
  ssl: {
    rejectUnauthorized: false
  }
});
// בדיקת חיבור אופציונלית בזמן עליית השרת
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = {

  query: async (text, params) => {
    const start = Date.now();

    const cleanText = text.replace(/\u00A0/g, ' ');

    const result = await pool.query(cleanText, params);

    const duration = Date.now() - start;

    if (duration > 200) {
      console.warn(
        `⚠️ Slow query detected (${duration}ms): ${cleanText}`
      );
    }

    return result;
  },

  getClient: async () => {
    return await pool.connect();
  },

  end: async () => {
    await pool.end();
  },
  pool,
};