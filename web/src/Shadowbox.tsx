import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  onClose: () => void;
}

export function Shadowbox({ src, onClose }: Props) {
  // zoom = 1 means "fit to viewport". >1 is zoomed in beyond fit.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  const clampZoom = (z: number) => Math.min(8, Math.max(0.25, z));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setZoom(z => clampZoom(z * 1.25));
      else if (e.key === "-" || e.key === "_") setZoom(z => clampZoom(z / 1.25));
      else if (e.key === "0") { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Wheel-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom(z => clampZoom(z * factor));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  // Compute the fitted display size using the browser's high-quality
  // resampling (via width/height CSS) rather than CSS transform: scale(),
  // which uses GPU bilinear filtering and aliases the Bayer dither pattern.
  const pad = 48;
  let displayW: number | undefined;
  let displayH: number | undefined;
  if (naturalSize) {
    const maxW = window.innerWidth - pad * 2;
    const maxH = window.innerHeight - pad * 2;
    const fitScale = Math.min(maxW / naturalSize.w, maxH / naturalSize.h, 1);
    displayW = naturalSize.w * fitScale * zoom;
    displayH = naturalSize.h * fitScale * zoom;
  }

  const displayPct = Math.round(zoom * 100);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center select-none"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
        onClick={e => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt="wallpaper preview"
          draggable={false}
          onLoad={onImageLoad}
          style={{
            width: displayW ? `${displayW}px` : undefined,
            height: displayH ? `${displayH}px` : undefined,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            willChange: "transform",
            opacity: naturalSize ? 1 : 0,
          }}
          className="transition-opacity duration-150 ease-out"
        />
      </div>

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-neutral-900/80 backdrop-blur px-3 py-2 rounded-full border border-neutral-700"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="w-9 h-9 rounded-full hover:bg-neutral-800 text-neutral-200 text-lg leading-none"
          onClick={() => setZoom(z => clampZoom(z / 1.25))}
          aria-label="zoom out"
        >−</button>
        <button
          className="w-9 h-9 rounded-full hover:bg-neutral-800 text-neutral-200 text-xs"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          title="Reset to fit"
        >{displayPct}%</button>
        <button
          className="w-9 h-9 rounded-full hover:bg-neutral-800 text-neutral-200 text-lg leading-none"
          onClick={() => setZoom(z => clampZoom(z * 1.25))}
          aria-label="zoom in"
        >+</button>
      </div>

      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-neutral-900/80 backdrop-blur border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
        onClick={onClose}
        aria-label="close"
      >×</button>
    </div>
  );
}
