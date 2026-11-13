import React, { useEffect, useRef, useState } from 'react';
import { Download, Highlighter, Pen, Save, Scissors, Trash2 } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { ROOT_IDS } from '../../utils/vfs';

export const SnippingToolApp: React.FC = () => {
  const {
    setSnipOverlayOpen,
    snipCapturedImage,
    setSnipCapturedImage,
    createVfsFile,
    addNotification,
  } = useOS();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawMode, setDrawMode] = useState<'pen' | 'highlighter'>('pen');
  const [penColor, setPenColor] = useState('#E11D48');
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !snipCapturedImage) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = snipCapturedImage;
  }, [snipCapturedImage]);

  const getPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };

  const handleSave = async () => {
    const c = canvasRef.current;
    if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    const name = `Snip_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.png`;
    await createVfsFile(ROOT_IDS.PICTURES, name, dataUrl, 'image/png');
    addNotification('Snipping Tool', 'Screenshot saved', `Saved ${name} to Pictures`);
  };

  const handleDownload = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'screenshot-snip.png';
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-neutral-100 dark:bg-[#1f1f1f] text-neutral-900 dark:text-neutral-100">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white dark:bg-[#262626] border-b border-neutral-200 dark:border-neutral-800 text-xs">
        <button
          onClick={() => setSnipOverlayOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
        >
          <Scissors className="w-3.5 h-3.5" /> New Snip
        </button>

        {snipCapturedImage && (
          <>
            <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700" />
            <button
              onClick={() => setDrawMode('pen')}
              className={`flex items-center gap-1 px-2.5 py-1 cursor-pointer ${
                drawMode === 'pen' ? 'bg-black/10 dark:bg-white/15 font-medium' : ''
              }`}
            >
              <Pen className="w-3.5 h-3.5" /> Pen
            </button>
            <button
              onClick={() => setDrawMode('highlighter')}
              className={`flex items-center gap-1 px-2.5 py-1 cursor-pointer ${
                drawMode === 'highlighter' ? 'bg-black/10 dark:bg-white/15 font-medium' : ''
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" /> Highlighter
            </button>
            <input
              type="color"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              className="w-6 h-6 border border-neutral-300 cursor-pointer bg-transparent"
            />
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save to Pictures
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2.5 py-1 border border-neutral-300 dark:border-neutral-600 hover:bg-black/5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> PNG
              </button>
              <button
                onClick={() => setSnipCapturedImage(null)}
                className="p-1.5 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        {snipCapturedImage ? (
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              const ctx = canvasRef.current?.getContext('2d');
              if (!ctx) return;
              const pt = getPt(e);
              setDrawing(true);
              ctx.beginPath();
              ctx.moveTo(pt.x, pt.y);
              ctx.lineCap = 'round';
              ctx.strokeStyle = drawMode === 'highlighter' ? `${penColor}55` : penColor;
              ctx.lineWidth = drawMode === 'highlighter' ? 16 : 3;
            }}
            onPointerMove={(e) => {
              if (!drawing) return;
              const ctx = canvasRef.current?.getContext('2d');
              if (!ctx) return;
              const pt = getPt(e);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
            }}
            onPointerUp={() => setDrawing(false)}
            className="max-w-full max-h-full shadow-xl border border-neutral-400 cursor-crosshair touch-none"
          />
        ) : (
          <div className="text-center max-w-sm space-y-3">
            <Scissors className="w-10 h-10 mx-auto text-[#0078D7]" />
            <div className="text-sm font-medium">Snipping Tool</div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Click <strong>New Snip</strong> to drag-select any region of your desktop, then annotate and save it to Pictures.
            </p>
            <button
              onClick={() => setSnipOverlayOpen(true)}
              className="px-4 py-2 bg-[#0078D7] text-white text-xs font-medium hover:bg-[#106EBE] cursor-pointer"
            >
              Start Rectangular Snip
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Desktop Snipping Region Overlay
export const SnippingOverlay: React.FC = () => {
  const {
    snipOverlayOpen,
    setSnipOverlayOpen,
    setSnipCapturedImage,
    settings,
    windows,
    openApp,
  } = useOS();

  const [drag, setDrag] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  if (!snipOverlayOpen) return null;

  const finishSnip = async (rect: { x: number; y: number; w: number; h: number }) => {
    const outW = Math.max(120, Math.round(rect.w));
    const outH = Math.max(80, Math.round(rect.h));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;

    // Render crisp composite of wallpaper + visible window chrome inside selected region
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const drawDesktopComposite = () => {
      // Draw window frames intersecting the snip region
      ctx.save();
      ctx.translate(-rect.x, -rect.y);

      const visibleWins = [...windows]
        .filter((w) => !w.isMinimized)
        .sort((a, b) => a.zIndex - b.zIndex);

      visibleWins.forEach((w) => {
        const wx = w.isMaximized ? 0 : w.x;
        const wy = w.isMaximized ? 0 : w.y;
        const ww = w.isMaximized ? vw : w.width;
        const wh = w.isMaximized ? vh - 44 : w.height;
        ctx.fillStyle = settings.darkMode ? '#202020' : '#ffffff';
        ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = '#555555';
        ctx.strokeRect(wx, wy, ww, wh);
        ctx.fillStyle = settings.darkMode ? '#2b2b2b' : '#f3f3f3';
        ctx.fillRect(wx, wy, ww, 30);
        ctx.fillStyle = settings.darkMode ? '#ffffff' : '#111111';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.fillText(w.title, wx + 12, wy + 19);
      });

      ctx.restore();
      setSnipCapturedImage(canvas.toDataURL('image/png'));
      setSnipOverlayOpen(false);
      openApp('snipping');
    };

    if (!settings.wallpaper.startsWith('linear-gradient')) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(
          img,
          (rect.x / vw) * img.width,
          (rect.y / vh) * img.height,
          (outW / vw) * img.width,
          (outH / vh) * img.height,
          0,
          0,
          outW,
          outH
        );
        drawDesktopComposite();
      };
      img.onerror = () => {
        ctx.fillStyle = '#003973';
        ctx.fillRect(0, 0, outW, outH);
        drawDesktopComposite();
      };
      img.src = settings.wallpaper;
    } else {
      const g = ctx.createLinearGradient(0, 0, outW, outH);
      g.addColorStop(0, '#003973');
      g.addColorStop(1, '#0078D7');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, outW, outH);
      drawDesktopComposite();
    }
  };

  const sel = drag
    ? {
        x: Math.min(drag.x1, drag.x2),
        y: Math.min(drag.y1, drag.y2),
        w: Math.abs(drag.x2 - drag.x1),
        h: Math.abs(drag.y2 - drag.y1),
      }
    : null;

  return (
    <div
      onMouseDown={(e) => setDrag({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY })}
      onMouseMove={(e) => drag && setDrag({ ...drag, x2: e.clientX, y2: e.clientY })}
      onMouseUp={() => {
        if (sel && sel.w > 10 && sel.h > 10) {
          finishSnip(sel);
        }
        setDrag(null);
      }}
      className="fixed inset-0 z-[9900] bg-black/45 cursor-crosshair select-none"
    >
      <div className="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-neutral-900/90 text-white text-xs border border-white/20 shadow-xl flex items-center gap-3 pointer-events-auto">
        <span>Drag to capture a region of the desktop</span>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => finishSnip({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight })}
          className="px-2.5 py-1 bg-[#0078D7] hover:bg-[#106EBE] cursor-pointer"
        >
          Full Screen
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setSnipOverlayOpen(false)}
          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {sel && (
        <div
          style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
          className="fixed border-2 border-white bg-white/10 pointer-events-none"
        />
      )}
    </div>
  );
};
