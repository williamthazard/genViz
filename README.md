# genscape

Generative wallpapers that feel like scenes, not patterns. Dark, restrained,
compositional. Default output is black and white; pick a color scheme to wash
the image in any palette you like.

![A generated nullscape: a dim moon above a clustered silhouette of trees, birds in flight](docs/images/hero.png)

Every render is a layered scene: haze, a focal element (moon, seam, or nothing), a
foreground silhouette (spikes, trees, ruins, or mountains), and optional mid-ground
drift (birds or shards). Random sub-choices give variety; the compositional rules
keep each one readable.

There are two ways to use it.

## 1. Web app (easiest)

Go to **[williamthazard.github.io/genscape](https://williamthazard.github.io/genscape/)**
and click **Regenerate** until you like what you see, then **Download**. No install.

## 2. Node CLI

A terminal command that writes a PNG to disk. Good for scripting batches or for
exact resolutions.

```sh
# one-time setup
cd web && npm install && cd ../js && npm install

# render a mobile wallpaper to the current directory
./genscape.js --mobile

# pick the recipe yourself
./genscape.js --desktop --foreground trees --focal moon --seed 42

# tint with one or more colors (default is black & white)
./genscape.js --mobile --color '#c2b280' --color teal

# custom size
./genscape.js --size 3840 2160 --out my-wall.png
```

Presets: `desktop`, `desktop-4k`, `desktop-5k`, `mobile`, `mobile-xl`, `square`.

Flags that take values default to `random` if omitted:
- `--foreground`: `spikes`, `trees`, `ruins`, `mountains`, `random`
- `--focal`: `moon`, `seam`, `none`, `random`
- `--drift`: `birds`, `shards`, `none`, `random`
- `--seed <number>`: pin the seed for reproducibility
- `--color <value>`: any CSS color (hex, `rgb()`, name). Repeat to build a
  palette — dark pixels take the first color, bright pixels take the last,
  with smooth interpolation between. Include `black` and `white` explicitly
  if you want them as anchors; omit `--color` entirely for default B&W.
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
[`docs/`](./docs/). It starts at `mkdir genscape` and ends at a live URL.
