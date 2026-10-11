// ─────────────────────────────────────────────
// components/maps/HeatmapLayer.jsx
// Reference: README §6.3
//
// Uses leaflet.heat (already in package.json). Receives { lat, lng, weight }[]
// from useHeatmap() and feeds it to L.heatLayer(points, options).
//
// Add the layer in a useEffect that depends on the cells array; remove on unmount
// to avoid accumulating layers on re-render.
// ─────────────────────────────────────────────

// TODO: export default function HeatmapLayer({ cells, options }) { ... }
