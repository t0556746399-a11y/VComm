// ─────────────────────────────────────────────
// tests/auth.test.js — public auth endpoints
// Reference: README §11.1 (naming) and §8.1
//
// Every `it()` description MUST start with "should " and follow the pattern:
//   "should <do X> when <condition>"
// ─────────────────────────────────────────────

jest.mock('../src/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const request = require('supertest');
const db = require('../src/db');
const authRouter = require('../src/routers/auth');

const TEST_COMPANY_ID = 'test-company';

function authGuard(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  req.user = {
    userId: 1,
    companyId: TEST_COMPANY_ID,
    role: 'viewer',
  };

  next();
}

const app = express();
app.use(express.json());
app.use('/auth/change-password', authGuard);
app.use('/auth', authRouter);

function mockValidLoginUser({ email, passwordHash, companyId, role = 'viewer', companyName = 'Test Company' }) {
  db.query.mockImplementation((text, params) => {
    if (text.startsWith('SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) AS exists')) {
      return Promise.resolve({ rows: [{ exists: false }] });
    }

    if (text.startsWith('INSERT INTO users (email, password_hash, name, company_id, role)')) {
      return Promise.resolve({
        rows: [
          {
            id: 1,
            email,
            name: 'Test User',
            company_id: companyId,
            role,
            must_change_password: false,
            created_at: new Date().toISOString(),
          },
        ],
      });
    }

    if (text.startsWith('SELECT * FROM users WHERE lower(email) = lower($1)')) {
      return Promise.resolve({
        rows: [
          {
            id: 1,
            email,
            password_hash: passwordHash,
            company_id: companyId,
            role,
            must_change_password: false,
          },
        ],
      });
    }

    if (text.startsWith('SELECT name FROM companies WHERE company_id = $1')) {
      return Promise.resolve({ rows: [{ name: companyName }] });
    }

    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  db.query.mockReset();
});

describe('POST /auth/login', () => {
  // TODO: it('should return 400 when body is missing required fields', ...);
  it('should return 400 when body is missing required fields', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Missing email or password',
    });
  });

  // TODO: it('should return 401 when password is wrong', ...);
  it('should return 401 when password is wrong', async () => {
    const email = `test_user_${Date.now()}@example.com`;
    const password = 'ValidPass1!';
    const wrongPassword = 'WrongPass1!';
    const passwordHash = await bcrypt.hash(password, 10);

    mockValidLoginUser({
      email,
      passwordHash,
      companyId: TEST_COMPANY_ID,
      role: 'viewer',
      companyName: 'Test Company',
    });

    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email,
        password,
        name: 'Test User',
        company_id: TEST_COMPANY_ID,
        role: 'viewer',
      });

    expect(registerResponse.status).toBe(201);

    const response = await request(app)
      .post('/auth/login')
      .send({ email, password: wrongPassword });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: 'הסיסמה שגויה. בדקי את הסיסמה ונסי שוב.',
    });
  });

  it('should return 404 when email does not exist', async () => {
    const email = `missing_user_${Date.now()}@example.com`;

    db.query.mockImplementation((text, params) => {
      if (text.startsWith('SELECT * FROM users WHERE lower(email) = lower($1)')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/auth/login')
      .send({ email, password: 'AnyPass1!' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: 'האימייל אינו קיים במערכת. יש להירשם.',
    });
  });

  it('should return a JWT and user payload for valid credentials', async () => {
    const email = `valid_user_${Date.now()}@example.com`;
    const password = 'ValidPass1!';
    const passwordHash = await bcrypt.hash(password, 10);

    mockValidLoginUser({
      email,
      passwordHash,
      companyId: TEST_COMPANY_ID,
      role: 'viewer',
      companyName: 'Test Company',
    });

    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email,
        password,
        name: 'Valid User',
        company_id: TEST_COMPANY_ID,
        role: 'viewer',
      });

    expect(registerResponse.status).toBe(201);

    const response = await request(app)
      .post('/auth/login')
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      token: expect.any(String),
      user: expect.objectContaining({
        email,
        company_id: TEST_COMPANY_ID,
        company_name: 'Test Company',
        role: 'viewer',
        must_change_password: false,
      }),
    });

    const decoded = jwt.verify(response.body.token, config.JWT_SECRET);
    expect(decoded).toMatchObject({
      userId: 1,
      companyId: TEST_COMPANY_ID,
      role: 'viewer',
      companyName: 'Test Company',
    });
  });
});

describe('POST /auth/change-password', () => {
  const currentPassword = 'Current1!';
  const newPassword = 'NewValid1!';
  const currentPasswordHash = bcrypt.hashSync(currentPassword, 10);

  it('should clear must_change_password after a successful change', async () => {
    mockValidLoginUser({
      email: 'change_password_user@example.com',
      passwordHash: currentPasswordHash,
      companyId: TEST_COMPANY_ID,
    });

    let updateCalled = false;
    db.query.mockImplementation((text, params) => {
      if (text.startsWith('SELECT * FROM users WHERE lower(email) = lower($1)')) {
        return Promise.resolve({ rows: [] });
      }

      if (text.startsWith('SELECT * FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              email: 'change_password_user@example.com',
              password_hash: currentPasswordHash,
              company_id: TEST_COMPANY_ID,
              role: 'viewer',
            },
          ],
        });
      }

      if (text.startsWith('UPDATE users')) {
        updateCalled = true;
        expect(text).toContain('must_change_password = false');
        expect(params[1]).toBe(1);
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/auth/change-password')
      .set('Authorization', 'Bearer fake-token')
      .send({ currentPassword, newPassword });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ message: 'Password changed successfully' });
    expect(updateCalled).toBe(true);
  });

  it('should return 401 when token is missing', async () => {
    const response = await request(app)
      .post('/auth/change-password')
      .send({ currentPassword: 'x', newPassword: 'NewValid1!' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: 'Missing token' });
  });

  it('should return 400 when newPassword is shorter than 8 chars', async () => {
    db.query.mockImplementation((text, params) => {
      if (text.startsWith('SELECT * FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              password_hash: currentPasswordHash,
              company_id: TEST_COMPANY_ID,
              role: 'viewer',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/auth/change-password')
      .set('Authorization', 'Bearer fake-token')
      .send({ currentPassword, newPassword: 'Short1!' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Password must be at least 8 characters',
    });
  });
});

afterAll(async () => {
  await db.end();
});
