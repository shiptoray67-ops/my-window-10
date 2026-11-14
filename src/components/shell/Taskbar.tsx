import React, { useEffect, useState } from 'react';
import {
  BatteryCharging,
  Crosshair,
  Download,
  Layers,
  MessageSquare,
  MousePointer2,
  Search,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { AppId } from '../../types/os';
import { AppIcon, WindowsLogo } from '../icons/WinIcons';

export const Taskbar: React.FC = () => {
  const {
    settings,
    updateSettings,
    windows,
    activeWindowId,
    openApp,
    focusWindow,
    minimizeWindow,
    closeWindow,
    startMenuOpen,
    setStartMenuOpen,
    searchQuery,
    setSearchQuery,
    actionCenterOpen,
    setActionCenterOpen,
    taskViewOpen,
    setTaskViewOpen,
    activeFlyout,
    setActiveFlyout,
    notifications,
    markNotificationsRead,
    toggleShowDesktop,
    getAppDefinition,
    isMobile,
    appUpdateInfo,
    taskbarSizePx,
    focusModeWindowId,
    focusTaskbarRevealed,
    setFocusTaskbarRevealed,
  } = useOS();

  const [now, setNow] = useState(new Date());
  const [hoveredAppId, setHoveredAppId] = useState<AppId | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // In Focus Mode, auto-reveal taskbar when cursor/pointer/touch reaches bottom 10px, and hide again when leaving upward
  useEffect(() => {
    if (!focusModeWindowId) return;

    const checkEdgeReveal = (clientY: number) => {
      const vh = window.innerHeight;
      if (clientY >= vh - 10) {
        setFocusTaskbarRevealed(true);
      } else if (
        focusTaskbarRevealed &&
        !startMenuOpen &&
        !actionCenterOpen &&
        !activeFlyout &&
        clientY < vh - taskbarSizePx - 28
      ) {
        setFocusTaskbarRevealed(false);
      }
    };

    const onMouseMove = (e: MouseEvent) => checkEdgeReveal(e.clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) checkEdgeReveal(e.touches[0].clientY);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
    };
  }, [
    actionCenterOpen,
    activeFlyout,
    focusModeWindowId,
    focusTaskbarRevealed,
    setFocusTaskbarRevealed,
    startMenuOpen,
    taskbarSizePx,
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Combine pinned apps and any unpinned running apps
  const taskbarAppIds: AppId[] = [...settings.pinnedTaskbarApps];
  windows.forEach((w) => {
    if (!taskbarAppIds.includes(w.appId)) {
      taskbarAppIds.push(w.appId);
    }
  });

  const handleAppButtonClick = (appId: AppId) => {
    const appWindows = windows.filter((w) => w.appId === appId);
    if (appWindows.length === 0) {
      openApp(appId);
      return;
    }
    const topWin = [...appWindows].sort((a, b) => b.zIndex - a.zIndex)[0];
    if (topWin.instanceId === activeWindowId && !topWin.isMinimized) {
      minimizeWindow(topWin.instanceId);
    } else {
      focusWindow(topWin.instanceId);
    }
  };

  const triggerResetCursor = () => {
    window.dispatchEvent(new CustomEvent('win10-reset-cursor'));
  };

  const isCompact = settings.uiSize === 'compact';
  const uiScale = (settings.resolutionScale || 100) / 100;
  const iconSize = Math.round((isCompact ? 19 : settings.uiSize === 'large' ? 24 : 21) * uiScale);
  const isVertical = !isMobile && (settings.taskbarPosition === 'left' || settings.taskbarPosition === 'right');

  const isHiddenForFocus = Boolean(focusModeWindowId) && !focusTaskbarRevealed && !startMenuOpen && !actionCenterOpen && !activeFlyout;

  const posClasses = isMobile
    ? 'bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] flex-row'
    : settings.taskbarPosition === 'top'
    ? 'top-0 left-0 right-0 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] flex-row'
    : settings.taskbarPosition === 'left'
    ? 'top-0 bottom-0 left-0 pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] flex-col'
    : settings.taskbarPosition === 'right'
    ? 'top-0 bottom-0 right-0 pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] flex-col'
    : 'bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] flex-row';

  const sizeStyle: React.CSSProperties = isVertical
    ? { width: `calc(${taskbarSizePx}px + env(safe-area-inset-left))` }
    : { height: `calc(${taskbarSizePx}px + env(safe-area-inset-bottom))` };

  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !settings.use24HourClock,
  });
  const dateStr = now.toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      {/* Focus Mode bottom-edge trigger strip */}
      {focusModeWindowId && isHiddenForFocus && (
        <div
          data-interactive="true"
          onMouseEnter={() => setFocusTaskbarRevealed(true)}
          onClick={() => setFocusTaskbarRevealed(true)}
          onTouchStart={() => setFocusTaskbarRevealed(true)}
          className="fixed bottom-0 left-0 right-0 h-2.5 z-[9350] bg-transparent cursor-pointer"
          title="Move cursor or touch bottom edge to show Taskbar"
        />
      )}

      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={sizeStyle}
        className={`fixed ${posClasses} z-[9300] flex items-center justify-between fluent-acrylic-light dark:fluent-acrylic-dark border-t border-neutral-300/60 dark:border-white/10 text-neutral-900 dark:text-white select-none transition-transform duration-150 ${
          isHiddenForFocus ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Left / Top Section: Start, Search, Task View, App Icons */}
        <div className={`flex items-center min-w-0 ${isVertical ? 'flex-col w-full' : 'flex-row h-full flex-1'}`}>
          {/* Start Button (>= 44px touch target width) */}
          <button
            onClick={() => {
              setActionCenterOpen(false);
              setActiveFlyout(null);
              setStartMenuOpen((o) => !o);
            }}
            className={`${
              isVertical ? 'w-full h-11' : 'min-w-[44px] w-11 h-full'
            } flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer ${
              startMenuOpen ? 'bg-black/10 dark:bg-white/15' : ''
            }`}
            title="Start (Ctrl+Esc)"
          >
            <WindowsLogo className="w-[18px] h-[18px] text-[#0078D7] dark:text-white" />
          </button>

          {/* Search Input (hidden on compact / mobile landscape phones to leave room for apps) */}
          {!isMobile && !isVertical && !isCompact && (
            <div className="relative hidden md:flex items-center h-full w-44 lg:w-64 bg-white/90 dark:bg-neutral-800/90 border-x border-neutral-200/70 dark:border-white/10 px-3 shrink-0">
              <Search className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setStartMenuOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!startMenuOpen) setStartMenuOpen(true);
                }}
                placeholder="Type here to search"
                className="w-full bg-transparent text-xs outline-none text-neutral-900 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
              />
            </div>
          )}

          {/* Task View Button */}
          <button
            onClick={() => {
              setStartMenuOpen(false);
              setActionCenterOpen(false);
              setTaskViewOpen((o) => !o);
            }}
            className={`${
              isVertical ? 'w-full h-10' : 'min-w-[40px] w-10 h-full'
            } flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer ${
              taskViewOpen ? 'bg-black/10 dark:bg-white/15' : ''
            }`}
            title="Task View (Alt+Tab)"
          >
            <Layers className="w-4 h-4 opacity-80" />
          </button>

          {/* Pinned & Running App Buttons */}
          <div
            className={`flex items-center overflow-x-auto no-scrollbar ${
              isVertical ? 'flex-col w-full gap-0.5' : 'flex-row h-full gap-0.5 px-1'
            }`}
          >
            {taskbarAppIds.map((appId) => {
              const def = getAppDefinition(appId);
              if (!def) return null;
              const appWins = windows.filter((w) => w.appId === appId);
              const isRunning = appWins.length > 0;
              const isActive = appWins.some((w) => w.instanceId === activeWindowId && !w.isMinimized);

              return (
                <div
                  key={appId}
                  onMouseEnter={() => !isMobile && isRunning && setHoveredAppId(appId)}
                  onMouseLeave={() => setHoveredAppId((cur) => (cur === appId ? null : cur))}
                  className={`relative ${isVertical ? 'w-full h-11' : 'min-w-[44px] w-11 h-full'} shrink-0`}
                >
                  <button
                    onClick={() => handleAppButtonClick(appId)}
                    className={`w-full h-full flex items-center justify-center transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-black/12 dark:bg-white/18'
                        : 'hover:bg-black/8 dark:hover:bg-white/10'
                    }`}
                    title={def.title}
                  >
                    <AppIcon appId={appId} size={iconSize} webColor={def.webColor} />
                  </button>

                  {isRunning && (
                    <div
                      style={{ backgroundColor: settings.accentColor }}
                      className={`absolute ${
                        isVertical
                          ? 'left-0 top-2 bottom-2 w-[3px]'
                          : isActive
                          ? 'bottom-0 left-1 right-1 h-[2.5px]'
                          : 'bottom-0 left-3 right-3 h-[2.5px] opacity-80'
                      }`}
                    />
                  )}

                  {hoveredAppId === appId && appWins.length > 0 && !isVertical && (
                    <div
                      className={`absolute ${
                        settings.taskbarPosition === 'top' ? 'top-12' : 'bottom-12'
                      } left-1/2 -translate-x-1/2 z-[9500] flex gap-2 p-2 bg-neutral-100/95 dark:bg-neutral-900/95 border border-neutral-300 dark:border-neutral-700 shadow-2xl backdrop-blur-xl`}
                    >
                      {appWins.map((w) => (
                        <div
                          key={w.instanceId}
                          onClick={() => {
                            focusWindow(w.instanceId);
                            setHoveredAppId(null);
                          }}
                          className="w-44 p-2 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <AppIcon appId={w.appId} size={13} webColor={def.webColor} />
                              <span className="text-[11px] font-medium truncate">{w.title}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                closeWindow(w.instanceId);
                              }}
                              className="p-0.5 hover:bg-[#E81123] hover:text-white cursor-pointer"
                              title="Close"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="h-20 flex flex-col items-center justify-center bg-neutral-100 dark:bg-neutral-800/80 gap-1">
                            <AppIcon appId={w.appId} size={28} webColor={def.webColor} />
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              {w.isMinimized ? 'Minimized' : 'Click to focus'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right / Bottom System Tray */}
        <div className={`flex items-center shrink-0 ${isVertical ? 'flex-col w-full pb-1' : 'flex-row h-full'}`}>
          {appUpdateInfo?.hasUpdate && (
            <button
              onClick={() => openApp('settings', { settingsTab: 'update' })}
              className={`relative ${
                isVertical ? 'w-full h-10' : 'min-w-[36px] h-full px-2'
              } flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer`}
              title={`Update available: v${appUpdateInfo.latestVersionName} (Build ${appUpdateInfo.latestVersionCode})`}
            >
              <Download className="w-3.5 h-3.5 text-[#0078D7] dark:text-sky-400" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white/80 dark:ring-neutral-900" />
            </button>
          )}

          {/* Reset Cursor safety button when Mouse Mode is ON */}
          {settings.mouseMode && !isVertical && (
            <button
              data-reset-cursor-btn="true"
              onClick={triggerResetCursor}
              className="h-full px-2 min-w-[40px] flex items-center gap-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Reset cursor to center & clear stuck gestures (or 3-finger tap anywhere)"
            >
              <Crosshair className="w-3.5 h-3.5 text-[#0078D7] dark:text-sky-400 shrink-0" />
              <span className="hidden sm:inline text-[10.5px] font-medium whitespace-nowrap">Reset</span>
            </button>
          )}

          {/* Virtual Mouse Mode Toggle (>= 44px touch target) */}
          <button
            data-mouse-mode-toggle="true"
            onClick={() => updateSettings({ mouseMode: !settings.mouseMode })}
            style={settings.mouseMode ? { backgroundColor: settings.accentColor } : undefined}
            className={`${
              isVertical
                ? 'w-full h-10 justify-center'
                : 'h-full min-w-[44px] px-2.5 gap-1.5'
            } flex items-center transition-colors shrink-0 cursor-pointer ${
              settings.mouseMode
                ? 'text-white'
                : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            title={settings.mouseMode ? 'Turn off Mouse mode' : 'Turn on Mouse mode (Virtual Cursor & Touchpad)'}
          >
            <MousePointer2 className="w-3.5 h-3.5 shrink-0" />
            {!isVertical && (
              <span className="text-[10.5px] sm:text-[11px] font-medium whitespace-nowrap">
                Mouse mode
              </span>
            )}
          </button>

          {!isMobile && !isVertical && (
            <>
              <button
                onClick={() => {
                  setStartMenuOpen(false);
                  setActionCenterOpen(false);
                  setActiveFlyout((f) => (f === 'network' ? null : 'network'));
                }}
                className="h-full px-1.5 sm:px-2 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title={settings.wifiEnabled && !settings.airplaneMode ? 'Internet access' : 'No internet'}
              >
                {settings.wifiEnabled && !settings.airplaneMode ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 opacity-60" />
                )}
              </button>

              {!isCompact && (
                <button
                  onClick={() => {
                    setStartMenuOpen(false);
                    setActionCenterOpen(false);
                    setActiveFlyout((f) => (f === 'battery' ? null : 'battery'));
                  }}
                  className="hidden sm:flex h-full px-2 items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  title="Battery status: 98% plugged in"
                >
                  <BatteryCharging className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => {
                  setStartMenuOpen(false);
                  setActionCenterOpen(false);
                  setActiveFlyout((f) => (f === 'volume' ? null : 'volume'));
                }}
                className="h-full px-1.5 sm:px-2 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title={`Speakers: ${settings.muted ? 'Muted' : `${settings.volume}%`}`}
              >
                {settings.muted || settings.volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 opacity-65" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>

              {!isCompact && (
                <button
                  onClick={() => {
                    setStartMenuOpen(false);
                    setActionCenterOpen(false);
                    setActiveFlyout((f) => (f === 'language' ? null : 'language'));
                  }}
                  className="hidden lg:flex h-full px-2 items-center text-[10.5px] font-medium hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  title="Input language"
                >
                  {settings.language}
                </button>
              )}
            </>
          )}

          {/* Clock & Date */}
          {!isVertical && (
            <button
              onClick={() => {
                setStartMenuOpen(false);
                setActionCenterOpen(false);
                setActiveFlyout((f) => (f === 'clock' ? null : 'clock'));
              }}
              className="h-full px-2 flex flex-col items-end justify-center text-[10.5px] sm:text-[11px] leading-tight hover:bg-black/10 dark:hover:bg-white/10 tabular-nums cursor-pointer"
              title="Date and time"
            >
              <span>{timeStr}</span>
              {!isMobile && !isCompact && <span className="text-[10px] opacity-85">{dateStr}</span>}
            </button>
          )}

          {/* Action Center Toggle */}
          <button
            onClick={() => {
              setStartMenuOpen(false);
              setActiveFlyout(null);
              setActionCenterOpen((o) => {
                if (!o) markNotificationsRead();
                return !o;
              });
            }}
            className={`relative ${
              isVertical ? 'w-full h-10' : 'min-w-[40px] w-10 h-full'
            } flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer`}
            title="Action Center & Notifications"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                style={{ backgroundColor: settings.accentColor }}
                className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Show Desktop Sliver */}
          {!isMobile && !isVertical && (
            <button
              onClick={toggleShowDesktop}
              className="w-2.5 h-full border-l border-neutral-400/40 dark:border-white/20 hover:bg-black/15 dark:hover:bg-white/20 cursor-pointer"
              title="Show desktop (Win+D)"
            />
          )}
        </div>
      </div>
    </>
  );
};
