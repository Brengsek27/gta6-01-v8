import { mulberry32 } from './random.js';

// Canvas‑based texture painters for Kibera Rising.
// Each function returns a THREE.CanvasTexture with appropriate colorSpace (sRGB).

/** Helper to create a CanvasTexture with sRGB colorspace. */
function makeTexture(width, height, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  painter(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Building facade texture.
 * @param {string} color Base wall hex.
 * @param {number} columns Number of window columns.
 * @param {number} floors Number of window rows.
 * @param {number} seed RNG seed for variation.
 * @param {boolean} arched Whether ground‑floor has an arched awning.
 * @returns {THREE.CanvasTexture}
 */
export function facade(color, columns, floors, seed, arched = false) {
  const rng = (() => {
    const prng = mulberry32(seed);
    return () => prng();
  })();
  const width = 256,
    height = 256;
  return makeTexture(width, height, (ctx, w, h) => {
    // Fill base wall
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    // Add subtle noise
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const noise = (rng() - 0.5) * 10; // +/-5
      img.data[i] = Math.min(255, Math.max(0, img.data[i] + noise));
      img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + noise));
      img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + noise));
    }
    ctx.putImageData(img, 0, 0);
    // Window grid
    const winW = w / columns;
    const winH = h / floors;
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < floors; row++) {
        const x = col * winW;
        const y = row * winH;
        const r = rng();
        let fill;
        if (r < 0.33) fill = rng() < 0.5 ? '#ffb45c' : '#ffd28a'; // warm-lit
        else if (r < 0.45) fill = '#8fb8d8'; // cool-lit
        else if (r < 0.60) fill = '#2a2622'; // shuttered (slats below)
        else fill = '#1e1c1a'; // dark
        // Dark frame, then the pane inset inside it.
        ctx.fillStyle = '#241f1c';
        ctx.fillRect(x + 2, y + 2, winW - 4, winH - 4);
        ctx.fillStyle = fill;
        ctx.fillRect(x + 5, y + 5, winW - 10, winH - 10);
        if (fill === '#2a2622') {
          ctx.fillStyle = '#4a4238';
          for (let s = 1; s < 4; s++) ctx.fillRect(x + 5, y + 5 + (s * (winH - 10)) / 4, winW - 10, 2);
        }
      }
    }
    // Ground‑floor shopfront band
    const bandHeight = h * 0.12;
    ctx.fillStyle = '#432b32'; // dark backdrop for awning
    ctx.fillRect(0, h - bandHeight, w, bandHeight);
    if (arched) {
      // simple arched stripe
      ctx.fillStyle = '#ff9a4d';
      ctx.beginPath();
      ctx.moveTo(0, h - bandHeight);
      ctx.quadraticCurveTo(w / 2, h - bandHeight - 20, w, h - bandHeight);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** Ground texture painter for various kinds. */
export function groundTexture(kind, seed) {
  const rng = (() => {
    const prng = mulberry32(seed);
    return () => prng();
  })();
  const size = 256;
  return makeTexture(size, size, (ctx, w, h) => {
    // base colors per kind
    const palettes = {
      asphalt: '#555555',
      sidewalk: '#777777',
      market: '#8a7a6f',
      sand: '#c2b280',
    };
    ctx.fillStyle = palettes[kind] || '#555555';
    ctx.fillRect(0, 0, w, h);
    // simple pattern variations
    if (kind === 'asphalt') {
      // Dark speckled asphalt base with an expansion-joint grid, three
      // elongated warm light streaks (wet-asphalt feel) and repair patches.
      ctx.fillStyle = '#4a4a4d';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const v = 40 + Math.floor(rng() * 70);
        ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
        ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h), 2, 2);
      }
      ctx.fillStyle = 'rgba(255,170,90,0.20)';
      for (const [sx, sy, sw] of [[30, 60, 190], [20, 150, 210], [50, 220, 160]]) {
        ctx.beginPath(); ctx.ellipse(sx + sw / 2, sy, sw / 2, 7, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#2e2e31'; ctx.lineWidth = 3;
      for (let g = 0; g <= w; g += 64) {
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(w, g); ctx.stroke();
      }
      ctx.fillStyle = '#333336';
      ctx.fillRect(150, 30, 70, 46); ctx.fillRect(20, 180, 60, 40);
      ctx.strokeStyle = '#262629'; ctx.lineWidth = 2;
      ctx.strokeRect(150, 30, 70, 46); ctx.strokeRect(20, 180, 60, 40);
    } else if (kind === 'sidewalk' || kind === 'market') {
      // Per-tile value variation, grout lines, speckle; market gets
      // baked warm light pools.
      const tones = ['#8a7a6f', '#9a8878', '#7a6a5e', '#a89480', '#6e6055', '#93816e'];
      const tile = 32;
      for (let y = 0; y < h; y += tile) {
        for (let x = 0; x < w; x += tile) {
          ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
          ctx.fillRect(x, y, tile, tile);
        }
      }
      ctx.strokeStyle = '#4a4038'; ctx.lineWidth = 2;
      for (let g = 0; g <= w; g += tile) {
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(w, g); ctx.stroke();
      }
      for (let i = 0; i < 1200; i++) {
        const v = 90 + Math.floor(rng() * 60);
        ctx.fillStyle = `rgba(${v},${v - 8},${v - 18},0.5)`;
        ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h), 2, 2);
      }
      if (kind === 'market') {
        for (const [px, py] of [[64, 64], [192, 180], [90, 210]]) {
          const g = ctx.createRadialGradient(px, py, 4, px, py, 55);
          g.addColorStop(0, 'rgba(255,180,100,0.35)');
          g.addColorStop(1, 'rgba(255,180,100,0)');
          ctx.fillStyle = g;
          ctx.fillRect(px - 55, py - 55, 110, 110);
        }
      }
    } else if (kind === 'sand') {
      // grainy noise
      const img = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const noise = (rng() - 0.5) * 20;
        img.data[i] = Math.min(255, Math.max(0, img.data[i] + noise));
        img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + noise));
        img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + noise));
      }
      ctx.putImageData(img, 0, 0);
    }
  });
}

/** Simple shop sign texture. */
export function sign(text, background = '#432b32', ink = '#ffe0a6') {
  const width = 256,
    height = 64;
  return makeTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ink;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '1px';
    ctx.fillText(text, w / 2, h / 2);
  });
}

/** Sky gradient texture for golden hour. */
export function skyTexture() {
  const w = 256,
    h = 512;
  return makeTexture(w, h, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#2b2358'); // violet zenith
    grad.addColorStop(0.5, '#9a5a7a'); // mauve-rose
    grad.addColorStop(0.9, '#ff8a3c'); // amber horizon
    grad.addColorStop(1, '#ffb84d'); // sun band glow (bright)
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  });
}

/** Atmospheric additive textures for sprites. */
export function atmosphereTextures() {
  const size = 128;
  // Helper for radial gradient texture
  function radial(colors) {
    return makeTexture(size, size, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      colors.forEach(([stop, col]) => grad.addColorStop(stop, col));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
  }
  const glow = radial([
    [0, 'rgba(255,255,255,0.8)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  const pool = radial([
    [0, 'rgba(255,200,120,0.6)'],
    [1, 'rgba(255,200,120,0)'],
  ]);
  const cone = radial([
    [0, 'rgba(255,160,80,0.5)'],
    [1, 'rgba(255,160,80,0)'],
  ]);
  // tiny spark star
  const spark = makeTexture(size, size, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,200,0.9)';
    ctx.beginPath();
    const cx = w / 2,
      cy = h / 2,
      r = w / 4;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  const smoke = radial([
    [0, 'rgba(120,120,120,0.3)'],
    [1, 'rgba(120,120,120,0)'],
  ]);
  return { glow, pool, cone, spark, smoke };
}

