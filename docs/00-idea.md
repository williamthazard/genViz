# 0. The idea

Before we write any code, we're going to be specific about what we're making.
Generative art is easy to get vaguely right and hard to get specifically right.
Vague output looks like a screensaver. Specific output looks like something.

## What we're building

A program that generates black-and-white wallpapers. Each one is a scene: a
dim sky over a darker horizon, usually a silhouette of *something* — trees,
ruins, mountains — and sometimes a moon, sometimes birds. A restrained
composition with a focal element your eye can land on.

Two interfaces share one rendering algorithm:

- a Node CLI (`./genviz.js --mobile`)
- a browser app (dropdowns, preview, download)

Same pictures. Different front doors.

## The aesthetic rules

These three rules are going to come up in every chapter. They're the thing that
keeps the output from looking like a screensaver.

**1. A scene, not a texture.** The eye should be able to find a horizon, a
  subject, a sense of depth. Uniform all-over patterns (flow fields, stipples)
  are good technique demos but they make bad wallpapers — there's nothing to
  *be* in them.

**2. Restraint over drama.** No bright central beams, no god rays, no bursting
  suns. Theatricality reads as cheap. A dim moon above a silhouette reads as
  meaningful.

**3. Let the viewer complete the image.** The human mind is a pattern-finding
  machine. If you give it just enough — a distant shape, a suggestion of
  layering — it will do the rest. Under-do it.

> **Why it's this way.** The first version of this project had styles called
> "flow," "stipple," "contour." They all looked like the loading screen of a
> meditation app: technically correct, interchangeable, forgettable. The version
> you're going to build instead is called a *nullscape* — a night scene with a
> silhouetted foreground — and it works because it pretends to be somewhere.

## What we're *not* building

- Color. Grayscale only. Limiting the palette forces the composition to work.
- Animation. These are single frames.
- Photorealism. We want suggestion, not simulation.
- AI. No models. This is plain math: noise functions, Gaussian falloffs,
  polygons. A few hundred lines of code you could read in a sitting.

## The algorithm, in one paragraph

For each image: fill a buffer with a dark base value. Add two layers of
fractal noise — one high-frequency for sky haze, one low-frequency for ground
texture — and smooth-blend them across a horizon line so the transition isn't
an obvious cut. Add a focal element (moon glow, or a bright seam along the
horizon). Stamp a few hundred stars. Draw a foreground silhouette out of
polygons, clustering them around a focus point so the composition feels
arranged. Maybe draw birds or shards floating in the middle ground. Finally,
quantize the whole thing with Bayer dithering so the gradients look
illustrated rather than smooth, and darken the corners with a vignette.

You're going to build that, piece by piece, starting in the next chapter.

---

**Next:** [1. A Node CLI that prints a PNG](./01-node-cli.md)
