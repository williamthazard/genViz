# 7. Ship it: GitHub Pages via Actions

The app is done. It runs locally. This chapter gets it to a live URL that
anyone with the link can use.

## Why GitHub Pages

Our app is *entirely static*: HTML, CSS, JavaScript. The browser does all
the work — noise generation, drawing, dithering. No server, no database,
no API calls. That means we can host it on any static-file host, and GitHub
Pages is free, tied to the repo we're already using for source, and
integrates with GitHub Actions for automatic deploys.

Cost: $0. Latency: a CDN away. Ops burden: none.

## The deployment picture

```
      you push to main
            │
            ▼
   GitHub Actions runs:
     cd web
     npm ci
     npm run build        ────►  web/dist/
            │
            ▼
  Upload dist/ as Pages artifact
            │
            ▼
      Deploy to Pages
            │
            ▼
   https://you.github.io/genViz/
```

Two jobs, one workflow.

## The workflow file

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy web/ to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install web deps
        working-directory: web
        run: npm ci
      - name: Build
        working-directory: web
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

Line by line:

**`on: push: branches: [main]`** — run automatically whenever `main`
updates. `workflow_dispatch` also adds a manual "Run workflow" button in
the Actions tab, useful for retries.

**`permissions`** — the Pages deploy needs to read repo contents, write to
Pages, and produce an OIDC token (which is how Pages verifies the
deployment's source). These are the minimum permissions.

**`concurrency`** — if a new push happens while a previous deploy is in
progress, cancel the old one. Otherwise you could end up deploying the
second-latest commit.

**`build` job** — checks out the code, installs Node 20, runs
`npm ci` (lockfile-exact install) and `npm run build` in `web/`, then
uploads `web/dist/` as a Pages-ready artifact.

**`deploy` job** — takes the artifact and publishes it. `deploy-pages@v4`
handles the actual upload-to-Pages step.

> **Why `npm ci` not `npm install`?** `ci` is "clean install" — it uses
> the exact versions in `package-lock.json` and errors if the lock file is
> out of date. In CI, this is what you want: deterministic, reproducible,
> no drift.

## Repository setup

Two one-time things in GitHub's UI:

1. **Create the repo.** If you haven't already, `git init`, commit, and
   push to `https://github.com/YOU/genViz`. If the repo name isn't
   `genViz`, update `base: '/genViz/'` in `vite.config.ts` to match.
2. **Enable Pages with Actions source.** In the repo settings → Pages →
   Source, choose "GitHub Actions." That's it. Don't pick a branch —
   the workflow uploads directly.

## First deploy

Push to main. In the Actions tab you'll see the workflow kick off. Watch
the build run (~30 seconds for the install step, a second or two for the
build itself). Then the deploy step finishes and gives you a URL:

```
https://YOUR-USERNAME.github.io/genViz/
```

Open it. You should see the app, same as `npm run dev` showed you
locally.

> **If it 404s:** check the `base` in `vite.config.ts` matches your repo
> name exactly (case-sensitive). A mismatch between `base` and the URL
> prefix is the #1 GH Pages gotcha. If your repo is `my-genviz`, then
> `base: '/my-genviz/'`.

## Custom domain (optional)

If you have a domain name and want to use it:

1. Add a CNAME record: `genviz.yourdomain.com` → `YOU.github.io`.
2. In the repo settings → Pages → Custom domain, enter the domain. GitHub
   writes a `CNAME` file to the Pages site.
3. Change `base: '/genViz/'` to `base: '/'` in `vite.config.ts`, because
   at a custom domain you're serving from the root.

## A note on iteration speed

The GH Pages build takes ~60 seconds end-to-end. That's fine for
production pushes, but if you're making rapid UI tweaks, use the local
dev server (`npm run dev`) — Vite's HMR means changes reload in
milliseconds. Push to main only when you've verified locally that
things work.

## What you have now

A complete project:

- A working rendering algorithm in TypeScript
- Two entry points (Node CLI, browser)
- A minimal React UI with preview, download, shadowbox
- Continuous deployment to a URL

## What to learn next

Some directions if you want to push this further:

**Web Workers.** Right now, rendering blocks the UI thread. For big
renders (3840×2160 desktop-4k), that's noticeable. Move `compose()` into
a Web Worker, communicate via `postMessage`, and the UI stays responsive
while the worker renders.

**More styles.** The compositional rules we built (attractor placement,
smoothstep horizon, Bayer dithering) generalize. Add a new foreground by
writing a single `paintFoo` function and dropping it in the dispatcher —
you've got everything you need.

**Variations on a seed.** A "surprise me" button could scan through a
handful of seeds in the background, keep the highest-contrast ones, and
surface them as suggestions.

**Photography inspiration.** The compositional rules (horizon below
center, subject offset from center, dark base) are just the rule of
thirds dressed up. Read some landscape photography composition theory
and you'll find a dozen more rules that translate directly to code.

---

**Previous:** [6. A React SPA around the renderer](./06-react-spa.md) ·
**Up:** [Tutorial index](./README.md)

---

If you made it here, you built a real thing. Thanks for reading.
