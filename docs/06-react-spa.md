# 6. A React SPA around the renderer

The rendering core from chapter 5 is browser-ready — we typed all our
painters against `CanvasRenderingContext2D`, which is exactly what a
browser canvas provides. This chapter wraps that core in a minimal React
single-page app: dropdowns for the options our CLI has, a canvas preview,
Regenerate and Download buttons, and a shadowbox (fullscreen lightbox)
for a high-resolution view.

## Scaffold

From the project root:

```sh
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
```

Vite gives us a React TS starter, and we're adding Tailwind for styling.
(We're using Tailwind v3 — v4's config is different and we're keeping
things conventional.)

Point Tailwind at our files in `web/tailwind.config.js`:

```javascript
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Replace `web/src/index.css` with the Tailwind directives plus a dark body:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  margin: 0;
  background: #0a0a0a;
  color: #e5e5e5;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

> **Why Tailwind?** For a small SPA, utility classes let us style everything
> inline without accumulating a CSS file. The styling needs here are simple —
> dark neutrals, a few buttons, a modal — and Tailwind is faster than writing
> scoped stylesheets or module CSS for that.

## Cross-importing the rendering core

We want `web/src/*.tsx` to import from `../js/src/`. Two things make this
work.

In `web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const base = process.env.VITE_BASE ?? '/genscape/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, '../js/src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
```

**`base: '/genscape/'`** is the URL prefix. On GitHub Pages, user sites are
served from `https://<user>.github.io/<repo>/`, so built assets need to
reference themselves with the `/genscape/` prefix. Locally it doesn't matter
(Vite dev server serves at `/genscape/` too).

**`alias @core`** lets us write `import ... from "@core/rng.ts"` in
`web/src/*.tsx` and have Vite resolve it to the shared core in `js/src/`.

**`server.fs.allow`** is a Vite safety-check relaxation: by default Vite
refuses to serve files outside the project root, but our core is one level
up, so we grant access.

In `web/tsconfig.app.json`, add paths so the TypeScript compiler also
understands `@core`:

```json
{
  "compilerOptions": {
    // ...existing...
    "paths": {
      "@core/*": ["../js/src/*"]
    }
  },
  "include": ["src", "../js/src"],
  "exclude": ["../js/src/cli.ts"]
}
```

The `exclude` matters — `cli.ts` uses Node-only APIs that would fail
type-checking when included in the browser build.

## A thin adapter for the browser

Create `web/src/genscape.ts` — it re-exports the core and adds one browser-
specific helper:

```typescript
import { Rng, randomSeed } from "@core/rng.ts";
import {
  compose, resolveRecipe,
  FOREGROUNDS, FOCALS, DRIFTS, PRESETS,
  type Foreground, type Focal, type Drift, type PresetName,
} from "@core/compose.ts";

export {
  Rng, randomSeed, compose, resolveRecipe,
  FOREGROUNDS, FOCALS, DRIFTS, PRESETS,
};
export type { Foreground, Focal, Drift, PresetName };

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
```

`render()` takes a DOM canvas element, sizes it (setting `.width`/`.height`
also clears it — a little-known fact that's useful here), grabs its 2D
context, and hands off to the shared `compose()`.

## App component: state and effects

The app is small enough to live in one `App.tsx` with a couple of
sub-components. Here's the shape of the state:

```typescript
const [preset, setPreset] = useState<PresetName>("mobile");
const [foreground, setForeground] = useState<Foreground | "random">("random");
const [focal, setFocal] = useState<Focal | "random">("random");
const [drift, setDrift] = useState<Drift | "random">("random");
const [seed, setSeed] = useState<number>(() => randomSeed());
const [recipe, setRecipe] = useState<string>("");
const [rendering, setRendering] = useState(false);
const [shadowboxSrc, setShadowboxSrc] = useState<string | null>(null);
```

Every input is its own `useState`. `rendering` is a boolean so we can show
a "rendering…" overlay during the compose call. `shadowboxSrc` holds the
URL of the image we display in the fullscreen modal (or `null` if closed).

### The render effect

```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  setRendering(true);
  const raf = requestAnimationFrame(() => {
    const [w, h] = PRESETS[preset];
    const resolvedRng = new Rng(seed);
    const resolved = resolveRecipe(resolvedRng, foreground, focal, drift);
    render(canvas, w, h, seed, resolved.foreground, resolved.focal, resolved.drift);
    setRecipe(`${resolved.foreground}-${resolved.focal}-${resolved.drift}`);
    setRendering(false);
  });
  return () => cancelAnimationFrame(raf);
}, [preset, foreground, focal, drift, seed]);
```

The dependency array is every input. Whenever any of them changes, this
effect runs and re-renders the image. The `requestAnimationFrame` detour
is important:

> **Why `requestAnimationFrame`?** `setRendering(true)` schedules a React
> re-render, but React batches state updates — if we synchronously called
> `render()` right after, the overlay would never paint. `rAF` yields one
> frame, lets React paint the overlay, then does the expensive work. Users
> see the "rendering…" state before the UI blocks.

The cleanup function (`cancelAnimationFrame`) handles rapid-fire input
changes: if the user clicks "Regenerate" twice in 10ms, only the second
render actually fires.

### Download

```typescript
const download = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallpaper_${preset}_${recipe}_${seed}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
};
```

`canvas.toBlob()` encodes the canvas to a PNG blob asynchronously. We wrap
the blob in an object URL, create an invisible `<a download>`, click it
programmatically, and clean up. This is the standard pattern for
"download a generated file" in the browser.

> **Why `URL.revokeObjectURL`?** Blob URLs reserve memory. The spec
> eventually reclaims them on page close, but if your user generates dozens
> of wallpapers in one session, revoking after the download fires is the
> polite thing to do.

## The header and preview

```tsx
<header className="border-b border-neutral-800 px-6 py-3 flex flex-wrap items-center gap-4">
  <h1 className="text-neutral-100 font-medium tracking-tight mr-4">genscape</h1>
  <Select label="size" value={preset} options={PRESET_NAMES} onChange={setPreset} />
  <Select label="foreground" value={foreground} options={[...]} onChange={setForeground} />
  <Select label="focal" value={focal} options={[...]} onChange={setFocal} />
  <Select label="drift" value={drift} options={[...]} onChange={setDrift} />
  <label>...seed input...</label>
  <div className="ml-auto flex gap-2">
    <button onClick={regenerate}>Regenerate</button>
    <button onClick={download}>Download</button>
  </div>
</header>

<main className="flex-1 p-6 flex items-center justify-center">
  <div className="relative cursor-zoom-in" onClick={openShadowbox}>
    <canvas ref={canvasRef} className="max-w-full max-h-[calc(100vh-8rem)] shadow-2xl" />
    {rendering && <div className="absolute inset-0 bg-black/40">rendering…</div>}
  </div>
</main>
```

> **Why a single `<canvas>` element?** We reuse the same canvas across
> re-renders. Each render resizes it (changing `.width` clears it) and
> paints into it. The DOM only has one canvas; React swaps its pixels.

`max-h-[calc(100vh-8rem)]` is Tailwind's arbitrary-value syntax, useful for
sizing rules that don't fit preset classes.

## The shadowbox

Click-to-zoom deserves its own component. We want:

- Fullscreen modal over a dark backdrop
- Floating `+` / `−` zoom buttons
- Drag-to-pan
- `Esc` / click-backdrop / `×` button to close

```tsx
import { useEffect, useRef, useState } from "react";

export function Shadowbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setZoom(z => Math.min(8, z * 1.25));
      else if (e.key === "-" || e.key === "_") setZoom(z => Math.max(0.25, z / 1.25));
      else if (e.key === "0") { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
         onClick={onClose}>
      <div className="w-full h-full overflow-hidden flex items-center justify-center
                      cursor-grab active:cursor-grabbing"
           onClick={e => e.stopPropagation()}
           onPointerDown={onPointerDown}
           onPointerMove={onPointerMove}
           onPointerUp={onPointerUp}>
        <img src={src} draggable={false}
             style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} />
      </div>
      {/* ...zoom controls with `+` / `−` / percentage... */}
    </div>
  );
}
```

Key patterns:

**Pointer events** (not mouse events) work with touch, pen, and mouse with a
single handler. `setPointerCapture` ensures drag-move events keep coming to
the original element even if the pointer leaves it.

**Transform-based zoom/pan** is fast — the browser compositor handles it on
the GPU. Re-rendering the image at a different resolution would be slow and
blurry.

**The ref-based drag state** (`dragRef`) instead of `useState` for the
drag origin is deliberate: we don't want pointer moves to trigger React
re-renders of their own. Only `setPan` (throttled to drag-move rate) does.

**`stopPropagation`** on the inner container so clicks inside don't bubble
up to the backdrop's `onClick={onClose}`.

## Opening the shadowbox

Back in `App.tsx`:

```typescript
const openShadowbox = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  canvas.toBlob(blob => {
    if (!blob) return;
    setShadowboxSrc(URL.createObjectURL(blob));
  }, "image/png");
};
```

We snapshot the canvas to a blob at its full native resolution (e.g.
2560×1440 for the desktop preset — not the CSS-scaled preview), turn the
blob into an object URL, and hand it to the shadowbox. The user zooms on
*that* — the full-res version — even though the on-page preview is scaled
to fit.

## Build & dev

```sh
cd web
npm run dev    # local dev at http://localhost:5173/genscape/
npm run build  # produces web/dist/
```

`npm run build` should finish cleanly with a small bundle (under 250 KB JS,
under 10 KB CSS). If you've made it here with a working dev server and a
clean production build, you have a deployable app.

## What you have now

- A React SPA that loads the rendering core, renders on any input change,
  shows a preview, lets users download, and zooms in a fullscreen lightbox.
- Shared code with the Node CLI — one render algorithm, two entry points.
- Tailwind for styling, Vite for build, all under ~300 lines of app code.

Last chapter: getting this to a live URL.

---

**Previous:** [5. Drift, dither, and the finish pass](./05-drift-finish.md) ·
**Next:** [7. Ship it: GitHub Pages via Actions](./07-deploy.md)
