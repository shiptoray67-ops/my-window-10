import React, { useState } from 'react';
import { Lightbulb, Pencil, RotateCcw } from 'lucide-react';
import { soundEngine } from '../../utils/sound';

const BASE_SOLUTIONS = [
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  '827154396965327148341689752593468271472513689618972435786235914154796823239841567',
];

function generatePuzzle(removals: number) {
  const base = BASE_SOLUTIONS[Math.floor(Math.random() * BASE_SOLUTIONS.length)];
  const map = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
  const solution = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => map[Number(base[r * 9 + c]) - 1])
  );
  const puzzle = solution.map((row) => [...row]);
  const fixed = Array.from({ length: 9 }, () => Array(9).fill(true));
  let removed = 0;
  while (removed < removals) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0;
      fixed[r][c] = false;
      removed++;
    }
  }
  return { puzzle, solution, fixed };
}

export const SudokuGame: React.FC = () => {
  const [difficulty, setDifficulty] = useState<32 | 44 | 54>(32);
  const [state, setState] = useState(() => generatePuzzle(32));
  const [grid, setGrid] = useState<number[][]>(() => state.puzzle.map((r) => [...r]));
  const [notes, setNotes] = useState<string[][]>(() => Array.from({ length: 9 }, () => Array(9).fill('')));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [noteMode, setNoteMode] = useState(false);

  const newGame = (rem: 32 | 44 | 54 = difficulty) => {
    setDifficulty(rem);
    const next = generatePuzzle(rem);
    setState(next);
    setGrid(next.puzzle.map((r) => [...r]));
    setNotes(Array.from({ length: 9 }, () => Array(9).fill('')));
    setSelected(null);
  };

  const enterNum = (n: number) => {
    if (!selected) return;
    const [r, c] = selected;
    if (state.fixed[r][c]) return;

    if (noteMode && n > 0) {
      setNotes((prev) =>
        prev.map((row, ri) =>
          row.map((val, ci) => {
            if (ri !== r || ci !== c) return val;
            const s = String(n);
            return val.includes(s) ? val.replace(s, '') : (val + s).split('').sort().join('');
          })
        )
      );
      return;
    }

    setGrid((prev) => prev.map((row, ri) => row.map((v, ci) => (ri === r && ci === c ? n : v))));
    soundEngine.playClick();
  };

  const giveHint = () => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          setGrid((prev) =>
            prev.map((row, ri) =>
              row.map((v, ci) => (ri === r && ci === c ? state.solution[r][c] : v))
            )
          );
          setSelected([r, c]);
          return;
        }
      }
    }
  };

  const isComplete = grid.every((row, r) => row.every((val, c) => val === state.solution[r][c]));

  return (
    <div className="flex flex-col items-center justify-between h-full bg-neutral-100 dark:bg-[#1a1a1a] text-neutral-900 dark:text-white p-3 select-none">
      <div className="w-full max-w-[380px] flex items-center justify-between text-xs">
        <select
          value={difficulty}
          onChange={(e) => newGame(Number(e.target.value) as 32 | 44 | 54)}
          className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
        >
          <option value={32}>Easy</option>
          <option value={44}>Medium</option>
          <option value={54}>Hard</option>
        </select>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setNoteMode((m) => !m)}
            className={`flex items-center gap-1 px-2.5 py-1 border cursor-pointer ${
              noteMode ? 'bg-[#0078D7] text-white border-[#0078D7]' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" /> Notes
          </button>
          <button
            onClick={giveHint}
            className="flex items-center gap-1 px-2.5 py-1 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Hint
          </button>
          <button
            onClick={() => newGame()}
            className="p-1.5 bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 9x9 Grid */}
      <div className="relative w-full max-w-[380px] aspect-square grid grid-cols-9 grid-rows-9 border-2 border-neutral-800 dark:border-neutral-400 bg-white dark:bg-neutral-900">
        {grid.map((row, r) =>
          row.map((val, c) => {
            const isSel = selected?.[0] === r && selected?.[1] === c;
            const isFixed = state.fixed[r][c];
            const isWrong = val !== 0 && val !== state.solution[r][c];
            const borderR = c === 2 || c === 5 ? 'border-r-2 border-r-neutral-800 dark:border-r-neutral-400' : 'border-r border-r-neutral-300 dark:border-r-neutral-700';
            const borderB = r === 2 || r === 5 ? 'border-b-2 border-b-neutral-800 dark:border-b-neutral-400' : 'border-b border-b-neutral-300 dark:border-b-neutral-700';
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => setSelected([r, c])}
                className={`flex items-center justify-center tabular-nums cursor-pointer ${borderR} ${borderB} ${
                  isSel
                    ? 'bg-[#0078D7]/25'
                    : isFixed
                    ? 'bg-neutral-100 dark:bg-neutral-800/70 font-bold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                } ${isWrong ? 'text-rose-500' : isFixed ? '' : 'text-[#0078D7]'}`}
              >
                {val > 0 ? (
                  <span className="text-base sm:text-lg">{val}</span>
                ) : notes[r][c] ? (
                  <span className="text-[8px] leading-tight text-neutral-500 break-all px-0.5">
                    {notes[r][c]}
                  </span>
                ) : null}
              </button>
            );
          })
        )}

        {isComplete && (
          <div className="absolute inset-0 bg-black/75 text-white flex flex-col items-center justify-center gap-3">
            <div className="text-xl font-bold">Puzzle Solved!</div>
            <button onClick={() => newGame()} className="px-4 py-2 bg-[#0078D7] text-xs font-semibold cursor-pointer">
              Play Another
            </button>
          </div>
        )}
      </div>

      {/* Number Pad */}
      <div className="w-full max-w-[380px] grid grid-cols-10 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => enterNum(n)}
            className="h-9 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-[#0078D7] hover:text-white text-sm font-semibold tabular-nums cursor-pointer"
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => enterNum(0)}
          className="h-9 bg-neutral-200 dark:bg-neutral-700 text-xs font-semibold cursor-pointer"
          title="Erase"
        >
          Del
        </button>
      </div>
    </div>
  );
};
