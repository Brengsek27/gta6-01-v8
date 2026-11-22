// game/src/city-market.js
// Pasaru market, Lomboro Wharf and Banyan Green park for "KIBERA RISING"
// — make.fun gta6-01, round 8. Original code written for this entry.
// Builds on the foundation (config, random, geometry, textures) and the
// vendored three.js r152, following the city-streets.js patterns.
//
// This module owns the market stalls, the wharf, the park and the ashfall
// ONLY: no ground, no palms, no lamps, no buildings (those live in
// city-streets.js / city-buildings.js). Static geometry is merged per
// district chunk with batchRigid(), so the module stays well under
// ~150 draw calls.

import * as THREEImport from '../vendor/three.min.js';
import { WORLD } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { profile, lathe, combineMeshes, batchRigid } from './geometry.js';
import { groundTexture } from './textures.js';

// The vendored three.min.js is a UMD build. Under an ESM loader it either
// arrives as the `default` export (CJS interop) or attaches itself to
// globalThis.THREE as a side effect. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

const MARKET = { x: 33, z: 130 }; // Pasaru market centre
const AWNING_COLOURS = ['#c0392b', '#e8a13a', '#3f8f5f', '#2e6fb0', '#7a4a8a', '#e86a8a'];
const GOODS_COLOURS = [0xe8543f, 0xf2c230, 0x7ac74f, 0xe87a2a, 0x9a4a8a, 0xd84a2a];

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
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

function flat(w, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  return m;
}

export function buildMarket(scene, fx, seed = 1337, opts = {}) {
  const rng = mulberry32(seed + 77);
  const group = new THREE.Group();
  group.name = 'city-market';
  // fx is reserved for a later effects pass; this module owns its own
  // glow (festoon bulbs) and ashfall, so it does not touch fx.
  void fx;

  const compact = !!opts.compact;

  // ---- Shared materials (one object per look, so batchRigid can merge
  // every mesh sharing it into a single draw call per chunk) ----
  const woodMat = std(0x8a6a4a, { roughness: 0.9 });
  const woodDarkMat = std(0x6a4a32, { roughness: 0.9 });
  const crateMat = std(0xa8845a, { roughness: 0.95 });
  const sackMat = std(0xc9b184, { roughness: 1 });
  const poleMat = std(0x5a4632, { roughness: 0.9 });
  const whiteMat = std(0xf2ede0, { roughness: 0.8, side: THREE.DoubleSide });
  const awningMats = AWNING_COLOURS.map((c) => std(c, { roughness: 0.8, side: THREE.DoubleSide }));
  const goodsMats = GOODS_COLOURS.map((c) => std(c, { roughness: 0.6 }));
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x554422, emissive: 0xffc98a, emissiveIntensity: 1.8,
  });
  const leafMat = std(0x2f7a3d, { roughness: 1, side: THREE.DoubleSide });
  const leafDarkMat = std(0x256b32, { roughness: 1, side: THREE.DoubleSide });
  const trunkMat = std(0x6a4a32, { roughness: 1 });
  const benchMat = std(0x7a5a3a, { roughness: 0.9 });
  const ironMat = std(0x2c313a, { roughness: 0.6, metalness: 0.5 });
  const hullMats = [std(0x8a4a2a, { roughness: 0.8 }), std(0x2e6fb0, { roughness: 0.8 }),
    std(0xe8e4da, { roughness: 0.8 })];
  const sailMat = std(0xf2ede0, { roughness: 0.9, side: THREE.DoubleSide });

  // ---- District chunks: merged separately so a chunk is a handful of
  // draw calls no matter how many stalls, crates or trees it holds ----
  const marketChunk = new THREE.Group();
  const wharfChunk = new THREE.Group();
  const parkChunk = new THREE.Group();

  // Market ground: worn paving under the stalls, just above the asphalt.
  try {
    const tex = groundTexture('market', seed + 5);
    if (tex && tex.isTexture) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 6);
    }
    group.add(flat(30, 46,
      new THREE.MeshStandardMaterial({ map: tex || null, color: 0xd8cabb, roughness: 0.95 }),
      MARKET.x, 0.03, MARKET.z));
  } catch (err) {
    group.add(flat(30, 46, std(0x8a7a6f, { roughness: 0.95 }), MARKET.x, 0.03, MARKET.z));
  }

  // ---- S5: darker aisle runners + warm light pools ----
  // Break up the flat orange ground wash: a dark runner down each aisle
  // and warm additive pools under the festoon strings.
  const runnerMat = std(0x6a4a38, { roughness: 0.95 });
  for (const ax of [26, 40]) {
    group.add(flat(3.4, 40, runnerMat, ax, 0.06, 130));
  }
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,170,90,0.85)');
    g.addColorStop(1, 'rgba(255,170,90,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  for (const [px, pz] of [[26, 120], [40, 120], [26, 128], [40, 128], [26, 136], [40, 136], [33, 124], [33, 132]]) {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 4),
      new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(px, 0.07, pz);
    group.add(p);
  }

  // ---- 1. Pasaru market: two aisles of stalls (x 20..46, z 110..150) ----
  // Aisle 1 runs along x ~26, aisle 2 along x ~40; stalls flank each
  // aisle on both sides and face into it. Stall rows at x 23.5 / 29 and
  // x 37 / 43, five stalls a row at z 114..144.
  const stallRows = [
    { x: 23.5, face: 1 }, { x: 29, face: -1 },
    { x: 37, face: 1 }, { x: 43, face: -1 },
  ];
  const stallZs = [114, 121.5, 129, 136.5, 144];
  const goodsGeo = new THREE.SphereGeometry(0.17, 8, 6);
  const sackGeo = new THREE.SphereGeometry(0.55, 10, 8);
  sackGeo.scale(1, 0.62, 1);
  const bulbGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const bulbList = [];
  const goodsByMat = goodsMats.map(() => []);
  const crateList = [];
  const sackList = [];

  for (const row of stallRows) {
    for (const sz of stallZs) {
      const awn = pick(rng, awningMats);
      // Counter facing the aisle.
      const counter = box(2.6, 1.0, 1.4, woodMat);
      counter.position.set(row.x, 0.5, sz);
      marketChunk.add(counter);
      const top = box(2.7, 0.08, 1.5, woodDarkMat);
      top.position.set(row.x, 1.04, sz);
      marketChunk.add(top);
      // Four poles + a sloped striped awning.
      for (const [px, pz] of [[-1.3, -0.85], [1.3, -0.85], [-1.3, 0.85], [1.3, 0.85]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), poleMat);
        pole.position.set(row.x + px, 1.2, sz + pz);
        marketChunk.add(pole);
      }
      const awnBase = box(3.0, 0.07, 1.9, awn);
      awnBase.position.set(row.x, 2.45, sz);
      awnBase.rotation.x = row.face * 0.12;
      marketChunk.add(awnBase);
      for (let i = 0; i < 3; i++) {
        const stripe = box(3.04, 0.08, 0.3, whiteMat);
        stripe.position.set(row.x, 2.5, sz - 0.62 + i * 0.62);
        stripe.rotation.x = row.face * 0.12;
        marketChunk.add(stripe);
      }
      // Goods: a crate of bright fruit / vegetables on the counter.
      const crate = box(1.1, 0.35, 0.8, crateMat);
      crate.position.set(row.x - 0.5, 1.25, sz + range(rng, -0.3, 0.3));
      crate.rotation.y = range(rng, -0.3, 0.3);
      crateList.push(crate);
      const gm = Math.floor(rng() * goodsMats.length);
      for (let g = 0; g < 8; g++) {
        const fruit = new THREE.Mesh(goodsGeo, goodsMats[gm]);
        fruit.position.set(
          row.x - 0.5 + range(rng, -0.4, 0.4), 1.48,
          sz + range(rng, -0.25, 0.25));
        goodsByMat[gm].push(fruit);
      }
      // A second pile straight on the counter top.
      const gm2 = Math.floor(rng() * goodsMats.length);
      for (let g = 0; g < 5; g++) {
        const fruit = new THREE.Mesh(goodsGeo, goodsMats[gm2]);
        fruit.position.set(
          row.x + 0.7 + range(rng, -0.35, 0.35), 1.2,
          sz + range(rng, -0.4, 0.4));
        goodsByMat[gm2].push(fruit);
      }
    }
  }
  // Crates and sacks stacked at the back of each aisle.
  // S5: kept to the aisle backs (z 112-125) and outer edges (x 21.5 /
  // 44.5) only — stacks at x 31.5/35, z 133-140 sat right in front of
  // the staged market camera and read as huge bare brown boxes.
  for (let i = 0; i < 10; i++) {
    const cx = pick(rng, [21.5, 44.5]);
    const cz = 112 + (i % 5) * 3.2 + range(rng, -1, 1);
    const crate = box(0.95, 0.95, 0.95, crateMat);
    crate.position.set(cx, 0.48, cz);
    crate.rotation.y = range(rng, 0, Math.PI);
    crateList.push(crate);
    if (i % 3 === 0) {
      const top = box(0.8, 0.8, 0.8, crateMat);
      top.position.set(cx, 1.35, cz);
      top.rotation.y = range(rng, 0, Math.PI);
      crateList.push(top);
    }
    const sack = new THREE.Mesh(sackGeo, sackMat);
    sack.position.set(cx + range(rng, -1.5, 1.5), 0.34, cz + range(rng, -1, 1));
    sack.rotation.y = range(rng, 0, Math.PI);
    sackList.push(sack);
  }
  const crates = mergedMesh(crateList, crateMat);
  if (crates) marketChunk.add(crates);
  const sacks = mergedMesh(sackList, sackMat);
  if (sacks) marketChunk.add(sacks);
  goodsByMat.forEach((list, i) => {
    const m = mergedMesh(list, goodsMats[i]);
    if (m) marketChunk.add(m);
  });

  // Festoon bulb strings: catenary sags strung across both aisles, plus
  // one along each aisle. Poles at the market corners hold them up.
  const festoonPoles = [];
  for (const [px, pz] of [[21, 111], [45, 111], [21, 149], [45, 149], [33, 111], [33, 149]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 8), poleMat);
    pole.position.set(px, 1.8, pz);
    festoonPoles.push(pole);
  }
  const fPoles = mergedMesh(festoonPoles, poleMat);
  if (fPoles) marketChunk.add(fPoles);
  function festoon(a, b, sag) {
    const n = Math.max(4, Math.floor(a.distanceTo(b) / 1.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= sag * 4 * t * (1 - t); // catenary sag
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.copy(p);
      bulbList.push(bulb);
    }
  }
  for (const fz of [116, 124, 132, 140, 147]) {
    festoon(new THREE.Vector3(21, 3.5, fz), new THREE.Vector3(45, 3.5, fz), 0.8);
  }
  festoon(new THREE.Vector3(26, 3.5, 112), new THREE.Vector3(26, 3.5, 148), 0.7);
  festoon(new THREE.Vector3(40, 3.5, 112), new THREE.Vector3(40, 3.5, 148), 0.7);
  const bulbs = mergedMesh(bulbList, bulbMat);
  if (bulbs) marketChunk.add(bulbs);

  // ---- 2. Lomboro Wharf (z < -180): basin, crane, moored boats ----
  group.add(flat(95, 92,
    new THREE.MeshStandardMaterial({ color: WORLD.seaColor, roughness: 0.25, metalness: 0.1 }),
    -12, 0.05, -231));
  // Quay edge along the basin's east side.
  const quay = box(2, 0.5, 92, std(0x9a8a76, { roughness: 0.95 }));
  quay.position.set(36, 0.25, -231);
  wharfChunk.add(quay);
  // Crane silhouette: two legs, mast, jib and counter-jib, hook cable.
  const craneParts = [];
  for (const [lx, lz] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) {
    const leg = box(0.5, 9, 0.5, ironMat);
    leg.position.set(-5 + lx, 4.5, -215 + lz);
    craneParts.push(leg);
  }
  const mast = box(1.0, 14, 1.0, ironMat);
  mast.position.set(-5, 12, -215);
  craneParts.push(mast);
  const jib = box(16, 0.7, 0.7, ironMat);
  jib.position.set(-13, 18.5, -215);
  jib.rotation.z = 0.12;
  craneParts.push(jib);
  const counterJib = box(6, 0.7, 0.7, ironMat);
  counterJib.position.set(2, 18.2, -215);
  counterJib.rotation.z = -0.1;
  craneParts.push(counterJib);
  const cab = box(2.2, 1.8, 2.0, ironMat);
  cab.position.set(-5, 16.5, -215);
  craneParts.push(cab);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 7, 6), ironMat);
  cable.position.set(-19, 15, -215);
  craneParts.push(cable);
  const hook = box(0.7, 0.7, 0.7, ironMat);
  hook.position.set(-19, 11.2, -215);
  craneParts.push(hook);
  const crane = mergedMesh(craneParts, ironMat);
  if (crane) wharfChunk.add(crane);
  // Wharf crates stacked near the crane.
  const wharfCrates = [];
  for (let i = 0; i < 12; i++) {
    const w = 0.9 + range(rng, 0, 0.5);
    const c = box(w, w, w, crateMat);
    c.position.set(8 + (i % 4) * 1.6, w / 2 + Math.floor(i / 4) * 1.1, -205 - Math.floor(i / 4) * 2.2);
    c.rotation.y = range(rng, 0, Math.PI);
    wharfCrates.push(c);
  }
  const wCrates = mergedMesh(wharfCrates, crateMat);
  if (wCrates) wharfChunk.add(wCrates);
  // Moored boats: extruded hull profile, mast, triangular sail.
  const hullProfile = [
    { x: -2.4, y: 0.9 }, { x: -1.8, y: 0 }, { x: 0, y: -0.5 },
    { x: 1.8, y: 0 }, { x: 2.4, y: 0.9 }, { x: 2.4, y: 1.1 },
    { x: -2.4, y: 1.1 },
  ];
  const hullGeo = profile(hullProfile, 2.0, 0.05);
  hullGeo.translate(0, 0, -1.0);
  const sailGeo = profile([{ x: 0, y: 0 }, { x: 0, y: 3.4 }, { x: 1.9, y: 0 }], 0.06, 0);
  sailGeo.translate(0, 0, -0.03);
  const boatSpots = [[-35, -210, 0.4], [-18, -245, -0.5], [2, -235, 1.1]];
  boatSpots.forEach(([bx, bz, rotY], i) => {
    const hull = new THREE.Mesh(hullGeo, hullMats[i % hullMats.length]);
    hull.position.set(bx, 0.35, bz);
    hull.rotation.y = rotY;
    hull.castShadow = true;
    wharfChunk.add(hull);
    const mastB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), poleMat);
    mastB.position.set(bx, 2.4, bz);
    wharfChunk.add(mastB);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(bx, 1.5, bz);
    sail.rotation.y = rotY;
    wharfChunk.add(sail);
  });

  // ---- 3. Banyan Green park (x > 60, z < 60): trees, paths, benches ----
  group.add(flat(9, 104,
    new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1 }), 66, 0.04, 0));
  // Pale paths: one along the strip, one crossing it at the hero line.
  group.add(flat(3, 104, std(0xcfc4ae, { roughness: 0.95 }), 66, 0.05, 0));
  group.add(flat(9, 3, std(0xcfc4ae, { roughness: 0.95 }), 66, 0.05, 0));
  const canopyPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(1.4, 0.1),
    new THREE.Vector2(2.4, 0.9),
    new THREE.Vector2(2.6, 1.8),
    new THREE.Vector2(1.9, 2.6),
    new THREE.Vector2(0.001, 3.0),
  ];
  const canopyGeo = lathe(canopyPts, 10);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3.2, 8);
  const trunkList = [];
  const canopyList = [];
  const benchList = [];
  for (let z = -48; z <= 48; z += 12) {
    const tx = 64 + range(rng, -1, 1);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(tx, 1.6, z + range(rng, -2, 2));
    trunkList.push(trunk);
    const canopy = new THREE.Mesh(canopyGeo, z % 24 === 0 ? leafMat : leafDarkMat);
    canopy.position.set(tx, 3.0, z + range(rng, -2, 2));
    canopy.scale.setScalar(range(rng, 0.9, 1.3));
    canopyList.push(canopy);
  }
  // Three broad feature banyans with wide canopies.
  for (const [bx, bz] of [[68, -30], [64, 0], [68, 30]]) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(bx, 1.6, bz);
    trunk.scale.set(1.4, 1.2, 1.4);
    trunkList.push(trunk);
    const canopy = new THREE.Mesh(canopyGeo, leafMat);
    canopy.position.set(bx, 3.4, bz);
    canopy.scale.setScalar(1.9);
    canopyList.push(canopy);
  }
  const trunks = mergedMesh(trunkList, trunkMat);
  if (trunks) parkChunk.add(trunks);
  const canopies = mergedMesh(canopyList.filter((c) => c.material === leafMat), leafMat);
  if (canopies) parkChunk.add(canopies);
  const canopiesDark = mergedMesh(canopyList.filter((c) => c.material === leafDarkMat), leafDarkMat);
  if (canopiesDark) parkChunk.add(canopiesDark);
  // Benches facing the path, one per tree gap.
  for (let z = -42; z <= 42; z += 14) {
    const seat = box(1.8, 0.12, 0.55, benchMat);
    seat.position.set(68.5, 0.55, z);
    benchList.push(seat);
    const back = box(1.8, 0.6, 0.1, benchMat);
    back.position.set(68.5, 0.95, z - 0.28);
    benchList.push(back);
    for (const bx of [-0.7, 0.7]) {
      const leg = box(0.1, 0.55, 0.5, ironMat);
      leg.position.set(68.5 + bx, 0.28, z);
      benchList.push(leg);
    }
  }
  const benches = mergedMesh(benchList.filter((b) => b.material === benchMat), benchMat);
  if (benches) parkChunk.add(benches);
  const benchLegs = mergedMesh(benchList.filter((b) => b.material === ironMat), ironMat);
  if (benchLegs) parkChunk.add(benchLegs);

  // ---- Merge each district chunk by material and attach ----
  for (const chunk of [marketChunk, wharfChunk, parkChunk]) {
    chunk.updateMatrixWorld(true);
    for (const m of batchRigid(chunk)) {
      m.receiveShadow = true;
      m.castShadow = true;
      group.add(m);
    }
  }

  // ---- 4. Ashfall: golden-backlit drifting motes over the whole city ----
  const moteCount = compact ? 160 : 320;
  const positions = new Float32Array(moteCount * 3);
  const baseX = new Float32Array(moteCount);
  const baseZ = new Float32Array(moteCount);
  const speeds = new Float32Array(moteCount);
  const phases = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    baseX[i] = range(rng, -60, 230);
    baseZ[i] = range(rng, -275, 275);
    positions[i * 3] = baseX[i];
    positions[i * 3 + 1] = range(rng, 0.5, 28);
    positions[i * 3 + 2] = baseZ[i];
    speeds[i] = range(rng, 0.25, 0.7);
    phases[i] = range(rng, 0, Math.PI * 2);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xffc46b, size: 0.32, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.name = 'ashfall';
  group.add(motes);

  scene.add(group);

  const stats = { drawCalls: group.children.length, motes: moteCount };

  // Per-frame animation: ashfall drifts down and sways; festoon bulbs
  // breathe with the golden hour.
  function update(time, dt, camera) {
    void camera;
    const pos = moteGeo.getAttribute('position');
    const arr = pos.array;
    for (let i = 0; i < moteCount; i++) {
      let y = arr[i * 3 + 1] - speeds[i] * dt;
      if (y < 0.2) y = 26 + (i % 7);
      arr[i * 3 + 1] = y;
      arr[i * 3] = baseX[i] + Math.sin(time * 0.3 + phases[i]) * 1.5;
    }
    pos.needsUpdate = true;
    bulbMat.emissiveIntensity = 1.6 + 0.5 * Math.sin(time * 2.2);
  }

  return { group, update, market: { ...MARKET }, stats };
}
