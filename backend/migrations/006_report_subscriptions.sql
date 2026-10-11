CREATE TABLE IF NOT EXISTS report_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  report_type TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  lock_duration_minutes INTEGER NOT NULL DEFAULT 15,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  locked_until TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_subscriptions_company_id ON report_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_active_locked ON report_subscriptions (is_active, locked_until);
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_cron_expression ON report_subscriptions (cron_expression);
