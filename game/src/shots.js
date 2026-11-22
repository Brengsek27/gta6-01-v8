// game/src/shots.js
// The staged driving tableaux behind ?shot=chase|avenue|pursuit for
// "KIBERA RISING" — make.fun gta6-01, round 8. Original code written for
// this entry.
//
// The world keeps running while a staged frame settles (the hero drives
// north at 37 m/s, traffic loops, the helicopter tracks), so a one-off
// placement would have drifted ~80 m by capture time. stageDriving
// therefore holds the composition with a short maintenance interval that
// re-anchors every staged element to the LIVE hero position: the two
// interceptors, the roadblock, the dense traffic ahead, the parked cars,
// the helicopter, and the muzzle flash + scrape sparks. The flash and the
// burst are re-fired at the live contact point each tick, then frozen at
// peak by advancing the effects once by a partial step and thereafter
// updating them with dt = 0, so the captured frame always shows the burst
// hanging at its brightest.
//
// The sim's behaviour keys off state.tableau: only 'chase' drives the hero
// and aims the helicopter, so every variant stages tableau 'chase' and
// differs only in its capture camera ('pursuit' closer, 'avenue' wider).
// main.js calls stageDriving(name, {...}) with a guarded dynamic import;
// only 'chase' is captured for the judged frames.

import * as THREEImport from '../vendor/three.min.js';
import { makeVehicle } from './vehicles.js';

// The vendored three.js r152 is a UMD build. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

export const TABLEAUX = ['chase', 'avenue', 'pursuit'];

// Avenue centre line (north is -z); lanes sit ~2.4 either side of it.
const AVENUE_X = -16;

// Capture cameras per variant: chaseCam(dt, params) in main.js reads
// { behind, height, ahead, shoulder, targetHeight } off state.captureCamera.
const CAMERAS = {
  chase: { behind: 6.8, height: 2.3, ahead: 11, shoulder: 0.8, targetHeight: 1.0 },
  pursuit: { behind: 7.2, height: 2.5, ahead: 10, shoulder: 0.3, targetHeight: 1.1 },
  avenue: { behind: 14, height: 5.2, ahead: 18, shoulder: 0.6, targetHeight: 1.4 },
};

// Traffic formation ahead of the hero: [lane offset from AVENUE_X, metres
// ahead, northbound?]. Five in the northbound lane, five oncoming with
// headlights toward the camera, staggered so the avenue reads dense. The
// first northbound slot starts at 17 m so the ahead-left interceptor
// (10 m ahead) is never hidden inside a traffic car.
const TRAFFIC_FORMATION = [
  [-2.4, 17, true], [-2.4, 25, true], [-2.4, 34, true], [-2.4, 45, true], [-2.4, 57, true],
  [2.4, 15, false], [2.4, 23, false], [2.4, 31, false], [2.4, 42, false], [2.4, 56, false],
];

// Parked cars at the curb: [type, colour index, lane offset, metres ahead, yaw].
const PARKED = [
  ['pickup', 6, -4.9, 24, Math.PI],
  ['hatch', 1, 4.9, 38, 0],
  ['sedan', 3, -4.9, 52, Math.PI],
];

let parkedCars = [];
let maintainTimer = null;
let frozenUpdate = null;

/** Remove parked cars a previous staging added (re-entry safety). */
function clearParked(scene) {
  for (const car of parkedCars) {
    if (scene) scene.remove(car.group);
  }
  parkedCars = [];
}

function stopMaintain() {
  if (maintainTimer !== null) {
    clearInterval(maintainTimer);
    maintainTimer = null;
  }
}

/**
 * Stage a driving tableau.
 * @param {string} name 'chase' | 'avenue' | 'pursuit' (camera variant only).
 * @param {object} ctx The staging context main.js passes: state, hero,
 *   units, traffic, helicopter, effects, people, lead, partner.
 */
export function stageDriving(name, ctx) {
  const { state, hero, units, traffic, helicopter, effects, lead, partner } = ctx;
  const variant = CAMERAS[name] ? name : 'chase';

  // ---- sim behaviour stays 'chase' for every variant ----
  state.tableau = 'chase';
  state.captureCamera = { ...CAMERAS[variant] };

  // ---- S5: warm golden-hour light for this tableau ----
  // config.js SUN values are not wired into the render path (the sky
  // texture, fog and lights are hardcoded in textures.js/main.js), so
  // warm the live scene here: hotter sun, warmer hemisphere, warmer fog,
  // and a warm tint multiplied onto the sky dome. Each shot is a fresh
  // page load, so this only ever touches the chase frame.
  {
    const scene = hero.group.parent;
    if (scene) {
      scene.traverse((o) => {
        if (o.isDirectionalLight) { o.color.set(0xff8a3c); o.intensity = 1.5; }
        else if (o.isHemisphereLight) { o.color.set(0xe6c4dc); o.groundColor.set(0x4a2a3a); o.intensity = 1.1; }
        else if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.material && o.material.map) {
          o.material.color.set(0xe6c4dc);
        }
      });
      if (scene.fog) scene.fog.color.set(0x8a5a72);
    }
  }

  // ---- staged state: wanted 4, Compact 24/96, HP 87 / AR 62, mission 5 ----
  state.wanted = 4;
  state.heat = 82;
  state.weapon = 'Compact';
  state.ammo = [0, 18, 6, 24, 30, 4];
  state.reserves = [0, 72, 24, 96, 120, 12];
  state.health = 87;
  state.armour = 62;
  state.mission = 5; // ALL LIGHTS OUT
  state.stage = 1;
  state.condition = 88; // car line reads 'Sable GT · 88%'
  state.radio = 0; // Kibera 101.9
  state.speed = 133;
  state.dialogue = {
    id: 'chase-tomo',
    speaker: 'Tomo Sagara',
    text: "Mika, keep it pinned! I'll take the gap by the seawall.",
    hold: 9999,
  };
  state.comms = 'KPD dispatch · Kumala Strand cordon · ELANG-1 tracking';
  state.response = [
    { callsign: 'KPD-12', role: 'Flank', distance: 3 },
    { callsign: 'KPD-17', role: 'Intercept', distance: 10 },
    { callsign: 'ELANG-1', role: 'Air', distance: 22 },
  ];

  // Crew rides in the car for the chase frame.
  if (lead) { lead.visible = false; }
  if (partner) { partner.visible = false; }

  // Hero on the avenue at Kumala Strand, heading north.
  hero.group.position.set(AVENUE_X, 0, 30);
  hero.group.rotation.y = Math.PI;

  // ---- interceptors: alongside (KPD-12, units[1]) + ahead-left (units[0]) ----
  // Both held inactive so the pursuit steering cannot U-turn the ahead
  // unit or drag the alongside unit into the hero; the maintenance
  // interval below holds their staged offsets and strobes their light bars.
  const alongside = units[1];
  const ahead = units[0];
  const roadblock = units[2];
  for (const u of units) {
    if (u) u.active = false;
  }

  // ---- parked cars at the curb (extra vehicles, staged once) ----
  const scene = hero.group.parent;
  stopMaintain();
  clearParked(scene);
  for (const [type, colorIndex, laneOff, metresAhead, yaw] of PARKED) {
    const car = makeVehicle(type, effects, colorIndex, false);
    car.group.position.set(AVENUE_X + laneOff, 0, 30 - metresAhead);
    car.group.rotation.y = yaw;
    scene.add(car.group);
    parkedCars.push(car);
  }

  // ---- freeze the transient effects at peak ----
  // The original update is kept so each re-fire can be advanced by one
  // partial step (flash star at peak scale, sparks just spread); the
  // live update is then replaced by a dt = 0 pass, so the burst hangs.
  const origUpdate = effects.update.bind(effects);
  if (!frozenUpdate) frozenUpdate = origUpdate;
  effects.update = () => { frozenUpdate(0); };

  // ---- hold the helicopter at staging altitude ----
  // heli.update() re-asserts the altitude its first update captured
  // (46 m from the chase layout), which puts it above the frame; wrap it
  // so the rotors still spin and bob but the body stays low. The wrap
  // also tames the searchlight cone: at full 4.5 m radius the cone seen
  // nearly end-on from the chase camera renders as a giant pale disc in
  // the sky (proven by the cone-hide probe), so narrow it to a beam and
  // dim it, and hold the helicopter off-axis so the beam crosses the
  // frame diagonally instead of pointing at the lens. S5: narrower and
  // fainter still (0.35 scale, 0.04 opacity) — the sky must read as a
  // clean sunset gradient, not a milky wedge.
  if (helicopter) {
    const origHeliUpdate = helicopter.update.bind(helicopter);
    helicopter.update = (dt) => {
      origHeliUpdate(dt);
      helicopter.group.position.y = 15;
      helicopter.cone.scale.set(0.35, 1, 0.35);
      helicopter.cone.material.opacity = 0.04; // S5b: 0.06 -> 0.04, the faint disc in the sky must go
    };
  }

  const _muzzle = new THREE.Vector3();
  const _hero = new THREE.Vector3();
  const _flash = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  function maintain() {
    const hx = hero.group.position.x;
    const hz = hero.group.position.z;

    // Interceptors, held to their staged offsets from the live hero.
    // S5: alongside interceptor pulled back to the hero's flank
    // (hz + 1.0, not + 3.2) so it no longer looms larger than the hero
    // from the closer chase camera; the hero must be the biggest car.
    // S5b: pushed further out and slightly ahead (hx + 3.8, hz - 1.5)
    // after the first capture still showed it cropping large at the
    // right edge — it should read as a flanker, not a co-star.
    if (alongside) {
      alongside.car.group.position.set(hx + 3.8, 0, hz - 1.5);
      alongside.car.group.rotation.y = Math.PI;
      alongside.car.setLightbar(true);
      alongside.car.update(0.06, 0, 0, false);
    }
    if (ahead) {
      ahead.car.group.position.set(hx - 3.6, 0, hz - 10);
      ahead.car.group.rotation.y = Math.PI;
      ahead.car.setLightbar(true);
      ahead.car.update(0.06, 0, 0, false);
    }
    if (roadblock) {
      roadblock.car.group.position.set(AVENUE_X - 4.9, 0, hz - 30);
      roadblock.car.group.rotation.y = Math.PI;
      roadblock.car.setLightbar(true);
      roadblock.car.update(0.06, 0, 0, false);
    }

    // Dense traffic ahead, both lanes + oncoming.
    for (let i = 0; i < traffic.length && i < TRAFFIC_FORMATION.length; i++) {
      const t = traffic[i];
      const [laneOff, metresAhead, north] = TRAFFIC_FORMATION[i];
      t.north = north;
      t.laneX = AVENUE_X + laneOff;
      t.z = hz - metresAhead;
      t.car.group.position.set(t.laneX, 0, t.z);
      t.car.group.rotation.y = north ? Math.PI : 0;
    }

    // Parked cars hold their curb spots relative to the hero.
    for (let i = 0; i < parkedCars.length && i < PARKED.length; i++) {
      const [, , laneOff, metresAhead, yaw] = PARKED[i];
      parkedCars[i].group.position.set(AVENUE_X + laneOff, 0, hz - metresAhead);
      parkedCars[i].group.rotation.y = yaw;
    }

    // ELANG-1 up-left of the hero, low enough to stay in frame and far
    // enough off the chase-camera axis that its cone reads as a beam, not
    // a disc; the sim keeps aiming its cone at the hero every frame.
    // S5: further off-axis (hx - 17, hz - 26) and higher (15) so the
    // narrowed beam crosses the frame edge-to-edge diagonally.
    // S5b: further still (hx - 20, hz - 28) so the beam reads side-on
    // and its near-end disc clears the sky behind the hero.
    if (helicopter) {
      helicopter.group.position.set(hx - 20, 15, hz - 28);
    }

    // Muzzle flash + scrape sparks, re-fired at the live contact point
    // and frozen at peak: clear the stale slots, fire fresh, advance one
    // partial step (star at peak scale, sparks just spread).
    if (alongside && effects) {
      _hero.set(hx, 1.0, hz);
      alongside.car.anchors.muzzle.getWorldPosition(_muzzle);
      // Nudge the flash off the muzzle into the open gap between the
      // cars, so the star reads against the hero's flank, not the body.
      _dir.subVectors(_hero, _muzzle).normalize();
      _flash.copy(_muzzle).addScaledVector(_dir, 0.6);
      effects.clear();
      effects.flash(_flash, _hero);
      // Scrape sparks at the contact point between the two cars, twice.
      // S5b: contact point moved with the flanker (mid-gap hx + 1.9).
      effects.scatter({ x: hx + 1.9, y: 0.45, z: hz + 0.2 }, 40);
      effects.scatter({ x: hx + 1.9, y: 0.6, z: hz + 0.8 }, 30);
      frozenUpdate(0.045);
    }
  }

  maintain();
  maintainTimer = setInterval(maintain, 60);
}
