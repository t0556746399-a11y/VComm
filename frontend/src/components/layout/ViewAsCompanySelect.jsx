// ─────────────────────────────────────────────
// components/layout/ViewAsCompanySelect.jsx — admin "view as" dropdown
// Reference: README §14.1 ("View As Company")
//
// Source of options: useQuery(['companies'], listCompanies).
// On change: setFilters({ viewAsCompany }) — every /api/* hook will
// automatically include ?view_as=... once this field is set.
//
// Rendered ONLY by Navbar when user.role === 'admin' (Team A — Week 5 DOD).
// ─────────────────────────────────────────────

// TODO: export default function ViewAsCompanySelect({ value, onChange }) { ... }
