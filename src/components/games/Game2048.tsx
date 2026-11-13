import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';
import { soundEngine } from '../../utils/sound';

type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: 4 }, () => [0, 0, 0, 0]);
}

function addRandomTile(b: Board): Board {
  const empty: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (b[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return b;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const next = b.map((row) => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRowLeft(row: number[]): { next: number[]; gained: number } {
  const nonZero = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < nonZero.length; i++) {
    if (nonZero[i] === nonZero[i + 1]) {
      const merged = nonZero[i] * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(nonZero[i]);
    }
  }
  while (out.length < 4) out.push(0);
  return { next: out, gained };
}

function rotateCW(b: Board): Board {
  const out = emptyBoard();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[c][3 - r] = b[r][c];
    }
  }
  return out;
}

function canMove(b: Board): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (b[r][c] === 0) return true;
      if (r < 3 && b[r][c] === b[r + 1][c]) return true;
      if (c < 3 && b[r][c] === b[r][c + 1]) return true;
    }
  }
  return false;
}

const TILE_COLORS: Record<number, string> = {
  0: 'bg-neutral-300/60 dark:bg-neutral-800/70 text-transparent',
  2: 'bg-[#eee4da] text-[#776e65]',
  4: 'bg-[#ede0c8] text-[#776e65]',
  8: 'bg-[#f2b179] text-white',
  16: 'bg-[#f59563] text-white',
  32: 'bg-[#f67c5f] text-white',
  64: 'bg-[#f65e3b] text-white',
  128: 'bg-[#edcf72] text-white',
  256: 'bg-[#edcc61] text-white',
  512: 'bg-[#edc850] text-white',
  1024: 'bg-[#edc53f] text-white',
  2048: 'bg-[#edc22e] text-white',
};

export const Game2048: React.FC = () => {
  const [board, setBoard] = useState<Board>(() => addRandomTile(addRandomTile(emptyBoard())));
  const [prevState, setPrevState] = useState<{ board: Board; score: number } | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('win10_2048_best') || 0));
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const move = useCallback(
    (dir: 'left' | 'right' | 'up' | 'down') => {
      const rotations = dir === 'left' ? 0 : dir === 'down' ? 1 : dir === 'right' ? 2 : 3;
      let work = board.map((r) => [...r]);
      for (let i = 0; i < rotations; i++) work = rotateCW(work);

      let totalGained = 0;
      const slid = work.map((row) => {
        const res = slideRowLeft(row);
        totalGained += res.gained;
        return res.next;
      });

      let restored = slid;
      for (let i = 0; i < (4 - rotations) % 4; i++) restored = rotateCW(restored);

      const changed = JSON.stringify(restored) !== JSON.stringify(board);
      if (!changed) return;

      setPrevState({ board, score });
      const withTile = addRandomTile(restored);
      setBoard(withTile);
      if (totalGained > 0) soundEngine.playClick();
      setScore((prev) => {
        const ns = prev + totalGained;
        if (ns > best) {
          setBest(ns);
          localStorage.setItem('win10_2048_best', String(ns));
        }
        return ns;
      });
    },
    [board, best, score]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move('left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move('right'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move('up'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move('down'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const reset = () => {
    setBoard(addRandomTile(addRandomTile(emptyBoard())));
    setScore(0);
    setPrevState(null);
  };

  const isOver = !canMove(board);

  return (
    <div className="flex flex-col items-center justify-between h-full bg-[#faf8ef] dark:bg-[#1a1a1a] text-neutral-900 dark:text-white p-4 select-none">
      <div className="w-full max-w-[340px] flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#776e65] dark:text-amber-400">2048</h2>
          <p className="text-[11px] text-neutral-500">Use arrow keys or swipe</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-[#bbada0] dark:bg-neutral-800 text-white text-center">
            <div className="text-[9px] uppercase">Score</div>
            <div className="text-sm font-bold tabular-nums">{score}</div>
          </div>
          <div className="px-3 py-1 bg-[#bbada0] dark:bg-neutral-800 text-white text-center">
            <div className="text-[9px] uppercase">Best</div>
            <div className="text-sm font-bold tabular-nums">{best}</div>
          </div>
        </div>
      </div>

      <div
        onTouchStart={(e) => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touchStart) return;
          const dx = e.changedTouches[0].clientX - touchStart.x;
          const dy = e.changedTouches[0].clientY - touchStart.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 25) {
            if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
            else move(dy > 0 ? 'down' : 'up');
          }
          setTouchStart(null);
        }}
        className="relative w-full max-w-[340px] aspect-square bg-[#bbada0] dark:bg-neutral-900 p-2.5 grid grid-cols-4 grid-rows-4 gap-2.5 touch-none"
      >
        {board.flat().map((val, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-center font-bold tabular-nums transition-all duration-100 ${
              val >= 1024 ? 'text-xl' : val >= 128 ? 'text-2xl' : 'text-3xl'
            } ${TILE_COLORS[val] || 'bg-neutral-900 text-white'}`}
          >
            {val > 0 ? val : ''}
          </div>
        ))}

        {isOver && (
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex flex-col items-center justify-center gap-3">
            <div className="text-xl font-bold">Game Over</div>
            <button
              onClick={reset}
              className="px-5 py-2 bg-[#8f7a66] text-white text-xs font-semibold cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          disabled={!prevState}
          onClick={() => {
            if (!prevState) return;
            setBoard(prevState.board);
            setScore(prevState.score);
            setPrevState(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-200 dark:bg-neutral-800 disabled:opacity-40 cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#8f7a66] text-white cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> New Game
        </button>
      </div>
    </div>
  );
};
