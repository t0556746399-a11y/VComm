// ─────────────────────────────────────────────
// components/metrics/MetricCard.jsx
// Reference: README §6.1
//
// Tiny presentational tile: { label, value, suffix?, trend? }.
// Renders inside MetricsGrid. Uses Card from common/.
// ─────────────────────────────────────────────

// TODO: export default function MetricCard({ label, value, suffix }) { ... }

import React from 'react';
import Card from '../common/Card';

export default function MetricCard({ label, value, suffix }) {
  return (
    <Card>
      <h3>{label}</h3>
      <p>{value} {suffix}</p>
    </Card>
  );
}




