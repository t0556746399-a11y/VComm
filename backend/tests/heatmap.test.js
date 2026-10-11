// ─────────────────────────────────────────────
// tests/heatmap.test.js — heatmap endpoint contract
// Reference: README §8.3 and router implementation in src/routers/heatmap.js
// ─────────────────────────────────────────────

const request = require('supertest');
const express = require('express');
const heatmapRouter = require('../src/routers/heatmap');
const db = require('../src/db');

jest.mock('../src/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/middleware/auth', () => ({
  auth: (req, res, next) => {
    if (global.__mockAuthFail) {
      return res.status(401).json({ error: 'Missing token' });
    }

    req.user = global.__mockUser || { role: 'viewer', companyId: 'test-co' };
    return next();
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/heatmap', heatmapRouter);

  app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
  global.__mockAuthFail = false;
  global.__mockUser = { role: 'viewer', companyId: 'test-co' };
});

describe('GET /api/heatmap', () => {
  it('should return heatmap rows for an authenticated request', async () => {
    const mockedRows = [{ lat: 31.78, lng: 34.99, weight: 2 }];
    db.query.mockResolvedValue({ rows: mockedRows });

    const response = await request(app)
      .get('/api/heatmap')
      .query({ driver_id: 'driver-1' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockedRows);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM safety_events'),
      ['driver-1']
    );
  });

  it('should reject unauthenticated requests before querying the database', async () => {
    global.__mockAuthFail = true;

    const response = await request(app)
      .get('/api/heatmap')
      .query({ driver_id: 'driver-1' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Missing token' });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('should return 500 when the database layer fails', async () => {
    db.query.mockRejectedValue(new Error('db unavailable'));

    const response = await request(app)
      .get('/api/heatmap')
      .query({ driver_id: 'driver-1' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
  });
});