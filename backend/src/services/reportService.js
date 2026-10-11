const { query, getClient } = require('../db');
const parser = require('cron-parser');

const DEFAULT_LOCK_DURATION_MINUTES = 15;

async function findDueSubscriptions() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const selectSql = `
      SELECT * FROM report_subscriptions
      WHERE is_active = TRUE
        AND (locked_until IS NULL OR locked_until < NOW())
      FOR UPDATE SKIP LOCKED
    `;

    const result = await client.query(selectSql);
    const now = new Date();
    const due = [];

    for (const row of result.rows) {
      try {
        const tz = row.timezone || 'UTC';
        const interval = parser.parseExpression(row.cron_expression, { currentDate: now, tz });
        const previous = interval.prev().toDate();

        const lastSent = row.last_sent_at ? new Date(row.last_sent_at) : null;
        if (!lastSent || lastSent < previous) {
          const lockMinutes = row.lock_duration_minutes || DEFAULT_LOCK_DURATION_MINUTES;
          await client.query(
            `UPDATE report_subscriptions SET locked_until = NOW() + ($1 || ' minutes')::interval WHERE id = $2`,
            [lockMinutes, row.id]
          );
          due.push(row);
        }
      } catch (err) {
        console.error(`Disabling subscription ${row.id} due to cron parse error:`, err.message);
        await client.query(
          `UPDATE report_subscriptions SET is_active = FALSE, last_error = $1 WHERE id = $2`,
          [err.message, row.id]
        );
      }
    }

    await client.query('COMMIT');
    return due;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function listSubscriptions(company_id) {
  if (!company_id) {
    throw new Error('Missing company_id');
  }

  const result = await query(
    `SELECT id, company_id, recipient_email, cron_expression, report_type, timezone, lock_duration_minutes, last_sent_at, is_active, last_error, retry_count, created_at
     FROM report_subscriptions
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [company_id]
  );
  return result.rows;
}

async function getSubscriptionById(id) {
  const result = await query('SELECT * FROM report_subscriptions WHERE id = $1', [id]);
  return result.rows[0];
}

async function markAsSent(subscriptionId) {
  const sql = `
    UPDATE report_subscriptions
    SET last_sent_at = NOW(), locked_until = NULL, retry_count = 0, last_error = NULL
    WHERE id = $1
  `;
  await query(sql, [subscriptionId]);
}

async function recordRetry(subscriptionId, errorMessage, nextRetryCount, backoffDelayMs) {
  const backoffSeconds = Math.ceil(backoffDelayMs / 1000);
  const sql = `
    UPDATE report_subscriptions
    SET retry_count = $1,
        last_error = $2,
        locked_until = NOW() + ($3 || ' seconds')::interval
    WHERE id = $4
  `;
  await query(sql, [nextRetryCount, errorMessage, backoffSeconds, subscriptionId]);
}

async function createSubscription(company_id, recipient_email, cron_expression, report_type, timezone = 'UTC', lock_duration_minutes = 15) {
  const sql = `
    INSERT INTO report_subscriptions (
      company_id,
      recipient_email,
      cron_expression,
      report_type,
      timezone,
      lock_duration_minutes,
      is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
    RETURNING id, company_id, recipient_email, cron_expression, report_type, timezone, lock_duration_minutes, last_sent_at, is_active, created_at, last_error, retry_count
  `;
  const result = await query(sql, [company_id, recipient_email, cron_expression, report_type, timezone, lock_duration_minutes]);
  return result.rows[0];
}

async function deleteSubscription(id) {
  await query('DELETE FROM report_subscriptions WHERE id = $1', [id]);
}

module.exports = {
  findDueSubscriptions,
  listSubscriptions,
  getSubscriptionById,
  markAsSent,
  recordRetry,
  createSubscription,
  deleteSubscription,
};
