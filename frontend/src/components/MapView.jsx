import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Search, Navigation, Loader2, MapPin, Radio, Layers } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import PanelOverlay from './PanelOverlay';
import { formatAge } from '../logic/linkHealth';

/* ---- Status → Color mapping ---- */
const STATUS_COLORS = {
  normal:   '#10b981',
  warning:  '#f59e0b',
  critical: '#ef4444',
  offline:  '#6b7280',
  stale:    '#fb923c',
  suspect:  '#a855f7',
};

/* Helper component to capture map instance */
function MapSetter({ setMap }) {
  const map = useMap();
  useEffect(() => {
    setMap(map);
  }, [map, setMap]);
  return null;
}

/* Helper to track map center coordinates */
function CoordinateTracker({ setCoords }) {
  const map = useMap();
  useEffect(() => {
    const update = () => {
      const c = map.getCenter();
      setCoords({ lat: c.lat, lng: c.lng });
    };
    update();
    map.on('move', update);
    return () => map.off('move', update);
  }, [map, setCoords]);
  return null;
}

/* Helper component for interactive map click location picking */
function MapClickHandler({ isPickingLocation, onLocationPicked, setClickLocation, lastPopupCloseTimeRef }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useMapEvents({
    click(e) {
      if (!ready) return;

      // If a popup was closed less than 300ms ago, ignore event
      if (lastPopupCloseTimeRef && Date.now() - lastPopupCloseTimeRef.current < 300) {
        return;
      }
      
      // Prevent click from re-opening popup if user clicked inside popup or close button
      if (e.originalEvent && e.originalEvent.target) {
        const target = e.originalEvent.target;
        if (
          target.closest('.leaflet-popup') || 
          target.closest('.leaflet-popup-close-button') ||
          target.closest('.leaflet-popup-content-wrapper')
        ) {
          return;
        }
      }

      if (isPickingLocation && onLocationPicked) {
        onLocationPicked({ lat: e.latlng.lat, lng: e.latlng.lng });
        setClickLocation(null);
      } else {
        setClickLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

/* ========== Main MapView Component (Leaflet) ========== */
export default function MapView({ 
  nodes, sectors, gateways = [], 
  selectedNode, onSelectNode, 
  selectedGateway, onSelectGateway,
  isPickingLocation, onLocationPicked,
  onAddNodeAtCoords, onAddAreaAtCoords, onAddGatewayAtCoords
}) {
  const [map, setMap] = useState(null);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [placeResults, setPlaceResults] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [clickLocation, setClickLocation] = useState(null);
  const [centerCoords, setCenterCoords] = useState({ lat: 23.7485, lng: 86.4250 });
  const lastPopupCloseTimeRef = React.useRef(0);

  // Filter sensor nodes
  const nodeResults = nodes.filter(n => 
    n.name.toLowerCase().includes(search.toLowerCase()) || 
    n.id.toLowerCase().includes(search.toLowerCase())
  );

  // Debounced search for places using OpenStreetMap Nominatim API
  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setPlaceResults([]);
      setLoadingPlaces(false);
      return;
    }

    setLoadingPlaces(true);
    const timer = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=4`)
        .then(res => res.json())
        .then(data => {
          const results = data.map(item => ({
            id: `place-${item.place_id}`,
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: 'place'
          }));
          setPlaceResults(results);
        })
        .catch(err => console.error("Place search error:", err))
        .finally(() => setLoadingPlaces(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const handleRecenter = () => {
    if (map) {
      map.flyTo([23.7485, 86.4250], 14, { animate: true });
    }
  };

  const handleSelectNode = (node) => {
    if (map) {
      map.flyTo([node.lat, node.lng], 16, { animate: true });
    }
    onSelectNode(node);
    setSearchedLocation(null);
    setSearch('');
    setShowDropdown(false);
  };

  const handleSelectPlace = (place) => {
    if (map) {
      map.flyTo([place.lat, place.lng], 15, { animate: true });
    }
    setSearchedLocation(place);
    setSearch('');
    setShowDropdown(false);
  };

  return (
    <div className={`map-wrapper ${isPickingLocation ? 'picking-location' : ''}`}>
      {/* Map location picking banner notification */}
      {isPickingLocation && (
        <div className="location-picker-banner">
          <MapPin size={14} className="spin" style={{ marginRight: 6 }} />
          <span>Click anywhere on the map to place the new Sensor Node</span>
        </div>
      )}

      <MapContainer
        center={[23.7485, 86.4250]}
        zoom={14}
        style={{ width: '100%', height: '100%', background: '#0a0e17' }}
        zoomControl={true}
        attributionControl={false}
      >
        <MapSetter setMap={setMap} />
        <CoordinateTracker setCoords={setCenterCoords} />
        <MapClickHandler 
          isPickingLocation={isPickingLocation} 
          onLocationPicked={onLocationPicked} 
          setClickLocation={setClickLocation}
          lastPopupCloseTimeRef={lastPopupCloseTimeRef}
        />
        
        {/* OpenStreetMap tile layer — free */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Panel geometry + mesh topology + gateway (T13) */}
        <PanelOverlay nodes={nodes} />

        {/* Click Popup on empty map spot */}
        {clickLocation && (
          <Popup
            position={[clickLocation.lat, clickLocation.lng]}
            onClose={() => {
              lastPopupCloseTimeRef.current = Date.now();
              setClickLocation(null);
            }}
            eventHandlers={{
              remove: () => {
                lastPopupCloseTimeRef.current = Date.now();
                setClickLocation(null);
              },
            }}
            autoPan={false}
          >
            <div className="popup-map-click">
              <div className="popup-title" style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                📍 Selected Spot
              </div>
              <div className="popup-coords-box" style={{ marginBottom: 8, fontSize: 11 }}>
                <div><strong>Lat:</strong> {clickLocation.lat.toFixed(5)}° N</div>
                <div><strong>Lng:</strong> {clickLocation.lng.toFixed(5)}° E</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <button
                  className="map-action-btn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddNodeAtCoords(clickLocation);
                    setClickLocation(null);
                  }}
                >
                  <Radio size={12} style={{ marginRight: 4 }} /> + Add Node Here
                </button>
                <button
                  className="map-action-btn secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddAreaAtCoords(clickLocation);
                    setClickLocation(null);
                  }}
                >
                  <Layers size={12} style={{ marginRight: 4 }} /> + Create Area Here
                </button>
                <button
                  className="map-action-btn primary"
                  style={{ background: 'var(--accent-safe)', borderColor: 'var(--accent-safe)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddGatewayAtCoords(clickLocation);
                    setClickLocation(null);
                  }}
                >
                  <Radio size={12} style={{ marginRight: 4 }} /> + Add Gateway Here
                </button>
              </div>
            </div>
          </Popup>
        )}

        {/* Searched Location Marker */}
        {searchedLocation && (
          <CircleMarker
            center={[searchedLocation.lat, searchedLocation.lng]}
            radius={8}
            pathOptions={{
              color: '#38bdf8',
              weight: 2,
              fillColor: '#0284c7',
              fillOpacity: 0.85,
            }}
          >
            <Popup autoPan={true}>
              <div className="popup-place">
                <div className="popup-title" style={{ fontSize: 12, fontWeight: 600 }}>
                  📍 {searchedLocation.name}
                </div>
                <div className="popup-coords-box" style={{ fontSize: 11 }}>
                  <div><strong>Latitude:</strong> {searchedLocation.lat.toFixed(5)}° N</div>
                  <div><strong>Longitude:</strong> {searchedLocation.lng.toFixed(5)}° E</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Gateway Markers */}
        {gateways.map(gw => {
          const isSelected = selectedGateway === gw.id;
          return (
            <CircleMarker
              key={gw.id}
              center={[gw.lat, gw.lng]}
              radius={isSelected ? 10 : 8}
              pathOptions={{
                color: '#e2e8f0',
                weight: 2,
                fillColor: '#3b82f6',
                fillOpacity: 1,
              }}
              eventHandlers={{
                click: (e) => {
                  if (e.originalEvent) e.originalEvent.stopPropagation();
                  setClickLocation(null);
                  onSelectGateway(isSelected ? null : gw.id);
                },
              }}
            >
              <Popup autoPan={false}>
                <div style={{ fontFamily: "'Inter', sans-serif", color: '#f1f5f9' }}>
                  <div className="popup-title" style={{ fontSize: 13, color: '#3b82f6' }}>{gw.name}</div>
                  <div className="popup-id" style={{ fontSize: 10 }}>{gw.id}</div>
                  <div style={{ fontSize: 10, marginTop: 4 }}>
                    Nodes Connected: {nodes.filter(n => n.gateway_id === gw.id).length}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Links from Nodes to Gateways */}
        {nodes.map(node => {
          const gw = gateways.find(g => g.id === node.gateway_id);
          if (!gw) return null;
          
          // Draw line if either gateway or node is selected, or if nothing is selected (showing network)
          // Actually, drawing all lines might be messy, let's draw lines for selected gateway or node
          const showLine = selectedGateway === gw.id || selectedNode?.id === node.id;
          if (!showLine) return null;

          return (
            <Polyline
              key={`link-${node.id}`}
              positions={[[node.lat, node.lng], [gw.lat, gw.lng]]}
              pathOptions={{
                color: '#38bdf8',
                weight: 1.5,
                opacity: 0.5,
                dashArray: '4, 4'
              }}
            />
          );
        })}

        {/* Sensor Node Markers */}
        {nodes.map(node => {
          const color = STATUS_COLORS[node.status] || '#6b7280';
          const isSelected = selectedNode?.id === node.id;
          const isCritical = node.status === 'critical';

          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={isSelected ? 8 : isCritical ? 7 : 5}
              pathOptions={{
                color: 'white',
                weight: isSelected ? 2.5 : 1.5,
                fillColor: color,
                fillOpacity: 0.9,
              }}
              eventHandlers={{
                click: (e) => {
                  if (e.originalEvent) {
                    e.originalEvent.stopPropagation();
                  }
                  setClickLocation(null);
                  onSelectNode(node);
                },
              }}
            >
              <Popup>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  color: '#f1f5f9',
                  minWidth: 180,
                }}>
                  <div className="popup-title" style={{ fontSize: 12 }}>{node.name}</div>
                  <div className="popup-id" style={{ fontSize: 10 }}>{node.id}</div>
                  <div className="popup-coords-box" style={{ marginBottom: 6, fontSize: 10 }}>
                    <div><strong>GPS:</strong> {node.lat.toFixed(4)}° N, {node.lng.toFixed(4)}° E</div>
                  </div>
                  <div className="popup-stats">
                    <div>
                      <div className="popup-stat-label">Tilt (resultant)</div>
                      <div className={`popup-stat-value mono ${
                        node.tilt_resultant_mm_per_m >= 5 ? 'text-critical' :
                        node.tilt_resultant_mm_per_m >= 2 ? 'text-warning' : 'text-safe'
                      }`}>{node.tilt_resultant_mm_per_m.toFixed(1)} mm/m</div>
                    </div>
                    <div>
                      <div className="popup-stat-label">Crack</div>
                      <div className="popup-stat-value mono">{node.crack_mm.toFixed(1)} mm</div>
                    </div>
                    <div>
                      <div className="popup-stat-label">Settlement (inferred)</div>
                      <div className="popup-stat-value mono">
                        {node.settlement_inferred_mm.toFixed(1)} ± {node.settlement_err_mm.toFixed(1)} mm
                      </div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>
                        {node.settlement_method} · ref {node.settlement_ref_node}
                      </div>
                    </div>
                    <div>
                      <div className="popup-stat-label">Battery</div>
                      <div className={`popup-stat-value mono ${
                        node.battery_pct < 20 ? 'text-critical' :
                        node.battery_pct < 50 ? 'text-warning' : 'text-safe'
                      }`}>{node.battery_pct}%</div>
                    </div>
                    <div>
                      <div className="popup-stat-label">Mesh path</div>
                      <div className="popup-stat-value mono" style={{ fontSize: 10 }}>
                        {node.hops_to_gateway} hops → {node.parent_node || 'GW-1'} → {node.gateway_id}
                      </div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>
                        RSSI {node.rssi_dbm} dBm · {node.packet_loss_pct}% loss
                      </div>
                    </div>
                    <div>
                      <div className="popup-stat-label">Status</div>
                      <div className={`popup-stat-value ${
                        node.status === 'critical' ? 'text-critical' :
                        node.status === 'warning' ? 'text-warning' : 'text-safe'
                      }`} style={{ textTransform: 'uppercase', fontSize: 10 }}>
                        {node.status}
                        {node.link_state !== 'ok' && ` · ${node.link_state}`}
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Top Center Search Bar */}
      <div className="map-search-container">
        <Search size={14} className="search-icon" />
        <input 
          type="text" 
          placeholder="Search nodes or any location (e.g. Jharia)..." 
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
        />
        {showDropdown && search && (
          <div className="search-dropdown">
            {/* Sensor Nodes Section */}
            {nodeResults.length > 0 && (
              <div className="search-section">
                <div className="search-section-header">📡 SENSOR NODES</div>
                {nodeResults.map(n => (
                  <div key={n.id} className="search-item" onClick={() => handleSelectNode(n)}>
                    <div className="search-item-main">
                      <span className="search-item-name">{n.name}</span>
                      <span className="search-item-id">{n.id}</span>
                    </div>
                    <div className="search-item-coords">
                      📍 Lat: {n.lat.toFixed(4)}° N, Lng: {n.lng.toFixed(4)}° E
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Places Section */}
            {loadingPlaces ? (
              <div className="search-item empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Loader2 size={13} className="spin" /> Searching places...
              </div>
            ) : placeResults.length > 0 ? (
              <div className="search-section">
                <div className="search-section-header">🌍 PLACES</div>
                {placeResults.map(p => (
                  <div key={p.id} className="search-item" onClick={() => handleSelectPlace(p)}>
                    <div className="search-item-main">
                      <span className="search-item-name">{p.name}</span>
                    </div>
                    <div className="search-item-coords">
                      🌐 Lat: {p.lat ? p.lat.toFixed(4) : "0.0000"}° N, Lng: {p.lng ? p.lng.toFixed(4) : "0.0000"}° E
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {nodeResults.length === 0 && placeResults.length === 0 && !loadingPlaces && (
              <div className="search-item empty">No nodes or places found</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Left Recenter Button */}
      <button className="recenter-btn" onClick={handleRecenter} title="Reset Map View" aria-label="Reset map view">
         <Navigation size={15} />
      </button>

      {/* Bottom Right Live Map Coordinates Indicator */}
      <div className="map-coords-badge">
        🌐 Lat: {centerCoords.lat.toFixed(4)}° N | Lng: {centerCoords.lng.toFixed(4)}° E
      </div>
    </div>
  );
}