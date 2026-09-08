import React, { useState, useEffect } from 'react';
import {
  X, Battery, Signal, Clock, TrendingDown, Activity, Droplets,
  Gauge, Radio, Zap, ArrowDown, ChevronRight, Plus, Layers, Info, Filter, Wifi, Hexagon, ShieldAlert, AlertTriangle, Code, Cpu
} from 'lucide-react';
import { TILT, HYST, VIB_RMS_G, CRACK_MM, BATTERY_PCT } from '../model/constants';
import { formatAge } from '../logic/linkHealth';
import { computeRiskIndex } from '../logic/riskIndex';
import { mmPerMToDeg } from '../model/constants';

/* ========== Left Sidebar: Fleet Overview ========== */
export function FleetSidebar({
  nodes, gateways,
  selectedNode, onSelectNode,
  selectedGateway, onSelectGateway,
  filter, onFilterChange,
  onOpenAddGatewayModal, onOpenAddAreaModal, onOpenAddNodeModal, onOpenHardwareModal,
  user, onLogout
}) {
  const filteredNodes = filter === 'all'
    ? nodes
    : nodes.filter(n => n.status === filter);

  const counts = {
    all: nodes.length,
    normal: nodes.filter(n => n.status === 'normal').length,
    warning: nodes.filter(n => n.status === 'warning').length,
    critical: nodes.filter(n => n.status === 'critical').length,
    stale: nodes.filter(n => n.status === 'stale').length,
    suspect: nodes.filter(n => n.status === 'suspect').length,
    offline: nodes.filter(n => n.status === 'offline').length,
  };

  const [collapsedGateways, setCollapsedGateways] = useState({});

  const toggleGateway = (gwId) => {
    setCollapsedGateways(prev => ({ ...prev, [gwId]: !prev[gwId] }));
    onSelectGateway(selectedGateway === gwId ? null : gwId);
  };

  // Catch nodes whose gateway_id is not in gateways list
  const knownGwIds = new Set(gateways.map(g => g.id));
  const unassignedNodes = filteredNodes.filter(n => !n.gateway_id || !knownGwIds.has(n.gateway_id));

  return (
    <div className="sidebar-left">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="sidebar-title" style={{ margin: 0 }}>
            <Radio size={12} style={{ display: 'inline', marginRight: 4 }} />
            Sensor Fleet ({nodes.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn-add-mini" onClick={onOpenAddGatewayModal} title="Add New Gateway" aria-label="Add new gateway">
              <Radio size={11} style={{ marginRight: 3 }} /> + GW
            </button>
            <button className="btn-add-mini" onClick={onOpenAddAreaModal} title="Add New Sector / Area" aria-label="Add new sector">
              <Layers size={11} style={{ marginRight: 3 }} /> + Area
            </button>
            <button className="btn-add-mini primary" onClick={onOpenAddNodeModal} title="Deploy New Sensor Node" aria-label="Deploy new node">
              <Plus size={11} style={{ marginRight: 3 }} /> + Node
            </button>
          </div>
        </div>

        <div className="sidebar-filters">
          {['all', 'normal', 'warning', 'critical', 'stale', 'suspect', 'offline'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => onFilterChange(f)}
              aria-label={`Filter by ${f}`}
            >
              {f === 'all' ? `All (${counts.all})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 12px 12px 12px' }}>
        <button className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} onClick={onOpenHardwareModal}>
          <Code size={14} /> Hardware Integration
        </button>
      </div>

      <div className="sidebar-nodes">
        {gateways.map(gw => {
          const gwNodes = filteredNodes.filter(n => n.gateway_id === gw.id);
          const isCollapsed = collapsedGateways[gw.id];
          const isSelected = selectedGateway === gw.id;
          
          if (gwNodes.length === 0 && filter !== 'all') return null;

          return (
            <div key={gw.id} style={{ marginBottom: 8 }}>
              <div
                className={`gateway-header ${isSelected ? 'expanded' : ''}`}
                onClick={() => toggleGateway(gw.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isSelected ? 'rgba(56, 189, 248, 0.4)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-md)', cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Radio size={14} color="var(--accent-blue)" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{gw.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{gw.id}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {gwNodes.length} nodes {isCollapsed ? '►' : '▼'}
                </div>
              </div>

              {!isCollapsed && (
                <div style={{ paddingLeft: 12, marginTop: 4, borderLeft: '1px solid var(--border-color)', marginLeft: 6 }}>
                  {gwNodes.map(node => {
                    const isNodeSelected = selectedNode?.id === node.id;
                    const batteryClass = node.battery_pct > 60 ? 'high' : node.battery_pct > 20 ? 'medium' : 'low';
                    const isStale = node.link_state === 'stale' || node.link_state === 'offline';
                    const riskVal = node.risk_index ?? computeRiskIndex(node).index;
                    const riskColor = riskVal >= 65 ? 'var(--accent-critical)' : riskVal >= 35 ? 'var(--accent-warning)' : 'var(--accent-safe)';

                    return (
                      <div
                        key={node.id}
                        className={`node-card ${isNodeSelected ? 'selected' : ''}`}
                        onClick={() => onSelectNode(node)}
                      >
                        <span className={`node-status-dot ${node.status}`} />
                        <div className="node-card-info">
                          <div className="node-card-name" style={isStale ? { opacity: 0.5 } : undefined}>
                            {isStale && <span style={{ fontSize: 9, marginRight: 4 }}>last reading · </span>}
                            {node.name}
                          </div>
                          <div className="node-card-id">
                            {node.id}
                            <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--text-muted)' }}>
                              {formatAge(node.data_age_s)}
                            </span>
                            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: riskColor, background: 'rgba(15,23,42,0.6)', padding: '1px 4px', borderRadius: 3 }}>
                              Risk {riskVal}
                            </span>
                          </div>
                        </div>
                        <div className="node-card-battery">
                          <div className="battery-bar">
                            <div
                              className={`battery-fill ${batteryClass}`}
                              style={{ width: `${node.battery_pct}%` }}
                            />
                          </div>
                          <span className="battery-pct">{node.battery_pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Render unassigned or newly added nodes */}
        {unassignedNodes.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', padding: '4px 8px', textTransform: 'uppercase' }}>
              📡 Additional Active Nodes ({unassignedNodes.length})
            </div>
            <div style={{ paddingLeft: 6 }}>
              {unassignedNodes.map(node => {
                const isNodeSelected = selectedNode?.id === node.id;
                const batteryClass = node.battery_pct > 60 ? 'high' : node.battery_pct > 20 ? 'medium' : 'low';
                const isStale = node.link_state === 'stale' || node.link_state === 'offline';
                const riskVal = node.risk_index ?? computeRiskIndex(node).index;
                const riskColor = riskVal >= 65 ? 'var(--accent-critical)' : riskVal >= 35 ? 'var(--accent-warning)' : 'var(--accent-safe)';

                return (
                  <div
                    key={node.id}
                    className={`node-card ${isNodeSelected ? 'selected' : ''}`}
                    onClick={() => onSelectNode(node)}
                  >
                    <span className={`node-status-dot ${node.status}`} />
                    <div className="node-card-info">
                      <div className="node-card-name" style={isStale ? { opacity: 0.5 } : undefined}>
                        {node.name}
                      </div>
                      <div className="node-card-id">
                        {node.id}
                        <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--text-muted)' }}>
                          {formatAge(node.data_age_s)}
                        </span>
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: riskColor, background: 'rgba(15,23,42,0.6)', padding: '1px 4px', borderRadius: 3 }}>
                          Risk {riskVal}
                        </span>
                      </div>
                    </div>
                    <div className="node-card-battery">
                      <div className="battery-bar">
                        <div
                          className={`battery-fill ${batteryClass}`}
                          style={{ width: `${node.battery_pct}%` }}
                        />
                      </div>
                      <span className="battery-pct">{node.battery_pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredNodes.length === 0 && (
          <div className="no-selection" style={{ padding: '32px 16px' }}>
            <div className="no-selection-icon">📡</div>
            <div className="no-selection-text">No nodes in this category</div>
          </div>
        )}
      </div>

    </div>
  );
}

/* ========== Right Detail Panel ========== */
export function DetailPanel({ node, onClose, alerts = [] }) {
  const [showRiskBreakdown, setShowRiskBreakdown] = useState(false);
  const [aiRisk, setAiRisk] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (node) {
      setLoadingAi(true);
      fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/nodes/${node.id}/ai_risk`)
        .then(res => res.json())
        .then(data => {
          setAiRisk(data);
          setLoadingAi(false);
        })
        .catch(err => {
          console.error("Failed to fetch AI risk:", err);
          setLoadingAi(false);
        });
    }
  }, [node]);

  if (!node) return null;

  const { index, breakdown } = computeRiskIndex(node);
  const riskClass = index >= 65 ? 'critical' : index >= 35 ? 'warning' : 'safe';

  /* LoRa signal strength to bars */
  const signalStrength = Math.min(4, Math.max(0, Math.round((node.rssi_dbm + 120) / 15)));

  /* Spatial agreement display */
  const spatial = node.spatial_agreement || { agree: 0, of: 0, r2: 0 };

  /* Node alerts */
  const nodeAlerts = alerts.filter(a => a.node_id === node.id).slice(0, 5);

  return (
    <div className={`detail-panel open`}>
      {/* Header */}
      <div className="detail-header">
        <div className="detail-header-info">
          <span className={`node-status-dot ${node.status}`} />
          <div>
            <div className="detail-node-name">{node.name}</div>
            <div className="detail-node-id">{node.id}</div>
          </div>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close detail panel">
          <X size={16} />
        </button>
      </div>

      <div className="detail-body">
        {/* Status Badge */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`status-badge ${node.status}`}>
            {node.status}
          </span>
          <div className="last-seen">
            <Clock size={12} />
            {formatAge(node.data_age_s)}
          </div>
          {node.last_known_level && node.status === 'offline' && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              (was {node.last_known_level})
            </span>
          )}
        </div>

        {/* Risk Index — NOT "AI" */}
        <div className="risk-gauge">
          <div className={`risk-circle ${riskClass}`}>
            <span className={`risk-value text-${riskClass}`}>{index}</span>
            <span className="risk-label">Risk</span>
          </div>
          <div style={{ marginLeft: 20, flex: 1 }}>
            <div className={`risk-status text-${riskClass}`}>
              {riskClass === 'critical' ? '🔴 CRITICAL' : riskClass === 'warning' ? '🟡 WARNING' : '🟢 NORMAL'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              Composite risk index (rule-based)
              <button
                className="info-btn"
                aria-label="Risk index breakdown"
                onClick={() => setShowRiskBreakdown(!showRiskBreakdown)}
              >
                <Info size={10} />
              </button>
            </div>
            {showRiskBreakdown && (
              <div className="risk-breakdown">
                {Object.entries(breakdown).map(([key, b]) => (
                  <div key={key} className="risk-breakdown-row">
                    <span className="risk-breakdown-label">{key}</span>
                    <span className="risk-breakdown-calc">
                      {b.value.toFixed(1)}/{b.max} × {b.weight} = {b.contrib.toFixed(1)}
                    </span>
                  </div>
                ))}
                <div className="risk-breakdown-row" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 4, marginTop: 4 }}>
                  <span className="risk-breakdown-label" style={{ fontWeight: 700 }}>total</span>
                  <span className="risk-breakdown-calc" style={{ fontWeight: 700 }}>{index}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Decision Triad — T7 */}
        <div className="detail-section-title">🎯 Decision Basis</div>
        <div className="decision-triad">
          <div className="triad-row" style={{ display: 'flex', gap: '7px' }}>
            <span className="triad-icon filled">■</span>
            <span className="triad-label">RULE</span>
            <span className="triad-value">
              {node.tilt_resultant_mm_per_m.toFixed(1)} mm/m
              {node.tilt_resultant_mm_per_m >= TILT.CRITICAL_AT ? ` > ${TILT.CRITICAL_AT} mm/m` :
               node.tilt_resultant_mm_per_m >= TILT.NORMAL_MAX ? ` ≥ ${TILT.NORMAL_MAX} mm/m` : ' — normal'}
            </span>
          </div>
          <div className="triad-row" style={{ display: 'flex', gap: '7px' }}>
            <span className={`triad-icon ${spatial.agree >= 2 ? 'filled' : 'empty'}`}>
              {spatial.agree >= 2 ? '■' : '□'}
            </span>
            <span className="triad-label">SPATIAL</span>
            <span className="triad-value">
              {spatial.of > 0
                ? `${spatial.agree}/${spatial.of} neighbours agree · R² ${spatial.r2.toFixed(2)}`
                : 'no neighbours in range'}
            </span>
          </div>
          <div className="triad-row" style={{ display: 'flex', gap: '7px' }}>
            <span className="triad-icon empty">□</span>
            <span className="triad-label">AI</span>
            <span className="triad-value" style={{ color: 'var(--text-muted)' }}>
              no model deployed
            </span>
          </div>
          <div className="triad-summary">
            → {node.rule_level === 'critical' && spatial.agree >= 2 ? '2 of 3 paths agree · CRITICAL confirmed' :
               node.rule_level === 'warning' ? 'single-node excursion — awaiting neighbour agreement' :
               node.rule_level === 'critical' ? 'hard threshold breached' :
               'normal operation'}
          </div>
        </div>

        {/* Sensor Readings */}
        <div className="detail-section-title">📊 Sensor Readings</div>
        <div className="sensor-grid">
          {/* Tilt X */}
          <div className="sensor-card">
            <div className="sensor-card-label">
              <Activity size={10} /> Tilt X
            </div>
            <div className="sensor-card-value" style={{
              color: Math.abs(node.tilt_x_mm_per_m) > TILT.CRITICAL_AT ? 'var(--accent-critical)' :
                     Math.abs(node.tilt_x_mm_per_m) > TILT.NORMAL_MAX ? 'var(--accent-warning)' : 'var(--accent-blue)'
            }}>
              {node.tilt_x_mm_per_m.toFixed(1)}
              <span className="sensor-card-unit">mm/m</span>
            </div>
          </div>

          {/* Tilt Y */}
          <div className="sensor-card">
            <div className="sensor-card-label">
              <Activity size={10} /> Tilt Y
            </div>
            <div className="sensor-card-value" style={{
              color: Math.abs(node.tilt_y_mm_per_m) > TILT.CRITICAL_AT ? 'var(--accent-critical)' :
                     Math.abs(node.tilt_y_mm_per_m) > TILT.NORMAL_MAX ? 'var(--accent-warning)' : 'var(--accent-blue)'
            }}>
              {node.tilt_y_mm_per_m.toFixed(1)}
              <span className="sensor-card-unit">mm/m</span>
            </div>
          </div>

          {/* Vibration */}
          <div className="sensor-card">
            <div className="sensor-card-label">
              <Zap size={10} /> Vibration
            </div>
            <div className="sensor-card-value" style={{
              color: node.vibration_rms_g > VIB_RMS_G.CRIT ? 'var(--accent-critical)' :
                     node.vibration_rms_g > VIB_RMS_G.WARN ? 'var(--accent-warning)' : 'var(--accent-safe)'
            }}>
              {node.vibration_rms_g.toFixed(2)}
              <span className="sensor-card-unit">g RMS</span>
            </div>
          </div>

          {/* Crack */}
          <div className="sensor-card">
            <div className="sensor-card-label">
              <ChevronRight size={10} /> Crack
            </div>
            <div className="sensor-card-value" style={{
              color: node.crack_mm > CRACK_MM.CRIT ? 'var(--accent-critical)' :
                     node.crack_mm > CRACK_MM.WARN ? 'var(--accent-warning)' : 'var(--accent-safe)'
            }}>
              {node.crack_mm.toFixed(1)}
              <span className="sensor-card-unit">mm</span>
            </div>
          </div>

          {/* Settlement (inferred) */}
          <div className="sensor-card full-width">
            <div className="sensor-card-label">
              <ArrowDown size={10} /> Inferred Settlement
              <span style={{ fontSize: 8, color: 'var(--accent-purple)', marginLeft: 4 }}>(derived)</span>
            </div>
            <div className="sensor-card-value" style={{
              color: Math.abs(node.settlement_inferred_mm) > 25 ? 'var(--accent-critical)' :
                     Math.abs(node.settlement_inferred_mm) > 10 ? 'var(--accent-warning)' : 'var(--accent-safe)'
            }}>
              <TrendingDown size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {node.settlement_inferred_mm.toFixed(1)} ± {node.settlement_err_mm.toFixed(1)}
              <span className="sensor-card-unit">mm</span>
            </div>
            <div className="sensor-card-sub">
              method: {node.settlement_method} · ref {node.settlement_ref_node} · {node.hops_to_gateway} hops
            </div>
          </div>

          {/* Enclosure Humidity */}
          <div className="sensor-card full-width">
            <div className="sensor-card-label">
              <Droplets size={10} /> Enclosure Humidity
              <span style={{ fontSize: 8, color: 'var(--text-muted)', marginLeft: 4 }}>(not ground moisture)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sensor-card-value text-cyan">
                {node.enclosure_humidity_pct}
                <span className="sensor-card-unit">%</span>
              </div>
              <div className="health-bar-track" style={{ flex: 1 }}>
                <div
                  className="health-bar-fill"
                  style={{
                    width: `${node.enclosure_humidity_pct}%`,
                    background: 'var(--accent-cyan)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Temperature */}
          <div className="sensor-card">
            <div className="sensor-card-label">
              🌡️ Temperature
            </div>
            <div className="sensor-card-value text-warning">
              {node.temp_c.toFixed(1)}
              <span className="sensor-card-unit">°C</span>
            </div>
          </div>

          {/* Tilt Resultant */}
          <div className="sensor-card">
            <div className="sensor-card-label">
              <Activity size={10} /> Tilt Resultant
            </div>
            <div className="sensor-card-value" style={{
              color: node.tilt_resultant_mm_per_m > TILT.CRITICAL_AT ? 'var(--accent-critical)' :
                     node.tilt_resultant_mm_per_m > TILT.NORMAL_MAX ? 'var(--accent-warning)' : 'var(--accent-safe)'
            }}>
              {node.tilt_resultant_mm_per_m.toFixed(2)}
              <span className="sensor-card-unit">mm/m</span>
            </div>
            <div className="sensor-card-sub">
              ({mmPerMToDeg(node.tilt_resultant_mm_per_m).toFixed(3)}°)
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="detail-section-title">⚙️ System Health</div>
        <div className="sensor-grid">
          {/* Battery */}
          <div className="sensor-card full-width">
            <div className="sensor-card-label">
              <Battery size={10} /> Battery
            </div>
            <div className="health-bar-container">
              <div className="health-bar-track">
                <div
                  className="health-bar-fill"
                  style={{
                    width: `${node.battery_pct}%`,
                    background: node.battery_pct > 60 ? 'var(--accent-safe)' :
                               node.battery_pct > 20 ? 'var(--accent-warning)' : 'var(--accent-critical)',
                  }}
                />
              </div>
              <div className="health-bar-label" style={{
                color: node.battery_pct > 60 ? 'var(--accent-safe)' :
                       node.battery_pct > 20 ? 'var(--accent-warning)' : 'var(--accent-critical)',
              }}>
                {node.battery_pct}%
              </div>
            </div>
          </div>

          {/* Solar Status — reads from node.solar_w, not hardcoded */}
          <div className="sensor-card full-width">
            <div className="sensor-card-label">
              <Zap size={10} /> Solar
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className={`sensor-card-value ${node.solar_w > 0.1 ? 'text-safe' : 'text-dim'}`}>
                {node.solar_w > 0.1 ? 'Charging' : 'Not charging'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {node.solar_w.toFixed(1)} W
              </div>
            </div>
          </div>

          {/* LoRa Signal */}
          <div className="sensor-card">
            <div className="sensor-card-label">
              <Signal size={10} /> LoRa RSSI
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="signal-bars">
                {[4, 7, 10, 14].map((h, i) => (
                  <div
                    key={i}
                    className={`signal-bar ${i < signalStrength ? (signalStrength <= 2 ? 'warn' : 'filled') : ''}`}
                    style={{ height: h }}
                  />
                ))}
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {node.rssi_dbm} dBm
              </span>
            </div>
          </div>

          {/* Coordinates */}
          <div className="sensor-card">
            <div className="sensor-card-label">
              <Gauge size={10} /> GPS ({node.gps_fix})
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {node.lat.toFixed(4)}°N
              <br />
              {node.lng.toFixed(4)}°E
            </div>
          </div>
        </div>

        {/* Recent Alerts for this node */}
        {nodeAlerts.length > 0 && (
          <>
            <div className="detail-section-title">🔔 Recent Alerts</div>
            <div className="node-alerts-list">
              {nodeAlerts.map(alert => (
                <div key={alert.id} className="node-alert-item">
                  <span className={`alert-badge ${alert.level}`}>
                    {alert.level === 'critical' ? '🔴' : '⚠️'} {alert.level}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {alert.rule_code} · {alert.value} {alert.unit}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
