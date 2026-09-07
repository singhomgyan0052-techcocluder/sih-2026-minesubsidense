import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { BarChart3, Clock, Activity, Zap, TrendingDown } from 'lucide-react';
import { TILT, VIB_RMS_G, CRACK_MM } from '../model/constants';

/* Time range options (in minutes of simulated time) */
const RANGES = [
  { label: '5m', minutes: 5 },
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 360 },
  { label: '1D', minutes: 1440 },
];

/* Series config */
const SERIES_CONFIG = {
  tilt: {
    icon: Activity,
    label: 'Tilt',
    unit: 'mm/m',
    color: '#38bdf8',
    gradientId: 'gradTilt',
    thresholds: [
      { y: TILT.NORMAL_MAX, label: `Watch ${TILT.NORMAL_MAX}`, color: '#f59e0b' },
      { y: TILT.CRITICAL_AT, label: `Critical ${TILT.CRITICAL_AT}`, color: '#ef4444' },
    ],
  },
  vibration: {
    icon: Zap,
    label: 'Vibration',
    unit: 'g RMS',
    color: '#f472b6',
    gradientId: 'gradVib',
    thresholds: [
      { y: VIB_RMS_G.WARN, label: `Warn ${VIB_RMS_G.WARN}g`, color: '#f59e0b' },
      { y: VIB_RMS_G.CRIT, label: `Crit ${VIB_RMS_G.CRIT}g`, color: '#ef4444' },
    ],
  },
  crack: {
    icon: TrendingDown,
    label: 'Crack Width',
    unit: 'mm',
    color: '#fb923c',
    gradientId: 'gradCrack',
    thresholds: [
      { y: CRACK_MM.WARN, label: `Warn ${CRACK_MM.WARN}mm`, color: '#f59e0b' },
      { y: CRACK_MM.CRIT, label: `Crit ${CRACK_MM.CRIT}mm`, color: '#ef4444' },
    ],
  },
};

/* Gradient definitions for area fills */
function ChartGradients() {
  return (
    <defs>
      <linearGradient id="gradTilt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradTiltY" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25} />
        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradTiltR" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradVib" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f472b6" stopOpacity={0.35} />
        <stop offset="100%" stopColor="#f472b6" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradCrack" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fb923c" stopOpacity={0.35} />
        <stop offset="100%" stopColor="#fb923c" stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

/* Custom tooltip */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{
      background: 'rgba(10, 14, 23, 0.95)',
      border: '1px solid rgba(56, 189, 248, 0.2)',
      borderRadius: 8,
      padding: '8px 12px',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, fontFamily: 'monospace' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 0' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
          <span style={{ color: '#cbd5e1' }}>{p.name}:</span>
          <strong style={{ color: p.color, fontFamily: 'monospace' }}>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* Single mini chart panel */
function MiniChart({ title, unit, icon: Icon, data, dataKey, color, gradientId, thresholds, isActive, onClick }) {
  if (data.length === 0) return null;
  const latest = data[data.length - 1]?.[dataKey] ?? 0;
  const isWarn = thresholds.some(t => latest >= t.y && t.color === '#f59e0b');
  const isCrit = thresholds.some(t => latest >= t.y && t.color === '#ef4444');
  const valueColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : color;

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        background: isActive ? 'rgba(56, 189, 248, 0.06)' : 'rgba(15, 23, 42, 0.5)',
        border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.8)'}`,
        borderRadius: 10,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={12} style={{ color }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: valueColor }}>{latest.toFixed(2)}</span>
          <span style={{ fontSize: 9, color: '#64748b' }}>{unit}</span>
        </div>
      </div>
      <div style={{ height: 50 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <ChartGradients />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
            {thresholds.map((t, i) => (
              <ReferenceLine key={i} y={t.y} stroke={t.color} strokeDasharray="4 4" strokeWidth={0.5} strokeOpacity={0.5} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function LiveGraph({ selectedNode, historyBuffer = {}, alerts = [], tick = 0 }) {
  const [range, setRange] = useState(RANGES[2]); // default 1h
  const [expandedSeries, setExpandedSeries] = useState('tilt');

  const [height, setHeight] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);

  const startResizing = useCallback((e) => {
    setIsResizing(true);
    e.preventDefault(); // prevent text selection
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e) => {
    if (isResizing) {
      const newHeight = window.innerHeight - e.clientY;
      const clamped = Math.max(150, Math.min(newHeight, window.innerHeight * 0.8));
      setHeight(clamped);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Get data from buffer — tick in dependency forces re-computation every simulator step
  const rawData = selectedNode ? (historyBuffer[selectedNode.id] || []) : [];

  // Slice buffer to the selected time range — tick drives live updates
  const data = useMemo(() => {
    if (rawData.length === 0) return [];
    const cutoffMs = range.minutes * 60 * 1000;
    const latestTs = rawData[rawData.length - 1]?.timestamp || Date.now();
    const oldest = latestTs - cutoffMs;
    return rawData.filter(d => d.timestamp >= oldest);
  }, [rawData.length, range, tick]);

  // Buffer info
  const bufferInfo = useMemo(() => {
    if (rawData.length === 0) return null;
    const totalMinutes = rawData.length > 1
      ? ((rawData[rawData.length - 1].timestamp - rawData[0].timestamp) / 60000).toFixed(0)
      : 0;
    const startTime = new Date(rawData[0].timestamp).toLocaleTimeString('en-IN', { hour12: false });
    return { showing: data.length, total: rawData.length, totalMinutes, startTime };
  }, [rawData.length, data.length, tick]);

  if (!selectedNode) {
    return (
      <div className="graph-panel" style={{ height, position: "relative" }} ref={panelRef}>
      <div 
        onMouseDown={startResizing}
        style={{
          position: 'absolute',
          top: -3,
          left: 0,
          right: 0,
          height: 8,
          cursor: 'ns-resize',
          zIndex: 10,
          background: isResizing ? 'rgba(56, 189, 248, 0.4)' : 'transparent',
          transition: 'background 0.2s',
          borderTop: isResizing ? '1px solid #38bdf8' : 'none',
        }}
        onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'; }}
        onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
      />

        <div className="graph-empty">
          <BarChart3 size={20} />
          <span>Select a sensor node to view telemetry</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="graph-panel" style={{ height, position: "relative" }} ref={panelRef}>
      <div 
        onMouseDown={startResizing}
        style={{
          position: 'absolute',
          top: -3,
          left: 0,
          right: 0,
          height: 8,
          cursor: 'ns-resize',
          zIndex: 10,
          background: isResizing ? 'rgba(56, 189, 248, 0.4)' : 'transparent',
          transition: 'background 0.2s',
          borderTop: isResizing ? '1px solid #38bdf8' : 'none',
        }}
        onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'; }}
        onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
      />

        <div className="graph-empty">
          <Clock size={16} />
          <span>Collecting data — buffer will populate in a few seconds</span>
        </div>
      </div>
    );
  }

  const expandedConfig = SERIES_CONFIG[expandedSeries];
  const ExpandedIcon = expandedConfig.icon;

  // Get latest values for the live indicator
  const latest = data[data.length - 1] || {};

  return (
    <div className="graph-panel" style={{ height, gap: 8, padding: '12px 16px', position: "relative" }} ref={panelRef}>
      <div 
        onMouseDown={startResizing}
        style={{
          position: 'absolute',
          top: -3,
          left: 0,
          right: 0,
          height: 8,
          cursor: 'ns-resize',
          zIndex: 10,
          background: isResizing ? 'rgba(56, 189, 248, 0.4)' : 'transparent',
          transition: 'background 0.2s',
          borderTop: isResizing ? '1px solid #38bdf8' : 'none',
        }}
        onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'; }}
        onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#10b981', boxShadow: '0 0 12px #10b981',
            animation: 'statusPulse 1.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {selectedNode.panel_id} · {selectedNode.name?.split('·')[1]?.trim() || selectedNode.name} <span style={{ color: '#64748b', fontWeight: 400 }}>{selectedNode.id}</span>
          </span>
        </div>
        {/* Time range buttons */}
        <div style={{ display: 'flex', gap: 3 }}>
          {RANGES.map(r => (
            <button
              key={r.label}
              className={`time-btn ${range.label === r.label ? 'active' : ''}`}
              onClick={() => setRange(r)}
              style={{ fontSize: 10, padding: '3px 8px' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini sparkline cards row */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <MiniChart
          title="Tilt Resultant" unit="mm/m" icon={Activity}
          data={data} dataKey="tilt_resultant" color="#34d399" gradientId="gradTiltR"
          thresholds={SERIES_CONFIG.tilt.thresholds}
          isActive={expandedSeries === 'tilt'} onClick={() => setExpandedSeries('tilt')}
        />
        <MiniChart
          title="Vibration" unit="g RMS" icon={Zap}
          data={data} dataKey="vibration" color="#f472b6" gradientId="gradVib"
          thresholds={SERIES_CONFIG.vibration.thresholds}
          isActive={expandedSeries === 'vibration'} onClick={() => setExpandedSeries('vibration')}
        />
        <MiniChart
          title="Crack Width" unit="mm" icon={TrendingDown}
          data={data} dataKey="crack" color="#fb923c" gradientId="gradCrack"
          thresholds={SERIES_CONFIG.crack.thresholds}
          isActive={expandedSeries === 'crack'} onClick={() => setExpandedSeries('crack')}
        />
      </div>

      {/* Expanded main chart */}
      <div className="graph-content" style={{ borderRadius: 10, background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(30, 41, 59, 0.6)', padding: '8px 8px 0 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <ChartGradients />
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#475569', fontSize: 9 }}
              axisLine={{ stroke: 'rgba(30,41,59,0.6)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 'auto']}
              width={40}
              label={{ value: expandedConfig.unit, angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 9, dx: -2 }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ fontSize: 9, paddingTop: 4, color: '#94a3b8' }}
            />

            {/* Threshold reference lines */}
            {expandedConfig.thresholds.map((t, i) => (
              <ReferenceLine 
                key={i} 
                y={t.y} 
                stroke={t.color} 
                strokeDasharray="6 3" 
                strokeWidth={1} 
                strokeOpacity={0.7}
                label={{ value: t.label, position: 'right', fill: t.color, fontSize: 8 }}
              />
            ))}

            {expandedSeries === 'tilt' && (
              <>
                <Area type="monotone" dataKey="tilt_x" name="Tilt X (mm/m)" stroke="#38bdf8" strokeWidth={1.5} fill="url(#gradTilt)" dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="tilt_y" name="Tilt Y (mm/m)" stroke="#818cf8" strokeWidth={1.5} fill="url(#gradTiltY)" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="tilt_resultant" name="Resultant (mm/m)" stroke="#34d399" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </>
            )}

            {expandedSeries === 'vibration' && (
              <Area type="monotone" dataKey="vibration" name="Vibration (g RMS)" stroke="#f472b6" strokeWidth={2} fill="url(#gradVib)" dot={false} isAnimationActive={false} />
            )}

            {expandedSeries === 'crack' && (
              <Area type="monotone" dataKey="crack" name="Crack (mm)" stroke="#fb923c" strokeWidth={2} fill="url(#gradCrack)" dot={false} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      {bufferInfo && (
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', flexShrink: 0, fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
          <span>showing {bufferInfo.showing} of {bufferInfo.total} samples ({bufferInfo.totalMinutes} min) &middot; buffer started at {bufferInfo.startTime}</span>
          <span>1 mm/m = 0.0573° &middot; damage-relevant range &approx; 0–10 mm/m</span>
        </div>
      )}
    </div>
  );
}