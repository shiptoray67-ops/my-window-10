import React from 'react';
import {
  Wifi,
  Bluetooth,
  Moon,
  Sun,
  Plane,
  BellOff,
  Scissors,
  Settings,
  X,
  Bell,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';

export const ActionCenter: React.FC = () => {
  const {
    actionCenterOpen,
    setActionCenterOpen,
    settings,
    updateSettings,
    notifications,
    dismissNotification,
    clearNotifications,
    openApp,
    setSnipOverlayOpen,
    isMobile,
  } = useOS();

  if (!actionCenterOpen) return null;

  const quickActions = [
    {
      label: 'Wi-Fi',
      sub: settings.wifiEnabled && !settings.airplaneMode ? 'Connected' : 'Off',
      active: settings.wifiEnabled && !settings.airplaneMode,
      icon: <Wifi className="w-4 h-4" />,
      onClick: () => updateSettings({ wifiEnabled: !settings.wifiEnabled, airplaneMode: false }),
    },
    {
      label: 'Bluetooth',
      sub: settings.bluetoothEnabled ? 'On' : 'Off',
      active: settings.bluetoothEnabled,
      icon: <Bluetooth className="w-4 h-4" />,
      onClick: () => updateSettings({ bluetoothEnabled: !settings.bluetoothEnabled }),
    },
    {
      label: 'Night light',
      sub: settings.nightLight ? 'On' : 'Off',
      active: settings.nightLight,
      icon: <Sun className="w-4 h-4" />,
      onClick: () => updateSettings({ nightLight: !settings.nightLight }),
    },
    {
      label: settings.darkMode ? 'Dark mode' : 'Light mode',
      sub: settings.darkMode ? 'Dark theme' : 'Light theme',
      active: settings.darkMode,
      icon: <Moon className="w-4 h-4" />,
      onClick: () => updateSettings({ darkMode: !settings.darkMode }),
    },
    {
      label: 'Airplane mode',
      sub: settings.airplaneMode ? 'On' : 'Off',
      active: settings.airplaneMode,
      icon: <Plane className="w-4 h-4" />,
      onClick: () =>
        updateSettings({
          airplaneMode: !settings.airplaneMode,
          wifiEnabled: settings.airplaneMode ? true : false,
        }),
    },
    {
      label: 'Focus assist',
      sub: settings.focusAssist ? 'Alarms only' : 'Off',
      active: settings.focusAssist,
      icon: <BellOff className="w-4 h-4" />,
      onClick: () => updateSettings({ focusAssist: !settings.focusAssist }),
    },
    {
      label: 'Screen snip',
      sub: 'Capture area',
      active: false,
      icon: <Scissors className="w-4 h-4" />,
      onClick: () => {
        setActionCenterOpen(false);
        setSnipOverlayOpen(true);
      },
    },
    {
      label: 'All settings',
      sub: 'Preferences',
      active: false,
      icon: <Settings className="w-4 h-4" />,
      onClick: () => openApp('settings'),
    },
  ];

  const posStyle = isMobile
    ? 'inset-x-0 top-0 bottom-12 w-full'
    : settings.taskbarPosition === 'top'
    ? 'right-0 top-11 bottom-0 w-[min(22.5rem,94dvw)]'
    : settings.taskbarPosition === 'right'
    ? 'right-[3.25rem] top-0 bottom-0 w-[min(22.5rem,94dvw)]'
    : 'right-0 top-0 bottom-11 w-[min(22.5rem,94dvw)]';

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`fixed ${posStyle} z-[9200] flex flex-col justify-between border-l border-neutral-300/60 dark:border-white/15 shadow-2xl fluent-acrylic-light dark:fluent-acrylic-dark text-neutral-900 dark:text-white pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]`}
    >
      {/* Notifications List */}
      <div className="flex-1 min-h-0 flex flex-col p-3.5 sm:p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold tracking-wide text-neutral-700 dark:text-neutral-200">
            Notifications
          </h3>
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="text-[11px] text-[#0078D7] hover:underline cursor-pointer"
            >
              Clear all notifications
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 dark:text-neutral-400 gap-2 py-12">
              <Bell className="w-6 h-6 opacity-40" />
              <p className="text-xs">No new notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="group relative p-3 bg-white/75 dark:bg-white/8 border border-neutral-200/70 dark:border-white/10"
              >
                <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 mb-1">
                  <span className="font-semibold">{n.appTitle}</span>
                  <span>
                    {new Date(n.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-xs font-semibold pr-5">{n.title}</div>
                <div className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5 leading-snug">
                  {n.message}
                </div>
                <button
                  onClick={() => dismissNotification(n.id)}
                  className="absolute top-2 right-2 p-1 opacity-60 hover:opacity-100 cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions & Brightness */}
      <div className="shrink-0 p-3.5 border-t border-neutral-200/70 dark:border-white/10 bg-black/5 dark:bg-black/20 space-y-3">
        <div className="grid grid-cols-4 gap-1.5">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={qa.onClick}
              style={qa.active ? { backgroundColor: settings.accentColor } : undefined}
              className={`h-[66px] p-2 flex flex-col justify-between text-left border transition-colors cursor-pointer ${
                qa.active
                  ? 'text-white border-transparent'
                  : 'bg-white/70 dark:bg-white/10 border-neutral-300/60 dark:border-white/10 text-neutral-800 dark:text-neutral-200 hover:bg-white dark:hover:bg-white/15'
              }`}
            >
              <div>{qa.icon}</div>
              <div>
                <div className="text-[10.5px] font-medium leading-tight truncate">{qa.label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Brightness Slider */}
        <div className="flex items-center gap-3 px-1 pt-1">
          <Sun className="w-4 h-4 shrink-0 text-neutral-600 dark:text-neutral-300" />
          <input
            type="range"
            min={35}
            max={100}
            value={settings.brightness}
            onChange={(e) => updateSettings({ brightness: Number(e.target.value) })}
            className="w-full accent-[#0078D7] cursor-pointer"
            aria-label="Screen brightness"
          />
          <span className="text-[11px] tabular-nums w-8 text-right">{settings.brightness}%</span>
        </div>
      </div>
    </div>
  );
};
