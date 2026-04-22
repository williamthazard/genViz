import { Rng, randomSeed } from "@core/rng.ts";
import {
  compose,
  resolveRecipe,
  FOREGROUNDS,
  FOCALS,
  DRIFTS,
  PRESETS,
  type Foreground,
  type Focal,
  type Drift,
  type PresetName,
} from "@core/compose.ts";

export { Rng, randomSeed, compose, resolveRecipe, FOREGROUNDS, FOCALS, DRIFTS, PRESETS };
export type { Foreground, Focal, Drift, PresetName };

// Render into an existing canvas. Resizes it if needed, then composes.
export function render(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  seed: number,
  foreground: Foreground,
  focal: Focal,
  drift: Drift,
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  const rng = new Rng(seed);
  compose(ctx, width, height, rng, foreground, focal, drift);
}
