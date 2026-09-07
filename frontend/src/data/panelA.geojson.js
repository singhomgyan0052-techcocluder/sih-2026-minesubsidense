/** ============================================
 *  Panel A — GeoJSON geometry
 *
 *  Hand-authored around the existing node
 *  coordinates on Jharia Coalfield.
 *
 *  Exported as JS objects (no .json import needed).
 *  ============================================ */

/** Panel boundary — the licensed extraction area */
export const PANEL_BOUNDARY = {
  type: 'Polygon',
  coordinates: [[
    [86.4010, 23.7405],
    [86.4010, 23.7545],
    [86.4320, 23.7545],
    [86.4320, 23.7405],
    [86.4010, 23.7405],
  ]],
};

/** Goaf (extracted area) — where coal has already been removed */
export const GOAF_POLYGON = {
  type: 'Polygon',
  coordinates: [[
    [86.4060, 23.7415],
    [86.4060, 23.7520],
    [86.4280, 23.7520],
    [86.4280, 23.7415],
    [86.4060, 23.7415],
  ]],
};

/** Depillaring face line — the active extraction front */
export const FACE_LINE = {
  type: 'LineString',
  coordinates: [
    [86.4270, 23.7415],
    [86.4270, 23.7520],
  ],
};

/** Advance direction arrow — which way the face is moving */
export const ADVANCE_DIRECTION = {
  from: [86.4270, 23.7468],
  to: [86.4290, 23.7468],
};

/** Gateway location */
export const GATEWAY = {
  id: 'GW-1',
  name: 'Gateway 1',
  lat: 23.7450,
  lng: 86.4030,
};
