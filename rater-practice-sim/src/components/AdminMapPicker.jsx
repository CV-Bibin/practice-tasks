import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useState } from 'react';
import L from 'leaflet';

// A helper component that listens for clicks on the map
function MapClickListener({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function AdminMapPicker({ setCoordinates }) {
  const [markerPos, setMarkerPos] = useState(null);

  const handleMapClick = (lat, lng) => {
    setMarkerPos([lat, lng]);
    setCoordinates({ lat, lng }); // Sends the data back up to your form state
  };

  return (
    <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '400px', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapClickListener onMapClick={handleMapClick} />
      {markerPos && <Marker position={markerPos} />}
    </MapContainer>
  );
}