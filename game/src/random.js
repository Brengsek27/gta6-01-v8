// Simple deterministic PRNG utilities for the game.
// mulberry32 is a small 32‑bit hash based generator returning values in [0,1).

/**
 * Create a mulberry32 PRNG function seeded with an integer.
 * @param {number} a Seed value (32‑bit integer).
 * @returns {function():number} Function that returns a float in [0,1).
 */
export function mulberry32(a) {
  return function () {
    // Coerce to unsigned 32‑bit integer
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Parse the ?seed query param from the current page URL. */
export const seed = (() => {
  if (typeof window === "undefined" || !window.location) return 1;
  const m = /[?&]seed=([0-9]+)/.exec(window.location.search);
  return m ? Number(m[1]) : 1;
})();

/**
 * Return a random number in [min, max) using supplied rng function.
 * @param {function():number} rng PRNG function.
 * @param {number} min Minimum (inclusive).
 * @param {number} max Maximum (exclusive).
 */
export function range(rng, min, max) {
  return rng() * (max - min) + min;
}

/**
 * Pick a random element from an array using rng.
 * @param {function():number} rng PRNG function.
 * @param {Array} items Array of items.
 */
export function pick(rng, items) {
  if (!items.length) return undefined;
  const i = Math.floor(rng() * items.length);
  return items[i];
}

