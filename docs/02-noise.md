# 2. Noise: value noise and fBm

Last chapter our `compose()` function produced random pixels. Random pixels
look like static. To make something that looks like *anything* — a cloud, a
mountain, a texture — we need *structured* randomness, where nearby pixels
are correlated.

This chapter gives us two tools: **value noise** (smooth random fields) and
**fBm** (layered value noise, which is how natural-looking textures are
actually made).

## The problem with `rng.integers(0, 256)`

In chapter 1 we did:

```typescript
for (let i = 0; i < w * h; i++) {
  const v = rng.integers(0, 256);
  // ...write v to RGB bytes...
}
```

Each pixel is independent of its neighbors. The eye perceives this as noise
— TV static — because there's no correlation at any scale.

What we want is a field where:
- the value at `(x, y)` is close to the value at `(x+1, y)`
- but over hundreds of pixels, values drift
- at thousands of pixels, anything goes

That's **value noise**.

## Value noise, step by step

The idea:

1. Pick a coarse grid (say 10×10 cells over a 1000×1000 image).
2. Put a random number at each grid intersection.
3. For any pixel, find which cell it's in and smoothly interpolate the four
   corner values.

Create `js/src/noise.ts`:

```typescript
import { Rng } from "./rng.ts";

// Flat row-major buffer. Indexing as y*w + x matches how browser ImageData
// is laid out, so later we can move pixels to/from canvases without reshape.
export interface Field {
  w: number;
  h: number;
  data: Float32Array;
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
```

A lot is happening here. Let's unpack.

**`Float32Array`** is a typed array — a fixed-length, continuous buffer of
32-bit floats. Much faster than a regular JavaScript array for numeric work,
and memory-compact. We'll use `Float32Array` for every large numeric buffer
in this project.

**`gh`, `gw`** are the grid dimensions. If `scale=100` and `h=1000`, we make
a 10-row grid. We add 2 as padding so we never go out of bounds during
interpolation.

**`grid`** is `gh * gw` raw random values in `[0, 1)`. We allocate a single
flat buffer and index into it as `y * gw + x`.

**`sy`, `sx`** map each output pixel to a fractional grid cell. Output row 0
maps to grid row 0; row `h-1` maps to grid row `gh-1`.

**`y0`, `y1`, `ty`** are the integer grid rows above and below the pixel,
and the fractional position between them (0 at `y0`, 1 at `y1`).

**`ty * ty * (3 - 2 * ty)`** is the magic line. It's a cubic smoothstep: a
function that's 0 at t=0, 1 at t=1, and has zero slope at both ends.

> **Why not linear interpolation?** If you interpolate between corners
> linearly — `ty` by itself — the derivative has sharp kinks at the grid
> lines. Your eye sees those as faint seams. Smoothstep rounds the
> transition so the field looks continuous.

The last few lines are bilinear interpolation: first along x (top edge
between `a`/`b`, bottom edge between `c`/`d`), then along y between those
two.

> **Try it.** Import `valueNoise2D` into `cli.ts` and replace the body of
> `compose()`:
>
> ```typescript
> import { valueNoise2D } from "./noise.ts";
>
> function compose(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng): void {
>   const field = valueNoise2D(w, h, 200, rng);
>   const img = ctx.createImageData(w, h);
>   for (let i = 0; i < field.data.length; i++) {
>     const v = Math.max(0, Math.min(255, field.data[i] * 255));
>     const j = i * 4;
>     img.data[j] = img.data[j + 1] = img.data[j + 2] = v;
>     img.data[j + 3] = 255;
>   }
>   ctx.putImageData(img, 0, 0);
> }
> ```
>
> You should see soft gray blobs. Change `scale` to 20 and rerun — blobs get
> smaller. Change to 2000 and rerun — one giant blob. That's the whole
> trick.

## One octave isn't enough

Pure value noise looks like gently lit cotton. Real textures — clouds, rock
faces, ocean waves — have detail at every scale. A coastline isn't just a
wiggly line; it's wiggles with wiggles on top, and wiggles on those.

This is what **fractal Brownian motion (fBm)** gives us: we sum several
value noise fields, each at a smaller scale and with less amplitude.

Append to `noise.ts`:

```typescript
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
```

Each octave:
- contributes **half** the amplitude of the previous one (`amp *= 0.5`)
- has **half** the scale, i.e. twice the frequency (`s *= 0.5`)

Dividing by `total` at the end keeps the result in roughly `[0, 1)` no
matter how many octaves you use.

> **Why halving?** These ratios — amplitude 1/2, frequency 2× — give you a
> *1/f* or "pink" noise spectrum, which happens to be what shows up all
> over nature: clouds, terrain, music, neural firing rates. It's not magic;
> it's just what emerges from processes that combine many independent
> scales. But matching it makes our output look natural.

> **Try it.** Call `fbm2D(w, h, Math.max(w, h) / 2, 5, rng)` from compose().
> The first octave covers about half the image; by octave 5 you've got
> crispy detail down to `w/32` pixels. The result should look like a
> satellite photo or a cloud.

## We'll also need 1D fBm

For drawing mountain ridges later, we want a noise function of a single
variable — a profile line that wiggles. The logic is identical, just one
dimension smaller:

```typescript
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
```

Same structure as the 2D case, collapsed by one axis. We'll use this in
chapter 4 for mountain silhouettes.

## A small utility: normalize in place

One more thing we'll use often: stretching a noise field so its range is
exactly `[0, 1]`. Noise can drift slightly above or below; we want to grab
the full dynamic range before blending.

```typescript
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
```

Nothing clever — one pass for min/max, one pass for rescale. The `|| 1e-9`
guards against a flat field (min === max) that would divide by zero.

## What you have now

- `valueNoise2D(w, h, scale, rng)` — smooth random fields
- `fbm2D(w, h, scale, octaves, rng)` — layered value noise with natural-
  looking detail
- `fbm1D(length, scale, octaves, rng)` — 1D version
- `normalizeInPlace(data)` — stretch a buffer to `[0, 1]`

Set `compose()` to render `fbm2D(w, h, w/2, 5, rng)` and run it. That's a
cloud. That's a texture. That's structured randomness.

Next chapter: we turn that cloud into a scene.

---

**Previous:** [1. A Node CLI that prints a PNG](./01-node-cli.md) ·
**Next:** [3. Composing a scene](./03-scene.md)
