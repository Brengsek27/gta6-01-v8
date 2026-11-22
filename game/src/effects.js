// game/src/effects.js
// Transient effects for "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. Spark scatter bursts, a distinct
// 4-point-star muzzle flash with a smoke puff, drifting ashfall, and the
// light pool / cone / glow helpers the staging code reuses.
//
// The vendored three.js r152 is window.THREE; modules import it by relative
// path and seed all randomness from mulberry32(seed).

import * as THREEImport from '../vendor/three.min.js';
import { pool, lightCone } from './geometry.js';
import { atmosphereTextures } from './textures.js';
import { mulberry32 } from './random.js';

// The vendored three.min.js is a UMD build. Under an ESM loader it either
// arrives as the `default` export (CJS interop) or attaches itself to
// globalThis.THREE as a side effect. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

// Re-exported for staging: a ground light pool and a volumetric light cone.
export { pool as lightPool, lightCone };

/** Small canvas-texture helper (textures.js keeps its own private copy). */
function canvasTex(width, height, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  painter(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The muzzle-flash star: a 4-point star with long spikes over a warm halo,
 * deliberately different from the soft diamond spark used for debris.
 */
export function starTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 62);
    halo.addColorStop(0, 'rgba(255,240,180,0.9)');
    halo.addColorStop(0.35, 'rgba(255,200,90,0.45)');
    halo.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    // 4-point star: alternating long spike / short inner vertex.
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? 60 : 9;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    // Hot white core.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Shared soft-glow texture for headlight / brake glow sprites.
let _glowTex = null;
function glowTexture() {
  if (!_glowTex) _glowTex = atmosphereTextures().glow;
  return _glowTex;
}

/**
 * An additive glow sprite (headlights, brake glow, lamp halos).
 * Returns the sprite; the caller positions it and may fade material.opacity.
 */
export function glowSprite(color = 0xffe6b0, size = 1.4, opacity = 0.85) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 997;
  return sprite;
}

/** Convenience: add a headlight glow sprite to a parent at (x, y, z). */
export function headlightGlow(parent, x, y, z, color = 0xffe6b0, size = 1.4) {
  const sprite = glowSprite(color, size);
  sprite.position.set(x, y, z);
  parent.add(sprite);
  return sprite;
}

/** Pooled instanced spark burst: additive points with gravity + bounce. */
class SparkPool {
  constructor(parent, capacity, sparkTex) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.head = 0;
    for (let i = 0; i < capacity; i++) this.pos[i * 3 + 1] = -100;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.42,
      map: sparkTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 998;
    parent.add(this.points);
  }

  burst(p, count, rng) {
    for (let n = 0; n < count; n++) {
      const i = this.head;
      this.head = (this.head + 1) % this.capacity;
      const i3 = i * 3;
      this.pos[i3] = p.x + (rng() - 0.5) * 0.2;
      this.pos[i3 + 1] = p.y + (rng() - 0.5) * 0.2;
      this.pos[i3 + 2] = p.z + (rng() - 0.5) * 0.2;
      const a = rng() * Math.PI * 2;
      const sp = 2 + rng() * 5.5;
      this.vel[i3] = Math.cos(a) * sp;
      this.vel[i3 + 1] = 2 + rng() * 5;
      this.vel[i3 + 2] = Math.sin(a) * sp;
      this.life[i] = this.maxLife[i] = 0.45 + rng() * 0.45;
      const b = 0.75 + rng() * 0.25;
      this.col[i3] = b;
      this.col[i3 + 1] = b * 0.82;
      this.col[i3 + 2] = b * 0.4;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      const i3 = i * 3;
      this.life[i] -= dt;
      this.vel[i3 + 1] -= 6.5 * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.03) {
        this.pos[i3 + 1] = 0.03;
        this.vel[i3 + 1] *= -0.35;
        this.vel[i3] *= 0.7;
        this.vel[i3 + 2] *= 0.7;
      }
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i3] = f;
      this.col[i3 + 1] = f * 0.82;
      this.col[i3 + 2] = f * 0.4;
      if (this.life[i] <= 0) {
        this.pos[i3 + 1] = -100;
        this.col[i3] = this.col[i3 + 1] = this.col[i3 + 2] = 0;
      }
    }
    if (any) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }

  clear() {
    this.life.fill(0);
    this.col.fill(0);
    for (let i = 0; i < this.capacity; i++) this.pos[i * 3 + 1] = -100;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/** One muzzle-flash slot: star sprite + halo glow + fading smoke puff. */
function makeFlashSlot(parent, starTex, smokeTex) {
  const starMat = new THREE.SpriteMaterial({
    map: starTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const star = new THREE.Sprite(starMat);
  star.renderOrder = 999;
  star.visible = false;
  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0xffc46b,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.renderOrder = 999;
  glow.visible = false;
  const smokeMat = new THREE.SpriteMaterial({
    map: smokeTex,
    color: 0x9a9a9a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const smoke = new THREE.Sprite(smokeMat);
  smoke.renderOrder = 996;
  smoke.visible = false;
  parent.add(star, glow, smoke);
  return { star, glow, smoke, t: Infinity, rot: 0 };
}

/** Slow drifting ashfall motes across the scene. */
class AshFall {
  constructor(parent, capacity, smokeTex) {
    this.capacity = capacity;
    this.speed = new Float32Array(capacity);
    this.phase = new Float32Array(capacity);
    const pos = new Float32Array(capacity * 3);
    this.pos = pos;
    const rng = mulberry32(20261122);
    for (let i = 0; i < capacity; i++) {
      pos[i * 3] = (rng() - 0.5) * 160;
      pos[i * 3 + 1] = rng() * 45;
      pos[i * 3 + 2] = (rng() - 0.5) * 160;
      this.speed[i] = 0.5 + rng() * 0.9;
      this.phase[i] = rng() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.22,
      map: smokeTex,
      color: 0xd8cfc4,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    parent.add(this.points);
    this.time = 0;
  }

  update(dt) {
    if (!this.points.visible) return;
    this.time += dt;
    for (let i = 0; i < this.capacity; i++) {
      const i3 = i * 3;
      this.pos[i3 + 1] -= this.speed[i] * dt;
      this.pos[i3] += Math.sin(this.time * 0.7 + this.phase[i]) * 0.35 * dt;
      if (this.pos[i3 + 1] < 0) {
        this.pos[i3 + 1] = 45;
        this.pos[i3] = (Math.random() - 0.5) * 160;
        this.pos[i3 + 2] = (Math.random() - 0.5) * 160;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

/**
 * Build the transient-effects controller for a scene.
 * @param {THREE.Scene} scene Scene to attach effect objects to.
 * @param {boolean} compact Reduce particle counts on low-end staging.
 * @returns {{clear:Function, scatter:Function, flash:Function, update:Function, setAsh:Function, group:THREE.Group}}
 */
export function makeEffects(scene, compact = false) {
  const group = new THREE.Group();
  group.name = 'effects';
  scene.add(group);

  const atmo = atmosphereTextures();
  const starTex = starTexture();
  const rng = mulberry32(1337);

  const sparks = new SparkPool(group, compact ? 120 : 320, atmo.spark);

  const flashSlots = [];
  for (let i = 0; i < 6; i++) flashSlots.push(makeFlashSlot(group, starTex, atmo.smoke));
  let flashHead = 0;

  const ash = new AshFall(group, compact ? 120 : 280, atmo.smoke);

  /** Remove every transient spark / flash / smoke puff. */
  function clear() {
    sparks.clear();
    for (const slot of flashSlots) {
      slot.t = Infinity;
      slot.star.visible = false;
      slot.glow.visible = false;
      slot.smoke.visible = false;
    }
  }

  /**
   * Fire a spark scatter burst at a point.
   * @param {{x:number,y:number,z:number}|THREE.Vector3} point Burst origin.
   * @param {number} count Sparks to emit (default 40).
   */
  function scatter(point, count = 40) {
    sparks.burst(point, count, rng);
  }

  /**
   * Fire a muzzle flash at `from`, aimed toward `to`.
   * Star sprite scales up over ~60 ms, then a soft smoke puff fades out.
   * @param {{x:number,y:number,z:number}|THREE.Vector3} from Muzzle position.
   * @param {{x:number,y:number,z:number}|THREE.Vector3} to Aim point.
   */
  function flash(from, to) {
    const slot = flashSlots[flashHead];
    flashHead = (flashHead + 1) % flashSlots.length;
    slot.t = 0;
    slot.rot = rng() * Math.PI;
    slot.star.position.set(from.x, from.y, from.z);
    slot.star.material.rotation = slot.rot;
    slot.glow.position.set(from.x, from.y, from.z);
    // Smoke drifts a short step along the firing direction, then rises.
    const dx = (to.x - from.x) || 0;
    const dy = (to.y - from.y) || 0;
    const dz = (to.z - from.z) || 0;
    const len = Math.hypot(dx, dy, dz) || 1;
    slot.smoke.position.set(
      from.x + (dx / len) * 0.35,
      from.y + (dy / len) * 0.35 + 0.05,
      from.z + (dz / len) * 0.35,
    );
    slot.star.visible = true;
    slot.glow.visible = true;
    slot.smoke.visible = true;
  }

  /** Advance sparks, flashes, smoke and ashfall by dt seconds. */
  function update(dt) {
    sparks.update(dt);
    for (const slot of flashSlots) {
      if (slot.t === Infinity) continue;
      slot.t += dt;
      const t = slot.t;
      // Star: scale up fast for 60 ms, then gone within the next 40 ms.
      if (t < 0.06) {
        const s = 0.5 + (t / 0.06) * 1.7;
        slot.star.scale.set(s, s, 1);
        slot.star.material.opacity = 1;
      } else if (t < 0.1) {
        slot.star.material.opacity = Math.max(0, 1 - (t - 0.06) / 0.04);
      } else {
        slot.star.visible = false;
      }
      // Halo glow: same beat, slightly larger and softer.
      if (t < 0.12) {
        const s = 0.9 + (t / 0.12) * 2.2;
        slot.glow.scale.set(s, s, 1);
        slot.glow.material.opacity = Math.max(0, 0.85 - t / 0.12);
      } else {
        slot.glow.visible = false;
      }
      // Smoke puff: grows and fades over ~0.7 s.
      if (t < 0.7) {
        const s = 0.35 + t * 1.15;
        slot.smoke.scale.set(s, s, 1);
        slot.smoke.material.opacity = 0.42 * Math.max(0, 1 - t / 0.7);
        slot.smoke.position.y += dt * 0.25;
      } else {
        slot.smoke.visible = false;
        slot.t = Infinity;
      }
    }
    ash.update(dt);
  }

  /** Toggle the drifting ashfall motes. */
  function setAsh(on) {
    ash.points.visible = !!on;
  }

  return { clear, scatter, flash, update, setAsh, group };
}
