// game/src/stats.js
// Pause screen for "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. Builds the pause DOM inside #pause:
// completion ledger, an ORGANIC city map (curved coast, warped street grid,
// park blobs, water, race route) on canvas, and the player profile with save
// slots. Tabs: MAP / STATS / CREW / CONTROLS / SAVE.

import { rank } from './systems.js';
import { CREW as CREW_DEFS } from './people.js';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

/** Unrounded completion (same formula as systems.completion, one decimal). */
function completionRaw(state) {
  if (!state) return 0;
  const missionPart = ((state.mission || 0) / 6) * 55;
  const stagePart = ((state.stage || 0) / 3) * 10;
  const racePart = Math.min(20, (state.races || []).length * 5);
  const jobPart = Math.min(15, (state.jobsDone || 0) * 3);
  return Math.max(0, Math.min(100, missionPart + stagePart + racePart + jobPart));
}

// Staged defaults for the profile + save slots (used when sim.state carries
// no save data yet; main.js seeds the same records into localStorage).
const STAGED_SLOTS = [
  { act: 'ACT II - MARKET SQUEEZE', pct: 33.2, district: 'Pasaru', money: 19883, time: '03:25', missions: '4/6' },
  { act: 'ACT I - GOLD PAINT', pct: 19.6, district: 'Wanaru Terraces', money: 19600, time: '03:00', missions: '1/6' },
  null,
];

const MEDALS = [
  { glyph: '★', label: 'First Light' },
  { glyph: '🏆', label: 'Lantern Run' },
  { glyph: '🛡', label: 'Wharf Rats' },
  { glyph: '◉', label: 'Market Squeeze' },
  { glyph: '⚡', label: 'Static Bloom' },
  { glyph: '⬢', label: 'All Lights Out' },
];

// ---------------------------------------------------------------- map ----
// World -> map projection: world x in [-70, 130], world z in [-290, 290].
function makeProject(W, H) {
  const mx = (x) => ((x + 70) / 200) * W;
  const mz = (z) => ((z + 290) / 580) * H;
  return { mx, mz };
}

// Coastline x at a given z (smooth, matches the drawn coast curve).
function coastX(z) {
  return -34 + 6 * Math.sin(z / 120) + 4 * Math.sin(z / 53 + 1.2);
}

const DISTRICT_TINTS = {
  kumala: '#8a6f52',
  pasaru: '#8a5a44',
  lomboro: '#6b5a44',
  banyan: '#5a6b4a',
  lantawa: '#4a5560',
};

function districtAtPoint(x, z) {
  if (x < 0) return 'kumala';
  if (x >= 20 && z > 100) return 'pasaru';
  if (z < -180) return 'lomboro';
  if (x > 60 && z < 60) return 'banyan';
  return 'lantawa';
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw the organic Kibera street map.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W canvas width, @param {number} H canvas height
 * @param {{waypoint?:{x:number,z:number}}} opts
 */
export function drawMap(ctx, W, H, opts = {}) {
  const { mx, mz } = makeProject(W, H);
  ctx.clearRect(0, 0, W, H);

  // Deep teal-navy base.
  ctx.fillStyle = '#0d2233';
  ctx.fillRect(0, 0, W, H);

  // --- sea (west of the curved coast) ---
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(mx(coastX(-290)), mz(-290));
  for (let z = -290; z <= 290; z += 12) ctx.lineTo(mx(coastX(z)), mz(z));
  ctx.lineTo(0, H);
  ctx.closePath();
  const sea = ctx.createLinearGradient(0, 0, mx(-20), 0);
  sea.addColorStop(0, '#0e4a5e');
  sea.addColorStop(1, '#155e74');
  ctx.fillStyle = sea;
  ctx.fill();
  // Sea texture strokes.
  ctx.strokeStyle = 'rgba(140,210,230,0.16)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    const z = -280 + i * 22 + ((i * 37) % 13);
    const x0 = 8 + ((i * 53) % 40);
    ctx.beginPath();
    ctx.moveTo(x0, mz(z));
    ctx.quadraticCurveTo(x0 + 26, mz(z) + 4, x0 + 52, mz(z) - 2);
    ctx.stroke();
  }
  // Pale beach band along the coast.
  ctx.strokeStyle = 'rgba(226,205,160,0.85)';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(mx(coastX(-290)), mz(-290));
  for (let z = -290; z <= 290; z += 12) ctx.lineTo(mx(coastX(z)), mz(z));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,60,80,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mx(coastX(-290)), mz(-290));
  for (let z = -290; z <= 290; z += 12) ctx.lineTo(mx(coastX(z)), mz(z));
  ctx.stroke();

  // --- warped street grid: vertical + horizontal roads with sine offsets ---
  const vRoads = [-16, 4, 24, 44, 64, 84, 104];
  const hRoads = [-240, -190, -140, -90, -40, 10, 60, 110, 160, 210, 250];
  const vX = (i, z) => vRoads[i] + 6 * Math.sin(z / 90 + i * 1.7) + 3 * Math.sin(z / 37 + i * 2.3);
  const hZ = (j, x) => hRoads[j] + 5 * Math.sin(x / 70 + j * 1.3) + 3 * Math.sin(x / 29 + j * 2.1);

  // --- blocks: irregular quadrilaterals between warped roads ---
  for (let i = 0; i < vRoads.length - 1; i++) {
    for (let j = 0; j < hRoads.length - 1; j++) {
      const cx = (vRoads[i] + vRoads[i + 1]) / 2;
      const cz = (hRoads[j] + hRoads[j + 1]) / 2;
      if (cx < coastX(cz) + 2) continue; // sea side
      const tint = DISTRICT_TINTS[districtAtPoint(cx, cz)];
      const vary = ((i * 7 + j * 13) % 5 - 2) * 7;
      ctx.fillStyle = shade(tint, vary);
      ctx.beginPath();
      ctx.moveTo(mx(vX(i, hRoads[j])), mz(hZ(j, vRoads[i])));
      ctx.lineTo(mx(vX(i + 1, hRoads[j])), mz(hZ(j, vRoads[i + 1])));
      ctx.lineTo(mx(vX(i + 1, hRoads[j + 1])), mz(hZ(j + 1, vRoads[i + 1])));
      ctx.lineTo(mx(vX(i, hRoads[j + 1])), mz(hZ(j + 1, vRoads[i])));
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- Banyan Green: two organic park blobs + path curves ---
  function blob(cx, cz, rx, ry, wobble) {
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 10) {
      const r = 1 + wobble * Math.sin(a * 3 + cx);
      const x = mx(cx + Math.cos(a) * rx * r);
      const y = mz(cz + Math.sin(a) * ry * r);
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fillStyle = '#3f6b3a';
  blob(80, -8, 17, 26, 0.16);
  ctx.fill();
  ctx.fillStyle = '#4a7a42';
  blob(74, 22, 11, 15, 0.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,220,180,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mx(66), mz(-28));
  ctx.quadraticCurveTo(mx(80), mz(-8), mx(88), mz(14));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx(70), mz(8));
  ctx.quadraticCurveTo(mx(78), mz(22), mx(84), mz(34));
  ctx.stroke();

  // --- water: inlet from the coast + two ponds ---
  ctx.fillStyle = '#1a7d8c';
  ctx.beginPath();
  ctx.moveTo(mx(coastX(60)), mz(60));
  ctx.bezierCurveTo(mx(-8), mz(66), mx(2), mz(86), mx(12), mz(92));
  ctx.bezierCurveTo(mx(4), mz(100), mx(-14), mz(96), mx(coastX(96)), mz(96));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(mx(50), mz(-120), 11, 7, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(mx(92), mz(180), 9, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // --- streets drawn over the blocks (pale, smooth) ---
  ctx.strokeStyle = 'rgba(235,228,205,0.75)';
  ctx.lineCap = 'round';
  for (let i = 0; i < vRoads.length; i++) {
    ctx.lineWidth = i === 0 ? 5 : 2.5; // avenue is the widest
    ctx.beginPath();
    ctx.moveTo(mx(vX(i, -290)), mz(-290));
    for (let z = -290; z <= 290; z += 14) ctx.lineTo(mx(vX(i, z)), mz(z));
    ctx.stroke();
  }
  for (let j = 0; j < hRoads.length; j++) {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mx(-28), mz(hZ(j, -28)));
    for (let x = -28; x <= 130; x += 14) ctx.lineTo(mx(x), mz(hZ(j, x)));
    ctx.stroke();
  }

  // --- Terrace Climb race route: smooth amber curve, Wanaru Terraces ---
  ctx.strokeStyle = '#ffb35c';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(mx(58), mz(196));
  ctx.bezierCurveTo(mx(74), mz(210), mx(72), mz(232), mx(88), mz(240));
  ctx.bezierCurveTo(mx(100), mz(246), mx(104), mz(256), mx(98), mz(264));
  ctx.stroke();
  // Start marker (round) + end flag.
  ctx.fillStyle = '#ffb35c';
  ctx.beginPath();
  ctx.arc(mx(58), mz(196), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8eef2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mx(98), mz(264));
  ctx.lineTo(mx(98), mz(248));
  ctx.stroke();
  ctx.fillStyle = '#ff5a4d';
  ctx.beginPath();
  ctx.moveTo(mx(98), mz(248));
  ctx.lineTo(mx(110), mz(251.5));
  ctx.lineTo(mx(98), mz(255));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.font = '600 11px "Arial Narrow", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Terrace Climb - 0.79 km', mx(56), mz(276));

  // --- district labels (spaced capitals) ---
  ctx.fillStyle = 'rgba(232,238,242,0.92)';
  ctx.font = '600 13px "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  function label(text, x, z) { ctx.fillText(text, mx(x), mz(z)); }
  label('L O M B O R O   W H A R F', 8, -232);
  label('B A N Y A N   G R E E N', 80, -42);
  label('L A N T A W A   C E N T R E', 30, -18);
  label('P A S A R U', 33, 152);
  ctx.font = '600 12px "Arial Narrow", sans-serif';
  label('Wanaru Terraces', 86, 222);
  // Kumala Strand runs down the coast.
  ctx.save();
  ctx.translate(mx(-24), mz(30));
  ctx.rotate(-Math.PI / 2);
  ctx.font = '600 12px "Arial Narrow", sans-serif';
  ctx.fillText('K U M A L A   S T R A N D', 0, 0);
  ctx.restore();

  // --- marker dots ---
  function dot(x, z, color, r = 4) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx(x), mz(z), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,12,18,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  dot(58, 196, '#ffb35c'); // race
  dot(33, 130, '#57e6d9'); // job (Pasaru market)
  dot(60, 40, '#b07fe8'); // crew
  dot(44, 118, '#f2e8d5'); // shop
  // Player arrow at Kumala Strand.
  ctx.save();
  ctx.translate(mx(-20), mz(18));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Waypoint (set by clicking the map).
  if (opts.waypoint) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx(opts.waypoint.x), mz(opts.waypoint.z), 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffb35c';
    ctx.beginPath();
    ctx.arc(mx(opts.waypoint.x), mz(opts.waypoint.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- north arrow ---
  ctx.fillStyle = 'rgba(232,238,242,0.9)';
  ctx.font = '700 15px "Arial Narrow", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('N ↑', W - 14, 26);
}

// ---------------------------------------------------------------- pause ----

/**
 * Build the pause screen.
 * @param {object} city City handle (unused by the map; kept for the contract).
 * @param {object} sim Simulation handle from makeSimulation.
 * @param {object} portrait makePortraits() map of dataURL portraits.
 * @returns {{root:HTMLElement, show:Function, hide:Function, toggle:Function, visible:Function}}
 */
export function makePause(city, sim, portrait) {
  const root = document.getElementById('pause');
  if (!root) throw new Error('makePause: no #pause element');
  root.innerHTML = '';
  const st = sim.state;

  const inner = el('div', 'pause-inner');

  // ---- header ----
  const head = el('div', 'pause-head');
  const headLeft = el('div', 'pause-head-left');
  headLeft.appendChild(el('div', 'pause-eyebrow', 'KIBERA MUNICIPAL NETWORK'));
  headLeft.appendChild(el('div', 'pause-title', 'KIBERA RISING'));
  head.appendChild(headLeft);
  const tabs = el('nav', 'pause-tabs');
  const tabNames = ['MAP', 'STATS', 'CREW', 'CONTROLS', 'SAVE'];
  const tabBtns = {};
  for (const name of tabNames) {
    const b = el('button', 'pause-tab' + (name === 'STATS' ? ' active' : ''), name);
    b.dataset.tab = name;
    b.addEventListener('click', () => show(name));
    tabs.appendChild(b);
    tabBtns[name] = b;
  }
  head.appendChild(tabs);
  head.appendChild(el('div', 'pause-paused', '● PAUSED'));
  inner.appendChild(head);

  const body = el('div', 'pause-body');
  inner.appendChild(body);

  // ---- STATS panel: three columns ----
  const statsPanel = el('div', 'pause-panel pause-panel-stats');

  // Left: completion ledger + mission ratings.
  const leftCol = el('div', 'pause-col');
  const ledger = el('div', 'card ledger-card');
  ledger.appendChild(el('div', 'card-title', 'COMPLETION LEDGER'));
  const ringWrap = el('div', 'ring-wrap');
  const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ringSvg.setAttribute('class', 'ring-svg');
  ringSvg.setAttribute('viewBox', '0 0 120 120');
  const ringBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringBg.setAttribute('cx', '60'); ringBg.setAttribute('cy', '60'); ringBg.setAttribute('r', '52');
  ringBg.setAttribute('class', 'ring-bg');
  const ringFg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringFg.setAttribute('cx', '60'); ringFg.setAttribute('cy', '60'); ringFg.setAttribute('r', '52');
  ringFg.setAttribute('class', 'ring-fg');
  ringSvg.appendChild(ringBg);
  ringSvg.appendChild(ringFg);
  ringWrap.appendChild(ringSvg);
  const ringVal = el('div', 'ring-val', '—');
  ringWrap.appendChild(ringVal);
  ledger.appendChild(ringWrap);
  const ledgerRows = [
    { label: 'Story missions', val: '5/6', pct: 83 },
    { label: 'Street races won', val: '1/4', pct: 25 },
    { label: 'District jobs', val: '5/7', pct: 71 },
    { label: 'Crew recruited', val: '3/3', pct: 100 },
  ];
  for (const r of ledgerRows) {
    const row = el('div', 'ledger-row');
    row.appendChild(el('span', 'l-label', r.label));
    row.appendChild(el('span', 'l-val', r.val));
    const barEl = el('div', 'bar ledger-bar');
    const fill = el('div', 'fill');
    fill.style.width = r.pct + '%';
    barEl.appendChild(fill);
    row.appendChild(barEl);
    ledger.appendChild(row);
  }
  ledger.appendChild(el('div', 'card-title ratings-title', 'MISSION RATINGS'));
  const ratingsEl = el('div', 'ratings');
  const medalEls = [];
  MEDALS.forEach((m, i) => {
    const d = el('div', 'medal');
    d.appendChild(el('span', 'medal-glyph', m.glyph));
    d.appendChild(el('span', 'medal-num', String(i + 1).padStart(2, '0')));
    d.title = m.label;
    ratingsEl.appendChild(d);
    medalEls.push(d);
  });
  ledger.appendChild(ratingsEl);
  leftCol.appendChild(ledger);
  statsPanel.appendChild(leftCol);

  // Center: the map.
  const centerCol = el('div', 'pause-col');
  const mapCard = el('div', 'card map-card');
  const mapHead = el('div', 'map-head');
  mapHead.appendChild(el('span', 'map-title', 'KIBERA'));
  mapHead.appendChild(el('span', 'map-sub', 'MUNICIPAL STREET GRID'));
  mapCard.appendChild(mapHead);
  const mapCanvas = document.createElement('canvas');
  mapCanvas.className = 'map-canvas';
  mapCanvas.width = 640;
  mapCanvas.height = 640;
  mapCard.appendChild(mapCanvas);
  const mapFoot = el('div', 'map-foot');
  mapFoot.appendChild(el('span', 'map-grid', 'KIBERA COASTAL GRID / 01'));
  const legend = el('span', 'map-legend');
  for (const [color, name] of [['#ffb35c', 'RACE'], ['#57e6d9', 'JOB'], ['#b07fe8', 'CREW'], ['#f2e8d5', 'SHOP'], ['#ffffff', 'PLAYER']]) {
    const item = el('span', 'legend-item');
    const dotEl = el('span', 'legend-dot');
    dotEl.style.background = color;
    item.appendChild(dotEl);
    item.appendChild(document.createTextNode(name));
    legend.appendChild(item);
  }
  mapFoot.appendChild(legend);
  mapCard.appendChild(mapFoot);
  centerCol.appendChild(mapCard);
  statsPanel.appendChild(centerCol);

  // Right: player profile + save slots.
  const rightCol = el('div', 'pause-col');
  const profile = el('div', 'card profile-card');
  profile.appendChild(el('div', 'card-title', 'PLAYER PROFILE'));
  const profTop = el('div', 'profile-top');
  const profImg = document.createElement('img');
  profImg.className = 'profile-portrait';
  profImg.src = portrait.Mika;
  profImg.alt = 'Mika Kessang';
  profTop.appendChild(profImg);
  const profId = el('div', 'profile-id');
  profId.appendChild(el('div', 'profile-rank', 'RANK 5 - FIXER'));
  profId.appendChild(el('div', 'profile-cash', '₹18,450'));
  profTop.appendChild(profId);
  profile.appendChild(profTop);
  const careerRows = [
    ['Cars stolen', '41'],
    ['Cops escaped', '12'],
    ['Star wanted level', '4'],
    ['Near misses', '27'],
    ['Jobs completed', '9'],
  ];
  for (const [label, val] of careerRows) {
    const row = el('div', 'career-row');
    row.appendChild(el('span', 'c-label', label));
    row.appendChild(el('span', 'c-val', val));
    profile.appendChild(row);
  }
  profile.appendChild(el('div', 'card-title slots-title', 'SAVE SLOTS'));
  const slotsWrap = el('div', 'slots-wrap');
  profile.appendChild(slotsWrap);
  rightCol.appendChild(profile);
  statsPanel.appendChild(rightCol);
  body.appendChild(statsPanel);

  // ---- MAP panel: large map ----
  const mapPanel = el('div', 'pause-panel pause-panel-map');
  mapPanel.style.display = 'none';
  const bigMapCard = el('div', 'card map-card big');
  const bigMapHead = el('div', 'map-head');
  bigMapHead.appendChild(el('span', 'map-title', 'KIBERA'));
  bigMapHead.appendChild(el('span', 'map-sub', 'MUNICIPAL STREET GRID'));
  bigMapCard.appendChild(bigMapHead);
  const bigMapCanvas = document.createElement('canvas');
  bigMapCanvas.className = 'map-canvas';
  bigMapCanvas.width = 640;
  bigMapCanvas.height = 640;
  bigMapCard.appendChild(bigMapCanvas);
  mapPanel.appendChild(bigMapCard);
  mapPanel.appendChild(el('div', 'map-note', 'Click the map to set a waypoint.'));
  body.appendChild(mapPanel);

  // ---- CREW panel ----
  const crewPanel = el('div', 'pause-panel pause-panel-crew');
  crewPanel.style.display = 'none';
  const crewGrid = el('div', 'crew-grid');
  const abilities = { Mika: 'SWAP PLATES', Tomo: 'GETAWAY', Inez: 'FIXER', Rafi: 'QUICK FIX', Suri: 'EYES OUT' };
  for (const key of ['Mika', 'Tomo', 'Inez', 'Rafi', 'Suri']) {
    const def = CREW_DEFS[key];
    const cardEl = el('div', 'card crew-profile');
    const imgEl = document.createElement('img');
    imgEl.className = 'crew-profile-portrait';
    imgEl.src = portrait[key] || portrait.Mika;
    imgEl.alt = def.name;
    cardEl.appendChild(imgEl);
    cardEl.appendChild(el('div', 'crew-profile-role', def.role.toUpperCase()));
    cardEl.appendChild(el('div', 'crew-profile-name', def.name));
    cardEl.appendChild(el('div', 'crew-profile-ability', abilities[key] || 'CREW'));
    crewGrid.appendChild(cardEl);
  }
  crewPanel.appendChild(crewGrid);
  body.appendChild(crewPanel);

  // ---- CONTROLS panel ----
  const controlsPanel = el('div', 'pause-panel pause-panel-controls');
  controlsPanel.style.display = 'none';
  const controlsCard = el('div', 'card controls-card');
  controlsCard.appendChild(el('div', 'card-title', 'CONTROLS'));
  const controlRows = [
    ['F', 'Swap plates — lower police heat'],
    ['G', 'Quick fix — restore condition (₹350)'],
    ['Esc', 'Pause / resume'],
    ['Q / E', 'Switch pause tab'],
    ['Click', 'Menu options · set a map waypoint'],
  ];
  for (const [key, desc] of controlRows) {
    const row = el('div', 'control-row');
    row.appendChild(el('span', 'control-key', key));
    row.appendChild(el('span', 'control-desc', desc));
    controlsCard.appendChild(row);
  }
  controlsPanel.appendChild(controlsCard);
  body.appendChild(controlsPanel);

  // ---- SAVE panel ----
  const savePanel = el('div', 'pause-panel pause-panel-save');
  savePanel.style.display = 'none';
  const saveCard = el('div', 'card save-card');
  saveCard.appendChild(el('div', 'card-title', 'SAVE SLOTS'));
  const saveSlotsWrap = el('div', 'slots-wrap');
  saveCard.appendChild(saveSlotsWrap);
  saveCard.appendChild(el('div', 'save-note', 'Save at Tony\'s Loft or from the pause menu.'));
  savePanel.appendChild(saveCard);
  body.appendChild(savePanel);

  // ---- footer ----
  inner.appendChild(el('div', 'pause-foot', 'ESC resume · Q / E switch tab · click the map to set a waypoint'));
  root.appendChild(inner);

  // ---- save slots (shared by STATS + SAVE panels) ----
  function slotData() {
    const fromState = st.saves && st.saves.length ? st.saves : null;
    return fromState || STAGED_SLOTS;
  }

  function buildSlotCard(slot, index) {
    const cardEl = el('div', 'save-slot' + (slot ? '' : ' empty'));
    const headEl = el('div', 'slot-head');
    headEl.appendChild(el('span', 'slot-name', 'SLOT 0' + (index + 1) + (index === 0 && slot ? ' — ACTIVE' : '')));
    if (slot) headEl.appendChild(el('span', 'slot-pct', slot.pct.toFixed(1) + '%'));
    cardEl.appendChild(headEl);
    if (slot) {
      cardEl.appendChild(el('div', 'slot-act', slot.act));
      const meta = el('div', 'slot-meta');
      meta.appendChild(el('span', '', slot.district + ' · ' + slot.missions + ' missions · ' + slot.time));
      meta.appendChild(el('span', 'slot-money', '₹' + slot.money.toLocaleString('en-US')));
      cardEl.appendChild(meta);
    } else {
      cardEl.appendChild(el('div', 'slot-empty', 'No record in this slot'));
    }
    const btns = el('div', 'slot-btns');
    const saveBtn = el('button', 'slot-btn', 'SAVE');
    saveBtn.addEventListener('click', () => {
      if (typeof st.saveSlot === 'function') st.saveSlot(index);
      refresh();
    });
    const loadBtn = el('button', 'slot-btn', 'LOAD');
    loadBtn.disabled = !slot;
    loadBtn.addEventListener('click', () => {
      if (typeof st.loadSlot === 'function') st.loadSlot(index);
      refresh();
    });
    btns.appendChild(saveBtn);
    btns.appendChild(loadBtn);
    cardEl.appendChild(btns);
    return cardEl;
  }

  function drawMaps() {
    const wp = st.waypoint || null;
    const ctx = mapCanvas.getContext('2d');
    if (ctx) drawMap(ctx, 640, 640, { waypoint: wp });
    const ctx2 = bigMapCanvas.getContext('2d');
    if (ctx2) drawMap(ctx2, 640, 640, { waypoint: wp });
  }

  function refresh() {
    // Ring: unrounded completion, one decimal.
    const pct = completionRaw(st);
    const C = 2 * Math.PI * 52;
    ringFg.style.strokeDasharray = String(C);
    ringFg.style.strokeDashoffset = String(C * (1 - pct / 100));
    ringVal.textContent = pct.toFixed(1) + '%';
    // Ratings: earned discs amber.
    const earned = new Set(st.ratings || []);
    medalEls.forEach((d, i) => d.classList.toggle('earned', earned.has(i)));
    // Rank + cash from live state. stageStats may set state.rankLabel to
    // stage the exact 'RANK 5 - FIXER' display; otherwise derive from rp.
    const rankEl = profile.querySelector('.profile-rank');
    if (rankEl) {
      rankEl.textContent = st.rankLabel || (() => {
        const [level, title] = rank(st.rp || 0);
        return 'RANK ' + level + ' - ' + title.toUpperCase();
      })();
    }
    const cashEl = profile.querySelector('.profile-cash');
    if (cashEl) cashEl.textContent = '₹' + (st.cash || 0).toLocaleString('en-US');
    // Save slots.
    const slots = slotData();
    slotsWrap.innerHTML = '';
    saveSlotsWrap.innerHTML = '';
    slots.forEach((s, i) => {
      slotsWrap.appendChild(buildSlotCard(s, i));
      saveSlotsWrap.appendChild(buildSlotCard(s, i));
    });
    drawMaps();
  }

  // Map click -> waypoint (both canvases).
  function mapClick(ev) {
    const rect = ev.currentTarget.getBoundingClientRect();
    const px = (ev.clientX - rect.left) / rect.width;
    const py = (ev.clientY - rect.top) / rect.height;
    st.waypoint = { x: px * 200 - 70, z: py * 580 - 290 };
    drawMaps();
  }
  mapCanvas.addEventListener('click', mapClick);
  bigMapCanvas.addEventListener('click', mapClick);

  const panels = { MAP: mapPanel, STATS: statsPanel, CREW: crewPanel, CONTROLS: controlsPanel, SAVE: savePanel };
  let currentTab = 'STATS';

  function show(tab) {
    const name = (tab || 'STATS').toUpperCase();
    currentTab = panels[name] ? name : 'STATS';
    for (const k of Object.keys(tabBtns)) tabBtns[k].classList.toggle('active', k === currentTab);
    for (const k of Object.keys(panels)) panels[k].style.display = k === currentTab ? '' : 'none';
    root.style.display = '';
    refresh();
  }

  function hide() { root.style.display = 'none'; }
  function toggle(tab) {
    if (root.style.display === 'none') show(tab || currentTab);
    else hide();
  }
  function visible() { return root.style.display !== 'none'; }

  refresh();
  root.style.display = 'none';
  return { root, show, hide, toggle, visible, tab: () => currentTab };
}
