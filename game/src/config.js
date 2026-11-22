// Configuration for Kibera Rising foundation (Round 8 golden hour)
// Exported constants are used throughout the game code.

// DUSK colors are retained for compatibility but we define GOLDEN_HOUR palette.
export const DUSK = {
  // placeholder dusk palette (may be unused in round 8)
  sky: "#2b3d5e",
  sun: "#ffb84d",
};

// World layout constants
export const WORLD = {
  block: 55,
  inlandBlocks: 10,
  longBlocks: 10,
  avenueHalf: 16,
  lane: 3.65,
  localHalf: 5.3,
  coast: -30,
  north: -275,
  south: 275,
  fogNear: 40,
  fogFar: 300,
  seaColor: "#35657a",
  asphaltColor: "#8a8378", // lightened so the dark asphalt texture reads
  concreteColor: "#cfc4ae", // warm light
  amberColor: "#ff9a4d",
  policeBlue: "#0033ff",
  alertRed: "#ff2222",
};

// District definitions (simple bounding boxes/positions may be added later)
export const DISTRICTS = {
  KumalaStrand: { name: "Kumala Strand" },
  LantawaCentre: { name: "Lantawa Centre" },
  Pasaru: { name: "Pasaru", center: { x: 33, z: 130 } },
  LomboroWharf: { name: "Lomboro Wharf" },
  BanyanGreen: { name: "Banyan Green" },
};

// Sun direction vector (unit length approximated)
export const SUN = {
  direction: new THREE.Vector3(-0.52, 0.22, -0.83).normalize(),
  // color palette for violet dusk (R8 world detail: violet/amber, not muddy orange)
  bandColor: "#ffb84d",
  zenithColor: "#2b2358",
  midSkyColor: "#9a5a7a", // mauve‑rose
  horizonColor: "#ff8a3c",
  fogColor: "#9a5f74",
};

