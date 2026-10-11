import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import { debounce } from 'lodash';
import { Table, TableBody, TableCell, TableHead, TableRow, Paper } from '@mui/material';
import Navbar from '../components/layout/Navbar'
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Marker.prototype.options.icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const MAX_CACHE_PER_ZOOM = 20;
const MAX_RENDERABLE_EVENTS = 500;
const BOUNDS_PADDING_FACTOR = 0.2; // מרווח ביטחון סביב הגבולות הנוכחיים לצורך קאשינג מוקדם

// --- רכיב מפת חום ---
function HeatmapLayer({ events }) {
  const map = useMap();

  useEffect(() => {
    if (!events || !events.length) return;

    const points = events
      .filter(e => e && e.lat && e.lng)
      .map(e => [parseFloat(e.lat), parseFloat(e.lng), (e.severity || 1) * 0.1]);

    if (!points.length) return;

    const heat = L.heatLayer(points, { radius: 25 }).addTo(map);
    return () => map.removeLayer(heat);
  }, [events, map]);
  return null;
}

// --- רכיב לכידת לחיצות לציור פוליגון ---
function MapClickHandler({ isDrawingMode, setPolygonPoints }) {
  useMapEvents({
    click(e) {
      if (!isDrawingMode) return;
      setPolygonPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
    }
  });
  return null;
}

// --- רכיב עזר קטן ללכידת אינסטנס המפה (לשימוש בגרירת נקודות וכפתור החיפוש) ---
function MapInstanceCapture({ mapInstanceRef }) {
  const map = useMap();
  useEffect(() => {
    mapInstanceRef.current = map;
  }, [map, mapInstanceRef]);
  return null;
}

// --- רכיב פנימי שמנהל את תנועות המפה, מתקן קפיאה, ומפעיל טריגר חיפוש דרך useMap() ---
function MapController({ onBoundsChange, hasSearched, triggerSearchFlag, onSearchExecuted }) {
  const map = useMap();
  const initializedRef = useRef(false);

  const getMapCurrentParams = useCallback(() => {
    const bounds = map.getBounds();
    return {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
      zoom: map.getZoom()
    };
  }, [map]);

  // מאזין לתזוזות מפה רגילות (פועל רק אחרי שבוצע חיפוש ראשוני עם פוליגון)
  useMapEvents({
    moveend: () => {
      if (hasSearched) {
        onBoundsChange(getMapCurrentParams());
      }
    },
    zoomend: () => {
      if (hasSearched) {
        onBoundsChange(getMapCurrentParams());
      }
    }
  });

  // פותר את בעיית המסך הלבן/מפה קפואה באתחול דינמי
  useEffect(() => {
    if (!map) return;
    map.invalidateSize();
    if (!initializedRef.current) {
      initializedRef.current = true;
    }
  }, [map]);

  // מאזין ללחיצה על כפתור החיפוש
  useEffect(() => {
    if (triggerSearchFlag) {
      onSearchExecuted(getMapCurrentParams());
    }
  }, [triggerSearchFlag, getMapCurrentParams, onSearchExecuted]);

  return null;
}

// ---------------- ANALYTICS ----------------
function AnalyticsTable({ events }) {
  const total = events?.length || 0;

  const avg =
    total > 0
      ? (
        events.reduce((a, b) => a + (Number(b.severity) || 0), 0) / total
      ).toFixed(1)
      : 0;

  return (
    <Paper
      style={{
        width: 350,
        position: "absolute",
        bottom: 20,
        left: 20,
        zIndex: 1000,
        padding: 12,
        maxHeight: 420,
        overflowY: "auto",
      }}
    >
      <h4>סטטיסטיקה</h4>

      <div>סה״כ אירועים: {total}</div>
      <div>ממוצע חומרה: {avg}</div>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>סוג</TableCell>
            <TableCell>חומרה</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {events.map((event, index) => (
            <TableRow key={event.event_id || index}>
              <TableCell>{event.event_type}</TableCell>
              <TableCell>{event.severity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

// --- רכיב הפופאפ המלא של כל אירוע עם Street View ---
function EventPopup({ event }) {
  const [svLoading, setSvLoading] = useState(false);
  const [svError, setSvError] = useState(null);
  const isClickingRef = useRef(false);

  const lat = parseFloat(event.lat);
  const lng = parseFloat(event.lng);

  const hasValidCoords =
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;

  const handleStreetView = async () => {
    if (isClickingRef.current || svLoading) return;
    isClickingRef.current = true;
    setSvError(null);
    setSvLoading(true);

    try {
      if (!hasValidCoords) {
        setSvError('קואורדינטות לא תקינות');
        return;
      }
      const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setSvError('שגיאה בפתיחת Street View');
    } finally {
      setSvLoading(false);
      setTimeout(() => { isClickingRef.current = false; }, 1500);
    }
  };

  const severityStyle = (() => {
    const s = String(event.severity).toLowerCase();
    if (s === 'high')   return { bg: '#fff0f0', color: '#c0392b', border: '#e74c3c' };
    if (s === 'medium') return { bg: '#fff8e1', color: '#e67e22', border: '#f39c12' };
    if (s === 'low')    return { bg: '#f0fff4', color: '#27ae60', border: '#2ecc71' };
    return { bg: '#f5f5f5', color: '#555', border: '#bbb' };
  })();

  return (
    <div style={{ minWidth: '220px', fontFamily: 'sans-serif', fontSize: '13px', direction: 'rtl' }}>
      <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
        🚗 {event.event_type}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#666' }}>חומרה:</span>
          <span style={{
            padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
            background: severityStyle.bg, color: severityStyle.color, border: `1px solid ${severityStyle.border}`
          }}>
            {event.severity}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>זמן:</span>
          <span>{event.event_ts ? new Date(event.event_ts).toLocaleTimeString('he-IL') : 'לא ידוע'}</span>
        </div>

        {event.driver && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>נהג:</span>
            <span>{event.driver}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#666' }}>מיקום:</span>
          <span style={{ fontSize: '11px', color: '#888', direction: 'ltr' }}>
            {hasValidCoords ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'לא זמין'}
          </span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
        {!hasValidCoords ? (
          <div style={{ fontSize: '12px', color: '#e74c3c', textAlign: 'center', padding: '6px 8px', background: '#fff0f0', borderRadius: '4px', border: '1px solid #fcc' }}>
            ⚠️ קואורדינטות חסרות — Street View לא זמין
          </div>
        ) : (
          <>
            <button
              onClick={handleStreetView}
              disabled={svLoading}
              style={{
                width: '100%', padding: '8px 12px',
                cursor: svLoading ? 'not-allowed' : 'pointer',
                borderRadius: '6px',
                border: `1px solid ${svLoading ? '#90caf9' : '#1976d2'}`,
                backgroundColor: svLoading ? '#e3f2fd' : '#1976d2',
                color: svLoading ? '#1976d2' : '#fff',
                fontWeight: '600', fontSize: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'background-color 0.15s ease, border-color 0.15s ease'
              }}
              onMouseEnter={e => { if (!svLoading) e.currentTarget.style.backgroundColor = '#1565c0'; }}
              onMouseLeave={e => { if (!svLoading) e.currentTarget.style.backgroundColor = '#1976d2'; }}
            >
              {svLoading ? '⏳ פותח...' : '🗺️ Open in Street View'}
            </button>
            {svError && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#e74c3c', textAlign: 'center', padding: '4px 8px', background: '#fff0f0', borderRadius: '4px', border: '1px solid #fcc' }}>
                ⚠️ {svError}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- הרכיב הראשי ---
export default function MapTestPage() {
  const [events, setEvents] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [triggerSearchFlag, setTriggerSearchFlag] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef(null);
  const polygonPointsRef = useRef(polygonPoints);
  const mapInstanceRef = useRef(null);

  // 🌟 קאש מרחבי בצד הלקוח - מקובץ לפי זום + חתימת הפוליגון הפעיל
  const spatialCacheRef = useRef({});
  const memoizedEvents = useMemo(() => events, [events]);

  // שומר את הפוליגון העדכני ביותר בתוך ref, כדי שקולבקים אסינכרוניים לא יראו מצב "מיושן" (stale)
  useEffect(() => {
    polygonPointsRef.current = polygonPoints;
  }, [polygonPoints]);

  // מרחיב את גבולות התצוגה הנוכחית במרווח ביטחון, כדי לאפשר קאשינג יעיל בין תזוזות קטנות
  const getPaddedBounds = useCallback((bounds) => {
    const latPad = (bounds.north - bounds.south) * BOUNDS_PADDING_FACTOR;
    const lngPad = (bounds.east - bounds.west) * BOUNDS_PADDING_FACTOR;
    return {
      north: bounds.north + latPad,
      south: bounds.south - latPad,
      east: bounds.east + lngPad,
      west: bounds.west - lngPad,
    };
  }, []);

  // בודק האם קיים קאש שכבר מכסה את הגבולות המבוקשים
  const findCachedData = useCallback((cacheGroupKey, paddedBounds) => {
    const entries = spatialCacheRef.current[cacheGroupKey];
    if (!entries) return null;

    const covering = entries.find(entry =>
      entry.bounds.north >= paddedBounds.north &&
      entry.bounds.south <= paddedBounds.south &&
      entry.bounds.east >= paddedBounds.east &&
      entry.bounds.west <= paddedBounds.west
    );

    return covering ? covering.data : null;
  }, []);

  // הפונקציה המרכזית: שולפת אירועים לפי גבולות מפה + פוליגון, עם קאש וביטול בקשות מיושנות
  const fetchMapEvents = useCallback(async (mapParams, points) => {
    if (!points || points.length < 3) return;
    if (!mapParams) return;

    const { zoom, north, south, east, west } = mapParams;
    const paddedBounds = getPaddedBounds({ north, south, east, west });
    const formattedPoly = points.map(p => ({ lat: p[0], lng: p[1] }));
    const polygonSignature = JSON.stringify(formattedPoly.map(p => [p.lat.toFixed(5), p.lng.toFixed(5)]));
    const cacheGroupKey = `${zoom}::${polygonSignature}`;

    // אם כבר יש קאש שמכסה את האזור המבוקש - נשתמש בו במקום לפנות לשרת
    const cached = findCachedData(cacheGroupKey, paddedBounds);
    if (cached) {
      setEvents(cached);
      setHasSearched(true);
      setTriggerSearchFlag(false);
      return;
    }

    // מבטל בקשה קודמת שעדיין רצה, כדי למנוע race condition
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        zoom,
        north: paddedBounds.north,
        south: paddedBounds.south,
        east: paddedBounds.east,
        west: paddedBounds.west,
        polygon: JSON.stringify(formattedPoly),
      }).toString();

      const token = localStorage.getItem('vcomm.token');

      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/events/map-events?${queryParams}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });

      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      let data = await response.json();

      if (data.length > MAX_RENDERABLE_EVENTS) {
        console.warn(`⚠️ [Overflow Protection] Backend החזיר ${data.length} events, מצמצם ל-${MAX_RENDERABLE_EVENTS}`);
        data = data.slice(0, MAX_RENDERABLE_EVENTS);
      }

      if (!spatialCacheRef.current[cacheGroupKey]) {
        spatialCacheRef.current[cacheGroupKey] = [];
      }
      spatialCacheRef.current[cacheGroupKey].push({
        bounds: paddedBounds,
        data,
      });
      if (spatialCacheRef.current[cacheGroupKey].length > MAX_CACHE_PER_ZOOM) {
        spatialCacheRef.current[cacheGroupKey].shift();
      }

      setEvents(data);
      setHasSearched(true);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted: user moved map quickly.');
      } else {
        console.error('Error fetching map events:', error);
      }
      setIsLoading(false);
      setTriggerSearchFlag(false);
    }
  }, [findCachedData, getPaddedBounds]);

  const handleSearch = useCallback(() => {
    if (!polygonPointsRef.current || polygonPointsRef.current.length < 3) {
      alert('יש לבחור לפחות 3 נקודות ליצירת אזור תקין');
      return;
    }

    setTriggerSearchFlag(true);
  }, []);

  const handleBoundsChange = useCallback((params) => {
    fetchMapEvents(params, polygonPointsRef.current);
  }, [fetchMapEvents]);

  const handleSearchExecuted = useCallback((params) => {
    fetchMapEvents(params, polygonPointsRef.current);
  }, [fetchMapEvents]);

  const toggleDrawingMode = useCallback(() => {
    setIsDrawingMode(prev => !prev);
    if (isDrawingMode) {
      setPolygonPoints([]);
    }
  }, [isDrawingMode]);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, display: 'flex', gap: 8 }}>
        <button
          onClick={toggleDrawingMode}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #1976d2', background: '#fff', cursor: 'pointer' }}
        >
          {isDrawingMode ? 'בטל ציור' : 'התחל ציור'}
        </button>
        <button
          onClick={handleSearch}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #1976d2', background: '#1976d2', color: '#fff', cursor: 'pointer' }}
        >
          חפש אירועים באזור
        </button>
      </div>

      {isLoading && (
        <div style={{ position: 'absolute', top: 60, right: 16, zIndex: 1000, background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: 6 }}>
          טוען אירועים...
        </div>
      )}

      <MapContainer center={[31.78, 35.21]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler isDrawingMode={isDrawingMode} setPolygonPoints={setPolygonPoints} />
        <MapInstanceCapture mapInstanceRef={mapInstanceRef} />
        <MapController
          onBoundsChange={handleBoundsChange}
          hasSearched={hasSearched}
          triggerSearchFlag={triggerSearchFlag}
          onSearchExecuted={handleSearchExecuted}
        />

        {polygonPoints.length > 0 && (
          <Polygon positions={polygonPoints.map(([lat, lng]) => [lat, lng])} pathOptions={{ color: '#1976d2' }} />
        )}

        <HeatmapLayer events={events} />

        {events.map((event, index) => (
          <Marker key={event.event_id || `${event.lat}-${event.lng}-${index}`} position={[parseFloat(event.lat), parseFloat(event.lng)]}>
            <Popup>
              <EventPopup event={event} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {events.length > 0 && <AnalyticsTable events={events} />}
    </div>
  );
}
