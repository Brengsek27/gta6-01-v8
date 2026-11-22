// game/src/city-buildings.js
// Shophouses, mid-rises, towers, warehouses and villas for "KIBERA RISING"
// — make.fun gta6-01, round 8. Original code written for this entry.
// Builds on the foundation (config, random, geometry, textures) and the
// vendored three.js r152, following the city-streets.js patterns.
//
// This module owns buildings and their rooftop props ONLY: no ground, no
// palms, no lamps (those live in city-streets.js). Buildings are laid out
// on a loose ~55-unit block grid across the districts, with the Kumala
// Strand avenue (x -32..0) and the Pasaru market (x 20..46, z 110..150)
// kept clear. Static geometry is merged per district chunk with
// batchRigid(), so the whole city stays well under ~150 draw calls.

import * as THREEImport from '../vendor/three.min.js';
import { mulberry32, range, pick } from './random.js';
import { profile, roundedSlab, lathe, batchRigid } from './geometry.js';
import { facade, sign } from './textures.js';

// The vendored three.min.js is a UMD build. Under an ESM loader it either
// arrives as the `default` export (CJS interop) or attaches itself to
// globalThis.THREE as a side effect. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

// Foundation quirk: textures.js paints facades with a bare `mulberry32`
// call but never imports it, so in a browser its facade() / groundTexture()
// throw ReferenceError unless the name exists on the global object. Export
// it here (before any facade call) so the committed foundation works as
// the brief intends — the avenue facades get their lit windows. Harmless
// if textures.js later gains its own import.
if (typeof globalThis.mulberry32 === 'undefined') globalThis.mulberry32 = mulberry32;

const MARKET = { x0: 20, x1: 46, z0: 110, z1: 150 }; // Pasaru market, keep clear
const SIGNS = ['KOPI', 'WARUNG', 'LAUNDRY', 'PHONE', 'BUAH', 'KEDAI', 'IKAN', 'ROTI'];
const SIGN_BG = ['#432b32', '#1d3a2a', '#3a2a1d', '#20344a', '#4a2030'];

// Pasaru shophouse plots ringing the market (the x 27.5 / z 137.5 plot is
// skipped: its footprint would fall inside the market clear zone).
const PASARU_PLOTS = new Set(['27.5,82.5', '82.5,82.5', '82.5,137.5', '27.5,192.5', '82.5,192.5']);

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
}

// Unit facing vector for a building whose shopfront faces local +z.
function facing(rotY) {
  return { x: Math.sin(rotY), z: Math.cos(rotY) };
}

export function buildBuildings(scene, fx, seed = 1337) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'city-buildings';
  // fx is reserved for a later effects pass; the streets module owns lamps
  // and glow pools, so this module does not touch it.
  void fx;

  // ---- Shared materials (one object per look, so batchRigid can merge
  // every building sharing it into a single draw call per chunk) ----
  const facadeCache = new Map();
  function facadeMat(key, color, cols, floors, texSeed, arched, glow = 0.5) {
    if (facadeCache.has(key)) return facadeCache.get(key);
    let mat;
    try {
      const tex = facade(color, cols, floors, texSeed, arched);
      mat = new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xff9a4d, emissiveMap: tex,
        emissiveIntensity: glow, roughness: 0.9, metalness: 0,
      });
    } catch (err) {
      // Foundation texture failed (no canvas / no PRNG): plain wall colour.
      mat = std(color, { roughness: 0.9 });
    }
    facadeCache.set(key, mat);
    return mat;
  }

  const signCache = new Map();
  function signMat(text, bg) {
    if (signCache.has(text)) return signCache.get(text);
    let tex = null;
    try { tex = sign(text, bg); } catch (err) { tex = null; }
    const mat = new THREE.MeshBasicMaterial({
      map: tex || null, transparent: true, side: THREE.DoubleSide,
      color: tex ? 0xffffff : 0xffe0a6,
    });
    signCache.set(text, mat);
    return mat;
  }

// R8 world detail: canvas-striped awning texture (3 colorways).
function stripedAwningTexture(c1, c2) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? c1 : c2; x.fillRect(i * 16, 0, 16, 32); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const mats = {
    shop: ['#e8d8b0', '#dfc49a', '#e6c9a8'].map((c, i) =>
      facadeMat(`shop${i}`, c, 4, 2, 101 + i * 17, true, 0.55)),
    mid: ['#d8cbb8', '#c9b8a3', '#b8c4c9'].map((c, i) =>
      facadeMat(`mid${i}`, c, 5, 5, 211 + i * 17, false, 0.5)),
    tower: ['#c7ccd4', '#b9c0cc', '#d3c9bd'].map((c, i) =>
      facadeMat(`tower${i}`, c, 6, 12, 311 + i * 17, false, 0.65)),
    villa: ['#f0e6d2', '#e3d3b8'].map((c, i) =>
      facadeMat(`villa${i}`, c, 3, 2, 401 + i * 17, false, 0.35)),
    warehouse: facadeMat('wh', '#b9a98f', 2, 1, 501, false, 0.15),
    roofTerra: std(0xb0552f, { roughness: 0.9 }),
    roofSlate: std(0x3a4048, { roughness: 0.85, metalness: 0.15 }),
    crown: std(0x2c313a, { roughness: 0.8, metalness: 0.2 }),
    concrete: std(0xcfc4ae, { roughness: 0.95 }),
    metal: std(0x8a9098, { roughness: 0.5, metalness: 0.6 }),
    tank: std(0xe8e4da, { roughness: 0.7 }),
    door: std(0x2e3438, { roughness: 0.7, metalness: 0.3 }),
    awning: std(0xc0392b, { roughness: 0.8 }),
    awningStripe: [
      ['#c0392b', '#f2ede0'], ['#2e6fb0', '#f2ede0'], ['#b07a2a', '#5a3a1a'],
    ].map(([a, b]) => new THREE.MeshStandardMaterial({ map: stripedAwningTexture(a, b), roughness: 0.8, side: THREE.DoubleSide })),
    balcony: std(0xcfc4ae, { roughness: 0.95 }),
    rail: std(0x2c313a, { roughness: 0.5, metalness: 0.6 }),
    stripLit: new THREE.MeshStandardMaterial({ color: 0xffb45c, emissive: 0xff9a4d, emissiveIntensity: 2.2 }),
    beacon: new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2d2d, emissiveIntensity: 3 }),
  };

  // ---- District chunks: merged separately so a chunk is a handful of
  // draw calls no matter how many buildings it holds ----
  const chunks = {
    kumala: new THREE.Group(),
    pasaru: new THREE.Group(),
    lantawa: new THREE.Group(),
    lomboro: new THREE.Group(),
    banyan: new THREE.Group(),
  };

  // Shared rooftop-prop geometries (cloned per mesh by combineMeshes).
  const tankGeo = lathe([
    { x: 0.001, y: 0 }, { x: 0.85, y: 0 }, { x: 0.85, y: 1.2 },
    { x: 0.6, y: 1.5 }, { x: 0.001, y: 1.65 },
  ], 10);
  const antennaGeo = new THREE.CylinderGeometry(0.06, 0.09, 5, 6);

  function boxAt(chunk, mat, w, h, d, x, y, z, rotY = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rotY) m.rotation.y = rotY;
    m.castShadow = true;
    chunk.add(m);
    return m;
  }

  function meshAtRot(chunk, geo, mat, x, y, z, rotY = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rotY) m.rotation.y = rotY;
    m.castShadow = true;
    chunk.add(m);
    return m;
  }

  // Gable roof: a triangular side profile extruded along the depth, so
  // the ridge runs along the building instead of a flat box cap.
  function gableRoof(chunk, mat, w, d, rise, x, y, z, rotY = 0) {
    const depth = d + 0.8;
    const geo = profile([
      { x: -w / 2 - 0.4, y: 0 }, { x: 0, y: rise }, { x: w / 2 + 0.4, y: 0 },
    ], depth, 0.06);
    geo.translate(0, 0, -depth / 2);
    return meshAtRot(chunk, geo, mat, x, y, z, rotY);
  }

  // Rounded parapet / crown slab, slightly wider than the body below it.
  function slabCap(chunk, mat, w, h, d, x, y, z, rotY = 0) {
    const geo = roundedSlab(w, h, d, 0.25);
    geo.translate(0, 0, -d / 2);
    return meshAtRot(chunk, geo, mat, x, y, z, rotY);
  }

  function waterTank(chunk, x, y, z) {
    return meshAtRot(chunk, tankGeo, mats.tank, x, y, z);
  }

  function antenna(chunk, x, y, z, height) {
    const m = meshAtRot(chunk, antennaGeo, mats.metal, x, y, z);
    m.scale.y = height / 5;
    return m;
  }

  // ---- Archetype builders (all in local space, shopfront on +z) ----

  function shophouse(chunk, x, z, rotY) {
    const w = range(rng, 11, 13), d = range(rng, 9, 11), h = range(rng, 7, 10);
    boxAt(chunk, pick(rng, mats.shop), w, h, d, x, h / 2, z, rotY);
    gableRoof(chunk, mats.roofTerra, w, d, range(rng, 1.6, 2.4), x, h, z, rotY);
    const f = facing(rotY);
    // Sloped awning slab over the shopfront.
    const awGeo = new THREE.BoxGeometry(w * 0.8, 0.09, 1.5);
    awGeo.rotateX(-0.28);
    meshAtRot(chunk, awGeo, mats.awning,
      x + f.x * (d / 2 + 0.7), 3.1, z + f.z * (d / 2 + 0.7), rotY);
    // Painted shop sign above the awning.
    const i = Math.floor(rng() * SIGNS.length);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.8), signMat(SIGNS[i], SIGN_BG[i]));
    signMesh.position.set(x + f.x * (d / 2 + 0.07), h - 2.0, z + f.z * (d / 2 + 0.07));
    signMesh.rotation.y = rotY;
    chunk.add(signMesh);
    // R8: striped canvas awning over the existing awning slab.
    const stripeGeo = new THREE.BoxGeometry(w * 0.8, 0.05, 1.5);
    stripeGeo.rotateX(-0.28);
    meshAtRot(chunk, stripeGeo, pick(rng, mats.awningStripe),
      x + f.x * (d / 2 + 0.7), 3.22, z + f.z * (d / 2 + 0.7), rotY);
    // R8: upper-floor balcony slab + metal railing (top rail + posts).
    const balY = 3.9;
    boxAt(chunk, mats.balcony, w * 0.7, 0.18, 1.1,
      x + f.x * (d / 2 + 0.5), balY, z + f.z * (d / 2 + 0.5), rotY);
    const railZ = d / 2 + 1.0;
    boxAt(chunk, mats.rail, w * 0.7, 0.08, 0.08,
      x + f.x * railZ, balY + 1.0, z + f.z * railZ, rotY);
    for (let px = -w * 0.32; px <= w * 0.32; px += 1.6) {
      const perpX = Math.cos(rotY), perpZ = -Math.sin(rotY);
      boxAt(chunk, mats.rail, 0.06, 1.0, 0.06,
        x + f.x * railZ + perpX * px, balY + 0.5, z + f.z * railZ + perpZ * px, rotY);
    }
  }

  function midrise(chunk, x, z, rotY) {
    const w = range(rng, 18, 22), d = range(rng, 14, 18), h = range(rng, 14, 22);
    boxAt(chunk, pick(rng, mats.mid), w, h, d, x, h / 2, z, rotY);
    slabCap(chunk, mats.concrete, w + 0.8, 1.0, d + 0.8, x, h + 0.5, z, rotY);
    const f = facing(rotY);
    const floors = Math.max(2, Math.floor(h / 3.6));
    for (let i = 1; i < floors; i++) {
      const by = 1.2 + i * 3.4;
      if (by > h - 1) break;
      boxAt(chunk, mats.concrete, w * 0.7, 0.18, 1.1,
        x + f.x * (d / 2 + 0.5), by, z + f.z * (d / 2 + 0.5), rotY);
    }
    waterTank(chunk, x - w / 4, h + 1.0, z - d / 5);
    boxAt(chunk, mats.metal, 1.1, 0.7, 0.8, x + w / 4, h + 1.35, z + d / 5, rotY);
    boxAt(chunk, mats.metal, 0.9, 0.6, 0.7, x + w / 5, h + 1.3, z - d / 4, rotY);
  }

  function tower(chunk, x, z, rotY) {
    const w = range(rng, 20, 24), d = range(rng, 18, 22), h = range(rng, 30, 48);
    boxAt(chunk, pick(rng, mats.tower), w, h, d, x, h / 2, z, rotY);
    // Stepped crown: two rounded slabs, then plant + antenna on top.
    slabCap(chunk, mats.crown, w + 1.0, 1.4, d + 1.0, x, h + 0.7, z, rotY);
    slabCap(chunk, mats.crown, w * 0.55, 1.2, d * 0.55, x, h + 2.0, z, rotY);
    waterTank(chunk, x - w / 4, h + 1.4, z - d / 5);
    antenna(chunk, x + w / 4, h + 1.4 + range(rng, 2.5, 4), z + d / 5, range(rng, 5, 8));
    boxAt(chunk, mats.metal, 1.4, 0.9, 1.0, x + w / 5, h + 1.85, z + d / 4, rotY);
  }

  function landmarkTower(chunk) {
    // R8 landmark: lit tower on the avenue's east side, north of the
    // intersection (x 4, z -150; footprint x -4..12, z -157..-143 — clear
    // of the east shophouses at z -180/-120 and the inland towers).
    const x = 4, z = -150, w = 16, d = 14, h = 54;
    boxAt(chunk, facadeMat('landmark', '#b9a8c9', 6, 12, 911, false, 0.65), w, h, d, x, h / 2, z, 0);
    slabCap(chunk, mats.crown, w + 1.0, 1.4, d + 1.0, x, h + 0.7, z, 0);
    slabCap(chunk, mats.crown, w * 0.55, 1.2, d * 0.55, x, h + 2.0, z, 0);
    antenna(chunk, x + w / 4, h + 2.6 + 3, z + d / 5, 6);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), mats.beacon);
    beacon.position.set(x + w / 4, h + 2.6 + 6, z + d / 5);
    chunk.add(beacon);
    // Two warm lit vertical strips on the south face.
    for (const sx of [x - 4, x + 4]) {
      boxAt(chunk, mats.stripLit, 0.7, 40, 0.12, sx, 27, z + d / 2 + 0.06, 0);
    }
  }

  function warehouse(chunk, x, z, rotY) {
    const w = range(rng, 30, 36), d = range(rng, 20, 24), h = range(rng, 9, 12);
    boxAt(chunk, mats.warehouse, w, h, d, x, h / 2, z, rotY);
    gableRoof(chunk, mats.roofSlate, w, d, range(rng, 2.0, 3.0), x, h, z, rotY);
    const f = facing(rotY);
    // Wide sliding door on the front face.
    boxAt(chunk, mats.door, w * 0.45, h * 0.62, 0.18,
      x + f.x * (d / 2 + 0.05), (h * 0.62) / 2 + 0.1, z + f.z * (d / 2 + 0.05), rotY);
    boxAt(chunk, mats.metal, 1.2, 0.8, 0.9, x - w / 4, h + 0.4, z, rotY);
    boxAt(chunk, mats.metal, 1.0, 0.7, 0.8, x + w / 4, h + 0.35, z - d / 5, rotY);
  }

  function villa(chunk, x, z, rotY) {
    const w = range(rng, 14, 17), d = range(rng, 11, 14), h = range(rng, 5, 6.5);
    boxAt(chunk, pick(rng, mats.villa), w, h, d, x, h / 2, z, rotY);
    gableRoof(chunk, mats.roofTerra, w, d, range(rng, 2.2, 3.0), x, h, z, rotY);
    boxAt(chunk, mats.roofSlate, 0.7, 2.2, 0.7, x + w / 4, h + 1.6, z - d / 5, rotY);
    const f = facing(rotY);
    boxAt(chunk, mats.concrete, 3.2, 0.25, 1.6,
      x + f.x * (d / 2 + 0.7), 0.12, z + f.z * (d / 2 + 0.7), rotY);
  }

  // ---- Layout ----

  let buildings = 0;

  // Kumala Strand: shophouses flanking the avenue. East row faces west
  // (rotY -PI/2, fronts just off the curb at x ~2.5); west beachfront row
  // faces east toward the avenue, slotted between the umbrella rows
  // (z -10 dodges the kiosk at z 40 and the lifeguard stand at z -70).
  // West row sits at x -40 so even the gable eaves (depth/2 + 0.4) and
  // the shopfront awnings (depth/2 + 1.45) stay west of x -32.
  for (const z of [-240, -180, -120, -60, 60, 120, 180, 240]) {
    shophouse(chunks.kumala, 7.5, z, -Math.PI / 2);
    buildings++;
  }
  for (const z of [-240, -180, -120, -10, 120, 180, 240]) {
    shophouse(chunks.kumala, -40, z, Math.PI / 2);
    buildings++;
  }

  // Inland grid: block pitch 55, block centres at 27.5 + 55k. Footprints
  // stay inside their block, so the streets between blocks stay open.
  const XS = [27.5, 82.5, 137.5, 192.5];
  const ZS = [-247.5, -192.5, -137.5, -82.5, -27.5, 27.5, 82.5, 137.5, 192.5, 247.5];
  for (const xc of XS) {
    for (const zc of ZS) {
      // Market clear zone: skip any plot whose footprint would touch it.
      if (xc - 20 < MARKET.x1 && xc + 20 > MARKET.x0 &&
          zc - 16 < MARKET.z1 && zc + 16 > MARKET.z0) continue;
      const key = `${xc},${zc}`;
      let chunk = chunks.lantawa;
      let kind = 'midrise';
      let rotY = pick(rng, [0, Math.PI]);
      if (zc <= -192.5) { // Lomboro Wharf, z < -180
        kind = 'warehouse'; chunk = chunks.lomboro; rotY = 0;
      } else if (PASARU_PLOTS.has(key)) {
        kind = 'shophouse'; chunk = chunks.pasaru;
        rotY = xc >= 82.5 && zc >= MARKET.z0 && zc <= MARKET.z1 ? -Math.PI / 2
          : zc < 130 ? Math.PI : 0;
      } else if (xc >= 82.5 && zc < 60) { // Banyan Green
        kind = 'villa'; chunk = chunks.banyan;
        rotY = pick(rng, [0, Math.PI / 2, -Math.PI / 2, Math.PI]);
      } else if ((xc <= 27.5 && zc >= -137.5 && zc <= 27.5) ||
                 (xc >= 137.5 && zc >= 192.5)) {
        kind = 'tower'; // Lantawa Centre skyline
      }
      if (kind === 'warehouse') warehouse(chunk, xc, zc, rotY);
      else if (kind === 'shophouse') shophouse(chunk, xc, zc, rotY);
      else if (kind === 'villa') villa(chunk, xc, zc, rotY);
      else if (kind === 'tower') tower(chunk, xc, zc, rotY);
      else midrise(chunk, xc, zc, rotY);
      buildings++;
    }
  }

  // R8 landmark lit tower on the avenue's east side, north of the intersection.
  landmarkTower(chunks.kumala);
  buildings++;

  // ---- Merge each district chunk by material and attach ----
  for (const chunk of Object.values(chunks)) {
    chunk.updateMatrixWorld(true);
    for (const m of batchRigid(chunk)) {
      m.receiveShadow = true;
      m.castShadow = true;
      group.add(m);
    }
  }

  scene.add(group);

  const stats = { buildings, drawCalls: group.children.length };

  // Gentle golden-hour breathing on the lit windows: all facade materials
  // share this pulse so the avenue sparkles without per-mesh work.
  const glowMats = [...facadeCache.values()];
  function update(time) {
    const pulse = 0.5 + 0.12 * Math.sin(time * 0.8);
    for (const m of glowMats) m.emissiveIntensity = pulse;
  }

  return { group, update, stats };
}
