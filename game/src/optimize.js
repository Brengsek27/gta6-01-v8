// game/src/optimize.js
// Static-city optimization for "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. Freezes the matrices of the static
// city subtree (the city is already batched by its builders, so there is no
// chunk work to do) and returns a no-op updater for the shell's per-frame
// call. Dynamic objects (hero, traffic, people, effects) live outside the
// frozen roots and keep updating normally.

/**
 * Freeze static matrices under the given roots.
 * @param {THREE.Scene} scene The main scene (kept for the contract).
 * @param {Array} staticMeshes Roots whose subtrees are fully static.
 * @param {number} span Distance span for chunk visibility (unused: the city
 *   builders already batch; kept for the contract).
 * @returns {{update:Function}}
 */
export function optimizeCity(scene, staticMeshes, span = 165) {
  void scene;
  void span;
  const roots = Array.isArray(staticMeshes) ? staticMeshes : [];
  for (const root of roots) {
    if (!root || typeof root.traverse !== 'function') continue;
    root.traverse((obj) => {
      if (obj.isMesh || obj.isSprite || obj.isPoints || obj.isLine) {
        obj.updateMatrixWorld(true);
        obj.matrixAutoUpdate = false;
      }
    });
  }
  // Chunk visibility is a no-op: the city builders already merge static
  // geometry per module, so per-chunk toggling would only add draw calls.
  return { update() {} };
}
