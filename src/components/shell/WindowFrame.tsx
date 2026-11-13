import React, { useEffect, useRef, useState } from 'react';
import { Minus, Square, Copy, X, ArrowLeft, Layers } from 'lucide-react';
import { SnapZone, WindowInstance } from '../../types/os';
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
    getWorkAreaRect,
    settings,
    isMobile,
    getAppDefinition,
    setTaskViewOpen,
    setInteractingWindowId,
    setContextMenuOpen,
  } = useOS();

  const [snapGhost, setSnapGhost] = useState<SnapZone | null>(null);
  const [titleMenu, setTitleMenu] = useState<{ x: number; y: number } | null>(null);

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

  const titleLongPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!titleMenu) return;
    setContextMenuOpen(true);
    const closeMenu = () => setTitleMenu(null);
    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('touchstart', closeMenu);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('touchstart', closeMenu);
      setContextMenuOpen(false);
    };
  }, [titleMenu, setContextMenuOpen]);

  useEffect(() => {
    return () => {
      if (titleLongPressTimerRef.current) {
        clearTimeout(titleLongPressTimerRef.current);
      }
    };
  }, []);

  if (win.isMinimized) return null;

  const isActive = activeWindowId === win.instanceId;
  const def = getAppDefinition(win.appId);
  const work = getWorkAreaRect();
  const minW = Math.min(320, Math.max(240, work.width - 16));
  const minH = Math.min(240, Math.max(180, work.height - 16));
  const maxW = work.width;
  const maxH = work.height;

  // Mobile portrait full-screen window layout when Virtual Mouse mode is OFF
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

  const detectSnapZone = (clientX: number, clientY: number): SnapZone | null => {
    const cornerThreshold = 28;
    const edgeThreshold = 18;
    const atLeft = clientX <= work.x + cornerThreshold;
    const atRight = clientX >= work.x + work.width - cornerThreshold;
    const atTop = clientY <= work.y + cornerThreshold;
    const atBottom = clientY >= work.y + work.height - cornerThreshold;

    if (atLeft && atTop) return 'tl';
    if (atRight && atTop) return 'tr';
    if (atLeft && atBottom) return 'bl';
    if (atRight && atBottom) return 'br';
    if (clientX <= work.x + edgeThreshold) return 'left';
    if (clientX >= work.x + work.width - edgeThreshold) return 'right';
    if (clientY <= work.y + 14) return 'top';
    return null;
  };

  const getSnapGhostRect = (zone: SnapZone) => {
    const halfW = Math.floor(work.width / 2);
    const halfH = Math.floor(work.height / 2);
    const pad = 6;
    switch (zone) {
      case 'top':
        return { left: work.x + pad, top: work.y + pad, width: work.width - pad * 2, height: work.height - pad * 2 };
      case 'left':
        return { left: work.x + pad, top: work.y + pad, width: halfW - pad * 2, height: work.height - pad * 2 };
      case 'right':
        return { left: work.x + halfW + pad, top: work.y + pad, width: work.width - halfW - pad * 2, height: work.height - pad * 2 };
      case 'top-half':
        return { left: work.x + pad, top: work.y + pad, width: work.width - pad * 2, height: halfH - pad * 2 };
      case 'bottom-half':
        return { left: work.x + pad, top: work.y + halfH + pad, width: work.width - pad * 2, height: work.height - halfH - pad * 2 };
      case 'tl':
        return { left: work.x + pad, top: work.y + pad, width: halfW - pad * 2, height: halfH - pad * 2 };
      case 'tr':
        return { left: work.x + halfW + pad, top: work.y + pad, width: work.width - halfW - pad * 2, height: halfH - pad * 2 };
      case 'bl':
        return { left: work.x + pad, top: work.y + halfH + pad, width: halfW - pad * 2, height: work.height - halfH - pad * 2 };
      case 'br':
        return { left: work.x + halfW + pad, top: work.y + halfH + pad, width: work.width - halfW - pad * 2, height: work.height - halfH - pad * 2 };
    }
  };

  const openTitleContextMenu = (clientX: number, clientY: number) => {
    const menuW = 196;
    const menuH = 310;
    const x = Math.max(work.x + 4, Math.min(work.x + work.width - menuW - 4, clientX));
    const y = Math.max(work.y + 4, Math.min(work.y + work.height - menuH - 4, clientY));
    setTitleMenu({ x, y });
  };

  const applyPresetSize = (preset: 'small' | 'medium' | 'large') => {
    const ratio =
      preset === 'small'
        ? { w: 0.4, h: 0.48 }
        : preset === 'medium'
        ? { w: 0.6, h: 0.65 }
        : { w: 0.85, h: 0.88 };
    const nextW = Math.min(maxW, Math.max(minW, Math.round(work.width * ratio.w)));
    const nextH = Math.min(maxH, Math.max(minH, Math.round(work.height * ratio.h)));
    const nextX = work.x + Math.round((work.width - nextW) / 2);
    const nextY = work.y + Math.round((work.height - nextH) / 2);
    updateWindowBounds(win.instanceId, {
      isMaximized: false,
      snapState: 'none',
      x: nextX,
      y: nextY,
      width: nextW,
      height: nextH,
    });
    setTitleMenu(null);
  };

  const beginMovePointer = (startX: number, startY: number, isTouch: boolean) => {
    focusWindow(win.instanceId);
    let origX = win.x;
    let origY = win.y;
    let origW = win.width;
    let origH = win.height;
    let unmaximizedOnDrag = false;

    const performMove = (clientX: number, clientY: number) => {
      if (!dragStateRef.current) return;
      const dx = clientX - dragStateRef.current.startX;
      const dy = clientY - dragStateRef.current.startY;
      if (Math.hypot(dx, dy) > 4 && titleLongPressTimerRef.current) {
        clearTimeout(titleLongPressTimerRef.current);
        titleLongPressTimerRef.current = null;
      }

      if (!unmaximizedOnDrag && (win.isMaximized || win.snapState !== 'none') && Math.hypot(dx, dy) > 5) {
        unmaximizedOnDrag = true;
        const restored = win.prevBounds || {
          x: Math.max(work.x + 20, clientX - Math.round((work.width * 0.6) / 2)),
          y: work.y + 20,
          width: Math.min(maxW, Math.max(minW, Math.round(work.width * 0.6))),
          height: Math.min(maxH, Math.max(minH, Math.round(work.height * 0.65))),
        };
        origW = Math.min(maxW, Math.max(minW, restored.width));
        origH = Math.min(maxH, Math.max(minH, restored.height));
        origX = Math.max(work.x - origW + 120, Math.min(work.x + work.width - 120, clientX - origW / 2));
        origY = Math.max(work.y, Math.min(work.y + work.height - 36, clientY - 16));
        dragStateRef.current.origX = origX;
        dragStateRef.current.origY = origY;
        dragStateRef.current.origW = origW;
        dragStateRef.current.origH = origH;
        dragStateRef.current.startX = clientX;
        dragStateRef.current.startY = clientY;
        updateWindowBounds(win.instanceId, {
          isMaximized: false,
          snapState: 'none',
          x: origX,
          y: origY,
          width: origW,
          height: origH,
        });
        return;
      }

      const nx = Math.max(
        work.x - dragStateRef.current.origW + 120,
        Math.min(work.x + work.width - 120, dragStateRef.current.origX + dx)
      );
      const ny = Math.max(
        work.y,
        Math.min(work.y + work.height - 36, dragStateRef.current.origY + dy)
      );
      updateWindowBounds(win.instanceId, { x: nx, y: ny });
      setSnapGhost(detectSnapZone(clientX, clientY));
    };

    const finishMove = (clientX: number, clientY: number) => {
      if (titleLongPressTimerRef.current) {
        clearTimeout(titleLongPressTimerRef.current);
        titleLongPressTimerRef.current = null;
      }
      const zone = detectSnapZone(clientX, clientY);
      if (zone) {
        snapWindow(win.instanceId, zone);
      }
      setSnapGhost(null);
      dragStateRef.current = null;
      setInteractingWindowId(null);
    };

    dragStateRef.current = { type: 'move', startX, startY, origX, origY, origW, origH };
    setInteractingWindowId(win.instanceId);

    if (!isTouch) {
      const onMouseMove = (ev: MouseEvent) => performMove(ev.clientX, ev.clientY);
      const onMouseUp = (ev: MouseEvent) => {
        finishMove(ev.clientX, ev.clientY);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      const onTouchMove = (ev: TouchEvent) => {
        if (ev.touches.length === 1) {
          performMove(ev.touches[0].clientX, ev.touches[0].clientY);
        }
      };
      const onTouchEnd = (ev: TouchEvent) => {
        const pt = ev.changedTouches[0];
        finishMove(pt ? pt.clientX : startX, pt ? pt.clientY : startY);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('touchcancel', onTouchEnd);
      };
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    }
  };

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setTitleMenu(null);
    beginMovePointer(e.clientX, e.clientY, false);
  };

  const handleTitleTouchStart = (e: React.TouchEvent) => {
    if (settings.mouseMode) return;
    if ((e.target as HTMLElement).closest('button')) return;
    setTitleMenu(null);

    // 2-finger pinch on title bar resizes window proportionally on touch
    if (e.touches.length === 2) {
      if (titleLongPressTimerRef.current) {
        clearTimeout(titleLongPressTimerRef.current);
        titleLongPressTimerRef.current = null;
      }
      e.stopPropagation();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const startDist = Math.max(20, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
      const origW = win.isMaximized ? work.width : win.width;
      const origH = win.isMaximized ? work.height : win.height;
      const centerX = (win.isMaximized ? work.x : win.x) + origW / 2;
      const centerY = (win.isMaximized ? work.y : win.y) + origH / 2;
      setInteractingWindowId(win.instanceId);

      const onPinchMove = (ev: TouchEvent) => {
        if (ev.touches.length < 2) return;
        const d = Math.hypot(
          ev.touches[1].clientX - ev.touches[0].clientX,
          ev.touches[1].clientY - ev.touches[0].clientY
        );
        const ratio = d / startDist;
        const nextW = Math.min(maxW, Math.max(minW, Math.round(origW * ratio)));
        const nextH = Math.min(maxH, Math.max(minH, Math.round(origH * ratio)));
        const nextX = Math.max(work.x, Math.min(work.x + work.width - nextW, Math.round(centerX - nextW / 2)));
        const nextY = Math.max(work.y, Math.min(work.y + work.height - nextH, Math.round(centerY - nextH / 2)));
        updateWindowBounds(win.instanceId, {
          isMaximized: false,
          snapState: 'none',
          x: nextX,
          y: nextY,
          width: nextW,
          height: nextH,
        });
      };

      const onPinchEnd = () => {
        setInteractingWindowId(null);
        window.removeEventListener('touchmove', onPinchMove);
        window.removeEventListener('touchend', onPinchEnd);
        window.removeEventListener('touchcancel', onPinchEnd);
      };

      window.addEventListener('touchmove', onPinchMove, { passive: true });
      window.addEventListener('touchend', onPinchEnd);
      window.addEventListener('touchcancel', onPinchEnd);
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (titleLongPressTimerRef.current) clearTimeout(titleLongPressTimerRef.current);
      titleLongPressTimerRef.current = window.setTimeout(() => {
        dragStateRef.current = null;
        setInteractingWindowId(null);
        openTitleContextMenu(t.clientX, t.clientY);
      }, 480);
      beginMovePointer(t.clientX, t.clientY, true);
    }
  };

  const beginResize = (dir: ResizeDir, startX: number, startY: number, isTouch: boolean) => {
    if (win.isMaximized) return;
    focusWindow(win.instanceId);
    setTitleMenu(null);

    dragStateRef.current = {
      type: 'resize',
      dir,
      startX,
      startY,
      origX: win.x,
      origY: win.y,
      origW: win.width,
      origH: win.height,
    };
    setInteractingWindowId(win.instanceId);

    const applyResize = (clientX: number, clientY: number) => {
      const st = dragStateRef.current;
      if (!st || !st.dir) return;
      const dx = clientX - st.startX;
      const dy = clientY - st.startY;
      let { origX: x, origY: y, origW: w, origH: h } = st;

      if (st.dir.includes('e')) {
        w = Math.min(maxW - (x - work.x), Math.max(minW, st.origW + dx));
      }
      if (st.dir.includes('s')) {
        h = Math.min(maxH - (y - work.y), Math.max(minH, st.origH + dy));
      }
      if (st.dir.includes('w')) {
        const rightEdge = st.origX + st.origW;
        const maxPossibleW = Math.min(maxW, rightEdge - work.x);
        const nextW = Math.min(maxPossibleW, Math.max(minW, st.origW - dx));
        x = rightEdge - nextW;
        w = nextW;
      }
      if (st.dir.includes('n')) {
        const bottomEdge = st.origY + st.origH;
        const maxPossibleH = Math.min(maxH, bottomEdge - work.y);
        const nextH = Math.min(maxPossibleH, Math.max(minH, st.origH - dy));
        y = bottomEdge - nextH;
        h = nextH;
      }

      w = Math.min(maxW, Math.max(minW, w));
      h = Math.min(maxH, Math.max(minH, h));
      x = Math.max(work.x - w + 120, Math.min(work.x + work.width - 120, x));
      y = Math.max(work.y, Math.min(work.y + work.height - 36, y));

      updateWindowBounds(win.instanceId, { x, y, width: w, height: h, snapState: 'none' });
    };

    const endResize = () => {
      dragStateRef.current = null;
      setInteractingWindowId(null);
    };

    if (!isTouch) {
      const onMouseMove = (ev: MouseEvent) => applyResize(ev.clientX, ev.clientY);
      const onMouseUp = () => {
        endResize();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      const onTouchMove = (ev: TouchEvent) => {
        if (ev.touches[0]) applyResize(ev.touches[0].clientX, ev.touches[0].clientY);
      };
      const onTouchEnd = () => {
        endResize();
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('touchcancel', onTouchEnd);
      };
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    }
  };

  const startResizeMouse = (dir: ResizeDir) => (e: React.MouseEvent) => {
    if (e.button !== 0 || win.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    beginResize(dir, e.clientX, e.clientY, false);
  };

  const startResizeTouch = (dir: ResizeDir) => (e: React.TouchEvent) => {
    if (settings.mouseMode || win.isMaximized || e.touches.length !== 1) return;
    e.stopPropagation();
    beginResize(dir, e.touches[0].clientX, e.touches[0].clientY, true);
  };

  const ghostRect = snapGhost ? getSnapGhostRect(snapGhost) : null;

  const clampedX = Math.max(work.x - win.width + 120, Math.min(work.x + work.width - 120, win.x));
  const clampedY = Math.max(work.y, Math.min(work.y + work.height - 36, win.y));
  const clampedW = Math.min(maxW, Math.max(minW, win.width));
  const clampedH = Math.min(maxH, Math.max(minH, win.height));

  return (
    <>
      {ghostRect && (
        <div
          style={{
            zIndex: win.zIndex - 1,
            left: ghostRect.left,
            top: ghostRect.top,
            width: ghostRect.width,
            height: ghostRect.height,
          }}
          className="fixed bg-white/18 border-2 border-white/50 backdrop-blur-md transition-all duration-100 pointer-events-none"
        />
      )}

      <div
        onMouseDown={() => focusWindow(win.instanceId)}
        style={
          win.isMaximized
            ? {
                left: work.x,
                top: work.y,
                width: work.width,
                height: work.height,
                zIndex: win.zIndex,
              }
            : {
                left: clampedX,
                top: clampedY,
                width: clampedW,
                height: clampedH,
                zIndex: win.zIndex,
              }
        }
        className={`fixed flex flex-col bg-white dark:bg-[#1f1f1f] text-neutral-900 dark:text-neutral-100 overflow-visible transition-shadow ${
          isActive
            ? 'border border-neutral-400/75 dark:border-neutral-600 shadow-[0_18px_45px_rgba(0,0,0,0.45)]'
            : 'border border-neutral-300/60 dark:border-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.28)]'
        }`}
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Title Bar */}
          <div
            onMouseDown={handleTitleMouseDown}
            onTouchStart={handleTitleTouchStart}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              focusWindow(win.instanceId);
              openTitleContextMenu(e.clientX, e.clientY);
            }}
            onDoubleClick={() =>
              win.isMaximized ? restoreWindow(win.instanceId) : maximizeWindow(win.instanceId)
            }
            className={`h-8 shrink-0 flex items-center justify-between pl-2.5 select-none touch-none ${
              isActive
                ? 'bg-neutral-100 dark:bg-[#202020] text-neutral-900 dark:text-white'
                : 'bg-neutral-200/90 dark:bg-[#2b2b2b] text-neutral-500 dark:text-neutral-400'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2 pointer-events-none">
              <AppIcon appId={win.appId} size={15} webColor={def?.webColor} />
              <span className="text-xs font-normal truncate">{win.title}</span>
            </div>

            <div className="relative z-40 flex items-center h-full shrink-0">
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
        </div>

        {/* 8-Direction Resize Handles (16px edge hit area, 28px corner hit area) */}
        {!win.isMaximized && (
          <>
            <div
              data-interactive="true"
              data-resize-dir="n"
              onMouseDown={startResizeMouse('n')}
              onTouchStart={startResizeTouch('n')}
              className="absolute -top-2 left-5 right-5 h-4 z-20 cursor-n-resize touch-none"
            />
            <div
              data-interactive="true"
              data-resize-dir="s"
              onMouseDown={startResizeMouse('s')}
              onTouchStart={startResizeTouch('s')}
              className="absolute -bottom-2 left-5 right-5 h-4 z-20 cursor-s-resize touch-none"
            />
            <div
              data-interactive="true"
              data-resize-dir="w"
              onMouseDown={startResizeMouse('w')}
              onTouchStart={startResizeTouch('w')}
              className="absolute top-5 bottom-5 -left-2 w-4 z-20 cursor-w-resize touch-none"
            />
            <div
              data-interactive="true"
              data-resize-dir="e"
              onMouseDown={startResizeMouse('e')}
              onTouchStart={startResizeTouch('e')}
              className="absolute top-5 bottom-5 -right-2 w-4 z-20 cursor-e-resize touch-none"
            />
            <div
              data-interactive="true"
              data-resize-dir="nw"
              onMouseDown={startResizeMouse('nw')}
              onTouchStart={startResizeTouch('nw')}
              className="absolute -top-3 -left-3 w-7 h-7 z-30 cursor-nw-resize touch-none"
            />
            <div
              data-interactive="true"
              data-resize-dir="ne"
              onMouseDown={startResizeMouse('ne')}
              onTouchStart={startResizeTouch('ne')}
              className="absolute -top-3 -right-3 w-7 h-7 z-30 cursor-ne-resize touch-none"
            />
            <div
              data-interactive="true"
              data-resize-dir="sw"
              onMouseDown={startResizeMouse('sw')}
              onTouchStart={startResizeTouch('sw')}
              className="absolute -bottom-3 -left-3 w-7 h-7 z-30 cursor-sw-resize touch-none"
            />
            <div
              data-interactive="true"
              data-resize-dir="se"
              onMouseDown={startResizeMouse('se')}
              onTouchStart={startResizeTouch('se')}
              className="absolute -bottom-3 -right-3 w-7 h-7 z-30 cursor-se-resize touch-none"
            />
          </>
        )}
      </div>

      {/* Title Bar Right-Click / Long-Press Context Menu */}
      {titleMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{ left: titleMenu.x, top: titleMenu.y, zIndex: 9600 }}
          className="fixed w-48 bg-neutral-100/95 dark:bg-neutral-900/95 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 shadow-2xl py-1 text-xs backdrop-blur-xl"
        >
          <button
            onClick={() => applyPresetSize('small')}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            Small
          </button>
          <button
            onClick={() => applyPresetSize('medium')}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            Medium
          </button>
          <button
            onClick={() => applyPresetSize('large')}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            Large
          </button>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
          <button
            onClick={() => {
              snapWindow(win.instanceId, 'left');
              setTitleMenu(null);
            }}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            Snap Left
          </button>
          <button
            onClick={() => {
              snapWindow(win.instanceId, 'right');
              setTitleMenu(null);
            }}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            Snap Right
          </button>
          <button
            onClick={() => {
              snapWindow(win.instanceId, 'top-half');
              setTitleMenu(null);
            }}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            Top Half
          </button>
          <button
            onClick={() => {
              snapWindow(win.instanceId, 'bottom-half');
              setTitleMenu(null);
            }}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            Bottom Half
          </button>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
          <button
            disabled={win.isMaximized}
            onClick={() => {
              maximizeWindow(win.instanceId);
              setTitleMenu(null);
            }}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            Maximize
          </button>
          <button
            disabled={!win.isMaximized && win.snapState === 'none'}
            onClick={() => {
              restoreWindow(win.instanceId);
              setTitleMenu(null);
            }}
            className="w-full px-3.5 py-1.5 text-left hover:bg-[#0078D7] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            Restore
          </button>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
          <button
            onClick={() => {
              setTitleMenu(null);
              closeWindow(win.instanceId);
            }}
            className="w-full px-3.5 py-1.5 text-left text-rose-600 dark:text-rose-400 hover:bg-[#E81123] hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
};
