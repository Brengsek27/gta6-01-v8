// game/src/city-streets.js
// Kumala Strand avenue, beach, palms, lamps and parked cars for
// "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. Builds on the foundation modules
// (config, random, geometry, textures) and the vendored three.js r152.

import * as THREEImport from '../vendor/three.min.js';
import { DUSK, WORLD } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { profile, lathe, meshAt, combineMeshes, batchRigid, pool } from './geometry.js';
import { groundTexture, sign, atmosphereTextures } from './textures.js';

// The vendored three.min.js is a UMD build. Under an ESM loader it either
// arrives as the `default` export (CJS interop) or attaches itself to
// globalThis.THREE as a side effect. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

const AVENUE_X = -16; // centre line of the Kumala Strand avenue
const ROAD_HALF = 8; // road surface spans x -24 .. -8
const HERO_Z = 0; // hero intersection
const NORTH = WORLD.north; // -275
const SOUTH = WORLD.south; // 275
const COAST_X = WORLD.coast; // -30
const SHORE_X = -60; // open sea starts west of here
const AVENUE_LEN = SOUTH - NORTH; // 550

// A geometry helper may hand back a Mesh instead of raw geometry.
function asGeometry(x) {
  return x && x.isMesh ? x.geometry : x;
}

function groundMat(kind, color, rx, rz, opts = {}) {
  const tex = groundTexture(kind);
  if (tex && tex.isTexture) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, rz);
  }
  return new THREE.MeshStandardMaterial({
    map: tex || null, color, roughness: 0.95, metalness: 0, ...opts,
  });
}

function flat(w, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

// combineMeshes returns a merged BufferGeometry (transforms baked from each
// mesh's matrixWorld, so update them first) — wrap it in a Mesh.
function mergedMesh(list, material) {
  if (!list.length) return null;
  list.forEach((m) => m.updateMatrixWorld());
  const mesh = new THREE.Mesh(combineMeshes(list), material);
  mesh.receiveShadow = true;
  return mesh;
}

// A soft additive glow quad lying on the ground (geometry.pool).
// pool(parent, map, x, z, width, length, opacity, y) adds it and returns it.
function makeGlow(parent, tex, x, z, sx, sz, opacity = 0.55, y = 0.06) {
  return pool(parent, tex, x, z, sx, sz, opacity, y);
}

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  return m;
}

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
}

export function buildStreets(scene, fx, seed = 1337) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'city-streets';

  const atmo = atmosphereTextures();
  const poolTex = atmo && (atmo.pool || atmo.glow || (Array.isArray(atmo) ? atmo[0] : null));

  // ---- 1. Ground: sand west of the coast, asphalt/concrete east, sea ----
  group.add(flat(70, AVENUE_LEN + 10, groundMat('sand', 0xd9c49a, 10, 70), -65, 0, 0));
  group.add(flat(260, AVENUE_LEN + 10, groundMat('asphalt', 0xd8d2c8, 24, 50), 100, 0, 0));
  group.add(flat(140, AVENUE_LEN + 10,
    new THREE.MeshStandardMaterial({ color: WORLD.seaColor, roughness: 0.25, metalness: 0.1 }),
    -130, 0.03, 0));

  // ---- 2. Kumala Strand avenue: road, sidewalks, dashes, crosswalk ----
  group.add(flat(ROAD_HALF * 2, AVENUE_LEN, groundMat('asphalt', 0xcfc8c0, 3, 60), AVENUE_X, 0.02, 0));
  group.add(flat(2, AVENUE_LEN, groundMat('sidewalk', 0xcfc4ae, 1, 60), -25, 0.04, 0));
  group.add(flat(2, AVENUE_LEN, groundMat('sidewalk', 0xcfc4ae, 1, 60), -7, 0.04, 0));

  // Cross street through the hero intersection (z -8 .. 8, east to x 50).
  group.add(flat(74, 16, groundMat('asphalt', 0xcfc8c0, 8, 2), 13, 0.02, 0));

  // Lane dashes, centre line and crosswalk stripes (merged, one draw call each).
  const dashMat = std(0xe8e2d2, { roughness: 0.9 });
  const dashList = [];
  for (const lx of [-20.3, -11.7]) {
    for (let z = NORTH + 3; z <= SOUTH - 3; z += 6) {
      if (Math.abs(z - HERO_Z) < 12) continue;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.2), dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(lx, 0.05, z);
      dashList.push(d);
    }
  }
  for (let x = -20; x <= 46; x += 6) { // cross-street centre dashes
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.16), dashMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(x, 0.05, 0);
    dashList.push(d);
  }
  const dashes = mergedMesh(dashList, dashMat);
  if (dashes) group.add(dashes);

  const centreMat = std(0xd8a13a, { roughness: 0.9 });
  const centreList = [];
  for (const [z0, z1] of [[NORTH + 3, HERO_Z - 10], [HERO_Z + 10, SOUTH - 3]]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.28, z1 - z0), centreMat);
    c.rotation.x = -Math.PI / 2;
    c.position.set(AVENUE_X, 0.05, (z0 + z1) / 2);
    centreList.push(c);
  }
  const centre = mergedMesh(centreList, centreMat);
  if (centre) group.add(centre);

  const stripeMat = std(0xcfc7b4, { roughness: 0.9 });
  const stripeList = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.40), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(AVENUE_X, 0.05, HERO_Z - 4.2 + i * 1.4);
    stripeList.push(s);
  }
  const stripes = mergedMesh(stripeList, stripeMat);
  if (stripes) group.add(stripes);

  // Hero intersection: 4 traffic lights (pole + arm + head + 3 lamps).
  const darkMetal = std(0x1c1f24, { roughness: 0.6, metalness: 0.6 });
  const poleParts = [];
  const lampRed = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2d2d, emissiveIntensity: 2.2 });
  const lampGreen = new THREE.MeshStandardMaterial({ color: 0x0d5c2e, emissive: 0x2eff7a, emissiveIntensity: 2.2 });
  const lampDim = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffc21c, emissiveIntensity: 0.18 });
  const lampGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const lightCorners = [[-24.8, -8.8, 'green'], [-7.2, -8.8, 'red'], [-24.8, 8.8, 'red'], [-7.2, 8.8, 'green']];
  for (const [lx, lz, lit] of lightCorners) {
    const dirX = lx < AVENUE_X ? 1 : -1;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.4, 10), darkMetal);
    pole.position.set(lx, 2.2, lz);
    poleParts.push(pole);
    const arm = box(1.4, 0.12, 0.12, darkMetal);
    arm.position.set(lx + dirX * 0.7, 4.3, lz);
    poleParts.push(arm);
    const head = box(0.35, 1.1, 0.35, darkMetal);
    head.position.set(lx + dirX * 1.4, 3.9, lz);
    poleParts.push(head);
    const lamps = [lit === 'red' ? lampRed : lampDim, lampDim, lit === 'green' ? lampGreen : lampDim];
    lamps.forEach((mat, i) => {
      const lamp = new THREE.Mesh(lampGeo, mat);
      lamp.position.set(lx + dirX * 1.4, 4.25 - i * 0.35, lz + 0.19);
      group.add(lamp);
    });
  }
  const lightPoles = mergedMesh(poleParts, darkMetal);
  if (lightPoles) group.add(lightPoles);

  // ---- 3. Beach west of the coast: umbrellas, towels, kiosk, lifeguard ----
  const umbrellaCols = ['#e8543f', '#f2a93b', '#3f8fbf', '#e8e4da', '#7a4a8a', '#3f8f5f', '#e86a8a', '#4a6fb0'];
  const canopyPts = [
    new THREE.Vector2(0.001, 0.62),
    new THREE.Vector2(0.55, 0.55),
    new THREE.Vector2(1.15, 0.34),
    new THREE.Vector2(1.7, 0.08),
    new THREE.Vector2(1.78, 0.0),
  ];
  const canopyGeo = asGeometry(lathe(canopyPts, 12));
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8);
  const poleWhite = std(0xf2ede0, { roughness: 0.7 });
  const umbrellaPoles = [];
  for (let i = 0; i < 8; i++) {
    const ux = -33 - range(rng, 0, 9);
    const uz = -210 + i * 60 + range(rng, -8, 8);
    const pole = new THREE.Mesh(poleGeo, poleWhite);
    pole.position.set(ux, 1.15, uz);
    umbrellaPoles.push(pole);
    // meshAt(parent, geometry, material, x, y, z) builds, places and adds.
    meshAt(group, canopyGeo, std(pick(rng, umbrellaCols), { roughness: 0.8, side: THREE.DoubleSide }), ux, 2.3, uz);
  }
  // R8: two extra umbrellas ahead of the chase view (visible from the chase camera).
  for (const [ux, uz] of [[-33, -45], [-33, -95]]) {
    const pole = new THREE.Mesh(poleGeo, poleWhite);
    pole.position.set(ux, 1.15, uz);
    umbrellaPoles.push(pole);
    meshAt(group, canopyGeo, std(pick(rng, umbrellaCols), { roughness: 0.8, side: THREE.DoubleSide }), ux, 2.3, uz);
  }
  const uPoles = mergedMesh(umbrellaPoles, poleWhite);
  if (uPoles) group.add(uPoles);

  const towelCols = [0xe8543f, 0x3f8fbf, 0xf2c230, 0xe86a8a, 0x7ac74f, 0xe87a2a];
  const towelSpots = [[-40, -150], [-44, -40], [-42, 20], [-47, 90], [-39, 160], [-45, 210]];
  towelSpots.forEach(([tx, tz], i) => {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0), std(towelCols[i], { roughness: 1 }));
    t.rotation.set(-Math.PI / 2, 0, range(rng, -0.6, 0.6));
    t.position.set(tx, 0.06, tz);
    group.add(t);
  });

  // Kiosk with striped awning and a KOPI sign, facing the avenue.
  const kiosk = box(3.4, 2.6, 2.6, std(0xe8ddc8, { roughness: 0.8 }));
  kiosk.position.set(-36, 1.3, 40);
  group.add(kiosk);
  const counter = box(0.9, 0.15, 3.0, std(0x8a6a4a, { roughness: 0.7 }));
  counter.position.set(-34.2, 1.0, 40);
  group.add(counter);
  const awning = box(1.8, 0.08, 3.8, std(0xc0392b, { roughness: 0.8 }));
  awning.position.set(-34.6, 2.75, 40);
  awning.rotation.z = -0.25;
  group.add(awning);
  const awnWhite = std(0xf2ede0, { roughness: 0.8 });
  const stripeParts = [];
  for (let i = 0; i < 4; i++) {
    const s = box(1.84, 0.09, 0.35, awnWhite);
    s.position.set(-34.6, 2.79, 38.5 + i * 1.0);
    s.rotation.z = -0.25;
    stripeParts.push(s);
  }
  const awnStripes = mergedMesh(stripeParts, awnWhite);
  if (awnStripes) group.add(awnStripes);
  const kopi = sign('KOPI');
  const kopiMesh = kopi && kopi.isMesh
    ? kopi
    : new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7),
      new THREE.MeshBasicMaterial({ map: kopi || null, transparent: true }));
  kopiMesh.position.set(-34.25, 2.1, 40);
  kopiMesh.rotation.y = Math.PI / 2;
  group.add(kopiMesh);

  // Lifeguard stand (white legs + cabin, red roof).
  const guardWhiteParts = [];
  for (const [gx, gz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
    const leg = box(0.12, 2.6, 0.12, poleWhite);
    leg.position.set(-38 + gx, 1.3, -70 + gz);
    guardWhiteParts.push(leg);
  }
  const cabin = box(1.8, 1.3, 1.8, poleWhite);
  cabin.position.set(-38, 3.2, -70);
  guardWhiteParts.push(cabin);
  const guardWhite = mergedMesh(guardWhiteParts, poleWhite);
  if (guardWhite) group.add(guardWhite);
  const roof = box(2.4, 0.1, 2.4, std(0xc0392b, { roughness: 0.8 }));
  roof.position.set(-38, 3.95, -70);
  roof.rotation.z = 0.08;
  group.add(roof);

  // Sea shimmer: one slow additive glow pool drifting over the water.
  const seaGlow = makeGlow(group, poolTex, -80, 0, 50, 16, 0.5, 0.08);

  // ---- 4. Palm rows along both sides of the avenue ----
  const trunkMat = std(0x7a5a3a, { roughness: 1 });
  const frondMat = std(0x2f7a3d, { roughness: 1, side: THREE.DoubleSide });
  const frondGeo = new THREE.BoxGeometry(2.6, 0.06, 0.55);
  frondGeo.translate(1.3, 0, 0);
  const trunkList = [];
  const frondList = [];
  for (let z = -260; z <= 260; z += 14) {
    if (Math.abs(z - HERO_Z) < 12) continue;
    for (const px of [-26, -6]) {
      const h = range(rng, 6, 9);
      const lean = range(rng, -0.06, 0.06);
      const pts = [
        new THREE.Vector2(0.001, 0),
        new THREE.Vector2(0.26, 0),
        new THREE.Vector2(0.23, 0.9),
        new THREE.Vector2(0.19, h * 0.45),
        new THREE.Vector2(0.15, h * 0.8),
        new THREE.Vector2(0.12, h),
      ];
      const trunk = new THREE.Mesh(asGeometry(lathe(pts, 8)), trunkMat);
      trunk.position.set(px, 0, z);
      trunk.rotation.z = lean;
      trunkList.push(trunk);
      const topX = px - Math.sin(lean) * h;
      const topY = Math.cos(lean) * h;
      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(topX, topY, z);
        frond.rotation.set(0, (f * Math.PI) / 3 + range(rng, -0.15, 0.15), -0.5 - range(rng, 0, 0.2));
        frondList.push(frond);
      }
    }
  }
  const trunks = mergedMesh(trunkList, trunkMat);
  if (trunks) group.add(trunks);
  const fronds = mergedMesh(frondList, frondMat);
  if (fronds) group.add(fronds);

  // ---- 5. Street lamps every ~28 units, alternating sides ----
  const lampPoleGroup = new THREE.Group();
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0x554422, emissive: 0xffc98a, emissiveIntensity: 2.0,
  });
  const bulbGeo = new THREE.SphereGeometry(0.22, 12, 10);
  const bulbList = [];
  const lampGlows = [];
  for (let i = 0, z = -266; z <= 266; z += 28, i++) {
    const lx = i % 2 === 0 ? -25.6 : -6.4;
    const dir = lx < AVENUE_X ? 1 : -1;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 10), darkMetal);
    pole.position.set(lx, 2.6, z);
    lampPoleGroup.add(pole);
    const arm = box(1.7, 0.12, 0.12, darkMetal);
    arm.position.set(lx + dir * 0.85, 5.15, z);
    lampPoleGroup.add(arm);
    const bulb = new THREE.Mesh(bulbGeo, lampBulbMat);
    bulb.position.set(lx + dir * 1.7, 5.05, z);
    bulbList.push(bulb);
    const glow = makeGlow(group, poolTex, lx + dir * 1.7, z, 5, 5, 0.55, 0.06);
    lampGlows.push(glow);
  }
  // batchRigid(parent, excluded) merges a group's meshes by material and
  // returns the merged meshes (it does not add them back).
  lampPoleGroup.updateMatrixWorld(true);
  for (const m of batchRigid(lampPoleGroup)) group.add(m);
  const bulbs = mergedMesh(bulbList, lampBulbMat);
  if (bulbs) group.add(bulbs);

  // ---- 6. Parked cars along both curbs (extruded side profiles) ----
  const carProfile = [
    new THREE.Vector2(-2.25, 0.18),
    new THREE.Vector2(-2.25, 0.62),
    new THREE.Vector2(-1.75, 0.68),
    new THREE.Vector2(-1.25, 1.02),
    new THREE.Vector2(-0.85, 1.12),
    new THREE.Vector2(0.35, 1.12),
    new THREE.Vector2(0.75, 0.68),
    new THREE.Vector2(1.95, 0.62),
    new THREE.Vector2(2.25, 0.42),
    new THREE.Vector2(2.25, 0.18),
  ];
  const shellGeo = asGeometry(profile(carProfile, 1.7, 0.05));
  shellGeo.translate(0, 0, -0.85);
  const paintCols = ['#c0392b', '#2e6fb0', '#e8a13a', '#3f8f5f', '#e8e4da',
    '#7a4a8a', '#22262b', '#b0552f', '#4a7a8a', '#d8c25a'];
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.26, 10);
  hubGeo.rotateX(Math.PI / 2);
  const wheelMat = std(0x14161a, { roughness: 0.95 });
  const hubMat = std(0xc8ccd2, { roughness: 0.35, metalness: 0.7 });
  const wheelList = [];
  const hubList = [];
  const carSpots = [-220, -180, -140, -100, -60, 60, 100, 140, 180, 220];
  carSpots.forEach((cz, i) => {
    const cx = i % 2 === 0 ? -23.5 : -8.5; // parking lanes, just off the curbs
    const rotY = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2; // face north / south
    const body = new THREE.Mesh(shellGeo, std(paintCols[i], { roughness: 0.4, metalness: 0.35 }));
    body.position.set(cx, 0, cz);
    body.rotation.y = rotY;
    body.castShadow = true;
    group.add(body);
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    for (const [lx, lz] of [[1.35, 0.8], [1.35, -0.8], [-1.35, 0.8], [-1.35, -0.8]]) {
      const wx = cx + lx * c + lz * s;
      const wz = cz - lx * s + lz * c;
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, 0.34, wz);
      wheel.rotation.y = rotY;
      wheelList.push(wheel);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.position.set(wx, 0.34, wz);
      hub.rotation.y = rotY;
      hubList.push(hub);
    }
  });
  const wheels = mergedMesh(wheelList, wheelMat);
  if (wheels) group.add(wheels);
  const hubs = mergedMesh(hubList, hubMat);
  if (hubs) group.add(hubs);

  scene.add(group);

  // ---- Districts & per-frame animation ----
  function districtAt(x, z) {
    if (x < 0) return 'kumala';
    if (x >= 20 && z > 100) return 'pasaru';
    if (z < -180) return 'lomboro';
    if (x > 60 && z < 60) return 'banyan';
    return 'lantawa';
  }

  function update(time, dt, camera) {
    seaGlow.position.x = -80 + Math.sin(time * 0.12) * 5;
    seaGlow.position.z = Math.sin(time * 0.07) * 24;
    seaGlow.material.opacity = 0.45 + 0.15 * Math.sin(time * 0.5);
    for (let i = 0; i < lampGlows.length; i++) {
      lampGlows[i].material.opacity = 0.5 + 0.16 * Math.sin(time * 2 + i);
    }
  }

  return { group, update, districtAt, strand: { x: -16, z: 0 } };
}
