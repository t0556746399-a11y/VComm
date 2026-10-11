// ─────────────────────────────────────────────
// components/common/Card.jsx — shared container (used by MetricCard etc.)
// ─────────────────────────────────────────────

// TODO: export default function Card({ children, ...props }) { ... }

import React from 'react';

export default function Card({ children }) {
  return (
    <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px', background: 'white' }}>
      {children}
    </div>
  );
}