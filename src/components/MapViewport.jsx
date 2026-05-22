import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import L from 'leaflet';

// Standard result pin
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Custom User Pin (Blue circle with a "U" to mimic the user icon)
const UserIcon = new L.DivIcon({
  html: `<div style="background-color: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">U</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Helper to auto-fit the map to show everything (viewport + pins)
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
  }, [bounds, map]);
  return null;
}

export default function MapViewport({ resultLat, resultLng, resultName, userLat, userLng, viewportBounds }) {
  // If no data, center on a default location
  const centerLat = resultLat || 20.5937;
  const centerLng = resultLng || 78.9629;

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer center={[centerLat, centerLng]} zoom={11} style={{ height: '100%', width: '100%', zIndex: 1 }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* 1. The Result Pin */}
        {resultLat && resultLng && (
          <Marker position={[resultLat, resultLng]}>
            <Popup><strong>{resultName}</strong></Popup>
          </Marker>
        )}

        {/* 2. The User Location Pin */}
        {userLat && userLng && (
          <Marker position={[userLat, userLng]} icon={UserIcon}>
            <Popup>User Location</Popup>
          </Marker>
        )}

        {/* 3. The Viewport Rectangle (Purple shaded area) */}
        {viewportBounds && (
          <Rectangle bounds={viewportBounds} pathOptions={{ color: '#8b5cf6', weight: 2, fillOpacity: 0.2 }} />
        )}

        {/* Auto-zoom to fit the viewport */}
        {viewportBounds && <FitBounds bounds={viewportBounds} />}
      </MapContainer>
    </div>
  );
}