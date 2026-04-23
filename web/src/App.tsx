import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  render,
  randomSeed,
  resolveRecipe,
  parseColor,
  tintToHex,
  FOREGROUNDS,
  FOCALS,
  DRIFTS,
  PRESETS,
  Rng,
  type Foreground,
  type Focal,
  type Drift,
  type PresetName,
  type Tint,
} from "./genscape";
import { Shadowbox } from "./Shadowbox";

type Choice<T extends string> = T | "random";

const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

const inputCls =
  "w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="uppercase tracking-wider text-[10px] font-medium text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className={inputCls}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function PaletteEditor({
  palette,
  setPalette,
  parse,
}: {
  palette: string[];
  setPalette: (p: string[]) => void;
  parse: (s: string) => Tint | null;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);

  // Accepts a single color or a comma-separated list (hex and/or names mixed
  // freely, e.g. "red, #112233, teal"). All-or-nothing: a single bad entry
  // rejects the whole input.
  const tryAdd = (s: string) => {
    const parts = s.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) { setError(true); return; }
    const added: string[] = [];
    for (const p of parts) {
      const t = parse(p);
      if (!t) { setError(true); return; }
      added.push(tintToHex(t));
    }
    setPalette([...palette, ...added]);
    setText("");
    setError(false);
  };

  const replaceAt = (i: number, value: string) => {
    const next = [...palette];
    next[i] = value;
    setPalette(next);
  };

  const removeAt = (i: number) => {
    setPalette(palette.filter((_, j) => j !== i));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {palette.map((c, i) => {
          const t = parse(c);
          const hex = t ? tintToHex(t) : "#000000";
          return (
            <div key={i} className="relative w-7 h-7">
              <label
                className="absolute inset-0 block rounded border border-neutral-700 cursor-pointer overflow-hidden"
                style={{ backgroundColor: hex }}
                title={c}
              >
                {/* opacity-0 full-size input (not sr-only) so iOS/Android
                    anchor and close the native picker to the swatch's rect. */}
                <input
                  type="color"
                  value={hex}
                  onChange={e => replaceAt(i, e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label={`edit color ${i + 1}`}
                />
              </label>
              <button
                type="button"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeAt(i);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center z-10 shadow"
                aria-label={`remove color ${i + 1}`}
              >
                <span className="text-xs leading-none">×</span>
              </button>
            </div>
          );
        })}
        <label
          className="w-7 h-7 rounded border border-dashed border-neutral-700 hover:border-neutral-500 flex items-center justify-center cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors"
          title="add color"
        >
          <span className="text-base leading-none">+</span>
          <input
            type="color"
            onChange={e => {
              setPalette([...palette, e.target.value]);
            }}
            className="sr-only"
            aria-label="add color"
          />
        </label>
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder="hex or name (commas for multiple)"
          value={text}
          onChange={e => { setText(e.target.value); setError(false); }}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); tryAdd(text); }
          }}
          className={`flex-1 bg-neutral-900 border ${error ? "border-red-800" : "border-neutral-800"} rounded px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors`}
          aria-label="add color by name or hex"
        />
        <button
          type="button"
          onClick={() => tryAdd(text)}
          disabled={!text}
          className="px-2.5 py-1 border border-neutral-700 rounded text-xs text-neutral-200 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [preset, setPreset] = useState<PresetName>("mobile");
  const [foreground, setForeground] = useState<Choice<Foreground>>("random");
  const [focal, setFocal] = useState<Choice<Focal>>("random");
  const [drift, setDrift] = useState<Choice<Drift>>("random");
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [palette, setPalette] = useState<string[]>(["#000000", "#ffffff"]);
  const [recipe, setRecipe] = useState<string>("");
  const [rendering, setRendering] = useState(false);
  const [shadowboxSrc, setShadowboxSrc] = useState<string | null>(null);
  // Default to open on desktop (≥640px), collapsed on mobile.
  const [showAdvanced, setShowAdvanced] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 640
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Throwaway 1x1 ctx dedicated to CSS color parsing (reused across renders).
  const parseCtx = useMemo(() => {
    const c = document.createElement("canvas");
    return c.getContext("2d");
  }, []);

  const parse = (s: string): Tint | null => {
    if (!parseCtx || !s.trim()) return null;
    try { return parseColor(s, parseCtx); }
    catch { return null; }
  };

  // Parsed palette — any entries that fail to parse are silently skipped.
  const resolvedPalette = useMemo<Tint[]>(() => {
    if (!parseCtx) return [];
    const out: Tint[] = [];
    for (const c of palette) {
      if (!c.trim()) continue;
      try { out.push(parseColor(c, parseCtx)); }
      catch { /* skip */ }
    }
    return out;
  }, [palette, parseCtx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    const raf = requestAnimationFrame(() => {
      const [w, h] = PRESETS[preset];
      const resolvedRng = new Rng(seed);
      const resolved = resolveRecipe(resolvedRng, foreground, focal, drift);
      render(canvas, w, h, seed, resolved.foreground, resolved.focal, resolved.drift, resolvedPalette);
      setRecipe(`${resolved.foreground}-${resolved.focal}-${resolved.drift}`);
      setRendering(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [preset, foreground, focal, drift, seed, resolvedPalette]);

  const regenerate = () => setSeed(randomSeed());

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

  const openShadowbox = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      setShadowboxSrc(URL.createObjectURL(blob));
    }, "image/png");
  };

  const closeShadowbox = () => {
    if (shadowboxSrc) URL.revokeObjectURL(shadowboxSrc);
    setShadowboxSrc(null);
  };

  return (
    <div className="h-full flex flex-col-reverse sm:flex-row bg-neutral-950 text-neutral-200">
      <aside className="shrink-0 flex flex-col border-t border-neutral-800 sm:border-t-0 sm:border-r sm:w-72 sm:h-full sm:overflow-y-auto">
        <div className="hidden sm:flex px-5 py-4 items-baseline justify-between border-b border-neutral-900">
          <h1 className="text-neutral-100 font-medium tracking-tight text-base">genscape</h1>
          <span className="text-[10px] uppercase tracking-wider text-neutral-600">
            wallpapers
          </span>
        </div>

        {/* Recipe controls — collapsible at any viewport. */}
        <div
          className={`${showAdvanced ? "flex" : "hidden"} flex-col gap-3 sm:gap-4 px-3 pt-3 sm:p-5 sm:flex-1`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-3">
            <Field label="size">
              <Select value={preset} options={PRESET_NAMES} onChange={setPreset} />
            </Field>
            <Field label="foreground">
              <Select
                value={foreground}
                options={["random", ...FOREGROUNDS] as const}
                onChange={setForeground}
              />
            </Field>
            <Field label="focal">
              <Select
                value={focal}
                options={["random", ...FOCALS] as const}
                onChange={setFocal}
              />
            </Field>
            <Field label="drift">
              <Select
                value={drift}
                options={["random", ...DRIFTS] as const}
                onChange={setDrift}
              />
            </Field>
          </div>

          <Field label="seed">
            <input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value) || 0)}
              className={`${inputCls} font-mono`}
            />
          </Field>
        </div>

        {/* Palette — visible on both mobile and desktop. */}
        <div className="px-3 py-3 sm:px-5 sm:py-4 sm:border-t sm:border-neutral-900">
          <Field label="palette">
            <PaletteEditor palette={palette} setPalette={setPalette} parse={parse} />
          </Field>
        </div>

        <div className="p-3 sm:p-5 sm:border-t sm:border-neutral-900 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={regenerate}
              disabled={rendering}
              className="flex-1 px-3 py-2 bg-neutral-100 text-neutral-950 rounded text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors"
            >
              {rendering ? "Rendering…" : "Regenerate"}
            </button>
            <button
              onClick={download}
              disabled={rendering}
              className="flex-1 px-3 py-2 border border-neutral-700 text-neutral-200 rounded text-sm hover:bg-neutral-900 disabled:opacity-50 transition-colors"
            >
              Download
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="shrink-0 px-3 py-2 border border-neutral-700 text-neutral-300 rounded text-sm hover:bg-neutral-900 transition-colors"
              aria-expanded={showAdvanced}
              aria-label={showAdvanced ? "hide recipe options" : "show recipe options"}
              title={showAdvanced ? "hide options" : "show options"}
            >
              {showAdvanced ? "▾" : "▸"}
            </button>
          </div>
          {recipe && (
            <div className="hidden sm:block text-[11px] text-neutral-600 font-mono leading-relaxed pt-1">
              <div className="truncate">recipe · {recipe}</div>
              <div className="truncate">seed · {seed}</div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 p-3 sm:p-6 flex items-center justify-center overflow-hidden">
        <div
          className="relative max-w-full max-h-full cursor-zoom-in"
          onClick={openShadowbox}
        >
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-full object-contain shadow-2xl border border-neutral-900"
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none text-xs uppercase tracking-wider text-neutral-300">
              rendering…
            </div>
          )}
        </div>
      </main>

      {shadowboxSrc && <Shadowbox src={shadowboxSrc} onClose={closeShadowbox} />}
    </div>
  );
}
