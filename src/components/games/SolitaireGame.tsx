import React, { useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { soundEngine } from '../../utils/sound';

type Suit = '♠' | '♥' | '♦' | '♣';
interface Card {
  id: string;
  suit: Suit;
  rank: number; // 1..13
  faceUp: boolean;
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const isRed = (s: Suit) => s === '♥' || s === '♦';
const rankLabel = (r: number) =>
  r === 1 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r);

function dealSolitaire() {
  const deck: Card[] = [];
  SUITS.forEach((suit) => {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false });
    }
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[idx++], faceUp: row === col };
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));
  return {
    stock,
    waste: [] as Card[],
    foundations: [[], [], [], []] as Card[][],
    tableau,
  };
}

export const SolitaireGame: React.FC = () => {
  const [game, setGame] = useState(dealSolitaire);
  const [selected, setSelected] = useState<{
    zone: 'waste' | 'tableau';
    col?: number;
    index?: number;
  } | null>(null);
  const [moves, setMoves] = useState(0);

  const drawStock = () => {
    setSelected(null);
    setGame((g) => {
      if (g.stock.length === 0) {
        return {
          ...g,
          stock: [...g.waste].reverse().map((c) => ({ ...c, faceUp: false })),
          waste: [],
        };
      }
      const nextStock = [...g.stock];
      const drawn = { ...nextStock.pop()!, faceUp: true };
      return { ...g, stock: nextStock, waste: [...g.waste, drawn] };
    });
    setMoves((m) => m + 1);
  };

  const canPlaceOnFoundation = (card: Card, pile: Card[]) => {
    if (pile.length === 0) return card.rank === 1;
    const top = pile[pile.length - 1];
    return top.suit === card.suit && card.rank === top.rank + 1;
  };

  const canPlaceOnTableau = (card: Card, col: Card[]) => {
    if (col.length === 0) return card.rank === 13;
    const top = col[col.length - 1];
    return top.faceUp && isRed(top.suit) !== isRed(card.suit) && card.rank === top.rank - 1;
  };

  const tryMoveToFoundation = (card: Card, removeFn: (g: ReturnType<typeof dealSolitaire>) => void) => {
    for (let f = 0; f < 4; f++) {
      if (canPlaceOnFoundation(card, game.foundations[f])) {
        setGame((g) => {
          const clone = structuredClone(g);
          removeFn(clone);
          clone.foundations[f].push(card);
          return clone;
        });
        setMoves((m) => m + 1);
        setSelected(null);
        soundEngine.playClick();
        return true;
      }
    }
    return false;
  };

  const handleFoundationClick = (fIdx: number) => {
    if (!selected) return;
    let card: Card | undefined;
    if (selected.zone === 'waste') card = game.waste[game.waste.length - 1];
    else if (selected.zone === 'tableau' && selected.col !== undefined && selected.index !== undefined) {
      const col = game.tableau[selected.col];
      if (selected.index === col.length - 1) card = col[col.length - 1];
    }
    if (!card || !canPlaceOnFoundation(card, game.foundations[fIdx])) {
      setSelected(null);
      return;
    }

    setGame((g) => {
      const clone = structuredClone(g);
      if (selected.zone === 'waste') clone.waste.pop();
      else if (selected.col !== undefined) {
        clone.tableau[selected.col].pop();
        const rem = clone.tableau[selected.col];
        if (rem.length > 0) rem[rem.length - 1].faceUp = true;
      }
      clone.foundations[fIdx].push(card!);
      return clone;
    });
    setMoves((m) => m + 1);
    setSelected(null);
    soundEngine.playClick();
  };

  const handleTableauClick = (colIdx: number, cardIdx?: number) => {
    const targetCol = game.tableau[colIdx];
    const clickedCard = cardIdx !== undefined ? targetCol[cardIdx] : undefined;

    if (!selected) {
      if (clickedCard && clickedCard.faceUp) {
        setSelected({ zone: 'tableau', col: colIdx, index: cardIdx });
      }
      return;
    }

    // Double-tap/re-click top card sends to foundation if valid
    if (
      selected.zone === 'tableau' &&
      selected.col === colIdx &&
      selected.index === targetCol.length - 1 &&
      clickedCard
    ) {
      tryMoveToFoundation(clickedCard, (cl) => {
        cl.tableau[colIdx].pop();
        const rem = cl.tableau[colIdx];
        if (rem.length > 0) rem[rem.length - 1].faceUp = true;
      });
      setSelected(null);
      return;
    }

    let movingCards: Card[] = [];
    if (selected.zone === 'waste') {
      const top = game.waste[game.waste.length - 1];
      if (top) movingCards = [top];
    } else if (selected.zone === 'tableau' && selected.col !== undefined && selected.index !== undefined) {
      movingCards = game.tableau[selected.col].slice(selected.index);
    }

    if (movingCards.length > 0 && canPlaceOnTableau(movingCards[0], targetCol)) {
      setGame((g) => {
        const clone = structuredClone(g);
        if (selected.zone === 'waste') {
          clone.waste.pop();
        } else if (selected.col !== undefined && selected.index !== undefined) {
          clone.tableau[selected.col].splice(selected.index);
          const rem = clone.tableau[selected.col];
          if (rem.length > 0) rem[rem.length - 1].faceUp = true;
        }
        clone.tableau[colIdx].push(...movingCards);
        return clone;
      });
      setMoves((m) => m + 1);
      soundEngine.playClick();
    }
    setSelected(null);
  };

  const totalFoundation = game.foundations.reduce((acc, f) => acc + f.length, 0);
  const won = totalFoundation === 52;

  return (
    <div className="flex flex-col h-full bg-[#0f5132] text-white p-3 sm:p-4 select-none overflow-y-auto">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="font-semibold">Klondike Solitaire · Moves: {moves}</span>
        <button
          onClick={() => {
            setGame(dealSolitaire());
            setMoves(0);
            setSelected(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1 bg-black/25 hover:bg-black/40 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> New Deal
        </button>
      </div>

      {/* Top Row: Stock, Waste, Foundations */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-4">
        <button
          onClick={drawStock}
          className="aspect-[2.5/3.5] border border-white/30 bg-[#146c43] hover:bg-[#198754] flex items-center justify-center text-xs font-semibold cursor-pointer rounded-sm"
        >
          {game.stock.length > 0 ? `${game.stock.length}` : '↻'}
        </button>

        <div className="aspect-[2.5/3.5]">
          {game.waste.length > 0 ? (
            (() => {
              const top = game.waste[game.waste.length - 1];
              const isSel = selected?.zone === 'waste';
              return (
                <button
                  onClick={() => {
                    if (isSel) {
                      tryMoveToFoundation(top, (cl) => cl.waste.pop());
                    } else {
                      setSelected({ zone: 'waste' });
                    }
                  }}
                  className={`w-full h-full bg-white rounded-sm p-1 flex flex-col justify-between text-left border-2 cursor-pointer ${
                    isSel ? 'border-amber-400' : 'border-neutral-300'
                  } ${isRed(top.suit) ? 'text-rose-600' : 'text-neutral-900'}`}
                >
                  <span className="text-xs font-bold leading-none">
                    {rankLabel(top.rank)}{top.suit}
                  </span>
                  <span className="text-lg self-center">{top.suit}</span>
                </button>
              );
            })()
          ) : (
            <div className="w-full h-full border border-white/15 rounded-sm" />
          )}
        </div>

        <div />

        {game.foundations.map((pile, fIdx) => {
          const top = pile[pile.length - 1];
          return (
            <button
              key={fIdx}
              onClick={() => handleFoundationClick(fIdx)}
              className="aspect-[2.5/3.5] border border-white/30 bg-black/15 rounded-sm flex items-center justify-center cursor-pointer"
            >
              {top ? (
                <div
                  className={`w-full h-full bg-white rounded-sm p-1 flex flex-col justify-between text-left ${
                    isRed(top.suit) ? 'text-rose-600' : 'text-neutral-900'
                  }`}
                >
                  <span className="text-xs font-bold leading-none">
                    {rankLabel(top.rank)}{top.suit}
                  </span>
                  <span className="text-lg self-center">{top.suit}</span>
                </div>
              ) : (
                <span className="text-white/35 text-sm">A</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 flex-1">
        {game.tableau.map((col, colIdx) => (
          <div
            key={colIdx}
            onClick={() => col.length === 0 && handleTableauClick(colIdx)}
            className="relative min-h-[180px]"
          >
            {col.length === 0 && (
              <div className="aspect-[2.5/3.5] border border-white/15 rounded-sm" />
            )}
            {col.map((card, cardIdx) => {
              const isSel =
                selected?.zone === 'tableau' &&
                selected.col === colIdx &&
                selected.index !== undefined &&
                cardIdx >= selected.index;
              return (
                <button
                  key={card.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTableauClick(colIdx, cardIdx);
                  }}
                  style={{ top: cardIdx * 20 }}
                  className={`absolute inset-x-0 aspect-[2.5/3.5] rounded-sm p-1 text-left border transition-all cursor-pointer ${
                    card.faceUp
                      ? `bg-white ${isSel ? 'border-2 border-amber-400 ring-2 ring-amber-400/40' : 'border-neutral-300'} ${
                          isRed(card.suit) ? 'text-rose-600' : 'text-neutral-900'
                        }`
                      : 'bg-[#1e3a8a] border-white/30'
                  }`}
                >
                  {card.faceUp && (
                    <div className="flex items-center justify-between text-[11px] font-bold leading-none">
                      <span>{rankLabel(card.rank)}</span>
                      <span>{card.suit}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {won && (
        <div className="mt-4 p-4 bg-black/50 text-center flex items-center justify-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span className="font-semibold">Congratulations! You won in {moves} moves!</span>
        </div>
      )}
    </div>
  );
};
