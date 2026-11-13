import React, { useEffect, useRef, useState } from 'react';
import {
  Brush,
  Circle,
  Download,
  Eraser,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  Redo2,
  Save,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { ROOT_IDS } from '../../utils/vfs';

type Tool =
  | 'pencil'
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'line'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'text'
  | 'picker';

const PALETTE = [
  '#000000', '#7F7F7F', '#880015', '#ED1C24', '#FF7F27', '#FFF200', '#22B14C', '#00A2E8', '#3F48CC', '#A349A4',
  '#FFFFFF', '#C3C3C3', '#B97A57', '#FFAEC9', '#FFC90E', '#EFE4B0', '#B5E61D', '#99D9EA', '#7092BE', '#C8BFE7',
];

export const PaintApp: React.FC = () => {
  const { createVfsFile, addNotification } = useOS();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#0078D7');
  const [brushSize, setBrushSize] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyIdxRef = useRef(-1);
  const [textModal, setTextModal] = useState<{ x: number; y: number; value: string } | null>(null);

  const pushHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(snap);
    if (historyRef.current.length > 25) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  }, []);

  const undo = () => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const ctx = canvasRef.current?.getContext('2d');
    const snap = historyRef.current[historyIdxRef.current];
    if (ctx && snap) ctx.putImageData(snap, 0, 0);
  };

  const redo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const ctx = canvasRef.current?.getContext('2d');
    const snap = historyRef.current[historyIdxRef.current];
    if (ctx && snap) ctx.putImageData(snap, 0, 0);
  };

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * canvas.width),
      y: Math.round(((e.clientY - rect.top) / rect.height) * canvas.height),
    };
  };

  const floodFill = (sx: number, sy: number, fillHex: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    const w = canvas.width;
    const h = canvas.height;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

    const rNew = parseInt(fillHex.slice(1, 3), 16);
    const gNew = parseInt(fillHex.slice(3, 5), 16);
    const bNew = parseInt(fillHex.slice(5, 7), 16);

    const startIdx = (sy * w + sx) * 4;
    const rOld = data[startIdx];
    const gOld = data[startIdx + 1];
    const bOld = data[startIdx + 2];
    if (rOld === rNew && gOld === gNew && bOld === bNew) return;

    const stack = [[sx, sy]];
    const visited = new Uint8Array(w * h);
    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      const p = cy * w + cx;
      if (visited[p]) continue;
      visited[p] = 1;
      const idx = p * 4;
      if (
        Math.abs(data[idx] - rOld) <= 24 &&
        Math.abs(data[idx + 1] - gOld) <= 24 &&
        Math.abs(data[idx + 2] - bOld) <= 24
      ) {
        data[idx] = rNew;
        data[idx + 1] = gNew;
        data[idx + 2] = bNew;
        data[idx + 3] = 255;
        if (cx > 0) stack.push([cx - 1, cy]);
        if (cx < w - 1) stack.push([cx + 1, cy]);
        if (cy > 0) stack.push([cx, cy - 1]);
        if (cy < h - 1) stack.push([cx, cy + 1]);
      }
    }
    ctx.putImageData(img, 0, 0);
    pushHistory();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const pt = getCoords(e);

    if (tool === 'picker') {
      const px = ctx.getImageData(pt.x, pt.y, 1, 1).data;
      const hex = `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      setColor(hex);
      setTool('brush');
      return;
    }

    if (tool === 'fill') {
      floodFill(pt.x, pt.y, color);
      return;
    }

    if (tool === 'text') {
      setTextModal({ x: pt.x, y: pt.y, value: '' });
      return;
    }

    setIsDrawing(true);
    setStartPt(pt);
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      ctx.lineWidth = tool === 'pencil' ? Math.max(1, Math.round(brushSize / 3)) : brushSize;
      ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
      ctx.stroke();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPt) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const pt = getCoords(e);

    if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      return;
    }

    if (snapshotRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, Math.round(brushSize / 2));
    ctx.beginPath();

    if (tool === 'line') {
      ctx.moveTo(startPt.x, startPt.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    } else if (tool === 'rect') {
      ctx.strokeRect(startPt.x, startPt.y, pt.x - startPt.x, pt.y - startPt.y);
    } else if (tool === 'circle') {
      const rx = Math.abs(pt.x - startPt.x) / 2;
      const ry = Math.abs(pt.y - startPt.y) / 2;
      const cx = Math.min(startPt.x, pt.x) + rx;
      const cy = Math.min(startPt.y, pt.y) + ry;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === 'triangle') {
      ctx.moveTo((startPt.x + pt.x) / 2, startPt.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.lineTo(startPt.x, pt.y);
      ctx.closePath();
      ctx.stroke();
    }
  };

  const onPointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setStartPt(null);
    pushHistory();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  };

  const saveToPictures = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const name = `Painting_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.png`;
    await createVfsFile(ROOT_IDS.PICTURES, name, dataUrl, 'image/png');
    addNotification('Paint', 'Saved to Pictures', `${name} saved to your Pictures folder.`);
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'painting.png';
    a.click();
  };

  const tools: Array<{ id: Tool; label: string; icon: React.ReactNode }> = [
    { id: 'pencil', label: 'Pencil', icon: <Pencil className="w-3.5 h-3.5" /> },
    { id: 'brush', label: 'Brush', icon: <Brush className="w-3.5 h-3.5" /> },
    { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-3.5 h-3.5" /> },
    { id: 'fill', label: 'Fill', icon: <PaintBucket className="w-3.5 h-3.5" /> },
    { id: 'line', label: 'Line', icon: <Minus className="w-3.5 h-3.5" /> },
    { id: 'rect', label: 'Rectangle', icon: <Square className="w-3.5 h-3.5" /> },
    { id: 'circle', label: 'Ellipse', icon: <Circle className="w-3.5 h-3.5" /> },
    { id: 'triangle', label: 'Triangle', icon: <Triangle className="w-3.5 h-3.5" /> },
    { id: 'text', label: 'Text', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'picker', label: 'Eyedropper', icon: <Pipette className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-200 dark:bg-[#1e1e1e] text-neutral-900 dark:text-neutral-100 relative">
      {/* Ribbon */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-[#262626] border-b border-neutral-300 dark:border-neutral-800 text-xs">
        <div className="flex items-center gap-0.5">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`p-1.5 cursor-pointer ${
                tool === t.id
                  ? 'bg-[#0078D7] text-white'
                  : 'hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500">Size</span>
          <input
            type="range"
            min={2}
            max={40}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 accent-[#0078D7]"
          />
          <span className="text-[11px] tabular-nums w-6">{brushSize}</span>
        </div>

        <div className="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />

        {/* Palette */}
        <div className="flex items-center gap-1 flex-wrap">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 border border-neutral-400 cursor-pointer bg-transparent"
            title="Custom color"
          />
          <div className="grid grid-cols-10 gap-0.5">
            {PALETTE.map((hex) => (
              <button
                key={hex}
                onClick={() => setColor(hex)}
                style={{ backgroundColor: hex }}
                className={`w-3.5 h-3.5 border cursor-pointer ${
                  color.toLowerCase() === hex.toLowerCase()
                    ? 'border-[#0078D7] ring-1 ring-[#0078D7]'
                    : 'border-neutral-400/60'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={undo} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Undo">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={redo} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Redo">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={clearCanvas} className="p-1.5 hover:bg-rose-500/15 text-rose-600 cursor-pointer" title="Clear canvas">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={saveToPictures}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={downloadPng}
            className="flex items-center gap-1 px-2.5 py-1 border border-neutral-300 dark:border-neutral-600 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> PNG
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={920}
          height={560}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="bg-white shadow-lg border border-neutral-400 max-w-full max-h-full touch-none cursor-crosshair"
        />
      </div>

      {textModal && (
        <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const ctx = canvasRef.current?.getContext('2d');
              if (ctx && textModal.value.trim()) {
                ctx.fillStyle = color;
                ctx.font = `${Math.max(14, brushSize * 2.5)}px "Segoe UI", sans-serif`;
                ctx.fillText(textModal.value, textModal.x, textModal.y);
                pushHistory();
              }
              setTextModal(null);
            }}
            className="w-full max-w-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-4 shadow-xl space-y-3"
          >
            <h4 className="text-xs font-semibold">Insert Text</h4>
            <input
              type="text"
              autoFocus
              value={textModal.value}
              onChange={(e) => setTextModal({ ...textModal, value: e.target.value })}
              placeholder="Enter text..."
              className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTextModal(null)} className="px-3 py-1 text-xs bg-neutral-200 dark:bg-neutral-800 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-3 py-1 text-xs bg-[#0078D7] text-white cursor-pointer">
                Place Text
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
