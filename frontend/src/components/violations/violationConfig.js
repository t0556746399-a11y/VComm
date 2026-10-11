// ─────────────────────────────────────────────
// components/violations/violationConfig.js
// Reference: README §6.4
//
// SINGLE SOURCE OF TRUTH for event-type metadata.
// Every component that needs an icon, colour, or label MUST import from here.
//
// Shape per entry:
//   { label: string, icon: '/data/<file>.png', color: '#hex' }
//
// Add new event types by appending entries — do NOT hardcode strings elsewhere.
// ─────────────────────────────────────────────

// TODO: export const VIOLATION_CONFIG = {
// TODO:   stop_sign:           { label: 'Stop Sign',           icon: '/data/stop_sign.png',  color: '#e53935' },
// TODO:   pedestrian_crossing: { label: 'Pedestrian Crossing', icon: '/data/pedestrian.png', color: '#fb8c00' },
// TODO:   over_speed:          { label: 'Over Speed',          icon: '/data/overspeed.png',  color: '#e53935' },
// TODO:   harsh_braking:       { label: 'Harsh Braking',       icon: '/data/braking.png',    color: '#f4511e' },
// TODO:   // ... fill in all 33 event types (see README §1 / §13)
// TODO: };
import L from 'leaflet';

// הגדרת המידע (כפי שנדרש ב-README)
export const VIOLATION_CONFIG = {
  harsh_braking:       { label: 'Harsh Braking',       icon: '/data/braking.png',    color: '#f4511e' },
  over_speed:          { label: 'Over Speed',          icon: '/data/overspeed.png',  color: '#e53935' },
  // ... הוסיפי כאן את השאר
};

// פונקציית עזר ליצירת אייקון Leaflet אמיתי
export const getIconForType = (type) => {
  const meta = VIOLATION_CONFIG[type];
  if (!meta) return null;

  return new L.Icon({
    iconUrl: meta.icon,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};