// ─────────────────────────────────────────────
// tests/setup.js — shared Jest setup
// Reference: README §11.2
//
// Responsibilities:
//   - Connect to a REAL test database (no mocks — README §11.2).
//   - Run migrations on the test DB before the suite.
//   - Provide globals if useful (e.g. global.signJwt(payload)).
//   - Truncate tables between tests (or use savepoints).
//
// Conventions:
//   - Company IDs in tests: 'test-co', 'other-co'   (README §11.1)
//   - Drivers: 'd-1', 'd-2'
//   - Drive UUIDs: stable constants exported from tests/fixtures.js
// ─────────────────────────────────────────────

// TODO: beforeAll(async () => { /* migrate + seed */ });
// TODO: afterAll(async () => { /* close pool */ });
// TODO: beforeEach(async () => { /* truncate */ });
