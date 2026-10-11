// ─────────────────────────────────────────────
// components/maps/MapContainer.jsx
// Reference: README §6.3
//
// Thin wrapper over react-leaflet <MapContainer> with shared defaults:
//   - center / zoom from FiltersContext (or constants.DEFAULT_VIEW)
//   - <TileLayer /> with OSM tiles (no API key)
//   - children pass-through for layers
// ─────────────────────────────────────────────

// TODO: import { MapContainer as LMap, TileLayer } from 'react-leaflet';
// TODO: export default function MapContainer({ children, ...props }) { ... }

// ─────────────────────────────────────────────
// components/maps/MapContainer.jsx
// ─────────────────────────────────────────────
import React from 'react';
import { MapContainer as LMap, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ודאי שייבוא ה-CSS של ה-Cluster קיים ברמה הגלובלית (באפליקציה)
// אם הוא חסר, האייקונים של ה-Cluster ייראו כשבורים או כריבועים לבנים.

export default function MapContainer({ children, ...props }) {
  return (
    <LMap
      center={[32.0853, 34.7818]}
      zoom={13}
      style={{ height: '100%', width: '100%' }} // גמישות מלאה לקונטיינר האב
      {...props}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {children}
    </LMap>
  );
}