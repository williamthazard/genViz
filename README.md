# genviz

Generative black-and-white wallpapers. Dark, restrained, compositional — the kind of
image where your eye finds a scene instead of a pattern.

![A generated nullscape: a dim moon above a clustered silhouette of trees, birds in flight](docs/images/hero.png)

Every render is a layered scene: haze, a focal element (moon, seam, or nothing), a
foreground silhouette (spikes, trees, ruins, or mountains), and optional mid-ground
drift (birds or shards). Random sub-choices give variety; the compositional rules
keep each one readable.

There are two ways to use it.

## 1. Web app (easiest)

Go to **[williamthazard.github.io/genViz](https://williamthazard.github.io/genViz/)**
and click **Regenerate** until you like what you see, then **Download**. No install.

## 2. Node CLI

A terminal command that writes a PNG to disk. Good for scripting batches or for
exact resolutions.

```sh
# one-time setup
cd web && npm install && cd ../js && npm install

# render a mobile wallpaper to the current directory
./genviz.js --mobile

# pick the recipe yourself
./genviz.js --desktop --foreground trees --focal moon --seed 42

# tint with one or more colors (default is black & white)
./genviz.js --mobile --color '#c2b280' --color teal

# custom size
./genviz.js --size 3840 2160 --out my-wall.png
```

Presets: `desktop`, `desktop-4k`, `desktop-5k`, `mobile`, `mobile-xl`, `square`.

Flags that take values default to `random` if omitted:
- `--foreground`: `spikes`, `trees`, `ruins`, `mountains`, `random`
- `--focal`: `moon`, `seam`, `none`, `random`
- `--drift`: `birds`, `shards`, `none`, `random`
- `--seed <number>`: pin the seed for reproducibility
- `--color <value>`: any CSS color (hex, `rgb()`, name). Repeat to build a
  palette — each color becomes a midtone stop between the existing black
  shadows and white highlights. Omit for pure B&W.
- `--out <path>`: override the auto-generated filename

## Development

- `js/` — shared rendering core (TypeScript) + Node CLI
- `web/` — Vite + React SPA (imports `js/src/` directly)
- `docs/` — tutorial on how this was built
- `.github/workflows/pages.yml` — deploys `web/` to GitHub Pages on push to main

```sh
# web app, local dev
cd web && npm run dev
```

## Learn how to build this

If you want to build this yourself as a learning project — procedural noise,
Canvas rendering, React, GitHub Pages deploy, all of it — see the tutorial in
[`docs/`](./docs/). It starts at `mkdir genviz` and ends at a live URL.
