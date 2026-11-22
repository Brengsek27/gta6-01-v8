// game/src/menuscene.js
// Night menu backdrop for "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. A self-contained scene: detailed
// foreground rooftops, dense lit mid-rise facades, three neon billboards,
// sagging power lines, a bay water strip with neon reflections, and rain.
// Palette: deep blue night with neon; ambient raised so rooftops read.

import * as THREEImport from '../vendor/three.min.js';
import { mulberry32 } from './random.js';

// The vendored three.min.js is a UMD build. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

/** Canvas texture with a glowing text line (transparent background). */
function neonTextTexture(text, color, w = 512, h = 128, font = 'bold 64px "Arial Narrow", sans-serif') {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 2);
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Facade texture pair: diffuse walls + emissive windows-only map. */
function facadePair(seed, cols, rows) {
  const rng = mulberry32(seed);
  const w = 256;
  const h = 512;
  const base = document.createElement('canvas');
  base.width = w; base.height = h;
  const emis = document.createElement('canvas');
  emis.width = w; emis.height = h;
  const b = base.getContext('2d');
  const e = emis.getContext('2d');
  b.fillStyle = '#141c2c';
  b.fillRect(0, 0, w, h);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, w, h);
  const warm = ['#ffd28a', '#ffb35c', '#ff9a4d'];
  const cool = ['#7fd4e8', '#bfe8ff', '#9fd8c8'];
  const cw = w / cols;
  const ch = h / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = c * cw + 4;
      const y = r * ch + 5;
      const ww = cw - 8;
      const hh = ch - 10;
      b.fillStyle = '#1d2839';
      b.fillRect(x, y, ww, hh);
      if (rng() < (r >= rows - 4 ? 0.9 : 0.68)) { // S5: low rows (bottom of the frame) lit much more often
        const col = rng() < 0.62 ? warm[(rng() * warm.length) | 0] : cool[(rng() * cool.length) | 0];
        b.fillStyle = col;
        b.fillRect(x, y, ww, hh);
        e.fillStyle = col;
        e.fillRect(x, y, ww, hh);
      }
    }
  }
  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emis);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

export function makeMenuScene() {
  const rng = mulberry32(20261122);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1226);
  scene.fog = new THREE.FogExp2(0x0a1226, 0.011);

  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 400);
  camera.position.set(0, 5.5, 34);
  camera.lookAt(0, 7.5, -30);

  // Lush night light: raised ambient + cool moon + neon point lights.
  scene.add(new THREE.AmbientLight(0x4a5a7a, 1.5)); // S5: 1.15 -> 1.5, brightens the dark rooftop mass
  const moon = new THREE.DirectionalLight(0x8fb4ff, 0.7);
  moon.position.set(-30, 50, 20);
  scene.add(moon);
  const rim = new THREE.DirectionalLight(0xff9a6b, 0.35);
  rim.position.set(20, 12, -10);
  scene.add(rim);
  // S5: warm low light over the foreground rooftops so the lower half
  // of the frame stops reading as an empty dark mass.
  const warmLow = new THREE.PointLight(0xffb35c, 1.1, 42, 1.6);
  warmLow.position.set(0, 7, 16);
  scene.add(warmLow);
  // S5b: warm fill from the camera side — the rooftop front faces
  // (south-facing, away from moon and rim) were still near-black.
  const fill = new THREE.DirectionalLight(0xffc98a, 0.55);
  fill.position.set(0, 12, 40);
  scene.add(fill);

  const mats = {
    roofDark: new THREE.MeshLambertMaterial({ color: 0x1a2233 }),
    roofMid: new THREE.MeshLambertMaterial({ color: 0x232c40 }),
    roofWarm: new THREE.MeshLambertMaterial({ color: 0x2e2a26 }),
    tank: new THREE.MeshLambertMaterial({ color: 0x3a4a5e }),
    metal: new THREE.MeshLambertMaterial({ color: 0x4a5568 }),
    dark: new THREE.MeshLambertMaterial({ color: 0x0e1420 }),
    pole: new THREE.MeshLambertMaterial({ color: 0x11161f }),
    crate: new THREE.MeshLambertMaterial({ color: 0x5a4632 }),
  };

  const group = new THREE.Group();
  group.name = 'menu-backdrop';
  scene.add(group);

  // ---- foreground rooftop cluster (z 6..20, heights 4..9) ----
  const clothColors = [0xe85d4a, 0x1f9e8e, 0xe0a92c, 0x7fb4e8, 0xc86bb0];
  const beacons = [];
  const clothQuads = [];
  const rooftops = [
    { x: -14, z: 12, w: 12, h: 6.5, d: 9, mat: mats.roofDark },
    { x: -2, z: 9, w: 10, h: 8.5, d: 8, mat: mats.roofMid },
    { x: 9, z: 13, w: 11, h: 5.5, d: 9, mat: mats.roofWarm },
    { x: 19, z: 10, w: 9, h: 7.5, d: 8, mat: mats.roofDark },
    { x: -7, z: 19, w: 9, h: 4.5, d: 7, mat: mats.roofMid },
    { x: 15, z: 19, w: 8, h: 4, d: 7, mat: mats.roofWarm },
    { x: -24, z: 14, w: 9, h: 5, d: 8, mat: mats.roofDark },
  ];
  for (const r of rooftops) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, r.d), r.mat);
    box.position.set(r.x, r.h / 2, r.z);
    group.add(box);
    // Parapet edges.
    const p = 0.18;
    const ph = 0.5;
    const mkParapet = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, ph, d), mats.metal);
      m.position.set(x, r.h + ph / 2 - 0.05, z);
      group.add(m);
    };
    mkParapet(r.w, p, r.x, r.z - r.d / 2 + p / 2);
    mkParapet(r.w, p, r.x, r.z + r.d / 2 - p / 2);
    mkParapet(p, r.d, r.x - r.w / 2 + p / 2, r.z);
    mkParapet(p, r.d, r.x + r.w / 2 - p / 2, r.z);
    // Water tank on legs.
    const tx = r.x + (rng() - 0.5) * (r.w - 3);
    const tz = r.z + (rng() - 0.5) * (r.d - 3);
    for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), mats.metal);
      leg.position.set(tx + lx, r.h + 0.45, tz + lz);
      group.add(leg);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.5, 12), mats.tank);
    tank.position.set(tx, r.h + 1.65, tz);
    group.add(tank);
    const tankTop = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 12), mats.metal);
    tankTop.position.set(tx, r.h + 2.65, tz);
    group.add(tankTop);
    // AC box with fan disc.
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), mats.metal);
    ac.position.set(r.x + (rng() - 0.5) * (r.w - 2), r.h + 0.28, r.z + (rng() - 0.5) * (r.d - 2));
    ac.rotation.y = rng() * Math.PI;
    group.add(ac);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), new THREE.MeshBasicMaterial({ color: 0x0a0f18, side: THREE.DoubleSide }));
    fan.position.set(ac.position.x, ac.position.y + 0.29, ac.position.z);
    fan.rotation.x = -Math.PI / 2;
    group.add(fan);
    // Crates.
    for (let k = 0; k < 2; k++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mats.crate);
      crate.position.set(r.x + (rng() - 0.5) * (r.w - 2.5), r.h + 0.35, r.z + (rng() - 0.5) * (r.d - 2.5));
      crate.rotation.y = rng() * Math.PI;
      group.add(crate);
    }
    // Laundry line with colored cloth quads.
    const lineY = r.h + 1.6;
    const x0 = r.x - r.w / 2 + 0.6;
    const x1 = r.x + r.w / 2 - 0.6;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, x1 - x0, 4), mats.pole);
    line.rotation.z = Math.PI / 2;
    line.position.set((x0 + x1) / 2, lineY, r.z + (rng() - 0.5) * 2);
    group.add(line);
    for (let k = 0; k < 3; k++) {
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.9),
        new THREE.MeshLambertMaterial({ color: clothColors[(rng() * clothColors.length) | 0], side: THREE.DoubleSide }),
      );
      cloth.position.set(x0 + 1 + k * 1.6, lineY - 0.45, line.position.z);
      cloth.userData.sway = rng() * Math.PI * 2;
      group.add(cloth);
      clothQuads.push(cloth);
    }
  }
  // Antenna masts with blinking red lights (on the two tallest roofs).
  for (const [ax, az, ah] of [[-2, 9, 8.5], [19, 10, 7.5]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.2, 6), mats.metal);
    mast.position.set(ax, ah + 2.1, az);
    group.add(mast);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.05), mats.metal);
    cross.position.set(ax, ah + 3.4, az);
    group.add(cross);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    beacon.position.set(ax, ah + 4.3, az);
    group.add(beacon);
    beacons.push(beacon);
  }

  // Neon 'KIBERA' wall sign on the tallest rooftop face.
  const kiberaTex = neonTextTexture('KIBERA', '#57e6d9', 512, 128, 'bold 72px "Arial Narrow", sans-serif');
  const kiberaSign = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 1.75),
    new THREE.MeshBasicMaterial({ map: kiberaTex, transparent: true, depthWrite: false }),
  );
  kiberaSign.position.set(-2, 7.2, 4.9);
  group.add(kiberaSign);
  const kiberaGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, 2.6),
    new THREE.MeshBasicMaterial({ map: kiberaTex, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  kiberaGlow.position.set(-2, 7.2, 4.85);
  group.add(kiberaGlow);
  // Wet-rooftop light pools under the signs.
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(120,230,220,0.55)');
    g.addColorStop(1, 'rgba(120,230,220,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  for (const [px, pz, s, tint] of [[-2, 6.5, 6, 0x57e6d9], [9, 14, 5, 0xffb35c]]) {
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s * 0.7),
      new THREE.MeshBasicMaterial({ map: poolTex, color: tint, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(px, 8.56, pz);
    group.add(pool);
  }

  // ---- mid-rise silhouettes with DENSE lit windows ----
  const midrises = [
    { x: -30, z: -18, w: 14, h: 26, d: 12, seed: 11 },
    { x: -12, z: -30, w: 16, h: 34, d: 12, seed: 23 },
    { x: 8, z: -24, w: 13, h: 22, d: 11, seed: 37 },
    { x: 26, z: -32, w: 15, h: 30, d: 12, seed: 51 },
    { x: 42, z: -16, w: 12, h: 20, d: 10, seed: 67 },
    { x: -44, z: -34, w: 13, h: 24, d: 11, seed: 83 },
    { x: 0, z: -48, w: 20, h: 18, d: 12, seed: 97 },
  ];
  for (const m of midrises) {
    const { map, emissiveMap } = facadePair(m.seed, 7, 14);
    const mat = new THREE.MeshLambertMaterial({
      map, emissive: 0xffffff, emissiveMap, emissiveIntensity: 0.85, color: 0xffffff,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(m.w, m.h, m.d), mat);
    mesh.position.set(m.x, m.h / 2, m.z);
    group.add(mesh);
    // Roof rim: a thin lit edge strip so the silhouette reads.
    const rimStrip = new THREE.Mesh(
      new THREE.BoxGeometry(m.w + 0.3, 0.25, m.d + 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2a3a55 }),
    );
    rimStrip.position.set(m.x, m.h + 0.1, m.z);
    group.add(rimStrip);
  }

  // ---- three free-standing neon billboards ----
  // S5: bigger, closer, and placed so two of them land in the free
  // centre-right gap (x 560-770 on screen) between the title and the
  // data-slate instead of hiding behind the title / mid-rises: magenta
  // in front of the (8,-24) mid-rise at (2,20,-16), amber above it at
  // (4,32,-34); teal stays left, enlarged.
  // S5b: narrowed (w 20) and centred on the gap after the first capture
  // showed both right ends clipped by the data-slate.
  const billboards = [
    { x: -30, y: 30, z: -44, color: '#57e6d9', w: 24 },
    { x: 2, y: 20, z: -16, color: '#ff4fd8', w: 20 },
    { x: 4, y: 32, z: -34, color: '#ffb35c', w: 20 },
  ];
  const reflectionStreaks = [];
  for (const b of billboards) {
    const tex = neonTextTexture('KIBERA RISING', b.color, 1024, 192, 'bold 84px "Arial Narrow", sans-serif');
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(b.w, b.w * 0.19),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    board.position.set(b.x, b.y, b.z);
    group.add(board);
    const glowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(b.w * 1.5, b.w * 0.42),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), // S5: 0.22 -> 0.35
    );
    glowPlane.position.set(b.x, b.y, b.z - 0.4);
    group.add(glowPlane);
    // Support poles.
    for (const px of [-b.w / 2 + 1, b.w / 2 - 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, b.y - 2, 6), mats.pole);
      pole.position.set(b.x + px, (b.y - 2) / 2, b.z);
      group.add(pole);
    }
    // Neon point light for rim light on the rooftops.
    const light = new THREE.PointLight(new THREE.Color(b.color), 1.4, 55, 1.6);
    light.position.set(b.x, b.y, b.z + 6);
    scene.add(light);
    // Reflection streak (added to the water strip below).
    // S5b: z 30 -> 21 — the camera looks slightly up, so anything at
    // z > 23 is below the frame; the streaks must sit at the water's
    // far edge to show along the bottom.
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 7),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(b.color), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), // S5: 0.4 -> 0.55
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(b.x, 0.06, 21);
    streak.userData.baseOpacity = 0.55; // S5: 0.4 -> 0.55
    streak.userData.phase = rng() * Math.PI * 2;
    group.add(streak);
    reflectionStreaks.push(streak);
  }

  // ---- sagging power lines between poles crossing the frame ----
  const polePositions = [[-26, 0], [-8, 2], [10, 0], [26, 3]];
  for (const [px, pz] of polePositions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 9, 6), mats.pole);
    pole.position.set(px, 4.5, pz);
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), mats.pole);
    arm.position.set(px, 8.6, pz);
    group.add(arm);
  }
  const lineMat = new THREE.LineBasicMaterial({ color: 0x05070c });
  for (let i = 0; i < polePositions.length - 1; i++) {
    const [x0, z0] = polePositions[i];
    const [x1, z1] = polePositions[i + 1];
    for (const dy of [0, -0.5]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x0 - 0.9, 8.6 + dy, z0),
        new THREE.Vector3((x0 + x1) / 2, 7.1 + dy, (z0 + z1) / 2),
        new THREE.Vector3(x1 + 0.9, 8.6 + dy, z1),
      );
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
      group.add(new THREE.Line(geo, lineMat));
    }
  }

  // ---- bay water strip along the bottom of the frame ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 22),
    new THREE.MeshLambertMaterial({ color: 0x16324e }), // S5: 0x0a1a2e -> brighter bay water
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, 32);
  group.add(water);
  // Extra long reflection streaks on the water. S5: longer + brighter.
  // S5b: moved to the water's far edge (z 20-23) — see note above.
  for (let i = 0; i < 8; i++) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5 + rng() * 1.5, 4 + rng() * 3),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(['#57e6d9', '#ff4fd8', '#ffb35c'][(rng() * 3) | 0]),
        transparent: true, opacity: 0.35 + rng() * 0.25, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(-30 + rng() * 60, 0.05, 20 + rng() * 3);
    streak.userData.baseOpacity = streak.material.opacity;
    streak.userData.phase = rng() * Math.PI * 2;
    group.add(streak);
    reflectionStreaks.push(streak);
  }

  // ---- fine rain streaks (instanced thin quads, recycled) ----
  const RAIN = 420;
  const rainGeo = new THREE.PlaneGeometry(0.03, 0.9); // S5: 0.02x0.7 -> thicker, more visible
  const rainMat = new THREE.MeshBasicMaterial({ color: 0x9fc8e8, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide }); // S5: 0.35 -> 0.55 -> 0.65
  const rain = new THREE.InstancedMesh(rainGeo, rainMat, RAIN);
  rain.frustumCulled = false;
  const rainState = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < RAIN; i++) {
    rainState.push({
      x: -40 + rng() * 80,
      y: rng() * 30,
      z: -50 + rng() * 90,
      speed: 9 + rng() * 7,
    });
  }
  group.add(rain);

  function updateRain(dt) {
    for (let i = 0; i < RAIN; i++) {
      const r = rainState[i];
      r.y -= r.speed * dt;
      if (r.y < 0) {
        r.y = 26 + rng() * 6;
        r.x = -40 + rng() * 80;
        r.z = -50 + rng() * 90;
      }
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(0.12, 0, 0.06);
      dummy.updateMatrix();
      rain.setMatrixAt(i, dummy.matrix);
    }
    rain.instanceMatrix.needsUpdate = true;
  }

  function update(time, dt) {
    // Slow camera drift.
    camera.position.x = Math.sin(time * 0.05) * 1.6;
    camera.position.y = 5.5 + Math.sin(time * 0.11) * 0.35;
    camera.lookAt(0, 7.5, -30);
    // Blinking antenna beacons.
    const on = (time % 1.4) < 0.85;
    for (const bcn of beacons) bcn.visible = on;
    // Shimmering neon reflections.
    for (const s of reflectionStreaks) {
      s.material.opacity = s.userData.baseOpacity * (0.75 + 0.25 * Math.sin(time * 1.3 + s.userData.phase));
    }
    // Laundry sway.
    for (const c of clothQuads) {
      c.rotation.y = Math.sin(time * 0.9 + c.userData.sway) * 0.18;
    }
    updateRain(dt || 0.016);
  }

  update(0, 0.016);
  return { scene, camera, update };
}
