// ─────────────────────────────────────────────
// components/maps/MapZoomTracker.jsx
// Reference: README §6.3
//
// Headless component (renders null) that subscribes to Leaflet
// `moveend` + `zoomend` events via useMapEvents() and writes
// { bbox, zoom } back into FiltersContext, which triggers useHeatmap()
// to refetch (Team B — Week 5 DOD).
// ─────────────────────────────────────────────

// TODO: import { useMapEvents } from 'react-leaflet';
// TODO: export default function MapZoomTracker() { ... }
import { useMapEvents } from 'react-leaflet';
import { useContext } from 'react';
import { FiltersContext } from '../../context/FiltersContext';
export default function MapZoomTracker() {
  const { setFilters } = useContext(FiltersContext);


  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      // עדכון ה-Context בגבולות החדשים ובזום הנוכחי
      setFilters(prev => ({
        ...prev,
        bbox: {
          northEast: bounds.getNorthEast(),
          southWest: bounds.getSouthWest()
        },
        zoom: zoom
      }));
    },
    zoomend: (e) => {
      const map = e.target;
      setFilters(prev => ({ ...prev, zoom: map.getZoom() }));
    }
  });

  return null; // רכיב headless שלא מרנדר כלום
}