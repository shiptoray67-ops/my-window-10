import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from 'lucide-react';
import { soundEngine } from '../../utils/sound';

const GRID = 18;
type Pt = { x: number; y: number };

export const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState<Pt[]>([
    { x: 8, y: 9 },
    { x: 7, y: 9 },
    { x: 6, y: 9 },
  ]);
  const [food, setFood] = useState<Pt>({ x: 13, y: 9 });
  const [dir, setDir] = useState<Pt>({ x: 1, y: 0 });
  const dirRef = useRef<Pt>({ x: 1, y: 0 });
  const [status, setStatus] = useState<'ready' | 'playing' | 'gameover'>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('win10_snake_best') || 0));
  const [speedMs, setSpeedMs] = useState(125);

  const spawnFood = useCallback((body: Pt[]): Pt => {
    let pt: Pt;
    do {
      pt = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (body.some((b) => b.x === pt.x && b.y === pt.y));
    return pt;
  }, []);

  const reset = (autoStart = true) => {
    const startSnake = [
      { x: 8, y: 9 },
      { x: 7, y: 9 },
      { x: 6, y: 9 },
    ];
    setSnake(startSnake);
    setFood(spawnFood(startSnake));
    dirRef.current = { x: 1, y: 0 };
    setDir({ x: 1, y: 0 });
    setScore(0);
    setStatus(autoStart ? 'playing' : 'ready');
  };

  const turn = useCallback((nx: number, ny: number) => {
    const cur = dirRef.current;
    if (cur.x + nx === 0 && cur.y + ny === 0) return;
    dirRef.current = { x: nx, y: ny };
    setDir({ x: nx, y: ny });
    if (status === 'ready') setStatus('playing');
  }, [status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); turn(0, -1); }
      else if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); turn(0, 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); turn(-1, 0); }
      else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); turn(1, 0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  useEffect(() => {
    if (status !== 'playing') return;
    const t = setInterval(() => {
      setSnake((prev) => {
        const d = dirRef.current;
        const head = { x: prev[0].x + d.x, y: prev[0].y + d.y };
        if (
          head.x < 0 ||
          head.x >= GRID ||
          head.y < 0 ||
          head.y >= GRID ||
          prev.some((s) => s.x === head.x && s.y === head.y)
        ) {
          soundEngine.playError();
          setStatus('gameover');
          return prev;
        }

        const next = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          soundEngine.playClick();
          setScore((sc) => {
            const ns = sc + 10;
            if (ns > best) {
              setBest(ns);
              localStorage.setItem('win10_snake_best', String(ns));
            }
            return ns;
          });
          setFood(spawnFood(next));
          return next;
        }
        next.pop();
        return next;
      });
    }, speedMs);
    return () => clearInterval(t);
  }, [status, food, speedMs, best, spawnFood]);

  return (
    <div className="flex flex-col items-center justify-between h-full bg-[#0f172a] text-white p-4 select-none">
      <div className="w-full max-w-sm flex items-center justify-between text-xs">
        <div className="flex gap-4 tabular-nums">
          <span>Score: <strong>{score}</strong></span>
          <span className="text-emerald-400">Best: <strong>{best}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] outline-none"
          >
            <option value={160}>Relaxed</option>
            <option value={125}>Normal</option>
            <option value={80}>Fast</option>
          </select>
          <button
            onClick={() => reset(true)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 cursor-pointer"
            title="Restart"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Board */}
      <div
        style={{
          gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID}, minmax(0, 1fr))`,
        }}
        className="relative w-full max-w-[340px] aspect-square bg-slate-900 border-2 border-slate-700 grid"
      >
        {Array.from({ length: GRID * GRID }).map((_, idx) => {
          const x = idx % GRID;
          const y = Math.floor(idx / GRID);
          const isHead = snake[0]?.x === x && snake[0]?.y === y;
          const isBody = !isHead && snake.some((s) => s.x === x && s.y === y);
          const isFood = food.x === x && food.y === y;
          return (
            <div
              key={idx}
              className={`${
                isHead
                  ? 'bg-emerald-400'
                  : isBody
                  ? 'bg-emerald-600/90 border border-slate-900/40'
                  : isFood
                  ? 'bg-rose-500 rounded-full scale-75'
                  : ''
              }`}
            />
          );
        })}

        {status !== 'playing' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <div className="text-xl font-bold">
              {status === 'gameover' ? 'Game Over' : 'Snake Classic'}
            </div>
            {status === 'gameover' && (
              <div className="text-xs text-slate-300 tabular-nums">Final Score: {score}</div>
            )}
            <button
              onClick={() => reset(true)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold cursor-pointer"
            >
              {status === 'gameover' ? 'Play Again' : 'Start Game'}
            </button>
          </div>
        )}
      </div>

      {/* Touch D-Pad for Mobile & Quick Clicks */}
      <div className="grid grid-cols-3 gap-1 w-36">
        <div />
        <button onClick={() => turn(0, -1)} className="h-9 bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer">
          <ArrowUp className="w-4 h-4" />
        </button>
        <div />
        <button onClick={() => turn(-1, 0)} className="h-9 bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button onClick={() => turn(0, 1)} className="h-9 bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer">
          <ArrowDown className="w-4 h-4" />
        </button>
        <button onClick={() => turn(1, 0)} className="h-9 bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
