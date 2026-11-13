import React, { useEffect, useState } from 'react';
import { Bomb, Flag, RotateCcw } from 'lucide-react';
import { soundEngine } from '../../utils/sound';

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;
}

const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10, label: 'Beginner (9×9)' },
  intermediate: { rows: 12, cols: 12, mines: 24, label: 'Intermediate (12×12)' },
  expert: { rows: 14, cols: 16, mines: 40, label: 'Expert (14×16)' },
};

function createBoard(rows: number, cols: number, mines: number, safeR?: number, safeC?: number): Cell[][] {
  const b: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adj: 0 }))
  );
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (b[r][c].mine) continue;
    if (safeR !== undefined && safeC !== undefined && Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) {
      continue;
    }
    b[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (b[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && b[nr][nc].mine) count++;
        }
      }
      b[r][c].adj = count;
    }
  }
  return b;
}

export const MinesweeperGame: React.FC = () => {
  const [diff, setDiff] = useState<keyof typeof DIFFICULTIES>('beginner');
  const cfg = DIFFICULTIES[diff];
  const [board, setBoard] = useState<Cell[][]>(() => createBoard(cfg.rows, cfg.cols, cfg.mines));
  const [firstClick, setFirstClick] = useState(true);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [seconds, setSeconds] = useState(0);
  const [flagMode, setFlagMode] = useState(false);

  useEffect(() => {
    if (status !== 'playing' || firstClick) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status, firstClick]);

  const reset = (d: keyof typeof DIFFICULTIES = diff) => {
    const c = DIFFICULTIES[d];
    setDiff(d);
    setBoard(createBoard(c.rows, c.cols, c.mines));
    setFirstClick(true);
    setStatus('playing');
    setSeconds(0);
  };

  const revealCell = (r: number, c: number) => {
    if (status !== 'playing') return;
    if (flagMode) {
      toggleFlag(r, c);
      return;
    }

    let work = board.map((row) => row.map((cell) => ({ ...cell })));
    if (work[r][c].flagged || work[r][c].revealed) return;

    if (firstClick) {
      work = createBoard(cfg.rows, cfg.cols, cfg.mines, r, c);
      setFirstClick(false);
    }

    if (work[r][c].mine) {
      work.forEach((row) => row.forEach((cell) => { if (cell.mine) cell.revealed = true; }));
      setBoard(work);
      setStatus('lost');
      soundEngine.playError();
      return;
    }

    const stack: Array<[number, number]> = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      const cell = work[cr][cc];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.adj === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols && !work[nr][nc].revealed) {
              stack.push([nr, nc]);
            }
          }
        }
      }
    }

    const unrevealedSafe = work.flat().filter((cell) => !cell.mine && !cell.revealed).length;
    if (unrevealedSafe === 0) {
      setStatus('won');
      soundEngine.playSuccess();
    } else {
      soundEngine.playClick();
    }
    setBoard(work);
  };

  const toggleFlag = (r: number, c: number) => {
    if (status !== 'playing') return;
    setBoard((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) =>
          ri === r && ci === c && !cell.revealed ? { ...cell, flagged: !cell.flagged } : cell
        )
      )
    );
  };

  const flagsUsed = board.flat().filter((c) => c.flagged).length;
  const numColor = (n: number) =>
    ['', 'text-blue-600', 'text-emerald-600', 'text-red-600', 'text-indigo-700', 'text-amber-700', 'text-cyan-700', 'text-black', 'text-neutral-600'][n] || '';

  return (
    <div className="flex flex-col items-center justify-between h-full bg-neutral-100 dark:bg-[#1b1b1b] text-neutral-900 dark:text-white p-3 select-none">
      <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs">
        <select
          value={diff}
          onChange={(e) => reset(e.target.value as keyof typeof DIFFICULTIES)}
          className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
        >
          {Object.entries(DIFFICULTIES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-3 tabular-nums font-semibold">
          <span>Mines: {cfg.mines - flagsUsed}</span>
          <span>Time: {seconds}s</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFlagMode((f) => !f)}
            className={`flex items-center gap-1 px-2.5 py-1 border text-xs cursor-pointer ${
              flagMode
                ? 'bg-rose-600 text-white border-rose-600'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
            title="Toggle Flag Mode (or right-click)"
          >
            <Flag className="w-3.5 h-3.5" /> Flag
          </button>
          <button
            onClick={() => reset()}
            className="p-1.5 bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-auto w-full my-2">
        <div
          style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}
          className="grid gap-0.5 bg-neutral-400 dark:bg-neutral-700 p-1 border border-neutral-400 dark:border-neutral-600"
        >
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => revealCell(r, c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleFlag(r, c);
                }}
                className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs font-bold tabular-nums cursor-pointer ${
                  cell.revealed
                    ? cell.mine
                      ? 'bg-rose-500 text-white'
                      : 'bg-neutral-200 dark:bg-neutral-800'
                    : 'bg-neutral-300 dark:bg-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-500 shadow-inner'
                }`}
              >
                {cell.revealed ? (
                  cell.mine ? (
                    <Bomb className="w-3.5 h-3.5" />
                  ) : cell.adj > 0 ? (
                    <span className={numColor(cell.adj)}>{cell.adj}</span>
                  ) : null
                ) : cell.flagged ? (
                  <Flag className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      {status !== 'playing' && (
        <div className="w-full text-center py-1.5 text-xs font-semibold bg-black/10 dark:bg-white/10">
          {status === 'won' ? `You cleared the minefield in ${seconds}s!` : 'Boom! Click Restart to try again.'}
        </div>
      )}
    </div>
  );
};
