import React, { useState } from 'react';
import { X, Plus, MapPin, Layers, Radio } from 'lucide-react';
import { makeNode } from '../model/nodeShape';

let nodeCounter = 100;
let sectorCounter = 100;

/* ========== Modal to Add New Area / Sector ========== */
export function AddAreaModal({ isOpen, onClose, onAddArea }) {
  const [areaName, setAreaName] = useState('');
  const [sectorCode, setSectorCode] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!areaName.trim()) return;

    sectorCounter += 1;
    const newArea = {
      id: sectorCode.toUpperCase() || `PANEL-${sectorCounter}`,
      name: areaName.trim(),
      description: description.trim() || 'Coal Mine Monitoring Zone',
      created_at: new Date().toISOString(),
    };

    onAddArea(newArea);
    setAreaName('');
    setSectorCode('');
    setDescription('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card">
        <div className="modal-header">
          <div className="modal-title">
            <Layers size={18} className="text-blue" style={{ marginRight: 8 }} />
            Add New Mine Panel / Sector
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Panel / Sector Name *</label>
            <input
              type="text"
              placeholder="e.g. Panel B — South Entry"
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Panel Code / Short ID</label>
            <input
              type="text"
              placeholder="e.g. PANEL-B (Auto-generated if blank)"
              value={sectorCode}
              onChange={(e) => setSectorCode(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Description / Notes</label>
            <textarea
              placeholder="Underground coal extraction field, high subsidence risk..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={16} style={{ marginRight: 4 }} /> Create Area
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========== Modal to Add New Gateway ========== */
export function AddGatewayModal({ isOpen, onClose, onAddGateway, areas = [], initialCoords, onPickLocationOnMap }) {
  const [gatewayName, setGatewayName] = useState('');
  const [gatewayCode, setGatewayCode] = useState('');
  const [areaId, setAreaId] = useState(areas[0]?.id || 'AREA-1');
  const [lat, setLat] = useState(initialCoords?.lat || 23.7957);
  const [lng, setLng] = useState(initialCoords?.lng || 86.4304);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!gatewayName.trim()) return;

    sectorCounter += 1;
    const newGateway = {
      id: gatewayCode.toUpperCase() || `GW-${sectorCounter}`,
      name: gatewayName.trim(),
      area_id: areaId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      status: 'active',
      created_at: new Date().toISOString(),
    };

    onAddGateway(newGateway);
    setGatewayName('');
    setGatewayCode('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card">
        <div className="modal-header">
          <div className="modal-title">
            <Radio size={18} className="text-safe" style={{ marginRight: 8 }} />
            Add New Gateway
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Gateway Name *</label>
            <input
              type="text"
              placeholder="e.g. Gateway North"
              value={gatewayName}
              onChange={(e) => setGatewayName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Gateway Code / Short ID</label>
            <input
              type="text"
              placeholder="e.g. GW-2 (Auto-generated if blank)"
              value={gatewayCode}
              onChange={(e) => setGatewayCode(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Area / Sector</label>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name} ({area.id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label style={{ margin: 0 }}>GPS Coordinates (Lat / Lng)</label>
            <div className="form-row">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={16} style={{ marginRight: 4 }} /> Create Gateway
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========== Modal to Add New Sensor Node ========== */
export function AddNodeModal({ isOpen, onClose, onAddNode, sectors, gateways = [], initialCoords, onPickLocationOnMap }) {
  const [name, setName] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [sectorName, setSectorName] = useState(sectors[0]?.name || 'Panel A — Seam 3');
  const [gatewayId, setGatewayId] = useState(gateways[0]?.id || 'GW-1');
  const [lat, setLat] = useState(initialCoords?.lat || 23.7957);
  const [lng, setLng] = useState(initialCoords?.lng || 86.4304);

  // Sync initialCoords prop
  React.useEffect(() => {
    if (initialCoords) {
      setLat(initialCoords.lat);
      setLng(initialCoords.lng);
    }
  }, [initialCoords]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    nodeCounter += 1;
    const id = nodeId.toUpperCase() || `NODE-${nodeCounter}`;
    const newNode = makeNode({
      id,
      name: `${sectorName.split('—')[0].trim()} — ${name.trim()}`,
      panel_id: 'PANEL-A',
      gateway_id: gatewayId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      last_seen_epoch_s: Math.floor(Date.now() / 1000),
    });

    onAddNode(newNode);
    setName('');
    setNodeId('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card">
        <div className="modal-header">
          <div className="modal-title">
            <Radio size={18} className="text-cyan" style={{ marginRight: 8 }} />
            Deploy New Sensor Node
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Node Name / Label *</label>
            <input
              type="text"
              placeholder="e.g. Pillar-Sensor 9"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Node ID</label>
              <input
                type="text"
                placeholder="e.g. NODE-009"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Assign to Area / Sector</label>
              <select value={sectorName} onChange={(e) => setSectorName(e.target.value)}>
                {sectors.map((sec) => (
                  <option key={sec.id || sec.name} value={sec.name}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Gateway</label>
            <select value={gatewayId} onChange={(e) => setGatewayId(e.target.value)}>
              {gateways.map((gw) => (
                <option key={gw.id} value={gw.id}>
                  {gw.name} ({gw.id})
                </option>
              ))}
            </select>
          </div>

          {/* Coordinates section with map picker trigger */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ margin: 0 }}>GPS Coordinates (Lat / Lng)</label>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  onClose();
                  onPickLocationOnMap();
                }}
              >
                <MapPin size={13} style={{ marginRight: 4 }} /> Pick location on Map
              </button>
            </div>
            <div className="form-row">
              <input
                type="number"
                step="any"
                placeholder="Latitude (e.g. 23.7957)"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude (e.g. 86.4304)"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={16} style={{ marginRight: 4 }} /> Deploy Node
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
