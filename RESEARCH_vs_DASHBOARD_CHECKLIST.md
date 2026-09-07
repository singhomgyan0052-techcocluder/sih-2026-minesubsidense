# RESEARCH → DASHBOARD — kya hai, kya nahi, kya add karna hai

**Kya kiya:** aapka `SIH_26025_Mine_Subsidence_Research_Report.md` (578 lines) poora padha. Usme se dashboard ke liye jo bhi requirement nikalti hai, wo nikaali. Phir aapka project folder kholkar **har ek** ko code mein dhoondha.

**Ginti:** 56 cheezein check ki.

| | Kitni |
|---|---|
| ✅ Ban chuki hai | 9 |
| 🟠 Aadhi bani hai | 4 |
| ⚠️ Bani hai par uske peeche sensor/data nahi hai | 3 |
| ❌ Bilkul nahi hai | 40 |

**Ghabrao mat.** 40 mein se sab jaruri nahi. Demo ke liye **12** kaafi hain — wo Part 4 mein priority ke saath likhe hain. Baaki Version 2 ka kaam hai.

---

## PART 1 — Research kahan-kahan dashboard ki baat karta hai

Aapko lag raha hoga ki dashboard sirf **Section S** mein hai. Actually **13 sections** dashboard ko kaam dete hain:

| Section | Wo dashboard ko kya bolta hai |
|---|---|
| **S. Dashboard** | Seedha spec — map, graphs, heat map, 3 alert tiers, notification channels |
| **Q. Database** | Jo field DB mein hai, wo screen par dikhna chahiye — `panel_id`, `raw_flags`, `acknowledged_by`, `geojson_boundary` |
| **P. Backend** | Login (JWT), role-based view (operator vs regulator), device registry + firmware version |
| **N. Firmware** | Node ki jo state hai, dashboard ko wo dikhani hai — baseline calibration, sensor fault, buzzer, emergency mode |
| **R. AI/ML** | Anomaly score, trend slope, **padosi nodes ka agreement** — aur explainable hona chahiye |
| **W. Failure Analysis** | Iska "Detection" column **poora dashboard ka kaam hai** — 12 failure, 12 detection surface |
| **V2. Testing** | Latency 2–5 min, false-positive rate, aur 3 failure test (node kata / gateway offline / battery dead) |
| **K. Architecture** | 10 layer — mesh, gateway, backhaul dashboard par dikhne chahiye |
| **G. Innovation** | Innovation #2 = "GIS deformation **heat-map** with severity trend" |
| **I. Innovation** | Innovation #1 = edge par faisla, gateway down hone par bhi kaam |
| **Y. Scalability** | Multi-panel, per-subsidiary — `panel_id` se index |
| **X. Security** | Role-based login, access log |
| **Z / AD** | Slide 12 = graph par **alert trigger point** marked; AD-15 = "historical trend **replay**" |

Matlab research aapse jitna maang raha hai, wo Section S se kaafi zyada hai.

---

## PART 2 — Poora check: research ka ask → aapke code mein kya hai

Symbol: ✅ hai · 🟠 aadha hai · ⚠️ dikh raha hai par peeche data nahi hai · ❌ nahi hai

### A. Map aur GIS

| Research kya maangta hai | Kahan likha | Aapke code mein | |
|---|---|---|---|
| Live node map, green/yellow/red | §S | `MapView.jsx` — status se coloured `CircleMarker` | ✅ |
| Node ka GPS location | §L, §Q | `lat` / `lng` dono hain | ✅ |
| **Mine panel ki boundary** (GeoJSON) | §S, §Q `panels.geojson_boundary` | sirf hardcoded **300 m ka circle** (`MapView.jsx:191-215`), aur uska centre saare nodes ka average — ek node add karo to poora "sector" hil jata hai | ❌ |
| **Risk heat map** panel ke upar | §S, §G innovation #2 | `heat` = **0 hits** | ❌ |
| **Mesh links** — kaun node kis se juda hai | §K layer 3, §L | `mesh` = **0 hits**. Map par sirf alag-alag dot hain, beech mein koi line nahi | ❌ |
| Gateway ka location + status | §K layer 4 | `gateway` = **0 hits** | ❌ |
| Panel / mine selector (multi-panel) | §Y, §Q `panels` | `panel_id` = 0 hits. Sirf "Sector A/B/C…" naam hain, koi geometry nahi | ❌ |

### B. Graphs

| Research kya maangta hai | Kahan likha | Aapke code mein | |
|---|---|---|---|
| Tilt over time | §S | `LiveGraph.jsx:210,213` — pitch + roll | ✅ |
| Vibration over time | §S | `LiveGraph.jsx:215` | ✅ |
| **Crack-gap over time** | §S — aur crack sensor §T mein **Mandatory** hai | Graph mein crack ki koi line **nahi** hai. Mandatory sensor, aur uska chart hi nahi | ❌ |
| Historical trend chart | §S | Hai, lekin `1H/2H/1D/10D/1M` har click par **naya random data** banate hain (`LiveGraph.jsx:38-80`) | 🟠 |
| Graph par alert trigger point marked | §Z slide 12 | koi event marker nahi | ❌ |
| Deformation **accelerate** ho raha hai ya nahi | §R, §S Warning rule | `accelerat` / `slope` = 0 hits | ❌ |

### C. Alerts

| Research kya maangta hai | Kahan likha | Aapke code mein | |
|---|---|---|---|
| 3 tier — Normal / Warning / Critical | §S | `status`: active / warning / critical | ✅ |
| Normal = "baseline variance ke andar" | §S | `baseline` = **0 hits**. Absolute value dikha rahe ho, baseline se change nahi | ❌ |
| Warning = anomaly score ya trend accelerating | §S | `Math.random() > 0.7` (`App.js:252`) — same reading par kabhi alert, kabhi nahi | ❌ |
| Critical = **multiple nodes agree** karein | §S, §R, §W (teeno jagah) | `corroborat` / `neighbo` / `spatial` = 0 hits | ❌ |
| Acknowledge — kisne dekha, kab dekha | §Q `alerts.acknowledged_by` + `ack_timestamp` | `acknowledg` = 0 hits. Sirf ek "dismiss all" ✕ hai | ❌ |
| SMS / email / app push / web push | §S notification channels | `sms` / `email` / `notif` = 0 hits | ❌ |
| Node ka local buzzer baja ya nahi | §K layer 9, §N-7, §AA-4 | `buzzer` = 0 hits | ❌ |
| Safety officer ko escalate | §S Critical tier | koi user ya role hi nahi hai | ❌ |
| Threshold **configurable** ho | §N-6, §P rule engine | hardcoded — `14` (`App.js:252`), `15` (`LiveGraph.jsx:200`) | ❌ |

### D. Node health aur failure detection

Ye poora section aapke research ke **§W Failure Analysis** table ke "Detection" column se aaya hai. Wo column literally dashboard ka kaam hai.

| Research kya maangta hai | Kahan likha | Aapke code mein | |
|---|---|---|---|
| Battery % per node | §S, §Q | battery bars + System Health | ✅ |
| Signal strength (RSSI) | §Q | `rssi_dbm` + signal bars | ✅ |
| Last seen | §Q `nodes.last_seen` | `NodeSidebar.jsx:101-107` | ✅ |
| **Missed heartbeat → node offline** | §W row 2, 3 | Telemetry engine `offline` status **kabhi set nahi karta** (`App.js:245-247`), isliye sidebar ka `Offline (0)` filter dead hai | ❌ |
| Stuck sensor pakadna ("same value N cycles") | §W row 1, §N-5 | koi check nahi | ❌ |
| Packet loss / CRC fail % | §W row 6 | `packet` / `crc` = 0 hits | ❌ |
| Store-and-forward — kitne packet queue mein hain | §N-9, §G innovation #3 | `buffer` / `queue` = 0 hits | ❌ |
| Gateway ka internet gaya ya nahi | §W row 4, §AA-4 | kuch nahi. Ye aapka **best demo** hai aur UI mein jagah hi nahi hai | ❌ |
| Calibration drift + re-calibration reminder | §W row 11, §N-4 | `calibrat` = 0 hits | ❌ |
| **Temperature-compensated reading** | §W row 11, §L (DHT22) | temperature ka field hi nahi hai node data mein | ❌ |
| GPS fix-quality flag | §W row 12 | sirf lat/lng dikha rahe ho, fix acha hai ya kharab pata nahi | ❌ |
| Emergency mode (Critical par fast sampling) | §N-12 | `emergency` = 0 hits | ❌ |
| Firmware version per node | §P device management | `firmware` = 0 hits | ❌ |
| Install date | §Q `nodes.install_date` | 0 hits | ❌ |

### E. AI/ML

| Research kya maangta hai | Kahan likha | Aapke code mein | |
|---|---|---|---|
| Anomaly score (Isolation Forest / One-Class SVM) | §R, §AD-5 | `App.js:118-124` — ek hardcoded weighted sum (0.3/0.25/0.25/0.2). `isolation` = 0 hits | ❌ |
| Score **explainable** ho | §R — *"an unexplainable black-box risk score is a weak point in front of DGMS-style evaluators"* | Ek plain number hai, label **"AI Risk Assessment"** (`NodeSidebar.jsx:146`). Research ne jis cheez se mana kiya, wahi ban gaya hai | ❌ |
| Trend / progression (LSTM ya ARIMA) | §R, §AD-5 | `forecast` / `predict` = 0 hits. `lstm_model.h5` file **0 byte** hai | ❌ |
| Severity = anomaly + slope + **padosi nodes** | §R | Sirf 4 sensor ka weighted sum. Padosi ka koi role nahi | 🟠 |
| Faisla edge par hua ya cloud par | §R, §I innovation #1 | kuch nahi | ❌ |
| Model metrics — false-positive rate, precision/recall/F1 | §V2 — *"judges will ask this"* | 0 hits | ❌ |

### F. Data fields (§Q ka schema)

| Research kya maangta hai | Aapke code mein | |
|---|---|---|
| `tilt_x`, `tilt_y` | `tilt_pitch_deg`, `tilt_roll_deg` — **unit degrees hai**. Subsidence damage `mm/m` mein naapa jata hai. `15°` = ~262 mm/m, jabki ghar tootne ki poori range 0–10 mm/m hai | 🟠 |
| `vibration_rms` | `vibration_g` — RMS nahi hai. Naam aur cheez dono match karao | 🟠 |
| `crack_displacement_mm` | `crack_width_mm` ✅ | ✅ |
| `raw_flags` (data quality) | 0 hits — research ne khud ye field rakha hai, use kahin nahi kiya | ❌ |
| `subsidence_mm` | Hero KPI hai (`App.js:283`, `MapView.jsx:344`) — **par BOM §T mein aisa koi sensor nahi hai jo ise naap sake.** Neeche Part 3 dekho | ⚠️ |
| `moisture_pct` | "Moisture" dikha rahe ho — par BOM mein DHT22 hai jo **enclosure ki humidity** naapta hai, zameen ki nahi (§L, §W) | ⚠️ |

### G. Access aur governance

| Research kya maangta hai | Kahan likha | Aapke code mein | |
|---|---|---|---|
| Login (JWT) | §P, §X | `login` / `auth` / `jwt` = 0 hits | ❌ |
| Role-based view — operator / regulator / admin | §P, §X | 0 hits. Sab kuch sabko dikh raha hai | ❌ |
| Alert routing contact list | §Q `users` | 0 hits | ❌ |
| Access log (accountability) | §X | 0 hits | ❌ |

### H. Demo aur testing

| Research kya maangta hai | Kahan likha | Aapke code mein | |
|---|---|---|---|
| End-to-end latency dikhna (target **2–5 min**) | §V2 | Header par hardcoded `● LIVE`, aur andar 2-second `setInterval`. Research khud 2–5 min bolta hai — dashboard usse ulta claim kar raha hai | ⚠️ |
| Historical trend **replay** | §AD-15 | `replay` = 0 hits | ❌ |
| 3 failure test — node mesh se kata / gateway offline / battery dead | §V2 | Koi simulate control nahi. Judge ko button dabakar dikhane ka rasta nahi hai | ❌ |
| **Live data source** (WebSocket ya API) | §K layer 6, §O, §P | Poore frontend mein `WebSocket` = **0 hits**. Ek hi `fetch()` hai, wo bhi Nominatim place search ka. Hardware chal bhi jaye to dashboard usse **judega nahi** | ❌ |

---

## PART 3 — 5 sabse badi cheezein (ye judge pakdega)

### 1. ⚠️ `subsidence_mm` ka koi sensor hi nahi hai

Aapka **hero KPI** hai: `Max Subsidence −61 mm`. Popup mein bhi hai.

Ab BOM (§T) dekho — jo sensor aap kharid rahe ho: IMU (tilt + vibration), string-pot (crack opening), piezo (vibration), NEO-6M GPS (**±2.5 m accuracy**).

Inme se koi bhi **vertical settlement mm mein** naap nahi sakta. GPS ka error 2.5 metre hai — 35 mm naapne ke liye 70× zyada. Judge ka sawal ek line ka hoga: *"ye 61 mm kis sensor se aaya?"*

**Achhi khabar:** ye cheez **derive** ho sakti hai. Tilt × node ke beech ki doori = settlement ka difference. Nodes ki ek line par tilt ko jodte jao, to settlement **profile** mil jata hai (inclinometer profiling — standard geotech technique).

**Karo:** label badal do → `Inferred settlement (tilt integration se)`, aur uske saath: kis reference node se naapa, node spacing kitna, aur error kitna. Ek stable reference node influence zone ke **bahar** hona chahiye. Ye ek chhota change hai jo aapka sabse bada sawal band kar deta hai. Aur ye actually ek **feature** ban jaata hai — "hum vertical displacement infer karte hain, sirf tilt report nahi karte".

### 2. ❌ "Mesh" poore frontend mein 0 baar aata hai

Problem statement ka **naam** hi "wireless mesh network" hai. Research §K layer 3 mein mesh hai, §L mein LoRa mesh hai, §AA-3 mein "why LoRa over Zigbee" ka jawab mesh par tikka hai.

Aur aapka map? Alag-alag dot. Beech mein koi line nahi. Gateway nahi. Hop count nahi. Kaun kis se relay kar raha hai — pata nahi.

**Karo:** node ke beech line kheencho (RSSI se thickness), gateway ka apna icon, aur node popup mein `2 hops → GW-01`. Ek node ko simulate mein maaro to line **automatically** doosre raste se jaani chahiye — yehi "self-healing mesh" ka visual proof hai. Isse aapka map ek generic IoT map se **mine mesh map** ban jaata hai.

### 3. ❌ Heat map + panel boundary — aapka khud ka innovation #2

Research §G literally likhta hai: innovation #2 = *"GIS-based deformation heat-map with progression/severity trend"*, aur saath mein *"most reviewed IoT papers stop at threshold-alarm; almost none show a spatial risk map for subsidence specifically"*.

Matlab aapne khud likha hai ki yehi cheez aapko doosron se alag karti hai. Aur dashboard mein wo **nahi** hai.

**Karo:** panel ki boundary GeoJSON se, uske andar node values ka interpolated heat map (ya settlement contour lines). Hardcoded 300 m circle hata do — wo asli boundary nahi hai aur ek node add karne par hil jata hai.

### 4. ❌ Crack ka graph hi nahi hai

§S saaf likhta hai: *"per-node sensor graphs (tilt, vibration, **crack-gap** over time)"*. Aur §T mein crack sensor **Mandatory** hai.

Graph mein pitch hai, roll hai, vibration hai. **Crack nahi hai.**

Aur crack aapka sabse *demo-able* sensor hai — string-pot ko haath se kheencho, graph turant upar jaayega. Judge ke saamne live dikhane ke liye isse behtar kuch nahi. **~1 ghanta ka kaam hai.**

### 5. ❌ Padosi nodes ka agreement — research 3 jagah maangta hai

§S (Critical tier), §R (severity scoring), §W (false alarm from wind) — **teeno** yehi bolte hain: ek node se Critical mat banao, padosi nodes se confirm karo.

Aur §AA-5 mein aapka false-positive ka jawab bhi yahi hai: *"mitigated by requiring multi-node spatial corroboration"*. Matlab judge ko aap ye jawab dene wale ho, aur dashboard mein wo cheez hai hi nahi.

**Karo:** alert par teen badge —

```
CRITICAL — Panel A, N4–N6
  [RULE]     6.8 mm/m > 5.0 threshold
  [AI]       anomaly score 0.89
  [SPATIAL]  4/4 padosi agree · R² 0.88
  → 3/3 agree · CRITICAL confirmed
```

Niyam: CRITICAL ke liye **kam se kam 2 badge** green hone chahiye. AI akela = sirf WARNING.

---

## PART 4 — ADD LIST (yahi wo list hai jo aapne maangi)

### 🔴 TIER 1 — ye 12 demo se pehle (research inhe seedha maangta hai)

Order dependency ke hisaab se hai — upar se neeche karo.

| # | Kya add karna hai | Kyun (research) | Time |
|---|---|---|---|
| 1 | **Live data hook** — `useTelemetry()` jo WebSocket kholey, fail hone par mock par gire. Header mein imaandar badge: `● LIVE (gateway)` ya `◐ SIMULATED` | §K L6, §O — bina iske koi bhi feature asli data par prove nahi hoga | 3 h |
| 2 | **Tilt ko `mm/m` mein badlo** — field, KPI, sensor card, graph axis, reference line, popup. Sab jagah | Damage `mm/m` mein assess hota hai. `15°` = ~262 mm/m — ghar tootne ki poori range 0–10 mm/m hai | 2 h |
| 3 | **Alert deterministic karo** — `Math.random()` hatao, hysteresis (enter 5.0, exit 4.0) + per-node cooldown | §S, §N-6. Abhi same reading par kabhi alert aata hai kabhi nahi — demo reproducible nahi hai | 2 h |
| 4 | **`subsidence_mm` → `Inferred settlement`** + reference node + error range | §T mein aisa sensor nahi hai. Part 3 §1 dekho | 2 h |
| 5 | **Crack ki line graph mein add karo** | §S saaf maangta hai, aur §T mein crack sensor Mandatory hai. Sabse easy + sabse demo-able | 1 h |
| 6 | **Risk ka label badlo** → `Composite risk index (rule-based)`, weights tooltip mein khol do | §R — *"unexplainable black-box risk score is a weak point in front of DGMS-style evaluators"* | 30 min |
| 7 | **Acknowledge / Assign / Resolve** + MTTA counter | §Q `acknowledged_by`, `ack_timestamp`. Abhi ticker hai, inbox nahi | 4 h |
| 8 | **Asli offline detection** — missed heartbeat se. `3× interval → stale 🟡`, `10× → offline ⚫`. Har card par data age | §W row 2, 3. Abhi `offline` status kabhi set hi nahi hota | 3 h |
| 9 | **Mesh links + gateway icon + hop count** | §K L3, §L. PS ka core word hai aur frontend mein 0 baar aata hai | 4 h |
| 10 | **Panel boundary GeoJSON + heat map / settlement contours**. 300 m circle hata do | §S, §G innovation #2 — aapka khud ka differentiator | 6 h |
| 11 | **Spatial corroboration + RULE / AI / SPATIAL badges** | §S + §R + §W teeno. §AA-5 ka aapka jawab isi par tikka hai | 4 h |
| 12 | **Simulate mode** — 3 button: node mesh se kata · gateway offline · battery dead. Plus slow drift aur sudden collapse | §V2 ke teen test. Aur venue wifi fail hone par yehi demo bachayega | 6 h |

**Total ≈ 37 ghante.** Ek banda = ~5 din. Do bande parallel = ~2.5 din.

### 🟡 TIER 2 — time bache to (research maangta hai par demo ruk nahi jaayega)

| Kya | Kyun | Time |
|---|---|---|
| **Temperature channel + `Raw \| Corrected` toggle** | §W row 11 "temperature-compensated readings" + §L DHT22. Aapka sabse bada technical differentiator — hair-dryer se jhoothi tilt banao, aur system usse reject kare | 5 h |
| **Baseline / re-zero UI** — per node `Baseline set 2026-08-14 · drift = 2.1 mm/m` | §N-4 "record baseline tilt/crack-gap as zero". Absolute tilt meaningless hai, baseline se change meaningful hai | 4 h |
| **Data-quality flags** (`raw_flags`) — stuck value, out-of-range, packet loss %, clock skew. Suspect node ko corroboration se auto-exclude karo | §Q `raw_flags`, §W row 1 aur 6 | 4 h |
| **Trend / acceleration + time-to-critical** | §R "is the rate of change accelerating", §S Warning rule | 5 h |
| **Buzzer + gateway autonomy indicator** — `Gateway ● ONLINE · Cloud ○ UNREACHABLE · Siren ARMED` | §N-7, §AA-4, §I innovation #1 | 2 h |
| **Notification panel** — kis alert par SMS/email/push kisko gaya, kab | §S notification channels | 3 h |
| **Model metrics panel** — false-positive rate, precision/recall/F1 | §V2 — *"judges will ask this"* | 2 h |
| **Configurable + versioned thresholds** — kaun badla, kab, kisne approve kiya | §N-6, §P rule engine | 3 h |
| **Latency ko 3 number banao** — node buzzer `<1s`, dashboard `≤5 min`, critical SMS `<60s` | §V2 target 2–5 min. Ek global "<2s" number likhna mathematically galat hai | 1 h |
| **Replay mode** asli logged data se | §AD-15 "historical trend replay" | 5 h |
| **Export CSV / JSON** | audit aur report ke liye | 2 h |
| **Hindi toggle** | Ministry of Coal ka PS hai. Jharia/Dhanbad Hindi bolta hai | 3 h |

### ⚪ TIER 3 — Version 2 (SIH ke baad; slide mein "future scope" bol do)

Login + JWT · role-based view (operator / regulator / admin) · access log · multi-panel aur multi-mine selector (§Y) · firmware version + OTA (§P) · install date · GPS fix-quality flag · emergency-mode indicator (§N-12) · hash-chained audit log · evacuation module.

---

## PART 5 — Research file mein khud 4 cheezein theek karo

Ye dashboard ka kaam nahi hai — research doc ka hai. Par dashboard inhi se galat ban raha hai, isliye source par theek karna behtar hai.

**1. DHT22 "Optional" hai — Mandatory hona chahiye.**
§L aur §T dono mein temperature sensor Optional likha hai. Lekin §W row 11 ka solution khud bolta hai *"temperature-compensated readings"* — aur bina temperature sensor ke wo solution possible hi nahi hai. Ek hi doc apne aap ko contradict kar raha hai.

Aur physics: MEMS accelerometer ka zero-g offset temperature ke saath drift karta hai **`[VERIFY]`** — apne exact MPU6050/6500 datasheet se "Zero-G Level Change vs Temperature" spec nikaalo. Din-raat ka 15–20 °C swing kaafi *apparent* tilt paida karta hai, aur wo asli subsidence signal se bada ho sakta hai. Matlab temperature aapka **sabse bada error source** hai, optional accessory nahi.

**2. LoRa frequency table mein galat hai.**
§L comm table likhta hai: *"LoRa (SX1276/78, **433 MHz for India**)"*. Uske thode neeche aapka khud ka note bolta hai 865–867 MHz. Judge table padhega, note nahi. Table theek karo — dono jagah 865–867 MHz ho.

**3. Tilt ka reporting unit research mein likha hi nahi hai.**
§Q mein sirf `tilt_x`, `tilt_y` hai — unit nahi. Isi khaali jagah se "degrees" dashboard mein aa gaya. §Q ko `tilt_x_mm_per_m` / `tilt_y_mm_per_m` kar do, aur ek line add karo: *sensor degrees mein padhta hai, system mm/m mein report karta hai (1 mm/m = 0.0573°)*. Phir baaki saare doc apne aap line mein aa jaayenge.

**4. "Kitne log khatre mein hain" research mein kahin nahi hai.**
Research numbers deta hai — mm, mm/m, g. §D mein stakeholder ke roop mein "local communities and villages" likha hai, lekin unko **ginne** ka koi tarika nahi hai.

Khadaan manager `4.6 mm/m` se faisla nahi leta. Wo `12 ghar · 61 log · 1 school` se leta hai. Aur Coal India ka judge exactly wahi aadmi hai.

**Add karo:** ek chhota section — structure inventory (kutcha / pucca / school / road, households, occupancy) + NCB damage class (I–V) mapping. Phir dashboard `Class III (Appreciable) — 3 structures, 14 log` bol sakta hai. **`[VERIFY]`** damage class ki exact boundaries NCB Subsidence Engineers' Handbook / CSIR-CIMFR se lo, apne aap mat banao.

---

## PART 6 — Chhoti galtiyan (~1 ghanta)

**Code mein:**

- `App.js:293` — header mein **"SIH 260025"** likha hai. Sahi hai **26025**. Ek extra zero hai. Judge sabse pehle header hi padhta hai.
- Header ka `● LIVE` badge hardcoded hai — uske peeche koi connection nahi hai. Isko data source se jodo, warna `SIMULATED` likho.
- `Generating 4.2W` (`NodeSidebar.jsx:282-287`) hardcoded hai — kisi data se nahi aata. Aur §T mein solar **Optional** hai, to bina solar wale node par bhi ye dikhega.
- Seed alert ke times `'15:52'`, `'15:48'`, `'15:45'` hardcoded hain (`App.js:163-168`). Subah 10 baje demo doge to alert banner future ka time dikhayega. `Date.now() - n*60000` use karo.
- `App.js:221` — subsidence random walk se **upar** bhi jaati hai. Zameen dhas kar wapas nahi uthti. `Math.min(node.subsidence_mm, newValue)` lagao — magnitude sirf badh sake.
- `mapbox-gl` aur `react-map-gl` `package.json` mein hain lekin use nahi ho rahe (Leaflet chal raha hai). Hata do.
- Root folder mein `.DS_Store` aur `.__wtest` pade hain — `.gitignore` mein daal do.
- Nominatim search (`MapView.jsx:114`) seedha browser se call ho raha hai. Offline demo mein ye hang karega — timeout + graceful failure daalo.

**Research doc mein:**

- **Section J missing hai** — I ke baad seedha K aa jaata hai.
- **"AB" do baar** use hua hai: "AB. Beginner Learning Roadmap" aur "AB. References". Doosre ko AE kar do.
- §Z item 16 bolta hai *"Part V3 below"* — par **V3 doc mein hai hi nahi**.
- §W bolta hai *"extend to 20 failures"* — abhi 12 hain. 8 aur likhne hain.

**Backend / hardware:**

`backend/app/main.py`, `models.py`, `database.py`, `mqtt_client.py`, `ws_manager.py`, `ai_engine/train_model.py`, `lstm_model.h5`, aur dono `hardware/*.ino` — **saari files abhi 0 byte hain.** Research ka §AC Day 5–9 poora yahi kaam hai. Agar demo mein hardware dikhana hai, to ye Tier 1 se bhi **pehle** aata hai — kyunki bina iske dashboard ka koi bhi feature asli data par prove nahi hoga.

---

## EK LINE MEIN

Research aapse **56 cheezein** maangta hai. **9 ban chuki hain**, **40 nahi hain** — par demo ke liye **12 kaafi hain** (Tier 1, ~37 ghante). Sabse bade 5 gap wo hain jo aapke research mein *explicitly* likhe hain par code mein 0 hits dete hain: mesh visualization, heat map, crack graph, spatial corroboration — aur ek KPI (`subsidence_mm`) jiske peeche BOM mein koi sensor nahi hai.

---

**`[VERIFY]` note:** is file mein research ke saare citations (§S, §Q, §N, §R, §W, §V2, §K, §G, §Y, §X, §Z, §AD) aapke uploaded doc se seedha liye gaye hain. Code ke saare claim ya `file:line` se ya grep ke 0-hit se prove kiye gaye hain. Lekin **thresholds** (0–10 mm/m damage range, `1 mm/m = 0.0573°` ke alawa), **NCB damage class boundaries**, aur **MEMS temperature drift ka exact spec** — ye teen apne source se confirm karo (NCB Subsidence Engineers' Handbook / CSIR-CIMFR / MPU6050 datasheet) aur dashboard tooltip mein source cite karo. Degree↔mm/m conversion exact hai, wo safely use kar sakte ho.





