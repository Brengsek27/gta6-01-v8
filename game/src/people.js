// game/src/people.js
// Varied instanced pedestrians for "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. One InstancedMesh per body part with
// per-instance colours, so a crowd of ~128 figures costs a handful of draw
// calls. Actor-local space: origin at the feet, forward is +Z, full height
// about 1.75 m before the per-actor height scale is applied.
//
// The vendored three.js r152 is window.THREE; modules import it by relative
// path and seed all randomness from mulberry32(seed).

import * as THREEImport from '../vendor/three.min.js';
import { mulberry32 } from './random.js';

// The vendored three.min.js is a UMD build. Under an ESM loader it either
// arrives as the `default` export (CJS interop) or attaches itself to
// globalThis.THREE as a side effect. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

export const CREW = {
  Mika: { name: 'Mika Kessang', role: 'Field Lead', shirt: 0x24416d, pants: 0x1f2a33, skin: 0xa96e50, hair: 0x14100c, hairStyle: 'cap' },
  Tomo: { name: 'Tomo Sagara', role: 'Wheelman', shirt: 0xab2628, pants: 0x2b2b30, skin: 0xb98063, hair: 0x241a12, hairStyle: 'cap' },
  Inez: { name: 'Inez Vale', role: 'Fixer', shirt: 0x8a9a7b, pants: 0x2e2a26, skin: 0xc98f6b, hair: 0x2a1d16, hairStyle: 'bun' },
  Rafi: { name: 'Rafi Salas', role: 'Mechanic', shirt: 0xc98a2e, pants: 0x3a3f45, skin: 0x8a5a3b, hair: 0x1a1210, hairStyle: 'cap' },
  Suri: { name: 'Suri Nara', role: 'Electronics', shirt: 0x6b4fa0, pants: 0x22222c, skin: 0xd9a986, hair: 0x3a2a1e, hairStyle: 'bun' },
};

export const SHIRTS = [
  0xe85d4a, // coral
  0x1f9e8e, // teal
  0xe0a92c, // mustard
  0xf2ede4, // white
  0x5db3e8, // sky
  0x8e4a7d, // plum
  0x7d8c3f, // olive
  0xc25e2e, // rust
  0x24416d, // navy
  0xe87fa8, // pink
  0x3fae5a, // leaf green
  0xf2f0e6, // cream
];
export const PANTS = [0x2b3440, 0x5a4632, 0x3c3c46, 0x6b7a8c, 0x1e2b26];
export const SKINS = [0x8a5a3b, 0xa96e50, 0xb98063, 0xc98f6b, 0xd9a986, 0x6e4530];
export const HAIRS = [0x14100c, 0x2a1d16, 0x6e2f1a, 0x9a9a9a, 0xd8c49a];
export const POSES = ['walk', 'stand', 'browse', 'carry', 'cycle', 'down'];

function _mat(color = 0xffffff, shininess = 28) {
  return new THREE.MeshPhongMaterial({ color, shininess, specular: 0x333333 });
}

// Geometry helpers: limb geometries are translated so their top (the joint)
// sits at the local origin, so a rotation about the joint is just a matrix
// at the joint position.
function limbGeo(rTop, rBot, len, seg = 8) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  g.translate(0, -len / 2, 0);
  return g;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _c = new THREE.Color();

/**
 * Instanced-part figure system.
 * @param {THREE.Scene} scene Scene to attach the figures to.
 * @param {number} capacity Maximum simultaneous figures (default 128).
 * @returns {{add:Function, draw:Function, actors:Array, group:THREE.Group, capacity:number}}
 */
export function makePeople(scene, capacity = 128) {
  const group = new THREE.Group();
  group.name = 'people';
  scene.add(group);

  // ---- one InstancedMesh per body part ----
  const defs = [
    ['torso', new THREE.CylinderGeometry(0.21, 0.165, 0.55, 8), _mat()],
    ['hips', new THREE.BoxGeometry(0.36, 0.20, 0.22), _mat()],
    ['neck', new THREE.CylinderGeometry(0.055, 0.065, 0.10, 8), _mat()],
    ['head', new THREE.SphereGeometry(0.115, 12, 10), _mat()],
    ['hair', new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), _mat()],
    ['bun', new THREE.SphereGeometry(0.06, 8, 6), _mat()],
    ['nose', new THREE.BoxGeometry(0.03, 0.05, 0.045), _mat()],
    ['shades', new THREE.BoxGeometry(0.20, 0.035, 0.025), _mat(0x14161a, 90)],
    ['sleeveL', limbGeo(0.068, 0.058, 0.30), _mat()],
    ['sleeveR', limbGeo(0.068, 0.058, 0.30), _mat()],
    ['forearmL', limbGeo(0.052, 0.044, 0.28), _mat()],
    ['forearmR', limbGeo(0.052, 0.044, 0.28), _mat()],
    ['handL', new THREE.SphereGeometry(0.05, 8, 6), _mat()],
    ['handR', new THREE.SphereGeometry(0.05, 8, 6), _mat()],
    ['thighL', limbGeo(0.088, 0.068, 0.42), _mat()],
    ['thighR', limbGeo(0.088, 0.068, 0.42), _mat()],
    ['shinL', limbGeo(0.062, 0.05, 0.42), _mat()],
    ['shinR', limbGeo(0.062, 0.05, 0.42), _mat()],
    ['shoeL', new THREE.BoxGeometry(0.09, 0.06, 0.25), _mat(0xffffff, 18)],
    ['shoeR', new THREE.BoxGeometry(0.09, 0.06, 0.25), _mat(0xffffff, 18)],
    ['capTop', new THREE.CylinderGeometry(0.13, 0.135, 0.05, 10), _mat(0x0d1b3e, 40)],
    ['capBrim', new THREE.BoxGeometry(0.20, 0.015, 0.10), _mat(0x0d1b3e, 40)],
    ['badge', new THREE.BoxGeometry(0.045, 0.055, 0.012), _mat(0xffd97a, 120)],
    ['hatTop', new THREE.CylinderGeometry(0.105, 0.12, 0.10, 10), _mat()],
    ['hatBrim', new THREE.CylinderGeometry(0.21, 0.21, 0.02, 12), _mat()],
    ['bag', new THREE.BoxGeometry(0.22, 0.28, 0.09), _mat()],
    ['strap', new THREE.BoxGeometry(0.035, 0.58, 0.015), _mat(0x2a2018, 10)],
  ];
  const meshes = {};
  for (const [key, geo, mat] of defs) {
    const m = new THREE.InstancedMesh(geo, mat, capacity);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = false;
    for (let i = 0; i < capacity; i++) {
      m.setMatrixAt(i, _zero);
      m.setColorAt(i, _c.setHex(0xffffff));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    group.add(m);
    meshes[key] = m;
  }

  const actors = [];
  let nextSlot = 0;

  function setColor(mesh, i, hex) {
    mesh.setColorAt(i, _c.setHex(hex));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Add a figure. Named crew get fixed wardrobes; civilians get a seeded
   * wardrobe from their index; police get a navy uniform.
   */
  function add(variant = 'civilian', index = 0) {
    const slot = nextSlot < capacity ? nextSlot++ : actors.findIndex((a) => !a.visible);
    if (slot < 0 || slot >= capacity) return null;
    const rng = mulberry32((index + 1) * 2654435761 + (variant === 'police' ? 7 : 0));
    const crew = CREW[variant];
    const isPolice = variant === 'police';
    const isWhite = variant === 'white';
    const shirt = crew ? crew.shirt : isWhite ? 0xf2ede4 : isPolice ? 0x16264f : SHIRTS[Math.floor(rng() * SHIRTS.length)];
    const pants = crew ? crew.pants : isPolice ? 0x16264f : PANTS[Math.floor(rng() * PANTS.length)];
    const skin = crew ? crew.skin : SKINS[Math.floor(rng() * SKINS.length)];
    const hair = crew ? crew.hair : HAIRS[Math.floor(rng() * HAIRS.length)];
    const hairStyle = crew ? crew.hairStyle : (rng() < 0.28 ? 'bun' : 'cap');
    const greyHair = !crew && rng() < 0.14;
    const hairColor = greyHair ? 0x9a9a9a : hair;
    const shades = !crew && !isPolice && rng() < 0.25;
    const wideHat = !crew && !isPolice && rng() < 0.16;
    const hasBag = rng() < 0.30;
    const shoeColor = [0x1c1c20, 0x6b3a24, 0xf2ede4, 0x2b3440][Math.floor(rng() * 4)];
    const bagColor = [0xb3541e, 0x2e5d3a, 0x7d4a21, 0x24416d][Math.floor(rng() * 4)];
    const hatColor = [0xd8c49a, 0x5a4632, 0x8a2f2f][Math.floor(rng() * 3)];
    const height = 0.88 + rng() * 0.18;
    const sx = 0.94 + rng() * 0.14;
    const sz = 0.92 + rng() * 0.16;

    const actor = {
      slot,
      position: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      speed: 0,
      phase: rng() * Math.PI * 2,
      height,
      sx, sz,
      visible: true,
      down: false,
      relaxed: false,
      pose: 'stand',
      variant,
      shirt, pants, skin, hair: hairColor, hairStyle,
      shades, wideHat, hasBag, shoeColor, bagColor, hatColor,
      isPolice,
    };
    actors[slot] = actor;

    // Static wardrobe colours, set once per slot.
    setColor(meshes.torso, slot, shirt);
    setColor(meshes.sleeveL, slot, shirt);
    setColor(meshes.sleeveR, slot, shirt);
    setColor(meshes.hips, slot, pants);
    setColor(meshes.thighL, slot, pants);
    setColor(meshes.thighR, slot, pants);
    setColor(meshes.shinL, slot, pants);
    setColor(meshes.shinR, slot, pants);
    setColor(meshes.neck, slot, skin);
    setColor(meshes.head, slot, skin);
    setColor(meshes.nose, slot, skin);
    setColor(meshes.handL, slot, skin);
    setColor(meshes.handR, slot, skin);
    setColor(meshes.forearmL, slot, skin);
    setColor(meshes.forearmR, slot, skin);
    setColor(meshes.hair, slot, hairColor);
    setColor(meshes.bun, slot, hairColor);
    setColor(meshes.shoeL, slot, shoeColor);
    setColor(meshes.shoeR, slot, shoeColor);
    setColor(meshes.hatTop, slot, hatColor);
    setColor(meshes.hatBrim, slot, hatColor);
    setColor(meshes.bag, slot, bagColor);
    return actor;
  }

  function part(mesh, i, root, px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q1.setFromEuler(_e);
    _v1.set(px, py, pz);
    _s.set(sx, sy, sz);
    _m1.compose(_v1, _q1, _s);
    _m2.multiplyMatrices(root, _m1);
    mesh.setMatrixAt(i, _m2);
  }

  function hide(mesh, i) { mesh.setMatrixAt(i, _zero); }

  // Joint position of a limb end: pivot + rotated (0,-len,0).
  function limbEnd(px, py, pz, rx, ry, rz, len, out) {
    _e.set(rx, ry, rz);
    _q2.setFromEuler(_e);
    out.set(px, py, pz);
    _v3.set(0, -len, 0).applyQuaternion(_q2);
    out.add(_v3);
    return out;
  }

  function drawActor(a, time, dt) {
    const i = a.slot;
    const pose = a.down ? 'down' : a.pose;
    if (pose === 'walk' && a.speed > 0.01) a.phase += dt * (2.0 + a.speed * 1.7);

    // Root matrix: feet at position, yaw about Y, per-actor build scale.
    _e.set(0, a.yaw, 0);
    _q1.setFromEuler(_e);
    _v1.copy(a.position);
    _s.set(a.sx, a.height, a.sz);
    const root = new THREE.Matrix4().compose(_v1, _q1, _s);
    if (pose === 'down') {
      // Prone: lay the body flat, face down, head away from the yaw heading.
      _e.set(-1.45, a.yaw, 0, 'YXZ');
      _q1.setFromEuler(_e);
      _v1.set(a.position.x, 0.16, a.position.z);
      _s.set(a.sx, a.height, a.sz);
      root.compose(_v1, _q1, _s);
    }

    const t = time;
    const ph = a.phase;
    const sway = pose === 'stand' ? Math.sin(t * 0.9 + ph) * 0.025 : 0;
    const bob = pose === 'walk' ? Math.abs(Math.sin(ph)) * 0.045 : 0;
    const swing = pose === 'walk' ? Math.sin(ph) * 0.55 * Math.min(1, 0.35 + a.speed * 0.4) : 0;
    const armSwing = pose === 'walk' ? Math.sin(ph + Math.PI) * 0.45 * Math.min(1, 0.35 + a.speed * 0.4) : 0;

    // Torso / hips / neck / head.
    let torsoRx = 0;
    let headRx = 0;
    if (pose === 'browse') { torsoRx = 0.14; headRx = 0.22; }
    if (pose === 'cycle') { torsoRx = 0.32; headRx = -0.12; }
    if (pose === 'down') { torsoRx = 0; headRx = 0; }
    part(meshes.torso, i, root, sway * 0.4, 1.22 + bob, 0, torsoRx, 0, sway);
    part(meshes.hips, i, root, 0, 0.93 + bob, 0, 0, 0, sway * 0.5);
    part(meshes.neck, i, root, 0, 1.52 + bob, torsoRx * 0.12, torsoRx, 0, 0);
    part(meshes.head, i, root, 0, 1.66 + bob, torsoRx * 0.16, torsoRx + headRx, 0, sway * 0.6, 1, 1.15, 1.05);
    part(meshes.nose, i, root, 0, 1.64 + bob, 0.115 + torsoRx * 0.16, torsoRx + headRx, 0, 0);
    // Hair cap (or bun variant). Wide-brim hat replaces the hair cap's top.
    if (a.wideHat) {
      part(meshes.hair, i, root, 0, 1.68 + bob, -0.01, torsoRx + headRx, 0, 0, 0.9, 0.7, 0.9);
      part(meshes.hatTop, i, root, 0, 1.78 + bob, 0, 0, 0, 0);
      part(meshes.hatBrim, i, root, 0, 1.74 + bob, 0, 0, 0, 0);
      hide(meshes.bun, i);
    } else {
      part(meshes.hair, i, root, 0, 1.68 + bob, -0.01, torsoRx + headRx, 0, 0, 1, 1.02, 1.04);
      if (a.hairStyle === 'bun') part(meshes.bun, i, root, 0, 1.80 + bob, -0.10, torsoRx + headRx, 0, 0);
      else hide(meshes.bun, i);
      hide(meshes.hatTop, i);
      hide(meshes.hatBrim, i);
    }
    if (a.shades) part(meshes.shades, i, root, 0, 1.67 + bob, 0.105 + torsoRx * 0.16, torsoRx + headRx, 0, 0);
    else hide(meshes.shades, i);

    // Police cap + badge; civilians get neither.
    if (a.isPolice) {
      part(meshes.capTop, i, root, 0, 1.77 + bob, 0, 0, 0, 0);
      part(meshes.capBrim, i, root, 0, 1.745 + bob, 0.10, 0, 0, 0);
      part(meshes.badge, i, root, -0.10, 1.38 + bob, 0.20, 0, 0, 0);
    } else {
      hide(meshes.capTop, i); hide(meshes.capBrim, i); hide(meshes.badge, i);
    }

    // ---- arms ----
    // Shoulder pivots; sleeve rotation about X swings fore/aft, Z splays out.
    let shL = { rx: 0.08, rz: 0.10 };
    let shR = { rx: 0.08, rz: -0.10 };
    let elL = { rx: -0.25 };
    let elR = { rx: -0.25 };
    if (pose === 'walk') {
      shL.rx = armSwing; shR.rx = -armSwing;
      elL.rx = -0.35; elR.rx = -0.35;
    } else if (pose === 'browse') {
      shL.rx = -0.85; shR.rx = -0.85; elL.rx = -0.35; elR.rx = -0.35;
    } else if (pose === 'carry') {
      shL.rx = -0.55; elL.rx = -1.15; // left hand at hip, holding the bag
      shR.rx = 0.08; elR.rx = -0.25;
    } else if (pose === 'cycle') {
      shL.rx = -1.05; shR.rx = -1.05; elL.rx = -0.25; elR.rx = -0.25;
    } else if (pose === 'stand') {
      shL.rx = Math.sin(t * 0.9 + ph) * 0.05 + 0.06;
      shR.rx = -Math.sin(t * 0.9 + ph) * 0.05 + 0.06;
    } else if (pose === 'down') {
      shL.rz = 0.55; shR.rz = -0.55; shL.rx = 0.25; shR.rx = 0.25;
    }
    const elbowL = new THREE.Vector3();
    const elbowR = new THREE.Vector3();
    const wristL = new THREE.Vector3();
    const wristR = new THREE.Vector3();
    part(meshes.sleeveL, i, root, -0.26, 1.44 + bob, 0, shL.rx, 0, shL.rz);
    part(meshes.sleeveR, i, root, 0.26, 1.44 + bob, 0, shR.rx, 0, shR.rz);
    limbEnd(-0.26, 1.44 + bob, 0, shL.rx, 0, shL.rz, 0.30, elbowL);
    limbEnd(0.26, 1.44 + bob, 0, shR.rx, 0, shR.rz, 0.30, elbowR);
    part(meshes.forearmL, i, root, elbowL.x, elbowL.y, elbowL.z, shL.rx + elL.rx, 0, shL.rz * 0.5);
    part(meshes.forearmR, i, root, elbowR.x, elbowR.y, elbowR.z, shR.rx + elR.rx, 0, shR.rz * 0.5);
    limbEnd(elbowL.x, elbowL.y, elbowL.z, shL.rx + elL.rx, 0, shL.rz * 0.5, 0.28, wristL);
    limbEnd(elbowR.x, elbowR.y, elbowR.z, shR.rx + elR.rx, 0, shR.rz * 0.5, 0.28, wristR);
    part(meshes.handL, i, root, wristL.x, wristL.y, wristL.z, 0, 0, 0);
    part(meshes.handR, i, root, wristR.x, wristR.y, wristR.z, 0, 0, 0);

    // ---- legs ----
    let thL = { rx: 0, rz: 0.03 };
    let thR = { rx: 0, rz: -0.03 };
    let shL2 = { rx: 0.06 };
    let shR2 = { rx: 0.06 };
    if (pose === 'walk') {
      thL.rx = -swing; thR.rx = swing;
      shL2.rx = 0.10 + Math.max(0, Math.sin(ph + Math.PI)) * 0.55;
      shR2.rx = 0.10 + Math.max(0, Math.sin(ph)) * 0.55;
    } else if (pose === 'stand') {
      thL.rx = Math.sin(t * 0.9 + ph) * 0.02;
      thR.rx = -Math.sin(t * 0.9 + ph) * 0.02;
    } else if (pose === 'browse') {
      thL.rx = -0.06; thR.rx = 0.04;
    } else if (pose === 'cycle') {
      const pedal = Math.sin(ph * 2.2);
      thL.rx = -1.15 + pedal * 0.30; thR.rx = -1.15 - pedal * 0.30;
      shL2.rx = 1.05 - pedal * 0.45; shR2.rx = 1.05 + pedal * 0.45;
    } else if (pose === 'down') {
      thL.rx = 0.12; thR.rx = 0.08; thL.rz = 0.10; thR.rz = -0.10;
    }
    const kneeL = new THREE.Vector3();
    const kneeR = new THREE.Vector3();
    const ankleL = new THREE.Vector3();
    const ankleR = new THREE.Vector3();
    const hipY = pose === 'cycle' ? 0.98 : 0.90 + bob;
    part(meshes.thighL, i, root, -0.10, hipY, 0, thL.rx, 0, thL.rz);
    part(meshes.thighR, i, root, 0.10, hipY, 0, thR.rx, 0, thR.rz);
    limbEnd(-0.10, hipY, 0, thL.rx, 0, thL.rz, 0.42, kneeL);
    limbEnd(0.10, hipY, 0, thR.rx, 0, thR.rz, 0.42, kneeR);
    part(meshes.shinL, i, root, kneeL.x, kneeL.y, kneeL.z, thL.rx + shL2.rx, 0, 0);
    part(meshes.shinR, i, root, kneeR.x, kneeR.y, kneeR.z, thR.rx + shR2.rx, 0, 0);
    limbEnd(kneeL.x, kneeL.y, kneeL.z, thL.rx + shL2.rx, 0, 0, 0.42, ankleL);
    limbEnd(kneeR.x, kneeR.y, kneeR.z, thR.rx + shR2.rx, 0, 0, 0.42, ankleR);
    part(meshes.shoeL, i, root, ankleL.x, Math.max(0.03, ankleL.y - 0.02), ankleL.z + 0.05, 0, 0, 0);
    part(meshes.shoeR, i, root, ankleR.x, Math.max(0.03, ankleR.y - 0.02), ankleR.z + 0.05, 0, 0, 0);

    // ---- shoulder bag (carry pose, or a standing carrier) ----
    const showBag = pose === 'carry' || (a.hasBag && (pose === 'stand' || pose === 'walk'));
    if (showBag) {
      part(meshes.bag, i, root, -0.27, 0.80 + bob, 0.03, 0, 0, 0.08);
      part(meshes.strap, i, root, 0.02, 1.20 + bob, 0.19, 0.10, 0, 0.55);
    } else {
      hide(meshes.bag, i); hide(meshes.strap, i);
    }
  }

  function draw(time, dt, camera) {
    for (const a of actors) {
      if (!a) continue;
      if (!a.visible) {
        for (const key in meshes) hide(meshes[key], a.slot);
        continue;
      }
      drawActor(a, time, dt);
    }
    for (const key in meshes) meshes[key].instanceMatrix.needsUpdate = true;
  }

  return { add, draw, actors, group, capacity };
}
