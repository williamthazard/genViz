#!/usr/bin/env -S npx tsx
import { writeFileSync, statSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { Rng, randomSeed } from "./rng.ts";
import {
  compose,
  resolveRecipe,
  FOREGROUNDS,
  FOCALS,
  DRIFTS,
  PRESETS,
  type Foreground,
  type Focal,
  type Drift,
  type PresetName,
} from "./compose.ts";

interface Args {
  preset?: PresetName;
  size?: [number, number];
  foreground: Foreground | "random";
  focal: Focal | "random";
  drift: Drift | "random";
  seed?: number;
  out?: string;
}

function die(msg: string): never {
  console.error(`genviz: ${msg}`);
  process.exit(2);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { foreground: "random", focal: "random", drift: "random" };
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
    } else if (a === "--foreground") {
      const v = argv[++i];
      if (v !== "random" && !FOREGROUNDS.includes(v as Foreground)) die(`bad --foreground: ${v}`);
      args.foreground = v as Foreground | "random";
    } else if (a === "--focal") {
      const v = argv[++i];
      if (v !== "random" && !FOCALS.includes(v as Focal)) die(`bad --focal: ${v}`);
      args.focal = v as Focal | "random";
    } else if (a === "--drift") {
      const v = argv[++i];
      if (v !== "random" && !DRIFTS.includes(v as Drift)) die(`bad --drift: ${v}`);
      args.drift = v as Drift | "random";
    } else if (a === "--seed") {
      args.seed = Number(argv[++i]);
    } else if (a === "--out") {
      args.out = argv[++i];
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else {
      die(`unknown arg: ${a}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: genviz [--desktop|--mobile|...] [--size W H] [--foreground X] [--focal X] [--drift X] [--seed N] [--out path]

Presets:    ${Object.keys(PRESETS).join(", ")}
Foreground: ${FOREGROUNDS.join(", ")}, random
Focal:      ${FOCALS.join(", ")}, random
Drift:      ${DRIFTS.join(", ")}, random`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let w: number;
  let h: number;
  let tag: string;
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

  const { foreground, focal, drift } = resolveRecipe(rng, args.foreground, args.focal, args.drift);
  const recipe = `${foreground}-${focal}-${drift}`;
  const out = args.out ?? `wallpaper_${tag}_${recipe}_${seed}.png`;
  console.log(`Generating ${w}x${h} recipe=${recipe} (seed=${seed}) → ${out}`);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  compose(ctx, w, h, rng, foreground, focal, drift);
  const buf = canvas.toBuffer("image/png");
  writeFileSync(out, buf);
  const kb = statSync(out).size / 1024;
  console.log(`Done. ${out} (${kb.toFixed(0)} KB)`);
}

main();
