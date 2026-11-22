// Geometry helper utilities – flat‑shaded low‑poly style.
// All functions assume THREE is available globally (window.THREE).

/**
 * Extrude a 2D side‑profile into a 3D geometry.
 * @param {Array<{x:number,y:number}>} points List of 2D points.
 @param {number} depth Extrusion depth.
 @param {number} bevel Bevel size.
 * @returns {THREE.ExtrudeGeometry}
 */
export function profile(points, depth, bevel) {
  const shape = new THREE.Shape();
  points.forEach((pt, i) => {
    i === 0 ? shape.moveTo(pt.x, pt.y) : shape.lineTo(pt.x, pt.y);
  });
  const options = {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  };
  return new THREE.ExtrudeGeometry(shape, options);
}

/** Mirror‑extrude a side profile across a width to make a full building wall. */
export function sideProfile(points, width, bevel) {
  const half = width / 2;
  const left = points.map(p => ({ x: p.x - half, y: p.y }));
  const right = points.map(p => ({ x: p.x + half, y: p.y })).reverse();
  const combined = [...left, ...right];
  return profile(combined, width, bevel);
}

/** Rounded slab – a box with rounded edges created via Shape + extrude. */
export function roundedSlab(width, height, depth, radius) {
  const shape = new THREE.Shape();
  const w2 = width / 2 - radius;
  const h2 = height / 2 - radius;
  shape.moveTo(-w2, -h2 + radius);
  shape.lineTo(-w2, h2 - radius);
  shape.quadraticCurveTo(-w2, h2, -w2 + radius, h2);
  shape.lineTo(w2 - radius, h2);
  shape.quadraticCurveTo(w2, h2, w2, h2 - radius);
  shape.lineTo(w2, -h2 + radius);
  shape.quadraticCurveTo(w2, -h2, w2 - radius, -h2);
  shape.lineTo(-w2 + radius, -h2);
  shape.quadraticCurveTo(-w2, -h2, -w2, -h2 + radius);
  const extrudeOpts = { depth, bevelEnabled: false };
  return new THREE.ExtrudeGeometry(shape, extrudeOpts);
}

/** Lathe geometry from profile points. */
export function lathe(points, segments = 12) {
  const pts = points.map(p => new THREE.Vector2(p.x, p.y));
  return new THREE.LatheGeometry(pts, segments);
}

/** Simple capsule – cylinder with hemispherical ends. */
export function capsule(radius, length) {
  const cyl = new THREE.CylinderGeometry(radius, radius, length, 8, 1, true);
  const sphereTop = new THREE.SphereGeometry(radius, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const sphereBottom = new THREE.SphereGeometry(radius, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  sphereTop.translate(0, length / 2, 0);
  sphereBottom.translate(0, -length / 2, 0);
  const geom = new THREE.Geometry();
  geom.merge(new THREE.Mesh(cyl).geometry);
  geom.merge(new THREE.Mesh(sphereTop).geometry);
  geom.merge(new THREE.Mesh(sphereBottom).geometry);
  return new THREE.BufferGeometry().fromGeometry(geom);
}

/** Partial sphere segment. */
export function sphereSegment(radius, start, sweep) {
  const geom = new THREE.SphereGeometry(radius, 12, 8, start, sweep, 0, Math.PI / 2);
  return geom;
}

/** Arch – tube following a circular arc. */
export function arch(radius, tube, sweep) {
  const curve = new THREE.ArcCurve(0, 0, radius, 0, sweep, false);
  const path = new THREE.CurvePath();
  path.add(curve);
  const geometry = new THREE.TubeGeometry(path, 12, tube, 6, false);
  return geometry;
}

/** Helper to add a mesh at coordinates and return it. */
export function meshAt(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Combine an array of meshes (same material) into a single BufferGeometry. */
export function combineMeshes(meshes) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let offset = 0;
  meshes.forEach(m => {
    const geom = m.geometry.clone();
    geom.applyMatrix4(m.matrixWorld);
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const uv = geom.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }
    if (geom.index) {
      for (let i = 0; i < geom.index.count; i++) {
        indices.push(geom.index.getX(i) + offset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(i + offset);
      }
    }
    offset += pos.count;
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

/** Merge static meshes within a group by material, excluding given objects. */
export function batchRigid(parent, excluded = []) {
  const materialMap = new Map();
  parent.traverse(obj => {
    if (obj.isMesh && !excluded.includes(obj)) {
      const mat = obj.material;
      if (!materialMap.has(mat)) materialMap.set(mat, []);
      materialMap.get(mat).push(obj);
    }
  });
  const mergedMeshes = [];
  for (const [mat, list] of materialMap.entries()) {
    const mergedGeom = combineMeshes(list);
    const mesh = new THREE.Mesh(mergedGeom, mat);
    mergedMeshes.push(mesh);
  }
  return mergedMeshes;
}

/** Add a cylinder beam between two points. */
export function beam(parent, start, end, radius, material) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  const cylGeom = new THREE.CylinderGeometry(radius, radius, length, 8, 1, true);
  const mesh = new THREE.Mesh(cylGeom, material);
  // Align cylinder
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  parent.add(mesh);
  return mesh;
}

/** Add an additive billboard quad (glow) at position. */
export function glow(parent, map, x, y, z, width, height, opacity = 0.5) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.renderOrder = 999;
  parent.add(mesh);
  return mesh;
}

/** Ground‑plane light pool – a textured quad aligned to the ground. */
export function pool(parent, map, x, z, width, length, opacity = 0.4, y = 0.01) {
  const geometry = new THREE.PlaneGeometry(width, length);
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Add a translucent cone light (open‑ended). */
export function lightCone(parent, color, radius, length, opacity = 0.3, falloffFloor = 0) {
  const geometry = new THREE.ConeGeometry(radius, length, 12, 1, true);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = length / 2;
  parent.add(mesh);
  return mesh;
}

