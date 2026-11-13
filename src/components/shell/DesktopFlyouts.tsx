import React, { useEffect, useState } from 'react';
import { BatteryCharging, Check, Volume2, VolumeX, Wifi, WifiOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOS } from '../../context/OSContext';

export const DesktopFlyouts: React.FC = () => {
  const {
    activeFlyout,
    setActiveFlyout,
    settings,
    updateSettings,
    openApp,
  } = useOS();

  const [now, setNow] = useState(new Date());
  const [calMonth, setCalMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!activeFlyout) return null;

  const isTop = settings.taskbarPosition === 'top';
  const verticalAnchor = isTop ? 'top-12' : 'bottom-12';

  if (activeFlyout === 'volume') {
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`fixed ${verticalAnchor} right-4 max-h-[calc(100dvh-3.25rem)] overflow-y-auto z-[9300] w-72 p-4 border border-neutral-300/60 dark:border-white/15 shadow-2xl fluent-acrylic-light dark:fluent-acrylic-dark text-neutral-900 dark:text-white`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium">Speakers (Realtek High Definition Audio)</span>
          <span className="text-sm font-semibold tabular-nums">
            {settings.muted ? '0' : settings.volume}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => updateSettings({ muted: !settings.muted })}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            title={settings.muted ? 'Unmute' : 'Mute'}
          >
            {settings.muted || settings.volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.muted ? 0 : settings.volume}
            onChange={(e) =>
              updateSettings({ volume: Number(e.target.value), muted: Number(e.target.value) === 0 })
            }
            className="w-full accent-[#0078D7] cursor-pointer"
          />
        </div>
      </div>
    );
  }

  if (activeFlyout === 'network') {
    const networks = [
      { ssid: 'Home_Fiber_5G', signal: 'Excellent', secured: true, connected: settings.wifiEnabled && !settings.airplaneMode },
      { ssid: 'Workspace_Guest', signal: 'Good', secured: false, connected: false },
      { ssid: 'Studio_Mesh_AX', signal: 'Fair', secured: true, connected: false },
    ];

    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`fixed ${verticalAnchor} right-4 max-h-[calc(100dvh-3.25rem)] overflow-y-auto z-[9300] w-80 border border-neutral-300/60 dark:border-white/15 shadow-2xl fluent-acrylic-light dark:fluent-acrylic-dark text-neutral-900 dark:text-white`}
      >
        <div className="p-3 border-b border-neutral-200/60 dark:border-white/10 flex items-center justify-between">
          <span className="text-xs font-semibold">Network &amp; Internet</span>
          <button
            onClick={() => updateSettings({ wifiEnabled: !settings.wifiEnabled, airplaneMode: false })}
            style={settings.wifiEnabled && !settings.airplaneMode ? { backgroundColor: settings.accentColor } : undefined}
            className={`px-3 py-1 text-[11px] font-medium cursor-pointer ${
              settings.wifiEnabled && !settings.airplaneMode
                ? 'text-white'
                : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-900 dark:text-white'
            }`}
          >
            Wi-Fi {settings.wifiEnabled && !settings.airplaneMode ? 'On' : 'Off'}
          </button>
        </div>
        <div className="p-2 space-y-1">
          {settings.wifiEnabled && !settings.airplaneMode ? (
            networks.map((net) => (
              <div
                key={net.ssid}
                className={`p-2.5 flex items-center justify-between ${
                  net.connected ? 'bg-[#0078D7]/15 border border-[#0078D7]/30' : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-[#0078D7]" />
                  <div>
                    <div className="text-xs font-medium">{net.ssid}</div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {net.connected ? 'Connected, secured' : `${net.signal} signal`}
                    </div>
                  </div>
                </div>
                {net.connected && <Check className="w-4 h-4 text-[#0078D7]" />}
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-xs text-neutral-500 dark:text-neutral-400 space-y-2">
              <WifiOff className="w-6 h-6 mx-auto opacity-50" />
              <div>Wi-Fi is turned off</div>
            </div>
          )}
        </div>
        <div className="p-2.5 border-t border-neutral-200/60 dark:border-white/10">
          <button
            onClick={() => {
              setActiveFlyout(null);
              openApp('settings', { settingsTab: 'system' });
            }}
            className="text-xs text-[#0078D7] hover:underline cursor-pointer"
          >
            Network &amp; Internet settings
          </button>
        </div>
      </div>
    );
  }

  if (activeFlyout === 'battery') {
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`fixed ${verticalAnchor} right-4 max-h-[calc(100dvh-3.25rem)] overflow-y-auto z-[9300] w-72 p-4 border border-neutral-300/60 dark:border-white/15 shadow-2xl fluent-acrylic-light dark:fluent-acrylic-dark text-neutral-900 dark:text-white space-y-3`}
      >
        <div className="flex items-center gap-3">
          <BatteryCharging className="w-7 h-7 text-emerald-500" />
          <div>
            <div className="text-2xl font-light tabular-nums">98%</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Plugged in · Fully charged in 4 min
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-neutral-200/60 dark:border-white/10 flex items-center justify-between text-xs">
          <span>Power mode:</span>
          <span className="font-medium text-[#0078D7]">Best performance</span>
        </div>
      </div>
    );
  }

  if (activeFlyout === 'language') {
    const langs: Array<{ code: typeof settings.language; label: string }> = [
      { code: 'ENG US', label: 'English (United States)' },
      { code: 'ENG UK', label: 'English (United Kingdom)' },
      { code: 'ESP', label: 'Español (España)' },
      { code: 'FRA', label: 'Français (France)' },
      { code: 'DEU', label: 'Deutsch (Deutschland)' },
    ];
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`fixed ${verticalAnchor} right-4 max-h-[calc(100dvh-3.25rem)] overflow-y-auto z-[9300] w-64 py-1 border border-neutral-300/60 dark:border-white/15 shadow-2xl fluent-acrylic-light dark:fluent-acrylic-dark text-neutral-900 dark:text-white`}
      >
        <div className="px-3 py-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
          Keyboard &amp; Input Method
        </div>
        {langs.map((l) => (
          <button
            key={l.code}
            onClick={() => {
              updateSettings({ language: l.code });
              setActiveFlyout(null);
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] font-semibold w-11 text-left">{l.code}</span>
              <span>{l.label}</span>
            </span>
            {settings.language === l.code && <Check className="w-3.5 h-3.5 text-[#0078D7]" />}
          </button>
        ))}
      </div>
    );
  }

  // Clock & Calendar Flyout
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`fixed ${verticalAnchor} right-2 max-h-[calc(100dvh-3.25rem)] overflow-y-auto z-[9300] w-80 border border-neutral-300/60 dark:border-white/15 shadow-2xl fluent-acrylic-light dark:fluent-acrylic-dark text-neutral-900 dark:text-white`}
    >
      <div className="p-4 border-b border-neutral-200/60 dark:border-white/10">
        <div className="text-3xl font-light tabular-nums">
          {now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: !settings.use24HourClock,
          })}
        </div>
        <button
          onClick={() => {
            setActiveFlyout(null);
            openApp('calendar');
          }}
          className="text-xs text-[#0078D7] hover:underline mt-0.5 cursor-pointer"
        >
          {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold">
            {calMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCalMonth(new Date(year, month - 1, 1))}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCalMonth(new Date(year, month + 1, 1))}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-500 dark:text-neutral-400 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs tabular-nums">
          {cells.map((day, idx) => {
            const isToday = isCurrentMonth && day === now.getDate();
            return (
              <div
                key={idx}
                style={isToday ? { backgroundColor: settings.accentColor } : undefined}
                className={`h-8 flex items-center justify-center ${
                  day === null
                    ? ''
                    : isToday
                    ? 'text-white font-semibold'
                    : 'hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
