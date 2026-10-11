const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const db = require('../db');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(requireRole('admin'));

const createCompanySchema = z.object({
  company_id: z.string().min(1),
  name: z.string().min(1),
});

const renameCompanySchema = z.object({
  name: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  company_id: z.string().min(1),
  role: z.enum(['admin', 'manager', 'viewer']).default('viewer'),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  company_id: z.string().min(1).optional(),
  role: z.enum(['admin', 'manager', 'viewer']).optional(),
});

const resetPasswordSchema = z.object({
  new_password: z.string().min(8),
});

router.get('/companies', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.company_id, c.name, c.created_at,
              COUNT(u.id)::int AS user_count
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.company_id
       GROUP BY c.company_id, c.name, c.created_at
       ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/companies', validate(createCompanySchema), async (req, res, next) => {
  try {
    const { company_id, name } = req.validated;
    const result = await db.query(
      `INSERT INTO companies (company_id, name)
       VALUES ($1, $2)
       RETURNING company_id, name, created_at`,
      [company_id, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Company already exists' });
    }
    next(err);
  }
});

router.patch('/companies/:id', validate(renameCompanySchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.validated;
    const result = await db.query(
      `UPDATE companies SET name = $1 WHERE company_id = $2
       RETURNING company_id, name, created_at`,
      [name, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/companies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM companies WHERE company_id = $1 RETURNING company_id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { company_id, role } = req.query;
    const result = await db.query(
      `SELECT id, email, company_id, role, must_change_password, created_at
       FROM users
       WHERE ($1::text IS NULL OR company_id = $1)
         AND ($2::text IS NULL OR role = $2)
       ORDER BY email`,
      [company_id || null, role || null]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/users', validate(createUserSchema), async (req, res, next) => {
  try {
    const { email, password, company_id, role } = req.validated;
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, company_id, role, must_change_password)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, email, company_id, role, must_change_password, created_at`,
      [email, passwordHash, company_id, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    next(err);
  }
});

router.patch('/users/:id', validate(updateUserSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, company_id, role } = req.validated;
    const result = await db.query(
      `UPDATE users
       SET email = COALESCE($1, email),
           company_id = COALESCE($2, company_id),
           role = COALESCE($3, role)
       WHERE id = $4
       RETURNING id, email, company_id, role, must_change_password, created_at`,
      [email || null, company_id || null, role || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    next(err);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminCount = await db.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`
    );
    const target = await db.query(
      'SELECT id, role FROM users WHERE id = $1',
      [id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target.rows[0].role === 'admin' && adminCount.rows[0].count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only admin account' });
    }
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post(
  '/users/:id/reset-password',
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { new_password } = req.validated;
      const passwordHash = await bcrypt.hash(new_password, 12);
      const result = await db.query(
        `UPDATE users
         SET password_hash = $1, must_change_password = TRUE
         WHERE id = $2
         RETURNING id, email, company_id, role, must_change_password, created_at`,
        [passwordHash, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
