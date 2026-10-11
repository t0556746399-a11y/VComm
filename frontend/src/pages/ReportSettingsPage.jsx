import React, { useState, useEffect } from 'react';
import SubscriptionForm from '../components/SubscriptionForm';
import { fetchSubscriptions, deleteSubscription, sendReportNow, createSubscription } from '../api/reports';
import './ReportSettingsPage.css';

export default function ReportSettingsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [sending, setSending] = useState(null);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSubscriptions();
      setSubscriptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      const serverMessage = err.response?.data?.error || err.response?.data || err.message;
      setError(serverMessage || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubscription(payload) {
    try {
      await createSubscription(payload);
      await loadSubscriptions();
    } catch (err) {
      console.error('Failed to create subscription:', err);
      const serverMessage = err.response?.data?.error || err.message || 'Failed to create subscription';
      setError(serverMessage);
      throw err;
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this subscription?')) {
      return;
    }

    try {
      setDeleting(id);
      await deleteSubscription(id);
      await loadSubscriptions();
    } catch (err) {
      console.error('Failed to delete subscription:', err);
      setError(err.message || 'Failed to delete subscription');
    } finally {
      setDeleting(null);
    }
  }

  async function handleSendNow(id) {
    try {
      setSending(id);
      await sendReportNow(id);
      alert('Report sent successfully!');
    } catch (err) {
      console.error('Failed to send report:', err);
      alert(err.message || 'Failed to send report');
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="report-settings-page">
      <div className="page-header">
        <h1>מנויי דוחות</h1>
        <p>ניהול משלוחי הדוחות האוטומטיים</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>שגיאה:</strong> {error}
        </div>
      )}

      {/* Create New Subscription Form */}
      <SubscriptionForm onCreated={handleCreateSubscription} />

      {/* Existing Subscriptions */}
      <div className="subscriptions-list-container">
        <h2>מנויים פעילים</h2>

        {loading ? (
          <div className="loading">טוען מנויים...</div>
        ) : subscriptions.length === 0 ? (
          <div className="empty-state">
            <p>אין עדיין מנויים. צרי/צור מנוי חדש למעלה כדי להתחיל.</p>
          </div>
        ) : (
          <div className="subscriptions-grid">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="subscription-card">
                <div className="card-header">
                  <div className="card-title">
                    <span className="report-type-badge">{sub.report_type === 'weekly' ? 'שבועי' : sub.report_type === 'monthly' ? 'חודשי' : 'מותאם'}</span>
                    <strong>{sub.recipient_email}</strong>
                  </div>
                  <div className="card-status">
                    {sub.is_active ? (
                      <span className="status-active">פעיל</span>
                    ) : (
                      <span className="status-inactive">לא פעיל</span>
                    )}
                  </div>
                </div>

                <div className="card-content">
                  <div className="detail-row">
                    <span className="detail-label">לוח זמנים:</span>
                    <code>{sub.cron_expression}</code>
                  </div>

                  {sub.timezone && (
                    <div className="detail-row">
                      <span className="detail-label">אזור זמן:</span>
                      <span>{sub.timezone}</span>
                    </div>
                  )}

                  {sub.last_sent_at && (
                    <div className="detail-row">
                      <span className="detail-label">נשלח לאחרונה:</span>
                      <span>{new Date(sub.last_sent_at).toLocaleString()}</span>
                    </div>
                  )}

                  {sub.last_error && (
                    <div className="detail-row error-row">
                      <span className="detail-label">שגיאה אחרונה:</span>
                      <span className="error-text">{sub.last_error}</span>
                    </div>
                  )}

                  {sub.retry_count > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">ניסיונות:</span>
                      <span>{sub.retry_count}</span>
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  <button
                    onClick={() => handleSendNow(sub.id)}
                    disabled={sending === sub.id}
                    className="btn btn-primary"
                    title="שלח דוח עכשיו"
                  >
                    {sending === sub.id ? 'שולח...' : 'שלח עכשיו'}
                  </button>
                  <button
                    onClick={() => handleDelete(sub.id)}
                    disabled={deleting === sub.id}
                    className="btn btn-danger"
                    title="מחק מנוי"
                  >
                    {deleting === sub.id ? 'מוחק...' : 'מחק'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

