# How to build genscape

Hello. This is a hands-on tutorial that builds the wallpaper generator in
this repo from an empty directory up to a site on the internet. Every line
of code in the finished app appears somewhere in these pages, and every
line has a reason.

You don't need to have done this before. You do need a terminal, a code
editor, and the willingness to type things out rather than copy-paste.
(Copy-paste is faster; typing is how you remember.)

When you finish you'll have your own copy of the generator, deployed to a
URL, and a working mental model of:

- procedural noise (value noise, fractal Brownian motion, why landscapes
  look the way they do)
- compositional bias in generative art — making images feel *placed*
  instead of *sprinkled*
- dithering and perceptual fakery
- numeric TypeScript on typed arrays and the Canvas 2D API
- React state for controlled-form UIs
- deploying a static build to GitHub Pages via Actions

## Chapters

0. [The idea](./00-idea.md) — what we're making, the aesthetic rules, and why
1. [A Node CLI that prints a PNG](./01-node-cli.md)
2. [Noise: value noise and fBm](./02-noise.md)
3. [Composing a scene: horizon, haze, stars, focal](./03-scene.md)
4. [Silhouettes with compositional bias](./04-silhouettes.md)
5. [Drift, dither, and the finish pass](./05-drift-finish.md)
6. [A React SPA around the renderer](./06-react-spa.md)
7. [Ship it: GitHub Pages via Actions](./07-deploy.md)

## How to read

Each chapter ends with a **running app** you can use, even if you stop
there. Chapter 1 gets you to a grainy gray rectangle; chapter 3 gets you
to a recognizable scene; chapter 7 gets you to a URL. None of the chapters
assume you remember the previous one perfectly — key facts are restated
when they matter.

When you see a block like this:

> **Try it.** `./genscape.js` should write a PNG.

...actually try it. Fix what breaks before moving on. Debugging your own
typo is worth more than a clean pass.

When you see:

> **Why it's this way.** ...

...read it. That's the part that'll help you when you build something else.

Ready? Start with [chapter 0](./00-idea.md).
