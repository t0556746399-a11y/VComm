// ─────────────────────────────────────────────
// tests/admin.test.js — Team A
// Reference: README §14 and §16 Week 6 (Team A)
//
// Coverage target: ≥ 80% for routers/admin.js.
// ─────────────────────────────────────────────

// TODO: describe('Admin — Companies', () => {
// TODO:   it('should list all companies for an admin token', ...);
// TODO:   it('should create a company with valid body', ...);
// TODO:   it('should return 409 when company_id already exists', ...);
// TODO:   it('should rename a company on PATCH', ...);
// TODO:   it('should cascade-delete users when a company is deleted', ...);
// TODO:   it('should return 403 for non-admin tokens', ...);
// TODO: });

// TODO: describe('Admin — Users', () => {
// TODO:   it('should create a user with must_change_password=true', ...);
// TODO:   it('should return 409 when email already exists', ...);
// TODO:   it('should reject deletion of the only admin account with 400', ...);
// TODO:   it('should reset password and set must_change_password=true', ...);
// TODO: });

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/db');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const ADMIN_TOKEN = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET);
const USER_TOKEN = jwt.sign({ id: 2, role: 'viewer' }, JWT_SECRET);

beforeEach(async () => {
  await db.query('TRUNCATE users, companies CASCADE');

  await db.query(
    "INSERT INTO companies (company_id, name) VALUES ($1, $2)",
    ['admin_comp', 'Admin Company']
  );

  await db.query(
    "INSERT INTO users (email, password_hash, role, company_id) VALUES ($1, $2, $3, $4)",
    ['admin@admin.com', 'hashed_pass_123', 'admin', 'admin_comp']
  );
});

afterAll(async () => {
  await db.end();
});

describe('Admin — Companies', () => {
  it('should list all companies for an admin token', async () => {
    const res = await request(app)
      .get('/api/admin/companies')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should create a company with valid body', async () => {
    const res = await request(app)
      .post('/api/admin/companies')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ company_id: 'comp1', name: 'Test Company' });

    expect(res.statusCode).toBe(201);
    expect(res.body.company_id).toBe('comp1');
  });

  it('should return 409 when company_id already exists', async () => {
    await request(app)
      .post('/api/admin/companies')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ company_id: 'comp1', name: 'Original' });

    const res = await request(app)
      .post('/api/admin/companies')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ company_id: 'comp1', name: 'Duplicate' });

    expect(res.statusCode).toBe(409);
  });

  it('should rename a company on PATCH', async () => {
    await request(app)
      .post('/api/admin/companies')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ company_id: 'comp1', name: 'Old Name' });

    const res = await request(app)
      .patch('/api/admin/companies/comp1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'New Name' });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('should cascade-delete users when a company is deleted', async () => {
    await request(app).post('/api/admin/companies').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ company_id: 'comp1', name: 'Test' });
    await request(app).post('/api/admin/users').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ email: 'u1@test.com', password_hash: 'hashed_123', company_id: 'comp1', role: 'viewer' });

    await request(app).delete('/api/admin/companies/comp1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const checkUser = await db.query('SELECT * FROM users WHERE email = $1', ['u1@test.com']);
    expect(checkUser.rows.length).toBe(0);
  });

  it('should return 403 for non-admin tokens', async () => {
    const res = await request(app)
      .get('/api/admin/companies')
      .set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.statusCode).toBe(403);
  });
});
it('should return 400 when creating a user with invalid email format', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({
        email: 'invalid-email',
        password: 'password123',
        company_id: 'admin_comp',
        role: 'viewer'
      });

    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({
        email: 'test@example.com',
        password: '123',
        company_id: 'admin_comp',
        role: 'viewer'
      });

    expect(res.statusCode).toBe(400);
  });it('should reject deletion of the only admin account with 400', async () => {
    // נשלוף את ה-ID של המשתמש שכרגע הוכנס ב-beforeEach
    const user = await db.query('SELECT id FROM users WHERE email = $1', ['admin@admin.com']);
    const userId = user.rows[0].id;

    const res = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.statusCode).toBe(400);
  });

  it('should reset password and set must_change_password=true', async () => {
    // נשלוף את ה-ID של המשתמש
    const user = await db.query('SELECT id FROM users WHERE email = $1', ['admin@admin.com']);
    const userId = user.rows[0].id;

    const res = await request(app)
      .post(`/api/admin/users/${userId}/reset-password`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ new_password: 'SecurePassword123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.must_change_password).toBe(true);
  });