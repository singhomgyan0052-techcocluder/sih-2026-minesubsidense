/** ============================================
 *  PanelOverlay — renders mining-specific geometry
 *  on the Leaflet map.
 *
 *  - Panel boundary polygon
 *  - Goaf (extracted area) polygon
 *  - Depillaring face line with advance direction
 *  - Influence zone circles per node
 *  - Mesh topology lines (node → parent → gateway)
 *  - Gateway marker
 *  ============================================ */

import React from 'react';
import { Polygon, Polyline, Circle, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import {
  PANEL_BOUNDARY,
  GOAF_POLYGON,
  FACE_LINE,
  ADVANCE_DIRECTION,
  GATEWAY,
} from '../data/panelA.geojson.js';
import { influenceRadiusM, PANEL_GEOM } from '../model/constants';

/** Reverse [lng, lat] GeoJSON coords to [lat, lng] for Leaflet */
function toLatLng(coords) {
  if (Array.isArray(coords[0])) {
    return coords.map(toLatLng);
  }
  return [coords[1], coords[0]];
}

/** Link style by quality */
function linkStyle(node) {
  if (node.link_state === 'offline') {
    return { color: '#ef4444', weight: 1.5, dashArray: '4 4', opacity: 0.7 };
  }
  if (node.link_state === 'stale') {
    return { color: '#f59e0b', weight: 1.5, dashArray: '6 4', opacity: 0.6 };
  }
  return { color: '#38bdf8', weight: 1, dashArray: '3 3', opacity: 0.4 };
}

export default function PanelOverlay({ nodes }) {
  const influenceRadius = influenceRadiusM(PANEL_GEOM.depth_m, PANEL_GEOM.angle_of_draw_deg);

  // Build a lookup for node positions
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  // Mesh lines: each node → its parent_node → gateway
  const meshLines = [];
  nodes.forEach(node => {
    if (!node.parent_node) return;

    let targetLat, targetLng, targetLabel;
    if (node.parent_node === 'GW-1' || node.parent_node === GATEWAY.id) {
      targetLat = GATEWAY.lat;
      targetLng = GATEWAY.lng;
      targetLabel = GATEWAY.id;
    } else if (nodeMap[node.parent_node]) {
      targetLat = nodeMap[node.parent_node].lat;
      targetLng = nodeMap[node.parent_node].lng;
      targetLabel = node.parent_node;
    } else {
      return; // parent not found
    }

    meshLines.push({
      id: `mesh-${node.id}-${targetLabel}`,
      from: [node.lat, node.lng],
      to: [targetLat, targetLng],
      style: linkStyle(node),
      nodeId: node.id,
      parentId: targetLabel,
    });
  });

  return (
    <>
      {/* Panel boundary */}
      <Polygon
        positions={toLatLng(PANEL_BOUNDARY.coordinates[0])}
        pathOptions={{
          color: '#38bdf8',
          weight: 1.5,
          dashArray: '8 4',
          fillColor: '#38bdf8',
          fillOpacity: 0.03,
          interactive: false,
        }}
      />

      {/* Goaf (extracted area) */}
      <Polygon
        positions={toLatLng(GOAF_POLYGON.coordinates[0])}
        pathOptions={{
          color: '#8b5cf6',
          weight: 1,
          dashArray: '4 2',
          fillColor: '#8b5cf6',
          fillOpacity: 0.08,
          interactive: false,
        }}
      />

      {/* Face line */}
      <Polyline
        positions={toLatLng(FACE_LINE.coordinates)}
        pathOptions={{
          color: '#ef4444',
          weight: 2.5,
          dashArray: null,
          opacity: 0.8,
          interactive: false,
        }}
      />

      {/* Advance direction arrow */}
      <Polyline
        positions={[
          toLatLng(ADVANCE_DIRECTION.from),
          toLatLng(ADVANCE_DIRECTION.to),
        ]}
        pathOptions={{
          color: '#ef4444',
          weight: 2,
          opacity: 0.6,
          interactive: false,
        }}
      />

      {/* Influence zone circles */}
      {nodes.filter(n => !n.is_reference).map(node => (
        <Circle
          key={`influence-${node.id}`}
          center={[node.lat, node.lng]}
          radius={influenceRadius}
          pathOptions={{
            color: '#f59e0b',
            weight: 0.8,
            dashArray: '3 3',
            fillColor: '#f59e0b',
            fillOpacity: 0.04,
            interactive: false,
          }}
        />
      ))}

      {/* Mesh topology lines */}
      {meshLines.map(line => (
        <Polyline
          key={line.id}
          positions={[line.from, line.to]}
          pathOptions={{ ...line.style, interactive: false }}
        />
      ))}

      {/* Gateway marker */}
      <CircleMarker
        center={[GATEWAY.lat, GATEWAY.lng]}
        radius={8}
        pathOptions={{
          color: '#10b981',
          weight: 2.5,
          fillColor: '#065f46',
          fillOpacity: 0.9,
        }}
      >
        <Popup>
          <div style={{ fontFamily: "'Inter', sans-serif", color: '#f1f5f9', minWidth: 140 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              📡 {GATEWAY.name}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{GATEWAY.id}</div>
            <div style={{ fontSize: 10, color: '#06b6d4', marginTop: 4 }}>
              Internet backhaul · LoRa mesh root
            </div>
          </div>
        </Popup>
        <Tooltip direction="right" permanent>
          <span style={{ fontSize: 9, fontWeight: 600 }}>{GATEWAY.id}</span>
        </Tooltip>
      </CircleMarker>
    </>
  );
}
