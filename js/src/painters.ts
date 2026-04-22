import type { Rng } from "./rng.ts";
import type { Field } from "./noise.ts";

// Structural 2D context type that satisfies both the browser's
// CanvasRenderingContext2D and @napi-rs/canvas's SKRSContext2D.
export type Ctx2D = CanvasRenderingContext2D;

// ---------- focal painters: additive on float field ----------

export function paintFocalMoon(arr: Field, rng: Rng, minDim: number): void {
  const { w, h, data } = arr;
  const cx = w * rng.uniform(0.22, 0.78);
  const cy = h * rng.uniform(0.16, 0.48);
  const discR = minDim * rng.uniform(0.018, 0.038);
  const auraR = minDim * rng.uniform(0.12, 0.22);
  const d2Disc = 2 * discR * discR;
  const d2Aura = 2 * auraR * auraR;
  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const d2 = dx * dx + dy * dy;
      const disc = Math.exp(-d2 / d2Disc);
      const aura = Math.exp(-d2 / d2Aura);
      data[y * w + x] += disc * 160 + aura * 45;
    }
  }
}

export function paintFocalSeam(arr: Field, rng: Rng, horizonY: number): void {
  const { w, h, data } = arr;
  const sunX = w * rng.uniform(0.28, 0.72);
  const lateralSigma = w * rng.uniform(0.22, 0.38);
  const seamPx = h * rng.uniform(0.0025, 0.006);
  const glowPx = h * rng.uniform(0.04, 0.10);
  const d2Lat = 2 * lateralSigma * lateralSigma;
  const d2Seam = 2 * seamPx * seamPx;

  for (let y = 0; y < h; y++) {
    const dyh = y - horizonY;
    const seam = Math.exp(-(dyh * dyh) / d2Seam);
    const glowMask = Math.max(0, horizonY - y) / Math.max(1, glowPx);
    const glow = Math.exp(-(glowMask * glowMask) / 2);
    for (let x = 0; x < w; x++) {
      const dx = x - sunX;
      const lateral = Math.exp(-(dx * dx) / d2Lat);
      data[y * w + x] += seam * lateral * 200 + glow * lateral * 55;
    }
  }
}

// ---------- compositional attractor ----------

export function attractorX(
  rng: Rng,
  width: number,
  focusX: number,
  spread = 0.22,
  framingP = 0.25,
): number {
  if (rng.random() < framingP) return rng.uniform(-width * 0.05, width * 1.05);
  return focusX + rng.normal(0, width * spread);
}

// ---------- helpers for Canvas drawing ----------

function gray(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return `rgb(${v},${v},${v})`;
}

function fillPolygon(ctx: Ctx2D, pts: [number, number][], shade: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = gray(shade);
  ctx.fill();
}

// ---------- foreground painters ----------

export function paintSpikes(
  ctx: Ctx2D,
  rng: Rng,
  width: number,
  height: number,
  horizonY: number,
  focusX: number,
): void {
  const n = rng.integers(55, 100);
  for (let i = 0; i < n; i++) {
    const baseX = attractorX(rng, width, focusX);
    const spikeH = rng.uniform(height * 0.06, height * 0.38);
    const tilt = rng.uniform(-0.25, 0.25);
    const baseW = rng.uniform(width * 0.008, width * 0.035);
    const tip: [number, number] = [baseX + tilt * spikeH, horizonY - spikeH];
    const pts: [number, number][] = [
      [baseX - baseW / 2, height],
      [baseX + baseW / 2, height],
      [baseX + baseW / 2, horizonY],
      tip,
      [baseX - baseW / 2, horizonY],
    ];
    fillPolygon(ctx, pts, rng.integers(3, 16));
  }
}

export function paintTrees(
  ctx: Ctx2D,
  rng: Rng,
  width: number,
  height: number,
  horizonY: number,
  focusX: number,
): void {
  const n = rng.integers(25, 55);
  for (let i = 0; i < n; i++) {
    const baseX = attractorX(rng, width, focusX, 0.25);
    const treeH = rng.uniform(height * 0.05, height * 0.30);
    const treeW = treeH * rng.uniform(0.10, 0.22);
    const lean = rng.uniform(-treeW * 0.3, treeW * 0.3);
    const pts: [number, number][] = [
      [baseX + lean, horizonY - treeH],
      [baseX + treeW, horizonY],
      [baseX - treeW, horizonY],
    ];
    fillPolygon(ctx, pts, rng.integers(2, 12));
  }
}

export function paintRuins(
  ctx: Ctx2D,
  rng: Rng,
  width: number,
  height: number,
  horizonY: number,
  focusX: number,
): void {
  const n = rng.integers(18, 40);
  for (let i = 0; i < n; i++) {
    const baseX = attractorX(rng, width, focusX, 0.20);
    const bH = rng.uniform(height * 0.03, height * 0.24);
    const bW = rng.uniform(width * 0.006, width * 0.035);
    const shade = rng.integers(2, 12);
    let pts: [number, number][];
    if (rng.random() < 0.72) {
      pts = [
        [baseX - bW / 2, horizonY],
        [baseX - bW / 2, horizonY - bH],
        [baseX + bW / 2, horizonY - bH],
        [baseX + bW / 2, horizonY],
      ];
    } else {
      const peakX = baseX + rng.uniform(-bW * 0.2, bW * 0.2);
      pts = [
        [baseX - bW / 2, horizonY],
        [baseX - bW / 2, horizonY - bH * 0.9],
        [peakX, horizonY - bH],
        [baseX + bW / 2, horizonY - bH * 0.9],
        [baseX + bW / 2, horizonY],
      ];
    }
    fillPolygon(ctx, pts, shade);
  }
}

export function paintMountains(
  ctx: Ctx2D,
  rng: Rng,
  width: number,
  height: number,
  horizonY: number,
  _focusX: number,
  fbm1DFn: (length: number, scale: number, octaves: number, rng: Rng) => Float32Array,
  normalize: (a: Float32Array) => void,
): void {
  const nRidges = rng.integers(2, 5);
  for (let i = 0; i < nRidges; i++) {
    const depth = i / Math.max(1, nRidges - 1);
    const shade = Math.round(24 - depth * 18);
    const maxAmp = height * (0.08 + depth * 0.18);
    const minAmp = height * (0.02 + depth * 0.04);
    const yOffset = -depth * height * 0.03;
    const scale = width / rng.uniform(2.0, 4.5);
    const profile = fbm1DFn(width, scale, 4, rng);
    normalize(profile);
    const pts: [number, number][] = [];
    for (let x = 0; x < width; x++) {
      const y = horizonY + yOffset - (profile[x] * (maxAmp - minAmp) + minAmp);
      pts.push([x, y]);
    }
    pts.push([width, height]);
    pts.push([0, height]);
    fillPolygon(ctx, pts, shade);
  }
}

// ---------- mid-ground drift painters ----------

export function paintShards(
  ctx: Ctx2D,
  rng: Rng,
  width: number,
  _height: number,
  horizonY: number,
  minDim: number,
): void {
  const n = rng.integers(8, 20);
  for (let i = 0; i < n; i++) {
    const fx = rng.uniform(0, width);
    const fy = rng.uniform(_height * 0.05, horizonY * 0.9);
    const size = rng.uniform(minDim * 0.005, minDim * 0.022);
    const a = rng.uniform(0, 2 * Math.PI);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const local: [number, number][] = [
      [0, -size],
      [size * 0.22, size * 0.18],
      [-size * 0.22, size * 0.18],
    ];
    const pts = local.map(([px, py]): [number, number] => [
      fx + px * c - py * s,
      fy + px * s + py * c,
    ]);
    fillPolygon(ctx, pts, rng.integers(10, 35));
  }
}

export function paintBirds(
  ctx: Ctx2D,
  rng: Rng,
  width: number,
  height: number,
  horizonY: number,
  minDim: number,
): void {
  const startX = rng.uniform(-width * 0.1, width * 0.25);
  const endX = rng.uniform(width * 0.75, width * 1.1);
  const startY = rng.uniform(height * 0.25, horizonY * 0.75);
  const endY = rng.uniform(height * 0.25, horizonY * 0.75);
  const ctrlX = rng.uniform(width * 0.35, width * 0.65);
  const ctrlY = rng.uniform(height * 0.10, horizonY * 0.55);
  const n = rng.integers(30, 65);
  const lineW = Math.max(2, Math.round(minDim * 0.003));
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const t = rng.beta(1.8, 1.8);
    const mt = 1 - t;
    let px = mt * mt * startX + 2 * mt * t * ctrlX + t * t * endX;
    let py = mt * mt * startY + 2 * mt * t * ctrlY + t * t * endY;
    px += rng.normal(0, width * 0.025);
    py += rng.normal(0, height * 0.04);
    const size = minDim * rng.uniform(0.010, 0.022);
    const tilt = rng.uniform(-0.25, 0.25);
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    const local: [number, number][] = [
      [-size, -size * 0.35],
      [0, 0],
      [size, -size * 0.35],
    ];
    const pts = local.map(([lx, ly]): [number, number] => [
      px + lx * c - ly * s,
      py + lx * s + ly * c,
    ]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.strokeStyle = gray(rng.integers(2, 20));
    ctx.stroke();
  }
}
