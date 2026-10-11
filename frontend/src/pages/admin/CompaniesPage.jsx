// ─────────────────────────────────────────────
// pages/admin/CompaniesPage.jsx — Team A
// Reference: README §14.1 (Companies Screen), §14.4
//
// Features:
//   - Searchable table of companies (id, name, user count, created, actions).
//   - Inline "Create company" form (company_id + name).
//   - Inline rename (PATCH).
//   - Delete with confirmation dialog (cascades users).
//
// Data layer:
//   - useQuery(['companies'], listCompanies)
//   - useMutation(...) → on success: queryClient.invalidateQueries(['companies'])
//
// No `fetch` / `axios` inside the component (Team A Week 4 DOD).
// ─────────────────────────────────────────────

// TODO: export default function CompaniesPage() { ... }
export default function CompaniesPage() {
    return <h1>עמוד </h1>;
}
