// game/src/vehicles.js
// Shaped glossy cars, a KPD police interceptor and the ELANG-1 helicopter
// for "KIBERA RISING" — make.fun gta6-01, round 8. Original code written
// for this entry. Cars are extruded side profiles (long hood, cabin taper,
// trunk) — never plain boxes — with glossy paint, tinted glass, hubcap
// wheels, headlight / taillight glow, a driver silhouette, and brake glow.
// Forward is +Z; the group origin sits at ground level under the centre.
//
// The vendored three.js r152 is window.THREE; modules import it by relative
// path and seed all randomness from mulberry32(seed).

import * as THREEImport from '../vendor/three.min.js';
import { WORLD } from './config.js';
import { profile, beam, lightCone, pool } from './geometry.js';
import { sign, atmosphereTextures } from './textures.js';
import { headlightGlow } from './effects.js';

// The vendored three.min.js is a UMD build. Under an ESM loader it either
// arrives as the `default` export (CJS interop) or attaches itself to
// globalThis.THREE as a side effect. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

export const VEHICLE_TYPES = ['sedan', 'hatch', 'taxi', 'van', 'pickup', 'police'];

// Glossy golden-hour paint palette (colorIndex wraps around it).
const PAINTS = [
  0xc8102e, // crimson
  0x0e7c7b, // teal
  0xe8a020, // amber
  0xf2ede4, // cream
  0x1d4f9c, // royal blue
  0x232326, // charcoal
  0xd96c2e, // sunset orange
  0x6e1f3c, // maroon
  0x2e7d32, // palm green
];

// ---- shared materials / geometries (one set per paint colour, not per car) ----
const _paintCache = new Map();
function paintMat(color) {
  let m = _paintCache.get(color);
  if (!m) {
    m = new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0xbbbbbb });
    _paintCache.set(color, m);
  }
  return m;
}
const _glassMat = new THREE.MeshPhongMaterial({
  color: 0x10181f, shininess: 140, specular: 0xffffff,
  transparent: true, opacity: 0.62,
});
const _tireMat = new THREE.MeshPhongMaterial({ color: 0x141414, shininess: 12, specular: 0x222222 });
const _hubMat = new THREE.MeshPhongMaterial({ color: 0xc8ccd2, shininess: 110, specular: 0xffffff });
const _darkMetal = new THREE.MeshPhongMaterial({ color: 0x1c1e22, shininess: 60, specular: 0x666666 });
const _chromeMat = new THREE.MeshPhongMaterial({ color: 0xd8dde2, shininess: 130, specular: 0xffffff });
const _driverMat = new THREE.MeshPhongMaterial({ color: 0x1a2027, shininess: 20 });
const _headlightMat = new THREE.MeshPhongMaterial({
  color: 0xfff2cc, emissive: 0xffedb0, emissiveIntensity: 1.4, shininess: 80,
});
const _tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
const _hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.26, 10);
_tireGeo.rotateZ(Math.PI / 2); // cylinder axis -> X (axle direction)
_hubGeo.rotateZ(Math.PI / 2);

/**
 * Extrude a side profile (x = length, front +x; y = height) into a centred
 * car body: front ends up facing +Z, width centred on X.
 */
function bodyGeometry(points, width, bevel = 0.05) {
  const geo = profile(points, width - bevel * 2, bevel);
  geo.rotateY(-Math.PI / 2); // profile +x -> +z, extrusion depth -> -x
  geo.translate((width - bevel * 2) / 2, 0, 0); // centre the width on X
  return geo;
}

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  return m;
}

// Side profiles: [x (length, front +), y (height)]. Lower body is paint,
// greenhouse is tinted glass, roof is a thin paint slab on top.
const SPECS = {
  sedan: {
    len: 4.4, wid: 1.82, wheelR: 0.34, axle: 1.45,
    lower: [{ x: -2.18, y: 0.14 }, { x: -2.24, y: 0.42 }, { x: -2.14, y: 0.60 }, { x: -1.72, y: 0.68 }, { x: -1.30, y: 0.74 },
      { x: 1.30, y: 0.76 }, { x: 1.95, y: 0.72 }, { x: 2.20, y: 0.58 }, { x: 2.24, y: 0.40 }, { x: 2.16, y: 0.14 }],
    glass: [{ x: -1.28, y: 0.70 }, { x: -1.02, y: 1.16 }, { x: -0.45, y: 1.30 }, { x: 0.42, y: 1.30 }, { x: 0.92, y: 1.02 }, { x: 1.05, y: 0.70 }],
    roof: { y: 1.31, len: 0.95 },
  },
  hatch: {
    len: 3.9, wid: 1.78, wheelR: 0.33, axle: 1.28,
    lower: [{ x: -1.92, y: 0.14 }, { x: -1.98, y: 0.44 }, { x: -1.88, y: 0.62 }, { x: -1.45, y: 0.68 }, { x: -1.10, y: 0.74 },
      { x: 1.05, y: 0.76 }, { x: 1.62, y: 0.72 }, { x: 1.92, y: 0.58 }, { x: 1.96, y: 0.40 }, { x: 1.88, y: 0.14 }],
    glass: [{ x: -1.15, y: 0.70 }, { x: -1.02, y: 1.14 }, { x: -0.55, y: 1.28 }, { x: 0.30, y: 1.28 }, { x: 0.78, y: 1.00 }, { x: 0.92, y: 0.70 }],
    roof: { y: 1.29, len: 0.85 },
  },
  taxi: {
    len: 4.4, wid: 1.82, wheelR: 0.34, axle: 1.45,
    lower: [{ x: -2.18, y: 0.14 }, { x: -2.24, y: 0.42 }, { x: -2.14, y: 0.60 }, { x: -1.72, y: 0.68 }, { x: -1.30, y: 0.74 },
      { x: 1.30, y: 0.76 }, { x: 1.95, y: 0.72 }, { x: 2.20, y: 0.58 }, { x: 2.24, y: 0.40 }, { x: 2.16, y: 0.14 }],
    glass: [{ x: -1.28, y: 0.70 }, { x: -1.02, y: 1.16 }, { x: -0.45, y: 1.30 }, { x: 0.42, y: 1.30 }, { x: 0.92, y: 1.02 }, { x: 1.05, y: 0.70 }],
    roof: { y: 1.31, len: 0.95 },
  },
  van: {
    len: 4.8, wid: 1.92, wheelR: 0.36, axle: 1.60,
    lower: [{ x: -2.38, y: 0.14 }, { x: -2.44, y: 0.50 }, { x: -2.34, y: 0.86 }, { x: -1.90, y: 1.00 },
      { x: 1.90, y: 1.02 }, { x: 2.34, y: 0.90 }, { x: 2.44, y: 0.50 }, { x: 2.38, y: 0.14 }],
    glass: [{ x: -2.05, y: 0.98 }, { x: -1.85, y: 1.55 }, { x: -1.20, y: 1.68 }, { x: 1.35, y: 1.68 }, { x: 1.95, y: 1.42 }, { x: 2.10, y: 0.98 }],
    roof: { y: 1.69, len: 2.60 },
  },
  pickup: {
    len: 4.9, wid: 1.88, wheelR: 0.36, axle: 1.55,
    // Concave dip between tailgate top (0.98) and bed floor (0.80): a real bed.
    lower: [{ x: -2.42, y: 0.14 }, { x: -2.48, y: 0.48 }, { x: -2.38, y: 0.98 }, { x: -2.30, y: 0.98 }, { x: -2.28, y: 0.80 },
      { x: -0.72, y: 0.80 }, { x: -0.68, y: 0.80 }, { x: 1.05, y: 0.82 }, { x: 1.95, y: 0.78 },
      { x: 2.32, y: 0.60 }, { x: 2.44, y: 0.42 }, { x: 2.38, y: 0.14 }],
    glass: [{ x: -0.62, y: 0.78 }, { x: -0.52, y: 1.42 }, { x: 0.05, y: 1.52 }, { x: 0.75, y: 1.52 }, { x: 1.08, y: 1.02 }, { x: 1.12, y: 0.78 }],
    roof: { y: 1.53, len: 0.80 },
  },
  police: {
    len: 4.5, wid: 1.84, wheelR: 0.34, axle: 1.48,
    lower: [{ x: -2.22, y: 0.14 }, { x: -2.28, y: 0.42 }, { x: -2.18, y: 0.60 }, { x: -1.75, y: 0.68 }, { x: -1.32, y: 0.74 },
      { x: 1.32, y: 0.76 }, { x: 1.98, y: 0.72 }, { x: 2.23, y: 0.58 }, { x: 2.27, y: 0.40 }, { x: 2.19, y: 0.14 }],
    glass: [{ x: -1.30, y: 0.70 }, { x: -1.04, y: 1.16 }, { x: -0.46, y: 1.30 }, { x: 0.43, y: 1.30 }, { x: 0.94, y: 1.02 }, { x: 1.07, y: 0.70 }],
    roof: { y: 1.31, len: 0.95 },
  },
};

/**
 * Build one shaped glossy car.
 * @param {string} type One of VEHICLE_TYPES.
 * @param {object} fx Effects controller (reserved for muzzle/flash hooks; may be null).
 * @param {number} colorIndex Index into the glossy paint palette.
 * @param {boolean} compact Skip driver figure + mirrors on low-end staging.
 * @returns {{group:THREE.Group, update:Function, anchors:{muzzle:THREE.Object3D, driver:THREE.Object3D}, setLightbar:Function, type:string, length:number, width:number}}
 */
export function makeVehicle(type, fx, colorIndex = 0, compact = false) {
  const spec = SPECS[type] || SPECS.sedan;
  const isPolice = type === 'police';
  const paint = isPolice ? 0xf2ede4 : PAINTS[((colorIndex % PAINTS.length) + PAINTS.length) % PAINTS.length];
  const paintMaterial = paintMat(paint);
  const { len, wid, wheelR, axle } = spec;

  const group = new THREE.Group();
  group.name = `vehicle-${type}`;
  const body = new THREE.Group();
  body.name = 'body';
  group.add(body);

  // Lower body (paint) + tinted greenhouse + thin paint roof slab.
  const lower = new THREE.Mesh(bodyGeometry(spec.lower, wid), paintMaterial);
  lower.castShadow = true;
  body.add(lower);
  const cabin = new THREE.Mesh(bodyGeometry(spec.glass, wid - 0.12, 0.03), _glassMat);
  body.add(cabin);
  const roofSlab = box(wid - 0.16, 0.06, spec.roof.len, paintMaterial);
  // Roof slab runs along Z; centre it on the roof flat (glass points 2..3
  // are the roof in profile-x, which maps to +z after the rotateY).
  roofSlab.position.set(0, spec.roof.y, (spec.glass[2].x + spec.glass[3].x) / 2);
  body.add(roofSlab);

  // Grille + headlights (emissive + glow sprites) + taillights (brake glow).
  const grille = box(wid - 0.55, 0.12, 0.05, _darkMetal);
  grille.position.set(0, 0.42, len / 2 + 0.005);
  body.add(grille);
  const tailMat = new THREE.MeshPhongMaterial({
    color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.55, shininess: 60,
  });
  for (const side of [-1, 1]) {
    const head = box(0.34, 0.12, 0.06, _headlightMat);
    head.position.set(side * 0.55, 0.52, len / 2 - 0.02);
    body.add(head);
    headlightGlow(body, side * 0.55, 0.52, len / 2 + 0.16, 0xffe6b0, 1.05);
    const tail = box(0.30, 0.10, 0.05, tailMat);
    tail.position.set(side * 0.55, 0.60, -len / 2 + 0.02);
    body.add(tail);
  }
  const brakeGlowL = headlightGlow(body, -0.55, 0.60, -len / 2 - 0.14, 0xff2a22, 0.9);
  const brakeGlowR = headlightGlow(body, 0.55, 0.60, -len / 2 - 0.14, 0xff2a22, 0.9);
  brakeGlowL.material.opacity = 0.12;
  brakeGlowR.material.opacity = 0.12;

  // Driver silhouette (right-hand seat, as driven in Indonesia) + anchors.
  const driverAnchor = new THREE.Object3D();
  driverAnchor.position.set(-0.38, 1.18, 0.15);
  body.add(driverAnchor);
  if (!compact) {
    const torso = box(0.36, 0.52, 0.26, _driverMat);
    torso.position.set(-0.38, 0.98, 0.15);
    body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), _driverMat);
    head.position.set(-0.38, 1.32, 0.15);
    body.add(head);
    // Wing mirrors.
    for (const side of [-1, 1]) {
      const mirror = box(0.06, 0.10, 0.16, paintMaterial);
      mirror.position.set(side * (wid / 2 + 0.03), 0.98, 0.88);
      body.add(mirror);
    }
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(-wid / 2 - 0.06, 1.02, 0.45);
  body.add(muzzle);

  // Wheels: steer group (front) -> spin group -> tyre + hubcap.
  const wheels = [];
  const steerGroups = [];
  for (const zSide of [1, -1]) {
    for (const xSide of [-1, 1]) {
      const steer = new THREE.Group();
      steer.position.set(xSide * (wid / 2 - 0.04), wheelR, zSide * axle);
      const spin = new THREE.Group();
      const tyre = new THREE.Mesh(_tireGeo, _tireMat);
      tyre.castShadow = true;
      spin.add(tyre);
      if (!compact) {
        const hub = new THREE.Mesh(_hubGeo, _hubMat);
        spin.add(hub);
      }
      steer.add(spin);
      group.add(steer);
      wheels.push(spin);
      if (zSide === 1) steerGroups.push(steer);
    }
  }

  // Pickup bed liner (dark inset slab in the concave bed).
  if (type === 'pickup') {
    const liner = box(wid - 0.30, 0.03, 1.45, _darkMetal);
    liner.position.set(0, 0.815, -1.50);
    body.add(liner);
  }

  // Taxi roof sign (amber box + TAXI faces front and back).
  if (type === 'taxi') {
    const signTex = sign('TAXI', '#f7b500', '#111111');
    const signBox = box(0.66, 0.17, 0.28, paintMat(0xf7b500));
    signBox.position.set(0, spec.roof.y + 0.12, -0.05);
    body.add(signBox);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    for (const zSide of [1, -1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.60, 0.15), signMat);
      face.position.set(0, spec.roof.y + 0.12, -0.05 + zSide * 0.145);
      if (zSide === -1) face.rotation.y = Math.PI;
      body.add(face);
    }
  }

  // ---- police interceptor extras ----
  let lightbar = null;
  if (isPolice) {
    // Black door band + KPD decals on both doors.
    const bandMat = new THREE.MeshPhongMaterial({ color: 0x0c0e12, shininess: 40 });
    for (const side of [-1, 1]) {
      const band = box(0.02, 0.24, len * 0.80, bandMat);
      band.position.set(side * (wid / 2 + 0.005), 0.55, 0.05);
      body.add(band);
      const decalTex = sign('KPD', '#0c0e12', '#ffd97a');
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.24),
        new THREE.MeshBasicMaterial({ map: decalTex }),
      );
      decal.position.set(side * (wid / 2 + 0.02), 0.55, 0.10);
      decal.rotation.y = side * Math.PI / 2;
      body.add(decal);
    }
    // Light bar: dark base + red / blue emissive segments + glow sprites.
    const barBase = box(1.15, 0.08, 0.30, _darkMetal);
    barBase.position.set(0, spec.roof.y + 0.06, -0.05);
    body.add(barBase);
    const redMat = new THREE.MeshPhongMaterial({
      color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.4, shininess: 40,
    });
    const blueMat = new THREE.MeshPhongMaterial({
      color: 0x111188, emissive: WORLD.policeBlue, emissiveIntensity: 0.4, shininess: 40,
    });
    const redSeg = box(0.52, 0.10, 0.30, redMat);
    redSeg.position.set(-0.29, spec.roof.y + 0.07, -0.05);
    body.add(redSeg);
    const blueSeg = box(0.52, 0.10, 0.30, blueMat);
    blueSeg.position.set(0.29, spec.roof.y + 0.07, -0.05);
    body.add(blueSeg);
    const redGlow = headlightGlow(body, -0.29, spec.roof.y + 0.10, -0.05, 0xff2222, 1.0);
    const blueGlow = headlightGlow(body, 0.29, spec.roof.y + 0.10, -0.05, WORLD.policeBlue, 1.0);
    redGlow.material.opacity = 0.15;
    blueGlow.material.opacity = 0.15;
    // Bull bar: two uprights + cross bar at the nose.
    const barMat = _chromeMat;
    beam(body, new THREE.Vector3(-0.55, 0.14, len / 2 + 0.06),
      new THREE.Vector3(-0.55, 0.72, len / 2 + 0.06), 0.035, barMat);
    beam(body, new THREE.Vector3(0.55, 0.14, len / 2 + 0.06),
      new THREE.Vector3(0.55, 0.72, len / 2 + 0.06), 0.035, barMat);
    beam(body, new THREE.Vector3(-0.55, 0.70, len / 2 + 0.06),
      new THREE.Vector3(0.55, 0.70, len / 2 + 0.06), 0.035, barMat);
    // A-pillar spotlight on the driver's side, aimed forward.
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.20, 10), _darkMetal);
    spot.rotation.x = Math.PI / 2 - 0.15;
    spot.position.set(-wid / 2 + 0.02, 1.06, 0.92);
    body.add(spot);
    lightbar = { redMat, blueMat, redGlow, blueGlow, on: false };
  }

  let time = 0;
  let steerCurrent = 0;

  /**
   * Advance wheel spin, steering, brake glow, body lean and the light bar.
   * @param {number} dt Seconds since last frame.
   * @param {number} speed Forward speed in m/s.
   * @param {number} steer Steering input in [-1, 1].
   * @param {boolean} braking Whether the brakes are on.
   */
  function update(dt, speed = 0, steer = 0, braking = false) {
    time += dt;
    const spinDelta = (speed / wheelR) * dt;
    for (const w of wheels) w.rotation.x += spinDelta;
    steerCurrent += (steer - steerCurrent) * Math.min(1, dt * 10);
    for (const s of steerGroups) s.rotation.y = steerCurrent * 0.42;
    // Brake glow: bright taillights + red halo while braking.
    const target = braking ? 2.4 : 0.55;
    tailMat.emissiveIntensity += (target - tailMat.emissiveIntensity) * Math.min(1, dt * 12);
    const glowTarget = braking ? 0.75 : 0.12;
    brakeGlowL.material.opacity += (glowTarget - brakeGlowL.material.opacity) * Math.min(1, dt * 12);
    brakeGlowR.material.opacity = brakeGlowL.material.opacity;
    // Gentle body roll / dive; wheels stay planted.
    const speedF = Math.min(1, Math.abs(speed) / 8);
    body.rotation.z = -steerCurrent * 0.03 * speedF;
    body.rotation.x = braking ? 0.018 : -0.006 * speedF;
    // Police light bar: alternating red / blue flash.
    if (lightbar && lightbar.on) {
      const phase = (time * 9) % 2 < 1;
      lightbar.redMat.emissiveIntensity = phase ? 2.6 : 0.25;
      lightbar.blueMat.emissiveIntensity = phase ? 0.25 : 2.6;
      lightbar.redGlow.material.opacity = phase ? 0.85 : 0.12;
      lightbar.blueGlow.material.opacity = phase ? 0.12 : 0.85;
    } else if (lightbar) {
      lightbar.redMat.emissiveIntensity = 0.4;
      lightbar.blueMat.emissiveIntensity = 0.4;
      lightbar.redGlow.material.opacity = 0.15;
      lightbar.blueGlow.material.opacity = 0.15;
    }
  }

  /** Toggle the police light bar (no-op on civilian cars). */
  function setLightbar(on) {
    if (lightbar) lightbar.on = !!on;
  }

  return {
    group, update,
    anchors: { muzzle, driver: driverAnchor },
    setLightbar, type, length: len, width: wid,
  };
}

/**
 * Build the ELANG-1 police helicopter.
 * @param {THREE.Scene} scene Scene the helicopter group and its ground
 *   searchlight footprint attach to.
 * @param {object} fx Effects controller (reserved; may be null).
 * @param {boolean} compact Reduce detail on low-end staging.
 * @returns {{group:THREE.Group, cone:THREE.Mesh, footprint:THREE.Mesh, setActive:Function, aimAt:Function, update:Function}}
 */
export function makeHelicopter(scene, fx, compact = false) {
  const group = new THREE.Group();
  group.name = 'helicopter-ELANG-1';
  scene.add(group);

  const paintMaterial = paintMat(0xf2ede4);
  const navyMat = new THREE.MeshPhongMaterial({ color: 0x0d1b3e, shininess: 80, specular: 0x888888 });

  // Shaped fuselage: extruded side profile (rounded nose, tapered tail).
  const fuselagePts = [
    { x: -1.90, y: 0.75 }, { x: -1.20, y: 0.90 }, { x: -0.60, y: 1.05 }, { x: 0.40, y: 1.35 }, { x: 1.30, y: 1.35 },
    { x: 1.90, y: 1.05 }, { x: 2.10, y: 0.70 }, { x: 1.95, y: 0.35 }, { x: 1.20, y: 0.18 }, { x: -0.40, y: 0.12 },
    { x: -1.30, y: 0.30 }, { x: -1.90, y: 0.55 },
  ];
  const fuselage = new THREE.Mesh(bodyGeometry(fuselagePts, 1.70, 0.06), paintMaterial);
  fuselage.castShadow = true;
  group.add(fuselage);

  // Tinted cockpit canopy over the nose.
  const canopyPts = [{ x: 0.30, y: 0.90 }, { x: 0.70, y: 1.35 }, { x: 1.50, y: 1.30 }, { x: 1.95, y: 0.95 }, { x: 1.90, y: 0.75 }];
  const canopy = new THREE.Mesh(bodyGeometry(canopyPts, 1.52, 0.03), _glassMat);
  group.add(canopy);

  // Navy cheatline stripe along both flanks.
  for (const side of [-1, 1]) {
    const stripe = box(0.02, 0.18, 2.6, navyMat);
    stripe.position.set(side * 0.86, 0.62, 0.15);
    group.add(stripe);
  }

  // Tail boom: tapered cylinder running back from the fuselage.
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.30, 3.4, 10), paintMaterial);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.82, -3.55);
  boom.castShadow = true;
  group.add(boom);

  // ELANG-1 tail band on both sides of the boom.
  const bandTex = sign('ELANG-1', '#0d1b3e', '#ffd97a');
  const bandMat = new THREE.MeshBasicMaterial({ map: bandTex });
  for (const side of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), bandMat);
    band.position.set(side * 0.26, 0.82, -3.40);
    band.rotation.y = side * Math.PI / 2;
    group.add(band);
  }

  // Tail fin + horizontal stabiliser.
  const fin = box(0.06, 0.95, 0.72, navyMat);
  fin.position.set(0, 1.15, -5.05);
  group.add(fin);
  const stab = box(1.45, 0.05, 0.42, paintMaterial);
  stab.position.set(0, 0.92, -4.85);
  group.add(stab);

  // Tail rotor (2 blades, spins about X) on the fin's left side.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.10, 1.05, -5.10);
  const tailBladeGeo = new THREE.BoxGeometry(0.04, 0.95, 0.10);
  const tailBladeA = new THREE.Mesh(tailBladeGeo, _darkMetal);
  const tailBladeB = new THREE.Mesh(tailBladeGeo, _darkMetal);
  tailBladeB.rotation.x = Math.PI / 2;
  tailRotor.add(tailBladeA, tailBladeB);
  group.add(tailRotor);

  // Skids: two ground tubes + four struts.
  for (const side of [-1, 1]) {
    beam(group, new THREE.Vector3(side * 0.72, -0.18, -1.25),
      new THREE.Vector3(side * 0.72, -0.18, 1.65), 0.045, _darkMetal);
    beam(group, new THREE.Vector3(side * 0.55, 0.12, -0.85),
      new THREE.Vector3(side * 0.72, -0.18, -0.85), 0.035, _darkMetal);
    beam(group, new THREE.Vector3(side * 0.55, 0.12, 1.15),
      new THREE.Vector3(side * 0.72, -0.18, 1.15), 0.035, _darkMetal);
  }

  // Main rotor: mast + 4 blades (two crossed bars), spins about Y.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 8), _darkMetal);
  mast.position.set(0, 1.62, 0.10);
  group.add(mast);
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.92, 0.10);
  const bladeGeo = new THREE.BoxGeometry(0.30, 0.03, 3.6);
  const bladeA = new THREE.Mesh(bladeGeo, _darkMetal);
  const bladeB = new THREE.Mesh(bladeGeo, _darkMetal);
  bladeB.rotation.y = Math.PI / 2;
  mainRotor.add(bladeA, bladeB);
  if (!compact) {
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.10, 10), _chromeMat);
    mainRotor.add(hubCap);
  }
  group.add(mainRotor);

  // Searchlight: cone pivoting from a nose mount + ground footprint pool.
  const conePivot = new THREE.Group();
  conePivot.position.set(0, 0.15, 1.55);
  group.add(conePivot);
  const cone = lightCone(conePivot, 0xffe9b0, 4.5, 16, 0.18);
  cone.position.y = -8; // apex at the pivot, wide base 16 m below
  const atmo = atmosphereTextures();
  const footprint = pool(scene, atmo.cone, 0, 0, 10, 10, 0.5, 0.06);
  footprint.name = 'heli-footprint';

  let active = false;
  let rotorSpeed = 0;
  let time = 0;
  let baseY = null;
  const _target = new THREE.Vector3();
  const _mount = new THREE.Vector3();
  const _down = new THREE.Vector3(0, -1, 0);
  const _dir = new THREE.Vector3();

  /** Show / hide the searchlight cone + footprint and spool the rotors. */
  function setActive(on) {
    active = !!on;
    cone.visible = active;
    footprint.visible = active;
  }

  /**
   * Aim the searchlight at a ground point: moves the footprint and re-aims
   * the cone from the nose mount toward that point.
   */
  function aimAt(x, z) {
    footprint.position.set(x, 0.06, z);
    group.updateMatrixWorld(true);
    conePivot.getWorldPosition(_mount);
    _target.set(x, 0, z);
    _dir.subVectors(_target, _mount);
    if (_dir.lengthSq() < 0.01) _dir.set(0, -1, 0);
    _dir.normalize();
    // Convert the world direction into the pivot's parent (group) space.
    const localDir = group.worldToLocal(_target.clone()).sub(conePivot.position).normalize();
    conePivot.quaternion.setFromUnitVectors(_down, localDir);
  }

  /** Spin rotors, bob gently, flicker the searchlight cone. */
  function update(dt) {
    time += dt;
    if (baseY === null) baseY = group.position.y;
    rotorSpeed += ((active ? 1 : 0) - rotorSpeed) * Math.min(1, dt * 1.5);
    mainRotor.rotation.y += dt * 16 * rotorSpeed;
    tailRotor.rotation.x += dt * 42 * rotorSpeed;
    group.position.y = baseY + Math.sin(time * 1.2) * 0.3;
    group.rotation.z = Math.sin(time * 0.8) * 0.02;
    if (active) cone.material.opacity = 0.17 + Math.sin(time * 7) * 0.02;
  }

  setActive(false);
  return { group, cone, footprint, setActive, aimAt, update };
}
