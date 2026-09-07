# FRONTEND — KYA MISSING HAI

> Aapka code padhkar, features docs ke against. Guess nahi — har point ke saath `file:line`.

**Kya check kiya:** `App.js` (393 lines) · `MapView.jsx` (430) · `NodeSidebar.jsx` (327) · `LiveGraph.jsx` (221) · `AddModal.jsx` (231) · `AlertBanner.jsx` (38) · `index.css` (1638) — against `Dashboard_Feature_Gaps_P0_P1_P2.md`, `Dashboard_Features_Checklist.md`, `Dashboard_Deep_Dive_SIH_26025.md`.

**Pehle ek badi baat:** `backend/app/main.py`, `models.py`, `database.py`, `mqtt_client.py`, `ws_manager.py`, `ai_engine/train_model.py`, `lstm_model.h5`, aur dono `hardware/*.ino` — **saari files 0 byte hain.** Poora system abhi frontend + mock data hai. Ye khud sabse bada gap hai (§0.0).

**Doosri badi baat:** aapka UI base actually **strong** hai (Part 3 dekho). Jo missing hai wo zyadatar naye screens nahi — **domain correctness** aur **decision translation** hai. Isliye Part 0 pehle.

---

# PART 0 — 6 cheezein jo pehle THEEK karo

Ye naye feature nahi hain. Ye wo cheezein hain jo ek technically strong judge (CIMFR / DGMS / geotech) pakad lega, aur phir baaki sab ki value gir jayegi.

## 0.0 Frontend ka koi data source hi nahi hai 🔴 P0

**Kahan:** `App.js:211-267` — 2-second `setInterval` random walk.
**Proof:** poore `frontend/src` mein `WebSocket` ke **0 hits**. Ek hi `fetch()` hai — wo bhi Nominatim place search (`MapView.jsx:114`).

Matlab hardware chal bhi jaye to dashboard usse **connect nahi hoga**. Judge ka pehla sawal — "ye live hai ya mock?" — ka imaandar jawab abhi "mock" hai.

**Karo:** ek `useTelemetry()` hook — `REACT_APP_WS_URL` se WebSocket khole, fail hone par mock generator par gir jaye. Header mein source badge: `● LIVE (gateway)` / `◐ SIMULATED`. Ye badge khud ek feature hai — isse aap chalaak nahi, bharosemand lagte ho.

## 0.1 Tilt degrees mein hai — #1 credibility bug 🔴 P0

**Kahan:** `App.js:33` (`tilt_pitch_deg`) · `App.js:284` (Avg Tilt KPI) · `NodeSidebar.jsx:155-179` (15°/8° thresholds) · `LiveGraph.jsx:200-203` (`⚠ TILT DANGER 15°`) · `MapView.jsx:340`
**Proof:** `mm/m` — **0 hits**. `strain` — 0. `curvature` — 0.

Convert karke dekho: **15° = ~262 mm/m.** Building damage ki *poori* horizontal-strain range 0–10 mm/m hai. Matlab aapki "DANGER" line us point se ~26 guna aage hai jahan ghar poora tabah ho chuka hota hai.

Aur mock data khud ko contradict karta hai — NODE-007: `tilt_pitch_deg: 12.5` lekin `subsidence_mm: -35`. 35 mm ÷ 21 m baseline = **1.7 mm/m = 0.095°**. Ek hi node ke andar do numbers ~130× off hain.

**Karo:** field `tilt_mm_per_m`, thresholds `<2 / 2–5 / 5–10`, axis `Tilt (mm/m)`, tooltip mein source. Degrees andar rakho, display mat karo.
**`[VERIFY]`** exact boundaries NCB Subsidence Engineers' Handbook / CIMFR se lo.

## 0.2 Alert `Math.random()` se ban rahe hain, threshold se nahi 🔴 P0

**Kahan:** `App.js:252-261`

```js
if (Math.abs(node.tilt_pitch_deg) > 14 && Math.random() > 0.7) { ...alert... }
```

Same reading par kabhi alert aata hai, kabhi nahi. Judge 2 minute dashboard dekhega aur ye dikh jayega — aur demo reproducible nahi rahega. Ye bug se zyada **trust ka issue** hai: ek early-warning system jo dice phenk raha ho.

**Karo:** deterministic rule + hysteresis (enter 5.0, exit 4.0) + per-node per-rule cooldown. Ek alert = **ek rule ka naam + wo exact values jinse wo bana**.

## 0.3 "AI Risk Assessment" ek hardcoded weighted sum hai 🟡 P0

**Kahan:** `App.js:118-124` (weights 0.3 / 0.25 / 0.25 / 0.2), label `NodeSidebar.jsx:146`

Koi AI nahi hai. Aapka features doc khud warn karta hai — *"an unexplainable black-box risk score is a weak point in front of DGMS-style evaluators"*. Aur DGMS judge ke saamne weighted sum ko "AI" bolna sabse mehnga jhooth hai, kyunki wo follow-up sawal poochega: kis data par train hua, validation kya thi.

**Karo — do options:**
- **(a) 10 minute:** label badal do → `Composite risk index (rule-based)`, aur weights tooltip mein khul kar dikhao. Imaandar aur turant.
- **(b) 1 din:** backend mein asli Isolation Forest, score ke saath top-3 contributing features.

(a) aaj hi kar lo. (b) tab karo jab backend zinda ho.

## 0.4 Do fabricated numbers UI mein baithe hain 🟡 P0

- `NodeSidebar.jsx:282-287` — `Solar Charging: Active · Generating 4.2W` **hardcoded** hai, kisi data se nahi aata. "4.2 W kahan se aaya?" ka jawab nahi hai.
- `App.js:163-168` — seed alerts ka time `'15:52'`, `'15:48'`, `'15:45'` hardcoded. Subah 10 baje demo doge to alert banner future ka time dikhayega.

**Karo:** solar card ko `node.solar_w` se drive karo ya hata do; seed alert times `Date.now() - n*60000` se banao.

## 0.5 Subsidence upar-neeche jaati hai — physically galat 🟡 P1

**Kahan:** `App.js:221` — `Math.min(0, perturb(node.subsidence_mm, -60, 0, 0.2))`

Random walk hai, to cumulative settlement kam bhi ho jata hai. Zameen dhas kar wapas nahi uthti. **Cumulative subsidence monotonic hoti hai.**

**Karo:** `subsidence_mm = Math.min(node.subsidence_mm, newValue)` — magnitude sirf badh sake.

---

# PART 1 — MUST-ADD FEATURES (P0, demo se pehle)

Das features. Har ek ke saath: kya missing hai (proof ke saath), kahan lagega, kitna time.

## P0-A. Temperature channel + `Raw | Corrected` toggle ⭐ *sabse bada differentiator*

**Proof:** `thermal` — 0 hits. Node data mein temperature ka **koi field nahi** hai.

Ye aapka sabse bada technical antar hai — sasta MEMS sensor garam hone par jhoothi tilt deta hai, aur aap usko reject karte ho. Frontend mein iska **zero** representation hai. Matlab hair-dryer demo dikhane ki jagah hi nahi hai.

**Karo:** node data mein `temp_c`, `tilt_raw_mm_per_m`, `tilt_corrected_mm_per_m`. LiveGraph mein `Raw | Corrected` toggle + right axis par temperature. Corrected view mein diurnal saw-tooth gaayab hote dikhega. Aur ek banner: **`Thermal artefact rejected — no alert raised`**.

**Kahan:** `LiveGraph.jsx` (naya series + toggle) + `App.js` data model
**Time:** ~4–6 ghante
**Judge line:** "Humne pehle apne sensor ka biggest error source measure kiya, phir usko subtract kiya."

## P0-B. Damage class + log/ghar count — numbers se faisla ⭐

**Proof:** `damage` — 0 hits. `school` / `resident` / `household` — 0 hits.

Abhi dashboard **numbers** dikhata hai. Operator ko **faisla** chahiye. Farq:

> ❌ `Node N5: tilt 6.4 mm/m · risk 78`
> ✅ `N5 zone: Class III (Appreciable) pucca / Class IV kutcha — 3 structures, 14 log`

**Karo:** ek `structures.json` (id, type kutcha/pucca/school/road, lat/lng, households, occupancy). Map par structure icons damage-class se coloured. Aur KPI strip mein `Max Subsidence` ki jagah:

```
🔴 CRITICAL     61 log · 12 ghar · 1 school
                ~1.5 din mein Class IV · assembly point 180 m
```

Khadaan manager ko "4.6 mm/m" se faisla nahi lena hai — "61 log" se lena hai. Aur Coal India ka judge exactly wahi aadmi hai.

**Kahan:** naya `StructureLayer.jsx` + `App.js:297-326` KPI strip
**Time:** ~1 din

## P0-C. `Live | Replay | Simulate` + scenario buttons 🎬 ⭐ *highest ROI*

**Proof:** `simulat` / `scenario` / `replay` — 0 hits.

Poora app *hai* simulation, lekin **control** nahi hai. Judge ko chahiye: button dabao, event chale.

**Karo:** header mein mode toggle, Simulate mode mein buttons — `Slow subsidence (weeks)` · `Sudden collapse (minutes)` · `Thermal-only drift` · `Rain vibration spike` · `Node death mid-event` · `Gateway offline`.

Do fayde: judge ko 5 minute wait nahi karana padega, aur venue wifi ya hardware fail hone par (SIH mein normal hai) yehi aapki poori demo bacha lega.

**Time:** ~1 din. **Isko skip mat karo** — impact-per-hour sabse zyada.

## P0-D. Mine plan overlay — goaf + influence zone + contours ⭐

**Proof:** `goaf` — 0 hits. `influence` / `angle of draw` — 0. `contour` — 0. `Voronoi` — 0.

Abhi aapka map ek **generic asset-tracking map** hai. Node pins, battery, RSSI — ye kisi bhi IoT project ka map ho sakta hai. Isme "mining" kuch bhi nahi hai.

**Karo:**
- goaf (extracted area) polygon
- depillaring face line + advance direction arrow
- angle-of-draw circle: `r = H · tan β` → H=45 m, β=25° → **21 m**
- settlement contour lines (GeoJSON) — yehi wo cheez hai jo khadaan engineer actually padhta hai
- node popup: `N5 — 4 m outside goaf edge · tensile zone · high crack risk`

Ye ek feature Coal India ke judge ko batata hai ki team **mining samajhti hai, sirf IoT nahi**.

**Saath mein ek bug:** `MapView.jsx:191-215` ke sector circles ka radius **hardcoded 300 m** hai aur centre saare nodes ka average — matlab ek naya node add karne par poora "sector" hil jata hai. Ye asli panel boundary nahi hai. Isko goaf/panel GeoJSON se replace karo.

**Time:** ~1–1.5 din

## P0-E. Alert provenance badges — RULE / AI / SPATIAL ⭐

**Proof:** `coheren` / `correlat` — 0 hits. Alert abhi ek plain string hai (`App.js:164`).

**Karo:** har alert par teen independent badges:

```
CRITICAL — Panel A, N4–N6
  [■ RULE]     6.8 mm/m > 5.0 threshold
  [■ AI]       Isolation Forest 0.89 (> 0.50)
  [■ SPATIAL]  4/4 padosi nodes agree · R² 0.88
  → 3/3 paths agree · CRITICAL confirmed
```

Niyam: CRITICAL ke liye **kam se kam 2 path** agree karein. AI-only = WARNING (advisory).

**Kyun:** regulator ko ek deterministic, auditable path chahiye jo AI par depend na kare. Aur AI fail ho jaye to system safe rehta hai — ye aap demo mein *dikha* sakte ho.

**Kahan:** `AlertBanner.jsx` + naya `AlertPanel.jsx`
**Time:** ~half din
**Judge line:** "AI band ho jaye to bhi system chalta hai. AI advisory hai, physics authoritative."

## P0-F. Alert workflow — acknowledge / assign / resolve

**Proof:** `acknowledg` — 0 hits. Abhi sirf `onDismissAll` hai (`AlertBanner.jsx:33`).

Aapka AlertBanner ek **scrolling marquee ticker** hai, alert *inbox* nahi. Alert dismiss ho jata hai — kisne dekha, kab dekha, kya kiya: kuch record nahi.

**Karo:** alert list panel; per-alert `Acknowledge` / `Assign to` / `Mark false positive` / `Resolve`; status chips (Pending / Ack / Resolved); aur ek **MTTA** counter.

Bina ack ke aapka 5-min escalation chain, alert-fatigue KPI, aur DGMS audit trail — **teeno impossible** hain.

**Time:** ~half din

## P0-G. Per-node data age + asli offline detection

Partial hai: `NodeSidebar.jsx:101-107` mein `timeSinceLastSeen()` — lekin sirf detail panel mein, aur wo kabhi stale nahi hota kyunki `last_seen` har 2 second refresh hota hai.

**Aur ek dead UI:** `App.js:215` — `if (node.status === 'offline') return node;` lekin telemetry engine kabhi `offline` set **nahi** karta (`App.js:245-247` sirf critical/warning/active deta hai). Isliye sidebar ka `Offline (0)` filter kabhi kuch nahi dikhayega.

**Karo:** `age > 3× expected interval → stale 🟡`, `> 10× → offline ⚫`. Fleet list ke har card par age. Header mein `oldest packet: 4m 12s`.

Aur ek global "latency <2s" number **kabhi mat likho** — 5-minute duty cycle ke saath wo mathematically impossible hai. Uski jagah teen alag numbers: node buzzer `<1s`, dashboard `≤5 min`, critical SMS `<60s`.

**Time:** ~2-3 ghante

## P0-H. Gateway autonomy / offline indicator

**Proof:** `siren` / `buzzer` — 0 hits. `offline` sirf ek CSS colour aur ek dead status hai.

Aapka teesra demo hai internet ka plug judge ke saamne nikalna. Uske liye UI mein ye hona chahiye:

```
Gateway: ● ONLINE     Cloud: ○ UNREACHABLE     Local siren: ARMED
```

Aur alert card par ek badge: **`decided at gateway — no internet`**.

Bina iske judge ko dikhega ki internet gaya aur dashboard chalta raha — usse pata nahi chalega ki *faisla kahan* hua. Poora point yahi hai.

**Time:** ~2 ghante. Demo ka climax isi par tikka hai.

## P0-I. Baseline / zero-calibration UI

**Proof:** `baseline` — 0 hits. Abhi absolute values dikh rahe hain.

Agar node thode tedhe stake par install hua, uska absolute tilt bina kisi subsidence ke 3° ho sakta hai. **Absolute tilt meaningless hai — baseline se change meaningful hai.**

**Karo:** per-node `Baseline set 2026-08-14 · drift since = 2.1 mm/m · [Re-zero]`. Saari values baseline se relative.

**⚠ Security:** `Re-zero` ek **destructive action** hai — ye evidence mita deta hai aur ek accumulating alert ko chup kara sakta hai. Isliye approval workflow + immutable audit entry + "re-zero ke baad 24 ghante purana baseline bhi dikhao". Warna real deployment mein koi operator alert noise se tang aakar re-zero maar dega aur aapka early-warning system silent ho jayega. DGMS exactly yahi audit karega.

**Time:** ~half din

## P0-J. Hindi toggle

**Proof:** koi i18n nahi — sirf `toLocaleTimeString('en-IN')`.

Ministry of Coal ka problem statement hai. Jharia/Dhanbad → Hindi, Raniganj → Bengali, Talcher → Odia. Aapke docs mein WCAG, dark mode, screen readers sab hai — **ek bhi Indian language nahi.**

**Time:** 2–4 ghante (`react-i18next` + do JSON files). Poori list mein best impact-per-hour, aur demo mein instantly visible.

---

# PART 2 — P1 (agar time bache)

- **Forecast + time-to-critical** — `forecast` / `predict` 0 hits. LiveGraph mein Kalman forecast line + confidence band + `~1.5 din mein Class IV`. 24–72h par focus karo; 30-day ML forecast bina training data defend karna namumkin hai.
- **Uncertainty bands** — `uncertain` 0 hits. `6.4 ± 1.8 mm/m (detection limit 1.2)`. Ye aapko kamzor nahi, **credible** dikhata hai.
- **Data-quality flags** — stuck value, out-of-range, packet loss %, clock skew, calibration age → per-node `Data trust: 🟢 / 🟡 / 🔴`, aur suspect node ko corroboration se **auto-exclude** karo (aur wo exclusion visibly dikhao). Ek jhooth bolta sensor band sensor se zyada khatarnak hai.
- **Coverage / blind-spot layer** — turf.js Voronoi, dead node ka area grey. Header: `82% area monitored · 3 blind spots`. Judge ka guaranteed sawal "ek node mar gaya to?" ka visual jawab.
- **Spatial coherence panel** — node-to-node matrix + `coherence R² = 0.88` + auto-detected cluster (`N4-N5-N6 coherent`).
- **Hash-chained audit log page** — `audit` / `hash` 0 hits. Har row mein previous row ka SHA-256. Demo mein live tampering detect karke dikha sakte ho. Ise "blockchain" **mat** bolna.
- **Evacuation module** — `evacuat` 0 hits. Zone polygon, households list, assembly point, SMS/IVR contact list, notify checklist with timestamps. Problem statement ka whole point gaon bachana hai.
- **Export** — abhi koi export nahi. CSV/JSON pehle; DGMS-format PDF sirf tab jab actual form dekh liya ho.
- **Historical ranges asli data se** — `LiveGraph.jsx:38-80`: `1H / 2H / 1D / 10D / 1M` **sab synthetic random walk** hain, aur har click par naya data banta hai. Judge do baar `1D` dabayega to graph badal jayega. Ya asli data lao, ya ye ranges hata do.
- **Threshold governance** — kaun badla, kab, kyun, kisne approve kiya + current-vs-approved diff. "Operators can adjust sensitivity" as-is ek safety hole hai.

---

# PART 3 — Ye already ban chuka hai (dobara mat banao)

Live Leaflet map + OSM tiles · status-coloured node pins + popups · node aur place search (Nominatim) · click-to-add node/area · sector circles · fleet sidebar + status filters + counts · battery bars · detail panel (pitch, roll, vibration, crack, subsidence, moisture, battery, RSSI signal bars, GPS) · risk gauge · recharts dual-axis chart + threshold reference lines + custom tooltip · time-range buttons · alert ticker · live clock · 4 KPI cards · dark control-room theme · add-area/add-node modals.

**Ye kaafi solid base hai.** Part 0 aur Part 1 ka kaam mostly **isi ke upar** hai — naya app nahi banana. Isliye 3 din mein realistic hai.

---

# PART 4 — 3 din ka order

**Day 1 — jo GALAT hai (UI mein chhota change, credibility mein bada)**
`0.1` units mm/m → `0.2` deterministic alerts → `0.3` risk label → `0.4` fabricated numbers → `P0-G` data age + offline → `P0-F` acknowledge

**Day 2 — domain correctness**
`P0-A` thermal toggle → `P0-I` baseline → `P0-D` goaf + influence zone + contours → `P0-B` damage class + log count

**Day 3 — demo impact**
`P0-C` simulate mode → `P0-H` gateway autonomy → `P0-E` provenance badges → `P0-J` Hindi toggle

Order jaan-boojhkar aisa hai: pehle wo cheezein jo **galat** hain, phir jo **missing** hain, phir jo **dikhne** mein sabse achhi hain. Day 3 chhoot bhi jaye to Day 1–2 ke baad aapka system pehle se kaafi zyada defensible ho chuka hoga.

---

# PART 5 — Chhoti safai (30 minute)

- **`mapbox-gl` aur `react-map-gl`** `package.json` mein hain lekin kahin **use nahi** ho rahe (Leaflet use ho raha hai). Hata do — bundle chhota, aur judge ko confusion nahi.
- **Nominatim seedha browser se** call ho raha hai (`MapView.jsx:114`). Offline demo mein ye 400ms baad hang karega, aur OSM ki usage policy identifying header + rate limit maangti hai. Timeout + graceful failure daalo, ya offline mode mein search disable kar do.
- **`hardware/*.ino` aur `backend/app/*.py` 0 byte hain.** Agar demo mein hardware dikhana hai to ye frontend se bhi **pehle** aata hai — kyunki §0.0 ke bina koi bhi frontend feature asli data par prove nahi hoga.

---

# EK LINE MEIN

Aapke paas ek **achha IoT fleet dashboard** hai. Jo missing hai, wo use ek **mine subsidence early-warning system** banata hai: sahi unit (mm/m), thermal correction, goaf/influence geometry, damage class + log ki ginti, aur ek deterministic alert jo bata sake ki wo *kyun* baja.

---

**`[VERIFY]` note:** ismein thresholds (`<2 / 2–5 / 5–10 mm/m`), angle of draw (`β = 25°`), aur influence radius (`21 m` @ H=45 m) **indicative** hain. Judge ke saamne bolne se pehle NCB Subsidence Engineers' Handbook / CSIR-CIMFR se confirm karke apne dashboard tooltip mein source cite karo. Degree↔mm/m conversion (`1 mm/m = 0.0573°`) exact hai — wo safely use kar sakte ho.





