import React from 'react';
import { X, Monitor } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { AppIcon } from '../icons/WinIcons';

export const TaskSwitcher: React.FC = () => {
  const {
    taskViewOpen,
    setTaskViewOpen,
    windows,
    activeWindowId,
    focusWindow,
    closeWindow,
    getAppDefinition,
    openApp,
  } = useOS();

  if (!taskViewOpen) return null;

  const sorted = [...windows].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div
      onMouseDown={() => setTaskViewOpen(false)}
      className="fixed inset-0 z-[9400] bg-black/65 backdrop-blur-xl flex flex-col p-6 sm:p-10 text-white"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-[#0078D7]" />
          <h2 className="text-lg font-light">Task View &amp; Window Switcher</h2>
        </div>
        <button
          onClick={() => setTaskViewOpen(false)}
          className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 cursor-pointer"
        >
          Close (Esc)
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <p className="text-sm text-white/70">No open application windows right now.</p>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openApp('edge');
              }}
              className="px-4 py-2 text-xs bg-[#0078D7] hover:bg-[#106EBE] cursor-pointer"
            >
              Launch Edge
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openApp('explorer');
              }}
              className="px-4 py-2 text-xs bg-white/15 hover:bg-white/25 cursor-pointer"
            >
              Open File Explorer
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 overflow-y-auto py-2">
          {sorted.map((w) => {
            const def = getAppDefinition(w.appId);
            const isActive = w.instanceId === activeWindowId;
            return (
              <div
                key={w.instanceId}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  focusWindow(w.instanceId);
                  setTaskViewOpen(false);
                }}
                className={`group relative flex flex-col bg-neutral-900/90 border transition-all cursor-pointer hover:scale-[1.02] ${
                  isActive ? 'border-[#0078D7] ring-2 ring-[#0078D7]/50' : 'border-white/20 hover:border-white/40'
                }`}
              >
                <div className="h-9 px-3 flex items-center justify-between bg-white/5 border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <AppIcon appId={w.appId} size={16} webColor={def?.webColor} />
                    <span className="text-xs truncate">{w.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWindow(w.instanceId);
                    }}
                    className="p-1 opacity-70 hover:opacity-100 hover:bg-[#E81123] cursor-pointer"
                    title="Close window"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="h-36 flex flex-col items-center justify-center gap-2 p-4 bg-gradient-to-br from-neutral-800/80 to-neutral-950/90">
                  <AppIcon appId={w.appId} size={44} webColor={def?.webColor} />
                  <span className="text-[11px] text-white/60">
                    {w.isMinimized ? 'Minimized' : w.isMaximized ? 'Maximized' : 'Active'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
