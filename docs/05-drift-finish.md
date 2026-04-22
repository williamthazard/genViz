# 5. Drift, dither, and the finish pass

The scene is readable. This chapter adds two kinds of polish:

- **Drift:** mid-ground elements (birds, shards) that bridge the foreground
  silhouette and the sky.
- **Finish:** a global post-processing pass that gives the image its
  illustrated, nullscape-y look via Bayer dithering, a vignette, and a touch
  of grain.

## Drift: birds in a Bézier arc

A flock of birds isn't a straight line; it's a gentle arc. The math for "a
smooth curve between two points" is a **quadratic Bézier curve**, which
uses three control points and a parameter `t` that walks from 0 to 1:

```
P(t) = (1-t)² · P0 + 2(1-t)t · P1 + t² · P2
```

`P0` is the start, `P2` is the end, `P1` is the "pull" point. If you
sample `t` in the middle-biased way and pick random control points in the
upper half of the image, you get a believable flock trajectory.

Add to `js/src/painters.ts`:

```typescript
export function paintBirds(
  ctx: Ctx2D, rng: Rng, width: number, height: number,
  horizonY: number, minDim: number,
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
    ctx.strokeStyle = `rgb(${rng.integers(2, 20)},${rng.integers(2, 20)},${rng.integers(2, 20)})`;
    ctx.stroke();
  }
}
```

Lots going on. The slow parts:

**`rng.beta(1.8, 1.8)`** gives us `t` — but biased. Beta(α, α) with α > 1
is a symmetric distribution that clusters around 0.5. So birds are more
likely to appear in the middle of the arc than at the very ends, which is
what a flock looks like (the leader and the stragglers are sparser than
the middle).

We need `rng.beta()` — add it to the `Rng` class. Jöhnk's algorithm is a
simple rejection sampler:

```typescript
beta(a: number, b: number): number {
  while (true) {
    const u = Math.pow(this.random(), 1 / a);
    const v = Math.pow(this.random(), 1 / b);
    const s = u + v;
    if (s > 0 && s <= 1) return u / s;
  }
}
```

**`px += rng.normal(0, width * 0.025)`** — perturb each bird off the
curve by a little Gaussian jitter. Exactly-on-the-curve birds look
robotic; slight scatter feels organic.

**The bird shape.** Each bird is three points — left wing, body, right
wing — drawn as two line segments (a V). `tilt` rotates the whole bird
so individual birds point in slightly different directions. The
rotation uses the standard 2D matrix: `[c -s; s c]` applied to local
coordinates, then translated into world coordinates. You'll use this
pattern any time you want to draw a rotated symbol.

**`ctx.lineWidth` + `ctx.lineCap = "round"`** set the stroke style for
all the birds before the loop. In Canvas, stroke properties are context
state — set them once, they apply to every `stroke()` until changed.

**`rng.integers(2, 20)`** keeps birds very dark — they're silhouetted
against the sky haze and need to stay below it in brightness.

Also throw in a simpler alternative drift — triangular shards floating in
the sky — for variety:

```typescript
export function paintShards(
  ctx: Ctx2D, rng: Rng, width: number, height: number,
  horizonY: number, minDim: number,
): void {
  const n = rng.integers(8, 20);
  for (let i = 0; i < n; i++) {
    const fx = rng.uniform(0, width);
    const fy = rng.uniform(height * 0.05, horizonY * 0.9);
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
```

Same rotation trick: define the shape in local coordinates, then rotate
and translate into world coordinates.

## Calling drift from `compose()`

Same dispatcher idea as with foregrounds. In `compose.ts`:

```typescript
export const DRIFTS = ["shards", "birds", "none"] as const;
export type Drift = typeof DRIFTS[number];
```

And in `resolveRecipe()`:

```typescript
drift: drift === "random" ? rng.choice(DRIFTS, [0.35, 0.35, 0.30]) : drift,
```

The `[0.35, 0.35, 0.30]` weights are a probability distribution: 35%
shards, 35% birds, 30% nothing. "Nothing" is a valid option — not every
scene needs drift.

Then, in `compose()`, after the foreground dispatch:

```typescript
if (drift === "shards") paintShards(ctx, rng, width, height, horizonY, minDim);
else if (drift === "birds") paintBirds(ctx, rng, width, height, horizonY, minDim);
```

## The finish pass

Now the pièce de résistance. Our current output has smooth gradients and
no real texture in the sky. Night scenes in old illustrations often have
a *dithered* quality — a regular pattern of pixels, like halftone
printing.

Bayer dithering is the classic way to do this. It's an ordered matrix of
threshold values. For each pixel, you quantize the value to a limited
set of gray levels, but you perturb the quantization threshold by an
amount that depends on where the pixel is in the image.

Here's the 8×8 Bayer matrix we'll use, normalized to `[0, 1)`. Add to
`noise.ts`:

```typescript
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
```

Notice how the values spread evenly — any 2×2 block contains one low,
one medium-low, one medium-high, one high. Tile this 8×8 pattern across
the image and you have a per-pixel dithering threshold.

## Applying it

Create `js/src/finish.ts`:

```typescript
import { BAYER8 } from "./noise.ts";
import { Rng } from "./rng.ts";

export function finish(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  rng: Rng,
  vignetteStrength = 0.07,
  levels = 24,
): void {
  const step = 255 / (levels - 1);
  const halfW = w / 2;
  const halfH = h / 2;

  for (let y = 0; y < h; y++) {
    const bayerRow = (y & 7) * 8;
    const yn = (y - halfH) / halfH;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const threshold = BAYER8[bayerRow + (x & 7)];
      let v = rgba[i] + rng.normal(0, 2);
      v = Math.round(v / step + (threshold - 0.5)) * step;
      const xn = (x - halfW) / halfW;
      const r2 = xn * xn + yn * yn;
      const vig = Math.max(0, Math.min(1, 1 - vignetteStrength * r2));
      v = Math.max(0, Math.min(255, v * vig));
      rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
      // alpha stays 255
    }
  }
}
```

Piece by piece:

**Input.** The function takes the raw `Uint8ClampedArray` from an
`ImageData` object — RGBA bytes in row-major order. We mutate it in
place; the caller will `putImageData` it back to the canvas.

**Grain:** `rng.normal(0, 2)` adds subtle Gaussian noise. A few shades of
random variation per pixel — film grain, basically.

**Threshold lookup:** `BAYER8[bayerRow + (x & 7)]` reads from the
repeating 8×8 tile. `y & 7` is `y % 8` — bitwise AND with 7 masks to the
bottom three bits, which is the same as mod 8 and a bit faster. We
precompute `bayerRow = (y & 7) * 8` once per row.

**Quantize with dither:** The line
`v = Math.round(v / step + (threshold - 0.5)) * step` does the actual
dithering. Break it down:

1. `v / step` — rescale to "quantization-step units." If `levels = 24`,
   `step ≈ 11`, so the value 100 becomes 100/11 ≈ 9.1.
2. `+ (threshold - 0.5)` — nudge the value by −0.5..+0.5 depending on
   the Bayer pattern. Centered on zero so we don't systematically
   brighten or darken.
3. `Math.round(...)` — snap to the nearest integer step.
4. `* step` — rescale back to `[0, 255]`.

The net effect: adjacent pixels with nearly identical original values
will quantize to *different* final values (if the threshold nudges them
across a step boundary). Your eye interprets the pattern as texture.
Gradients no longer look continuous; they look illustrated.

> **Why 24 levels?** Trial and error. Fewer levels (say 8) makes the
> dithering very obvious — posterized. More (say 64) makes it almost
> invisible. Twenty-four is where the effect is visible but not loud.

**Vignette:** the last few lines. `r2` is the squared normalized distance
from the image center. `vig = 1 - 0.07 * r²` dims the corners gently.
Multiplying the value by `vig` darkens toward the edges. You almost
don't notice it consciously; you just feel like the image has depth.

**RGB write.** Since our image is grayscale (R = G = B), we write the
same value to all three channels. Alpha stays 255.

## Plumbing it all together

At the bottom of `compose()`:

```typescript
  const final = ctx.getImageData(0, 0, width, height);
  finish(final.data, width, height, rng);
  ctx.putImageData(final, 0, 0);
```

We call `getImageData` to read *everything* that's been drawn — the sky
buffer, the focal element, the stars, the silhouettes, the drift — as
one big RGBA array. Run that through `finish()`. Flush the result back
with `putImageData`.

> **Try it.** Render a handful. The sky should now have a subtle
> crosshatch pattern when you look closely. Gradients feel illustrated,
> not airbrushed. The corners are slightly darker than the center.
> Without any of these changes the image looks like a video game render;
> with them it looks like a print.

## Adding `focal` and `drift` to the CLI

In `compose.ts`, finalize the signature:

```typescript
export const FOCALS = ["moon", "seam", "none"] as const;
export type Focal = typeof FOCALS[number];

export function compose(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  rng: Rng,
  foreground: Foreground,
  focal: Focal,
  drift: Drift,
): void { /* ... */ }

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
```

The focal weights `[0.55, 0.28, 0.17]` favor the moon (55%), then seam
(28%), then nothing (17%) — moons are the most flattering and seams
only work with certain foregrounds, so we tilt.

Parallel `--focal` and `--drift` args in `cli.ts`, matching the
`--foreground` pattern.

## What you have now

- A full TypeScript generator that produces nice, compositionally-aware,
  dithered, dark, restrained B&W wallpapers.
- Four foregrounds, two focal elements, two drift options — plus the
  option of "none" for either.
- A finish pass that ties the look together.

This is the whole rendering core. Your `js/src/` is probably around 700
lines across all six files.

Next we take this core and wrap it in a React app, so anyone with a
browser can generate wallpapers without installing anything. The
rendering code doesn't change at all — the SPA just calls the same
`compose()` against a browser canvas.

---

**Previous:** [4. Silhouettes with compositional bias](./04-silhouettes.md) ·
**Next:** [6. A React SPA around the renderer](./06-react-spa.md)
