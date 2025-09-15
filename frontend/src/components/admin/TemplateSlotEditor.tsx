import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoSlot } from '../../types';

type RatioSlot = { x: number; y: number; width: number; height: number };

export interface TemplateSlotEditorProps {
  imageFile: File | null;
  initialSlots?: PhotoSlot[]; // pixels (optional)
  onChange?: (slotsPx: PhotoSlot[], meta: { baseWidth: number; baseHeight: number; slotsRatio: RatioSlot[] }) => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const TemplateSlotEditor: React.FC<TemplateSlotEditorProps> = ({ imageFile, initialSlots, onChange }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [slotsRatio, setSlotsRatio] = useState<RatioSlot[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // View transform state (pan & zoom for template canvas)
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [panState, setPanState] = useState<null | { startX: number; startY: number; origX: number; origY: number }>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [debug, setDebug] = useState(false);
  const [debugDrag, setDebugDrag] = useState<{dx:number;dy:number;rawDx:number;rawDy:number}|null>(null);

  // Load image URL
  useEffect(() => {
    if (!imageFile) {
      setImgUrl(null);
      setNatural(null);
      setSlotsRatio([]);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // If initial slots are provided in pixels, convert to ratio once per image load
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialSlots || !natural || !imgUrl) return;
    if (seededRef.current === imgUrl) return; // already seeded for this image
    const r = initialSlots.map((s) => ({
      x: s.x / natural.w,
      y: s.y / natural.h,
      width: s.width / natural.w,
      height: s.height / natural.h,
    }));
    setSlotsRatio(r);
    seededRef.current = imgUrl;
  }, [initialSlots, natural, imgUrl]);

  // Use a ref to avoid recreating dependencies and causing infinite loops
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!natural) return;
    if (!onChangeRef.current) return;
    const rSlots = slotsRatio;
    const px: PhotoSlot[] = rSlots.map((s) => ({
      x: Math.round(s.x * natural.w),
      y: Math.round(s.y * natural.h),
      width: Math.round(s.width * natural.w),
      height: Math.round(s.height * natural.h),
      rotation: 0,
      borderRadius: 0,
    }));
    onChangeRef.current(px, { baseWidth: natural.w, baseHeight: natural.h, slotsRatio: rSlots });
  }, [slotsRatio, natural]);

  const [dragState, setDragState] = useState<
    | null
    | {
        type: 'move' | 'resize';
        index: number;
        startClientX: number;
        startClientY: number;
        orig: RatioSlot;
        handle?: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
      }
  >(null);

  // Helper to compute inner box (displayed image area within container due to object-contain)
  const getInnerBox = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    let innerLeft = rect.left;
    let innerTop = rect.top;
    let innerWidth = rect.width;
    let innerHeight = rect.height;
    if (natural) {
      const containerRatio = rect.width / rect.height;
      const imgRatio = natural.w / natural.h;
      if (imgRatio > containerRatio) {
        innerWidth = rect.width;
        innerHeight = rect.width / imgRatio;
        innerTop = rect.top + (rect.height - innerHeight) / 2;
      } else {
        innerHeight = rect.height;
        innerWidth = rect.height * imgRatio;
        innerLeft = rect.left + (rect.width - innerWidth) / 2;
      }
    }
    return { innerLeft, innerTop, innerWidth, innerHeight };
  };

  const onPointerDown = (
    e: React.PointerEvent,
    index: number,
    type: 'move' | 'resize',
    handle?: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
  ) => {
    if (panMode) return; // disable slot interactions in pan mode
    e.preventDefault();
  // Capture on the slot element (or its parent slot) so we reliably receive pointermove events
  const slotEl = (e.currentTarget as HTMLElement).closest('[data-slot]') as HTMLElement | null;
  (slotEl ?? (e.currentTarget as HTMLElement)).setPointerCapture?.(e.pointerId);
  setSelectedIndex(index);
  setDragState({ type, index, startClientX: e.clientX, startClientY: e.clientY, orig: { ...slotsRatio[index] }, handle });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Pan handling
    if (panState) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
  const dxPx = (e.clientX - panState.startX) / scale; // keep pan speed consistent across zoom
  const dyPx = (e.clientY - panState.startY) / scale;
  setTranslate({ x: panState.origX + dxPx, y: panState.origY + dyPx });
      return;
    }
    if (!dragState) return;
    performDrag(e.clientX, e.clientY);
  };

  const performDrag = (clientX: number, clientY: number) => {
    
    if (!dragState) return;
    const box = getInnerBox();
    if (!box) return;
    const { innerWidth, innerHeight } = box;
    const rawDx = clientX - dragState.startClientX;
    const rawDy = clientY - dragState.startClientY;
    const dxPixels = rawDx / scale;
    const dyPixels = rawDy / scale;
    const dx = dxPixels / innerWidth;
    const dy = dyPixels / innerHeight;

    setDebugDrag({dx,dy,rawDx,rawDy});
    setSlotsRatio(prev => {
      const next = [...prev];
      let s = {...next[dragState.index]};
      if (dragState.type === 'move') {
        s.x = clamp(dragState.orig.x + dx, 0, 1 - s.width);
        s.y = clamp(dragState.orig.y + dy, 0, 1 - s.height);
      } else {
        const minSize = 0.02;
        const h = dragState.handle;
        if (h === 'e' || h === 'ne' || h === 'se') {
          s.width = clamp(dragState.orig.width + dx, minSize, 1 - dragState.orig.x);
        }
        if (h === 's' || h === 'se' || h === 'sw') {
          s.height = clamp(dragState.orig.height + dy, minSize, 1 - dragState.orig.y);
        }
        if (h === 'w' || h === 'nw' || h === 'sw') {
          const newX = clamp(dragState.orig.x + dx, 0, dragState.orig.x + dragState.orig.width - minSize);
          const newW = clamp(dragState.orig.width - (newX - dragState.orig.x), minSize, 1 - newX);
          s.x = newX; s.width = newW;
        }
        if (h === 'n' || h === 'ne' || h === 'nw') {
          const newY = clamp(dragState.orig.y + dy, 0, dragState.orig.y + dragState.orig.height - minSize);
          const newH = clamp(dragState.orig.height - (newY - dragState.orig.y), minSize, 1 - newY);
          s.y = newY; s.height = newH;
        }
      }
      next[dragState.index] = s;
      return next;
    });
  };

  // Global listeners to avoid freeze if pointer leaves element
  useEffect(() => {
    if (!dragState) return;
    const move = (e: PointerEvent) => {
      performDrag(e.clientX, e.clientY);
    };
  const up = () => {
      setDragState(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragState, scale]);

  const onPointerUp = (e: React.PointerEvent) => {
    const container = containerRef.current;
    container?.releasePointerCapture?.(e.pointerId);
    setDragState(null);
    setPanState(null);
  };

  // Pan start when clicking empty space in pan mode
  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (!panMode) return;
    // Avoid starting pan when clicking a slot
    const target = e.target as HTMLElement;
    if (target.closest('[data-slot]')) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanState({ startX: e.clientX, startY: e.clientY, origX: translate.x, origY: translate.y });
  };

  const zoom = (dir: 1 | -1) => {
    setScale((s) => clamp(Number((s + dir * 0.2).toFixed(2)), 0.2, 4));
  };
  const resetView = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const MAX_SLOTS = 32;
  const addSlot = () => {
    setSlotsRatio((prev) => {
      if (prev.length >= MAX_SLOTS) return prev; // silently ignore over limit
      return [...prev, { x: 0.05, y: 0.05, width: 0.2, height: 0.2 }];
    });
  };
  const removeSlot = (index: number) => setSlotsRatio((prev) => prev.filter((_, i) => i !== index));
  const clearSlots = () => setSlotsRatio([]);

  const overlay = useMemo(() => {
    return (
      <div
        ref={containerRef}
        className="relative w-full border rounded-md bg-gray-50 overflow-hidden"
        style={{ aspectRatio: natural ? `${natural.w} / ${natural.h}` : undefined, touchAction: 'none', cursor: panMode ? 'grab' : 'default' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerDown={handleBackgroundPointerDown}
      >
        <div
          ref={contentRef}
          className="absolute inset-0"
          style={{
            // translate then scale (original approach); math in computeNormalized inverses accordingly
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {imgUrl && (
            <img
              src={imgUrl}
              alt="template"
              className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;
                if (w && h) setNatural({ w, h });
              }}
            />
          )}
          {/* slots */}
          {slotsRatio.map((s, i) => {
            const slotStyle: React.CSSProperties = {
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              width: `${s.width * 100}%`,
              height: `${s.height * 100}%`,
              touchAction: 'none'
            };
            return (
              <div
                key={i}
                data-slot
                className={`absolute border-2 transition-shadow ${panMode ? 'pointer-events-none opacity-60' : 'cursor-move'} ${selectedIndex===i ? 'border-sky-500 bg-sky-400/10 shadow-[0_0_0_1px_rgba(14,165,233,0.65)]' : 'border-sky-400/70 bg-sky-300/10'}`}
                style={{ ...slotStyle, zIndex: selectedIndex===i ? 20 : 5 }}
                onPointerDown={(e) => { onPointerDown(e, i, 'move'); }}
                onPointerUp={() => setSelectedIndex(i)}
                onPointerMove={(e) => { if (dragState && dragState.index === i) onPointerMove(e as any); }}
                onDoubleClick={() => setSelectedIndex(i)}
                role="button"
                aria-label={`Photo slot ${i + 1}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Delete') removeSlot(i);
                }}
              >
              {!panMode && (
                <>
                  {(['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const).map((h) => (
                    <span
                      key={h}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setSelectedIndex(i);
                        onPointerDown(e, i, 'resize', h);
                      }}
                      className="absolute bg-sky-500 rounded-sm hover:bg-sky-400 focus:outline-none"
                      style={{
                        width: 14,
                        height: 14,
                        cursor:
                          h === 'n'
                            ? 'ns-resize'
                            : h === 's'
                            ? 'ns-resize'
                            : h === 'e'
                            ? 'ew-resize'
                            : h === 'w'
                            ? 'ew-resize'
                            : h === 'ne'
                            ? 'nesw-resize'
                            : h === 'nw'
                            ? 'nwse-resize'
                            : h === 'se'
                            ? 'nwse-resize'
                            : 'nesw-resize',
                        left: h.includes('w') ? -7 : h.includes('e') ? 'calc(100% - 7px)' : 'calc(50% - 7px)',
                        top: h.includes('n') ? -7 : h.includes('s') ? 'calc(100% - 7px)' : 'calc(50% - 7px)',
                      }}
                    />
                  ))}
                  <div className="absolute -top-6 left-0 text-xs bg-sky-600 text-white px-1.5 py-0.5 rounded shadow">
                    Slot {i + 1}
                    <button className="ml-2 text-red-200 hover:text-white" onClick={(e) => { e.stopPropagation(); removeSlot(i); }}>✕</button>
                  </div>
                </>
              )}
              </div>
            );
          })}
          {debug && natural && (
            <div className="absolute bottom-1 left-1 bg-black/60 text-[10px] text-white px-2 py-1 rounded pointer-events-none select-none">
              Scale {scale.toFixed(2)} | Pan {Math.round(translate.x)},{Math.round(translate.y)} | Slots {slotsRatio.length}
              {selectedIndex!=null && slotsRatio[selectedIndex] && (
                <> | Sel {selectedIndex+1}: {(slotsRatio[selectedIndex].x*natural.w)|0},{(slotsRatio[selectedIndex].y*natural.h)|0} {(slotsRatio[selectedIndex].width*natural.w)|0}x{(slotsRatio[selectedIndex].height*natural.h)|0}</>
              )}
              {debugDrag && <> | Drag dx {debugDrag.dx.toFixed(3)} dy {debugDrag.dy.toFixed(3)} (px {debugDrag.rawDx},{debugDrag.rawDy})</>}
            </div>
          )}
        </div>
        {panMode && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded shadow">Pan Mode Active – drag empty space</div>
        )}
      </div>
    );
  }, [imgUrl, natural, slotsRatio, scale, translate, panMode, selectedIndex, debug]);

  if (!imageFile) {
    return (
      <div className="p-3 text-sm text-gray-600 bg-gray-50 rounded border">Choose a template image to enable the editor.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" className={`px-2 py-1 rounded border ${panMode ? 'bg-sky-600 text-white' : 'bg-white'}`} onClick={() => setPanMode((v) => !v)}>
          {panMode ? 'Exit Pan' : 'Pan'}
        </button>
        <button type="button" className="px-2 py-1 rounded border" onClick={() => zoom(-1)} disabled={scale <= 0.25}>
          Zoom -
        </button>
        <button type="button" className="px-2 py-1 rounded border" onClick={() => zoom(1)} disabled={scale >= 4}>
          Zoom +
        </button>
        <button type="button" className="px-2 py-1 rounded border" onClick={resetView}>
          Reset View
        </button>
        <span className="text-gray-500">Scale: {scale.toFixed(2)}</span>
        <label className="inline-flex items-center gap-1 ml-2 cursor-pointer select-none">
          <input type="checkbox" className="accent-sky-600" checked={debug} onChange={(e)=>setDebug(e.target.checked)} />
          <span>Debug</span>
        </label>
      </div>
      {overlay}
      <div className="flex items-center gap-2">
  <button type="button" className="btn-secondary" onClick={addSlot} disabled={!natural}>Add Slot</button>
        <button type="button" className="btn-ghost" onClick={clearSlots}>Clear</button>
        {natural && (
          <div className="text-xs text-gray-500">Base: {natural.w} x {natural.h}</div>
        )}
  <div className="text-xs text-gray-400 ml-auto">Slots: {slotsRatio.length}{slotsRatio.length >= 32 ? ' (max)' : ''}</div>
      </div>
    </div>
  );
};

export default TemplateSlotEditor;
