import React, { useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useDrive } from '../hooks/useDrive';
// שודרג: נוסף useDrives לשליפת רשימת נסיעות לתפריט הבחירה
import { useDrives } from '../hooks/useDrives';
import RouteLayer from '../components/maps/RouteLayer';
import PointLayer from '../components/maps/PointLayer';
import ClusterLayer from '../components/maps/ClusterLayer';
import MetricsGrid from '../components/metrics/MetricsGrid';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// פתרון CDN לאייקונים (מונע שגיאות 404 ותצוגת איקסים)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// נשמר מהקוד שלך: MapManager עם פתרון ריבועים לבנים + resetView + zoom
// שודרג: גם מעביר את instance המפה למעלה דרך setMap
function MapManager({ route, setZoom, mapRef, setMap }) {
  const map = useMap();

  // נשמר מהקוד שלך: פתרון לריבועים הלבנים בטעינה ראשונית
  useEffect(() => {
    if (map) {
      map.invalidateSize();
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
      // שודרג: מעביר את instance המפה ל-state המרכזי
      if (setMap) setMap(map);
    }
  }, [map, setMap]);

  // נשמר מהקוד שלך: רישום פונקציית resetView על ה-ref
  useEffect(() => {
    if (mapRef && route?.length > 0) {
      mapRef.current.resetView = () => {
        const bounds = route.map(p => [p.lat, p.lng]);
        map.fitBounds(bounds, { padding: [50, 50] });
      };
    }
  }, [route, map, mapRef]);

  useMapEvents({ zoomend: (e) => setZoom(e.target.getZoom()) });
  return null;
}

export default function TripSummaryPage() {
  // שודרג: driveUuid הוא state שניתן לשינוי (במקום useState קבוע)
  const [driveUuid, setDriveUuid] = useState(null);
  const [zoom, setZoom] = useState(13);
  const [mapInstance, setMapInstance] = useState(null);
  const mapRef = useRef();

  // שודרג: שליפת רשימת נסיעות לתפריט הבחירה
  const { data: drivesList = [], isLoading, error } = useDrives({ limit: 10 });

  const { data: driveData, isLoading: isDriveLoading, error: driveError } = useDrive(driveUuid);

  // שודרג: handleResetView משתמש ב-mapInstance (יותר אמין מ-mapRef.current.resetView)
  const handleResetView = React.useCallback(() => {
    const map = mapInstance || mapRef.current;
    if (!map) return;

    if (driveData?.route?.coordinates?.length > 0) {
      // אם יש נסיעה — מרכז על המסלול
      const bounds = driveData.route.coordinates.map(([lng, lat]) => [lat, lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (mapRef.current?.resetView) {
      // נשמר מהקוד שלך: fallback ל-resetView על ה-ref
      mapRef.current.resetView();
    } else {
      // fallback לתל אביב
      map.setView([32.0853, 34.7818], 13);
    }
  }, [mapInstance, driveData]);

  // שודרג: מירכוז אוטומטי בשינוי נסיעה
  useEffect(() => {
    if ((mapInstance || mapRef.current) && driveData?.route?.coordinates?.length > 0) {
      handleResetView();
    }
  }, [driveData, mapInstance]);

  if (isLoading) return <div className="p-8 text-center">טוען נתוני נסיעה...</div>;
  if (error) return <div className="p-8 text-red-600">שגיאה: {error.message}</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* שודרג: header עם תפריט בחירת נסיעה */}
      <header className="p-4 bg-gray-100 flex items-center justify-between">
        <h1 className="text-xl font-bold">סיכום נסיעה</h1>
        <select
          onChange={(e) => setDriveUuid(e.target.value)}
          className="p-2 border rounded"
          value={driveUuid || ""}
        >
          <option value="" disabled>בחר נסיעה...</option>
          {drivesList.map((drive) => (
            <option key={drive.id || drive.drive_uuid} value={drive.id || drive.drive_uuid}>
              נסיעה {drive.id || drive.drive_uuid}
            </option>
          ))}
        </select>
      </header>

      <div style={{ flex: '1', position: 'relative' }}>
        {/* נשמר מהקוד שלך: כפתור איפוס צף בעיצוב מודרני */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleResetView();
          }}
          className="absolute top-4 right-4 z-[1000] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform active:scale-95"
        >
          חזור לתצוגה מקורית
        </button>

        <MapContainer
          ref={mapRef}
          center={[32.0853, 34.7818]}
          zoom={13}
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* נשמר מהקוד שלך: MapManager תמיד רץ, שודרג עם setMap */}
          <MapManager
            route={driveData?.route}
            setZoom={setZoom}
            mapRef={mapRef}
            setMap={setMapInstance}
          />

          {driveData?.route && <RouteLayer route={driveData.route} />}

          {driveData?.events && (
            zoom < 12
              ? <ClusterLayer events={driveData.events} />
              : <PointLayer events={driveData.events} />
          )}
        </MapContainer>
      </div>

      {/* {driveData && (
        <footer className="p-4 bg-white border-t">
          <MetricsGrid totals={{ distance: driveData.distance, duration: driveData.duration, score: driveData.score }} />
        </footer>
      )} */}
    </div>
  );
}





// // import React, { useMemo } from 'react';
// // import { useParams, useNavigate } from 'react-router-dom';
// // import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
// // import MarkerClusterGroup from 'react-leaflet-cluster';
// // import L from 'leaflet';
// // import { useDrive } from '../hooks/useDrive';
// // import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
// // import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
// // import 'leaflet/dist/leaflet.css';
// // // תיקון אייקונים
// // delete L.Icon.Default.prototype._getIconUrl;
// // L.Icon.Default.mergeOptions({
// //   iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
// //   iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
// //   shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
// // });


// // function RecenterButton({ polyline }) {
// //   const map = useMap();
// //   return (
// //     <button 
// //       style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, padding: '10px', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
// //       onClick={() => {
// //         if (polyline && polyline.length > 0) {
// //           map.fitBounds(L.polyline(polyline).getBounds());
// //         }
// //       }}
// //     >
// //       מרכז מחדש
// //     </button>
// //   );
// // }
// // export default function TripSummaryPage() {
  
// //   const { driveUuid } = useParams();
// //   const navigate = useNavigate();
// //     console.log("driveUuid from params:", driveUuid);

// //   const { data, isLoading } = useDrive(driveUuid);
// //   console.log("data:", data); 
// //   const polyline = useMemo(() => {
// //     if (!data?.drive?.route_geojson?.coordinates) return [];
// //     return data.drive.route_geojson.coordinates.map(p => [p[1], p[0]]);
// //   }, [data]);
// //   return (
// //     <div className="flex flex-col h-full p-2">
// //       <div className="p-4 bg-gray-100 mb-4 rounded shadow-sm">
// //         <label className="font-bold">נסיעה: </label>
// //         <select value={driveUuid} onChange={(e) => navigate(`/trip-summary/${e.target.value}`)}>
// //           <option value={driveUuid}>{driveUuid}</option>
// //         </select>
// //       </div>
// //       <div style={{ height: '500px', width: '100%', position: 'relative' }}>
// //         {isLoading ? (
// //           <div>טוען נתונים...</div>
// //         ) : data ? (
// //           <MapContainer 
// //             key={driveUuid} 
// //             center={polyline.length > 0 ? polyline[0] : [32.0853, 34.7818]} 
// //             zoom={13} 
// //             style={{ height: '100%', width: '100%' }}
// //           >
// //             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
// //             <RecenterButton polyline={polyline} />
            
// //             {polyline.length > 0 && <Polyline positions={polyline} color="blue" />}
// //             {data.events && (
// //               <MarkerClusterGroup chunkedLoading>
// //                 {data.events.map((event, index) => {
// //                   const geomStr = event.extra?.geometry;
// //                   // בדיקת ה-pos ב-Console
// //                   const coords = geomStr?.match(/POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)/);
                  
// //                   if (!coords) {
// //                     console.log("Event without valid geometry:", event);
// //                     return null;
// //                   }
                  
// //                   // coords[1] הוא LONGITUDE, coords[2] הוא LATITUDE
// //                   const pos = [parseFloat(coords[2]), parseFloat(coords[1])];
// //                   console.log("Position:", pos);
// //                   return (
// //                     <Marker key={index} position={pos}>
// //                       <Popup>{event.event_type}</Popup>
// //                     </Marker>
// //                   );
// //                 })}
// //               </MarkerClusterGroup>
// //             )}
// //           </MapContainer>
// //         ) : (
// //           <div>לא נמצאו נתונים</div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // }




//הקוד המעודכן!!

// import React, { useRef, useState, useEffect } from 'react';
// import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
// import L from 'leaflet';
// import { useDrive } from '../hooks/useDrive';
// import RouteLayer from '../components/maps/RouteLayer'; 
// import PointLayer from '../components/maps/PointLayer'; 
// import ClusterLayer from '../components/maps/ClusterLayer'; 
// import MetricsGrid from '../components/metrics/MetricsGrid';

// import 'leaflet/dist/leaflet.css';
// import 'leaflet.markercluster/dist/MarkerCluster.css';
// import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// // פתרון CDN לאייקונים (מונע שגיאות 404 ותצוגת איקסים)
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//     iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//     iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//     shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
// });

// function MapManager({ route, setZoom, mapRef }) {
//   const map = useMap();

//   // פתרון לריבועים הלבנים בטעינה ראשונית
//   useEffect(() => {
//     if (map) {
//       map.invalidateSize();
//       requestAnimationFrame(() => {
//         map.invalidateSize();
//       });
//     }
//   }, [map]);

//   useEffect(() => {
//     if (mapRef && route?.length > 0) {
//       mapRef.current.resetView = () => {
//         const bounds = route.map(p => [p.lat, p.lng]);
//         map.fitBounds(bounds, { padding: [50, 50] });
//       };
//     }
//   }, [route, map, mapRef]);

//   useMapEvents({ zoomend: (e) => setZoom(e.target.getZoom()) });
//   return null;
// }

// export default function TripSummaryPage() {
//   const [driveUuid] = useState('test-drive-123');
//   const [zoom, setZoom] = useState(13);
//   const { data: driveData, isLoading, error } = useDrive(driveUuid);
//   const mapRef = useRef();

//   const handleResetView = () => {
//     if (mapRef.current?.resetView) mapRef.current.resetView();
//   };

//   if (isLoading) return <div className="p-8 text-center">טוען נתוני נסיעה...</div>;
//   if (error) return <div className="p-8 text-red-600">שגיאה: {error.message}</div>;

//   return (
//     <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
//       <header className="p-4 bg-gray-100">
//         <h1 className="text-xl font-bold">סיכום נסיעה: {driveUuid}</h1>
//       </header>
      
//       <div style={{ flex: '1', position: 'relative' }}>
//         {/* כפתור איפוס צף בעיצוב מודרני */}
//         <button 
//           onClick={handleResetView}
//           className="absolute top-4 right-4 z-[1000] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform active:scale-95"
//         >
//           חזור לתצוגה מקורית
//         </button>

//         <MapContainer 
//           ref={mapRef} 
//           center={[32.0853, 34.7818]} 
//           zoom={13} 
//           className="h-full w-full"
//         >
//           <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
//           {driveData?.route && <MapManager route={driveData.route} setZoom={setZoom} mapRef={mapRef} />}
//           {driveData?.route && <RouteLayer route={driveData.route} />}
          
//           {driveData?.events && (
//             zoom < 12 ? <ClusterLayer events={driveData.events} /> : <PointLayer events={driveData.events} />
//           )}
//         </MapContainer>
//       </div>

//       {driveData && (
//         <footer className="p-4 bg-white border-t">
//           <MetricsGrid totals={{ distance: driveData.distance, duration: driveData.duration, score: driveData.score }} />
//         </footer>
//       )}
//     </div>
//   );
// }