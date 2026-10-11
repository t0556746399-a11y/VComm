const express = require('express');
const { z } = require('zod');
const parser = require('cron-parser');
const {
  listSubscriptions,
  findDueSubscriptions,
  getSubscriptionById,
  createSubscription,
  deleteSubscription,
} = require('../services/reportService');
const { processReport } = require('../modules/reportScheduler');
const { verifyCompanyOwnership } = require('../middleware/verifyCompanyOwnership');
const { validate } = require('../middleware/validate');

const router = express.Router();

function validateCron(expression) {
  try {
    parser.CronExpressionParser.parse(expression, { currentDate: new Date(), tz: 'UTC' });
    return true;
  } catch (err) {
    return false;
  }
}

const PRESET_CRONS = {
  weekly: '0 8 * * 0',
  monthly: '0 0 1 * *',
};

const subscriptionSchema = z.object({
  recipient_email: z.string().email(),
  cron_expression: z.string().optional(),
  report_type: z.enum(['weekly', 'monthly', 'custom']),
  timezone: z.string().optional(),
  lock_duration_minutes: z.number().int().positive().optional(),
});

router.get('/subscriptions', verifyCompanyOwnership, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      console.warn('Missing company access in reports route', {
        path: req.path,
        user: req.user,
      });
      return res.status(403).json({ error: 'Missing company access' });
    }

    const subscriptions = await listSubscriptions(companyId);
    res.json({ success: true, data: subscriptions });
  } catch (error) {
    console.error('List subscriptions failed:', {
      path: req.path,
      user: req.user,
      companyId: req.companyId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to load subscriptions' });
  }
});

router.post('/subscriptions', verifyCompanyOwnership, validate(subscriptionSchema), async (req, res) => {
  try {
    const data = req.validated;
    // Prevent accidental creation of demo/test recipient rows from the UI
    if (data.recipient_email && data.recipient_email.toLowerCase() === 'test@example.com') {
      console.warn('Blocked creation of subscription for test@example.com', { user: req.user, companyId: req.companyId });
      return res.status(400).json({ error: 'Invalid recipient email' });
    }
    const cronExpression = data.report_type === 'custom'
      ? (data.cron_expression?.trim() || '')
      : PRESET_CRONS[data.report_type];

    if (!cronExpression) {
      return res.status(400).json({ error: 'Cron expression is required for custom reports' });
    }

    if (!validateCron(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    const subscription = await createSubscription(
      req.companyId,
      data.recipient_email,
      cronExpression,
      data.report_type,
      data.timezone,
      data.lock_duration_minutes
    );
    res.status(201).json({ success: true, data: subscription });
  } catch (error) {
    console.error('Create subscription failed:', {
      path: req.path,
      user: req.user,
      body: req.body,
      companyId: req.companyId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

router.delete('/subscriptions/:id', verifyCompanyOwnership, async (req, res) => {
  try {
    await deleteSubscription(req.params.id);
    res.json({ success: true, message: 'Subscription deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/subscriptions/:id/send-now', verifyCompanyOwnership, async (req, res) => {
  try {
    const subscription = await getSubscriptionById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    if (subscription.company_id !== req.companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // Run send in background so the UI doesn't receive a 500 when PDF/email generation fails.
    // Errors are logged and the subscription retry logic will handle retries.
    processReport(subscription).catch((err) => {
      console.error(`send-now: failed to process subscription ${subscription.id}:`, err && err.message ? err.message : err);
    });

    res.json({ success: true, message: 'Report queued for sending' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/due', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const reports = await findDueSubscriptions();
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
