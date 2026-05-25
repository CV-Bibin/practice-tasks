import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Rectangle, Popup, useMap, LayersControl } from 'react-leaflet';
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// 1. Upgraded Custom Icons
const UserIcon = new L.DivIcon({
  html: `<div style="background-color: #3b82f6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px;">
            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" />
          </svg>
         </div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export const pinColors = ["#8b5cf6", "#3b82f6", "#22c55e", "#ef4444", "#eab308"];

const getNumberedPin = (num, index) =>
  new L.DivIcon({
    html: `<div style="background-color: ${pinColors[index]}; color: white; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          <span style="transform: rotate(45deg); font-weight: bold; font-size: 14px;">${num}</span>
         </div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

// 2. Map Helpers
export const getLat = (str) => (str ? str.split(",")[0]?.trim() : "");
export const getLng = (str) => (str ? str.split(",")[1]?.trim() : "");

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng && !isNaN(lat) && !isNaN(lng))
      map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

// Helper button to calculate bounds and fit everything into the viewport
function CenterMapButton({ userCoords, viewportCoords, viewportSize, results }) {
  const map = useMap();

  const handleCenterAll = () => {
    const points = [];

    const vLat = getLat(viewportCoords);
    const vLng = getLng(viewportCoords);
    if (vLat && vLng && !isNaN(vLat) && !isNaN(vLng)) {
      points.push([parseFloat(vLat), parseFloat(vLng)]);
    }

    const uLat = getLat(userCoords);
    const uLng = getLng(userCoords);
    if (uLat && uLng && !isNaN(uLat) && !isNaN(uLng)) {
      points.push([parseFloat(uLat), parseFloat(uLng)]);
    }

    results.forEach(res => {
      const rLat = getLat(res.coords);
      const rLng = getLng(res.coords);
      if (rLat && rLng && !isNaN(rLat) && !isNaN(rLng)) {
        points.push([parseFloat(rLat), parseFloat(rLng)]);
      }
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  const handleFocusViewport = () => {
    const vLat = getLat(viewportCoords);
    const vLng = getLng(viewportCoords);
    
    if (vLat && vLng && !isNaN(vLat) && !isNaN(vLng)) {
      const offset = parseFloat(viewportSize) || 0.015;
      const bounds = L.latLngBounds([
        [parseFloat(vLat) - offset, parseFloat(vLng) - offset],
        [parseFloat(vLat) + offset, parseFloat(vLng) + offset]
      ]);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  };

  const btnStyle = {
    backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px',
    width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 1px 5px rgba(0,0,0,0.2)', transition: 'background-color 0.2s'
  };

 return (
    <div style={{ position: 'absolute', top: '84px', left: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      
      {/* Button 1: Center All Pins */}
      <button type="button" onClick={handleCenterAll} title="Center Map to show all Pins" style={btnStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#334155" style={{ width: '18px', height: '18px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
        </svg>
      </button>

      {/* Button 2: Focus Viewport Box */}
      <button type="button" onClick={handleFocusViewport} title="Zoom into Viewport Bounds" style={btnStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#3b82f6" style={{ width: '18px', height: '18px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M3.75 16.5v1.5A2.25 2.25 0 006 20.25h1.5M16.5 20.25H18A2.25 2.25 0 0020.25 18v-1.5M12 12h.008v.008H12V12z" />
        </svg>
      </button>

    </div>
  );
}

export default function TaskMapPreview({ userCoords, viewportCoords, viewportSize, results }) {
  // NEW: State for standalone Viewport Popup
  const [viewportPopupPos, setViewportPopupPos] = useState(null);

  const vLat = getLat(viewportCoords);
  const vLng = getLng(viewportCoords);
  const uLat = getLat(userCoords);
  const uLng = getLng(userCoords);

  const getViewportBounds = () => {
    if (!vLat || !vLng || isNaN(vLat) || isNaN(vLng)) return null;
    const offset = parseFloat(viewportSize); 
    return [
      [parseFloat(vLat) - offset, parseFloat(vLng) - offset],
      [parseFloat(vLat) + offset, parseFloat(vLng) + offset]
    ];
  };

  const bounds = getViewportBounds();
  const centerLat = parseFloat(vLat) || parseFloat(uLat) || 20.5937;
  const centerLng = parseFloat(vLng) || parseFloat(uLng) || 78.9629;

  return (
    <MapContainer center={[centerLat, centerLng]} zoom={12} style={{ height: '100%', width: '100%', borderRadius: '6px', zIndex: 1 }}>
      
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Standard Map">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="Satellite View">
          <TileLayer 
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
            attribution="Tiles &copy; Esri &mdash; Source: Esri"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <MapRecenter lat={vLat} lng={vLng} />
      <CenterMapButton 
        userCoords={userCoords} 
        viewportCoords={viewportCoords} 
        viewportSize={viewportSize} 
        results={results} 
      />
      
      {/* --- 1. VIEWPORT RECTANGLE WITH CLICK FIX --- */}
      {bounds && (
        <>
          <Rectangle 
            bounds={bounds} 
            pathOptions={{ color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.2 }} 
            eventHandlers={{
              click: (e) => {
                // Stop click from closing the popup instantly
                L.DomEvent.stopPropagation(e.originalEvent); 
                // Set popup exactly to the center
                setViewportPopupPos([parseFloat(vLat), parseFloat(vLng)]);
              }
            }}
          />
          {/* Standalone Popup for the Viewport */}
          {viewportPopupPos && (
            <Popup 
              position={viewportPopupPos} 
              autoClose={false} 
              closeOnClick={false} 
              onClose={() => setViewportPopupPos(null)}
            >
              <div style={{ textAlign: 'center' }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#3b82f6' }}>Viewport Center</strong>
                Lat: {viewportPopupPos[0].toFixed(4)}
                <br />
                Lng: {viewportPopupPos[1].toFixed(4)}
              </div>
            </Popup>
          )}
        </>
      )}

      {/* --- 2. USER LOCATION PIN --- */}
      {uLat && uLng && !isNaN(uLat) && (
        <Marker position={[parseFloat(uLat), parseFloat(uLng)]} icon={UserIcon}>
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>User Location</strong>
              Lat: {parseFloat(uLat).toFixed(4)}
              <br />
              Lng: {parseFloat(uLng).toFixed(4)}
            </div>
          </Popup>
        </Marker>
      )}

      {/* --- 3. RESULT PINS --- */}
      {results.map((res, index) => {
        const rLat = getLat(res.coords);
        const rLng = getLng(res.coords);
        if (!rLat || !rLng || isNaN(rLat)) return null;
        return (
          <Marker key={res.id} position={[parseFloat(rLat), parseFloat(rLng)]} icon={getNumberedPin(index + 1, index)}>
            <Popup>
              <strong>{index + 1}. {res.name || 'Unnamed Result'}</strong><br/>
              {res.address}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}