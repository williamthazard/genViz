import { Rng } from "./rng.ts";

// Flat (h*w) Float32 buffer, row-major. Keeps numpy-style indexing via y*w+x.
export interface Field {
  w: number;
  h: number;
  data: Float32Array;
}

export function makeField(w: number, h: number, fill = 0): Field {
  const data = new Float32Array(w * h);
  if (fill !== 0) data.fill(fill);
  return { w, h, data };
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise2D(w: number, h: number, scale: number, rng: Rng): Field {
  const gh = Math.max(2, Math.floor(h / scale) + 2);
  const gw = Math.max(2, Math.floor(w / scale) + 2);
  const grid = new Float32Array(gh * gw);
  for (let i = 0; i < grid.length; i++) grid[i] = rng.random();

  const out = new Float32Array(w * h);
  const sy = (gh - 1) / Math.max(1, h - 1);
  const sx = (gw - 1) / Math.max(1, w - 1);

  for (let y = 0; y < h; y++) {
    const fy = y * sy;
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, gh - 1);
    const ty = smooth(fy - y0);
    for (let x = 0; x < w; x++) {
      const fx = x * sx;
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, gw - 1);
      const tx = smooth(fx - x0);
      const a = grid[y0 * gw + x0];
      const b = grid[y0 * gw + x1];
      const c = grid[y1 * gw + x0];
      const d = grid[y1 * gw + x1];
      const top = a * (1 - tx) + b * tx;
      const bot = c * (1 - tx) + d * tx;
      out[y * w + x] = top * (1 - ty) + bot * ty;
    }
  }
  return { w, h, data: out };
}

export function fbm2D(w: number, h: number, scale: number, octaves: number, rng: Rng): Field {
  const out = new Float32Array(w * h);
  let amp = 1;
  let total = 0;
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    const layer = valueNoise2D(w, h, s, rng).data;
    for (let i = 0; i < out.length; i++) out[i] += amp * layer[i];
    total += amp;
    amp *= 0.5;
    s *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return { w, h, data: out };
}

export function fbm1D(length: number, scale: number, octaves: number, rng: Rng): Float32Array {
  const out = new Float32Array(length);
  let amp = 1;
  let total = 0;
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    const nPts = Math.max(2, Math.floor(length / s) + 2);
    const pts = new Float32Array(nPts);
    for (let i = 0; i < nPts; i++) pts[i] = rng.random();
    const step = (nPts - 1) / Math.max(1, length - 1);
    for (let x = 0; x < length; x++) {
      const fx = x * step;
      const i0 = Math.floor(fx);
      const i1 = Math.min(i0 + 1, nPts - 1);
      const t = smooth(fx - i0);
      out[x] += amp * (pts[i0] * (1 - t) + pts[i1] * t);
    }
    total += amp;
    amp *= 0.5;
    s *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

export function normalizeInPlace(data: Float32Array): void {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1e-9;
  for (let i = 0; i < data.length; i++) data[i] = (data[i] - min) / range;
}

// 8x8 Bayer matrix, normalized to [0, 1). Matches the Python _BAYER8.
export const BAYER8 = new Float32Array([
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
].map(v => v / 64));
