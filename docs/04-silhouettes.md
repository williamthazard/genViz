# 4. Silhouettes with compositional bias

We have a night sky and a moon. What we don't have is a *subject*. The eye
wants something dark and near to anchor the composition — trees, ruins,
spikes, mountains. Something that reads as *the thing in front of you*.

This chapter is two parts. First: how to draw those silhouettes. Second:
how to place them so the image feels *composed* instead of *sprinkled*.

## Switching from buffer to drawing

The sky, ground, moon, and stars are all pure math on `Float32Array`.
Silhouettes are different: we want sharp edges, polygonal shapes, overlap.
The clean way to do that is the Canvas 2D API — `beginPath`, `moveTo`,
`lineTo`, `fill`. This is what the browser uses for `<canvas>` drawing,
and it's what `@napi-rs/canvas` implements.

In chapter 3, at the end of `compose()`, we called `ctx.putImageData(img,
0, 0)` — that flushed our float buffer onto the canvas as pixels. After
that call, the canvas is a live bitmap and we can draw over it.

## A foreground drawing helper

Two helpers in `painters.ts` we'll use for every silhouette:

```typescript
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
```

`gray(n)` converts a 0–255 number to a CSS color string. `fillPolygon`
takes an array of `[x, y]` points and a grayscale value, traces the
polygon, and fills it. That's all we need for silhouettes.

> **Why the `rgb(n,n,n)` detour?** Canvas's `fillStyle` accepts CSS color
> strings, not numeric gray values. In Pillow we could say `fill=shade`
> directly; in Canvas it's `fillStyle = "rgb(12,12,12)"`. The `gray()`
> helper absorbs the difference.

## A forest of triangles

Let's start with trees — the simplest foreground. Each tree is a triangle:
base on the horizon, tip above. Append to `painters.ts`:

```typescript
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
```

Let's walk through it.

**`n = rng.integers(25, 55)`** — between 25 and 54 trees.

**`baseX`** is *where on the horizon the tree sits*. This is the line
we'll come back to in a minute — it's calling `attractorX`, not
`rng.uniform`, and that's the whole trick of this chapter.

**`treeH`** is 5–30% of image height. Variety of heights makes the forest
feel organic; uniform heights feel like a picket fence.

**`treeW`** is 10–22% of the height. Short, squat trees read as distant;
tall skinny ones read as close.

**`lean`** is a small horizontal offset applied to the tip. Without lean,
every tree points straight up and the forest feels regimented. With lean,
it feels like wind has been blowing here for a while.

**`pts`** is three points: tip, then the two base corners. `fillPolygon`
fills the triangle.

**`rng.integers(2, 12)`** picks a grayscale fill between 2 and 11 — near-
black, but with variation — so some trees will be visibly darker than
others, giving a crude depth cue.

## The attractor — why placement matters

Here's the part of `paintTrees` that changed the whole project:

```typescript
const baseX = attractorX(rng, width, focusX, 0.25);
```

We *could* have written `const baseX = rng.uniform(0, width)`. It's
shorter. But the result is worse in a very specific way: the trees end up
evenly distributed, and evenly-distributed objects don't read as a
*scene*, they read as a *texture*. The eye has nowhere to go.

Real landscapes aren't uniform. There's a cluster, and then it thins out.
A crowd has a center. A forest has density.

So we bias placement toward a chosen focus point:

```typescript
// Bias placement toward a compositional focus point, with occasional
// uniform draws so edges still get populated for framing context.
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
```

Two modes:

- **75% of the time** (`framingP = 0.25`): sample from a Gaussian centered
  on `focusX` with standard deviation `spread * width`. Most trees cluster
  around the focus, with fewer at distance.
- **25% of the time**: sample uniformly across the image (plus a little
  overhang). This keeps the edges populated so the image doesn't look
  like a blob of trees on an empty field.

We need `rng.normal()` here — we didn't write that in chapter 1 because
we didn't need it yet. Add it to the `Rng` class in `rng.ts`:

```typescript
private spare: number | null = null;

normal(mean = 0, std = 1): number {
  if (this.spare !== null) {
    const s = this.spare;
    this.spare = null;
    return mean + std * s;
  }
  const u1 = Math.max(this.random(), 1e-12);
  const u2 = this.random();
  const mag = Math.sqrt(-2 * Math.log(u1));
  const z0 = mag * Math.cos(2 * Math.PI * u2);
  const z1 = mag * Math.sin(2 * Math.PI * u2);
  this.spare = z1;
  return mean + std * z0;
}
```

> **Why a Normal distribution?** Bell curves *are* how natural
> distributions look. A cluster with a center, falling off at the tails.
> A uniform distribution has no center — it's conceptually flat, and the
> eye reads it that way.

> **Box-Muller.** The algorithm above generates two independent standard
> normals from two uniforms. We return the first and stash the second for
> the next call — so every other `normal()` call is essentially free.

**`focusX`** comes from `compose()`. Add this above the `paintForeground`
call:

```typescript
const focusX = width * rng.uniform(0.3, 0.7);
```

A random point in the middle 40% of the width. Not dead-center — that
would be boring — but generally in the interesting part.

This single change is responsible for most of the "why do these images
look composed" feeling. Skipping the attractor and reverting to uniform
placement is the easiest before/after test you can run.

> **Try it.** Call `paintTrees(ctx, rng, width, height, horizonY, focusX)`
> from `compose()` after the `putImageData` flush. Render and compare to
> a version where `baseX = rng.uniform(0, width)`. The clustered version
> feels like a place; the uniform one feels like wallpaper.

## Other foregrounds

Three more silhouettes follow the same structure as trees but use
different primitive shapes. Here's a brief tour; the full code is in
`js/src/painters.ts`.

**Ruins** — mostly flat-topped rectangles, occasionally with a small
peak (broken wall / pitched roof). Creates a city-at-night silhouette:

```typescript
export function paintRuins(
  ctx: Ctx2D, rng: Rng, width: number, height: number,
  horizonY: number, focusX: number,
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
```

The 72/28 split is the *weighted coin flip* that makes the skyline feel
varied but still predominantly rectangular.

**Spikes** — aggressive pointed shapes that tilt. Feels like a bramble or
a dystopian landscape. A spike is a five-point polygon: a triangle
sitting on a rectangle. The rectangle part runs from the horizon down to
the image bottom — without it, the ground below would show through
between spikes.

**Mountains** — a continuous ridge profile rather than discrete shapes.
Uses our `fbm1D` from chapter 2:

```typescript
export function paintMountains(
  ctx: Ctx2D, rng: Rng, width: number, height: number,
  horizonY: number, _focusX: number,
): void {
  const nRidges = rng.integers(2, 5);
  for (let i = 0; i < nRidges; i++) {
    const depth = i / Math.max(1, nRidges - 1);  // 0 = back, 1 = front
    const shade = Math.round(24 - depth * 18);   // lighter behind, darker in front
    const maxAmp = height * (0.08 + depth * 0.18);
    const minAmp = height * (0.02 + depth * 0.04);
    const yOffset = -depth * height * 0.03;
    const scale = width / rng.uniform(2.0, 4.5);
    const profile = fbm1D(width, scale, 4, rng);
    normalizeInPlace(profile);
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
```

Each ridge is one polygon with `width + 2` vertices: one per column of
the image (the silhouette profile), plus two corners at the bottom to
close it off. Front ridges are taller and darker; back ridges are dimmer
and shorter — this *atmospheric perspective* sells the depth.

> **Why no attractor for mountains?** Mountains are continuous, not
> discrete. The "focus" of a ridge line is its peak, which is already
> emergent from the fBm profile. Nothing to cluster.

## Picking a foreground

We don't want every render to be the same kind of silhouette; we want
the caller to be able to say "give me trees" or "surprise me." Export a
list of names from `compose.ts` so the CLI and (later) the browser can
enumerate the choices:

```typescript
export const FOREGROUNDS = ["spikes", "trees", "ruins", "mountains"] as const;
export type Foreground = typeof FOREGROUNDS[number];
```

Then, in `compose()`, after the sky/ground/moon work and the focusX
declaration:

```typescript
switch (foreground) {
  case "spikes": paintSpikes(ctx, rng, width, height, horizonY, focusX); break;
  case "trees": paintTrees(ctx, rng, width, height, horizonY, focusX); break;
  case "ruins": paintRuins(ctx, rng, width, height, horizonY, focusX); break;
  case "mountains": paintMountains(ctx, rng, width, height, horizonY, focusX); break;
}
```

And take `foreground` as a parameter:

```typescript
export function compose(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  rng: Rng,
  foreground: Foreground,
): void { /* ... */ }
```

The `switch` is trivially TypeScript-exhaustive (if we add a fifth
foreground to the union, TS will warn that `switch` misses it).

## Handling "random" in the CLI

We want `./genviz.js` to pick randomly by default, so we need a
`"random"` sentinel that the top-level driver resolves to a concrete
choice before calling `compose()`. Add to `compose.ts`:

```typescript
export function resolveRecipe(
  rng: Rng, foreground: Foreground | "random",
): { foreground: Foreground } {
  return {
    foreground: foreground === "random" ? rng.choice(FOREGROUNDS) : foreground,
  };
}
```

`rng.choice()` picks uniformly from an array. Add it to `rng.ts`:

```typescript
choice<T>(arr: readonly T[], weights?: readonly number[]): T {
  if (!weights) return arr[this.integers(0, arr.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = this.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}
```

With optional weights: iterate, subtract from a running random total,
return the bucket where total went negative. Standard discrete
distribution sampling. We'll use the weighted form next chapter for
focal/drift selection.

In `cli.ts`, add a `--foreground` arg:

```typescript
else if (a === "--foreground") {
  const v = argv[++i];
  if (v !== "random" && !FOREGROUNDS.includes(v as Foreground)) die(`bad --foreground: ${v}`);
  args.foreground = v as Foreground | "random";
}
```

And plumb it through `main()`:

```typescript
const { foreground } = resolveRecipe(rng, args.foreground ?? "random");
compose(ctx, w, h, rng, foreground);
```

> **Try it.** `./genviz.js --mobile --foreground trees`. Render a dozen
> images. You should see a mix of trees, ruins, spikes, mountains (if you
> leave `--foreground` off); each one clustered toward a focus; each one
> sitting on a soft horizon. This is the point in the project where it
> starts to feel like *something*.

## What you have now

- Four silhouette painters, each drawing polygons with grayscale fills
- An attractor that biases placement toward a compositional focus
- A dispatcher that picks one foreground per render
- `rng.normal()` and `rng.choice()` in the RNG class

The images are good. They're not *great* yet — the sky gradients are too
smooth, there's nothing in the middle ground, and we haven't added the
dithering that gives the project its distinctive illustrated look.
That's next chapter.

---

**Previous:** [3. Composing a scene](./03-scene.md) ·
**Next:** [5. Drift, dither, and the finish pass](./05-drift-finish.md)
