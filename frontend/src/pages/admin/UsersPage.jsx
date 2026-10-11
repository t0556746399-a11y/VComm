// ─────────────────────────────────────────────
// pages/admin/UsersPage.jsx — Team A
// Reference: README §14.1 (Users Screen), §14.4
//
// Features:
//   - Searchable/filterable table (email, company, role, must_change_pw, last_login).
//   - "Create user" modal (email + company select + role + temporary password).
//      → POST sets must_change_password=true automatically.
//   - Edit row (email, company, role).
//   - "Reset password" action (sets must_change_password=true again).
//   - Delete with confirmation. Backend rejects deletion of the only admin (400).
// ─────────────────────────────────────────────

// TODO: export default function UsersPage() { ... }

export default function UsersPage() {
    return <h1>עמוד משתמשים</h1>;
}