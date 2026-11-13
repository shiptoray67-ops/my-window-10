import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { CalendarEvent } from '../../types/os';

const EVENTS_KEY = 'win10_calendar_events_v1';

export const CalendarApp: React.FC = () => {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [
      { id: 'ev-1', date: todayIso, time: '10:00', title: 'Design Sprint Review', color: '#0078D7' },
      { id: 'ev-2', date: todayIso, time: '15:30', title: 'Weekly Sync', color: '#107C10' },
    ];
  });

  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newColor, setNewColor] = useState('#0078D7');

  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    } catch {
      // ignore
    }
  }, [events]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toIso = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const selectedEvents = events
    .filter((e) => e.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const addEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setEvents((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}`,
        date: selectedDate,
        time: newTime,
        title: newTitle.trim(),
        color: newColor,
      },
    ]);
    setNewTitle('');
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-white dark:bg-[#1b1b1b] text-neutral-900 dark:text-neutral-100">
      {/* Month Grid */}
      <div className="flex-1 flex flex-col p-4 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => {
                setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelectedDate(todayIso);
              }}
              className="px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Today
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs font-medium text-neutral-500 pb-2 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 gap-1 auto-rows-fr">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="bg-neutral-50/40 dark:bg-white/[0.02]" />;
            const iso = toIso(day);
            const dayEvents = events.filter((e) => e.date === iso);
            const isSelected = iso === selectedDate;
            const isToday = iso === todayIso;

            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={`p-1.5 flex flex-col items-start justify-start border text-left transition-colors cursor-pointer overflow-hidden ${
                  isSelected
                    ? 'border-[#0078D7] bg-[#0078D7]/10'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span
                  className={`text-xs tabular-nums w-6 h-6 flex items-center justify-center ${
                    isToday ? 'bg-[#0078D7] text-white font-semibold' : ''
                  }`}
                >
                  {day}
                </span>
                <div className="w-full mt-1 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      style={{ backgroundColor: ev.color }}
                      className="text-[10px] text-white px-1 truncate"
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[9px] text-neutral-500">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Sidebar */}
      <div className="w-full md:w-72 shrink-0 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] p-4 flex flex-col gap-4">
        <div>
          <div className="text-xs text-neutral-500">Selected date</div>
          <div className="text-sm font-semibold">
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString([], {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>

        <form onSubmit={addEvent} className="space-y-2 border-b border-neutral-200 dark:border-neutral-700 pb-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add event title..."
            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
            />
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-7 border border-neutral-300 dark:border-neutral-700 cursor-pointer"
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1 bg-[#0078D7] text-white text-xs hover:bg-[#106EBE] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2">
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-neutral-500">No events scheduled.</p>
          ) : (
            selectedEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between p-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: ev.color }}
                      className="w-2 h-2 shrink-0 inline-block"
                    />
                    <span className="text-xs font-medium truncate">{ev.title}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 tabular-nums mt-0.5">{ev.time}</div>
                </div>
                <button
                  onClick={() => setEvents((prev) => prev.filter((x) => x.id !== ev.id))}
                  className="p-1 text-neutral-400 hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
