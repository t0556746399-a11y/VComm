import parser from 'cron-parser';

export function validateCronExpression(expression) {
  try {
    parser.parseExpression(expression, { currentDate: new Date(), tz: 'UTC' });
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export function getNextRunTime(expression, timezone = 'UTC') {
  try {
    const interval = parser.parseExpression(expression, { currentDate: new Date(), tz: timezone });
    return { success: true, nextDate: interval.next().toDate() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function formatNextRunDate(date) {
  return date.toLocaleString();
}

export const PRESET_CRONS = {
  weekly: '0 8 * * 0',
  monthly: '0 0 1 * *',
};
