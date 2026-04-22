# 3. Composing a scene: horizon, haze, stars, focal

Last chapter we got a function that produces cloud-like fields. This chapter
turns that into something that reads as a *place* — a night sky with a
horizon, a soft ground, a moon, a handful of stars. Nothing drawn on top
yet (silhouettes come next chapter); we're just setting the stage.

Along the way we're going to introduce a new file — `js/src/compose.ts` —
and move the render logic out of `cli.ts`. That keeps the CLI as a thin
shell and sets us up for chapter 6, where a React app will call the same
`compose()` against a browser canvas.

## A new file

Create `js/src/compose.ts`:

```typescript
import { Rng } from "./rng.ts";
import { fbm2D, normalizeInPlace } from "./noise.ts";

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
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rng: Rng,
): void {
  // ... body we'll fill in below ...
}
```

A few things to notice.

**`ctx` is a parameter, not a local.** We create the canvas *outside*
`compose()` and hand in the 2D context. That means the Node CLI can pass an
`@napi-rs/canvas` context and the browser can pass a `HTMLCanvasElement`'s
context — identical render code either way.

**`PRESETS` lives here now.** The CLI used to own it; moving it into the
shared core means the web app (chapter 6) can use the same table without
duplicating it.

**`smooth()` is local.** We already have one in `noise.ts`, but it's not
exported; we'll want it here too and the function is tiny enough to dupe.

## The scene, piece by piece

Fill the body of `compose()`:

```typescript
  const minDim = Math.min(width, height);
  const horizonY = height * rng.uniform(0.62, 0.78);

  // Float buffer — we'll write the sky/ground values here, then flush to
  // the canvas at the end.
  const sky = new Float32Array(width * height);
  sky.fill(16);
```

Three important things here.

**`minDim`** is the shorter side of the image. A lot of our scale-dependent
sizes (moon radius, star buffer) want "small enough to look OK on portrait
*and* landscape," so we size relative to the shorter side.

**`horizonY`** is a fractional position between 62% and 78% down the image.
The horizon isn't dead-center; it sits in the lower third, which is where
the human eye expects it when you walk outside and look up.

**`sky.fill(16)`** — we start dark. Value 16 out of 255 is deep gray, nearly
black, but not *actually* black so we have room to add light and still see
it.

> **Float vs uint8.** We're using `Float32Array` (floats) for the
> accumulation buffer, not `Uint8ClampedArray` (bytes). Floats tolerate
> overlapping additions, negative intermediates, and values above 255
> without losing information. We'll clamp to `[0, 255]` right before
> writing to the canvas.

## Sky haze

Add a faint cloud layer on top of the dark base:

```typescript
  const skyHaze = fbm2D(width, height, Math.max(width, height) / 1.5, 4, rng);
  normalizeInPlace(skyHaze.data);
  for (let i = 0; i < sky.length; i++) sky[i] += skyHaze.data[i] * 22;
```

The first line generates a large-scale fBm field. `scale = max(w, h) / 1.5`
means the base octave covers roughly 2/3 of the image diagonal — we want
*atmosphere*, not clouds with edges.

The second line normalizes the field to `[0, 1]` (this is the function we
wrote at the end of chapter 2).

The third line adds 0–22 of brightness on top of the base. So sky pixels
range from 16 (untouched) up to 38 (brightest haze). Still quite dark.

> **Why normalize by actual min/max?** After fBm's own normalization pass
> we *think* we're in `[0, 1]`, but we aren't exactly — the sum of octaves
> has bias toward 0.5 and never quite hits 0 or 1. Using the actual min/max
> gives us real `[0, 1]` so the `* 22` scaling uses the full dynamic range.

## Ground

The ground is a different fBm field, at lower frequency, with gentle
vertical darkening. Since we're already iterating row-by-row for the
horizon blend (next section), we'll combine them:

```typescript
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
```

This is three ideas in one loop:

**`bottomDist`** is 0 at the horizon and 1 at the bottom of the image — a
"how far below the horizon are we" value. We use it to subtract a little
from the ground value (`- bottomDist * 3`), darkening the ground toward
the bottom. Subtle depth cue.

**`groundVal`** is the raw ground brightness at this pixel: `8 + noise * 10
- darkening`. Ranges roughly 5–18. Darker than the sky and with its own
texture.

**The blend.** A sharp `if y > horizonY: ground else: sky` would look
terrible — a hard seam across the image. Instead, we smoothstep the
transition over a 6%-of-height band:

- Above the band (`y < bandStart`): `blendT = 0`, so `blend = 0`, pure sky.
- Below the horizon (`y > horizonY`): `blendT = 1`, so `blend = 1`, pure
  ground.
- Inside the band: smooth interpolation between them.

That `smooth()` call is the same `t*t*(3-2*t)` cubic from chapter 2. It's
load-bearing: linear blending would leave a visible kink at each end of
the band.

> **Try it.** Wire up `compose()` in `cli.ts` (more on that below). You
> should get a dark image with a subtle horizon line — soft, not sharp.
> No focal element yet. It already reads as a place, barely.

## The moon

Two focal options live in the full app: a moon (a soft disc with a wider
glow) and a "seam" (a bright band along the horizon). We'll implement the
moon here; the seam is a variant of the same idea and lives in the repo.

Create `js/src/painters.ts` — this is where we'll accumulate all the
functions that add things to the scene:

```typescript
import type { Rng } from "./rng.ts";
import type { Field } from "./noise.ts";

// Structural 2D context type that satisfies both the browser's
// CanvasRenderingContext2D and @napi-rs/canvas's SKRSContext2D.
export type Ctx2D = CanvasRenderingContext2D;

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
```

Every pixel gets an extra brightness contribution from two Gaussians:

- A small, intense one (`discR` tiny, amplitude 160) — the moon itself.
- A wide, dim one (`auraR` large, amplitude 45) — the glow around it.

`Math.exp(-d²/(2σ²))` is the bell curve. At distance 0 it's 1; at `d = σ`
it's about 0.6; by `d = 3σ` it's essentially zero. Two Gaussians of
different widths gives us the "bright point in a soft halo" look without
ever drawing anything — it's just math on coordinates.

Call it from `compose()` after the horizon blend:

```typescript
  paintFocalMoon({ w: width, h: height, data: sky }, rng, minDim);
```

We're passing `sky` in as a `Field` — the `{ w, h, data }` shape from
`noise.ts`. `paintFocalMoon` writes additive brightness into the buffer.

> **Why not draw a circle?** A perfect filled circle would have a hard
> edge between "inside the moon" and "outside." A Gaussian doesn't have
> edges — it fades everywhere. The moon feels like *light* instead of a
> *shape*.

## Stars

A few hundred stamped pixels in the sky, back in `compose()`:

```typescript
  const nStars = Math.floor((width * height) / 10000);
  const starCeil = Math.max(1, Math.floor(horizonY) - Math.floor(minDim * 0.02));
  for (let i = 0; i < nStars; i++) {
    const sx = rng.integers(0, width);
    const sy = rng.integers(0, starCeil);
    const idx = sy * width + sx;
    const v = rng.uniform(80, 170);
    if (sky[idx] < v) sky[idx] = v;
  }
```

We pick random positions *above* the horizon (the `sy` max is `horizonY`
minus a small buffer so stars don't cluster right on the horizon line),
brightness values in the `[80, 170)` range, and `if (sky[idx] < v) …` to
write them — so a star placed on an already-bright area of sky doesn't
dim it.

Count scales with image area — a 2560×1440 image gets ~370 stars, a mobile
image ~300.

## Flush the buffer to the canvas

We've been accumulating into a float array. The canvas wants bytes. One
pass converts and writes:

```typescript
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < sky.length; i++) {
    const v = Math.max(0, Math.min(255, sky[i]));
    const j = i * 4;
    img.data[j] = img.data[j + 1] = img.data[j + 2] = v;
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
```

`createImageData` gives us a buffer the size of the canvas. Each pixel is 4
bytes (R, G, B, A). We write the same value to R, G, B for grayscale, and
alpha stays at 255 (fully opaque). `putImageData` pushes the buffer to the
canvas.

After this, the canvas is ready for drawing operations — that's chapter 4.

## Wiring it into the CLI

Update `cli.ts` to import from the new files:

```typescript
#!/usr/bin/env -S npx tsx
import { writeFileSync, statSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { Rng, randomSeed } from "./rng.ts";
import { compose, PRESETS, type PresetName } from "./compose.ts";

// ... Args, parseArgs, die unchanged from chapter 1 ...

function main() {
  const args = parseArgs(process.argv.slice(2));

  let w: number, h: number, tag: string;
  if (args.size) {
    [w, h] = args.size;
    tag = `${w}x${h}`;
  } else {
    const preset: PresetName = args.preset ?? "desktop";
    [w, h] = PRESETS[preset];
    tag = preset;
  }

  const seed = args.seed ?? randomSeed();
  const rng = new Rng(seed);
  const out = args.out ?? `wallpaper_${tag}_${seed}.png`;
  console.log(`Generating ${w}x${h} (seed=${seed}) → ${out}`);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  compose(ctx, w, h, rng);
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(`Done. ${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
}

main();
```

The CLI now knows nothing about rendering — it just plumbs args, creates
a canvas, calls `compose(ctx, …)`, and writes the PNG.

> **Try it.** `./genviz.js --mobile`. You should get a dark image with a
> soft horizon, a dim moon somewhere in the upper half, and a scatter of
> stars. No silhouette yet — that's next chapter — but already it reads
> as *night*.

## What you have now

- A `compose()` that paints sky haze, ground with smoothstep horizon, a
  moon focal, and stars — all as additive math on a float buffer, then
  flushed to the canvas at the end.
- A `CanvasRenderingContext2D` parameter that lets the same code run in
  Node and browser.
- A moved-out `PRESETS` table that both the CLI and (later) the web app
  will share.

Every visual element so far comes from stacked math on a coordinate grid.
No drawing operations. Chapter 4 introduces drawing — polygons,
silhouettes, a skyline.

---

**Previous:** [2. Noise: value noise and fBm](./02-noise.md) ·
**Next:** [4. Silhouettes with compositional bias](./04-silhouettes.md)
