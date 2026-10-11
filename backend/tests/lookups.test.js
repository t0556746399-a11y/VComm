// ─────────────────────────────────────────────
// tests/lookups.test.js — drivers / vehicles dropdowns
// Reference: README §8.5
// ─────────────────────────────────────────────

// TODO: describe('GET /api/drivers', () => {
// TODO:   it('should return drivers scoped to the caller company', ...);
// TODO:   it('should return 401 when token is missing', ...);
// TODO: });

// TODO: describe('GET /api/vehicles', () => {
// TODO:   it('should return vehicles scoped to the caller company', ...);
// TODO:   it('should return 401 when token is missing', ...);
// TODO: });

const request = require('supertest');
const express = require('express');
const lookupsRouter = require('../src/routers/lookups');
const db = require('../src/db');

jest.mock('../src/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/middleware/auth', () => ({
  auth: (req, res, next) => {
    req.user = global.__mockUser || { role: 'user', companyId: 123 };
    next();
  }
}));

jest.mock('../src/middleware/resolveCompany', () => ({
  resolveCompany: (req, res, next) => {
    req.resolvedCompanyId = req.user.companyId;
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api', lookupsRouter);

beforeEach(() => {
  jest.clearAllMocks();
  global.__mockUser = { role: 'user', companyId: 123 };
});

describe('Lookups API Integrations', () => {

  describe('GET /api/drivers', () => {

    it('should return 200 and drivers list for the company', async () => {
      db.query.mockResolvedValue({
        rows: [{ driver_id: 'D1', display_name: 'D1' }]
      });

      const res = await request(app).get('/api/drivers');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ driver_id: 'D1', display_name: 'D1' }]);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE company_id = $1'),
        [123]
      );
    });

    it('should handle database errors with 500', async () => {
      db.query.mockRejectedValue(new Error('DB Error'));

      const res = await request(app).get('/api/drivers');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/vehicles', () => {

    it('should return 200 and vehicles list for the company', async () => {
      db.query.mockResolvedValue({
        rows: [{ vehicle_id: 'V1', plate: 'V1' }]
      });

      const res = await request(app).get('/api/vehicles');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ vehicle_id: 'V1', plate: 'V1' }]);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE company_id = $1'),
        [123]
      );
    });
  });

  describe('View As (Admin functionality)', () => {

    it('should return 403 if non-admin tries to use view_as', async () => {
      global.__mockUser = { role: 'user', companyId: 123 };

      const res = await request(app).get('/api/drivers?view_as=999');

      expect(res.status).toBe(403);
    });

    it('should allow admin to use view_as', async () => {
      global.__mockUser = { role: 'admin', companyId: 1 };

      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/drivers?view_as=999');

      expect(res.status).toBe(200);

      expect(db.query).toHaveBeenCalledWith(
        expect.anything(),
        ['999']
      );
    });
  });

});