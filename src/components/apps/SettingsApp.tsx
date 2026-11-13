import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  Monitor,
  MousePointer2,
  Paintbrush,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Grid,
} from 'lucide-react';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { useOS } from '../../context/OSContext';
import { ACCENT_COLORS, BUILTIN_APPS, STORE_GAMES, WALLPAPER_PRESETS } from '../../data/apps';
import { AppVersionInfo, EmbeddedWebView } from '../../plugins/embeddedWebView';
import { getInstalledAppVersion, GITHUB_REPO } from '../../utils/appUpdater';
import {
  DisplayOrientation,
  ResolutionScale,
  SearchEngine,
  TaskbarPosition,
  WindowInstance,
} from '../../types/os';
import { PWAInstallButton } from '../../utils/pwa';
import { AppIcon } from '../icons/WinIcons';

type SettingsSection =
  | 'system'
  | 'display'
  | 'mouse'
  | 'personalization'
  | 'accounts'
  | 'time'
  | 'apps'
  | 'browser'
  | 'update';

export const SettingsApp: React.FC<{ win: WindowInstance }> = ({ win }) => {
  const {
    settings,
    updateSettings,
    uninstallStoreApp,
    uninstallWebApp,
    resetAllSimulatorData,
    addNotification,
    appUpdateInfo,
    checkingAppUpdate,
    appUpdateError,
    runAppUpdateCheck,
  } = useOS();

  const initialTab = (win.launchPayload?.settingsTab as SettingsSection) || 'system';
  const [section, setSection] = useState<SettingsSection>(initialTab);
  const [passwordDraft, setPasswordDraft] = useState(settings.password);
  const [hintDraft, setHintDraft] = useState(settings.passwordHint);
  const [accountSavedMsg, setAccountSavedMsg] = useState('');

  // Windows Update simulation & APK updater
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'downloading' | 'uptodate'>('idle');
  const [updatePct, setUpdatePct] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [browserClearedMsg, setBrowserClearedMsg] = useState('');
  const [clearingBrowserData, setClearingBrowserData] = useState(false);

  const [installedVersion, setInstalledVersion] = useState<AppVersionInfo>({
    versionCode: 1,
    versionName: '1.0.1',
    packageName: 'com.win10.simulator',
  });
  const [apkUpdateStatus, setApkUpdateStatus] = useState<'idle' | 'downloading' | 'installing' | 'needs_permission' | 'error'>('idle');
  const [apkUpdateProgress, setApkUpdateProgress] = useState(0);
  const [apkUpdateMessage, setApkUpdateMessage] = useState('');

  useEffect(() => {
    void getInstalledAppVersion().then(setInstalledVersion);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: PluginListenerHandle | null = null;
    void EmbeddedWebView.addListener('updateStatus', (ev) => {
      setApkUpdateStatus(ev.status);
      setApkUpdateProgress(ev.progress || 0);
      setApkUpdateMessage(ev.message || '');
    }).then((h) => {
      handle = h;
    });
    return () => {
      void handle?.remove();
    };
  }, []);

  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const navItems: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
    { id: 'system', label: 'System', icon: <Laptop className="w-4 h-4" /> },
    { id: 'display', label: 'Display', icon: <Monitor className="w-4 h-4" /> },
    { id: 'mouse', label: 'Mouse', icon: <MousePointer2 className="w-4 h-4" /> },
    { id: 'personalization', label: 'Personalization', icon: <Paintbrush className="w-4 h-4" /> },
    { id: 'accounts', label: 'Accounts', icon: <User className="w-4 h-4" /> },
    { id: 'time', label: 'Time & Language', icon: <Clock className="w-4 h-4" /> },
    { id: 'apps', label: 'Apps', icon: <Grid className="w-4 h-4" /> },
    { id: 'browser', label: 'Browser & Privacy', icon: <Globe className="w-4 h-4" /> },
    { id: 'update', label: 'Update & Security', icon: <RefreshCw className="w-4 h-4" /> },
  ];

  const handleUploadImage = (file: File, target: 'wallpaper' | 'avatar') => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (target === 'wallpaper') updateSettings({ wallpaper: url });
      else updateSettings({ avatarUrl: url });
    };
    reader.readAsDataURL(file);
  };

  const runWindowsUpdate = () => {
    if (updateState === 'checking' || updateState === 'downloading') return;
    setUpdateState('checking');
    setTimeout(() => {
      setUpdateState('downloading');
      setUpdatePct(12);
      let p = 12;
      const t = setInterval(() => {
        p += 18;
        if (p >= 100) {
          clearInterval(t);
          setUpdatePct(100);
          setUpdateState('uptodate');
          updateSettings({
            windowsUpdateVersion: 'Windows 10 Pro · 22H2 (Build 19045.4780)',
            lastUpdateCheck: Date.now(),
          });
          addNotification('Windows Update', 'Your device is up to date', 'Installed KB5041580 cumulative security update.');
        } else {
          setUpdatePct(p);
        }
      }, 320);
    }, 1000);
  };

  return (
    <div className="flex flex-col sm:flex-row h-full bg-white dark:bg-[#191919] text-neutral-900 dark:text-neutral-100">
      {/* Sidebar */}
      <div className="flex sm:flex-col sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#222222] p-2 gap-1 overflow-x-auto">
        <div className="hidden sm:block px-3 py-2 text-sm font-semibold">Settings</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs text-left whitespace-nowrap shrink-0 cursor-pointer ${
              section === item.id
                ? 'bg-[#0078D7] text-white font-medium'
                : 'hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {section === 'system' && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-xl font-light">System</h2>

            <div className="space-y-4 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div className="text-xs font-semibold">Display</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Screen brightness</span>
                  <span className="tabular-nums">{settings.brightness}%</span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={100}
                  value={settings.brightness}
                  onChange={(e) => updateSettings({ brightness: Number(e.target.value) })}
                  className="w-full accent-[#0078D7]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-xs font-medium">Night light</div>
                  <div className="text-[11px] text-neutral-500">Display warmer colors to reduce blue light</div>
                </div>
                <button
                  onClick={() => updateSettings({ nightLight: !settings.nightLight })}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    settings.nightLight ? 'bg-[#0078D7]' : 'bg-neutral-400 dark:bg-neutral-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.nightLight ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div className="text-xs font-semibold">Sound</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Master volume</span>
                  <span className="tabular-nums">{settings.muted ? 'Muted' : `${settings.volume}%`}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.muted ? 0 : settings.volume}
                  onChange={(e) =>
                    updateSettings({ volume: Number(e.target.value), muted: Number(e.target.value) === 0 })
                  }
                  className="w-full accent-[#0078D7]"
                />
              </div>
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span>Windows UI sound effects</span>
                <input
                  type="checkbox"
                  checked={settings.uiSounds}
                  onChange={(e) => updateSettings({ uiSounds: e.target.checked })}
                  className="accent-[#0078D7]"
                />
              </label>
            </div>

            <div className="space-y-3 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] text-xs">
              <div className="font-semibold">About PC</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Device name</span>
                <input
                  type="text"
                  value={settings.deviceName}
                  onChange={(e) => updateSettings({ deviceName: e.target.value })}
                  className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-right outline-none"
                />
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Edition</span>
                <span>{settings.windowsUpdateVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Storage</span>
                <span>Client IndexedDB + localStorage</span>
              </div>
            </div>
          </div>
        )}

        {section === 'display' && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-xl font-light">Display</h2>

            {/* Resolution Scale */}
            <div className="space-y-3 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div>
                <div className="text-xs font-semibold">Scale and layout (Resolution scale)</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Change the size of text, desktop icons, taskbar, and windows
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {([75, 100, 125, 150] as ResolutionScale[]).map((scale) => {
                  const active = (settings.resolutionScale || 100) === scale;
                  return (
                    <button
                      key={scale}
                      onClick={() => updateSettings({ resolutionScale: scale })}
                      className={`py-2 px-2 border text-center font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0078D7] text-white border-[#0078D7]'
                          : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:border-[#0078D7]'
                      }`}
                    >
                      {scale}%
                      {scale === 100 && (
                        <span className="block text-[9.5px] opacity-80 font-normal">Recommended</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Orientation */}
            <div className="space-y-3 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">Display orientation</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    Lock the desktop to wide PC landscape or allow device rotation
                  </div>
                </div>
                <RotateCw className="w-4 h-4 text-[#0078D7] shrink-0 mt-0.5" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    { id: 'landscape', label: 'Landscape', desc: 'Locked wide PC desktop (Recommended)' },
                    { id: 'auto', label: 'Auto-rotate', desc: 'Follow device orientation sensor' },
                  ] as Array<{ id: DisplayOrientation; label: string; desc: string }>
                ).map((opt) => {
                  const active = (settings.orientation || 'landscape') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => updateSettings({ orientation: opt.id })}
                      className={`p-2.5 border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0078D7] text-white border-[#0078D7]'
                          : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:border-[#0078D7]'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className={`text-[10px] mt-0.5 ${active ? 'text-white/85' : 'text-neutral-500'}`}>
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brightness & Night Light */}
            <div className="space-y-4 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div className="text-xs font-semibold">Brightness and color</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Screen brightness</span>
                  <span className="tabular-nums">{settings.brightness}%</span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={100}
                  value={settings.brightness}
                  onChange={(e) => updateSettings({ brightness: Number(e.target.value) })}
                  className="w-full accent-[#0078D7]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-xs font-medium">Night light</div>
                  <div className="text-[11px] text-neutral-500">Display warmer colors to reduce blue light</div>
                </div>
                <button
                  onClick={() => updateSettings({ nightLight: !settings.nightLight })}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    settings.nightLight ? 'bg-[#0078D7]' : 'bg-neutral-400 dark:bg-neutral-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.nightLight ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {section === 'mouse' && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-xl font-light">Mouse &amp; Virtual Touchpad</h2>

            <div className="space-y-5 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold">Mouse mode</div>
                  <div className="text-[11px] text-neutral-500">
                    Use the entire screen as an invisible touchpad controlling a desktop arrow cursor
                  </div>
                </div>
                <button
                  onClick={() => updateSettings({ mouseMode: !settings.mouseMode })}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                    settings.mouseMode ? 'bg-[#0078D7]' : 'bg-neutral-400 dark:bg-neutral-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.mouseMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-700/70">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Cursor speed sensitivity</span>
                  <span className="tabular-nums font-mono">
                    {(settings.touchpadSensitivity || 1.0).toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={settings.touchpadSensitivity || 1.0}
                  onChange={(e) => updateSettings({ touchpadSensitivity: Number(e.target.value) })}
                  className="w-full accent-[#0078D7]"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>Slow (0.5x)</span>
                  <span>Default (1.0x)</span>
                  <span>Fast (3.0x)</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-700/70">
                <div>
                  <div className="text-xs font-medium">Show touchpad panel</div>
                  <div className="text-[11px] text-neutral-500">
                    Show an optional floating touchpad widget with Left/Right click buttons (Off by default)
                  </div>
                </div>
                <button
                  onClick={() => updateSettings({ showTouchpadPanel: !settings.showTouchpadPanel })}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                    settings.showTouchpadPanel ? 'bg-[#0078D7]' : 'bg-neutral-400 dark:bg-neutral-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.showTouchpadPanel ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-2.5 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] text-xs">
              <div className="font-semibold">Invisible Full-Screen Touchpad Gestures</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
                <div><strong>1-finger slide anywhere:</strong> Move cursor</div>
                <div><strong>Single tap anywhere:</strong> Left click at cursor</div>
                <div><strong>Double tap anywhere:</strong> Double click at cursor</div>
                <div><strong>Long press (~0.5s):</strong> Right click / context menu</div>
                <div><strong>Tap-hold, then drag:</strong> Move windows &amp; resize edges</div>
                <div><strong>Two-finger drag:</strong> Scroll page or list</div>
                <div><strong>Two-finger tap:</strong> Right click at cursor</div>
                <div><strong>Taskbar button:</strong> Toggle Mouse mode ON / OFF</div>
              </div>
            </div>
          </div>
        )}

        {section === 'personalization' && (
          <div className="max-w-2xl space-y-6">
            <h2 className="text-xl font-light">Personalization</h2>

            {/* Desktop Wallpaper */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold">Desktop Background</div>
                <button
                  onClick={() => wallpaperInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Browse photo
                </button>
                <input
                  ref={wallpaperInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadImage(f, 'wallpaper');
                  }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {WALLPAPER_PRESETS.map((wp) => {
                  const active = settings.wallpaper === wp.url;
                  return (
                    <button
                      key={wp.id}
                      onClick={() => updateSettings({ wallpaper: wp.url })}
                      className={`group relative aspect-video overflow-hidden border-2 cursor-pointer ${
                        active ? 'border-[#0078D7]' : 'border-transparent hover:border-neutral-400'
                      }`}
                    >
                      {wp.type === 'gradient' ? (
                        <div style={{ background: wp.url }} className="w-full h-full" />
                      ) : (
                        <img src={wp.url} alt={wp.name} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-2 py-1 text-left truncate">
                        {wp.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Mode & Accent */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] space-y-3">
                <div className="text-xs font-semibold">Color Mode</div>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => updateSettings({ darkMode: false })}
                    className={`flex-1 py-2 border cursor-pointer ${
                      !settings.darkMode ? 'border-[#0078D7] bg-[#0078D7] text-white' : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => updateSettings({ darkMode: true })}
                    className={`flex-1 py-2 border cursor-pointer ${
                      settings.darkMode ? 'border-[#0078D7] bg-[#0078D7] text-white' : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] space-y-3">
                <div className="text-xs font-semibold">Accent Color</div>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => updateSettings({ accentColor: c.hex })}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                      className="w-7 h-7 flex items-center justify-center text-white cursor-pointer"
                    >
                      {settings.accentColor === c.hex && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Taskbar Location */}
            <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] space-y-3">
              <div className="text-xs font-semibold">Taskbar location on screen</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(['bottom', 'top', 'left', 'right'] as TaskbarPosition[]).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => updateSettings({ taskbarPosition: pos })}
                    className={`px-4 py-1.5 capitalize border cursor-pointer ${
                      settings.taskbarPosition === pos
                        ? 'bg-[#0078D7] text-white border-[#0078D7]'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {section === 'accounts' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-xl font-light">Your Info &amp; Account</h2>

            <div className="flex items-center gap-4">
              <img
                src={settings.avatarUrl}
                alt={settings.username}
                className="w-20 h-20 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
              />
              <div className="space-y-2">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
                >
                  Upload profile picture
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadImage(f, 'avatar');
                  }}
                />
                <div className="text-[11px] text-neutral-500">Stored locally in browser storage</div>
              </div>
            </div>

            <div className="space-y-3 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] text-xs">
              <div>
                <label className="block font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={settings.username}
                  onChange={(e) => updateSettings({ username: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Account Title</label>
                <input
                  type="text"
                  value={settings.userTitle}
                  onChange={(e) => updateSettings({ userTitle: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Sign-in Password (leave blank for instant sign-in)
                </label>
                <input
                  type="password"
                  value={passwordDraft}
                  onChange={(e) => setPasswordDraft(e.target.value)}
                  placeholder="No password set"
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Password Hint</label>
                <input
                  type="text"
                  value={hintDraft}
                  onChange={(e) => setHintDraft(e.target.value)}
                  placeholder="Optional hint"
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-emerald-600 dark:text-emerald-400">{accountSavedMsg}</span>
                <button
                  onClick={() => {
                    updateSettings({ password: passwordDraft, passwordHint: hintDraft });
                    setAccountSavedMsg('Sign-in credentials updated.');
                    setTimeout(() => setAccountSavedMsg(''), 3000);
                  }}
                  className="px-4 py-1.5 bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
                >
                  Save Credentials
                </button>
              </div>
            </div>
          </div>
        )}

        {section === 'time' && (
          <div className="max-w-lg space-y-5">
            <h2 className="text-xl font-light">Time &amp; Language</h2>
            <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] space-y-4 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Use 24-hour clock format</span>
                <input
                  type="checkbox"
                  checked={settings.use24HourClock}
                  onChange={(e) => updateSettings({ use24HourClock: e.target.checked })}
                  className="accent-[#0078D7]"
                />
              </label>

              <div>
                <label className="block font-medium mb-1.5">System Display &amp; Keyboard Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSettings({ language: e.target.value as typeof settings.language })}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
                >
                  <option value="ENG US">English (United States)</option>
                  <option value="ENG UK">English (United Kingdom)</option>
                  <option value="ESP">Español (España)</option>
                  <option value="FRA">Français (France)</option>
                  <option value="DEU">Deutsch (Deutschland)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {section === 'apps' && (
          <div className="max-w-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-light">Apps &amp; Features</h2>
                <p className="text-xs text-neutral-500">
                  Manage installed applications or install this simulator as an offline PWA.
                </p>
              </div>
              <PWAInstallButton />
            </div>

            <div className="border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
              {settings.installedStoreApps.map((id) => {
                const g = STORE_GAMES[id];
                if (!g) return null;
                return (
                  <div key={id} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <AppIcon appId={id} size={28} />
                      <div>
                        <div className="font-medium">{g.title}</div>
                        <div className="text-[11px] text-neutral-500">{g.publisher} · {g.sizeLabel}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => uninstallStoreApp(id)}
                      className="px-3 py-1 border border-neutral-300 dark:border-neutral-700 hover:bg-rose-600 hover:text-white cursor-pointer"
                    >
                      Uninstall
                    </button>
                  </div>
                );
              })}

              {settings.installedWebApps.map((w) => (
                <div key={w.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <Globe className="w-6 h-6 text-[#0078D7]" />
                    <div>
                      <div className="font-medium">{w.title}</div>
                      <div className="text-[11px] text-neutral-500">{w.url}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => uninstallWebApp(w.id)}
                    className="px-3 py-1 border border-neutral-300 dark:border-neutral-700 hover:bg-rose-600 hover:text-white cursor-pointer"
                  >
                    Uninstall
                  </button>
                </div>
              ))}

              {Object.values(BUILTIN_APPS).map((app) => (
                <div key={app.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <AppIcon appId={app.id} size={26} />
                    <div>
                      <div className="font-medium">{app.title}</div>
                      <div className="text-[11px] text-neutral-500">Built-in Windows App</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-400">System</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'browser' && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-xl font-light">Browser &amp; Privacy</h2>

            <div className="space-y-3 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div>
                <div className="text-xs font-semibold">Default search engine</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Search engine used in the Microsoft Edge address bar and New Tab search box
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(
                  [
                    { id: 'google', label: 'Google', desc: 'Default' },
                    { id: 'bing', label: 'Bing', desc: 'Microsoft' },
                    { id: 'duckduckgo', label: 'DuckDuckGo', desc: 'Private' },
                  ] as Array<{ id: SearchEngine; label: string; desc: string }>
                ).map((eng) => {
                  const active = (settings.searchEngine || 'google') === eng.id;
                  return (
                    <button
                      key={eng.id}
                      onClick={() => updateSettings({ searchEngine: eng.id })}
                      className={`p-2.5 border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0078D7] text-white border-[#0078D7]'
                          : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:border-[#0078D7]'
                      }`}
                    >
                      <div className="font-medium">{eng.label}</div>
                      <div className={`text-[10px] mt-0.5 ${active ? 'text-white/85' : 'text-neutral-500'}`}>
                        {eng.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] text-xs">
              <div>
                <div className="font-semibold">Cookies, cache &amp; browsing data</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Clear saved cookies, website sessions, cached files, browsing history, and download records. Bookmarks are kept.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  disabled={clearingBrowserData}
                  onClick={async () => {
                    setClearingBrowserData(true);
                    try {
                      if (Capacitor.isNativePlatform()) {
                        await EmbeddedWebView.clearData();
                      }
                      localStorage.removeItem('win10_edge_history_v1');
                      localStorage.removeItem('win10_edge_downloads_v1');
                      setBrowserClearedMsg('Cookies, cache, history, and downloads cleared.');
                      addNotification('Microsoft Edge', 'Browsing data cleared', 'Cookies, site data, cache, and history were removed.');
                      setTimeout(() => setBrowserClearedMsg(''), 4000);
                    } finally {
                      setClearingBrowserData(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0078D7] hover:bg-[#106EBE] disabled:opacity-50 text-white font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {clearingBrowserData ? 'Clearing...' : 'Clear cookies and cache'}
                </button>
                {browserClearedMsg && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                    {browserClearedMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {section === 'update' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-xl font-light">Update &amp; Security</h2>

            {/* Real Android APK In-Place Updater (GitHub Releases) */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Download className="w-7 h-7 text-[#0078D7] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">
                      App Updates (In-Place APK)
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      Installed: v{installedVersion.versionName} (Build {installedVersion.versionCode}) · {GITHUB_REPO}
                    </div>
                  </div>
                </div>
              </div>

              {appUpdateError && (
                <div className="p-2.5 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                  {appUpdateError}
                </div>
              )}

              {appUpdateInfo && !appUpdateError && (
                <div className="p-3 bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {appUpdateInfo.hasUpdate
                        ? `New update ready: v${appUpdateInfo.latestVersionName} (Build ${appUpdateInfo.latestVersionCode})`
                        : `You're on the latest build (Build ${installedVersion.versionCode})`}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Latest on GitHub: Build {appUpdateInfo.latestVersionCode || '?'}
                    </span>
                  </div>
                  {appUpdateInfo.releaseNotes && (
                    <p className="text-[11px] text-neutral-500 whitespace-pre-line">
                      {appUpdateInfo.releaseNotes}
                    </p>
                  )}
                </div>
              )}

              {(apkUpdateStatus === 'downloading' || apkUpdateStatus === 'installing') && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span>{apkUpdateMessage || 'Downloading update...'}</span>
                    <span>{apkUpdateProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-neutral-300 dark:bg-neutral-700">
                    <div
                      style={{ width: `${apkUpdateProgress}%` }}
                      className="h-full bg-[#0078D7] transition-all"
                    />
                  </div>
                </div>
              )}

              {apkUpdateStatus === 'needs_permission' && (
                <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-2">
                  <div>{apkUpdateMessage}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void EmbeddedWebView.openInstallPermissionSettings()}
                      className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                    >
                      Open Install Permission Settings
                    </button>
                    <button
                      onClick={async () => {
                        const res = await EmbeddedWebView.installPendingUpdate();
                        if (res.launched) {
                          setApkUpdateStatus('installing');
                          setApkUpdateMessage('Opening Android installer...');
                        }
                      }}
                      className="px-3 py-1.5 bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
                    >
                      Install Downloaded APK
                    </button>
                  </div>
                </div>
              )}

              {apkUpdateStatus === 'error' && apkUpdateMessage && (
                <div className="p-2.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300">
                  {apkUpdateMessage}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void runAppUpdateCheck(false)}
                  disabled={checkingAppUpdate || apkUpdateStatus === 'downloading'}
                  className="px-4 py-2 bg-[#0078D7] hover:bg-[#106EBE] disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                >
                  {checkingAppUpdate ? 'Checking GitHub...' : 'Check for updates'}
                </button>

                {appUpdateInfo?.hasUpdate && appUpdateInfo.downloadUrl && (
                  <button
                    disabled={apkUpdateStatus === 'downloading'}
                    onClick={async () => {
                      if (!appUpdateInfo.downloadUrl) return;
                      if (Capacitor.isNativePlatform()) {
                        setApkUpdateStatus('downloading');
                        setApkUpdateProgress(0);
                        setApkUpdateMessage('Starting download...');
                        try {
                          await EmbeddedWebView.downloadAndInstallUpdate({
                            url: appUpdateInfo.downloadUrl,
                            filename: `Win10Simulator-b${appUpdateInfo.latestVersionCode}.apk`,
                          });
                        } catch (err) {
                          setApkUpdateStatus('error');
                          setApkUpdateMessage(
                            err instanceof Error ? err.message : 'Failed to start APK download.'
                          );
                        }
                      } else {
                        const a = document.createElement('a');
                        a.href = appUpdateInfo.downloadUrl;
                        a.download = 'Win10Simulator.apk';
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.click();
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download and install update
                  </button>
                )}

                {appUpdateInfo?.releaseUrl && (
                  <a
                    href={appUpdateInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/10 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Release page
                  </a>
                )}
              </div>
            </div>

            {/* Simulated Windows OS Cumulative Update */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-8 h-8 text-[#0078D7] shrink-0" />
                <div>
                  <div className="text-sm font-semibold">
                    {updateState === 'uptodate'
                      ? "You're up to date"
                      : updateState === 'checking'
                      ? 'Checking for Windows updates...'
                      : updateState === 'downloading'
                      ? 'Installing KB5041580 Cumulative Update...'
                      : 'Windows Update (Simulator)'}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Last checked: {new Date(settings.lastUpdateCheck).toLocaleString()}
                  </div>
                </div>
              </div>

              {updateState === 'downloading' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span>Downloading &amp; installing</span>
                    <span>{updatePct}%</span>
                  </div>
                  <div className="h-1.5 bg-neutral-300 dark:bg-neutral-700">
                    <div
                      style={{ width: `${updatePct}%` }}
                      className="h-full bg-[#0078D7] transition-all"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={runWindowsUpdate}
                disabled={updateState === 'checking' || updateState === 'downloading'}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 text-xs font-medium cursor-pointer"
              >
                Check for Windows OS updates
              </button>
            </div>

            {/* Reset Simulator */}
            <div className="p-5 border border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-3 text-xs">
              <div className="font-semibold text-rose-700 dark:text-rose-400">Reset This PC (Simulator)</div>
              <p className="text-neutral-600 dark:text-neutral-300">
                Restore default wallpaper, settings, and virtual filesystem files in IndexedDB.
              </p>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-500 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset simulator data
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await resetAllSimulatorData();
                      setConfirmReset(false);
                    }}
                    className="px-3 py-1.5 bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                  >
                    Confirm Factory Reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
