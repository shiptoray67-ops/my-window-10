import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, RotateCw, RotateCcw } from 'lucide-react';
import { soundEngine } from '../../utils/sound';

const ROWS = 20;
const COLS = 10;

const SHAPES = [
  { shape: [[1, 1, 1, 1]], color: '#06b6d4' }, // I
  { shape: [[1, 1], [1, 1]], color: '#eab308' }, // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#a855f7' }, // T
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#22c55e' }, // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#ef4444' }, // Z
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#3b82f6' }, // J
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#f97316' }, // L
];

type Piece = { shape: number[][]; color: string; x: number; y: number };

function randomPiece(): Piece {
  const p = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return { shape: p.shape.map((r) => [...r]), color: p.color, x: 3, y: 0 };
}

function emptyGrid(): (string | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export const TetrisGame: React.FC = () => {
  const [grid, setGrid] = useState<(string | null)[][]>(emptyGrid);
  const [piece, setPiece] = useState<Piece>(randomPiece);
  const [nextPiece, setNextPiece] = useState<Piece>(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const collides = useCallback((g: (string | null)[][], p: Piece, dx = 0, dy = 0, shape = p.shape) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = p.x + c + dx;
        const ny = p.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && g[ny][nx]) return true;
      }
    }
    return false;
  }, []);

  const lockAndAdvance = useCallback(
    (g: (string | null)[][], p: Piece) => {
      const merged = g.map((r) => [...r]);
      for (let r = 0; r < p.shape.length; r++) {
        for (let c = 0; c < p.shape[r].length; c++) {
          if (p.shape[r][c] && p.y + r >= 0) {
            merged[p.y + r][p.x + c] = p.color;
          }
        }
      }
      const kept = merged.filter((row) => row.some((cell) => cell === null));
      const cleared = ROWS - kept.length;
      if (cleared > 0) {
        soundEngine.playSuccess();
        setLines((l) => l + cleared);
        setScore((s) => s + [0, 100, 300, 500, 800][cleared]);
      }
      while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));

      const spawn = nextPiece;
      setNextPiece(randomPiece());
      if (collides(kept, spawn)) {
        setGrid(kept);
        setGameOver(true);
        soundEngine.playError();
      } else {
        setGrid(kept);
        setPiece(spawn);
      }
    },
    [collides, nextPiece]
  );

  const stepDown = useCallback(() => {
    if (gameOver) return;
    if (!collides(grid, piece, 0, 1)) {
      setPiece((p) => ({ ...p, y: p.y + 1 }));
    } else {
      lockAndAdvance(grid, piece);
    }
  }, [collides, gameOver, grid, lockAndAdvance, piece]);

  const moveX = useCallback(
    (dx: number) => {
      if (!gameOver && !collides(grid, piece, dx, 0)) {
        setPiece((p) => ({ ...p, x: p.x + dx }));
      }
    },
    [collides, gameOver, grid, piece]
  );

  const rotate = useCallback(() => {
    if (gameOver) return;
    const rotated = piece.shape[0].map((_, c) => piece.shape.map((r) => r[c]).reverse());
    if (!collides(grid, piece, 0, 0, rotated)) {
      setPiece((p) => ({ ...p, shape: rotated }));
    }
  }, [collides, gameOver, grid, piece]);

  const hardDrop = useCallback(() => {
    if (gameOver) return;
    let dy = 0;
    while (!collides(grid, piece, 0, dy + 1)) dy++;
    lockAndAdvance(grid, { ...piece, y: piece.y + dy });
  }, [collides, gameOver, grid, lockAndAdvance, piece]);

  useEffect(() => {
    const levelMs = Math.max(160, 620 - Math.floor(lines / 5) * 60);
    const t = setInterval(stepDown, levelMs);
    return () => clearInterval(t);
  }, [stepDown, lines]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveX(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveX(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); stepDown(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); rotate(); }
      else if (e.key === ' ') { e.preventDefault(); hardDrop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hardDrop, moveX, rotate, stepDown]);

  const reset = () => {
    setGrid(emptyGrid());
    setPiece(randomPiece());
    setNextPiece(randomPiece());
    setScore(0);
    setLines(0);
    setGameOver(false);
  };

  // Render composite board with active piece
  const displayGrid = grid.map((r) => [...r]);
  if (!gameOver) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] && piece.y + r >= 0 && piece.y + r < ROWS) {
          displayGrid[piece.y + r][piece.x + c] = piece.color;
        }
      }
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 h-full bg-[#0f172a] text-white p-4 select-none">
      <div className="relative bg-slate-950 border-2 border-slate-700 grid grid-cols-10 gap-px p-1">
        {displayGrid.flat().map((color, idx) => (
          <div
            key={idx}
            style={{ backgroundColor: color || '#1e293b' }}
            className="w-5 h-5 sm:w-6 sm:h-6"
          />
        ))}
        {gameOver && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
            <div className="text-lg font-bold">Game Over</div>
            <button
              onClick={reset}
              className="px-4 py-1.5 bg-[#0078D7] text-xs font-semibold cursor-pointer"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="flex sm:flex-col items-center sm:items-stretch gap-3 w-full sm:w-36 text-xs">
        <div className="p-3 bg-slate-900 border border-slate-800 space-y-1 flex-1">
          <div className="text-slate-400">Score</div>
          <div className="text-xl font-bold tabular-nums">{score}</div>
          <div className="text-slate-400 pt-1">Lines: <strong className="text-white">{lines}</strong></div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 hidden sm:block">
          <div className="text-slate-400 mb-2">Next</div>
          <div className="grid gap-px justify-center" style={{ gridTemplateColumns: `repeat(${nextPiece.shape[0].length}, 14px)` }}>
            {nextPiece.shape.flat().map((cell, i) => (
              <div
                key={i}
                style={{ backgroundColor: cell ? nextPiece.color : 'transparent' }}
                className="w-3.5 h-3.5"
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-2 gap-1.5">
          <button onClick={() => moveX(-1)} className="p-2 bg-slate-800 hover:bg-slate-700 flex justify-center cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
          <button onClick={() => moveX(1)} className="p-2 bg-slate-800 hover:bg-slate-700 flex justify-center cursor-pointer"><ArrowRight className="w-4 h-4" /></button>
          <button onClick={rotate} className="p-2 bg-slate-800 hover:bg-slate-700 flex justify-center cursor-pointer"><RotateCw className="w-4 h-4" /></button>
          <button onClick={stepDown} className="p-2 bg-slate-800 hover:bg-slate-700 flex justify-center cursor-pointer"><ArrowDown className="w-4 h-4" /></button>
        </div>

        <button
          onClick={reset}
          className="flex items-center justify-center gap-1.5 py-2 bg-[#0078D7] hover:bg-[#106EBE] cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>
    </div>
  );
};
