
// import React from 'react';
// import { Marker, Popup } from 'react-leaflet';
// import L from 'leaflet';
// import * as config from '../violations/violationConfig';

// const defaultIcon = new L.Icon({
//   iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
//   shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
//   iconSize: [25, 41],
//   iconAnchor: [12, 41],
//   popupAnchor: [1, -34],
//   shadowSize: [41, 41]
// });

// export default function PointLayer({ events = [] }) {
//   if (!events || events.length === 0) return null;

//   return (
//     <>
//       {events.map((event) => (
//         <Marker
//           key={event.id}
//           position={[event.lat, event.lng]}
//           icon={config[event.type] || defaultIcon}
//           eventHandlers={{
//             click: (e) => {
//               e.target.openPopup();
//             }
//           }}
//         >
//           <Popup>
//             <div className="p-2">
//               <h3 className="font-bold">{event.type || 'אירוע בטיחות'}</h3>
//               <p><strong>זמן:</strong> {new Date(event.timestamp).toLocaleString()}</p>
//               <p><strong>חומרה:</strong> {event.severity}</p>
//             </div>
//           </Popup>
//         </Marker>
//       ))}
//     </>
//   );
// }

// ─────────────────────────────────────────────
// components/maps/PointLayer.jsx
// ─────────────────────────────────────────────

import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import * as config from '../violations/violationConfig';

const defaultIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function PointLayer({ events = [] }) {
  if (!events || events.length === 0) return null;

  return (
    <>
      {events.map((event) => (
        <Marker
          // שודרג: תמיכה בשני פורמטי id (event_id מהשרת או id מקומי)
          key={event.event_id || event.id}
          position={[event.lat, event.lng]}
          // נשמר מהקוד שלך: violationConfig בעדיפות, עם fallback ל-defaultIcon
          icon={config[event.event_type || event.type] || defaultIcon}
          // נשמר מהקוד שלך: eventHandlers לפתיחת popup בלחיצה
          eventHandlers={{
            click: (e) => {
              e.target.openPopup();
            }
          }}
        >
          <Popup>
            <div className="p-2" style={{ direction: 'rtl', minWidth: '150px' }}>
              {/* שודרג: תמיכה בשני פורמטי שם האירוע */}
              <h3 className="font-bold">{event.event_type || event.type || 'אירוע בטיחות'}</h3>
              {/* שודרג: תמיכה בשני פורמטי זמן (event_ts מהשרת או timestamp מקומי) */}
              <p><strong>זמן:</strong> {
                event.event_ts
                  ? new Date(event.event_ts).toLocaleString('he-IL')
                  : event.timestamp
                    ? new Date(event.timestamp).toLocaleString('he-IL')
                    : 'לא ידוע'
              }</p>
              <p><strong>חומרה:</strong> {event.severity || 'לא ידוע'}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}