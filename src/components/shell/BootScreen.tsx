import React, { useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { WindowsLogo } from '../icons/WinIcons';

export const BootScreen: React.FC = () => {
  const { setPowerPhase } = useOS();

  useEffect(() => {
    const timer = setTimeout(() => {
      setPowerPhase('lock');
    }, 2000);
    return () => clearTimeout(timer);
  }, [setPowerPhase]);

  return (
    <div
      onClick={() => setPowerPhase('lock')}
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black text-white cursor-pointer select-none"
    >
      <div className="flex flex-col items-center gap-16">
        <WindowsLogo className="w-24 h-24 text-[#0078D7] animate-pulse" />
        <div className="relative w-10 h-10">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="win10-loader-dot"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      </div>
      <span className="sr-only">Starting Windows 10</span>
    </div>
  );
};
