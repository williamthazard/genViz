import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  render,
  randomSeed,
  resolveRecipe,
  FOREGROUNDS,
  FOCALS,
  DRIFTS,
  PRESETS,
  Rng,
  type Foreground,
  type Focal,
  type Drift,
  type PresetName,
} from "./genviz";
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

export default function App() {
  const [preset, setPreset] = useState<PresetName>("mobile");
  const [foreground, setForeground] = useState<Choice<Foreground>>("random");
  const [focal, setFocal] = useState<Choice<Focal>>("random");
  const [drift, setDrift] = useState<Choice<Drift>>("random");
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [recipe, setRecipe] = useState<string>("");
  const [rendering, setRendering] = useState(false);
  const [shadowboxSrc, setShadowboxSrc] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    const raf = requestAnimationFrame(() => {
      const [w, h] = PRESETS[preset];
      const resolvedRng = new Rng(seed);
      const resolved = resolveRecipe(resolvedRng, foreground, focal, drift);
      render(canvas, w, h, seed, resolved.foreground, resolved.focal, resolved.drift);
      setRecipe(`${resolved.foreground}-${resolved.focal}-${resolved.drift}`);
      setRendering(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [preset, foreground, focal, drift, seed]);

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
    <div className="h-full flex flex-col sm:flex-row bg-neutral-950 text-neutral-200">
      <aside className="shrink-0 flex flex-col border-b border-neutral-800 sm:border-b-0 sm:border-r sm:w-72 sm:h-full overflow-y-auto">
        <div className="px-5 py-4 flex items-baseline justify-between border-b border-neutral-900">
          <h1 className="text-neutral-100 font-medium tracking-tight text-base">genviz</h1>
          <span className="text-[10px] uppercase tracking-wider text-neutral-600">
            wallpapers
          </span>
        </div>

        <div className="p-5 flex flex-col gap-4 sm:flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
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

        <div className="p-5 border-t border-neutral-900 flex flex-col gap-2">
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
          </div>
          {recipe && (
            <div className="text-[11px] text-neutral-600 font-mono leading-relaxed pt-1">
              <div className="truncate">recipe · {recipe}</div>
              <div className="truncate">seed · {seed}</div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 p-4 sm:p-6 flex items-center justify-center overflow-hidden">
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
