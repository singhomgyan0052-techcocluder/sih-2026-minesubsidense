import React, { useState, useCallback, useRef } from 'react';
import {
  Activity, AlertTriangle, Radio, TrendingDown, Clock, Info, LogOut, User, ChevronDown, Bell, Volume2, VolumeX
} from 'lucide-react';
import MapView from './components/MapView';
import LiveGraph from './components/LiveGraph';
import AlertBanner from './components/AlertBanner';
import { LoginPage } from './components/LoginPage';
import { FleetSidebar, DetailPanel } from './components/NodeSidebar';
import { AddAreaModal, AddNodeModal, AddGatewayModal } from './components/AddModal';
import { HardwareIntegrationModal } from './components/HardwareModal';
import { useTelemetry } from './hooks/useTelemetry';
import { makeNode } from './model/nodeShape';
import { LATENCY_BUDGET } from './model/constants';
import { formatAge } from './logic/linkHealth';
import { playSiren, stopSiren, initAudio } from './logic/audioSiren';

/* ============================================
   Initial Gateways
   ============================================ */
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const INITIAL_GATEWAYS = [
  { id: 'GW-1', name: 'Primary Gateway — Central Hub', lat: 23.7485, lng: 86.4250, status: 'active' },
];

/* ============================================
   Initial Mine Sectors / Areas
   (kept for the Add Area modal workflow)
   ============================================ */
const INITIAL_SECTORS = [
  { id: 'SEC-001', name: 'Sector A — Shaft Entry', description: 'Main shaft entry monitoring zone' },
  { id: 'SEC-002', name: 'Sector B — Ventilation Duct', description: 'Air intake shaft and ducting' },
  { id: 'SEC-003', name: 'Sector C — Main Gallery', description: 'Underground haulage & gallery' },
  { id: 'SEC-004', name: 'Sector D — Coal Face', description: 'Active extraction coal wall' },
  { id: 'SEC-005', name: 'Sector E — Pillar Zone', description: 'Supporting pillar deformation' },
  { id: 'SEC-006', name: 'Sector F — Surface Crack', description: 'Surface subsidence crack zone' },
  { id: 'SEC-007', name: 'Sector G — Collapse Risk', description: 'High displacement risk zone' },
  { id: 'SEC-008', name: 'Sector H — Boundary Post', description: 'Perimeter mine boundary' },
];

export default function App() {
  // Telemetry hook — replaces all local state + setInterval
  const {
    nodes, addNode, alerts, source, seed, tick, simTimestamp,
    packetsPerMin, oldestPacketAgeS, historyBuffer,
    setAlerts,
  } = useTelemetry('slow-subsidence');

  const [sectors, setSectors] = useState(INITIAL_SECTORS);
  const [gateways, setGateways] = useState(INITIAL_GATEWAYS);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedGateway, setSelectedGateway] = useState(null);

  React.useEffect(() => {
    // Fetch gateways and areas on mount
    Promise.all([
      fetch(`${BACKEND_URL}/api/gateways`).then(res => res.json()).catch(() => []),
      fetch(`${BACKEND_URL}/api/areas`).then(res => res.json()).catch(() => [])
    ]).then(([fetchedGateways, fetchedAreas]) => {
      if (fetchedGateways && fetchedGateways.length > 0) {
        setGateways(fetchedGateways);
      }
      if (fetchedAreas && fetchedAreas.length > 0) {
        setSectors(fetchedAreas);
      }
    });
  }, []);
  const [filter, setFilter] = useState('all');
  const [clock, setClock] = useState(new Date());
  const [showSettlementInfo, setShowSettlementInfo] = useState(false);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [isSirenMuted, setIsSirenMuted] = useState(false);

  // Modal states
  const [isAddGatewayOpen, setIsAddGatewayOpen] = useState(false);
  const [isAddAreaOpen, setIsAddAreaOpen] = useState(false);
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [pickedCoords, setPickedCoords] = useState({ lat: 23.7485, lng: 86.4250 });

  const [showAlerts, setShowAlerts] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const alertIdRef = useRef(10);

  /* Live Clock */
  React.useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* Handlers for adding Area, Gateway & Node */
  const handleAddGateway = useCallback((newGateway) => {
    setGateways(prev => [...prev, newGateway]);
    setSelectedGateway(newGateway.id);

    fetch(`${BACKEND_URL}/api/gateways`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGateway)
    }).catch(err => console.log('Backend sync offline, stored locally:', err));
  }, []);

  const handleAddArea = useCallback((newArea) => {
    setSectors(prev => [...prev, newArea]);

    fetch(`${BACKEND_URL}/api/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newArea)
    }).catch(err => console.log('Backend sync offline, stored locally:', err));
  }, []);



  const handleAddNode = useCallback((newNode) => {
    addNode(newNode);
    setSelectedNode(newNode);

    fetch(`${BACKEND_URL}/api/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNode)
    }).catch(err => console.log('Backend sync offline, stored locally:', err));
  }, [addNode]);

  const handleLocationPicked = useCallback((coords) => {
    setPickedCoords(coords);
    setIsPickingLocation(false);
    setIsAddNodeOpen(true);
  }, []);

  const currentSelected = selectedNode === 'closed'
    ? null
    : selectedNode
    ? nodes.find(n => n.id === selectedNode.id) || nodes[0] || null
    : nodes[0] || null;

  const handleSelectNode = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNode('closed');
  }, []);

  // KPI computations — all from §4 fields
  const normalCount = nodes.filter(n => n.status === 'normal').length;
  // Trigger alarm on warning or critical as per user request ("jab warning aaye")
  const warningCount = nodes.filter(n => n.status === 'warning').length;
  const criticalCount = nodes.filter(n => n.status === 'critical').length;
  const alarmAlerts = warningCount + criticalCount;

  const maxSettlement = Math.min(...nodes.map(n => n.settlement_inferred_mm));
  const maxSettlementNode = nodes.find(n => n.settlement_inferred_mm === maxSettlement);
  const maxSettlementErr = maxSettlementNode ? maxSettlementNode.settlement_err_mm : 0;
  const avgTilt = nodes.length > 0
    ? (nodes.reduce((s, n) => s + n.tilt_resultant_mm_per_m, 0) / nodes.length).toFixed(1)
    : '0.0';

  // Mesh summary
  const reachableNodes = nodes.filter(n => n.link_state !== 'offline').length;
  const maxHops = Math.max(...nodes.map(n => n.hops_to_gateway));

  // Source badge config
  const sourceBadge = {
    live: { symbol: '●', label: `LIVE (gateway ${nodes[0]?.gateway_id || 'GW-1'})`, className: 'source-live' },
    simulated: { symbol: '◐', label: `SIMULATED (seed ${seed})`, className: 'source-simulated' },
    disconnected: { symbol: '○', label: 'DISCONNECTED', className: 'source-disconnected' },
  }[source];

  // Audio Alarm Logic
  React.useEffect(() => {
    const shouldPlay = alarmAlerts > 0 && !isSirenMuted;
    if (shouldPlay) {
      playSiren();
    } else {
      stopSiren();
    }
  }, [alarmAlerts, isSirenMuted]);

  const toggleSirenMute = () => {
    initAudio();
    setIsSirenMuted(!isSirenMuted);
  };

  if (!user) {
    return <LoginPage onLogin={(userData) => { initAudio(); setUser(userData); }} />;
  }

  return (
    <div className="app">
      {alarmAlerts > 0 && (
        <div className="village-siren-banner">
          <AlertTriangle size={18} className="pulse-icon" />
          <span><strong>VILLAGE SIREN NETWORK ACTIVATED:</strong> Hardware payload transmitted to surface sirens.</span>
          <AlertTriangle size={18} className="pulse-icon" />
        </div>
      )}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div className="header-title">SWARN</div>
            <div className="header-subtitle">AI Powered Adaptive Mine Subsidence Monitoring Framework</div>
          </div>
        </div>

        <div className="kpi-strip">
          <div className="kpi-card">
            <div className="kpi-icon blue"><Radio size={16} /></div>
            <div>
              <div className="kpi-value text-blue">{reachableNodes}/{nodes.length}</div>
              <div className="kpi-label">Mesh Nodes</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon critical"><AlertTriangle size={16} /></div>
            <div>
              <div className="kpi-value text-critical">{criticalCount}</div>
              <div className="kpi-label">Critical</div>
            </div>
          </div>
          <div className="kpi-card" style={{ position: 'relative' }}>
            <div className="kpi-icon warning"><TrendingDown size={16} /></div>
            <div>
              <div className="kpi-value text-warning">
                {maxSettlement.toFixed(1)}mm
              </div>
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Max Settlement
                <button
                  className="info-btn"
                  aria-label="Settlement method information"
                  onClick={() => setShowSettlementInfo(!showSettlementInfo)}
                >
                  <Info size={10} />
                </button>
              </div>
            </div>
            {showSettlementInfo && (
              <div className="info-popover">
                <strong>Inferred settlement</strong> — not directly measured.
                <br /><br />
                Derived by integrating tilt along the node chain from reference node {maxSettlementNode?.settlement_ref_node || 'NODE-008'}.
                <br /><br />
                NEO-6M GPS is ±2.5 m — two orders of magnitude larger than the mm-scale values shown here.
                GPS cannot be used for settlement at this precision.
                <br /><br />
                Method: tilt-integration · ± error shown is propagated from per-sample tilt uncertainty.
              </div>
            )}
          </div>
          <div className="kpi-card">
            <div className="kpi-icon safe"><Activity size={16} /></div>
            <div>
              <div className="kpi-value text-safe">{avgTilt} mm/m</div>
              <div className="kpi-label">Avg Tilt</div>
            </div>
          </div>
        </div>

        {/* Source badge */}
        <div className={`header-status ${sourceBadge.className}`}>
          <span className="source-symbol">{sourceBadge.symbol}</span>
          {sourceBadge.label.split(' ')[0]} {/* Shorten label */}
        </div>

        {/* Mesh & packet info */}
        <div className="header-mesh-info" style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', fontSize: '11px' }}>
          <span className="mesh-stat">mesh: {reachableNodes}/{nodes.length}</span>
          <span className="mesh-stat" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>age: {formatAge(oldestPacketAgeS)}</span>
        </div>

        <div className="header-clock">
          <Clock size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {clock.toLocaleTimeString('en-IN', { hour12: false })}
        </div>

        {/* Siren Auto-Trigger — pulses when alarms exist */}
        <div 
          className={`siren-btn ${alarmAlerts > 0 && !isSirenMuted ? 'siren-active' : ''} ${isSirenMuted ? 'siren-muted' : ''}`} 
          title={alarmAlerts > 0 ? `${alarmAlerts} alerts — siren triggered! Click to mute/unmute.` : 'Siren standby'}
          onClick={toggleSirenMute}
          style={{ cursor: 'pointer' }}
        >
          {isSirenMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {alarmAlerts > 0 && <span className="siren-badge">{alarmAlerts}</span>}
        </div>

        {user && (
          <div className="header-profile-wrapper">
            <div
              className="header-profile"
              onClick={() => setShowProfileMenu(prev => !prev)}
              title="Account"
            >
              <img src={user.avatar} alt="Profile" className="header-profile-avatar" />
            </div>
            {showProfileMenu && (
              <>
                <div className="profile-menu-backdrop" onClick={() => setShowProfileMenu(false)} />
                <div className="profile-menu">
                  <div className="profile-menu-header">
                    <img src={user.avatar} alt="" className="profile-menu-avatar" />
                    <div className="profile-menu-info">
                      <div className="profile-menu-name">{user.name}</div>
                      <div className="profile-menu-role">{user.role}</div>
                    </div>
                  </div>
                  <div className="profile-menu-divider" />
                  <button
                    className="profile-menu-item"
                    onClick={() => { 
                      setShowProfileMenu(false); 
                      setUser(null); 
                      localStorage.removeItem('user_data');
                      localStorage.removeItem('token');
                    }}
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* Latency budgets — three separate numbers, never one (§3.5) */}
      <div className="latency-strip" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <span className="latency-item" style={{ display: 'flex', gap: '4px' }}>
          Node buzzer &lt; {LATENCY_BUDGET.node_buzzer_s}s
        </span>
        <span className="latency-item" style={{ display: 'flex', gap: '4px' }}>
          Dashboard ≤ {Math.floor(LATENCY_BUDGET.dashboard_s / 60)} min
        </span>
        <span className="latency-item" style={{ display: 'flex', gap: '4px' }}>
          Critical SMS &lt; {LATENCY_BUDGET.critical_sms_s}s
        </span>
      </div>

      {showAlerts && (
        <AlertBanner alerts={alerts} onDismissAll={() => setShowAlerts(false)} />
      )}

        <div className="app-body">
          <FleetSidebar
            nodes={nodes}
            gateways={gateways}
            selectedNode={currentSelected}
            onSelectNode={handleSelectNode}
            selectedGateway={selectedGateway}
            onSelectGateway={setSelectedGateway}
            filter={filter}
            onFilterChange={setFilter}
            onOpenAddGatewayModal={() => setIsAddGatewayOpen(true)}
            onOpenAddAreaModal={() => setIsAddAreaOpen(true)}
            onOpenAddNodeModal={() => setIsAddNodeOpen(true)}
            onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
            user={user}
            onLogout={() => setUser(null)}
          />

        <div className="main-content">
          <div className="map-area">
            <MapView
              nodes={nodes}
              sectors={sectors}
              gateways={gateways}
              selectedNode={currentSelected}
              onSelectNode={handleSelectNode}
              selectedGateway={selectedGateway}
              onSelectGateway={setSelectedGateway}
              isPickingLocation={isPickingLocation}
              onLocationPicked={handleLocationPicked}
              onAddNodeAtCoords={(coords) => {
                setPickedCoords(coords);
                setIsAddNodeOpen(true);
              }}
              onAddAreaAtCoords={(coords) => {
                setIsAddAreaOpen(true);
              }}
              onAddGatewayAtCoords={(coords) => {
                setPickedCoords(coords);
                setIsAddGatewayOpen(true);
              }}
            />
            {currentSelected && (
              <DetailPanel node={currentSelected} onClose={handleCloseDetail} alerts={alerts} />
            )}
          </div>
          {currentSelected && (
            <LiveGraph
              selectedNode={currentSelected}
              historyBuffer={historyBuffer}
              alerts={alerts}
              tick={tick}
            />
          )}
        </div>
      </div>

      <AddGatewayModal
        isOpen={isAddGatewayOpen}
        onClose={() => setIsAddGatewayOpen(false)}
        onAddGateway={handleAddGateway}
        areas={sectors}
        initialCoords={pickedCoords}
        onPickLocationOnMap={() => setIsPickingLocation(true)}
      />

      <AddAreaModal
        isOpen={isAddAreaOpen}
        onClose={() => setIsAddAreaOpen(false)}
        onAddArea={handleAddArea}
      />

      <AddNodeModal
        isOpen={isAddNodeOpen}
        onClose={() => setIsAddNodeOpen(false)}
        onAddNode={handleAddNode}
        sectors={sectors}
        gateways={gateways}
        initialCoords={pickedCoords}
        onPickLocationOnMap={() => setIsPickingLocation(true)}
      />

      <HardwareIntegrationModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
      />
    </div>
  );
}