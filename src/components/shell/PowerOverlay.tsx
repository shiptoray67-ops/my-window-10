import React from 'react';
import { Power } from 'lucide-react';
import { useOS } from '../../context/OSContext';

export const PowerOverlay: React.FC = () => {
  const { powerPhase, setPowerPhase, settings } = useOS();

  if (powerPhase === 'restarting') {
    return (
      <div
        style={{ backgroundColor: settings.accentColor }}
        className="fixed inset-0 z-[10000] flex flex-col items-center justify-center text-white gap-6"
      >
        <div className="relative w-10 h-10">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="win10-loader-dot"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
        <div className="text-xl font-light tracking-wide">Restarting</div>
      </div>
    );
  }

  if (powerPhase === 'sleeping') {
    return (
      <div
        onClick={() => setPowerPhase('lock')}
        className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black text-neutral-400 cursor-pointer select-none"
      >
        <div className="text-sm font-light tracking-wide animate-pulse">
          PC is in Sleep mode — Click anywhere to wake
        </div>
      </div>
    );
  }

  if (powerPhase === 'shutdown') {
    return (
      <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black text-white gap-6 select-none">
        <button
          onClick={() => setPowerPhase('boot')}
          className="group flex flex-col items-center gap-4 p-6 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full border-2 border-neutral-600 group-hover:border-[#0078D7] flex items-center justify-center transition-colors">
            <Power className="w-7 h-7 text-neutral-400 group-hover:text-[#0078D7] transition-colors" />
          </div>
          <span className="text-sm text-neutral-400 group-hover:text-white transition-colors">
            Power On PC
          </span>
        </button>
      </div>
    );
  }

  return null;
};
