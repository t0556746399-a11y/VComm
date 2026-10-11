const db = require('./db');

const pool = db.pool || db;

async function startAlertsListener(notifyCallback) {
  let client;
  try {
    client = await pool.connect();
    await client.query('LISTEN new_safety_event');
    console.log("Listening for new safety events on Postgres...");

    client.on('notification', async (msg) => {
      try {
        const payload = JSON.parse(msg.payload);
        if (payload.severity === 'high') {
          console.log("New high severity alert!", payload);

          if (typeof notifyCallback === 'function') {
            notifyCallback(payload);
          } else {
            console.error("notifyCallback is not a function!");
          }
        }
      } catch (e) {
        console.error("Error parsing alert payload:", e);
      }
    });

    client.on('error', (err) => {
      console.error('Alerts listener client error:', err);
      // ננסה להתחבר מחדש אחרי קצת
      setTimeout(() => startAlertsListener(notifyCallback), 5000);
    });

  } catch (err) {
    console.error("Failed to connect to Postgres:", err);
    // Retry after 5 seconds
    setTimeout(() => startAlertsListener(notifyCallback), 5000);
  }
}

module.exports = { startAlertsListener };