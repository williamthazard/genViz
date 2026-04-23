import { Rng } from "./rng.ts";
import { fbm2D, fbm1D, normalizeInPlace } from "./noise.ts";
import {
  paintFocalMoon,
  paintFocalSeam,
  paintSpikes,
  paintTrees,
  paintRuins,
  paintMountains,
  paintShards,
  paintBirds,
  type Ctx2D,
} from "./painters.ts";
import { finish } from "./finish.ts";
import type { Palette } from "./color.ts";

export const FOREGROUNDS = ["spikes", "trees", "ruins", "mountains"] as const;
export const FOCALS = ["moon", "seam", "none"] as const;
export const DRIFTS = ["shards", "birds", "none"] as const;

export type Foreground = typeof FOREGROUNDS[number];
export type Focal = typeof FOCALS[number];
export type Drift = typeof DRIFTS[number];

export const PRESETS = {
  "desktop": [2560, 1440],
  "desktop-4k": [3840, 2160],
  "desktop-5k": [5120, 2880],
  "mobile": [1170, 2532],
  "mobile-xl": [1290, 2796],
  "square": [2048, 2048],
} as const satisfies Record<string, readonly [number, number]>;

export type PresetName = keyof typeof PRESETS;

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// Renders the scene into the provided 2D context. The context's canvas must
// already be sized to (width, height). Caller owns the canvas and is
// responsible for export (toBuffer / toBlob / etc).
export function compose(
  ctx: Ctx2D,
  width: number,
  height: number,
  rng: Rng,
  foreground: Foreground,
  focal: Focal,
  drift: Drift,
  palette: Palette = [],
): void {
  const minDim = Math.min(width, height);
  const horizonY = height * rng.uniform(0.62, 0.78);

  // Float sky/ground buffer.
  const sky = new Float32Array(width * height);
  sky.fill(16);

  const skyHaze = fbm2D(width, height, Math.max(width, height) / 1.5, 4, rng);
  normalizeInPlace(skyHaze.data);
  for (let i = 0; i < sky.length; i++) sky[i] += skyHaze.data[i] * 22;

  const groundNoise = fbm2D(width, height, Math.max(width, height) / 3.0, 4, rng);
  normalizeInPlace(groundNoise.data);

  const band = height * 0.06;
  const bandStart = horizonY - band;
  const groundSpan = Math.max(1, height - horizonY);

  for (let y = 0; y < height; y++) {
    const bottomDist = Math.max(0, Math.min(1, (y - horizonY) / groundSpan));
    const blendT = Math.max(0, Math.min(1, (y - bandStart) / band));
    const blend = smooth(blendT);
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const gn = groundNoise.data[rowOff + x];
      const groundVal = 8 + gn * 10 - bottomDist * 3;
      sky[rowOff + x] = sky[rowOff + x] * (1 - blend) + groundVal * blend;
    }
  }

  if (focal === "moon") paintFocalMoon({ w: width, h: height, data: sky }, rng, minDim);
  else if (focal === "seam") paintFocalSeam({ w: width, h: height, data: sky }, rng, horizonY);

  const nStars = Math.floor((width * height) / 10000);
  const starCeil = Math.max(1, Math.floor(horizonY) - Math.floor(minDim * 0.02));
  for (let i = 0; i < nStars; i++) {
    const sx = rng.integers(0, width);
    const sy = rng.integers(0, starCeil);
    const idx = sy * width + sx;
    const v = rng.uniform(80, 170);
    if (sky[idx] < v) sky[idx] = v;
  }

  const img = ctx.createImageData(width, height);
  for (let i = 0; i < sky.length; i++) {
    const v = Math.max(0, Math.min(255, sky[i]));
    const j = i * 4;
    img.data[j] = img.data[j + 1] = img.data[j + 2] = v;
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const focusX = width * rng.uniform(0.3, 0.7);

  switch (foreground) {
    case "spikes": paintSpikes(ctx, rng, width, height, horizonY, focusX); break;
    case "trees": paintTrees(ctx, rng, width, height, horizonY, focusX); break;
    case "ruins": paintRuins(ctx, rng, width, height, horizonY, focusX); break;
    case "mountains": paintMountains(ctx, rng, width, height, horizonY, focusX, fbm1D, normalizeInPlace); break;
  }

  if (drift === "shards") paintShards(ctx, rng, width, height, horizonY, minDim);
  else if (drift === "birds") paintBirds(ctx, rng, width, height, horizonY, minDim);

  const final = ctx.getImageData(0, 0, width, height);
  finish(final.data, width, height, rng, palette);
  ctx.putImageData(final, 0, 0);
}

// Resolve "random" fields and return the concrete recipe.
export function resolveRecipe(
  rng: Rng,
  foreground: Foreground | "random",
  focal: Focal | "random",
  drift: Drift | "random",
): { foreground: Foreground; focal: Focal; drift: Drift } {
  return {
    foreground: foreground === "random" ? rng.choice(FOREGROUNDS) : foreground,
    focal: focal === "random" ? rng.choice(FOCALS, [0.55, 0.28, 0.17]) : focal,
    drift: drift === "random" ? rng.choice(DRIFTS, [0.35, 0.35, 0.30]) : drift,
  };
}
