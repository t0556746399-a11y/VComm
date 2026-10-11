// ─────────────────────────────────────────────
// tests/integrations/view_as.test.js — cross-team integration
// Reference: README §14.2 (view_as) and §16 Week 6 (Team A Backend DOD)
//
// Verifies that an admin token with ?view_as=other-co returns other-co data,
// not test-co data — and that non-admin tokens are rejected with 403.
// ─────────────────────────────────────────────

const request = require('supertest');
const express = require('express');

jest.mock('../../src/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
  auth: (req, res, next) => next(),
}));

jest.mock('../../src/middleware/resolveCompany', () => ({
  resolveCompany: (req, res, next) => {
    req.resolvedCompanyId = req.user.companyId;
    next();
  },
}));

const router = require('../../src/routers/lookups');
const db = require('../../src/db');

const app = express();
app.use(express.json());

// מידלוור שמדמה משתמש לפי תפקיד לצורך הבדיקה
let currentUser = { role: 'admin', companyId: 'real-co' };

app.use((req, res, next) => {
  req.user = currentUser;
  next();
});

app.use('/api', router);

describe('view_as — admin impersonation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return other-co aggregations when admin passes view_as=other-co', async () => {
    currentUser = { role: 'admin', companyId: 'real-co' };

    db.query.mockResolvedValue({
      rows: [{ data: 'sensitive-data' }],
    });

    const res = await request(app).get('/api/drivers?view_as=other-co');

    expect(res.status).toBe(200);

    // מוודא שהפנייה לבסיס הנתונים נעשתה עם החברה המיוצגת (other-co)
    expect(db.query).toHaveBeenCalledWith(expect.anything(), ['other-co']);
  });

  it('should reject view_as with 403 when caller is a viewer', async () => {
    currentUser = { role: 'viewer', companyId: 'real-co' };

    const res = await request(app).get('/api/drivers?view_as=other-co');

    expect(res.status).toBe(403);
  });

  it('should reject view_as with 403 when caller is a manager', async () => {
    currentUser = { role: 'manager', companyId: 'real-co' };

    const res = await request(app).get('/api/drivers?view_as=other-co');

    expect(res.status).toBe(403);
  });
});