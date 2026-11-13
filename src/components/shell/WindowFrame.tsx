import React, { useRef, useState } from 'react';
import { Minus, Square, Copy, X, ArrowLeft, Layers } from 'lucide-react';
import { WindowInstance } from '../../types/os';
import { useOS } from '../../context/OSContext';
import { AppIcon } from '../icons/WinIcons';

interface WindowFrameProps {
  win: WindowInstance;
  children: React.ReactNode;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const WindowFrame: React.FC<WindowFrameProps> = ({ win, children }) => {
  const {
    activeWindowId,
    focusWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    updateWindowBounds,
    snapWindow,
    settings,
    isMobile,
    getAppDefinition,
    setTaskViewOpen,
  } = useOS();

  const [snapGhost, setSnapGhost] = useState<'left' | 'right' | 'top' | null>(null);
  const dragStateRef = useRef<{
    type: 'move' | 'resize';
    dir?: ResizeDir;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  if (win.isMinimized) return null;

  const isActive = activeWindowId === win.instanceId;
  const def = getAppDefinition(win.appId);
  const uiScale = (settings.resolutionScale || 100) / 100;
  const minW = Math.min(def?.minWidth || 300, Math.max(220, window.innerWidth - 16));
  const minH = Math.min(def?.minHeight || 220, Math.max(160, window.innerHeight - 60));

  // Compute taskbar inset offsets so maximized windows never hide behind taskbar
  const tbSize = Math.round((isMobile ? 48 : 44) * uiScale);
  const railSize = Math.round(52 * uiScale);
  const maxBounds = {
    top: !isMobile && settings.taskbarPosition === 'top' ? tbSize : 0,
    left: !isMobile && settings.taskbarPosition === 'left' ? railSize : 0,
    width:
      !isMobile && (settings.taskbarPosition === 'left' || settings.taskbarPosition === 'right')
        ? `calc(100dvw - ${railSize}px)`
        : '100dvw',
    height:
      isMobile || settings.taskbarPosition === 'bottom' || settings.taskbarPosition === 'top'
        ? `calc(100dvh - ${tbSize}px)`
        : '100dvh',
  };

  // Mobile full-screen window layout with touch-friendly back & switcher bar (disabled when Virtual Mouse mode is ON)
  if (isMobile && !settings.mouseMode) {
    return (
      <div
        style={{ zIndex: win.zIndex }}
        onMouseDown={() => focusWindow(win.instanceId)}
        className="fixed inset-0 bottom-12 flex flex-col bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xl"
      >
        <div className="h-11 shrink-0 flex items-center justify-between px-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
          <button
            onClick={() => minimizeWindow(win.instanceId)}
            className="flex items-center gap-1.5 px-2.5 h-9 text-xs font-medium hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Desktop</span>
          </button>

          <div className="flex items-center gap-2 min-w-0 px-2">
            <AppIcon appId={win.appId} size={18} webColor={def?.webColor} />
            <span className="text-xs font-semibold truncate">{win.title}</span>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => setTaskViewOpen(true)}
              className="w-9 h-9 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-800"
              title="Switch apps"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => closeWindow(win.instanceId)}
              className="w-9 h-9 flex items-center justify-center hover:bg-[#E81123] hover:text-white"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    );
  }

  const startMove = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    focusWindow(win.instanceId);

    let startX = e.clientX;
    let startY = e.clientY;
    let origX = win.x;
    let origY = win.y;
    let origW = win.width;
    let origH = win.height;

    if (win.isMaximized || win.snapState !== 'none') {
      const restored = win.prevBounds || { x: Math.max(20, e.clientX - 240), y: 20, width: 760, height: 520 };
      origW = restored.width;
      origH = restored.height;
      origX = Math.max(0, Math.min(window.innerWidth - origW, e.clientX - origW / 2));
      origY = Math.max(0, e.clientY - 16);
      updateWindowBounds(win.instanceId, {
        isMaximized: false,
        snapState: 'none',
        x: origX,
        y: origY,
        width: origW,
        height: origH,
      });
    }

    dragStateRef.current = { type: 'move', startX, startY, origX, origY, origW, origH };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStateRef.current) return;
      const dx = ev.clientX - dragStateRef.current.startX;
      const dy = ev.clientY - dragStateRef.current.startY;
      const nx = Math.max(-origW + 120, Math.min(window.innerWidth - 120, dragStateRef.current.origX + dx));
      const ny = Math.max(0, Math.min(window.innerHeight - 80, dragStateRef.current.origY + dy));
      updateWindowBounds(win.instanceId, { x: nx, y: ny });

      if (ev.clientX <= 14) setSnapGhost('left');
      else if (ev.clientX >= window.innerWidth - 14) setSnapGhost('right');
      else if (ev.clientY <= 10) setSnapGhost('top');
      else setSnapGhost(null);
    };

    const onMouseUp = (ev: MouseEvent) => {
      if (ev.clientX <= 14) snapWindow(win.instanceId, 'left');
      else if (ev.clientX >= window.innerWidth - 14) snapWindow(win.instanceId, 'right');
      else if (ev.clientY <= 10) snapWindow(win.instanceId, 'top');
      setSnapGhost(null);
      dragStateRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResize = (dir: ResizeDir) => (e: React.MouseEvent) => {
    if (win.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    focusWindow(win.instanceId);

    dragStateRef.current = {
      type: 'resize',
      dir,
      startX: e.clientX,
      startY: e.clientY,
      origX: win.x,
      origY: win.y,
      origW: win.width,
      origH: win.height,
    };

    const onMouseMove = (ev: MouseEvent) => {
      const st = dragStateRef.current;
      if (!st || !st.dir) return;
      const dx = ev.clientX - st.startX;
      const dy = ev.clientY - st.startY;
      let { origX: x, origY: y, origW: w, origH: h } = st;

      if (st.dir.includes('e')) w = Math.max(minW, st.origW + dx);
      if (st.dir.includes('s')) h = Math.max(minH, st.origH + dy);
      if (st.dir.includes('w')) {
        const nextW = Math.max(minW, st.origW - dx);
        x = st.origX + (st.origW - nextW);
        w = nextW;
      }
      if (st.dir.includes('n')) {
        const nextH = Math.max(minH, st.origH - dy);
        y = Math.max(0, st.origY + (st.origH - nextH));
        h = nextH;
      }
      updateWindowBounds(win.instanceId, { x, y, width: w, height: h, snapState: 'none' });
    };

    const onMouseUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <>
      {snapGhost && (
        <div
          style={{
            zIndex: win.zIndex - 1,
            left: snapGhost === 'right' ? '50%' : 6,
            top: 6,
            width: snapGhost === 'top' ? 'calc(100vw - 12px)' : 'calc(50vw - 12px)',
            height: 'calc(100vh - 56px)',
          }}
          className="fixed bg-white/15 border-2 border-white/40 backdrop-blur-md transition-all duration-150 pointer-events-none"
        />
      )}

      <div
        onMouseDown={() => focusWindow(win.instanceId)}
        style={
          win.isMaximized
            ? { ...maxBounds, zIndex: win.zIndex }
            : {
                left: Math.min(win.x, Math.max(0, window.innerWidth - 100)),
                top: Math.min(win.y, Math.max(0, window.innerHeight - 90)),
                width: Math.min(win.width, window.innerWidth - 8),
                height: Math.min(win.height, window.innerHeight - Math.round(48 * uiScale)),
                zIndex: win.zIndex,
              }
        }
        className={`fixed flex flex-col bg-white dark:bg-[#1f1f1f] text-neutral-900 dark:text-neutral-100 overflow-hidden transition-shadow ${
          isActive
            ? 'border border-neutral-400/70 dark:border-neutral-600 shadow-[0_18px_45px_rgba(0,0,0,0.45)]'
            : 'border border-neutral-300/60 dark:border-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.28)]'
        }`}
      >
        {/* Title Bar */}
        <div
          onMouseDown={startMove}
          onDoubleClick={() => (win.isMaximized ? restoreWindow(win.instanceId) : maximizeWindow(win.instanceId))}
          className={`h-8 shrink-0 flex items-center justify-between pl-2.5 select-none ${
            isActive
              ? 'bg-neutral-100 dark:bg-[#202020] text-neutral-900 dark:text-white'
              : 'bg-neutral-200/90 dark:bg-[#2b2b2b] text-neutral-500 dark:text-neutral-400'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <AppIcon appId={win.appId} size={15} webColor={def?.webColor} />
            <span className="text-xs font-normal truncate">{win.title}</span>
          </div>

          <div className="flex items-center h-full shrink-0">
            <button
              onClick={() => minimizeWindow(win.instanceId)}
              className="w-11 h-full flex items-center justify-center hover:bg-neutral-300/70 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() =>
                win.isMaximized ? restoreWindow(win.instanceId) : maximizeWindow(win.instanceId)
              }
              className="w-11 h-full flex items-center justify-center hover:bg-neutral-300/70 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={win.isMaximized ? 'Restore Down' : 'Maximize'}
            >
              {win.isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            </button>
            <button
              onClick={() => closeWindow(win.instanceId)}
              className="w-11 h-full flex items-center justify-center hover:bg-[#E81123] hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* App Viewport */}
        <div className="flex-1 min-h-0 overflow-hidden relative">{children}</div>

        {/* 8-Direction Resize Handles */}
        {!win.isMaximized && (
          <>
            <div data-interactive="true" onMouseDown={startResize('n')} className="absolute top-0 left-3 right-3 h-2 z-20 cursor-n-resize" />
            <div data-interactive="true" onMouseDown={startResize('s')} className="absolute bottom-0 left-3 right-3 h-2 z-20 cursor-s-resize" />
            <div data-interactive="true" onMouseDown={startResize('w')} className="absolute top-3 bottom-3 left-0 w-2 z-20 cursor-w-resize" />
            <div data-interactive="true" onMouseDown={startResize('e')} className="absolute top-3 bottom-3 right-0 w-2 z-20 cursor-e-resize" />
            <div data-interactive="true" onMouseDown={startResize('nw')} className="absolute top-0 left-0 w-3.5 h-3.5 z-30 cursor-nw-resize" />
            <div data-interactive="true" onMouseDown={startResize('ne')} className="absolute top-0 right-0 w-3.5 h-3.5 z-30 cursor-ne-resize" />
            <div data-interactive="true" onMouseDown={startResize('sw')} className="absolute bottom-0 left-0 w-3.5 h-3.5 z-30 cursor-sw-resize" />
            <div data-interactive="true" onMouseDown={startResize('se')} className="absolute bottom-0 right-0 w-4 h-4 z-30 cursor-se-resize" />
          </>
        )}
      </div>
    </>
  );
};
