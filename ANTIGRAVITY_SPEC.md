# ANTIGRAVITY IMPLEMENTATION SPEC — SIH 26025 Mine Subsidence Dashboard

> **Note (Hinglish):** ye file **English mein** hai jaan-boojhkar — coding agent ko English spec se sabse accurate result milta hai. Aap ise seedha Antigravity ko de do. Har task mein exact file, exact current code, exact target, aur "kaam ho gaya ya nahi" ka test likha hai.

---

## 0. HOW TO USE THIS FILE

You are implementing changes to an existing React dashboard. Work through **Phase 1 tasks T1 → T13 in order** — later tasks depend on earlier ones. Do not skip ahead.

For every task:
1. Read the listed files fully before editing.
2. Make the change.
3. Verify against the task's **Done when** list.
4. Run `npm run build` in `frontend/` and confirm zero errors before moving on.

If a task's instruction conflicts with something you find in the code, **stop and report the conflict** rather than guessing.

Do not reformat, restyle, or refactor code you were not asked to touch. Keep diffs minimal and reviewable.

---

## 1. PROJECT CONTEXT

**What this is:** a control-room dashboard for an AI-enabled low-cost real-time subsidence monitoring and early-warning system for Indian underground coal mines. It is a Smart India Hackathon 2026 entry (Problem Statement 26025, Ministry of Coal / Coal India Limited). It will be judged by mining-domain evaluators (DGMS, CSIR-CIMFR, Coal India engineers), so **domain correctness matters more than visual polish**.

**Physical system it represents:** ESP32 + LoRa mesh sensor nodes on the ground surface above an underground coal panel. Each node carries an MPU6050/6500 IMU (tilt + vibration), a string-potentiometer crack sensor across a joint, an optional NEO-6M GPS, and an optional DHT22. Nodes relay over a multi-hop LoRa mesh to 1–2 gateways; a gateway has the only internet backhaul. Duty cycle is one sample every ~5 minutes.

**Stack (do not change):** React 18 via Create React App (`react-scripts` 5.0.1), `react-leaflet` 4.2.1 + `leaflet` 1.9.4 on OpenStreetMap tiles, `recharts` 2.10.3, `lucide-react` for icons, one hand-written `src/index.css` (~1640 lines) using CSS custom properties. No TypeScript. No CSS framework.

**Repo layout (only `frontend/` is in scope):**

```
frontend/
  .env
  package.json
  src/
    index.js
    index.css                 ← design tokens at :root, lines 6-40
    App.js                    ← 393 lines: state, mock telemetry engine, KPI header
    components/
      MapView.jsx             ← 430 lines: Leaflet map, node markers, search, add-node
      NodeSidebar.jsx         ← 327 lines: FleetSidebar + DetailPanel (named exports)
      LiveGraph.jsx           ← 221 lines: recharts ComposedChart + time ranges
      AlertBanner.jsx         ←  38 lines: scrolling marquee ticker
      AddModal.jsx            ← 231 lines: AddAreaModal + AddNodeModal
```

**Current state, honestly:** the UI shell is good. The data underneath it is not. There is no data source (no WebSocket, no API call), telemetry is a 2-second `setInterval` random walk, alerts fire on a coin flip, tilt is reported in degrees at thresholds that are physically impossible, and several displayed values are hardcoded JSX with no data behind them. Phase 1 fixes all of that.

---

## 2. HARD RULES (non-negotiable — a reviewer will check these)

**R1 — No randomness in any decision path.** `Math.random()` must never influence a status, a severity, an alert, or a score. Randomness is allowed **only** inside the simulator module, and only through a seeded PRNG (rule R2). Grep `Math.random` at the end: every remaining hit must be inside `src/sim/`.

**R2 — Demos must be reproducible.** Implement a small seeded PRNG (mulberry32 is fine, ~5 lines) in `src/sim/prng.js`. The simulator takes a seed. Same seed ⇒ identical run. Default seed `26025`.

**R3 — Every number rendered on screen must trace to a field in the data model (§4).** No hardcoded values in JSX. If a value is not measured, either derive it explicitly and label it as derived, or do not show it.

**R4 — Never display tilt in degrees.** See §3. Degrees may exist internally for sensor-level conversion but must never reach the UI.

**R5 — Label the data source honestly.** The header must show which mode is live: `● LIVE (gateway)`, `◐ SIMULATED`, or `○ DISCONNECTED`. Never show a static "LIVE" badge.

**R6 — Do not invent domain thresholds.** Use only the constants in §5. Every threshold constant must carry the `// [VERIFY]` comment shown there, so the team knows what still needs a citation.

**R7 — No new dependencies in Phase 1.** Everything in T1–T13 is achievable with what is already in `package.json`. If you believe a dependency is required, stop and report instead of installing.

**R8 — Do not touch `backend/`, `hardware/`, or any `.py`/`.ino`/`.h5` file.** They are currently 0 bytes and out of scope (see §8).

**R9 — Keep it accessible.** Never encode state in colour alone: pair every colour with a text label or icon. Keep contrast at WCAG AA against the dark background. All interactive elements must be real `<button>`s, keyboard-reachable, with `aria-label` where the label is an icon only.

**R10 — No browser storage APIs** (`localStorage`, `sessionStorage`). Hold state in React.

---

## 3. DOMAIN FACTS YOU MUST NOT GET WRONG

**3.1 Tilt is reported in mm/m, never degrees.** Ground tilt in subsidence engineering is a gradient: millimetres of differential settlement per metre of horizontal distance. Conversion is exact: `1 mm/m = 0.0573°`, i.e. `mm_per_m = degrees / 0.0573`.

Why this matters: the damage-relevant range for structures is roughly **0–10 mm/m**. The current code draws a "TILT DANGER" line at **15°**, which is about **262 mm/m** — roughly 26× past the point of total structural destruction. Any mining engineer will spot this immediately.

**3.2 Cumulative settlement is monotonic.** Ground that has subsided does not rise back. `settlement_inferred_mm` is negative-going and its **magnitude may only increase**. The current code random-walks it in both directions.

**3.3 Settlement is inferred, not measured.** No sensor in this project's bill of materials measures absolute vertical settlement. The IMU gives tilt, the string-pot gives crack opening, the piezo gives vibration, and NEO-6M GPS is ±2.5 m — useless at millimetre scale. Settlement must be **derived** by integrating tilt along a chain of nodes with known spacing, relative to a stable reference node located outside the zone of influence:

```
settlement(node_i) = settlement(reference) + Σ ( tilt_k × spacing_k )
```

So it must be labelled as inferred, and must always be shown with its method, its reference node, and an error estimate. Never present it as a directly measured quantity.

**3.4 Temperature is the dominant error source.** A MEMS accelerometer's zero-g offset drifts with temperature. Over a 15–20 °C day/night swing this produces *apparent* tilt that can exceed the real subsidence signal. That is why the model separates `tilt_x_raw_mm_per_m` from `tilt_x_mm_per_m` (corrected). **`[VERIFY]`** the exact drift coefficient from the MPU6050/6500 datasheet's "Zero-G Level Change vs Temperature" spec before quoting a number anywhere.

**3.5 One latency number is a lie.** With a ~5-minute duty cycle, a single global "<2 s latency" claim is arithmetically impossible. There are three separate latencies and the UI must keep them separate: node-local buzzer `<1 s`, dashboard update `≤5 min`, critical SMS `<60 s`.

**3.6 A single node must never escalate to CRITICAL alone** on a soft threshold. Wind, passing traffic, and a faulty sensor all look like a single-node excursion. CRITICAL requires either a hard safety threshold breach or agreement from neighbouring nodes. See T7.

---

## 4. TARGET DATA MODEL — the central contract

This is the single source of truth for the whole app. Create it as `src/model/nodeShape.js` with a `makeNode(overrides)` factory and a JSDoc block describing every field. Every UI element must read from a field here (rule R3).

Fields marked **(measured)** come from a sensor. **(derived)** means computed in the frontend from measured fields — these must be visually labelled as derived wherever shown. **(link)** is network metadata from the gateway.

```js
{
  // ---- identity & siting ----
  id: 'NODE-001',              // stable node id
  name: 'Panel A · North Rib',
  panel_id: 'PANEL-A',         // links node → panel GeoJSON (T13)
  lat: 23.7402, lng: 86.4128,
  gps_fix: '3D',               // '3D' | '2D' | 'NONE' — GPS is for siting only, NOT settlement
  install_date: '2026-08-14',
  spacing_m: 20,               // distance to next node in the chain — needed by T8
  is_reference: false,         // true for the stable node outside the influence zone
  firmware: '1.4.2',

  // ---- baseline (zero-calibration), set at install ----
  baseline: {
    tilt_x_mm_per_m: 0.0,
    tilt_y_mm_per_m: 0.0,
    crack_mm: 0.0,
    set_at: '2026-08-14T09:12:00+05:30',
  },

  // ---- measured ----
  temp_c: 31.4,                        // (measured) DHT22 — mandatory, drives T14 correction
  tilt_x_raw_mm_per_m: 3.10,           // (measured) before thermal correction & baseline
  tilt_y_raw_mm_per_m: 1.40,           // (measured)
  vibration_rms_g: 0.42,               // (measured) RMS over the sample window, not peak
  crack_mm: 4.20,                      // (measured) string-pot across the joint
  enclosure_humidity_pct: 58,          // (measured) DHT22 — enclosure, NOT ground moisture
  battery_pct: 78,                     // (measured)
  solar_w: 3.10,                       // (measured) 0 at night — never hardcode
  rssi_dbm: -96,                       // (link)

  // ---- derived: tilt (baseline-relative + thermally corrected) ----
  tilt_x_mm_per_m: 1.05,               // (derived) = raw − baseline − thermal
  tilt_y_mm_per_m: 0.60,               // (derived)
  tilt_resultant_mm_per_m: 1.21,       // (derived) = hypot(x, y) — this is what alerts use

  // ---- derived: settlement (NEVER call this measured — see §3.3) ----
  settlement_inferred_mm: -18.4,       // (derived) negative-going, monotonic magnitude
  settlement_method: 'tilt-integration',
  settlement_ref_node: 'NODE-REF-1',
  settlement_err_mm: 4.0,              // (derived) ± estimate, must be displayed with the value

  // ---- mesh / link health ----
  hops_to_gateway: 2,                  // (link) — 'mesh' must be visible in the UI
  parent_node: 'NODE-004',             // (link) next hop toward the gateway
  gateway_id: 'GW-1',                  // (link)
  last_seen: 1757049120000,            // (link) epoch ms
  data_age_s: 142,                     // (derived) = now − last_seen
  link_state: 'ok',                    // 'ok' | 'stale' | 'offline' — from data_age_s, see T9
  packet_loss_pct: 3,                  // (link)
  buffered_packets: 0,                 // (link) store-and-forward backlog
  sample_mode: 'normal',               // 'normal' (5 min) | 'emergency' (30 s)

  // ---- data quality ----
  quality_flags: [],                   // e.g. ['STUCK_VALUE','OUT_OF_RANGE','CLOCK_SKEW']
  data_trust: 'good',                  // 'good' | 'suspect' | 'bad' — derived from flags

  // ---- decision layer ----
  rule_level: 'normal',                // 'normal' | 'watch' | 'warning' | 'critical' (T5)
  anomaly_score: null,                 // AI: null until a real model exists — do NOT fake it
  trend_mm_per_m_per_day: 0.35,        // (derived) least-squares slope over 24 h
  spatial_agreement: { agree: 3, of: 4, r2: 0.88 },   // (derived) T7
  status: 'warning',                   // final fused state shown on the map
  risk_index: 62,                      // (derived) rule-based composite — label it as such
}
```

**Field-rename map from the current code** (apply everywhere, no leftovers):

| Old field | New field | Note |
|---|---|---|
| `tilt_pitch_deg` | `tilt_x_raw_mm_per_m` → `tilt_x_mm_per_m` | unit change, not just a rename |
| `tilt_roll_deg` | `tilt_y_raw_mm_per_m` → `tilt_y_mm_per_m` | unit change |
| `vibration_g` | `vibration_rms_g` | clarify it is RMS |
| `crack_width_mm` | `crack_mm` | matches research §Q `crack_displacement_mm` |
| `subsidence_mm` | `settlement_inferred_mm` | + method / ref node / error |
| `moisture_pct` | `enclosure_humidity_pct` | it was never ground moisture |
| `sector` | `panel_id` | matches research §Q `panels` table |
| `risk_score` | `risk_index` | drop the word "score" with "AI" next to it |

---

## 5. CONSTANTS — create `src/model/constants.js`

Every threshold in the app must be imported from this one file. No magic numbers anywhere else. Keep the `[VERIFY]` comments verbatim — the team uses them as a to-do list for citations.

```js
/** Exact conversion. 1 mm/m = 0.0573 degrees. Safe to use. */
export const DEG_PER_MM_PER_M = 0.0573;
export const degToMmPerM = (deg) => deg / DEG_PER_MM_PER_M;
export const mmPerMToDeg = (mm) => mm * DEG_PER_MM_PER_M;

/** Tilt bands, mm/m, on tilt_resultant_mm_per_m.
 *  [VERIFY] against NCB Subsidence Engineers' Handbook / CSIR-CIMFR guidance
 *  before quoting these to evaluators. Indicative only. */
export const TILT = {
  NORMAL_MAX:  2.0,   // [VERIFY]
  WARN_MAX:    5.0,   // [VERIFY]
  CRITICAL_AT: 5.0,   // [VERIFY]  above this = critical band
};

/** Hysteresis: enter on the high value, leave only on the low value.
 *  Prevents an alert flickering on/off around a single threshold. */
export const HYST = {
  WARN_ENTER: 2.0, WARN_EXIT: 1.6,       // [VERIFY]
  CRIT_ENTER: 5.0, CRIT_EXIT: 4.0,       // [VERIFY]
};

/** Other sensor thresholds. [VERIFY] all of these. */
export const VIB_RMS_G   = { WARN: 0.30, CRIT: 0.60 };   // [VERIFY]
export const CRACK_MM    = { WARN: 3.0,  CRIT: 6.0  };   // [VERIFY]
export const CRACK_RATE  = { WARN: 0.5,  CRIT: 1.5  };   // mm/day  [VERIFY]
export const BATTERY_PCT = { WARN: 40,   CRIT: 20   };
export const RSSI_DBM    = { WARN: -110, CRIT: -120 };   // [VERIFY] vs SX1276 sensitivity

/** Timing. Duty cycle is the anchor for every staleness rule. */
export const SAMPLE_INTERVAL_S   = 300;   // 5 min normal duty cycle
export const EMERGENCY_INTERVAL_S = 30;   // emergency mode
export const STALE_MULTIPLIER    = 3;     // > 3× interval  → stale
export const OFFLINE_MULTIPLIER  = 10;    // > 10× interval → offline
export const ALERT_COOLDOWN_S    = 600;   // per node, per rule

/** Three separate latency budgets. Never collapse into one number. §3.5 */
export const LATENCY_BUDGET = {
  node_buzzer_s: 1,     // decided on the node itself
  dashboard_s:   300,   // bounded by the duty cycle
  critical_sms_s: 60,   // from gateway decision
};

/** Panel geometry for the influence zone. r = H · tan(beta) */
export const PANEL_GEOM = {
  depth_m: 45,          // [VERIFY] actual panel depth
  angle_of_draw_deg: 25,// [VERIFY] site-specific, 20-35 deg typical
};
export const influenceRadiusM = (H, betaDeg) =>
  H * Math.tan((betaDeg * Math.PI) / 180);   // 45 m @ 25 deg = 21.0 m

/** Corroboration: how many neighbours must agree to confirm CRITICAL. §3.6 */
export const CORROBORATION = { MIN_NEIGHBOURS: 2, MIN_R2: 0.70 };  // [VERIFY]

/** Deterministic demo seed. */
export const DEFAULT_SEED = 26025;
```

---

## 6. PHASE 1 — TASKS T1 → T13 (do these in order)

Phase 1 makes the dashboard **truthful**. It adds almost no new screens. When Phase 1 is done, every number on screen is real, traceable, deterministic, and correctly dimensioned.

---

### T1 — Foundation: the data model and the constants file

**Goal:** create the two files everything else imports, and migrate the seed node array onto the new shape.

**Files:** create `src/model/constants.js` (exact content in §5) and `src/model/nodeShape.js`; edit `src/App.js` (seed array at lines 28–109).

**Current code:** `App.js` holds a 7-node array literal with fields `tilt_pitch_deg`, `tilt_roll_deg`, `vibration_g`, `crack_width_mm`, `subsidence_mm`, `moisture_pct`, `sector`, `risk_score`. There is no temperature field, no baseline, no mesh metadata, no quality flags.

**Target:**
1. `nodeShape.js` exports `makeNode(overrides)` returning the full §4 object with sane defaults, plus a JSDoc block documenting every field and marking it `(measured)`, `(derived)`, or `(link)`.
2. It also exports `SEED_NODES` — the 7 nodes rebuilt through `makeNode`, moved out of `App.js`.
3. Values must be **self-consistent**: for each node, `tilt_resultant_mm_per_m × spacing_m` accumulated along the chain must roughly match `settlement_inferred_mm`. The current data is internally contradictory — NODE-007 has `tilt_pitch_deg: 12.5` (≈218 mm/m) alongside `subsidence_mm: -35` (≈1.7 mm/m over a 21 m span), a ~130× disagreement. Pick realistic tilts in the 0.2–7 mm/m range and derive settlement from them, not the other way round.
4. Designate exactly one node `is_reference: true`, sited outside the influence zone, with `settlement_inferred_mm: 0`.
5. `App.js` imports `SEED_NODES` instead of declaring the array.

**Done when:**
- `grep -rn "tilt_pitch_deg\|tilt_roll_deg\|vibration_g\|crack_width_mm\|subsidence_mm\|moisture_pct" src/` returns **zero hits**.
- Exactly one node has `is_reference: true`.
- Every node has `temp_c`, `baseline`, `hops_to_gateway`, `quality_flags`, `spacing_m`.
- `npm run build` passes.

---

### T2 — Seeded simulator: confine all randomness to `src/sim/`

**Goal:** make the demo reproducible and get `Math.random()` out of every decision path (rules R1, R2).

**Files:** create `src/sim/prng.js`, `src/sim/simulator.js`, `src/sim/scenarios.js`; edit `src/App.js` (remove `perturb` at lines 111–115 and the telemetry `setInterval` at lines 210–268).

**Current code:**
```js
function perturb(value, min, max, volatility) {
  const delta = (Math.random() - 0.48) * volatility;   // ← unseeded
  return Math.max(min, Math.min(max, +(value + delta).toFixed(3)));
}
```
`Math.random()` also appears at `App.js:252` inside the alert condition and inside `LiveGraph.jsx` `generateHistoricalData`.

**Target:**
1. `prng.js` — mulberry32:
```js
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```
2. `simulator.js` — a `createSimulator({ seed = DEFAULT_SEED, nodes, scenario })` factory exposing `step()` which returns the next full node array. It owns the physics: a slow subsidence ramp, a diurnal temperature curve (which is what generates *apparent* raw tilt), vibration noise, monotonic settlement, and occasional packet loss. It must **not** compute statuses or alerts — that is T5/T6's job. The simulator produces measurements only.
3. **Time scaling.** Real duty cycle is 300 s but a demo cannot wait. Introduce `SIM_TIME_SCALE = 150` (one 2-second tick advances simulated time by 300 s). Every timestamp the simulator emits must use simulated time, so `data_age_s`, staleness, and trend slopes are all internally consistent and demonstrable within a 5-minute demo.
4. `scenarios.js` — named scenario definitions, initially just `'steady'` and `'slow-subsidence'`. Later tasks add more.

**Done when:**
- `grep -rn "Math.random" src/` returns hits **only** inside `src/sim/`.
- Running the app twice with seed `26025` produces an identical first 50 ticks (log the resultant tilt of node 1 for the first 50 ticks and diff the two runs).
- `npm run build` passes.

---

### T3 — `useTelemetry()` hook: real data source + honest source badge

**Goal:** give the app a real data path so that when the gateway exists, the dashboard connects to it — and say plainly, on screen, which path is currently in use (rule R5).

**Files:** create `src/hooks/useTelemetry.js`; edit `src/App.js`, `frontend/.env`.

**Current code:** there is no data source at all. `grep -rn "WebSocket" src/` returns **0 hits**. The only `fetch()` in the whole frontend is the Nominatim place lookup at `MapView.jsx:114`. Telemetry is a 2000 ms `setInterval` random walk inside `App.js`.

**Target:**
1. `.env` gains `REACT_APP_WS_URL=ws://localhost:8000/ws/telemetry` (documented as optional).
2. `useTelemetry()` returns `{ nodes, source, lastPacketAt, reconnectAttempts, connect, disconnect }` where `source` is one of `'live' | 'simulated' | 'disconnected'`.
3. Behaviour: if `REACT_APP_WS_URL` is set, try to open the socket. On `open` → `source = 'live'`. On `error`/`close` → exponential backoff reconnect (1 s, 2 s, 4 s, capped at 30 s) and fall back to the simulator with `source = 'simulated'`. If the URL is absent, go straight to `'simulated'` — that is a legitimate mode, not a failure. Only show `'disconnected'` when the user has explicitly chosen live mode and the socket is down with no fallback running.
4. Incoming socket frames are validated against `makeNode` defaults before entering state; a malformed frame is dropped and counted, never rendered.
5. Header badge replaces the hardcoded `<span className="status-dot" /> LIVE` in `App.js`:
   - `● LIVE (gateway GW-1)` green
   - `◐ SIMULATED (seed 26025)` amber
   - `○ DISCONNECTED` red
   Each variant carries a text label, not just a colour (rule R9).
6. Clean up on unmount: close the socket, clear the interval.

**Done when:**
- With `REACT_APP_WS_URL` unset, the app runs and the header reads `◐ SIMULATED (seed 26025)`.
- Pointing the URL at a dead port shows the fallback badge, not a crash or a blank screen.
- No `setInterval` remains in `App.js`.
- `npm run build` passes.

---

### T4 — Units: mm/m everywhere, degrees never displayed

**Goal:** fix the single most damaging credibility bug (§3.1, rule R4).

**Files:** `src/App.js`, `src/components/NodeSidebar.jsx`, `src/components/LiveGraph.jsx`, `src/components/MapView.jsx`.

**Current code — all four places are wrong:**
- `App.js:284` — KPI card "Avg Tilt" renders `&deg;`.
- `NodeSidebar.jsx:155-179` — pitch thresholds `15 / 8`, roll thresholds `10 / 5`, all in degrees.
- `LiveGraph.jsx:200-203` — `<ReferenceLine y={15} label="⚠ TILT DANGER 15°" />`.
- `MapView.jsx:340` — popup row `Tilt (Pitch)` in degrees.

At 15° ≈ 262 mm/m, that reference line sits about 26× beyond total structural destruction.

**Target:**
1. All four render `tilt_resultant_mm_per_m` (or the x/y components) with the unit string `mm/m`, formatted to one decimal.
2. Reference lines move to the §5 constants: `y={TILT.NORMAL_MAX}` labelled `Watch 2.0 mm/m` and `y={TILT.CRITICAL_AT}` labelled `Critical 5.0 mm/m`. Both labels must show the numeric value, so a judge can read the threshold off the chart.
3. `NodeSidebar` threshold bars read from `TILT` and `HYST`, never from inline literals.
4. Chart Y-axis label becomes `Tilt (mm/m)`; the domain becomes roughly `[0, 8]` instead of `[-20, 20]`.
5. Tooltips show, for each tilt value, the equivalent in degrees **in parentheses as secondary text only** if you want it at all — e.g. `4.2 mm/m (0.24°)`. This is the only place degrees may appear, and it must never be the primary figure.
6. Add a one-line footnote under the chart: `1 mm/m = 0.0573° · damage-relevant range ≈ 0–10 mm/m`.

**Done when:**
- `grep -rn "deg\b\|°\|&deg;" src/components src/App.js` returns hits only inside the optional parenthetical helper and the conversion function in `constants.js`.
- No reference line, threshold, or axis anywhere uses a value above 10 for tilt.
- `npm run build` passes.

---

### T5 — Deterministic alert engine with hysteresis and cooldown

**Goal:** an alert must be a function of the data alone, and must carry the evidence that produced it.

**Files:** create `src/logic/alertEngine.js`; edit `src/App.js`.

**Current code — `App.js:252-261`:**
```js
if (Math.abs(node.tilt_pitch_deg) > 14 && Math.random() > 0.7) {
  newAlerts.push({
    id: Date.now() + Math.random(),
    severity: 'critical',
    message: `${node.id} tilt at ${node.tilt_pitch_deg.toFixed(1)}° — exceeds 14° threshold!`,
    ...
```
The same reading alerts about 30% of the time. A judge watching for two minutes will see identical values behave differently, and the demo cannot be replayed.

**Target:**
1. `evaluateNode(node, prevRuleState, nowS)` → `{ level, firedRules[], nextRuleState }`. Pure function, no side effects, no clock reads inside — `nowS` is passed in so it is unit-testable.
2. Rules, each with a stable `code`: `TILT_RATE`, `TILT_ABS`, `CRACK_ABS`, `CRACK_RATE`, `VIB_ABS`, `BATTERY_LOW`, `LINK_LOST`, `SENSOR_SUSPECT`.
3. **Hysteresis** per node per rule: enter at `HYST.CRIT_ENTER`, leave only below `HYST.CRIT_EXIT`. Keep the latch in `nextRuleState` — never recompute from the current sample alone.
4. **Cooldown:** once a rule has fired for a node, suppress re-firing for `ALERT_COOLDOWN_S`. Escalation (warning → critical) bypasses cooldown; de-escalation does not.
5. Alert object shape:
```js
{ id, node_id, panel_id, rule_code, level, raised_at, value, threshold, unit,
  provenance: { rule: {...}, ai: null, spatial: {...} },
  status: 'pending', ack_by: null, ack_at: null, resolved_at: null, note: null }
```
6. Every alert message must be reconstructable from the fields — e.g. `NODE-005 · TILT_ABS · 5.4 mm/m > 5.0 mm/m threshold`. No free-text strings that are not derived from `value`/`threshold`/`unit`.
7. `ai: null` until a real model exists. **Do not fabricate an anomaly score.**

**Done when:**
- Feeding the same node array twice produces byte-identical alert arrays.
- A value oscillating between 4.5 and 5.2 mm/m raises **one** alert, not a stream.
- No `Math.random()` in `alertEngine.js`.
- `npm run build` passes.

---

### T6 — Status fusion: separate `rule_level` from `status`

**Goal:** stop deriving the map colour from a composite score. The displayed status must come from the rule engine and the link state, in a defined precedence order.

**Files:** create `src/logic/fuseStatus.js`; edit `src/App.js` (lines 245–247), `src/components/NodeSidebar.jsx`.

**Current code — `App.js:245-247`:**
```js
if (updated.risk_score >= 75) updated.status = 'critical';
else if (updated.risk_score >= 45) updated.status = 'warning';
else updated.status = 'active';
```
Two problems. First, the status is downstream of an arbitrary weighted sum, so a node can be coloured red without any single reading breaching any threshold — unexplainable in front of an evaluator. Second, `'offline'` is **never assigned anywhere**, which makes the sidebar's `Offline (0)` filter permanently dead UI (`App.js:215` checks for it, nothing ever sets it).

**Target:** precedence, highest wins:
```
1. link_state === 'offline'        → status 'offline'   (⚫ we do not know this node's state)
2. data_trust === 'bad'            → status 'suspect'   (🟣 excluded from corroboration)
3. rule_level === 'critical'       → status 'critical'  (🔴)
4. rule_level === 'warning'        → status 'warning'   (🟡)
5. link_state === 'stale'          → status 'stale'     (🟠 last known reading shown greyed)
6. otherwise                       → status 'normal'    (🟢)
```
Key point for reviewers: an offline node is **not** a safe node. It must never render green. Show it as "state unknown", and if it was in warning or critical when contact was lost, retain that as `last_known_level` and display `⚫ OFFLINE (was 🟡 WARNING 12 min ago)`.

**Also:** add `'suspect'` and `'stale'` to the sidebar filter set and to the CSS status colours in `index.css`, keeping every colour paired with its text label (rule R9).

**Done when:**
- Every one of the six statuses is reachable, and each can be produced from the simulator.
- The sidebar filter counts sum to the total node count with no bucket permanently at zero.
- `risk_index` no longer influences `status` anywhere.
- `npm run build` passes.

---

### T7 — Spatial corroboration: no lone node escalates to CRITICAL

**Goal:** implement §3.6. This is the single most persuasive thing in the whole build for a technical evaluator, because it is exactly how a false positive gets killed.

**Files:** create `src/logic/corroborate.js`; edit `src/logic/alertEngine.js`, `src/components/NodeSidebar.jsx`.

**Current code:** nothing. `grep -rn "coheren\|correlat\|neighbour\|neighbor" src/` returns **0 hits**. Every alert is a single-node decision.

**Target:**
1. `neighboursOf(node, nodes, radiusM)` — great-circle distance, default radius = `influenceRadiusM(depth, angleOfDraw)` from §5. Exclude nodes whose `data_trust === 'bad'` and nodes that are `offline`.
2. `spatialAgreement(node, neighbours)` → `{ agree, of, r2 }` where `agree` counts neighbours whose tilt is moving in a consistent direction with a consistent gradient, and `r2` is the coefficient of determination of a linear fit of tilt against distance along the chain. A real subsidence trough gives a smooth, spatially coherent gradient; wind, a passing truck, or a failing sensor gives an isolated spike.
3. Escalation gate in the alert engine:
   - hard safety threshold breached → CRITICAL immediately, no corroboration needed
   - soft threshold + `agree >= CORROBORATION.MIN_NEIGHBOURS` and `r2 >= CORROBORATION.MIN_R2` → CRITICAL
   - soft threshold alone → **WARNING**, with the reason shown: `single-node excursion — awaiting neighbour agreement`
4. Detail panel shows the triad explicitly:
```
[■ RULE]     5.4 mm/m > 5.0 mm/m
[■ SPATIAL]  3/4 neighbours agree · R² 0.88
[□ AI]       no model deployed
→ 2 of 3 paths agree · CRITICAL confirmed
```
   The `AI` row must render as an empty box with `no model deployed` until a trained model actually exists. An honest empty badge is worth more than a fake number — and it sets up the strongest line available: *"AI is advisory, physics is authoritative; if the model is switched off the system still works."*

**Done when:**
- A single node forced to 6 mm/m in isolation produces **WARNING**, not CRITICAL, and shows the awaiting-agreement reason.
- Three adjacent nodes forced onto a coherent ramp produce **CRITICAL** with `r2 > 0.7`.
- A node marked `data_trust: 'bad'` is visibly excluded from the `of` count.
- `npm run build` passes.

---

### T8 — Settlement: inferred, monotonic, labelled, with an error bar

**Goal:** the hero KPI currently claims a quantity no sensor in the bill of materials can measure. Fix both the physics and the label (§3.2, §3.3).

**Files:** create `src/logic/settlement.js`; edit `src/sim/simulator.js`, `src/App.js` (KPI strip, lines 297–326), `src/components/NodeSidebar.jsx`, `src/components/MapView.jsx`.

**Current code — `App.js:221`:**
```js
const subsidence_mm = Math.min(0, perturb(node.subsidence_mm, -60, 0, 0.2));
```
`perturb` moves in both directions, so cumulative settlement shrinks as often as it grows. Ground that has subsided does not rise. Separately, the KPI card reads `Max Subsidence  −61 mm` as though it were a measurement, and the detail panel shows it beside genuinely measured values with no distinction.

**Target:**
1. `integrateSettlement(nodes)` — order the chain by `spacing_m` from the node flagged `is_reference`, then accumulate `settlement_i = settlement_{i-1} + tilt_i × spacing_i`. Reference node stays at 0.
2. **Monotonic clamp**, applied after integration: `settlement_inferred_mm = Math.min(prev, next)`. Magnitude may only increase.
3. Error propagation: `settlement_err_mm = sqrt(Σ (tilt_err_k × spacing_k)²)`, with `tilt_err` taken from the residual thermal-correction uncertainty. **`[VERIFY]`** the per-sample tilt error from the MPU6050/6500 datasheet before quoting it.
4. Every place it is displayed must show all four parts together, never the number alone:
```
Inferred settlement   −18.4 ± 4.0 mm
method: tilt integration · ref NODE-REF-1 · 3 hops
```
5. Rename the KPI card from `Max Subsidence` to `Max inferred settlement`, and add an `ⓘ` button (a real `<button>` with `aria-label`) opening a short popover: what is integrated, from which reference node, and why GPS cannot be used at this scale (NEO-6M is ±2.5 m — two orders of magnitude larger than the millimetre-scale value being displayed).
6. The simulator generates settlement the same way — from its own tilt field — so the displayed relationship actually holds. Never generate settlement independently of tilt.

**Done when:**
- Over a 500-tick run, `settlement_inferred_mm` never increases for any node (assert it in a test).
- The word "subsidence" no longer appears as a measured node field; `grep -rn "Max Subsidence" src/` returns 0 hits.
- Every rendering of settlement includes the `±` error and the method.
- `npm run build` passes.

---

### T9 — Data age, real staleness, and three separate latency numbers

**Goal:** make it visible how old each reading is, make the offline state real, and never state one global latency figure (§3.5).

**Files:** create `src/logic/linkHealth.js`; edit `src/App.js` (header), `src/components/NodeSidebar.jsx` (lines 101–107), `src/components/MapView.jsx`.

**Current code:** `timeSinceLastSeen()` exists at `NodeSidebar.jsx:101-107` but only inside the detail panel, and it can never report anything stale because `last_seen` is refreshed on every 2-second tick. `link_state` does not exist. `App.js:215` tests `node.status === 'offline'` but nothing ever sets it.

**Target:**
1. `classifyLink(node, nowS)` → `'ok' | 'stale' | 'offline'` using `SAMPLE_INTERVAL_S`, `STALE_MULTIPLIER`, `OFFLINE_MULTIPLIER`. In `'emergency'` sample mode use `EMERGENCY_INTERVAL_S` instead.
2. `data_age_s` is computed on a 1-second UI timer that is **independent of packet arrival**, so a node with no incoming data visibly ages on screen. This is what makes the "pull the node's power" demo work.
3. Every fleet-list card shows the age (`2m 20s`), and stale cards render their values greyed with a `last reading` prefix, so nobody mistakes a frozen number for a current one.
4. Header shows `oldest packet: 4m 12s` across the fleet, plus `packets/min` actually counted.
5. Replace any single latency figure with three labelled budgets, read from `LATENCY_BUDGET`:
```
Node buzzer  < 1 s   (decided on the node)
Dashboard    ≤ 5 min (duty cycle bound)
Critical SMS < 60 s  (from gateway decision)
```
   Each shows the measured value against the budget when a measurement exists, and `—` when it does not. **Do not** print a "<2 s latency" claim anywhere; against a 300-second duty cycle it is arithmetically impossible and it is the kind of number an evaluator will test.

**Done when:**
- Stopping the simulator moves a node to `stale` after ~15 simulated minutes and `offline` after ~50, visible without a page reload.
- The sidebar `Offline` and `Stale` filters both return non-zero in the node-death scenario.
- `grep -rn "2s\|<2 s\|2 second" src/` finds no latency claim.
- `npm run build` passes.

---

### T10 — Stop calling a weighted sum "AI"

**Goal:** remove an indefensible claim while keeping the useful part of the feature.

**Files:** `src/App.js` (lines 117–124), `src/components/NodeSidebar.jsx` (line 146).

**Current code — `App.js:117-124`:**
```js
function calculateRisk(n) {
  const tiltRisk = Math.min(100, ((Math.abs(n.tilt_pitch_deg) + Math.abs(n.tilt_roll_deg)) / 30) * 100);
  const vibRisk  = Math.min(100, (n.vibration_g / 2.0) * 100);
  const crackRisk = Math.min(100, (n.crack_width_mm / 10) * 100);
  const subsRisk = Math.min(100, (Math.abs(n.subsidence_mm) / 50) * 100);
  return Math.round(tiltRisk * 0.3 + vibRisk * 0.25 + crackRisk * 0.25 + subsRisk * 0.2);
}
```
labelled `AI Risk Assessment` at `NodeSidebar.jsx:146`. There is no model, no training data, and no validation. The project's own research notes warn that *"an unexplainable black-box risk score is a weak point in front of DGMS-style evaluators"* — and calling a hand-tuned weighted sum "AI" is worse than that, because the follow-up question ("trained on what? validated how?") has no answer.

**Target:**
1. Move it to `src/logic/riskIndex.js` and rename the function `computeRiskIndex`, output field `risk_index`.
2. Relabel the UI heading to **`Composite risk index (rule-based)`**.
3. Make the weights a named, exported, documented object so they are inspectable rather than buried in an expression:
```js
export const RISK_WEIGHTS = { tilt: 0.30, vibration: 0.25, crack: 0.25, settlement: 0.20 }; // [VERIFY]
```
4. Add a breakdown popover on the index showing each component's normalised value, its weight, and its contribution, so the number is fully explainable in one click:
```
tilt        4.2/8.0  × 0.30 = 15.8
vibration   0.31/1.0 × 0.25 =  7.8
crack       4.2/10   × 0.25 = 10.5
settlement  18/50    × 0.20 =  7.2
                      total = 41
```
5. Normalisation denominators must come from `constants.js`, not from the inline `/30`, `/2.0`, `/10`, `/50` literals — and the tilt denominator must be a mm/m value, not 30 degrees.
6. `risk_index` is **display only**. It must not drive `status` (T6) or any alert (T5).

**Done when:**
- `grep -rn "AI Risk\|AI risk" src/` returns 0 hits.
- The breakdown popover's contributions sum to the displayed index.
- `npm run build` passes.

---

### T11 — Delete every fabricated number (rule R3)

**Goal:** no value on screen without a field behind it. Four specific offenders.

**Files:** `src/components/NodeSidebar.jsx` (lines 276–288), `src/App.js` (lines 162–167, 293), `src/index.css` (line 2).

**Current code:**

*(a) Hardcoded solar output — `NodeSidebar.jsx:276-288`:* the card prints `Solar Charging: Active` and `Generating 4.2W` as literal JSX. There is no `solar_w` field anywhere in the data, so the answer to "where does 4.2 W come from?" is "nowhere".

*(b) Hardcoded alert clock times — `App.js:162-167`:*
```js
{ id: 1, severity: 'critical', message: 'NODE-007 tilt exceeded 12° — collapse risk zone!', time: '15:52' },
{ id: 2, severity: 'warning',  message: 'NODE-006 crack width at 4.2mm ...',              time: '15:48' },
```
Demo at 10 a.m. and the alert banner shows times from the future.

*(c) Header typo — `App.js:293`:* `SIH 260025 — Jharia Coalfield`. The problem statement is **26025**. Same typo at `index.css:2`.

*(d) Hardcoded sector radius — `MapView.jsx:191-215`:* `radius={300}` centred on the mean of all node coordinates, so adding one node visibly moves the whole "sector". Fixed in T13; noted here so it is not missed.

**Target:**
1. Solar card reads `node.solar_w` and `node.battery_pct`; charging state is derived (`solar_w > 0.1`). At night it must legitimately read `0.0 W · not charging`. If you cannot produce the field, delete the card — an absent card is fine, an invented number is not.
2. Seed alerts are generated relative to `Date.now()`: `raised_at: now - 8*60_000`, etc., and rendered through the same formatter as live alerts.
3. Fix `260025` → `26025` in both files.
4. Sweep the JSX for any other numeric literal that is presented as a measurement. Each one either gets a data-model field or is removed.

**Done when:**
- `grep -rn "4.2W\|4\.2 W\|15:52\|15:48\|15:45\|15:40\|260025" src/` returns **0 hits**.
- Every numeric value visible in the UI can be traced to a §4 field by name.
- `npm run build` passes.

---

### T12 — LiveGraph: add the crack series, keep one real history buffer

**Goal:** plot the channel the research marks Mandatory, and stop the chart from inventing new history every time a button is pressed.

**Files:** `src/components/LiveGraph.jsx`; edit `src/App.js` (history buffer).

**Current code:**
- The `ComposedChart` plots only `pitch` (line 210), `roll` (213), `vibration` (215). There is **no crack series at all**, even though the crack sensor is Mandatory in the bill of materials and the dashboard spec explicitly asks for a crack-gap graph.
- `generateHistoricalData()` (lines 38–80) fabricates a fresh random walk on every render. Click `1D`, then click it again — the graph is different. A judge will do exactly this.

**Target:**
1. Lift history into `App.js` as a single rolling ring buffer keyed by node id, appended once per telemetry tick, capped at ~2000 samples per node. Time-range buttons **slice** this buffer; they never regenerate it.
2. If the requested range extends beyond the buffer, render only what exists and show `showing 42 min of 1 D — buffer started at 10:14`. Partial honest data beats a full fake series.
3. Add `crack_mm` as a fourth series on the left axis, with `ReferenceLine`s at `CRACK_MM.WARN` and `CRACK_MM.CRIT`.
4. Legend and tooltip must state units for every series: `Tilt (mm/m)`, `Crack (mm)`, `Vibration (g RMS)`.
5. Mark the moment an alert fired directly on the chart — a `ReferenceDot` plus a short label at the alert's `raised_at`. The research's own slide plan calls for "graph with the alert trigger point marked", and it is the clearest single visual for showing cause and effect.
6. Vibration reference line label becomes `Vibration 0.60 g RMS` from `VIB_RMS_G.CRIT` — the current `1.5g` literal is not in `constants.js` and must not survive.

**Done when:**
- Clicking `1D` twice produces an identical chart.
- The crack series is visible and its two threshold lines are labelled with their values.
- At least one alert marker appears on the chart during the slow-subsidence scenario.
- `grep -n "Math.random" src/components/LiveGraph.jsx` returns 0 hits.
- `npm run build` passes.

---

### T13 — Make the map a *mining* map: panel geometry and a visible mesh

**Goal:** right now the map is a generic asset-tracking view — pins, battery, signal. Nothing on it says "coal mine". Two additions change that, and both fix existing defects.

**Files:** create `src/data/panelA.geojson.js` and `src/components/PanelOverlay.jsx`; edit `src/components/MapView.jsx` (lines 191–215 and the popup at 340–346).

**Current code:**
- Sector `Circle`s with `radius={300}` hardcoded, centred on the arithmetic mean of all node coordinates. Adding a node moves the entire "sector", which means the circle represents nothing physical.
- `grep -rn "mesh" src/` returns **0 hits** — in a project whose problem statement centres on a wireless mesh network. The hop count, the parent node, and the relay path are invisible.
- `grep -rn "goaf\|influence\|angle of draw\|contour" src/` returns 0 hits.

**Target:**

*(a) Panel geometry, as static GeoJSON — no new dependency (rule R7).* Hand-author `panelA.geojson.js` exporting: the panel boundary polygon, the extracted-area (goaf) polygon, and the depillaring face line with an advance-direction arrow. Draw them with `react-leaflet`'s `Polygon`/`Polyline`. Add one `Circle` per node group for the **influence zone**, radius from `influenceRadiusM(PANEL_GEOM.depth_m, PANEL_GEOM.angle_of_draw_deg)` — 21.0 m at H = 45 m, β = 25°, with the formula in the tooltip and a `[VERIFY]` note on β. Delete the 300 m circles.

*(b) Mesh topology.* Draw a `Polyline` from each node to its `parent_node`, and on to `gateway_id`, styled by link quality (solid = ok, dashed = stale, red = lost). Render the gateway as a distinct marker. Node popup gains `2 hops → NODE-004 → GW-1 · RSSI −96 dBm · 3% loss`. Add a fleet-wide line in the header: `mesh: 7/7 nodes reachable · max 3 hops`.

*(c) Popup content.* Replace the degrees row with `Tilt 4.2 mm/m`, add the crack value, and show inferred settlement with its `±` error and method (T8). Add the node's position relative to the goaf edge — e.g. `4 m outside goaf edge · tensile zone` — since the tensile zone is where cracking is expected and that is the sentence a mining engineer is looking for.

**Done when:**
- The goaf polygon, panel boundary, face line, and influence circles all render, and no `radius={300}` remains.
- `grep -rn "mesh" src/` returns multiple hits including rendered UI text.
- Adding a node via the existing add-node flow does not move any panel geometry.
- `npm run build` passes.

---

## 7. PHASE 2 — TASKS T14 → T25

Phase 1 makes the dashboard truthful. Phase 2 makes it persuasive. **Do not start Phase 2 until every Phase 1 "Done when" passes** — a persuasive dashboard built on wrong units is worse than an ugly correct one.

Order within Phase 2 is by value, not dependency. T14, T19, T20, and T21 are the four that most change how the system is perceived.

---

### T14 — Temperature channel and a `Raw | Corrected` toggle ⭐

**Why this is the strongest technical item in the build:** a cheap MEMS accelerometer's zero-g offset drifts with temperature, so over a 15–20 °C day/night swing the *apparent* tilt can exceed the entire real subsidence signal (§3.4). Measuring that error and subtracting it is what separates this from a hobby project. At present the frontend has no representation of it whatsoever — `grep -rn "thermal\|temp_c" src/` returns 0 hits — so there is nowhere to show it.

**Files:** create `src/logic/thermalCorrect.js`; edit `src/sim/simulator.js`, `src/components/LiveGraph.jsx`, `src/components/NodeSidebar.jsx`.

**Target:**
1. Simulator generates a realistic diurnal `temp_c` curve and injects the resulting offset into `tilt_*_raw_mm_per_m` only. The corrected channel must not contain it.
2. `correctTilt(rawMmPerM, tempC, refTempC, coeff)` → corrected value. **`[VERIFY]`** `coeff` against the MPU6050/6500 datasheet "Zero-G Level Change vs Temperature" specification. Do not put a number in the UI until it is sourced; until then show the correction as applied but mark the coefficient `[VERIFY]` in the tooltip.
3. `Raw | Corrected` toggle on the chart, with `temp_c` on the right-hand axis. In `Raw` the diurnal saw-tooth is obvious; switching to `Corrected` visibly flattens it while the real trend survives.
4. When a raw excursion breaches a threshold but the corrected value does not, render the banner: **`Thermal artefact rejected — no alert raised`**, with the temperature delta that explained it. This is a *rejected* alert, which is far more convincing than a raised one.
5. Detail panel shows `raw 4.9 · thermal −3.8 · corrected 1.1 mm/m`.

**Done when:** toggling changes the plotted series without refetching; a hair-dryer-style temperature spike in the simulator produces the rejection banner and **no** alert; the correction coefficient is imported from `constants.js` with its `[VERIFY]` comment intact.

---

### T15 — Baseline / zero-calibration, and re-zero as a controlled action

**Why:** a node bolted to a slightly crooked stake reads a non-zero tilt with zero subsidence. Absolute tilt is meaningless; **change from baseline** is what matters. `grep -rn "baseline" src/` currently returns 0 hits and every displayed value is absolute.

**Files:** create `src/components/BaselinePanel.jsx`; edit `src/model/nodeShape.js`, `src/logic/thermalCorrect.js`.

**Target:** per-node panel showing `Baseline set 2026-08-14 · drift since = 2.1 mm/m`, all displayed values computed relative to `baseline`, and a `Re-zero` button.

**Treat `Re-zero` as a destructive action.** It erases the accumulated evidence and can silence an alert that is legitimately building. In a real deployment an operator tired of alert noise will eventually press it, and the early-warning system goes quiet. So: a confirmation dialog stating what will be lost, a required reason string, an immutable audit entry (`who`, `when`, `previous baseline`, `reason`), and retention of the previous baseline for 24 h with both values shown side by side during that window. This is precisely the control a DGMS-style auditor looks for, so building it is worth more than the ten minutes it costs.

**Done when:** all tilt readings are baseline-relative; re-zero cannot complete without a reason; the previous baseline remains visible for 24 h; the audit entry cannot be edited or deleted from the UI.

---

### T16 — Data-quality flags and automatic exclusion

**Why:** a sensor that lies is more dangerous than one that is dead, because the dead one is obvious. The research's own schema has a `raw_flags` column; the frontend ignores it.

**Files:** create `src/logic/dataQuality.js`; edit `src/components/NodeSidebar.jsx`, `src/logic/corroborate.js`.

**Target:** detect `STUCK_VALUE` (identical reading for N consecutive samples), `OUT_OF_RANGE`, `PACKET_LOSS_HIGH`, `CLOCK_SKEW`, `CALIBRATION_STALE` (baseline older than 90 days — **`[VERIFY]`** the interval against site practice). Roll them into `data_trust: good | suspect | bad`. A `bad` node is **automatically excluded from corroboration (T7)** and the exclusion is shown, not hidden: `NODE-003 excluded — STUCK_VALUE for 6 samples`.

**Done when:** each flag is individually reproducible from a simulator scenario; an excluded node visibly changes the `agree / of` denominator in the spatial panel.

---

### T17 — Trend and time-to-critical (24–72 h only)

**Why:** an operator needs to know not just "how bad" but "how soon". `grep -rn "forecast\|predict" src/` returns 0 hits.

**Files:** create `src/logic/trend.js`; edit `src/components/LiveGraph.jsx`.

**Target:** least-squares slope over a 24 h window → `trend_mm_per_m_per_day`, extrapolated to the critical threshold → `time_to_critical_h`, drawn as a dashed forward line with a widening confidence band. Show it as a range, never a point: `crosses 5.0 mm/m in 34–58 h`.

**Scope discipline:** cap the horizon at 72 h. A 30-day ML forecast cannot be defended without training data, and offering one invites the question that ends the conversation. When the slope is flat or negative, display `no trend — stable` rather than an absurd extrapolation.

**Done when:** the band widens with horizon; a flat series yields `no trend`; the forecast never renders as a single unqualified number.

---

### T18 — Gateway autonomy and the local siren

**Why:** the most memorable demo available is unplugging the internet in front of the evaluators and having the system still raise the alarm. For that to land, the UI must make clear **where the decision was taken**. Currently `grep -rn "siren\|buzzer\|gateway" src/` returns 0 hits, so if the network dropped mid-demo the audience would see a dashboard that simply kept working — and would learn nothing.

**Files:** create `src/components/SystemStatusBar.jsx`; edit `src/hooks/useTelemetry.js`, `src/logic/alertEngine.js`.

**Target:**
```
Gateway: ● ONLINE      Cloud: ○ UNREACHABLE      Local siren: ARMED
```
Every alert carries `decided_at: 'node' | 'gateway' | 'cloud'`, rendered as a badge. In the gateway-offline scenario, alerts show **`decided at gateway — no internet`**, and node-threshold alerts show **`decided on node — buzzer fired in <1 s`**. Add a store-and-forward indicator using `buffered_packets`: `GW-1 buffering 34 packets · will sync on reconnect`.

**Done when:** the `gateway-offline` scenario changes the status bar, keeps alerts flowing, and stamps them with the correct `decided_at`; the buffered count rises while offline and drains on reconnect.

---

### T19 — Alert workflow: acknowledge, assign, resolve ⭐

**Why:** `AlertBanner.jsx` is 38 lines and it is a scrolling marquee with a single dismiss-all `X` (line 33). `grep -rn "acknowledg" src/` returns 0 hits. Nothing records who saw an alert, when, or what they did. Without acknowledgement there can be no escalation chain, no alert-fatigue metric, and no audit trail — three things the research promises and the code cannot deliver.

**Files:** create `src/components/AlertPanel.jsx`; edit `src/components/AlertBanner.jsx`, `src/App.js`.

**Target:** keep the ticker for the newest critical item, but add a real alert **inbox** beside it. Per alert: `Acknowledge`, `Assign to`, `Mark false positive`, `Resolve` (with a required note), and status chips `Pending / Acknowledged / Resolved / False positive`. Group by node and by rule so a flapping sensor collapses into one row rather than fifty. Show **MTTA** (mean time to acknowledge) and a 24 h false-positive count in the header — the research explicitly flags false-positive rate as something *"judges will ask"*, and a measured number beats a claimed one. Never claim a 0.0% false-positive rate; show what was actually counted.

**Done when:** every alert can be moved through the full lifecycle; MTTA updates from real acknowledgement timestamps; dismiss-all no longer destroys state; alert history survives a scenario change.

---

### T20 — Damage class and people at risk ⭐

**Why:** the dashboard currently answers "what is the number". A mine manager needs "what do I do". `grep -rn "damage\|resident\|household\|school" src/` returns 0 hits. Note that the research report contains no damage-class concept either, so this is an addition to the design, not a gap against it — flag it as such internally.

Compare:
> ❌ `NODE-005: tilt 6.4 mm/m · risk 78`
> ✅ `N5 zone: Class III (Appreciable) for pucca / Class IV for kutcha — 3 structures, 14 people`

**Files:** create `src/data/structures.json` and `src/components/StructureLayer.jsx`; edit `src/App.js` KPI strip.

**Target:** a structures dataset (`id`, `type: kutcha | pucca | school | road | powerline`, `lat`, `lng`, `households`, `occupancy`), map icons coloured by damage class, and a KPI card that replaces raw millimetres with consequence:
```
🔴 CRITICAL     61 people · 12 homes · 1 school
                assembly point 180 m NE
```
Damage classes must map from tilt **and** structure type — the same ground movement damages a kutcha house and a transmission tower very differently. **`[VERIFY]`** the class boundaries against the NCB Subsidence Engineers' Handbook and CSIR-CIMFR guidance, and cite the source in the tooltip. Do not ship the class table without that citation; it is the one number a CIMFR evaluator will know by heart.

**Done when:** each structure shows its class and the derivation; the KPI aggregates people and buildings from the dataset, not from a literal; the class table cites its source in the UI.

---

### T21 — Scenario controls: `Live | Replay | Simulate` ⭐ highest value per hour

**Why:** the whole app already *is* a simulation, but there is no way to drive it. `grep -rn "simulat\|scenario\|replay" src/` returns 0 hits. Two payoffs: nobody waits five minutes for something to happen during a judging slot, and if the venue Wi-Fi or the hardware fails — normal at a hackathon — this alone carries the entire demo.

**Files:** create `src/components/ScenarioBar.jsx`; edit `src/sim/scenarios.js`, `src/hooks/useTelemetry.js`.

**Target:** a header mode toggle plus one-click scenarios in Simulate mode: `Slow subsidence (weeks)`, `Sudden collapse (minutes)`, `Thermal-only drift`, `Rain vibration spike`, `Node death mid-event`, `Gateway offline`, `Stuck sensor`. Each is a deterministic script over simulated time, driven by the seeded PRNG, with a speed control (`1× / 10× / 60×`) and a visible `seed 26025` label so a judge can watch the same run twice and see it match.

Every scenario must have a stated expected outcome, shown on screen when it is selected — for example `Thermal-only drift → expect NO alert (artefact rejected)`. A scenario that predicts its own result and then delivers it is a far stronger demonstration than one that merely produces activity.

**Done when:** all seven scenarios run to completion; each states its expected outcome and matches it; re-running with the same seed is identical; `Thermal-only drift` raises zero alerts.

---

### T22 — Replay of recorded history

**Files:** `src/components/ScenarioBar.jsx`, history buffer from T12.

**Target:** a scrubber over the retained buffer with play/pause and a timestamp, so an operator can re-watch the hour before an event. Alert markers appear at their real positions. The research's slide plan asks for "historical trend replay"; this is that, and it reuses T12's buffer rather than adding storage.

**Done when:** scrubbing moves map colours, KPIs, and the chart together; replay is read-only and cannot raise new alerts.

---

### T23 — Threshold governance

**Why:** "operators can adjust sensitivity" as an unqualified feature is a safety hole — the first response to alert noise is to raise the threshold, and then the system is quiet for the wrong reason.

**Files:** create `src/components/ThresholdAdmin.jsx`.

**Target:** thresholds become a versioned record (`value`, `changed_by`, `changed_at`, `reason`, `approved_by`), with a current-vs-approved diff banner when they differ, and the active version id shown next to every threshold in the UI. Changes are proposals until approved.

**Done when:** no threshold can change without a reason; the diff banner appears whenever active ≠ approved; the version id is visible on the alert that used it.

---

### T24 — Export

**Files:** create `src/logic/export.js`.

**Target:** CSV and JSON export of the current node table, the alert log, and the visible history window, generated client-side with a `Blob` and an object URL — no dependency, no backend. Every export carries a header row with the export timestamp, the active threshold version, the data source (`live` / `simulated` + seed), and the app version, so an exported file can never be mistaken for live measured data.

Do **not** build a "DGMS-format PDF" until someone on the team has seen the actual form. An invented official format is worse than a plain CSV.

**Done when:** both formats download and re-open cleanly; the provenance header is present in every file; a simulated export is unmistakably labelled as simulated.

---

### T25 — Hindi toggle

**Why:** this is a Ministry of Coal problem statement. The existing design work covers WCAG, dark mode, and screen readers, and contains **no Indian language** — `grep -rn "i18n\|locale" src/` finds only `toLocaleTimeString('en-IN')`. For the effort involved it is the most visible item in Phase 2.

**Target:** English/Hindi toggle over a flat key map. This is achievable without a dependency: a `src/i18n/strings.js` module exporting `{ en: {...}, hi: {...} }` and a `useT()` hook reading from React context (rule R7 — do not add `react-i18next` in this phase). Translate the UI chrome, status names, rule names, and alert templates; leave node ids and units untranslated. Numerals stay Western Arabic. Keep the layout tolerant of ~30% longer Devanagari strings — check that no button label clips.

**Done when:** every visible string flips language with no layout break; units and node ids are unchanged; the toggle is keyboard reachable with an `aria-label`.

---

## 8. OUT OF SCOPE FOR THIS SPEC

**Do not touch these.** They are listed so you know they were considered, not forgotten.

**Blocking for a hardware demo, but not frontend work.** Every one of these files is currently **0 bytes**: `backend/app/main.py`, `models.py`, `database.py`, `mqtt_client.py`, `ws_manager.py`, `backend/ai_engine/train_model.py`, `lstm_model.h5`, `hardware/node_sensor/node_sensor.ino`, `hardware/gateway_receiver/gateway_receiver.ino`. Only `backend/requirements.txt` has content (6 lines). Until `ws_manager.py` exists there is nothing for T3's WebSocket to connect to, so `source` will legitimately read `◐ SIMULATED` — which is exactly why T3 makes that state a first-class, honestly-labelled mode rather than something to hide.

**Deferred by design, not oversight:** JWT login and operator-vs-regulator roles; multi-panel / multi-mine switching; OTA firmware update UI; the SHA-256 `prev_hash` audit-log page (if it is built later, call it a hash-chained log, **never** "blockchain"); the full evacuation module with SMS/IVR contact lists; turf.js Voronoi coverage maps and interpolated settlement contours (needs a dependency — Phase 3); a real Isolation Forest or LSTM (needs the backend and training data first).

**Housekeeping, not in any task:** the workspace root contains a stray `.DS_Store` and a `.__wtest` file, and `package.json` declares `mapbox-gl` and `react-map-gl` which are **never imported** anywhere — the map is Leaflet. Removing the two unused packages shrinks the bundle and removes a question you do not want asked. Add `.DS_Store` and `.__wtest` to `.gitignore`. Do this only if the user asks; it is not part of T1–T25.

---

## 9. GLOBAL ACCEPTANCE CHECKLIST

Run this after Phase 1, and again after Phase 2. Every line must pass.

```
[ ] npm run build            → zero errors, zero new warnings
[ ] grep -rn "Math.random" src/        → hits only inside src/sim/
[ ] grep -rn "tilt_pitch_deg\|tilt_roll_deg\|subsidence_mm\|moisture_pct" src/   → 0
[ ] grep -rn "AI Risk"       src/      → 0
[ ] grep -rn "260025"        src/      → 0
[ ] grep -rn "4.2W\|15:52"   src/      → 0
[ ] grep -rn "radius={300}"  src/      → 0
[ ] grep -rn "localStorage\|sessionStorage" src/  → 0
[ ] no tilt threshold, axis, or label anywhere exceeds 10 (mm/m)
[ ] header shows one of  ● LIVE / ◐ SIMULATED / ○ DISCONNECTED  — never a static badge
[ ] every displayed number maps to a named field in §4
[ ] settlement always shown with ± error, method, and reference node
[ ] a lone node at 6 mm/m yields WARNING, not CRITICAL
[ ] same seed, two runs → identical alert sequence
[ ] all six statuses reachable; no sidebar filter permanently zero
[ ] every threshold constant still carries its // [VERIFY] comment
[ ] every colour-coded state also carries a text label
[ ] all interactive elements are <button>, keyboard reachable, aria-labelled
```

---

## 10. TESTING TASK (do this last, before reporting Phase 1 complete)

Create React App already ships Jest and `@testing-library/react` — no new dependency (rule R7). Tests go in `src/**/*.test.js` and run with `npm test -- --watchAll=false`.

Test the **pure logic**, not the pixels. Four files, roughly 25 assertions, and they are the evidence that the fixes actually hold:

**`src/model/constants.test.js`**
- `degToMmPerM(15)` ≈ `261.8` — the assertion that documents why the old 15° reference line was wrong.
- `mmPerMToDeg(5)` = `0.2865` exactly.
- `influenceRadiusM(45, 25)` ≈ `21.0`.

**`src/logic/alertEngine.test.js`**
- A value stepping `1.8 → 2.4 → 1.9 → 2.3` fires the warning **once** (hysteresis, exit at 1.6).
- A value crossing 5.0 then dropping to 4.5 stays latched critical; at 3.9 it clears.
- Two identical input arrays produce deep-equal alert arrays (determinism).
- Cooldown: the same rule on the same node cannot fire twice inside `ALERT_COOLDOWN_S`.
- Escalation warning → critical is **not** blocked by cooldown.

**`src/logic/settlement.test.js`**
- 500 sequential ticks: `settlement_inferred_mm` is non-increasing for every node.
- The reference node stays exactly `0`.
- `integrateSettlement` on a hand-computed 3-node chain matches the expected value.
- `settlement_err_mm` grows with distance from the reference node.

**`src/logic/corroborate.test.js`**
- One isolated node at 6 mm/m → `WARNING`.
- Three coherent adjacent nodes → `CRITICAL`, `r2 > 0.7`.
- A node with `data_trust: 'bad'` is excluded and the `of` denominator drops.

**Done when:** `npm test -- --watchAll=false` passes with zero failures, and each of the four files exists with the assertions above.

---

## 11. REPORT BACK

When Phase 1 is complete, report:
1. The §9 checklist with each line marked pass or fail.
2. Any task where the instruction conflicted with the code, and what you did about it.
3. Every `[VERIFY]` constant you touched, so the team knows what still needs a citation.
4. Anything you had to invent because the spec did not say — list it explicitly rather than burying it in a diff.

**Do not** add a dependency, change the stack, restyle anything you were not asked to touch, or write into `backend/` or `hardware/`. If a task appears impossible within these constraints, stop and say so.

---

## 12. `[VERIFY]` — NUMBERS THAT STILL NEED A CITATION

Exact and safe to use: the conversion `1 mm/m = 0.0573°`, and `r = H · tan β`.

Everything below is **indicative**. Confirm each against the **NCB Subsidence Engineers' Handbook** and **CSIR-CIMFR** guidance, then cite the source in the dashboard tooltip before repeating it to an evaluator:

- tilt bands `<2 / 2–5 / >5 mm/m` and the hysteresis exit values
- vibration `0.30 / 0.60 g RMS`, crack `3.0 / 6.0 mm`, crack rate `0.5 / 1.5 mm/day`
- angle of draw `β = 25°` and panel depth `H = 45 m` (both are site-specific)
- corroboration minimums (2 neighbours, R² ≥ 0.70)
- MEMS zero-g temperature drift coefficient — from the MPU6050/6500 datasheet
- per-sample tilt error used for `settlement_err_mm`
- damage-class boundaries by structure type (T20) — the highest-risk number in the list
- calibration-stale interval (90 days)
- RSSI warn/critical against the SX1276/78 sensitivity figure

One wrong number in front of a CIMFR or DGMS evaluator costs more than a missing feature.

























