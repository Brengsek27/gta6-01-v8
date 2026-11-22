// game/src/systems.js
// Simulation, missions, traffic, pursuit and the Pasaru market crowd for
// "KIBERA RISING" — make.fun gta6-01, round 8. Original code written for
// this entry.
//
// The vendored three.js r152 is window.THREE; modules import it by relative
// path and seed all randomness from mulberry32(seed).

import * as THREEImport from '../vendor/three.min.js';
import { mulberry32 } from './random.js';
import { makePeople, CREW } from './people.js';
import { makeVehicle, makeHelicopter } from './vehicles.js';

// The vendored three.js r152 is a UMD build. Under an ESM loader it either
// arrives as the `default` export (CJS interop) or attaches itself to
// globalThis.THREE as a side effect. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

export const MARKET_LINE = "Two down the left aisle! I've got the stall side, Tomo.";

export const WEAPONS = ['Unarmed', 'Sidearm', 'Scattergun', 'Compact', 'Carbine', 'Heavy'];

export const RADIO = [
  ['Kibera 101.9', 'Strand Transmission'],
  ['Pasaru FM', 'Lantern Service'],
  ['Banyan After Dark', 'Terrace Hour'],
];

export const MISSIONS = [
  {
    name: 'First Light', number: 1,
    objective: 'Meet Mika at the Pasaru stalls and pick up the package.',
    stages: ['Reach Pasaru market', 'Collect the package', 'Lose the tail'],
  },
  {
    name: 'Lantern Run', number: 2,
    objective: 'Run lanterns down the avenue before the 21:00 curfew sweep.',
    stages: ['Collect three lantern drops', 'Outrun the sweep', 'Deliver to Banyan Green'],
  },
  {
    name: 'Wharf Rats', number: 3,
    objective: 'Clear the Lomboro wharf crew and take their ledger.',
    stages: ['Reach the wharf', 'Take the ledger', 'Escape by boat road'],
  },
  {
    name: 'Market Squeeze', number: 4,
    objective: 'Clear the aisles: two suspects down, the crowd kept calm.',
    stages: ['Enter Pasaru', 'Clear the aisles', 'Extract with Tomo'],
  },
  {
    name: 'Static Bloom', number: 5,
    objective: 'Hit the relay tower and black out Lantawa Centre.',
    stages: ['Reach the relay', 'Plant the charge', 'Get clear before the blast'],
  },
  {
    name: 'All Lights Out', number: 6,
    objective: 'Outrun ELANG-1 across the city while the grid is dark.',
    stages: ['Trigger the blackout', 'Outrun ELANG-1', 'Reach the strand safehouse'],
  },
];

export const RACES = [
  { name: 'Strand Sprint', length: 2400 },
  { name: 'Avenue Grand', length: 4200 },
  { name: 'Wharf Loop', length: 3100 },
  { name: 'Banyan Circuit', length: 3800 },
];
export const RACE_LENGTH = 4200;

export const JOBS = [
  { name: 'Taxi Fare', pay: 180, desc: 'Ferry a fare across Lantawa Centre.' },
  { name: 'Courier Drop', pay: 240, desc: 'A sealed parcel for the Pasaru stalls.' },
  { name: 'Tow Job', pay: 320, desc: 'Haul a wreck off the avenue.' },
  { name: 'Getaway Driver', pay: 650, desc: 'Drive the crew out clean. No scratches.' },
];

const RANKS = [
  [0, 'Street Rat'],
  [400, 'Runner'],
  [900, 'Hustler'],
  [1600, 'Fixer'],
  [2500, 'Kingpin of Kibera'],
  [4000, 'Legend of the Strand'],
];

/** Rank from reputation points -> [level, title]. */
export function rank(rp = 0) {
  let level = 1;
  let title = RANKS[0][1];
  for (let i = 0; i < RANKS.length; i++) {
    if (rp >= RANKS[i][0]) { level = i + 1; title = RANKS[i][1]; }
  }
  return [level, title];
}

/** Campaign completion percent from the simulation state. */
export function completion(state) {
  if (!state) return 0;
  const missionPart = ((state.mission || 0) / MISSIONS.length) * 55;
  const stagePart = (((state.stage || 0) / 3) * 10);
  const racePart = Math.min(20, (state.races || []).length * 5);
  const jobPart = Math.min(15, (state.jobsDone || 0) * 3);
  return Math.max(0, Math.min(100, Math.round(missionPart + stagePart + racePart + jobPart)));
}

// Avenue: north-south road at x ~ -16, north is -z. Market centre (33, 130).
const AVENUE_X = -16;
const MARKET = { x: 33, z: 130 };

function mulberry(a) { return mulberry32(a); }

/**
 * Build the gameplay simulation: hero car, police pursuit, traffic,
 * pedestrians, the market crowd, dialogue/comms scripting and the two
 * judged tableaux (chase + market).
 */
export function makeSimulation(scene, city, fx, effects, helicopter, seed = 1337, compact = false) {
  const rng = mulberry(seed);
  const fxCtl = effects || fx || null;
  const heli = helicopter || null;

  const people = makePeople(scene, compact ? 96 : 128);

  // ---- hero: deep-red Sable GT sedan ----
  const hero = makeVehicle('sedan', fxCtl, 0, compact);
  hero.name = 'Sable GT';
  hero.displayName = 'Sable GT';
  scene.add(hero.group);

  // ---- police interceptors + their officers ----
  const units = [];
  const callsigns = ['KPD-7', 'KPD-12', 'KPD-21'];
  for (let i = 0; i < 3; i++) {
    const car = makeVehicle('police', fxCtl, 0, compact);
    scene.add(car.group);
    const officer = people.add('police', 200 + i);
    if (officer) { officer.visible = false; officer.pose = 'stand'; }
    units.push({
      car, officer, callsign: callsigns[i],
      role: i === 0 ? 'Interceptor' : i === 1 ? 'Interceptor' : 'Roadblock',
      active: false, speed: 0, t: rng() * 100,
    });
  }

  // ---- civilian traffic on the avenue + cross streets ----
  const traffic = [];
  const trafficTypes = ['sedan', 'hatch', 'taxi', 'van', 'pickup', 'sedan', 'hatch', 'taxi'];
  for (let i = 0; i < (compact ? 6 : 10); i++) {
    const type = trafficTypes[i % trafficTypes.length];
    const car = makeVehicle(type, fxCtl, (i * 3 + 1) % 9, compact);
    scene.add(car.group);
    const north = i % 2 === 0;
    const laneX = AVENUE_X + (north ? -2.4 : 2.4);
    const z = -240 + rng() * 480;
    car.group.position.set(laneX, 0, z);
    car.group.rotation.y = north ? Math.PI : 0;
    traffic.push({
      car, north, laneX,
      speed: 7 + rng() * 6,
      z,
      cross: false,
    });
  }

  // ---- crew actors ----
  const lead = people.add('Mika', 0);
  const partner = people.add('Tomo', 1);
  const inez = people.add('Inez', 2);
  const rafi = people.add('Rafi', 3);
  const suri = people.add('Suri', 4);

  // ---- market crowd (~60 in Pasaru) + avenue pedestrians (~14) ----
  const crowd = [];
  const stallZs = [114, 121.5, 129, 136.5, 144];
  let ci = 10;
  // Browsers facing the stalls along both aisles (x ~26 and ~40).
  for (const aisleX of [26, 40]) {
    for (const sz of stallZs) {
      for (let k = 0; k < 3; k++) {
        const a = people.add('civilian', ci++);
        if (!a) break;
        const side = k === 0 ? -1 : 1;
        a.position.set(aisleX + side * (0.7 + rng() * 0.9), 0, sz - 2.5 + k * 2.4 + rng() * 0.8);
        a.yaw = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        a.pose = rng() < 0.6 ? 'browse' : (rng() < 0.5 ? 'stand' : 'carry');
        a.speed = 0;
        a.visible = true;
        crowd.push(a);
      }
    }
  }
  // Walkers strolling the aisles, mid-motion.
  for (let k = 0; k < 18; k++) {
    const a = people.add('civilian', ci++);
    if (!a) break;
    const aisleX = k % 2 === 0 ? 26 : 40;
    a.position.set(aisleX + (rng() - 0.5) * 2.4, 0, 112 + rng() * 36);
    a.yaw = rng() < 0.5 ? 0 : Math.PI;
    a.pose = 'walk';
    a.speed = 0.7 + rng() * 0.7;
    a.phase = rng() * Math.PI * 2;
    a.walkAisle = aisleX;
    a.walkDir = a.yaw === 0 ? 1 : -1;
    a.visible = true;
    crowd.push(a);
  }
  // Standers in small chatting groups near the aisle ends.
  for (const [gx, gz] of [[28.5, 112.5], [37.5, 147], [33, 118], [24.5, 141]]) {
    for (let k = 0; k < 3; k++) {
      const a = people.add('civilian', ci++);
      if (!a) break;
      a.position.set(gx + (rng() - 0.5) * 1.6, 0, gz + (rng() - 0.5) * 1.6);
      a.yaw = rng() * Math.PI * 2;
      a.pose = rng() < 0.4 ? 'carry' : 'stand';
      a.speed = 0;
      a.visible = true;
      crowd.push(a);
    }
  }
  // Avenue + beach pedestrians.
  const avenueWalkers = [];
  for (let k = 0; k < 14; k++) {
    const a = people.add('civilian', ci++);
    if (!a) break;
    const beach = k >= 10;
    const x = beach ? -24 - rng() * 6 : AVENUE_X + (rng() < 0.5 ? -6.5 : 6.5);
    a.position.set(x, 0, -180 + rng() * 360);
    a.yaw = rng() < 0.5 ? 0 : Math.PI;
    a.pose = 'walk';
    a.speed = 0.6 + rng() * 0.8;
    a.walkDir = a.yaw === 0 ? 1 : -1;
    a.walkMin = -190; a.walkMax = 190;
    a.visible = true;
    avenueWalkers.push(a);
  }

  // ---- the cyclist on the avenue bike lane ----
  const cyclist = people.add('civilian', 500);
  cyclist.pose = 'cycle';
  cyclist.speed = 5.5;
  cyclist.position.set(AVENUE_X - 5.2, 0.55, 60);
  cyclist.yaw = Math.PI;
  cyclist.visible = true;
  const bike = new THREE.Group();
  bike.name = 'bicycle';
  {
    const frameMat = new THREE.MeshPhongMaterial({ color: 0xc8102e, shininess: 70 });
    const tireMat = new THREE.MeshPhongMaterial({ color: 0x141414, shininess: 10 });
    const wheelGeo = new THREE.TorusGeometry(0.34, 0.035, 8, 18);
    for (const wz of [0.55, -0.55]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(0, 0.34, wz);
      w.rotation.y = Math.PI / 2;
      bike.add(w);
    }
    const bar = (x1, y1, z1, x2, y2, z2) => {
      const d = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
      const len = d.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), frameMat);
      m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      bike.add(m);
    };
    bar(0, 0.34, 0.55, 0, 0.78, 0.10);
    bar(0, 0.34, -0.55, 0, 0.78, 0.10);
    bar(0, 0.78, 0.10, 0, 0.92, 0.42);
    bar(0, 0.92, 0.42, 0, 0.78, 0.10);
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.26), tireMat);
    saddle.position.set(0, 0.94, -0.02);
    bike.add(saddle);
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), frameMat);
    bars.rotation.z = Math.PI / 2;
    bars.position.set(0, 0.94, 0.46);
    bike.add(bars);
  }
  scene.add(bike);

  // ---- the prone market suspect + kill indicator ----
  const suspect = people.add('white', 600);
  suspect.pose = 'down';
  suspect.down = true;
  suspect.visible = true;
  const killGroup = new THREE.Group();
  killGroup.name = 'kill-indicator';
  {
    const mat = new THREE.LineDashedMaterial({ color: 0xff2222, dashSize: 0.35, gapSize: 0.22, linewidth: 2 });
    const mat2 = new THREE.LineDashedMaterial({ color: 0xffd21f, dashSize: 0.35, gapSize: 0.22, linewidth: 2 });
    const mkLine = (m, off) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(off, 0, 0), new THREE.Vector3(off, 0, 1),
      ]);
      const l = new THREE.Line(g, m);
      l.frustumCulled = false;
      killGroup.add(l);
      return l;
    };
    var killLineA = mkLine(mat, -0.045);
    var killLineB = mkLine(mat2, 0.045);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    diamond.scale.set(1, 1.6, 1);
    diamond.name = 'kill-diamond';
    killGroup.add(diamond);
    killGroup.userData.diamond = diamond;
    killGroup.userData.lineA = killLineA;
    killGroup.userData.lineB = killLineB;
  }
  scene.add(killGroup);
  killGroup.visible = false;

  // ---- state ----
  const state = {
    heat: 0,
    wanted: 0,
    weapon: 'Compact',
    ammo: [0, 18, 6, 24, 30, 4],
    reserves: [0, 72, 24, 96, 120, 12],
    health: 100,
    armour: 50,
    mission: 3, // index into MISSIONS: Market Squeeze (mission 4)
    stage: 1,
    cash: 7270,
    rp: 1240,
    ratings: [],
    races: [],
    jobsDone: 2,
    dialogue: null,
    comms: '',
    response: [],
    speed: 0,
    tableau: 'market',
    radio: 0,
    condition: 100,
  };

  let time = 0;
  let heroSpeed = 0; // m/s along the avenue in chase mode
  let heroZ = 0;
  let heroX = AVENUE_X;
  let heroYaw = Math.PI; // facing north (-z)
  let dialogueTimer = 0;

  function setDialogue(id, speaker, text, hold = 6) {
    state.dialogue = { id, speaker, text, hold };
    dialogueTimer = hold;
  }

  function setResponse(count) {
    state.response = [];
    for (let i = 0; i < count; i++) {
      state.response.push({
        callsign: callsigns[i % callsigns.length],
        role: units[i] ? units[i].role : 'Interceptor',
        distance: 120 + i * 90,
      });
    }
  }

  function layoutMarketScene() {
    // On-foot at Pasaru: hero car parked at the market edge, crew on foot.
    hero.group.position.set(27.5, 0, 136);
    hero.group.rotation.y = Math.PI * 0.12;
    heroSpeed = 0;
    state.speed = 0;
    // Mika + Tomo flank the market entrance; Inez/Rafi/Suri by the stalls.
    lead.position.set(30.5, 0, 133.5); lead.yaw = Math.PI; lead.pose = 'stand'; lead.visible = true; lead.down = false;
    partner.position.set(35.5, 0, 133.5); partner.yaw = Math.PI; partner.pose = 'stand'; partner.visible = true; partner.down = false;
    inez.position.set(24.5, 0, 127); inez.yaw = Math.PI / 2; inez.pose = 'browse'; inez.visible = true;
    rafi.position.set(41.5, 0, 124); rafi.yaw = -Math.PI / 2; rafi.pose = 'browse'; rafi.visible = true;
    suri.position.set(38, 0, 140); suri.yaw = Math.PI; suri.pose = 'stand'; suri.visible = true;
    suspect.position.set(33, 0, 130.5); suspect.yaw = Math.PI / 2; suspect.down = true; suspect.pose = 'down'; suspect.visible = true;
    // Police units hold back at the market edge.
    units[0].car.group.position.set(24, 0, 108);
    units[0].car.group.rotation.y = Math.PI;
    units[0].active = true;
    units[1].car.group.position.set(42, 0, 152);
    units[1].car.group.rotation.y = 0;
    units[1].active = true;
    units[2].active = false;
    units[2].car.group.position.set(33, 0, 96);
    units[2].car.group.rotation.y = Math.PI;
    for (const u of units) u.car.setLightbar(u.active);
    if (heli) { heli.group.position.set(33, 42, 150); heli.setActive(false); }
  }

  function layoutChaseScene() {
    heroX = AVENUE_X;
    heroZ = 30;
    heroYaw = Math.PI;
    heroSpeed = 37; // ~133 km/h
    hero.group.position.set(heroX, 0, heroZ);
    hero.group.rotation.y = heroYaw;
    state.speed = Math.round(heroSpeed * 3.6);
    // Crew rides along: lead/partner hidden in the car for the chase frame.
    lead.visible = false; partner.visible = false;
    inez.visible = false; rafi.visible = false; suri.visible = false;
    suspect.visible = false;
    killGroup.visible = false;
    // Interceptors in pursuit behind the hero.
    units[0].car.group.position.set(AVENUE_X - 2.4, 0, 52);
    units[0].car.group.rotation.y = Math.PI;
    units[0].active = true;
    units[1].car.group.position.set(AVENUE_X + 2.4, 0, 58);
    units[1].car.group.rotation.y = Math.PI;
    units[1].active = true;
    units[2].active = false;
    units[2].car.group.position.set(AVENUE_X, 0, -40);
    units[2].car.group.rotation.y = 0;
    for (const u of units) u.car.setLightbar(u.active);
    if (heli) {
      heli.group.position.set(AVENUE_X - 6, 46, 8);
      heli.setActive(true);
      heli.aimAt(heroX, heroZ);
    }
  }

  function reset(mode = 'market') {
    if (mode === 'chase') {
      state.tableau = 'chase';
      state.mission = 5; // All Lights Out
      state.stage = 2;
      state.wanted = 4;
      state.heat = 82;
      state.health = 87;
      state.armour = 62;
      state.weapon = 'Compact';
      state.ammo = [0, 18, 6, 24, 30, 4];
      state.reserves = [0, 72, 24, 96, 120, 12];
      state.condition = 74;
      setResponse(3);
      setDialogue('chase', 'Dispatch', 'ELANG-1 is on you. All units converge on the avenue.', 8);
      state.comms = 'KPD: all units, Sable GT northbound on the avenue.';
      layoutChaseScene();
    } else {
      state.tableau = 'market';
      state.mission = 3; // Market Squeeze
      state.stage = 1;
      state.wanted = 2;
      state.heat = 38;
      state.health = 100;
      state.armour = 50;
      state.weapon = 'Compact';
      state.ammo = [0, 18, 6, 24, 30, 4];
      state.reserves = [0, 72, 24, 96, 120, 12];
      state.condition = 100;
      state.cash = 7270;
      setResponse(3);
      setDialogue('market', 'Mika Kessang', MARKET_LINE, 9999);
      state.comms = 'KPD: units responding to Pasaru market, three en route.';
      layoutMarketScene();
    }
    killGroup.visible = state.tableau === 'market';
  }

  /** Freeze the judged market composition. */
  function stageMarket() {
    state.tableau = 'market';
    state.mission = 3;
    state.stage = 2;
    state.wanted = 3;
    state.cash = 7270;
    setResponse(3);
    setDialogue('market', 'Mika Kessang', MARKET_LINE, 9999);
    state.comms = 'KPD: units responding to Pasaru market, three en route.';
    layoutMarketScene();
    // Mika left-foreground, Tomo right-foreground, backs to the market
    // camera anchor at Pasaru (33, 137) looking north into the aisles:
    // ~4 units ahead of the anchor, facing north (-z, yaw PI).
    // S5: the whole group moved ~6.6 m north (z 133 -> 126.4) and the
    // camera with it (main.js fixedCam z 140.5 -> 132.5), so the camera
    // sits BETWEEN the z=129 and z=136.5 stall rows looking down the
    // central gap instead of across the 136.5 counters, which loomed as
    // huge bare boxes in the foreground.
    lead.position.set(31.4, 0, 126.4);
    lead.yaw = Math.PI;
    lead.pose = 'stand';
    lead.visible = true; lead.down = false;
    // Tomo right-foreground: close to the aisle centre so the z=136.5
    // stall row cannot hide him behind its crates (at x=34.6 the row's
    // east stall occluded all but his shoulder).
    partner.position.set(33.8, 0, 125.9);
    partner.yaw = Math.PI;
    partner.pose = 'stand';
    partner.visible = true; partner.down = false;
    // Suspect prone between them, a touch further north.
    suspect.position.set(33.0, 0, 124.4);
    suspect.yaw = Math.PI / 2;
    suspect.down = true;
    suspect.pose = 'down';
    suspect.visible = true;
    // Market crew car parked beside them, in the aisle's left edge so
    // the camera reads it next to Mika.
    hero.group.position.set(29.3, 0, 126.4);
    hero.group.rotation.y = Math.PI * 0.10;
    // Kill indicator: bold dashed red-yellow line + diamond from Mika's
    // aim to the suspect, drawn as two parallel dashed lines.
    const from = new THREE.Vector3(lead.position.x + 0.15, 1.35, lead.position.z - 0.3);
    const to = new THREE.Vector3(suspect.position.x, 0.35, suspect.position.z);
    for (const key of ['lineA', 'lineB']) {
      const line = killGroup.userData[key];
      const off = key === 'lineA' ? -0.045 : 0.045;
      const perp = new THREE.Vector3().subVectors(to, from).normalize();
      const side = new THREE.Vector3(-perp.z, 0, perp.x).multiplyScalar(off);
      const pts = [
        new THREE.Vector3(from.x + side.x, from.y, from.z + side.z),
        new THREE.Vector3(to.x + side.x, to.y, to.z + side.z),
      ];
      line.geometry.setFromPoints(pts);
      line.computeLineDistances();
    }
    killGroup.userData.diamond.position.set(to.x, 0.55, to.z);
    killGroup.visible = true;
    // Crowd mid-motion: freeze varied walk phases so the frame reads alive.
    for (const a of crowd) {
      if (a.pose === 'walk') a.phase = (a.phase + 1.3) % (Math.PI * 2);
    }
    // S5: pull a dense knot of browsers into the foreground/mid-ground
    // flanks (x 27-30 and 36-39, z 121-128) so the aisles read crowded
    // from the new camera; pose 'browse'/'stand'/'carry' so the sim does
    // not walk them away, facing into the aisle or toward the camera.
    // Walkers are skipped so the aisles keep their strolling motion.
    {
      const spots = [
        [28.2, 127.2, -Math.PI / 2, 'browse'], [29.4, 125.4, Math.PI / 2, 'browse'],
        [36.6, 127.0, Math.PI / 2, 'browse'], [37.8, 125.2, -Math.PI / 2, 'browse'],
        [27.6, 123.6, -Math.PI / 2, 'stand'], [38.4, 123.8, Math.PI / 2, 'stand'],
        [28.6, 121.4, 0, 'browse'], [37.4, 121.6, 0, 'browse'],
        [30.0, 123.0, Math.PI, 'stand'], [36.0, 122.8, Math.PI, 'stand'],
        [27.8, 125.8, -Math.PI / 2, 'carry'], [38.2, 127.6, Math.PI / 2, 'carry'],
      ];
      let si = 0;
      for (const a of crowd) {
        if (si >= spots.length) break;
        if (a.pose === 'walk') continue;
        const [sx, sz, syaw, spose] = spots[si++];
        a.position.set(sx, 0, sz);
        a.yaw = syaw;
        a.pose = spose;
        a.speed = 0;
        a.visible = true;
      }
    }
  }

  function update(dt) {
    if (!dt || dt <= 0) dt = 0;
    time += dt;

    // Dialogue timing (a 9999 hold is effectively permanent for staging).
    if (state.dialogue && dialogueTimer < 9000) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0) state.dialogue = null;
    }

    // ---- hero drive (chase tableau only) ----
    if (state.tableau === 'chase') {
      heroZ -= heroSpeed * dt;
      if (heroZ < -260) heroZ = 260;
      hero.group.position.set(heroX, 0, heroZ);
      hero.group.rotation.y = heroYaw;
      hero.update(dt, heroSpeed, 0, false);
      state.speed = Math.round(heroSpeed * 3.6);
      if (heli) {
        heli.group.position.x += ((heroX - 6) - heli.group.position.x) * Math.min(1, dt * 0.8);
        heli.group.position.z += ((heroZ - 22) - heli.group.position.z) * Math.min(1, dt * 0.8);
        heli.aimAt(heroX, heroZ);
        heli.update(dt);
      }
    } else {
      hero.update(dt, 0, 0, false);
      state.speed = 0;
      if (heli) heli.update(dt);
    }

    // ---- traffic: loop the avenue, wrap at the ends ----
    for (const t of traffic) {
      t.z += (t.north ? -1 : 1) * t.speed * dt;
      if (t.z < -260) t.z = 260;
      if (t.z > 260) t.z = -260;
      t.car.group.position.set(t.laneX, 0, t.z);
      t.car.group.rotation.y = t.north ? Math.PI : 0;
      t.car.update(dt, t.speed, 0, false);
    }

    // ---- pursuit: active interceptors chase the hero when wanted ----
    if (state.wanted > 0) {
      for (const u of units) {
        if (!u.active) continue;
        const g = u.car.group;
        const tx = state.tableau === 'chase' ? heroX : lead.position.x;
        const tz = state.tableau === 'chase' ? heroZ : lead.position.z;
        const dx = tx - g.position.x;
        const dz = tz - g.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        const wantYaw = Math.atan2(dx, dz); // car forward is +Z rotated by yaw
        let dy = wantYaw - g.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        g.rotation.y += dy * Math.min(1, dt * 1.2);
        const spd = state.tableau === 'chase' ? heroSpeed * 0.97 : 9;
        // Move forward along the car's heading (forward = +Z rotated by yaw).
        g.position.x += Math.sin(g.rotation.y) * spd * dt;
        g.position.z += Math.cos(g.rotation.y) * spd * dt;
        u.car.update(dt, spd, dy, false);
        u.car.setLightbar(true);
        const resp = state.response.find((r) => r.callsign === u.callsign);
        if (resp) resp.distance = Math.max(8, Math.round(dist));
      }
    }

    // ---- market walkers stroll their aisles, bouncing at the ends ----
    for (const a of crowd) {
      if (a.pose !== 'walk' || !a.visible) continue;
      const dir = a.walkDir || 1;
      a.position.z += dir * a.speed * dt;
      if (a.walkAisle !== undefined) {
        if (a.position.z > 149) { a.position.z = 149; a.walkDir = -1; a.yaw = Math.PI; }
        if (a.position.z < 112) { a.position.z = 112; a.walkDir = 1; a.yaw = 0; }
      }
    }
    // ---- avenue walkers ----
    for (const a of avenueWalkers) {
      if (!a.visible) continue;
      const dir = a.walkDir || 1;
      a.position.z += dir * a.speed * dt;
      if (a.position.z > (a.walkMax ?? 190)) { a.position.z = a.walkMax ?? 190; a.walkDir = -1; a.yaw = Math.PI; }
      if (a.position.z < (a.walkMin ?? -190)) { a.position.z = a.walkMin ?? -190; a.walkDir = 1; a.yaw = 0; }
    }

    // ---- cyclist loops the avenue bike lane ----
    {
      const dir = cyclist.yaw === Math.PI ? -1 : 1;
      cyclist.position.z += dir * cyclist.speed * dt;
      if (cyclist.position.z < -240) { cyclist.position.z = -240; cyclist.yaw = 0; }
      if (cyclist.position.z > 240) { cyclist.position.z = 240; cyclist.yaw = Math.PI; }
      cyclist.phase += dt * 3.2;
      bike.position.set(cyclist.position.x, 0, cyclist.position.z);
      bike.rotation.y = cyclist.yaw;
    }

    if (fxCtl && fxCtl.update) fxCtl.update(dt);
    people.draw(time, dt, null);
  }

  // Default staging: the market tableau, so a bare scene shows the crowd.
  reset('market');

  return {
    state, hero, units, traffic, people, lead, partner,
    inez, rafi, suri, suspect, cyclist, bike, killGroup, crowd,
    update, reset, stageMarket,
  };
}
