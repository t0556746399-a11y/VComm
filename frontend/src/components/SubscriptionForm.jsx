import React, { useState, useEffect } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { validateCronExpression, getNextRunTime, formatNextRunDate, PRESET_CRONS } from '../utils/cronHelpers';
import './SubscriptionForm.css';

// Validation schema for subscription form (messages shown to the user are in Hebrew)
const validationSchema = Yup.object().shape({
  report_type: Yup.string()
    .required('חייב לבחור תדירות דוח')
    .oneOf(['weekly', 'monthly', 'custom'], 'סוג דוח לא חוקי'),
  recipient_email: Yup.string()
    .required('חובה להזין כתובת דוא"ל')
    .email('כתובת דוא"ל לא תקינה'),
  cron_expression: Yup.string().when('report_type', {
    is: 'custom',
    then: (schema) =>
      schema
        .required('חייב להזין ביטוי Cron עבור דוח מותאם')
        .test('valid-cron', 'ביטוי Cron לא תקין', function (value) {
          if (!value) return false;
          const result = validateCronExpression(value);
          return result.valid;
        }),
    otherwise: (schema) => schema.nullable(),
  }),
  timezone: Yup.string(),
});

export default function SubscriptionForm({ onCreated }) {
  const [cronError, setCronError] = useState(null);
  const [nextRunTime, setNextRunTime] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const initialValues = {
    report_type: 'weekly',
    recipient_email: '',
    cron_expression: PRESET_CRONS.weekly,
    timezone: 'UTC',
  };

  const handleReportTypeChange = (e, setFieldValue) => {
    const type = e.target.value;
    setFieldValue('report_type', type);

    // Set default cron expression based on type
    if (type === 'weekly') {
      setFieldValue('cron_expression', PRESET_CRONS.weekly);
    } else if (type === 'monthly') {
      setFieldValue('cron_expression', PRESET_CRONS.monthly);
    } else {
      // custom
      setFieldValue('cron_expression', '');
    }
  };

  const handleCronExpressionChange = (e, setFieldValue) => {
    const expr = e.target.value;
    setFieldValue('cron_expression', expr);
    setCronError(null);

    // Validate and preview next run time
    if (expr.trim()) {
      const validation = validateCronExpression(expr);
      if (!validation.valid) {
        setCronError(validation.error);
        setNextRunTime(null);
      } else {
        const result = getNextRunTime(expr, 'UTC');
        if (result.success) {
          setNextRunTime(result.nextDate);
        }
      }
    }
  };

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    setSubmitError(null);

    try {
      const payload = {
        report_type: values.report_type,
        recipient_email: values.recipient_email,
        cron_expression: values.cron_expression,
        timezone: values.timezone,
      };

      await onCreated(payload);
      resetForm();
      setNextRunTime(null);
      setCronError(null);
    } catch (error) {
      console.error('Failed to create subscription:', error);
      const message = error.response?.data?.error || error.message || 'Failed to create subscription';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="subscription-form-container">
      <h2>צור מנוי לדוח</h2>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ setFieldValue, values, errors, touched, isSubmitting }) => (
          <Form className="subscription-form">
            {/* Report Type / Frequency */}
            <div className="form-group">
              <label htmlFor="report_type">תדירות הדוח</label>
              <select
                id="report_type"
                name="report_type"
                value={values.report_type}
                onChange={(e) => handleReportTypeChange(e, setFieldValue)}
                className="form-input"
              >
                <option value="weekly">שבועי (בכל יום ראשון בשעה 08:00 UTC)</option>
                <option value="monthly">חודשי (בכל ראשון לחודש בשעה 00:00 UTC)</option>
                <option value="custom">מותאם (Cron)</option>
              </select>
              {errors.report_type && touched.report_type && (
                <div className="form-error">{errors.report_type}</div>
              )}
            </div>

            {/* Email Recipient */}
            <div className="form-group">
              <label htmlFor="recipient_email">כתובת דוא"ל</label>
              <input
                id="recipient_email"
                name="recipient_email"
                type="email"
                placeholder="manager@company.com"
                value={values.recipient_email}
                onChange={(e) => setFieldValue('recipient_email', e.target.value)}
                className="form-input"
              />
              {errors.recipient_email && touched.recipient_email && (
                <div className="form-error">{errors.recipient_email}</div>
              )}
            </div>

            {/* Timezone */}
            <div className="form-group">
              <label htmlFor="timezone">אזור זמן</label>
              <select
                id="timezone"
                name="timezone"
                value={values.timezone}
                onChange={(e) => setFieldValue('timezone', e.target.value)}
                className="form-input"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">אמריקה / ניו יורק (ET)</option>
                <option value="Europe/London">אירופה / לונדון (GMT)</option>
                <option value="Europe/Paris">אירופה / פריז (CET)</option>
                <option value="Asia/Jerusalem">אסיה / ירושלים (IST)</option>
                <option value="Asia/Tokyo">אסיה / טוקיו (JST)</option>
                <option value="Australia/Sydney">אוסטרליה / סידני (AEST)</option>
              </select>
              {errors.timezone && touched.timezone && (
                <div className="form-error">{errors.timezone}</div>
              )}
            </div>

            {/* Custom Cron Expression */}
            {values.report_type === 'custom' && (
              <div className="form-group">
                <label htmlFor="cron_expression">
                  ביטוי Cron
                  <span className="help-text">
                    פורמט: דקה שעה יום חודש יום_בשבוע (0-6, כאשר 0=ראשון)
                    <br />
                    דוגמה: 0 8 * * 0 = כל יום ראשון בשעה 08:00
                  </span>
                </label>
                <input
                  id="cron_expression"
                  name="cron_expression"
                  type="text"
                  placeholder="0 8 * * 0"
                  value={values.cron_expression}
                  onChange={(e) => handleCronExpressionChange(e, setFieldValue)}
                  className="form-input"
                />
                {cronError && (
                  <div className="form-error">{cronError}</div>
                )}
                {errors.cron_expression && touched.cron_expression && (
                  <div className="form-error">{errors.cron_expression}</div>
                )}
              </div>
            )}

            {/* Next Run Time Preview */}
            {nextRunTime && (
              <div className="next-run-preview">
                <strong>הדוח הבא יישלח:</strong>
                <div className="next-run-time">{formatNextRunDate(nextRunTime)}</div>
              </div>
            )}

            {values.report_type === 'custom' && values.cron_expression && !nextRunTime && !cronError && (
              <div className="next-run-info">
                <small>Note: Exact next run time will be calculated on the server</small>
              </div>
            )}

            {/* Submit Button */}
            {submitError && (
              <div className="form-error submit-error">
                {submitError}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="submit-button"
            >
              {isSubmitting ? 'שולח...' : 'צור מנוי'}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
}

