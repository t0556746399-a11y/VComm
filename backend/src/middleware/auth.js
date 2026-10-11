// ─────────────────────────────────────────────
// middleware/auth.js — JWT verification
// Reference: README §5.4, §7
//
// Behaviour:
//   - Reads Authorization header.
//   - If missing or not "Bearer <token>" → 401 { error: 'Missing token' }
//   - jwt.verify(token, JWT_SECRET); on failure → 401 { error: 'Invalid or expired token' }
//   - On success, attach decoded payload to req.user
//       { userId, companyId, role, iat, exp }   ← see README §7.2
//
// IMPORTANT: this middleware enforces authentication only.
//   For role checks use middleware/rbac.js → requireRole('admin').
// ─────────────────────────────────────────────

const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')

function auth(req, res, next) {
  const authorization = req.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' })
  }

  const token = authorization.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    return next()
  } catch (err) {
    console.error('Auth middleware error:', err.message)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { auth };