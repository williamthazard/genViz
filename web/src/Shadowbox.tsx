import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  onClose: () => void;
}

export function Shadowbox({ src, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setZoom(z => Math.min(8, z * 1.25));
      else if (e.key === "-" || e.key === "_") setZoom(z => Math.max(0.25, z / 1.25));
      else if (e.key === "0") { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center select-none"
      onClick={onClose}
    >
      <div
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
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            maxWidth: "none",
            maxHeight: "none",
          }}
          className="transition-transform duration-75 ease-out will-change-transform"
        />
      </div>

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-neutral-900/80 backdrop-blur px-3 py-2 rounded-full border border-neutral-700"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="w-9 h-9 rounded-full hover:bg-neutral-800 text-neutral-200 text-lg leading-none"
          onClick={() => setZoom(z => Math.max(0.25, z / 1.25))}
          aria-label="zoom out"
        >−</button>
        <button
          className="w-9 h-9 rounded-full hover:bg-neutral-800 text-neutral-200 text-xs"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
        >{Math.round(zoom * 100)}%</button>
        <button
          className="w-9 h-9 rounded-full hover:bg-neutral-800 text-neutral-200 text-lg leading-none"
          onClick={() => setZoom(z => Math.min(8, z * 1.25))}
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
