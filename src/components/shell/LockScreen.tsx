import React, { useEffect, useState } from 'react';
import { BatteryCharging, Wifi, WifiOff } from 'lucide-react';
import { useOS } from '../../context/OSContext';

export const LockScreen: React.FC = () => {
  const { settings, setPowerPhase } = useOS();
  const [now, setNow] = useState(new Date());
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const unlock = () => {
    if (dismissing) return;
    setDismissing(true);
    setTimeout(() => {
      setPowerPhase('login');
    }, 260);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key.length === 1) {
        unlock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !settings.use24HourClock,
  });

  const dateStr = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const isGradient = settings.lockWallpaper.startsWith('linear-gradient');

  return (
    <div
      onClick={unlock}
      style={
        isGradient
          ? { background: settings.lockWallpaper }
          : {
              backgroundImage: `url(${settings.lockWallpaper})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
      }
      className={`fixed inset-0 z-[9990] flex flex-col justify-between p-8 md:p-14 text-white cursor-pointer transition-all duration-300 ${
        dismissing ? '-translate-y-12 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Subtle scrim for crisp readability */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/20" />

      <div className="relative z-10 flex justify-end">
        <div className="text-xs text-white/80 bg-black/25 backdrop-blur-md px-3 py-1.5">
          Click or press any key to sign in
        </div>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-6xl sm:text-8xl font-light tracking-tight tabular-nums drop-shadow-lg">
            {timeStr.replace(/\s?(AM|PM)$/i, '')}
          </div>
          <div className="text-xl sm:text-3xl font-light drop-shadow-md">
            {dateStr}
          </div>
        </div>

        <div className="flex items-center gap-4 text-white/90 pb-2">
          {settings.wifiEnabled && !settings.airplaneMode ? (
            <Wifi className="w-5 h-5 drop-shadow" />
          ) : (
            <WifiOff className="w-5 h-5 drop-shadow" />
          )}
          <BatteryCharging className="w-5 h-5 drop-shadow" />
        </div>
      </div>
    </div>
  );
};
