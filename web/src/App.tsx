import { useEffect, useRef, useState } from "react";
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

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-400">
      <span className="uppercase tracking-wider text-xs">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-100 focus:outline-none focus:border-neutral-500"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
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

  // Re-render whenever any input changes. "random" choices are resolved
  // deterministically from the seed, so a given seed + pinned choices map to
  // a stable scene.
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
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-800 px-6 py-3 flex flex-wrap items-center gap-4">
        <h1 className="text-neutral-100 font-medium tracking-tight mr-4">genviz</h1>

        <Select label="size" value={preset} options={PRESET_NAMES} onChange={setPreset} />
        <Select
          label="foreground"
          value={foreground}
          options={["random", ...FOREGROUNDS] as const}
          onChange={setForeground}
        />
        <Select
          label="focal"
          value={focal}
          options={["random", ...FOCALS] as const}
          onChange={setFocal}
        />
        <Select
          label="drift"
          value={drift}
          options={["random", ...DRIFTS] as const}
          onChange={setDrift}
        />

        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <span className="uppercase tracking-wider text-xs">seed</span>
          <input
            type="number"
            value={seed}
            onChange={e => setSeed(Number(e.target.value) || 0)}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-100 w-32 focus:outline-none focus:border-neutral-500"
          />
        </label>

        <div className="ml-auto flex gap-2">
          <button
            onClick={regenerate}
            disabled={rendering}
            className="px-3 py-1.5 bg-neutral-100 text-neutral-900 rounded text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            {rendering ? "Rendering…" : "Regenerate"}
          </button>
          <button
            onClick={download}
            disabled={rendering}
            className="px-3 py-1.5 border border-neutral-700 text-neutral-200 rounded text-sm hover:bg-neutral-900 disabled:opacity-50"
          >
            Download
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 flex items-center justify-center">
        <div
          className="relative max-w-full max-h-full cursor-zoom-in"
          onClick={openShadowbox}
        >
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-[calc(100vh-8rem)] shadow-2xl border border-neutral-900 object-contain"
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none text-sm text-neutral-200">
              rendering…
            </div>
          )}
        </div>
      </main>

      <footer className="px-6 py-2 text-xs text-neutral-600 border-t border-neutral-900">
        {recipe && <span>recipe: {recipe} · seed: {seed}</span>}
      </footer>

      {shadowboxSrc && <Shadowbox src={shadowboxSrc} onClose={closeShadowbox} />}
    </div>
  );
}
