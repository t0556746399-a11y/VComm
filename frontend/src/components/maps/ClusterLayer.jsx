import React from 'react';
import L from 'leaflet';
import { Marker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { getIconForType } from '../violations/violationConfig';

export default function ClusterLayer({ events = [] }) {
  if (!events.length) return null;

  return (
    <MarkerClusterGroup
      chunkedLoading
      zoomToBoundsOnClick={true}
      spiderfyOnMaxZoom={true}
      maxClusterRadius={50}
    >
      {events.map((event) => (
        <Marker
          key={event.id ?? event.event_id}
          position={[event.lat, event.lng]}
          icon={getIconForType(event.type ?? event.event_type) || new L.Icon.Default()}
        />
      ))}
    </MarkerClusterGroup>
  );
}