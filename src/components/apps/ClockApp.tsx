import React, { useEffect, useState } from 'react';
import { AlarmClock, Flag, Globe, Hourglass, Pause, Play, Plus, RotateCcw, Timer, Trash2 } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { soundEngine } from '../../utils/sound';

const CITIES = [
  { name: 'San Francisco', tz: 'America/Los_Angeles' },
  { name: 'New York', tz: 'America/New_York' },
  { name: 'London', tz: 'Europe/London' },
  { name: 'Tokyo', tz: 'Asia/Tokyo' },
  { name: 'Sydney', tz: 'Australia/Sydney' },
];

export const ClockApp: React.FC = () => {
  const { alarms, setAlarms, addNotification } = useOS();
  const [tab, setTab] = useState<'clock' | 'alarm' | 'timer' | 'stopwatch'>('clock');
  const [now, setNow] = useState(new Date());

  // Alarm form
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('Reminder');

  // Timer state
  const [timerInputMin, setTimerInputMin] = useState(5);
  const [timerLeftSec, setTimerLeftSec] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);

  // Stopwatch state
  const [swMs, setSwMs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => {
      setTimerLeftSec((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          soundEngine.playAlarm();
          addNotification('Alarms & Clock', 'Timer Complete', `${timerInputMin} minute timer finished.`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerRunning, timerInputMin, addNotification]);

  useEffect(() => {
    if (!swRunning) return;
    const start = Date.now() - swMs;
    const t = setInterval(() => setSwMs(Date.now() - start), 50);
    return () => clearInterval(t);
  }, [swRunning]);

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatSw = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col sm:flex-row h-full bg-white dark:bg-[#1b1b1b] text-neutral-900 dark:text-neutral-100">
      {/* Left Navigation */}
      <div className="flex sm:flex-col sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] p-1.5 gap-1">
        {[
          { id: 'clock', label: 'World Clock', icon: <Globe className="w-4 h-4" /> },
          { id: 'alarm', label: 'Alarm', icon: <AlarmClock className="w-4 h-4" /> },
          { id: 'timer', label: 'Timer', icon: <Hourglass className="w-4 h-4" /> },
          { id: 'stopwatch', label: 'Stopwatch', icon: <Timer className="w-4 h-4" /> },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id as typeof tab)}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium cursor-pointer ${
              tab === item.id
                ? 'bg-[#0078D7] text-white'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {item.icon}
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'clock' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs text-neutral-500">Local Time</div>
              <div className="text-4xl font-light tabular-nums">
                {now.toLocaleTimeString()}
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CITIES.map((c) => (
                <div
                  key={c.name}
                  className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#242424] flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-[11px] text-neutral-500">
                      {now.toLocaleDateString([], { timeZone: c.tz, weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-xl font-light tabular-nums">
                    {now.toLocaleTimeString([], { timeZone: c.tz, hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'alarm' && (
          <div className="space-y-5 max-w-lg">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAlarms((prev) => [
                  ...prev,
                  {
                    id: `alarm-${Date.now()}`,
                    time: newAlarmTime,
                    label: newAlarmLabel.trim() || 'Alarm',
                    enabled: true,
                    days: [0, 1, 2, 3, 4, 5, 6],
                  },
                ]);
              }}
              className="flex flex-wrap gap-2 items-center p-3 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#242424]"
            >
              <input
                type="time"
                value={newAlarmTime}
                onChange={(e) => setNewAlarmTime(e.target.value)}
                className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
              />
              <input
                type="text"
                value={newAlarmLabel}
                onChange={(e) => setNewAlarmLabel(e.target.value)}
                placeholder="Alarm label"
                className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-3 py-1.5 bg-[#0078D7] text-white text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Alarm
              </button>
            </form>

            <div className="space-y-2">
              {alarms.map((a) => (
                <div
                  key={a.id}
                  className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#242424] flex items-center justify-between"
                >
                  <div>
                    <div className="text-2xl font-light tabular-nums">{a.time}</div>
                    <div className="text-xs text-neutral-500">{a.label}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        setAlarms((prev) =>
                          prev.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x))
                        )
                      }
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                        a.enabled ? 'bg-[#0078D7]' : 'bg-neutral-400 dark:bg-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          a.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => setAlarms((prev) => prev.filter((x) => x.id !== a.id))}
                      className="p-1.5 text-neutral-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'timer' && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-5xl sm:text-6xl font-light tabular-nums">
              {formatTimer(timerLeftSec)}
            </div>
            <div className="flex items-center gap-2 text-xs">
              {[1, 5, 10, 25].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerInputMin(m);
                    setTimerLeftSec(m * 60);
                  }}
                  className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  {m} min
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTimerRunning((r) => !r)}
                className="flex items-center gap-2 px-6 py-2 bg-[#0078D7] text-white text-xs font-medium hover:bg-[#106EBE] cursor-pointer"
              >
                {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {timerRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => {
                  setTimerRunning(false);
                  setTimerLeftSec(timerInputMin * 60);
                }}
                className="p-2 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {tab === 'stopwatch' && (
          <div className="flex flex-col items-center gap-6">
            <div className="text-5xl sm:text-6xl font-light tabular-nums mt-4">
              {formatSw(swMs)}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSwRunning((r) => !r)}
                className="flex items-center gap-2 px-6 py-2 bg-[#0078D7] text-white text-xs font-medium hover:bg-[#106EBE] cursor-pointer"
              >
                {swRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {swRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => setLaps((prev) => [swMs, ...prev])}
                disabled={!swRunning && swMs === 0}
                className="flex items-center gap-1.5 px-4 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 text-xs cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" /> Lap
              </button>
              <button
                onClick={() => {
                  setSwRunning(false);
                  setSwMs(0);
                  setLaps([]);
                }}
                className="p-2 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {laps.length > 0 && (
              <div className="w-full max-w-sm border-t border-neutral-200 dark:border-neutral-800 pt-3 space-y-1">
                {laps.map((lap, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 px-2 tabular-nums">
                    <span className="text-neutral-500">Lap {laps.length - idx}</span>
                    <span className="font-mono">{formatSw(lap)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
