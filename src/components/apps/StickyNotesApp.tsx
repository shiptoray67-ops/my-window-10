import React, { useEffect, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { StickyNote } from '../../types/os';

const STICKY_KEY = 'win10_sticky_notes_v1';

const COLOR_MAP: Record<StickyNote['color'], { top: string; body: string; text: string }> = {
  yellow: { top: '#E6C200', body: '#FFF4A3', text: '#1F2937' },
  green: { top: '#65B849', body: '#D9F9C6', text: '#1F2937' },
  pink: { top: '#E271A1', body: '#FAD4E4', text: '#1F2937' },
  blue: { top: '#5BB0E5', body: '#CFEBFD', text: '#1F2937' },
  purple: { top: '#A97FD6', body: '#E8D9FA', text: '#1F2937' },
  charcoal: { top: '#4B5563', body: '#374151', text: '#F9FAFB' },
};

export const StickyNotesApp: React.FC = () => {
  const [notes, setNotes] = useState<StickyNote[]>(() => {
    try {
      const raw = localStorage.getItem(STICKY_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [
      {
        id: 'note-1',
        color: 'yellow',
        content: 'Quick Checklist:\n• Try File Explorer drag & drop\n• Install Chess or 2048 from Store\n• Test Win+D and Alt+Tab shortcuts',
        updatedAt: Date.now(),
      },
      {
        id: 'note-2',
        color: 'blue',
        content: 'Everything saves locally in your browser via IndexedDB and localStorage.',
        updatedAt: Date.now(),
      },
    ];
  });
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STICKY_KEY, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  const addNote = (color: StickyNote['color'] = 'yellow') => {
    setNotes((prev) => [
      { id: `note-${Date.now()}`, color, content: '', updatedAt: Date.now() },
      ...prev,
    ]);
  };

  const filtered = notes.filter((n) =>
    n.content.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-neutral-100 dark:bg-[#1f1f1f] text-neutral-900 dark:text-neutral-100">
      <div className="p-3 bg-white dark:bg-[#262626] border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
        <button
          onClick={() => addNote('yellow')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0078D7] text-white text-xs font-medium hover:bg-[#106EBE] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> New Note
        </button>

        <div className="flex-1 flex items-center gap-2 px-2.5 h-8 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
        {filtered.map((note) => {
          const palette = COLOR_MAP[note.color];
          return (
            <div
              key={note.id}
              style={{ backgroundColor: palette.body, color: palette.text }}
              className="flex flex-col shadow-md border border-black/10 min-h-[160px]"
            >
              <div
                style={{ backgroundColor: palette.top }}
                className="h-7 px-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-1">
                  {(Object.keys(COLOR_MAP) as StickyNote['color'][]).map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setNotes((prev) =>
                          prev.map((x) => (x.id === note.id ? { ...x, color: c } : x))
                        )
                      }
                      style={{ backgroundColor: COLOR_MAP[c].body }}
                      className={`w-3.5 h-3.5 rounded-full border border-black/25 cursor-pointer ${
                        note.color === c ? 'ring-2 ring-black/50' : ''
                      }`}
                      title={c}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setNotes((prev) => prev.filter((x) => x.id !== note.id))}
                  className="p-1 hover:bg-black/15 cursor-pointer"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={note.content}
                onChange={(e) =>
                  setNotes((prev) =>
                    prev.map((x) =>
                      x.id === note.id
                        ? { ...x, content: e.target.value, updatedAt: Date.now() }
                        : x
                    )
                  )
                }
                placeholder="Take a note..."
                className="flex-1 p-3 bg-transparent text-xs leading-relaxed outline-none resize-none placeholder:text-current/45"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
