import { BAYER8 } from "./noise.ts";
import { Rng } from "./rng.ts";

// Bayer-dither quantize + vignette + faint grain. Matches Python _finish().
export function finish(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  rng: Rng,
  vignetteStrength = 0.07,
  levels = 24,
): void {
  const step = 255 / (levels - 1);
  const halfW = w / 2;
  const halfH = h / 2;

  for (let y = 0; y < h; y++) {
    const bayerRow = (y & 7) * 8;
    const yn = (y - halfH) / halfH;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const threshold = BAYER8[bayerRow + (x & 7)];
      // Read channel (grayscale: R=G=B), apply grain, dither-quantize, vignette.
      let v = rgba[i] + rng.normal(0, 2);
      v = Math.round(v / step + (threshold - 0.5)) * step;
      const xn = (x - halfW) / halfW;
      const r2 = xn * xn + yn * yn;
      const vig = Math.max(0, Math.min(1, 1 - vignetteStrength * r2));
      v = Math.max(0, Math.min(255, v * vig));
      rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
      // alpha stays 255
    }
  }
}
