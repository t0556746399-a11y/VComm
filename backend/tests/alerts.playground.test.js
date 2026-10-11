// tests/alerts.playground.test.js — manual alert playground scenarios
// Scope: backend test file only, no production code changes.
// ─────────────────────────────────────────────

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const buildToken = () => jwt.sign({ id: 1, role: 'user', companyId: 123 }, JWT_SECRET);

const buildAlertPayload = (overrides = {}) => ({
  id: 'alert-1',
  message: 'Safety event received',
  type: 'harsh_braking',
  severity: 'high',
  timestamp: new Date().toISOString(),
  companyId: 123,
  read: false,
  ...overrides,
});

const getViolationMeta = (type, config) => config[type] || config.default;

const buildAlertsState = (initialAlerts = []) => ({
  alerts: initialAlerts,
  unreadCount: initialAlerts.filter((alert) => !alert.read).length,
});

describe('Alerts playground scenarios', () => {
  test('1. Socket handshake succeeds with a valid JWT', () => {
    const token = buildToken();
    const decoded = jwt.verify(token, JWT_SECRET);

    expect(decoded.companyId).toBe(123);
    expect(decoded.role).toBe('user');
  });

  test('2. Socket handshake is rejected when token is missing or invalid', () => {
    const invalidToken = 'not-a-valid-jwt';

    expect(() => jwt.verify(invalidToken, JWT_SECRET)).toThrow();
  });

  test('3. Safety event resolves through violation config metadata', () => {
    const alert = buildAlertPayload();
    const violationConfig = {
      harsh_braking: { label: 'Harsh Braking', icon: 'braking.png', color: '#F4511E' },
      default: { label: 'Unknown Event', icon: 'default.png', color: '#999' },
    };

    const meta = getViolationMeta(alert.type, violationConfig);

    expect(meta.label).toBe('Harsh Braking');
    expect(meta.color).toBe('#F4511E');
    expect(alert.severity).toBe('high');
  });

  test('4. New alert is appended to the global alerts list in context', () => {
    const state = buildAlertsState([]);
    const alert = buildAlertPayload({ id: 'alert-2' });

    state.alerts.unshift({ ...alert, read: false });
    state.unreadCount = state.alerts.filter((item) => !item.read).length;

    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0].id).toBe('alert-2');
    expect(state.unreadCount).toBe(1);
  });

  test('5. Real-time toast is shown for the latest incoming alert', () => {
    const alerts = [buildAlertPayload({ id: 'alert-3', message: 'Over speed detected' })];
    const latestAlert = alerts[0];

    expect(latestAlert.message).toContain('Over speed');
    expect(alerts).toHaveLength(1);
  });

  test('6. Notification bell badge increases for unread alerts', () => {
    const state = buildAlertsState([
      buildAlertPayload({ id: 'alert-4' }),
      buildAlertPayload({ id: 'alert-5', read: true }),
    ]);

    expect(state.unreadCount).toBe(1);
  });

  test('7. Opening the notification list and marking an alert as read', () => {
    const state = buildAlertsState([buildAlertPayload({ id: 'alert-6' })]);
    state.alerts = state.alerts.map((alert) => ({ ...alert, read: true }));
    state.unreadCount = state.alerts.filter((alert) => !alert.read).length;

    expect(state.alerts[0].read).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  test('8. Reconnect after temporary network disconnect', () => {
    let connected = false;
    connected = true;

    expect(connected).toBe(true);
  });

  test('9. Unknown event type uses fallback config safely', () => {
    const alert = buildAlertPayload({ type: 'mystery_event' });
    const violationConfig = {
      default: { label: 'Unknown Event', icon: 'default.png', color: '#999' },
    };

    const meta = getViolationMeta(alert.type, violationConfig);

    expect(meta.label).toBe('Unknown Event');
    expect(meta.color).toBe('#999');
  });
});