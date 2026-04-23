// Parse a CSS color (hex, rgb(), named) into [r, g, b] bytes. Paints a 1x1
// pixel with the color and reads back the rasterized RGB — a trick that works
// identically in the browser and in @napi-rs/canvas (unlike fillStyle
// readback, which @napi-rs/canvas leaves un-normalized). Invalid inputs leave
// the pixel transparent (alpha=0), which we detect. The (0,0) pixel on the
// supplied context is clobbered; callers should use a scratch canvas, or pass
// a context whose entire frame will be overwritten after parsing.

export type Tint = readonly [number, number, number];
export type Palette = readonly Tint[];

export const BLACK: Tint = [0, 0, 0] as const;
export const WHITE: Tint = [255, 255, 255] as const;

export function parseColor(input: string, ctx: CanvasRenderingContext2D): Tint {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("empty color");

  ctx.save();
  ctx.clearRect(0, 0, 1, 1);
  // Reset to transparent so a rejected fillStyle assignment below can't leak
  // a prior color into our read.
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillStyle = trimmed;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  ctx.restore();

  if (data[3] < 255) throw new Error(`invalid color: ${input}`);
  return [data[0], data[1], data[2]];
}

export function tintToHex(tint: Tint): string {
  return "#" + tint.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}

// Build a 256-entry RGB lookup table that maps grayscale v ∈ [0,255] to the
// output color. The palette is a literal list of stops — dark pixels take the
// first stop, bright pixels take the last, with linear interpolation between.
// Callers who want the classic "shadows→black, highlights→white" behavior
// include BLACK and WHITE as explicit stops. An empty palette is treated as
// identity grayscale (i.e. [BLACK, WHITE]); a single stop produces a solid
// image of that color.
export function buildPaletteLUT(palette: Palette): Uint8ClampedArray {
  const stops: Tint[] =
    palette.length === 0 ? [BLACK, WHITE]
    : palette.length === 1 ? [palette[0], palette[0]]
    : [...palette];
  const lut = new Uint8ClampedArray(256 * 3);
  const segments = stops.length - 1;
  for (let v = 0; v < 256; v++) {
    const t = (v / 255) * segments;
    let seg = Math.floor(t);
    if (seg >= segments) seg = segments - 1;
    const local = t - seg;
    const a = stops[seg];
    const b = stops[seg + 1];
    const i = v * 3;
    lut[i] = a[0] + (b[0] - a[0]) * local;
    lut[i + 1] = a[1] + (b[1] - a[1]) * local;
    lut[i + 2] = a[2] + (b[2] - a[2]) * local;
  }
  return lut;
}
