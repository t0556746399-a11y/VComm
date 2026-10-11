const cron = require('node-cron');
const { findDueSubscriptions, markAsSent, recordRetry } = require('../services/reportService');
const { generateReportPDF } = require('../services/pdfService');
const { sendEmailWithAttachment } = require('../services/emailService');

let scheduledJob = null;

function calculateBackoffDelay(retryCount) {
  const baseSeconds = Math.pow(2, retryCount + 1);
  const maxSeconds = 300;
  return Math.min(baseSeconds, maxSeconds) * 1000;
}

async function processReport(subscription) {
  try {
    const pdfBuffer = await generateReportPDF({ company_id: subscription.company_id });
    await sendEmailWithAttachment({
      to: subscription.recipient_email,
      subject: `VComm Safety Report for ${subscription.company_id}`,
      text: 'Attached is your automated safety report.',
      pdfBuffer,
    });
    await markAsSent(subscription.id);
  } catch (err) {
    const retryCount = subscription.retry_count || 0;
    const nextRetryCount = Math.min(retryCount + 1, 3);
    let backoffDelay = calculateBackoffDelay(retryCount);

    if (retryCount >= 3) {
      backoffDelay = 24 * 60 * 60 * 1000;
    }

    try {
      await recordRetry(subscription.id, err.message || String(err), nextRetryCount, backoffDelay);
    } catch (recordError) {
      console.error('Failed to record retry state:', recordError);
    }
    throw err;
  }
}

function startReportScheduler() {
  if (scheduledJob) {
    return scheduledJob;
  }

  scheduledJob = cron.schedule('* * * * *', async () => {
    try {
      const subscriptions = await findDueSubscriptions();
      for (const subscription of subscriptions) {
        processReport(subscription).catch((err) => {
          console.error(`Failed to process subscription ${subscription.id}:`, err);
        });
      }
    } catch (err) {
      console.error('Report scheduler error:', err);
    }
  });

  return scheduledJob;
}

function stopReportScheduler() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
  }
}

module.exports = {
  startReportScheduler,
  stopReportScheduler,
  processReport,
};
