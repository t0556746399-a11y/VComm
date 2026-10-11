// ─────────────────────────────────────────────
// components/common/AdminRoute.jsx
// Reference: README §14.4
//
// Behaviour:
//   - loading → spinner
//   - no user → redirect /login
//   - user.role !== 'admin' → redirect /aggregated
//   - else → children
//
// Defence-in-depth: backend ALSO enforces requireRole('admin') so a hidden
// route in the bundle does not grant access (README §14, §14.2).
// ─────────────────────────────────────────────

// TODO: export default function AdminRoute({ children }) { ... }
