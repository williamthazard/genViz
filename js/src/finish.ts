import { BAYER8 } from "./noise.ts";
import { Rng } from "./rng.ts";
import { buildPaletteLUT, type Palette } from "./color.ts";

// Bayer-dither quantize + vignette + faint grain, then map through the
// palette LUT. An empty palette yields identity grayscale.
export function finish(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  rng: Rng,
  palette: Palette = [],
  vignetteStrength = 0.07,
  levels = 24,
): void {
  const step = 255 / (levels - 1);
  const halfW = w / 2;
  const halfH = h / 2;
  const lut = buildPaletteLUT(palette);

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
      const li = (v | 0) * 3;
      rgba[i] = lut[li];
      rgba[i + 1] = lut[li + 1];
      rgba[i + 2] = lut[li + 2];
      // alpha stays 255
    }
  }
}
