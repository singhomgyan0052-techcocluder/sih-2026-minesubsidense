/** ============================================
 *  useTelemetry() — real data path with honest
 *  source badge (rule R5).
 *
 *  source: 'live' | 'simulated' | 'disconnected'
 *
 *  If WS_URL is set, try WebSocket first.
 *  On failure, fall back to simulator.
 *  If WS_URL is absent, go straight to simulator.
 *  ============================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createSimulator } from '../sim/simulator';
import { SEED_NODES, makeNode } from '../model/nodeShape';
import { DEFAULT_SEED, SIM_TICK_MS } from '../model/constants';
import { evaluateNode, makeAlert } from '../logic/alertEngine';
import { fuseStatus } from '../logic/fuseStatus';
import { classifyLink } from '../logic/linkHealth';
import { computeRiskIndex } from '../logic/riskIndex';
import { neighboursOf, spatialAgreement } from '../logic/corroborate';

const WS_URL = process.env.REACT_APP_WS_URL || '';
const MAX_RECONNECT_DELAY = 30000;

/**
 * @returns {{
 *   nodes: Array,
 *   alerts: Array,
 *   source: 'live' | 'simulated' | 'disconnected',
 *   seed: number,
 *   tick: number,
 *   simTimestamp: number,
 *   lastPacketAt: number|null,
 *   reconnectAttempts: number,
 *   packetsPerMin: number,
 *   oldestPacketAgeS: number,
 *   historyBuffer: Object,
 * }}
 */
export function useTelemetry(scenarioKey = 'slow-subsidence') {
  const [nodes, setNodes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [source, setSource] = useState('simulated');

  // Fetch initial nodes on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/nodes')
      .then(res => res.json())
      .then(fetchedNodes => {
        if (fetchedNodes && fetchedNodes.length > 0) {
          // Merge fetched node fields with default shape
          const processedNodes = fetchedNodes.map(n => ({
            ...makeNode(n.id, n.lat, n.lng, n.name),
            ...n,
            last_seen: Date.now()
          }));
          setNodes(processedNodes);
        } else {
          setNodes(SEED_NODES);
        }
      })
      .catch(() => setNodes(SEED_NODES));
  }, []);
  const [lastPacketAt, setLastPacketAt] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [tick, setTick] = useState(0);
  const [simTimestamp, setSimTimestamp] = useState(Date.now());
  const [packetsPerMin, setPacketsPerMin] = useState(0);
  const [oldestPacketAgeS, setOldestPacketAgeS] = useState(0);

  // Persistent state refs
  const simRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const ageTimerRef = useRef(null);
  const ruleStateRef = useRef({}); // per-node per-rule latch state
  const fusionStateRef = useRef({}); // per-node fusion state
  const packetCountRef = useRef(0);
  const packetWindowRef = useRef([]);
  const historyBufferRef = useRef({}); // per-node rolling history

  // Initialize simulator
  const initSimulator = useCallback(() => {
    const sim = createSimulator({
      seed: DEFAULT_SEED,
      nodes: SEED_NODES,
      scenario: scenarioKey,
    });
    simRef.current = sim;
    return sim;
  }, [scenarioKey]);

  /**
   * Process a batch of nodes through the logic pipeline:
   *   link health → alert engine → corroboration → status fusion → risk index
   */
  const processNodes = useCallback((rawNodes, simTimeMs) => {
    const nowS = Math.floor(simTimeMs / 1000);
    const newAlerts = [];

    // Pass 1: link health + alert engine + corroboration
    const processed = rawNodes.map(node => {
      const n = { ...node };

      // Link health
      n.link_state = classifyLink(n, simTimeMs);
      n.data_age_s = Math.max(0, Math.floor((simTimeMs - n.last_seen) / 1000));

      // Spatial corroboration
      const neighbours = neighboursOf(n, rawNodes);
      const spatial = spatialAgreement(n, neighbours);
      n.spatial_agreement = spatial;

      // Alert engine
      const prevState = ruleStateRef.current[n.id] || {};
      const { level, firedRules, nextRuleState } = evaluateNode(n, prevState, nowS, spatial);
      ruleStateRef.current[n.id] = nextRuleState;
      n.rule_level = level;

      // Generate alert objects for fired rules
      firedRules.forEach(rule => {
        newAlerts.push(makeAlert(n, rule, nowS, spatial));
      });

      // Risk index (display only)
      const { index } = computeRiskIndex(n);
      n.risk_index = index;

      // Status fusion
      const prevFusion = fusionStateRef.current[n.id] || {};
      const fusion = fuseStatus(n, prevFusion);
      fusionStateRef.current[n.id] = fusion;
      n.status = fusion.status;
      n.last_known_level = fusion.last_known_level;
      n.last_known_at = fusion.last_known_at;

      return n;
    });

    // Update history buffer
    processed.forEach(n => {
      if (!historyBufferRef.current[n.id]) {
        historyBufferRef.current[n.id] = [];
      }
      const buf = historyBufferRef.current[n.id];
      buf.push({
        time: new Date(simTimeMs).toLocaleTimeString('en-IN', { hour12: false }),
        timestamp: simTimeMs,
        tilt_x: n.tilt_x_mm_per_m,
        tilt_y: n.tilt_y_mm_per_m,
        tilt_resultant: n.tilt_resultant_mm_per_m,
        vibration: n.vibration_rms_g,
        crack: n.crack_mm,
        temp: n.temp_c,
        settlement: n.settlement_inferred_mm,
      });
      // Cap at 2000 samples
      if (buf.length > 2000) {
        historyBufferRef.current[n.id] = buf.slice(-2000);
      }
    });

    return { processed, newAlerts };
  }, []);

  // Start simulator loop
  const startSimulator = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const sim = initSimulator();
    setSource('simulated');

    intervalRef.current = setInterval(() => {
      const result = sim.step();
      const { processed, newAlerts } = processNodes(result.nodes, result.simTimestamp);

      setNodes(processed);
      setTick(result.tick);
      setSimTimestamp(result.simTimestamp);

      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
      }

      // Track packets per minute
      packetCountRef.current++;
      const now = Date.now();
      packetWindowRef.current.push(now);
      packetWindowRef.current = packetWindowRef.current.filter(t => now - t < 60000);
      setPacketsPerMin(packetWindowRef.current.length);
    }, SIM_TICK_MS);
  }, [initSimulator, processNodes]);

  // Try WebSocket connection
  const tryWebSocket = useCallback(() => {
    if (!WS_URL) {
      startSimulator();
      return;
    }

    let attempt = 0;

    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setSource('live');
          setReconnectAttempts(0);
          attempt = 0;
          // Stop simulator if running
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Validate against makeNode defaults
            const validated = (Array.isArray(data) ? data : [data]).map(n => {
              const base = makeNode();
              const valid = {};
              Object.keys(base).forEach(key => {
                valid[key] = n[key] !== undefined ? n[key] : base[key];
              });
              return valid;
            });

            const now = Date.now();
            setNodes(prev => {
              const merged = [...prev];
              validated.forEach(v => {
                const idx = merged.findIndex(n => n.id === v.id);
                if (idx !== -1) merged[idx] = { ...merged[idx], ...v };
                else merged.push(v);
              });
              
              const { processed, newAlerts } = processNodes(merged, now);
              
              if (newAlerts.length > 0) {
                setTimeout(() => {
                  setAlerts(a => [...newAlerts, ...a].slice(0, 100));
                }, 0);
              }
              
              return processed;
            });
            setLastPacketAt(now);
            setSimTimestamp(now);
            setTick(prev => prev + 1);

            packetCountRef.current++;
            packetWindowRef.current.push(now);
            packetWindowRef.current = packetWindowRef.current.filter(t => now - t < 60000);
            setPacketsPerMin(packetWindowRef.current.length);
          } catch (parseErr) {
            console.warn('Malformed WebSocket frame dropped:', parseErr);
          }
        };

        ws.onerror = () => {
          // Will trigger onclose
        };

        ws.onclose = () => {
          wsRef.current = null;
          attempt++;
          setReconnectAttempts(attempt);

          // Exponential backoff: 1s, 2s, 4s, ... capped at 30s
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), MAX_RECONNECT_DELAY);

          // Fall back to simulator while reconnecting
          if (!intervalRef.current) {
            startSimulator();
          }

          setTimeout(connect, delay);
        };
      } catch (err) {
        // WebSocket constructor failed — go to simulator
        startSimulator();
      }
    };

    connect();
  }, [startSimulator, processNodes]);

  // 1-second UI timer for data age (independent of packet arrival)
  useEffect(() => {
    ageTimerRef.current = setInterval(() => {
      setNodes(prev => {
        const now = prev.length > 0 ? prev[0].last_seen + ((Date.now() - (simRef.current ? 0 : 0))) : Date.now();
        let oldest = 0;
        const updated = prev.map(n => {
          // For simulated mode, age is already set by the simulator
          // For live mode, compute from wall clock
          if (source === 'live') {
            const age = Math.floor((Date.now() - n.last_seen) / 1000);
            if (age > oldest) oldest = age;
            return { ...n, data_age_s: age };
          }
          if (n.data_age_s > oldest) oldest = n.data_age_s;
          return n;
        });
        setOldestPacketAgeS(oldest);
        return updated;
      });
    }, 1000);

    return () => {
      if (ageTimerRef.current) clearInterval(ageTimerRef.current);
    };
  }, [source]);

  // Initialize on mount
  useEffect(() => {
    tryWebSocket();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [tryWebSocket]);

  const addNode = useCallback((newNode) => {
    setNodes(prev => {
      if (prev.some(n => n.id === newNode.id)) return prev;
      return [...prev, newNode];
    });
  }, []);

  return {
    nodes,
    addNode,
    alerts,
    source,
    seed: DEFAULT_SEED,
    tick,
    simTimestamp,
    lastPacketAt,
    reconnectAttempts,
    packetsPerMin,
    oldestPacketAgeS,
    historyBuffer: historyBufferRef.current,
    setAlerts,
  };
}
