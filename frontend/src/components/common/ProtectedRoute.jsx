// ─────────────────────────────────────────────
// components/common/ProtectedRoute.jsx
// Reference: README §6.1, §7.4
//
// Behaviour:
//   - If loading → spinner.
//   - If !user   → <Navigate to="/login" replace />
//   - If user.must_change_password → <Navigate to="/change-password" replace />
//   - Otherwise → children
// ─────────────────────────────────────────────

// TODO: export default function ProtectedRoute({ children }) { ... }
