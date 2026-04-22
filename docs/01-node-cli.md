# 1. A Node CLI that prints a PNG

Goal of this chapter: an executable script you can type `./genviz.js --desktop`
at and get a PNG file. The PNG will be boring — TV static — but every pipe in
the build will be connected.

We're in TypeScript because the same rendering code is going to run in a
browser later (chapters 6–7). Node gets us to a working CLI first, then the
browser is almost free.

## Install Node

If you already have `node` on your path, skip this. Otherwise, use **nvm**
(Node Version Manager) — it keeps Node versions per-user, out of the way of
the system:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
# restart the shell, then:
nvm install --lts
```

> **Why nvm?** Homebrew's `node` installs globally and is annoying to version-
> switch. nvm installs into `~/.nvm/versions/node/<version>/`, so you can run
> several Node versions side-by-side, never fight with permissions, and never
> `sudo` for a package install.

## Make the project

```sh
mkdir genviz && cd genviz
mkdir js && cd js
npm init -y
npm install @napi-rs/canvas
npm install -D typescript tsx @types/node
```

Two runtime packages and three dev packages.

- **`@napi-rs/canvas`** is a Node package that provides the *exact same*
  Canvas 2D API the browser has — `beginPath`, `moveTo`, `fillStyle`,
  `getImageData`. No code changes needed to share rendering between Node and
  browser.
- **`tsx`** is a TypeScript runner for Node that handles `.ts` files without
  a build step. For a small project this is much nicer than a `tsc`-watch
  loop.
- **`typescript`** + **`@types/node`** give us the compiler and Node's type
  definitions.

Create `js/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*"]
}
```

The `lib: ["DOM"]` matters — it gives us `CanvasRenderingContext2D` as a
type, which is what both `@napi-rs/canvas` and the browser implement. We'll
use that later to write painters once that run in both environments.

## A seeded RNG

Reproducible output matters: if the user gets a beautiful image at `--seed
42`, running it again with the same seed should give the same image. The
browser's `Math.random()` has no seeding API, so we'll roll our own.

Create `js/src/rng.ts`:

```typescript
// Seeded PRNG with a numpy-style surface. Mulberry32 core — fast, small,
// good enough for procedural art (not cryptographic).

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(lo: number, hi: number): number {
    return lo + (hi - lo) * this.random();
  }

  integers(lo: number, hi: number): number {
    return lo + Math.floor(this.random() * (hi - lo));
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
```

A few things worth calling out.

**Mulberry32** is the PRNG inside `random()`. It's a public-domain algorithm
that produces a 32-bit integer per step, which we scale into `[0, 1)`. It's
not cryptographic, but it's fast, has good distribution, and is tiny enough
to inline.

**`>>> 0`** forces a value to unsigned 32-bit. JavaScript numbers are 64-bit
floats, but bitwise operators work on 32-bit integers; the `>>> 0` idiom is
the accepted way to stay in that domain.

**`Math.imul`** is true 32-bit integer multiplication. Multiplying two
32-bit ints with `*` would promote to 64-bit floats and lose precision.

**`randomSeed()`** is our fallback when the user doesn't pass `--seed`. We
use `Math.random()` once to pick a 32-bit seed, print it, and use that — so
any output is always reproducible even when the seed was auto-generated.

We'll add more methods to this class (normal, beta, choice) as we need them
in later chapters.

## The CLI

Create `js/src/cli.ts`:

```typescript
#!/usr/bin/env -S npx tsx
import { writeFileSync, statSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { Rng, randomSeed } from "./rng.ts";

export const PRESETS = {
  "desktop": [2560, 1440],
  "desktop-4k": [3840, 2160],
  "desktop-5k": [5120, 2880],
  "mobile": [1170, 2532],
  "mobile-xl": [1290, 2796],
  "square": [2048, 2048],
} as const satisfies Record<string, readonly [number, number]>;

type PresetName = keyof typeof PRESETS;

interface Args {
  preset?: PresetName;
  size?: [number, number];
  seed?: number;
  out?: string;
}

function die(msg: string): never {
  console.error(`genviz: ${msg}`);
  process.exit(2);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--") && (PRESETS as Record<string, unknown>)[a.slice(2)]) {
      if (args.preset || args.size) die("multiple size flags");
      args.preset = a.slice(2) as PresetName;
    } else if (a === "--size") {
      const w = Number(argv[++i]);
      const h = Number(argv[++i]);
      if (!Number.isFinite(w) || !Number.isFinite(h)) die("--size expects W H");
      args.size = [w, h];
    } else if (a === "--seed") {
      args.seed = Number(argv[++i]);
    } else if (a === "--out") {
      args.out = argv[++i];
    } else {
      die(`unknown arg: ${a}`);
    }
  }
  return args;
}

function compose(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng): void {
  // Placeholder: fill with random noise.
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = rng.integers(0, 256);
    const j = i * 4;
    img.data[j] = img.data[j + 1] = img.data[j + 2] = v;
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

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

A lot of scaffolding, but each piece earns its keep.

**`PRESETS`** is a table of common wallpaper sizes. `as const satisfies
Record<...>` is the TypeScript idiom for "keep the exact literal types (so
`PresetName` can be a union of the six keys) while still validating the
shape."

**`parseArgs`** is hand-rolled. The Node ecosystem has `commander`,
`yargs`, and a built-in `util.parseArgs` since Node 22 — but for six
flags a 30-line loop is clearer than a library dependency.

**The seed logic.** If the user passed `--seed 42`, use 42. Otherwise call
`randomSeed()`, print it, and use that. Printing it matters — if they love
the output, they can reproduce it with `--seed <that number>`.

**`compose()`** is a placeholder. It fills a `Uint8ClampedArray` with random
RGBA bytes. `createImageData` gives us a buffer the size of the canvas; each
pixel is 4 bytes (R, G, B, A). For grayscale we write the same value three
times and set alpha to 255. Then `putImageData` pushes the buffer to the
canvas. This is exactly the pattern we'll use for the real renderer.

**The cast `as unknown as CanvasRenderingContext2D`** is a structural-
compatibility bridge. `@napi-rs/canvas`'s context implements all the methods
of the browser's `CanvasRenderingContext2D`, but TypeScript doesn't know
that, so we tell it explicitly. Once we do, the rest of our code can be typed
against the browser's API and run in both environments.

## A friendly wrapper

The `#!/usr/bin/env -S npx tsx` shebang at the top of `cli.ts` is clever but
fragile — it requires `tsx` to be on PATH, and the nvm-installed Node may
not be on PATH in every context (cron jobs, GUI launchers).

A more robust wrapper lives at the repo root. Create `/genviz.js` (yes, even
though it's TypeScript underneath — users want to type `./genviz.js`):

```sh
#!/bin/zsh
# Node CLI wrapper — loads nvm, then invokes the TypeScript entry via tsx.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
exec npx --prefix "$(dirname "$0")/js" tsx "$(dirname "$0")/js/src/cli.ts" "$@"
```

Make it executable:

```sh
chmod +x genviz.js
```

This wrapper sources nvm's init script (so `npx` and `node` resolve
correctly no matter how the shell was launched), then `exec`s `tsx` pointed
at our TypeScript entry. `--prefix` tells npx to look for `tsx` in the
local `js/node_modules` we installed above.

> **Try it.** `./genviz.js --desktop` should write `wallpaper_desktop_<seed>.png`
> in the current directory. Open it. It'll be TV static, but it's a 2560×1440
> PNG — all the pipes connect. That's enough for one chapter.

## What you have now

- A TypeScript project with `@napi-rs/canvas`, tsx runner, and a seeded RNG
- A CLI that picks between resolution presets
- Seed plumbing for reproducible output
- A placeholder `compose()` that writes a PNG to disk

Not much visually, but the scaffolding is solid. Next chapter: replace the
random noise with *structured* noise — the kind landscapes are made of.

---

**Previous:** [0. The idea](./00-idea.md) ·
**Next:** [2. Noise: value noise and fBm](./02-noise.md)
