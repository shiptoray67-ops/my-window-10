import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { soundEngine } from '../../utils/sound';

type Color = 'w' | 'b';
type Kind = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
interface Piece {
  color: Color;
  kind: Kind;
}
type Board = (Piece | null)[][];
interface Move {
  from: [number, number];
  to: [number, number];
  notation: string;
}

const SYMBOLS: Record<Color, Record<Kind, string>> = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};

const VALUES: Record<Kind, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

function initialBoard(): Board {
  const back: Kind[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    b[0][c] = { color: 'b', kind: back[c] };
    b[1][c] = { color: 'b', kind: 'P' };
    b[6][c] = { color: 'w', kind: 'P' };
    b[7][c] = { color: 'w', kind: back[c] };
  }
  return b;
}

function cloneBoard(b: Board): Board {
  return b.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function pseudoMoves(b: Board, r: number, c: number): Array<[number, number]> {
  const p = b[r][c];
  if (!p) return [];
  const res: Array<[number, number]> = [];
  const inBounds = (rr: number, cc: number) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;

  const slide = (dirs: Array<[number, number]>) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = b[nr][nc];
        if (!target) {
          res.push([nr, nc]);
        } else {
          if (target.color !== p.color) res.push([nr, nc]);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  };

  if (p.kind === 'P') {
    const dir = p.color === 'w' ? -1 : 1;
    const startRow = p.color === 'w' ? 6 : 1;
    if (inBounds(r + dir, c) && !b[r + dir][c]) {
      res.push([r + dir, c]);
      if (r === startRow && !b[r + 2 * dir][c]) res.push([r + 2 * dir, c]);
    }
    for (const dc of [-1, 1]) {
      if (inBounds(r + dir, c + dc) && b[r + dir][c + dc]?.color === (p.color === 'w' ? 'b' : 'w')) {
        res.push([r + dir, c + dc]);
      }
    }
  } else if (p.kind === 'N') {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && b[nr][nc]?.color !== p.color) res.push([nr, nc]);
    }
  } else if (p.kind === 'B') {
    slide([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  } else if (p.kind === 'R') {
    slide([[-1, 0], [1, 0], [0, -1], [0, 1]]);
  } else if (p.kind === 'Q') {
    slide([[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
  } else if (p.kind === 'K') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && b[nr][nc]?.color !== p.color) res.push([nr, nc]);
      }
    }
  }
  return res;
}

function isInCheck(b: Board, color: Color): boolean {
  let kr = -1;
  let kc = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c]?.color === color && b[r][c]?.kind === 'K') {
        kr = r;
        kc = c;
      }
    }
  }
  if (kr === -1) return true;
  const opp: Color = color === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c]?.color === opp) {
        if (pseudoMoves(b, r, c).some(([mr, mc]) => mr === kr && mc === kc)) return true;
      }
    }
  }
  return false;
}

function applyMove(b: Board, from: [number, number], to: [number, number]): Board {
  const next = cloneBoard(b);
  const piece = next[from[0]][from[1]]!;
  next[from[0]][from[1]] = null;
  if (piece.kind === 'P' && (to[0] === 0 || to[0] === 7)) {
    next[to[0]][to[1]] = { color: piece.color, kind: 'Q' };
  } else {
    next[to[0]][to[1]] = piece;
  }
  return next;
}

function legalMovesForPiece(b: Board, r: number, c: number): Array<[number, number]> {
  const p = b[r][c];
  if (!p) return [];
  return pseudoMoves(b, r, c).filter((to) => !isInCheck(applyMove(b, [r, c], to), p.color));
}

function allLegalMoves(b: Board, color: Color): Array<{ from: [number, number]; to: [number, number] }> {
  const list: Array<{ from: [number, number]; to: [number, number] }> = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c]?.color === color) {
        legalMovesForPiece(b, r, c).forEach((to) => list.push({ from: [r, c], to }));
      }
    }
  }
  return list;
}

function evaluateBoard(b: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const centerBonus = (3.5 - Math.abs(3.5 - r)) * 4 + (3.5 - Math.abs(3.5 - c)) * 4;
      const val = VALUES[p.kind] + centerBonus;
      score += p.color === 'b' ? val : -val;
    }
  }
  return score;
}

function toAlg([r, c]: [number, number]): string {
  return `${'abcdefgh'[c]}${8 - r}`;
}

export const ChessGame: React.FC = () => {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<Color>('w');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [status, setStatus] = useState<string>('Your move (White)');
  const [botThinking, setBotThinking] = useState(false);

  const validTargets = selected ? legalMovesForPiece(board, selected[0], selected[1]) : [];

  const checkEndState = (b: Board, nextColor: Color): string | null => {
    const legal = allLegalMoves(b, nextColor);
    const inChk = isInCheck(b, nextColor);
    if (legal.length === 0) {
      if (inChk) {
        return nextColor === 'w' ? 'Checkmate — Black wins!' : 'Checkmate — You win!';
      }
      return 'Stalemate — Draw!';
    }
    return null;
  };

  const handleSquareClick = (r: number, c: number) => {
    if (turn !== 'w' || botThinking || status.includes('Checkmate') || status.includes('Stalemate')) return;

    if (selected && validTargets.some(([tr, tc]) => tr === r && tc === c)) {
      const nextBoard = applyMove(board, selected, [r, c]);
      const piece = board[selected[0]][selected[1]]!;
      const note = `${piece.kind === 'P' ? '' : piece.kind}${toAlg(selected)}→${toAlg([r, c])}`;
      setBoard(nextBoard);
      setMoves((m) => [...m, { from: selected, to: [r, c], notation: note }]);
      setSelected(null);
      soundEngine.playClick();

      const endMsg = checkEndState(nextBoard, 'b');
      if (endMsg) {
        setStatus(endMsg);
        soundEngine.playSuccess();
        return;
      }

      setTurn('b');
      setBotThinking(true);
      setStatus(isInCheck(nextBoard, 'b') ? 'Black is in check...' : 'Black is thinking...');

      setTimeout(() => {
        const botMoves = allLegalMoves(nextBoard, 'b');
        if (botMoves.length === 0) {
          setBotThinking(false);
          return;
        }
        let bestMove = botMoves[0];
        let bestScore = -Infinity;
        for (const m of botMoves) {
          const b1 = applyMove(nextBoard, m.from, m.to);
          // 1-ply + opponent best capture lookahead
          const replies = allLegalMoves(b1, 'w');
          let minReply = evaluateBoard(b1);
          if (replies.length > 0) {
            minReply = Infinity;
            for (let i = 0; i < Math.min(replies.length, 24); i++) {
              const b2 = applyMove(b1, replies[i].from, replies[i].to);
              const sc = evaluateBoard(b2);
              if (sc < minReply) minReply = sc;
            }
          }
          const jitter = Math.random() * 6;
          if (minReply + jitter > bestScore) {
            bestScore = minReply + jitter;
            bestMove = m;
          }
        }
        const afterBot = applyMove(nextBoard, bestMove.from, bestMove.to);
        const bp = nextBoard[bestMove.from[0]][bestMove.from[1]]!;
        const bNote = `${bp.kind === 'P' ? '' : bp.kind}${toAlg(bestMove.from)}→${toAlg(bestMove.to)}`;
        setBoard(afterBot);
        setMoves((prev) => [...prev, { from: bestMove.from, to: bestMove.to, notation: bNote }]);
        setBotThinking(false);
        soundEngine.playClick();

        const wEnd = checkEndState(afterBot, 'w');
        if (wEnd) {
          setStatus(wEnd);
        } else {
          setTurn('w');
          setStatus(isInCheck(afterBot, 'w') ? 'Check! Your move (White)' : 'Your move (White)');
        }
      }, 450);
      return;
    }

    if (board[r][c]?.color === 'w') {
      setSelected([r, c]);
    } else {
      setSelected(null);
    }
  };

  const reset = () => {
    setBoard(initialBoard());
    setTurn('w');
    setSelected(null);
    setMoves([]);
    setStatus('Your move (White)');
    setBotThinking(false);
  };

  return (
    <div className="flex flex-col sm:flex-row h-full bg-[#1e1b2e] text-white p-4 gap-4 select-none">
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-full max-w-[360px] flex items-center justify-between text-xs">
          <span className="font-semibold text-amber-300">{status}</span>
          <button
            onClick={reset}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> New Match
          </button>
        </div>

        <div className="w-full max-w-[360px] aspect-square grid grid-cols-8 grid-rows-8 border-2 border-amber-900/80 shadow-2xl">
          {board.map((row, r) =>
            row.map((piece, c) => {
              const dark = (r + c) % 2 === 1;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isValid = validTargets.some(([tr, tc]) => tr === r && tc === c);
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleSquareClick(r, c)}
                  className={`relative flex items-center justify-center text-2xl sm:text-3xl leading-none cursor-pointer ${
                    isSel
                      ? 'bg-amber-400/70'
                      : dark
                      ? 'bg-[#7c4d2b]'
                      : 'bg-[#e8cfa9]'
                  }`}
                >
                  {isValid && (
                    <span
                      className={`absolute rounded-full pointer-events-none ${
                        piece
                          ? 'inset-1 border-2 border-emerald-500'
                          : 'w-3 h-3 bg-emerald-600/70'
                      }`}
                    />
                  )}
                  {piece && (
                    <span
                      className={
                        piece.color === 'w'
                          ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]'
                          : 'text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]'
                      }
                    >
                      {SYMBOLS[piece.color][piece.kind]}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Move History */}
      <div className="sm:w-44 shrink-0 bg-black/25 border border-white/10 p-3 flex flex-col">
        <div className="text-xs font-semibold mb-2">Move Log</div>
        <div className="flex-1 overflow-y-auto space-y-1 text-xs font-mono max-h-28 sm:max-h-none">
          {moves.length === 0 ? (
            <div className="text-white/40">No moves yet</div>
          ) : (
            moves.map((m, i) => (
              <div key={i} className="flex justify-between text-white/80">
                <span className="text-white/40">{i + 1}.</span>
                <span>{m.notation}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
