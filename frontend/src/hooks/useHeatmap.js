// ─────────────────────────────────────────────
// hooks/useHeatmap.js — heatmap cells via TanStack Query
// Reference: README §6.2, §6.3
//
// queryKey: ['heatmap', filters, bbox, zoom]
// queryFn:  () => getHeatmap(filters, { bbox, zoom })
// enabled:  bbox && zoom != null
//
// The hook re-fires whenever MapZoomTracker updates bbox/zoom in FiltersContext.
// ─────────────────────────────────────────────

// TODO: export function useHeatmap() { ... }
