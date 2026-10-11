import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';

export default function EventsMap({ events }) {
  const validEvents = events.filter(
    (e) => typeof e.latitude === 'number' && typeof e.longitude === 'number'
  );

  if (validEvents.length === 0) {
    return (
      <div style={{ padding: '16px', color: '#6B7280', textAlign: 'center' }}>
        אין נתוני מיקום (latitude/longitude) להצגה במפה
      </div>
    );
  }

  return (
    <MapContainer
      center={[validEvents[0].latitude, validEvents[0].longitude]}
      zoom={8}
      style={{ height: '400px', width: '100%', borderRadius: '8px' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <MarkerClusterGroup chunkedLoading>
        {validEvents.map((event) => (
          <Marker key={event.event_id} position={[event.latitude, event.longitude]}>
            <Popup>
              <div style={{ direction: 'rtl', textAlign: 'right' }}>
                <b>{event.event_type}</b><br />
                נהג: {event.driver_id}<br />
                חומרה: {event.severity}<br />
                זמן: {new Date(event.event_ts).toLocaleString('he-IL')}
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}