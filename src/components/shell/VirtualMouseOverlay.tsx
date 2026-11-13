import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { GripHorizontal, Minus, Plus, X } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { EmbeddedWebView, NativeCursorType } from '../../plugins/embeddedWebView';

const INTERACTIVE_SELECTOR =
  'button, a, [role="button"], input, select, textarea, [data-desktop-icon="true"], [data-interactive="true"], [draggable="true"]';

const TEXT_INPUT_SELECTOR =
  'input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="password"], input:not([type]), textarea, [contenteditable="true"]';

function detectCursorType(rawEl: Element, interactiveEl: Element | null): NativeCursorType {
  const resizeEl = rawEl.closest('[data-resize-dir]');
  const resizeDir = resizeEl?.getAttribute('data-resize-dir');
  if (resizeDir === 'n' || resizeDir === 's') return 'resize-ns';
  if (resizeDir === 'e' || resizeDir === 'w') return 'resize-ew';
  if (resizeDir === 'nw' || resizeDir === 'se') return 'resize-nwse';
  if (resizeDir === 'ne' || resizeDir === 'sw') return 'resize-nesw';

  try {
    const computed = window.getComputedStyle(rawEl).cursor;
    if (computed === 'ns-resize' || computed === 'n-resize' || computed === 's-resize') return 'resize-ns';
    if (computed === 'ew-resize' || computed === 'e-resize' || computed === 'w-resize') return 'resize-ew';
    if (computed === 'nwse-resize' || computed === 'nw-resize' || computed === 'se-resize') return 'resize-nwse';
    if (computed === 'nesw-resize' || computed === 'ne-resize' || computed === 'sw-resize') return 'resize-nesw';
    if (computed === 'text') return 'text';
    if (computed === 'pointer') return 'hand';
  } catch {
    // ignore
  }

  if (rawEl.closest(TEXT_INPUT_SELECTOR)) return 'text';
  if (interactiveEl) return 'hand';
  return 'arrow';
}

export const VirtualMouseOverlay: React.FC = () => {
  const { settings, updateSettings, powerPhase } = useOS();
  const isNative = Capacitor.isNativePlatform();
  const isActive = powerPhase === 'desktop' && settings.mouseMode;
  const showPanel = Boolean(settings.showTouchpadPanel);
  const sensitivity = settings.touchpadSensitivity || 1.0;

  const initialPos = () => ({
    x: typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 400,
    y: typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.42) : 300,
  });

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>(initialPos);
  const [cursorStyle, setCursorStyle] = useState<NativeCursorType>('arrow');
  const cursorPosRef = useRef(cursorPos);
  const targetPosRef = useRef(cursorPos);
  const rafIdRef = useRef<number | null>(null);
  const activeDragButtonsRef = useRef(0);
  const lastCursorStyleRef = useRef<NativeCursorType>('arrow');
  const dragTargetWebViewIdRef = useRef<string | null>(null);
  const lastHoverSentRef = useRef(0);

  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const pw = Math.min(340, vw - 16);
    const ph = 186;
    return {
      x: Math.max(8, Math.round((vw - pw) / 2)),
      y: Math.max(8, vh - ph - 58),
    };
  });

  const [isDraggingMouse, setIsDraggingMouse] = useState(false);
  const [clickPulse, setClickPulse] = useState<'left' | 'right' | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [leftBtnPressed, setLeftBtnPressed] = useState(false);

  const hoveredRawRef = useRef<Element | null>(null);
  const hoveredInteractiveRef = useRef<Element | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef(0);

  const stopRaf = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Sync native cursor visibility & touch interceptor cleanly
  useEffect(() => {
    document.documentElement.classList.toggle('vm-cursor-active', isActive);
    if (isActive && typeof window !== 'undefined') {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pw = Math.min(340, vw - 16);
      const ph = 186;
      const next = {
        x: Math.max(16, Math.min(vw - 16, cursorPosRef.current.x || Math.round(vw * 0.5))),
        y: Math.max(16, Math.min(vh - 16, cursorPosRef.current.y || Math.round(vh * 0.42))),
      };
      cursorPosRef.current = next;
      targetPosRef.current = next;
      setCursorPos(next);
      setPanelPos((prev) => ({
        x: Math.max(8, Math.min(vw - pw - 8, prev.x)),
        y: Math.max(8, Math.min(vh - ph - 54, prev.y)),
      }));

      if (isNative) {
        void EmbeddedWebView.setMouseModeTouchIntercept({ enabled: true }).catch(() => {});
        void EmbeddedWebView.showCursor({
          x: next.x,
          y: next.y,
          devicePixelRatio: window.devicePixelRatio || 1,
          type: lastCursorStyleRef.current,
        }).catch(() => {});
      }
    } else if (isNative) {
      void EmbeddedWebView.setMouseModeTouchIntercept({ enabled: false }).catch(() => {});
      void EmbeddedWebView.hideCursor().catch(() => {});
    }

    return () => {
      stopRaf();
      document.documentElement.classList.remove('vm-cursor-active');
      if (hoveredInteractiveRef.current) {
        hoveredInteractiveRef.current.removeAttribute('data-vm-hover');
        hoveredInteractiveRef.current = null;
      }
      hoveredRawRef.current = null;
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
        tooltipTimerRef.current = null;
      }
      if (isNative) {
        void EmbeddedWebView.setMouseModeTouchIntercept({ enabled: false }).catch(() => {});
        void EmbeddedWebView.hideCursor().catch(() => {});
      }
    };
  }, [isActive, isNative, stopRaf]);

  // Clamp cursor and optional panel on viewport resize
  useEffect(() => {
    if (!isActive) return;
    const onResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const clamped = {
        x: Math.max(0, Math.min(vw - 2, targetPosRef.current.x)),
        y: Math.max(0, Math.min(vh - 2, targetPosRef.current.y)),
      };
      targetPosRef.current = clamped;
      cursorPosRef.current = clamped;
      setCursorPos(clamped);
      if (isNative) {
        void EmbeddedWebView.moveCursor({
          x: clamped.x,
          y: clamped.y,
          devicePixelRatio: window.devicePixelRatio || 1,
        }).catch(() => {});
      }

      const pw = Math.min(340, vw - 16);
      setPanelPos((prev) => ({
        x: Math.max(8, Math.min(vw - pw - 8, prev.x)),
        y: Math.max(8, Math.min(vh - 190 - 54, prev.y)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isActive, isNative]);

  const getHitElements = useCallback((x: number, y: number) => {
    const stack = document.elementsFromPoint(x, y);
    const rawEl =
      stack.find((el) => !el.closest('[data-virtual-mouse="true"]')) || document.body;
    const interactiveEl = rawEl.closest(INTERACTIVE_SELECTOR);
    const titledEl = rawEl.closest('[title], [aria-label]');
    const tooltipText =
      titledEl?.getAttribute('title') || titledEl?.getAttribute('aria-label') || '';

    const nativeWebViewId =
      rawEl.getAttribute('data-native-webview-active') === 'true'
        ? rawEl.getAttribute('data-embedded-webview-placeholder')
        : null;

    return { rawEl, interactiveEl, tooltipText, nativeWebViewId };
  }, []);

  const syncHoverAt = useCallback(
    (x: number, y: number, activeButtons = 0) => {
      const { rawEl, interactiveEl, tooltipText, nativeWebViewId } = getHitElements(x, y);
      const prevRaw = hoveredRawRef.current;
      const prevInt = hoveredInteractiveRef.current;

      const nextStyle = detectCursorType(rawEl, interactiveEl);
      if (nextStyle !== lastCursorStyleRef.current) {
        lastCursorStyleRef.current = nextStyle;
        if (!isNative) {
          setCursorStyle(nextStyle);
        } else {
          void EmbeddedWebView.setCursorStyle({ type: nextStyle }).catch(() => {});
        }
      }

      if (prevInt !== interactiveEl) {
        if (prevInt) prevInt.removeAttribute('data-vm-hover');
        if (interactiveEl && !nativeWebViewId) interactiveEl.setAttribute('data-vm-hover', 'true');
        hoveredInteractiveRef.current = interactiveEl;
      }

      if (prevRaw !== rawEl) {
        if (prevRaw) {
          prevRaw.dispatchEvent(
            new MouseEvent('mouseout', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: x,
              clientY: y,
              relatedTarget: rawEl,
            })
          );
          prevRaw.dispatchEvent(
            new MouseEvent('mouseleave', {
              bubbles: false,
              cancelable: false,
              view: window,
              clientX: x,
              clientY: y,
              relatedTarget: rawEl,
            })
          );
        }

        rawEl.dispatchEvent(
          new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            relatedTarget: prevRaw,
          })
        );
        rawEl.dispatchEvent(
          new MouseEvent('mouseenter', {
            bubbles: false,
            cancelable: false,
            view: window,
            clientX: x,
            clientY: y,
            relatedTarget: prevRaw,
          })
        );
        hoveredRawRef.current = rawEl;

        if (tooltipTimerRef.current) {
          clearTimeout(tooltipTimerRef.current);
          tooltipTimerRef.current = null;
        }
        setTooltip(null);
        if (tooltipText && !nativeWebViewId) {
          tooltipTimerRef.current = window.setTimeout(() => {
            setTooltip({ text: tooltipText, x, y });
          }, 280);
        }
      } else {
        setTooltip((t) => (t ? { ...t, x, y } : null));
      }

      // Forward drag move directly to native WebView if drag started inside WebView
      if (isNative && activeButtons > 0 && dragTargetWebViewIdRef.current) {
        void EmbeddedWebView.injectDrag({
          id: dragTargetWebViewIdRef.current,
          phase: 'move',
          x,
          y,
          devicePixelRatio: window.devicePixelRatio || 1,
        }).catch(() => {});
        return;
      }

      // Forward hover move to native WebView so CSS :hover effects work on web pages
      if (isNative && nativeWebViewId && activeButtons === 0) {
        const now = performance.now();
        if (now - lastHoverSentRef.current >= 32) {
          lastHoverSentRef.current = now;
          void EmbeddedWebView.injectHover({
            id: nativeWebViewId,
            x,
            y,
            devicePixelRatio: window.devicePixelRatio || 1,
          }).catch(() => {});
        }
      }

      rawEl.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          buttons: activeButtons,
        })
      );
      if (activeButtons > 0) {
        window.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: false,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            buttons: activeButtons,
          })
        );
      }
    },
    [getHitElements, isNative]
  );

  // Smooth cursor glide via requestAnimationFrame
  const stepCursorAnimation = useCallback(() => {
    const cur = cursorPosRef.current;
    const tgt = targetPosRef.current;
    const diffX = tgt.x - cur.x;
    const diffY = tgt.y - cur.y;
    const dist = Math.hypot(diffX, diffY);

    if (dist <= 0.35) {
      cursorPosRef.current = { x: tgt.x, y: tgt.y };
      if (!isNative) setCursorPos(cursorPosRef.current);
      if (isNative) {
        void EmbeddedWebView.moveCursor({
          x: tgt.x,
          y: tgt.y,
          devicePixelRatio: window.devicePixelRatio || 1,
        }).catch(() => {});
      }
      syncHoverAt(tgt.x, tgt.y, activeDragButtonsRef.current);
      rafIdRef.current = null;
      return;
    }

    const smoothFactor = 0.5;
    const nx = cur.x + diffX * smoothFactor;
    const ny = cur.y + diffY * smoothFactor;
    cursorPosRef.current = { x: nx, y: ny };
    if (!isNative) setCursorPos(cursorPosRef.current);
    if (isNative) {
      void EmbeddedWebView.moveCursor({
        x: nx,
        y: ny,
        devicePixelRatio: window.devicePixelRatio || 1,
      }).catch(() => {});
    }
    syncHoverAt(nx, ny, activeDragButtonsRef.current);
    rafIdRef.current = requestAnimationFrame(stepCursorAnimation);
  }, [isNative, syncHoverAt]);

  const flushCursorToTarget = useCallback(() => {
    stopRaf();
    const tgt = targetPosRef.current;
    cursorPosRef.current = tgt;
    if (!isNative) setCursorPos(tgt);
    if (isNative) {
      void EmbeddedWebView.moveCursor({
        x: tgt.x,
        y: tgt.y,
        devicePixelRatio: window.devicePixelRatio || 1,
      }).catch(() => {});
    }
    return tgt;
  }, [isNative, stopRaf]);

  const moveCursorBy = useCallback(
    (dx: number, dy: number, activeButtons = 0) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      activeDragButtonsRef.current = activeButtons;
      targetPosRef.current = {
        x: Math.max(0, Math.min(vw - 2, targetPosRef.current.x + dx * sensitivity)),
        y: Math.max(0, Math.min(vh - 2, targetPosRef.current.y + dy * sensitivity)),
      };
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(stepCursorAnimation);
      }
      return targetPosRef.current;
    },
    [sensitivity, stepCursorAnimation]
  );

  const triggerPulse = useCallback((kind: 'left' | 'right') => {
    if (isNative) return;
    setClickPulse(kind);
    window.setTimeout(() => setClickPulse(null), 220);
  }, [isNative]);

  const dispatchMouseDown = useCallback(
    (button: 0 | 2, detail = 1) => {
      const { x, y } = flushCursorToTarget();
      const { rawEl, nativeWebViewId } = getHitElements(x, y);
      const buttons = button === 0 ? 1 : 2;
      activeDragButtonsRef.current = buttons;

      if (isNative && nativeWebViewId && button === 0) {
        dragTargetWebViewIdRef.current = nativeWebViewId;
        void EmbeddedWebView.injectDrag({
          id: nativeWebViewId,
          phase: 'start',
          x,
          y,
          devicePixelRatio: window.devicePixelRatio || 1,
        }).catch(() => {});
        return rawEl;
      }

      dragTargetWebViewIdRef.current = null;
      rawEl.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          button,
          buttons,
          detail,
        })
      );
      return rawEl;
    },
    [flushCursorToTarget, getHitElements, isNative]
  );

  const dispatchLeftUpAndClick = useCallback(
    (emitClick: boolean, detail = 1) => {
      const { x, y } = flushCursorToTarget();
      activeDragButtonsRef.current = 0;

      if (isNative && dragTargetWebViewIdRef.current) {
        const targetId = dragTargetWebViewIdRef.current;
        dragTargetWebViewIdRef.current = null;
        void EmbeddedWebView.injectDrag({
          id: targetId,
          phase: 'end',
          x,
          y,
          devicePixelRatio: window.devicePixelRatio || 1,
        }).catch(() => {});
        syncHoverAt(x, y, 0);
        return;
      }

      dragTargetWebViewIdRef.current = null;
      const { rawEl } = getHitElements(x, y);
      const init: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 0,
        detail,
      };
      rawEl.dispatchEvent(new MouseEvent('mouseup', init));
      window.dispatchEvent(new MouseEvent('mouseup', { ...init, bubbles: false }));
      if (emitClick) {
        rawEl.dispatchEvent(new MouseEvent('click', init));
        if (detail >= 2) {
          rawEl.dispatchEvent(new MouseEvent('dblclick', init));
        }
        const focusTarget = rawEl.closest(
          'input, textarea, select, [contenteditable="true"], [tabindex]'
        ) as HTMLElement | null;
        if (focusTarget && typeof focusTarget.focus === 'function') {
          focusTarget.focus();
        }
      }
      triggerPulse('left');
      syncHoverAt(x, y, 0);
    },
    [flushCursorToTarget, getHitElements, isNative, syncHoverAt, triggerPulse]
  );

  const dispatchLeftClick = useCallback(
    (detail = 1) => {
      const { x, y } = flushCursorToTarget();
      const { nativeWebViewId } = getHitElements(x, y);
      if (isNative && nativeWebViewId) {
        if (detail >= 2) {
          void EmbeddedWebView.injectDoubleTap({
            id: nativeWebViewId,
            x,
            y,
            devicePixelRatio: window.devicePixelRatio || 1,
          }).catch(() => {});
        } else {
          void EmbeddedWebView.injectTap({
            id: nativeWebViewId,
            x,
            y,
            devicePixelRatio: window.devicePixelRatio || 1,
          }).catch(() => {});
        }
        return;
      }
      dispatchMouseDown(0, detail);
      dispatchLeftUpAndClick(true, detail);
    },
    [dispatchLeftUpAndClick, dispatchMouseDown, flushCursorToTarget, getHitElements, isNative]
  );

  const dispatchRightClick = useCallback(() => {
    const { x, y } = flushCursorToTarget();
    activeDragButtonsRef.current = 0;
    const { rawEl, nativeWebViewId } = getHitElements(x, y);

    if (isNative && nativeWebViewId) {
      void EmbeddedWebView.injectLongPress({
        id: nativeWebViewId,
        x,
        y,
        devicePixelRatio: window.devicePixelRatio || 1,
      }).catch(() => {});
      return;
    }

    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 2,
      buttons: 0,
    };
    rawEl.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 2 }));
    rawEl.dispatchEvent(new MouseEvent('mouseup', init));
    rawEl.dispatchEvent(new MouseEvent('contextmenu', init));
    triggerPulse('right');
    syncHoverAt(x, y, 0);
  }, [flushCursorToTarget, getHitElements, isNative, syncHoverAt, triggerPulse]);

  const scrollAtCursor = useCallback(
    (dx: number, dy: number) => {
      const { x, y } = cursorPosRef.current;
      const { rawEl, nativeWebViewId } = getHitElements(x, y);

      if (isNative && nativeWebViewId) {
        void EmbeddedWebView.injectScroll({
          id: nativeWebViewId,
          dx: dx * sensitivity,
          dy: dy * sensitivity,
          x,
          y,
          devicePixelRatio: window.devicePixelRatio || 1,
        }).catch(() => {});
        return;
      }

      let cur: HTMLElement | null = rawEl as HTMLElement;
      const scrollYDelta = -dy * sensitivity * 1.5;
      const scrollXDelta = -dx * sensitivity * 1.5;
      while (cur) {
        const style = window.getComputedStyle(cur);
        const canY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
          cur.scrollHeight > cur.clientHeight;
        const canX =
          (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay') &&
          cur.scrollWidth > cur.clientWidth;
        if (canY || canX) {
          if (canY) cur.scrollTop += scrollYDelta;
          if (canX) cur.scrollLeft += scrollXDelta;
          break;
        }
        cur = cur.parentElement;
      }
      rawEl.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          deltaY: scrollYDelta,
          deltaX: scrollXDelta,
        })
      );
      syncHoverAt(x, y, 0);
    },
    [getHitElements, isNative, sensitivity, syncHoverAt]
  );

  // Gesture state refs shared by invisible full-screen touchpad or optional floating panel
  const gestureRef = useRef<{
    fingers: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastDist: number;
    totalMove: number;
    startTime: number;
    longPressTimer: number | null;
    longPressFired: boolean;
    draggingFromTapHold: boolean;
    dragMouseDownSent: boolean;
    twoFingerMoved: boolean;
    pendingDragCandidate: boolean;
    startedOnToggle: boolean;
  } | null>(null);
  const lastTapTimeRef = useRef(0);
  const leftBtnHoldRef = useRef(false);

  const clearLongPress = () => {
    if (gestureRef.current?.longPressTimer) {
      clearTimeout(gestureRef.current.longPressTimer);
      gestureRef.current.longPressTimer = null;
    }
  };

  const isPointOnModeToggle = (clientX: number, clientY: number) => {
    return document
      .elementsFromPoint(clientX, clientY)
      .some((el) => Boolean(el.closest('[data-mouse-mode-toggle="true"]')));
  };

  // Touchpad Touch Events
  const handlePadTouchStart = (e: React.TouchEvent, checkDirectToggle: boolean) => {
    e.stopPropagation();
    lastTouchTimeRef.current = Date.now();
    clearLongPress();

    const touches = e.targetTouches;
    if (touches.length === 1) {
      const t = touches[0];
      const now = Date.now();
      const sinceLastTap = now - lastTapTimeRef.current;
      const isSecondQuickTouch = sinceLastTap > 20 && sinceLastTap < 360;
      const onToggle = checkDirectToggle && isPointOnModeToggle(t.clientX, t.clientY);

      const timer = window.setTimeout(() => {
        if (
          gestureRef.current &&
          gestureRef.current.fingers === 1 &&
          gestureRef.current.totalMove < 8 &&
          !gestureRef.current.draggingFromTapHold &&
          !leftBtnHoldRef.current &&
          !gestureRef.current.startedOnToggle
        ) {
          gestureRef.current.longPressFired = true;
          dispatchRightClick();
        }
      }, 480);

      gestureRef.current = {
        fingers: 1,
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastY: t.clientY,
        lastDist: 0,
        totalMove: 0,
        startTime: now,
        longPressTimer: timer,
        longPressFired: false,
        draggingFromTapHold: false,
        dragMouseDownSent: false,
        twoFingerMoved: false,
        pendingDragCandidate: isSecondQuickTouch && !leftBtnHoldRef.current && !onToggle,
        startedOnToggle: onToggle,
      };
    } else if (touches.length >= 2) {
      const cx = (touches[0].clientX + touches[1].clientX) / 2;
      const cy = (touches[0].clientY + touches[1].clientY) / 2;
      const dist = Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
      gestureRef.current = {
        fingers: 2,
        startX: cx,
        startY: cy,
        lastX: cx,
        lastY: cy,
        lastDist: dist,
        totalMove: 0,
        startTime: Date.now(),
        longPressTimer: null,
        longPressFired: false,
        draggingFromTapHold: false,
        dragMouseDownSent: false,
        twoFingerMoved: false,
        pendingDragCandidate: false,
        startedOnToggle: false,
      };
    }
  };

  const handlePadTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    lastTouchTimeRef.current = Date.now();
    const g = gestureRef.current;
    if (!g) return;

    const touches = e.targetTouches;
    if (touches.length >= 2) {
      clearLongPress();
      const cx = (touches[0].clientX + touches[1].clientX) / 2;
      const cy = (touches[0].clientY + touches[1].clientY) / 2;
      const dist = Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);

      if (g.fingers < 2) {
        g.fingers = 2;
        g.startX = cx;
        g.startY = cy;
        g.lastX = cx;
        g.lastY = cy;
        g.lastDist = dist;
        g.totalMove = 0;
        return;
      }

      const dx = cx - g.lastX;
      const dy = cy - g.lastY;
      const distRatio = g.lastDist > 12 ? dist / g.lastDist : 1;
      const isPinch = Math.abs(dist - g.lastDist) > 6 && Math.abs(distRatio - 1) > 0.04;

      g.totalMove += Math.hypot(dx, dy) + Math.abs(dist - g.lastDist);
      g.lastX = cx;
      g.lastY = cy;
      if (g.totalMove > 6) {
        g.twoFingerMoved = true;
      }

      if (isPinch && isNative) {
        g.lastDist = dist;
        const { x, y } = cursorPosRef.current;
        const { nativeWebViewId } = getHitElements(x, y);
        if (nativeWebViewId) {
          void EmbeddedWebView.injectPinch({
            id: nativeWebViewId,
            scaleDelta: distRatio,
            x,
            y,
            devicePixelRatio: window.devicePixelRatio || 1,
          }).catch(() => {});
        }
        return;
      }

      if (!isPinch) {
        g.lastDist = dist;
        scrollAtCursor(dx, dy);
      }
      return;
    }

    if (touches.length === 1 && g.fingers === 1) {
      const t = touches[0];
      const dx = t.clientX - g.lastX;
      const dy = t.clientY - g.lastY;
      g.totalMove += Math.hypot(dx, dy);
      g.lastX = t.clientX;
      g.lastY = t.clientY;

      if (g.totalMove > 6) {
        clearLongPress();
        if (g.pendingDragCandidate && !g.dragMouseDownSent) {
          g.draggingFromTapHold = true;
          g.dragMouseDownSent = true;
          setIsDraggingMouse(true);
          dispatchMouseDown(0, 1);
        }
      }

      if (!g.longPressFired) {
        const activeBtns = g.dragMouseDownSent || leftBtnHoldRef.current ? 1 : 0;
        moveCursorBy(dx, dy, activeBtns);
      }
    }
  };

  const handlePadTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    lastTouchTimeRef.current = Date.now();
    const g = gestureRef.current;
    if (!g) return;
    clearLongPress();

    const touches = e.targetTouches;
    if (touches.length > 0) {
      if (g.fingers >= 2 && !g.twoFingerMoved && g.totalMove < 14 && Date.now() - g.startTime < 360) {
        dispatchRightClick();
        g.longPressFired = true;
      }
      const rem = touches[0];
      g.lastX = rem.clientX;
      g.lastY = rem.clientY;
      return;
    }

    const dur = Date.now() - g.startTime;

    if (g.dragMouseDownSent) {
      setIsDraggingMouse(false);
      dispatchLeftUpAndClick(false);
      gestureRef.current = null;
      return;
    }

    if (leftBtnHoldRef.current) {
      gestureRef.current = null;
      return;
    }

    if (g.fingers >= 2) {
      if (!g.longPressFired && !g.twoFingerMoved && g.totalMove < 14 && dur < 360) {
        dispatchRightClick();
      }
      gestureRef.current = null;
      return;
    }

    if (!g.longPressFired && g.totalMove < 8 && dur < 300) {
      if (g.startedOnToggle) {
        updateSettings({ mouseMode: false });
        gestureRef.current = null;
        return;
      }
      const now = Date.now();
      const isDoubleTap = now - lastTapTimeRef.current < 360;
      if (isDoubleTap) {
        lastTapTimeRef.current = 0;
        dispatchLeftClick(2);
      } else {
        lastTapTimeRef.current = now;
        dispatchLeftClick(1);
      }
    }
    gestureRef.current = null;
  };

  // Mouse fallback (respects e.isTrusted so our own synthetic MouseEvents never re-enter)
  const handlePadMouseDown = (e: React.MouseEvent, checkDirectToggle: boolean) => {
    if (!e.nativeEvent.isTrusted) return;
    e.stopPropagation();
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    if (e.button === 2) {
      e.preventDefault();
      dispatchRightClick();
      return;
    }
    if (e.button !== 0) return;

    const now = Date.now();
    const isSecondQuickClick = now - lastTapTimeRef.current < 360;
    const onToggle = checkDirectToggle && isPointOnModeToggle(e.clientX, e.clientY);
    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = startX;
    let lastY = startY;
    let totalMove = 0;
    let dragSent = false;
    let longFired = false;

    const lpTimer = window.setTimeout(() => {
      if (totalMove < 6 && !dragSent && !onToggle) {
        longFired = true;
        dispatchRightClick();
      }
    }, 500);

    const onMove = (ev: MouseEvent) => {
      if (!ev.isTrusted) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      totalMove += Math.hypot(dx, dy);
      lastX = ev.clientX;
      lastY = ev.clientY;

      if (totalMove > 5) {
        clearTimeout(lpTimer);
        if (isSecondQuickClick && !dragSent && !onToggle) {
          dragSent = true;
          setIsDraggingMouse(true);
          dispatchMouseDown(0, 1);
        }
      }
      if (!longFired) {
        moveCursorBy(dx, dy, dragSent || leftBtnHoldRef.current ? 1 : 0);
      }
    };

    const onUp = (ev: MouseEvent) => {
      if (!ev.isTrusted) return;
      clearTimeout(lpTimer);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (dragSent) {
        setIsDraggingMouse(false);
        dispatchLeftUpAndClick(false);
        return;
      }
      const dur = Date.now() - now;
      if (!longFired && totalMove < 6 && dur < 320) {
        if (onToggle) {
          updateSettings({ mouseMode: false });
          return;
        }
        if (isSecondQuickClick) {
          lastTapTimeRef.current = 0;
          dispatchLeftClick(2);
        } else {
          lastTapTimeRef.current = Date.now();
          dispatchLeftClick(1);
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Draggable Optional Touchpad Panel Handle
  const startPanelDrag = (clientX: number, clientY: number) => {
    const startX = clientX;
    const startY = clientY;
    const origX = panelPos.x;
    const origY = panelPos.y;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = Math.min(340, vw - 16);

    const onMove = (cx: number, cy: number) => {
      setPanelPos({
        x: Math.max(4, Math.min(vw - pw - 4, origX + (cx - startX))),
        y: Math.max(4, Math.min(vh - 190 - 4, origY + (cy - startY))),
      });
    };

    const onMouseMove = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches[0]) onMove(ev.touches[0].clientX, ev.touches[0].clientY);
    };
    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', cleanup);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', cleanup);
      window.removeEventListener('touchcancel', cleanup);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', cleanup);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', cleanup);
    window.addEventListener('touchcancel', cleanup);
  };

  // Optional Panel Left Click Button
  const lastLeftBtnClickRef = useRef(0);
  const handleLeftButtonDown = (e: React.TouchEvent | React.MouseEvent, isTouch: boolean) => {
    e.stopPropagation();
    if (!isTouch && Date.now() - lastTouchTimeRef.current < 500) return;
    if (isTouch) lastTouchTimeRef.current = Date.now();
    if (!isTouch && (e as React.MouseEvent).button !== 0) return;

    leftBtnHoldRef.current = true;
    setLeftBtnPressed(true);
    setIsDraggingMouse(true);
    const now = Date.now();
    const isDbl = now - lastLeftBtnClickRef.current < 340;
    dispatchMouseDown(0, isDbl ? 2 : 1);

    const release = () => {
      if (!leftBtnHoldRef.current) return;
      leftBtnHoldRef.current = false;
      setLeftBtnPressed(false);
      setIsDraggingMouse(false);
      dispatchLeftUpAndClick(true, isDbl ? 2 : 1);
      lastLeftBtnClickRef.current = isDbl ? 0 : Date.now();
      window.removeEventListener('mouseup', release);
      window.removeEventListener('touchend', release);
      window.removeEventListener('touchcancel', release);
    };
    window.addEventListener('mouseup', release);
    window.addEventListener('touchend', release);
    window.addEventListener('touchcancel', release);
  };

  if (!isActive) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const panelWidth = Math.min(340, vw - 16);

  return (
    <>
      {/* Default Invisible Full-Screen Touchpad Layer */}
      {!showPanel && (
        <div
          data-virtual-mouse="true"
          onTouchStart={(e) => handlePadTouchStart(e, true)}
          onTouchMove={handlePadTouchMove}
          onTouchEnd={handlePadTouchEnd}
          onTouchCancel={handlePadTouchEnd}
          onMouseDown={(e) => handlePadMouseDown(e, true)}
          onContextMenu={(e) => {
            if (e.nativeEvent.isTrusted) {
              e.preventDefault();
            }
          }}
          className="fixed inset-0 z-[9990] bg-transparent touch-none cursor-none select-none"
        />
      )}

      {/* Web Preview Only: DOM Cursor (hidden on native Android where always-on-top native cursor renders) */}
      {!isNative && (
        <div
          data-virtual-mouse="true"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
          }}
          className="pointer-events-none fixed z-[9997] select-none"
        >
          {(clickPulse || isDraggingMouse) && (
            <div
              style={{
                borderColor:
                  clickPulse === 'right' ? '#f59e0b' : settings.accentColor,
              }}
              className="absolute -left-2.5 -top-2.5 w-6 h-6 rounded-full border-2 opacity-80 animate-ping"
            />
          )}
          {cursorStyle === 'arrow' || cursorStyle === 'hand' || cursorStyle === 'text' ? (
            <svg
              width="22"
              height="26"
              viewBox="0 0 22 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="-translate-x-[1.5px] -translate-y-[1.5px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]"
            >
              {cursorStyle === 'text' ? (
                <path
                  d="M7 3H15M11 3V21M7 21H15"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M1.5 1.5L1.5 21.2L6.6 16.4L10.2 24.1L13.1 22.8L9.5 15.1L16.5 15.1L1.5 1.5Z"
                  fill={isDraggingMouse ? '#E5F3FF' : '#FFFFFF'}
                  stroke="#111111"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              )}
              {cursorStyle === 'text' && (
                <path
                  d="M7 3H15M11 3V21M7 21H15"
                  stroke="#111111"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="-translate-x-3 -translate-y-3 drop-shadow-[0_2px_3px_rgba(0,0,0,0.65)]"
              style={{
                transform:
                  cursorStyle === 'resize-ns'
                    ? 'translate(-12px, -12px) rotate(90deg)'
                    : cursorStyle === 'resize-nwse'
                    ? 'translate(-12px, -12px) rotate(45deg)'
                    : cursorStyle === 'resize-nesw'
                    ? 'translate(-12px, -12px) rotate(-45deg)'
                    : 'translate(-12px, -12px)',
              }}
            >
              <path
                d="M2 12L7 7.5V10.5H17V7.5L22 12L17 16.5V13.5H7V16.5L2 12Z"
                fill="#FFFFFF"
                stroke="#111111"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}

      {/* Virtual Mouse Hover Tooltip */}
      {tooltip && (
        <div
          data-virtual-mouse="true"
          style={{
            left: Math.min(vw - 180, cursorPos.x + 14),
            top: Math.min(vh - 68, cursorPos.y + 22),
          }}
          className="pointer-events-none fixed z-[9996] max-w-[200px] truncate px-2 py-0.5 text-[11px] bg-[#2b2b2b] text-white border border-neutral-600 shadow-lg"
        >
          {tooltip.text}
        </div>
      )}

      {/* Optional Floating Touchpad Panel */}
      {showPanel && (
        <div
          data-virtual-mouse="true"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            left: panelPos.x,
            top: panelPos.y,
            width: panelWidth,
          }}
          className="fixed z-[9995] flex flex-col bg-[#1b1b1d]/92 text-white border border-white/20 shadow-[0_14px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl select-none"
        >
          <div
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              e.preventDefault();
              startPanelDrag(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              if (e.touches[0]) {
                startPanelDrag(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            className="h-8 px-2.5 flex items-center justify-between bg-white/8 border-b border-white/10 cursor-move touch-none"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-200">
              <GripHorizontal className="w-3.5 h-3.5 opacity-75" />
              <span>Touchpad</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  updateSettings({
                    touchpadSensitivity: Math.max(0.5, Number((sensitivity - 0.2).toFixed(1))),
                  })
                }
                className="w-5 h-5 flex items-center justify-center hover:bg-white/15 text-neutral-300 cursor-pointer"
                title="Decrease sensitivity"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-mono text-neutral-300 w-7 text-center tabular-nums">
                {sensitivity.toFixed(1)}x
              </span>
              <button
                onClick={() =>
                  updateSettings({
                    touchpadSensitivity: Math.min(3.0, Number((sensitivity + 0.2).toFixed(1))),
                  })
                }
                className="w-5 h-5 flex items-center justify-center hover:bg-white/15 text-neutral-300 cursor-pointer"
                title="Increase sensitivity"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => updateSettings({ showTouchpadPanel: false })}
                className="w-6 h-5 ml-1 flex items-center justify-center hover:bg-[#E81123] text-neutral-200 cursor-pointer"
                title="Hide touchpad panel (use full-screen invisible touchpad)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            onTouchStart={(e) => handlePadTouchStart(e, false)}
            onTouchMove={handlePadTouchMove}
            onTouchEnd={handlePadTouchEnd}
            onTouchCancel={handlePadTouchEnd}
            onMouseDown={(e) => handlePadMouseDown(e, false)}
            className="h-28 w-full touch-none relative flex flex-col items-center justify-center bg-gradient-to-b from-white/[0.04] to-black/25 active:bg-white/[0.07] cursor-crosshair"
          >
            <span className="text-[10px] text-neutral-400 pointer-events-none text-center px-3 leading-snug">
              Slide to move · Tap = Click · 2x Tap = Double Click
              <br />
              Tap-hold &amp; drag = Drag/Select · 2-finger/Hold = Right-click · 2-finger drag = Scroll
            </span>
          </div>

          <div className="grid grid-cols-2 border-t border-white/15 h-10 bg-black/30">
            <button
              onTouchStart={(e) => handleLeftButtonDown(e, true)}
              onMouseDown={(e) => handleLeftButtonDown(e, false)}
              className={`border-r border-white/15 text-xs font-medium flex items-center justify-center transition-colors cursor-pointer touch-none ${
                leftBtnPressed
                  ? 'bg-[#0078D7] text-white'
                  : 'hover:bg-white/10 active:bg-[#0078D7] text-neutral-200'
              }`}
            >
              Left Click
            </button>
            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                lastTouchTimeRef.current = Date.now();
                dispatchRightClick();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (Date.now() - lastTouchTimeRef.current < 500) return;
                dispatchRightClick();
              }}
              className="text-xs font-medium flex items-center justify-center hover:bg-white/10 active:bg-[#0078D7] text-neutral-200 transition-colors cursor-pointer touch-none"
            >
              Right Click
            </button>
          </div>
        </div>
      )}
    </>
  );
};
