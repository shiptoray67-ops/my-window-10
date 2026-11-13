import React, { useState } from 'react';
import { Delete, History, Menu, Trash2 } from 'lucide-react';

interface CalcHistoryEntry {
  expr: string;
  result: string;
}

export const CalculatorApp: React.FC = () => {
  const [mode, setMode] = useState<'standard' | 'scientific'>('standard');
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [memory, setMemory] = useState(0);
  const [hasMemory, setHasMemory] = useState(false);
  const [resetNext, setResetNext] = useState(false);
  const [history, setHistory] = useState<CalcHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const safeEvaluate = (raw: string): number | null => {
    try {
      const sanitized = raw
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, `(${Math.PI})`)
        .replace(/\be\b/g, `(${Math.E})`)
        .replace(/\^/g, '**');
      if (!/^[0-9+\-*/().\s*]+$/.test(sanitized)) return null;
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${sanitized})`)();
      if (typeof val !== 'number' || !Number.isFinite(val)) return null;
      return Math.round(val * 1e10) / 1e10;
    } catch {
      return null;
    }
  };

  const inputDigit = (d: string) => {
    if (display === 'Error' || resetNext) {
      setDisplay(d === '.' ? '0.' : d);
      setResetNext(false);
      return;
    }
    if (d === '.' && display.includes('.')) return;
    setDisplay(display === '0' && d !== '.' ? d : display + d);
  };

  const applyOperator = (op: string) => {
    if (display === 'Error') return;
    setExpression((prev) => (resetNext && prev.endsWith('=') ? `${display} ${op} ` : `${prev}${display} ${op} `));
    setResetNext(true);
  };

  const evaluateEquals = () => {
    const full = `${expression}${display}`;
    const res = safeEvaluate(full);
    if (res === null) {
      setDisplay('Error');
      setExpression('');
      setResetNext(true);
      return;
    }
    const resStr = String(res);
    setHistory((prev) => [{ expr: full, result: resStr }, ...prev.slice(0, 29)]);
    setExpression(`${full} =`);
    setDisplay(resStr);
    setResetNext(true);
  };

  const applyUnary = (fn: string) => {
    const x = parseFloat(display);
    if (Number.isNaN(x)) return;
    let out = x;
    if (fn === 'neg') out = -x;
    else if (fn === 'pct') out = x / 100;
    else if (fn === 'inv') out = x === 0 ? NaN : 1 / x;
    else if (fn === 'sq') out = x * x;
    else if (fn === 'sqrt') out = Math.sqrt(x);
    else if (fn === 'sin') out = Math.sin((x * Math.PI) / 180);
    else if (fn === 'cos') out = Math.cos((x * Math.PI) / 180);
    else if (fn === 'tan') out = Math.tan((x * Math.PI) / 180);
    else if (fn === 'log') out = Math.log10(x);
    else if (fn === 'ln') out = Math.log(x);
    else if (fn === 'abs') out = Math.abs(x);
    else if (fn === 'fact') {
      if (x < 0 || x > 170 || !Number.isInteger(x)) out = NaN;
      else {
        let f = 1;
        for (let i = 2; i <= x; i++) f *= i;
        out = f;
      }
    }

    if (!Number.isFinite(out)) {
      setDisplay('Error');
    } else {
      const rounded = Math.round(out * 1e10) / 1e10;
      setDisplay(String(rounded));
    }
    setResetNext(true);
  };

  const backspace = () => {
    if (resetNext || display === 'Error') {
      setDisplay('0');
      setResetNext(false);
      return;
    }
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  };

  return (
    <div className="flex flex-col h-full bg-neutral-100 dark:bg-[#202020] text-neutral-900 dark:text-white select-none relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode((m) => (m === 'standard' ? 'scientific' : 'standard'))}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            title="Switch Standard / Scientific"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold capitalize">{mode}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode((m) => (m === 'standard' ? 'scientific' : 'standard'))}
            className="px-2 py-1 text-[11px] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 cursor-pointer"
          >
            {mode === 'standard' ? 'Scientific' : 'Standard'}
          </button>
          <button
            onClick={() => setShowHistory((h) => !h)}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            title="History"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Display */}
      <div className="px-4 py-3 text-right shrink-0">
        <div className="h-5 text-xs text-neutral-500 dark:text-neutral-400 truncate tabular-nums">
          {expression}
        </div>
        <div className="text-4xl font-semibold tracking-tight truncate tabular-nums">
          {display}
        </div>
      </div>

      {/* Memory Row */}
      <div className="grid grid-cols-5 gap-1 px-2 pb-1 text-[11px] font-medium">
        {[
          { label: 'MC', disabled: !hasMemory, action: () => { setMemory(0); setHasMemory(false); } },
          { label: 'MR', disabled: !hasMemory, action: () => { setDisplay(String(memory)); setResetNext(true); } },
          { label: 'M+', action: () => { setMemory((m) => m + (parseFloat(display) || 0)); setHasMemory(true); setResetNext(true); } },
          { label: 'M-', action: () => { setMemory((m) => m - (parseFloat(display) || 0)); setHasMemory(true); setResetNext(true); } },
          { label: 'MS', action: () => { setMemory(parseFloat(display) || 0); setHasMemory(true); setResetNext(true); } },
        ].map((btn) => (
          <button
            key={btn.label}
            disabled={btn.disabled}
            onClick={btn.action}
            className="py-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Scientific Extra Row */}
      {mode === 'scientific' && (
        <div className="grid grid-cols-5 gap-1 px-2 pb-1 text-xs">
          {[
            { label: 'sin', fn: () => applyUnary('sin') },
            { label: 'cos', fn: () => applyUnary('cos') },
            { label: 'tan', fn: () => applyUnary('tan') },
            { label: 'log', fn: () => applyUnary('log') },
            { label: 'ln', fn: () => applyUnary('ln') },
            { label: 'π', fn: () => { setDisplay(String(Math.PI)); setResetNext(true); } },
            { label: 'e', fn: () => { setDisplay(String(Math.E)); setResetNext(true); } },
            { label: 'n!', fn: () => applyUnary('fact') },
            { label: '|x|', fn: () => applyUnary('abs') },
            { label: 'xʸ', fn: () => applyOperator('^') },
          ].map((b) => (
            <button
              key={b.label}
              onClick={b.fn}
              className="py-2 bg-neutral-200/70 dark:bg-[#2b2b2b] hover:bg-neutral-300 dark:hover:bg-[#383838] cursor-pointer"
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Keypad */}
      <div className="flex-1 grid grid-cols-4 gap-1 p-2 pt-0 text-sm">
        {[
          { label: '%', onClick: () => applyUnary('pct'), alt: true },
          { label: 'CE', onClick: () => setDisplay('0'), alt: true },
          { label: 'C', onClick: () => { setDisplay('0'); setExpression(''); setResetNext(false); }, alt: true },
          { label: <Delete className="w-4 h-4 mx-auto" />, onClick: backspace, alt: true },
          { label: '1/x', onClick: () => applyUnary('inv'), alt: true },
          { label: 'x²', onClick: () => applyUnary('sq'), alt: true },
          { label: '√x', onClick: () => applyUnary('sqrt'), alt: true },
          { label: '÷', onClick: () => applyOperator('÷'), alt: true },
          { label: '7', onClick: () => inputDigit('7') },
          { label: '8', onClick: () => inputDigit('8') },
          { label: '9', onClick: () => inputDigit('9') },
          { label: '×', onClick: () => applyOperator('×'), alt: true },
          { label: '4', onClick: () => inputDigit('4') },
          { label: '5', onClick: () => inputDigit('5') },
          { label: '6', onClick: () => inputDigit('6') },
          { label: '-', onClick: () => applyOperator('-'), alt: true },
          { label: '1', onClick: () => inputDigit('1') },
          { label: '2', onClick: () => inputDigit('2') },
          { label: '3', onClick: () => inputDigit('3') },
          { label: '+', onClick: () => applyOperator('+'), alt: true },
          { label: '+/-', onClick: () => applyUnary('neg') },
          { label: '0', onClick: () => inputDigit('0') },
          { label: '.', onClick: () => inputDigit('.') },
          { label: '=', onClick: evaluateEquals, accent: true },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.onClick}
            className={`flex items-center justify-center font-medium transition-colors cursor-pointer ${
              btn.accent
                ? 'bg-[#0078D7] hover:bg-[#106EBE] text-white'
                : btn.alt
                ? 'bg-neutral-200/75 dark:bg-[#2b2b2b] hover:bg-neutral-300 dark:hover:bg-[#383838]'
                : 'bg-white dark:bg-[#323232] hover:bg-neutral-50 dark:hover:bg-[#3e3e3e] font-semibold'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* History Slide-up Panel */}
      {showHistory && (
        <div className="absolute inset-x-0 bottom-0 top-12 z-20 bg-neutral-100/95 dark:bg-[#1f1f1f]/95 backdrop-blur-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold">History</span>
            <div className="flex gap-2">
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="p-1 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                  title="Clear history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setShowHistory(false)}
                className="text-xs px-2 py-0.5 bg-black/10 dark:bg-white/10 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 text-right">
            {history.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center mt-10">There&apos;s no history yet</p>
            ) : (
              history.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDisplay(item.result);
                    setShowHistory(false);
                  }}
                  className="w-full text-right p-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <div className="text-xs text-neutral-500 tabular-nums">{item.expr} =</div>
                  <div className="text-lg font-semibold tabular-nums">{item.result}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
