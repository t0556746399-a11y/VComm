// // ─────────────────────────────────────────────
// // components/maps/RouteLayer.jsx
// // ─────────────────────────────────────────────

// import React, { useState, useEffect } from 'react';
// import { Marker, Popup, Polyline } from 'react-leaflet';
// import { getEvents } from '../../api/trips';

// const isValidCoordinates = (lat, lng) => {
//   if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
//   const numLat = Number(lat);
//   const numLng = Number(lng);
//   if (isNaN(numLat) || isNaN(numLng)) return false;
//   if (numLat < -90 || numLat > 90) return false;
//   if (numLng < -180 || numLng > 180) return false;
//   return true;
// };

// /**
//  * RouteLayer
//  * @param {Array} route  - מערך של נקודות [{lat, lng}, ...] לציור הקו
//  * @param {Object} style - אופציונלי: עיצוב לקו (צבע, עובי וכו')
//  *
//  * שימו לב: רכיב זה חייב להיות בתוך MapContainer קיים — הוא לא יוצר מפה משלו
//  */
// export default function RouteLayer({ route, style }) {
//   const [events, setEvents] = useState([]);
//   const [errorMsg, setErrorMsg] = useState({});
//   const [loading, setLoading] = useState({});
//   const [clicked, setClicked] = useState({});
//   const [serverError, setServerError] = useState(null);

//   useEffect(() => {
//     const fetchServerEvents = async () => {
//       try {
//         const data = await getEvents({
//           start_date: '2024-01-01',
//           end_date: '2026-12-31',
//         });

//         if (data && data.events) {
//           setEvents(data.events);
//         } else if (Array.isArray(data)) {
//           setEvents(data);
//         }
//       } catch (err) {
//         console.error('Server fetch failed:', err);
//         setServerError('Failed to load events from server');
//       }
//     };

//     fetchServerEvents();
//   }, []);

//   const handleStreetView = (id, lat, lng) => {
//     if (clicked[id]) return;

//     const numLat = parseFloat(lat);
//     const numLng = parseFloat(lng);

//     if (!isValidCoordinates(numLat, numLng)) {
//       setErrorMsg(prev => ({ ...prev, [id]: 'קואורדינטות לא תקינות' }));
//       return;
//     }

//     setLoading(prev => ({ ...prev, [id]: true }));
//     setClicked(prev => ({ ...prev, [id]: true }));

//     setTimeout(() => {
//       setLoading(prev => ({ ...prev, [id]: false }));

//       const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${numLat},${numLng}`;
//       window.open(url, '_blank', 'noopener,noreferrer');

//       setTimeout(() => setClicked(prev => ({ ...prev, [id]: false })), 1000);
//     }, 500);
//   };

//   const routePositions = route && route.length > 0
//     ? route.map(point => [point.lat, point.lng])
//     : null;

//   const defaultRouteStyle = {
//     color: 'blue',
//     weight: 5,
//     opacity: 0.7,
//   };

//   // רכיב זה מחזיר שכבות בלבד — ללא MapContainer, TileLayer, או div עוטף
//   return (
//     <>
//       {/* ציור קו המסלול */}
//       {routePositions && (
//         <Polyline positions={routePositions} pathOptions={style || defaultRouteStyle} />
//       )}

//       {/* אירועים כ-Markers */}
//       {events && events.map((event) => {
//         const lat = parseFloat(event.lat);
//         const lng = parseFloat(event.lng);
//         if (!isValidCoordinates(lat, lng)) return null;

//         const eventId = event.event_id || event.id;

//         return (
//           <Marker key={eventId} position={[lat, lng]}>
//             <Popup>
//               <div style={{ minWidth: '200px', textAlign: 'right', direction: 'rtl' }}>
//                 <h4 style={{ margin: '0 0 8px 0', color: '#1A73E8' }}>
//                   סוג אירוע: {event.event_type}
//                 </h4>
//                 <p style={{ margin: '4px 0', fontSize: '12px' }}>
//                   <b>זמן:</b> {event.event_ts ? new Date(event.event_ts).toLocaleTimeString() : 'אין תאריך'}
//                 </p>
//                 <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '8px 0' }} />

//                 {errorMsg[eventId] && (
//                   <p style={{ color: 'red', fontSize: '12px', margin: '4px 0' }}>
//                     {errorMsg[eventId]}
//                   </p>
//                 )}

//                 <button
//                   onClick={() => handleStreetView(eventId, lat, lng)}
//                   disabled={loading[eventId]}
//                   style={{
//                     width: '100%',
//                     padding: '8px',
//                     cursor: loading[eventId] ? 'wait' : 'pointer',
//                     backgroundColor: loading[eventId] ? '#ccc' : '#4285F4',
//                     color: 'white',
//                     border: 'none',
//                     borderRadius: '4px',
//                     fontWeight: 'bold',
//                   }}
//                 >
//                   {loading[eventId] ? 'טוען...' : 'פתח ב-Street View'}
//                 </button>
//               </div>.
//             </Popup>
//           </Marker>
//         );
//       })}

//       {/* הודעת שגיאה בטעינת אירועים — מוצגת מחוץ למפה ב-TripSummaryPage */}
//       {serverError && console.error('RouteLayer server error:', serverError)}
//     </>
//   );
// }

import React from 'react';
import { Polyline } from 'react-leaflet';

export default function RouteLayer({ route, style }) {
  const defaultRouteStyle = { color: '#1A73E8', weight: 5, opacity: 0.7 };

  const routePositions = route?.coordinates?.length > 0
    ? route.coordinates.map(([lng, lat]) => [lat, lng])
    : null;

  return (
    <>
      {routePositions && (
        <Polyline positions={routePositions} pathOptions={style || defaultRouteStyle} />
      )}
    </>
  );
}