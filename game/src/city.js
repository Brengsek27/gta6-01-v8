// game/src/city.js
// City assembler for "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. Combines the three city modules
// (streets, buildings, market) into one group with one update() and one
// districtAt(). The vendored three.js r152 is window.THREE; modules import
// it by relative path and seed all randomness from mulberry32(seed).

import * as THREEImport from '../vendor/three.min.js';
import { buildStreets } from './city-streets.js';
import { buildBuildings } from './city-buildings.js';
import { buildMarket } from './city-market.js';

// The vendored three.min.js is a UMD build. Under an ESM loader it either
// arrives as the `default` export (CJS interop) or attaches itself to
// globalThis.THREE as a side effect. Accept either shape.
const THREE = THREEImport.default || globalThis.THREE || THREEImport;

export function makeCity(scene, fx, seed = 1337, compact = false) {
  const group = new THREE.Group();
  group.name = 'city';

  // Each module adds its own group to the scene as it builds; reparenting
  // them under the city group keeps one root for the whole city.
  const streets = buildStreets(scene, fx, seed);
  const buildings = buildBuildings(scene, fx, seed);
  const market = buildMarket(scene, fx, seed, { compact });
  group.add(streets.group, buildings.group, market.group);
  scene.add(group);

  // Reuse the streets module's districtAt — it already implements the
  // district map, so the logic lives in exactly one place.
  const districtAt = streets.districtAt;

  function update(time, dt, camera) {
    streets.update(time, dt, camera);
    buildings.update(time, dt, camera);
    market.update(time, dt, camera);
  }

  return {
    group,
    update,
    districtAt,
    market: { x: 33, z: 130 },
    strand: { x: -16, z: 0 },
  };
}
