const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/config');

// ─── helpers ───────────────────────────────

const makeToken = (payload = {}) =>
  jwt.sign(
    {
      companyId: 'comp1',
      role: 'admin',
      ...payload,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

const authHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

// ─── test data ─────────────────────────────

let VALID_UUID;

const INVALID_UUID = 'not-a-uuid';
const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

beforeAll(async () => {
  // ensure company exists
  await db.query(
    `
      INSERT INTO companies (company_id, name)
      VALUES ($1,$2)
      ON CONFLICT (company_id) DO NOTHING
    `,
    ['comp1', 'Test Company']
  );

  // try to get existing drive
  const token = makeToken();

  const list = await request(app)
    .get('/api/drives?limit=1&offset=0')
    .set(authHeader(token));

  VALID_UUID = list.body?.drives?.[0]?.drive_uuid;

  // create fallback drive if DB is empty
  if (!VALID_UUID) {
    VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    await db.query(
      `
      INSERT INTO drives (
        drive_uuid,
        started_at,
        company_id,
        driver_id,
        vehicle_id
      )
      VALUES ($1,NOW(),$2,$3,$4)
      ON CONFLICT (drive_uuid) DO NOTHING
      `,
      [
        VALID_UUID,
        'comp1',
        'driver1',
        'vehicle1',
      ]
    );
  }
});


// ───────────────────────────────────────────
// GET /api/drives
// ───────────────────────────────────────────

describe('GET /api/drives', () => {

  it('should return first page with total count', async () => {
    const res = await request(app)
      .get('/api/drives?limit=10&offset=0')
      .set(authHeader(makeToken()));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.drives)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });


  it('should return empty array when offset exceeds total', async () => {
    const res = await request(app)
      .get('/api/drives?limit=10&offset=999999')
      .set(authHeader(makeToken()));

    expect(res.status).toBe(200);
    expect(res.body.drives).toEqual([]);
  });


  it('should return last page near total', async () => {

    const first = await request(app)
      .get('/api/drives?limit=10&offset=0')
      .set(authHeader(makeToken()));

    const total = first.body.total || 0;

    const res = await request(app)
      .get(`/api/drives?limit=10&offset=${Math.max(0,total-1)}`)
      .set(authHeader(makeToken()));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.drives)).toBe(true);
  });


  it('should return 401 without token', async () => {
    const res = await request(app)
      .get('/api/drives');

    expect(res.status).toBe(401);
  });

});


// ───────────────────────────────────────────
// GET /api/drives/:drive_uuid
// ───────────────────────────────────────────

describe('GET /api/drives/:drive_uuid', () => {


  it('should return drive with route and events', async () => {

    const res = await request(app)
      .get(`/api/drives/${VALID_UUID}`)
      .set(authHeader(makeToken()));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('drive_uuid');
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);

  });


  it('should return 404 for unknown uuid', async () => {

    const res = await request(app)
      .get(`/api/drives/${UNKNOWN_UUID}`)
      .set(authHeader(makeToken()));

    expect(res.status).toBe(404);

  });


  it('should return 400 for invalid uuid format', async () => {

    const res = await request(app)
      .get(`/api/drives/${INVALID_UUID}`)
      .set(authHeader(makeToken()));

    expect(res.status).toBe(400);

  });


  it('should return route field always', async () => {

    const res = await request(app)
      .get(`/api/drives/${VALID_UUID}`)
      .set(authHeader(makeToken()));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('route');

  });


  it('should return 401 without token', async () => {

    const res = await request(app)
      .get(`/api/drives/${VALID_UUID}`);

    expect(res.status).toBe(401);

  });

});


afterAll(async () => {
  await db.end();
});