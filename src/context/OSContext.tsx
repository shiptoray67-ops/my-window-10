import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import {
  AlarmItem,
  AppDefinition,
  AppId,
  DesktopIconEntry,
  InstalledWebApp,
  NotificationItem,
  PowerPhase,
  StoreGameId,
  SystemSettings,
  VfsNode,
  WindowInstance,
} from '../types/os';
import { BUILTIN_APPS, DEFAULT_SETTINGS, STORE_GAMES } from '../data/apps';
import {
  clearAllVfs,
  createInitialVfsSeed,
  deleteVfsNodeIds,
  getAllVfsNodes,
  putVfsNodes,
  ROOT_IDS,
} from '../utils/vfs';
import { soundEngine } from '../utils/sound';

const SETTINGS_KEY = 'win10_settings_v1';
const DESKTOP_ICONS_KEY = 'win10_desktop_icons_v1';
const NOTIFICATIONS_KEY = 'win10_notifications_v1';
const ALARMS_KEY = 'win10_alarms_v1';

export type TrayFlyout = 'clock' | 'volume' | 'network' | 'battery' | 'language' | null;

interface OSContextValue {
  powerPhase: PowerPhase;
  setPowerPhase: (phase: PowerPhase) => void;
  triggerPowerAction: (action: 'sleep' | 'restart' | 'shutdown') => void;
  settings: SystemSettings;
  updateSettings: (patch: Partial<SystemSettings>) => void;
  vfsNodes: VfsNode[];
  vfsReady: boolean;
  createVfsFolder: (parentId: string, name: string) => Promise<VfsNode>;
  createVfsFile: (parentId: string, name: string, content: string, mimeType?: string) => Promise<VfsNode>;
  updateVfsFileContent: (id: string, content: string) => Promise<void>;
  renameVfsNode: (id: string, newName: string) => Promise<void>;
  trashVfsNodes: (ids: string[]) => Promise<void>;
  restoreVfsNodes: (ids: string[]) => Promise<void>;
  emptyRecycleBin: () => Promise<void>;
  deleteVfsPermanently: (ids: string[]) => Promise<void>;
  copyVfsNodes: (ids: string[], targetParentId: string) => Promise<void>;
  moveVfsNodes: (ids: string[], targetParentId: string) => Promise<void>;
  uploadRealFiles: (parentId: string, files: FileList | File[]) => Promise<VfsNode[]>;
  windows: WindowInstance[];
  activeWindowId: string | null;
  openApp: (appId: AppId, launchPayload?: WindowInstance['launchPayload']) => void;
  openFileWithDefaultApp: (node: VfsNode) => void;
  closeWindow: (instanceId: string) => void;
  focusWindow: (instanceId: string) => void;
  minimizeWindow: (instanceId: string) => void;
  maximizeWindow: (instanceId: string) => void;
  restoreWindow: (instanceId: string) => void;
  updateWindowBounds: (instanceId: string, bounds: Partial<Pick<WindowInstance, 'x' | 'y' | 'width' | 'height' | 'isMaximized' | 'snapState' | 'prevBounds'>>) => void;
  snapWindow: (instanceId: string, side: 'left' | 'right' | 'top') => void;
  toggleShowDesktop: () => void;
  startMenuOpen: boolean;
  setStartMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  actionCenterOpen: boolean;
  setActionCenterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  taskViewOpen: boolean;
  setTaskViewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeFlyout: TrayFlyout;
  setActiveFlyout: React.Dispatch<React.SetStateAction<TrayFlyout>>;
  closeAllOverlays: () => void;
  notifications: NotificationItem[];
  addNotification: (appTitle: string, title: string, message: string) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  markNotificationsRead: () => void;
  desktopIcons: DesktopIconEntry[];
  moveDesktopIcon: (id: string, col: number, row: number) => void;
  refreshDesktop: () => void;
  desktopRefreshTick: number;
  getAppDefinition: (appId: AppId) => AppDefinition | undefined;
  installStoreApp: (appId: StoreGameId) => void;
  uninstallStoreApp: (appId: StoreGameId) => void;
  installWebApp: (title: string, url: string, color: string) => InstalledWebApp;
  uninstallWebApp: (id: `webapp-${string}`) => void;
  pinToTaskbar: (appId: AppId) => void;
  unpinFromTaskbar: (appId: AppId) => void;
  pinToStart: (appId: AppId) => void;
  unpinFromStart: (appId: AppId) => void;
  snipOverlayOpen: boolean;
  setSnipOverlayOpen: (open: boolean) => void;
  snipCapturedImage: string | null;
  setSnipCapturedImage: (dataUrl: string | null) => void;
  interactingWindowId: string | null;
  setInteractingWindowId: (id: string | null) => void;
  contextMenuOpen: boolean;
  setContextMenuOpen: (open: boolean) => void;
  hasShellOverlay: boolean;
  alarms: AlarmItem[];
  setAlarms: React.Dispatch<React.SetStateAction<AlarmItem[]>>;
  isMobile: boolean;
  resetAllSimulatorData: () => Promise<void>;
}

const OSContext = createContext<OSContextValue | null>(null);

const INITIAL_DESKTOP_ICONS: DesktopIconEntry[] = [
  { id: 'desk-this-pc', label: 'This PC', type: 'folder', targetId: ROOT_IDS.THIS_PC, col: 0, row: 0 },
  { id: 'desk-recycle', label: 'Recycle Bin', type: 'folder', targetId: ROOT_IDS.RECYCLE_BIN, col: 0, row: 1 },
  { id: 'desk-docs', label: 'Documents', type: 'folder', targetId: ROOT_IDS.DOCUMENTS, col: 0, row: 2 },
  { id: 'desk-edge', label: 'Microsoft Edge', type: 'app', targetId: 'edge', col: 0, row: 3 },
  { id: 'desk-store', label: 'Microsoft Store', type: 'app', targetId: 'store', col: 0, row: 4 },
];

function safeLoadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function safeLoadArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export const OSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [powerPhase, setPowerPhase] = useState<PowerPhase>('boot');
  const [settings, setSettings] = useState<SystemSettings>(() => safeLoadJson(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [vfsNodes, setVfsNodes] = useState<VfsNode[]>([]);
  const [vfsReady, setVfsReady] = useState(false);

  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const topZRef = useRef(20);

  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const [taskViewOpen, setTaskViewOpen] = useState(false);
  const [activeFlyout, setActiveFlyout] = useState<TrayFlyout>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    safeLoadArray(NOTIFICATIONS_KEY, [
      {
        id: 'notif-welcome',
        appTitle: 'Windows Security',
        title: 'Welcome to Windows 10',
        message: 'Local storage & offline mode are active. Try Microsoft Store to install free games!',
        timestamp: Date.now(),
        read: false,
      },
    ])
  );

  const [desktopIcons, setDesktopIcons] = useState<DesktopIconEntry[]>(() =>
    safeLoadArray(DESKTOP_ICONS_KEY, INITIAL_DESKTOP_ICONS)
  );
  const [desktopRefreshTick, setDesktopRefreshTick] = useState(0);

  const [snipOverlayOpen, setSnipOverlayOpen] = useState(false);
  const [snipCapturedImage, setSnipCapturedImage] = useState<string | null>(null);
  const [interactingWindowId, setInteractingWindowId] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const [alarms, setAlarms] = useState<AlarmItem[]>(() =>
    safeLoadArray(ALARMS_KEY, [
      { id: 'alarm-1', time: '07:30', label: 'Morning Standup', enabled: false, days: [1, 2, 3, 4, 5] },
    ])
  );

  const checkIsPortraitMobile = () =>
    typeof window !== 'undefined' && window.innerWidth < 700 && window.innerHeight > window.innerWidth;

  const [isMobile, setIsMobile] = useState(checkIsPortraitMobile);

  const lastTriggeredAlarmMinuteRef = useRef<string>('');

  // Responsive viewport listener (landscape stays full PC desktop mode even on narrow phones)
  useEffect(() => {
    const onResize = () => setIsMobile(checkIsPortraitMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Native Android immersive status bar & wake lock keeping screen awake
  useEffect(() => {
    let wakeLock: { release: () => Promise<void> } | null = null;

    const applyImmersiveAndWake = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.hide();
        } catch {
          // ignore on unsupported platforms
        }
      }
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (document.visibilityState === 'visible' && nav.wakeLock) {
          wakeLock = await nav.wakeLock.request('screen');
        }
      } catch {
        // ignore if wakeLock blocked
      }
    };

    void applyImmersiveAndWake();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void applyImmersiveAndWake();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Sync ScreenOrientation lock/unlock when orientation setting changes
  useEffect(() => {
    const mode = settings.orientation || 'landscape';
    const applyOrientation = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          if (mode === 'landscape') {
            await ScreenOrientation.lock({ orientation: 'landscape' });
          } else {
            await ScreenOrientation.unlock();
          }
        } catch {
          // ignore
        }
      } else {
        try {
          const webOrientation = window.screen?.orientation as ScreenOrientation & {
            lock?: (o: string) => Promise<void>;
            unlock?: () => void;
          };
          if (mode === 'landscape' && webOrientation?.lock) {
            await webOrientation.lock('landscape');
          } else if (mode === 'auto' && webOrientation?.unlock) {
            webOrientation.unlock();
          }
        } catch {
          // browsers often require fullscreen before lock; ignore
        }
      }
    };
    void applyOrientation();
  }, [settings.orientation]);

  // Sync Tailwind dark mode + accent CSS variable + Resolution scale + audio engine
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
    document.documentElement.style.setProperty('--win-accent', settings.accentColor);
    const scale = (settings.resolutionScale || 100) / 100;
    document.documentElement.style.fontSize = `${16 * scale}px`;
    soundEngine.enabled = settings.uiSounds;
    soundEngine.volume = settings.volume / 100;
    soundEngine.muted = settings.muted;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_ICONS_KEY, JSON.stringify(desktopIcons));
    } catch {
      // ignore
    }
  }, [desktopIcons]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
    } catch {
      // ignore
    }
  }, [alarms]);

  // Initialize IndexedDB VFS
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let existing = await getAllVfsNodes();
      if (existing.length === 0) {
        existing = createInitialVfsSeed();
        await putVfsNodes(existing);
      }
      if (!cancelled) {
        setVfsNodes(existing);
        setVfsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addNotification = useCallback((appTitle: string, title: string, message: string) => {
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        appTitle,
        title,
        message,
        timestamp: Date.now(),
        read: false,
      },
      ...prev.slice(0, 29),
    ]);
    soundEngine.playNotification();
  }, []);

  // Alarm checker loop
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const key = `${now.toDateString()}-${hh}:${mm}`;
      if (lastTriggeredAlarmMinuteRef.current === key) return;

      const hhmm = `${hh}:${mm}`;
      const matched = alarms.filter((a) => a.enabled && a.time === hhmm);
      if (matched.length > 0) {
        lastTriggeredAlarmMinuteRef.current = key;
        soundEngine.playAlarm();
        matched.forEach((a) => {
          addNotification('Alarms & Clock', a.label || 'Alarm', `It is ${a.time}`);
        });
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [alarms, addNotification]);

  const updateSettings = useCallback((patch: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const closeAllOverlays = useCallback(() => {
    setStartMenuOpen(false);
    setActionCenterOpen(false);
    setActiveFlyout(null);
    setTaskViewOpen(false);
  }, []);

  const getAppDefinition = useCallback(
    (appId: AppId): AppDefinition | undefined => {
      if (appId in BUILTIN_APPS) {
        return BUILTIN_APPS[appId as keyof typeof BUILTIN_APPS];
      }
      if (appId in STORE_GAMES) {
        return STORE_GAMES[appId as StoreGameId];
      }
      const webApp = settings.installedWebApps.find((w) => w.id === appId);
      if (webApp) {
        return {
          id: webApp.id,
          title: webApp.title,
          category: 'Web Apps',
          defaultWidth: 940,
          defaultHeight: 620,
          minWidth: 420,
          minHeight: 340,
          isWebApp: true,
          webUrl: webApp.url,
          webColor: webApp.color,
        };
      }
      return undefined;
    },
    [settings.installedWebApps]
  );

  // VFS Operations
  const createVfsFolder = useCallback(async (parentId: string, name: string) => {
    const now = Date.now();
    const node: VfsNode = {
      id: `folder-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      type: 'folder',
      parentId,
      size: 0,
      createdAt: now,
      updatedAt: now,
    };
    setVfsNodes((prev) => [...prev, node]);
    await putVfsNodes([node]);
    return node;
  }, []);

  const createVfsFile = useCallback(
    async (parentId: string, name: string, content: string, mimeType = 'text/plain') => {
      const now = Date.now();
      const node: VfsNode = {
        id: `file-${now}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        type: 'file',
        parentId,
        content,
        mimeType,
        size: content.length,
        createdAt: now,
        updatedAt: now,
      };
      setVfsNodes((prev) => [...prev, node]);
      await putVfsNodes([node]);
      return node;
    },
    []
  );

  const updateVfsFileContent = useCallback(async (id: string, content: string) => {
    let updatedNode: VfsNode | undefined;
    setVfsNodes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          updatedNode = { ...n, content, size: content.length, updatedAt: Date.now() };
          return updatedNode;
        }
        return n;
      })
    );
    if (updatedNode) {
      await putVfsNodes([updatedNode]);
    }
  }, []);

  const renameVfsNode = useCallback(async (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    let updatedNode: VfsNode | undefined;
    setVfsNodes((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.isSystem) {
          updatedNode = { ...n, name: trimmed, updatedAt: Date.now() };
          return updatedNode;
        }
        return n;
      })
    );
    if (updatedNode) {
      await putVfsNodes([updatedNode]);
    }
  }, []);

  const trashVfsNodes = useCallback(async (ids: string[]) => {
    const changed: VfsNode[] = [];
    setVfsNodes((prev) =>
      prev.map((n) => {
        if (ids.includes(n.id) && !n.isSystem) {
          const u: VfsNode = {
            ...n,
            isTrashed: true,
            originalParentId: n.parentId,
            parentId: ROOT_IDS.RECYCLE_BIN,
            updatedAt: Date.now(),
          };
          changed.push(u);
          return u;
        }
        return n;
      })
    );
    if (changed.length) await putVfsNodes(changed);
  }, []);

  const restoreVfsNodes = useCallback(async (ids: string[]) => {
    const changed: VfsNode[] = [];
    setVfsNodes((prev) =>
      prev.map((n) => {
        if (ids.includes(n.id) && n.isTrashed) {
          const u: VfsNode = {
            ...n,
            isTrashed: false,
            parentId: n.originalParentId || ROOT_IDS.DOCUMENTS,
            originalParentId: null,
            updatedAt: Date.now(),
          };
          changed.push(u);
          return u;
        }
        return n;
      })
    );
    if (changed.length) await putVfsNodes(changed);
  }, []);

  const deleteVfsPermanently = useCallback(async (ids: string[]) => {
    setVfsNodes((prev) => prev.filter((n) => !ids.includes(n.id) || n.isSystem));
    await deleteVfsNodeIds(ids);
  }, []);

  const emptyRecycleBin = useCallback(async () => {
    const trashedIds: string[] = [];
    setVfsNodes((prev) => {
      prev.forEach((n) => {
        if (n.isTrashed) trashedIds.push(n.id);
      });
      return prev.filter((n) => !n.isTrashed);
    });
    if (trashedIds.length) await deleteVfsNodeIds(trashedIds);
  }, []);

  const copyVfsNodes = useCallback(async (ids: string[], targetParentId: string) => {
    const now = Date.now();
    const created: VfsNode[] = [];
    setVfsNodes((prev) => {
      const clones = prev
        .filter((n) => ids.includes(n.id))
        .map((n, idx) => {
          const c: VfsNode = {
            ...n,
            id: `${n.type}-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            name: n.parentId === targetParentId ? `${n.name} - Copy` : n.name,
            parentId: targetParentId,
            isSystem: false,
            isTrashed: false,
            createdAt: now,
            updatedAt: now,
          };
          created.push(c);
          return c;
        });
      return [...prev, ...clones];
    });
    if (created.length) await putVfsNodes(created);
  }, []);

  const moveVfsNodes = useCallback(async (ids: string[], targetParentId: string) => {
    const changed: VfsNode[] = [];
    setVfsNodes((prev) =>
      prev.map((n) => {
        if (ids.includes(n.id) && !n.isSystem && n.id !== targetParentId) {
          const u: VfsNode = { ...n, parentId: targetParentId, isTrashed: false, updatedAt: Date.now() };
          changed.push(u);
          return u;
        }
        return n;
      })
    );
    if (changed.length) await putVfsNodes(changed);
  }, []);

  const uploadRealFiles = useCallback(async (parentId: string, files: FileList | File[]) => {
    const list = Array.from(files);
    const created: VfsNode[] = [];
    for (const file of list) {
      const content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsText(file);
        } else {
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        }
      });
      const now = Date.now();
      const node: VfsNode = {
        id: `file-${now}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: 'file',
        parentId,
        content,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        createdAt: now,
        updatedAt: now,
      };
      created.push(node);
    }
    if (created.length) {
      setVfsNodes((prev) => [...prev, ...created]);
      await putVfsNodes(created);
    }
    return created;
  }, []);

  // Window Manager
  const focusWindow = useCallback((instanceId: string) => {
    topZRef.current += 1;
    const z = topZRef.current;
    setWindows((prev) =>
      prev.map((w) =>
        w.instanceId === instanceId ? { ...w, zIndex: z, isMinimized: false } : w
      )
    );
    setActiveWindowId(instanceId);
  }, []);

  const openApp = useCallback(
    (appId: AppId, launchPayload?: WindowInstance['launchPayload']) => {
      closeAllOverlays();
      const def = getAppDefinition(appId);
      if (!def) return;

      // Single-instance check for system utilities like Settings, Store, Task Manager, Calculator unless payload differs
      const existing = windows.find((w) => w.appId === appId && !launchPayload);
      if (existing && (appId === 'settings' || appId === 'store' || appId === 'taskmanager')) {
        focusWindow(existing.instanceId);
        return;
      }

      soundEngine.playClick();
      topZRef.current += 1;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 760;
      const taskbarClearance = Math.round(48 * ((settings.resolutionScale || 100) / 100));
      const width = Math.min(def.defaultWidth, Math.max(260, vw - 20));
      const height = Math.min(
        def.defaultHeight,
        Math.max(200, vh - taskbarClearance - (settings.mouseMode && settings.showTouchpadPanel ? 140 : 16))
      );
      const cascade = (windows.length % 7) * 22;
      const x = Math.max(8, Math.min(vw - width - 8, Math.round((vw - width) / 2) + cascade - 32));
      const y = Math.max(8, Math.min(vh - taskbarClearance - height - 8, Math.round((vh - taskbarClearance - height) / 2) + cascade - 24));

      const instanceId = `win-${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const win: WindowInstance = {
        instanceId,
        appId,
        title: def.title,
        x,
        y,
        width,
        height,
        isMinimized: false,
        isMaximized: vw < 700 && vh > vw && !settings.mouseMode,
        snapState: 'none',
        zIndex: topZRef.current,
        launchPayload,
      };
      setWindows((prev) => [...prev, win]);
      setActiveWindowId(instanceId);
    },
    [closeAllOverlays, focusWindow, getAppDefinition, settings.mouseMode, settings.resolutionScale, settings.showTouchpadPanel, windows]
  );

  const openFileWithDefaultApp = useCallback(
    (node: VfsNode) => {
      if (node.type === 'folder') {
        openApp('explorer', { initialPath: node.id });
        return;
      }
      const name = node.name.toLowerCase();
      const mime = node.mimeType || '';
      if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(name)) {
        openApp('photos', { fileId: node.id });
      } else if (
        mime.startsWith('audio/') ||
        mime.startsWith('video/') ||
        /\.(mp3|wav|ogg|mp4|webm)$/.test(name)
      ) {
        openApp('mediaplayer', { fileId: node.id });
      } else if (name.endsWith('.rtf') || mime === 'text/html') {
        openApp('wordpad', { fileId: node.id });
      } else {
        openApp('notepad', { fileId: node.id });
      }
    },
    [openApp]
  );

  const closeWindow = useCallback((instanceId: string) => {
    setWindows((prev) => {
      const next = prev.filter((w) => w.instanceId !== instanceId);
      setActiveWindowId((curr) => {
        if (curr !== instanceId) return curr;
        const visible = next.filter((w) => !w.isMinimized).sort((a, b) => b.zIndex - a.zIndex);
        return visible[0]?.instanceId || null;
      });
      return next;
    });
  }, []);

  const minimizeWindow = useCallback((instanceId: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.instanceId === instanceId ? { ...w, isMinimized: true } : w))
    );
    setActiveWindowId((curr) => (curr === instanceId ? null : curr));
  }, []);

  const maximizeWindow = useCallback((instanceId: string) => {
    topZRef.current += 1;
    setWindows((prev) =>
      prev.map((w) =>
        w.instanceId === instanceId
          ? {
              ...w,
              isMaximized: true,
              snapState: 'none',
              zIndex: topZRef.current,
              prevBounds: w.isMaximized ? w.prevBounds : { x: w.x, y: w.y, width: w.width, height: w.height },
            }
          : w
      )
    );
    setActiveWindowId(instanceId);
  }, []);

  const restoreWindow = useCallback((instanceId: string) => {
    topZRef.current += 1;
    setWindows((prev) =>
      prev.map((w) => {
        if (w.instanceId !== instanceId) return w;
        const bounds = w.prevBounds || { x: 80, y: 60, width: w.width, height: w.height };
        return {
          ...w,
          isMaximized: false,
          isMinimized: false,
          snapState: 'none',
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          zIndex: topZRef.current,
        };
      })
    );
    setActiveWindowId(instanceId);
  }, []);

  const updateWindowBounds = useCallback(
    (
      instanceId: string,
      bounds: Partial<Pick<WindowInstance, 'x' | 'y' | 'width' | 'height' | 'isMaximized' | 'snapState' | 'prevBounds'>>
    ) => {
      setWindows((prev) =>
        prev.map((w) => (w.instanceId === instanceId ? { ...w, ...bounds } : w))
      );
    },
    []
  );

  const snapWindow = useCallback((instanceId: string, side: 'left' | 'right' | 'top') => {
    if (side === 'top') {
      maximizeWindow(instanceId);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tbSize = 44;
    const halfW = Math.floor(vw / 2);
    const workH = vh - (settings.taskbarPosition === 'bottom' || settings.taskbarPosition === 'top' ? tbSize : 0);
    const topOffset = settings.taskbarPosition === 'top' ? tbSize : 0;
    topZRef.current += 1;

    setWindows((prev) =>
      prev.map((w) => {
        if (w.instanceId !== instanceId) return w;
        return {
          ...w,
          prevBounds: w.snapState === 'none' && !w.isMaximized ? { x: w.x, y: w.y, width: w.width, height: w.height } : w.prevBounds,
          isMaximized: false,
          snapState: side,
          x: side === 'left' ? 0 : halfW,
          y: topOffset,
          width: halfW,
          height: workH,
          zIndex: topZRef.current,
        };
      })
    );
    setActiveWindowId(instanceId);
  }, [maximizeWindow, settings.taskbarPosition]);

  const toggleShowDesktop = useCallback(() => {
    closeAllOverlays();
    setWindows((prev) => {
      const anyVisible = prev.some((w) => !w.isMinimized);
      return prev.map((w) => ({ ...w, isMinimized: anyVisible }));
    });
  }, [closeAllOverlays]);

  // Store & Web App Management
  const installStoreApp = useCallback(
    (appId: StoreGameId) => {
      const game = STORE_GAMES[appId];
      if (!game) return;
      setSettings((prev) => {
        if (prev.installedStoreApps.includes(appId)) return prev;
        return {
          ...prev,
          installedStoreApps: [...prev.installedStoreApps, appId],
        };
      });
      setDesktopIcons((prev) => {
        if (prev.some((d) => d.targetId === appId)) return prev;
        const maxCol = Math.max(1, ...prev.map((d) => d.col));
        const usedInCol = prev.filter((d) => d.col === 1).length;
        return [
          ...prev,
          {
            id: `desk-${appId}`,
            label: game.title,
            type: 'app',
            targetId: appId,
            col: usedInCol < 6 ? 1 : maxCol + 1,
            row: usedInCol < 6 ? usedInCol : 0,
          },
        ];
      });
      addNotification('Microsoft Store', `${game.title} installed`, 'Added to Start menu and Desktop.');
    },
    [addNotification]
  );

  const uninstallStoreApp = useCallback(
    (appId: StoreGameId) => {
      setWindows((prev) => prev.filter((w) => w.appId !== appId));
      setSettings((prev) => ({
        ...prev,
        installedStoreApps: prev.installedStoreApps.filter((id) => id !== appId),
        pinnedTaskbarApps: prev.pinnedTaskbarApps.filter((id) => id !== appId),
        pinnedStartApps: prev.pinnedStartApps.filter((id) => id !== appId),
      }));
      setDesktopIcons((prev) => prev.filter((d) => d.targetId !== appId));
    },
    []
  );

  const installWebApp = useCallback(
    (title: string, url: string, color: string): InstalledWebApp => {
      const normalizedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      const newApp: InstalledWebApp = {
        id: `webapp-${Date.now()}`,
        title: title.trim() || 'Web App',
        url: normalizedUrl,
        color,
        installedAt: Date.now(),
      };
      setSettings((prev) => ({
        ...prev,
        installedWebApps: [...prev.installedWebApps, newApp],
      }));
      setDesktopIcons((prev) => {
        const usedInCol = prev.filter((d) => d.col === 1).length;
        return [
          ...prev,
          {
            id: `desk-${newApp.id}`,
            label: newApp.title,
            type: 'app',
            targetId: newApp.id,
            col: usedInCol < 6 ? 1 : 2,
            row: usedInCol < 6 ? usedInCol : 0,
          },
        ];
      });
      addNotification('Microsoft Edge', `${newApp.title} installed`, 'Website shortcut pinned to Desktop & Start.');
      return newApp;
    },
    [addNotification]
  );

  const uninstallWebApp = useCallback((id: `webapp-${string}`) => {
    setWindows((prev) => prev.filter((w) => w.appId !== id));
    setSettings((prev) => ({
      ...prev,
      installedWebApps: prev.installedWebApps.filter((w) => w.id !== id),
      pinnedTaskbarApps: prev.pinnedTaskbarApps.filter((p) => p !== id),
      pinnedStartApps: prev.pinnedStartApps.filter((p) => p !== id),
    }));
    setDesktopIcons((prev) => prev.filter((d) => d.targetId !== id));
  }, []);

  const pinToTaskbar = useCallback((appId: AppId) => {
    setSettings((prev) =>
      prev.pinnedTaskbarApps.includes(appId)
        ? prev
        : { ...prev, pinnedTaskbarApps: [...prev.pinnedTaskbarApps, appId] }
    );
  }, []);

  const unpinFromTaskbar = useCallback((appId: AppId) => {
    setSettings((prev) => ({
      ...prev,
      pinnedTaskbarApps: prev.pinnedTaskbarApps.filter((id) => id !== appId),
    }));
  }, []);

  const pinToStart = useCallback((appId: AppId) => {
    setSettings((prev) =>
      prev.pinnedStartApps.includes(appId)
        ? prev
        : { ...prev, pinnedStartApps: [...prev.pinnedStartApps, appId] }
    );
  }, []);

  const unpinFromStart = useCallback((appId: AppId) => {
    setSettings((prev) => ({
      ...prev,
      pinnedStartApps: prev.pinnedStartApps.filter((id) => id !== appId),
    }));
  }, []);

  const moveDesktopIcon = useCallback((id: string, col: number, row: number) => {
    setDesktopIcons((prev) =>
      prev.map((icon) => (icon.id === id ? { ...icon, col: Math.max(0, col), row: Math.max(0, row) } : icon))
    );
  }, []);

  const refreshDesktop = useCallback(() => {
    setDesktopRefreshTick((t) => t + 1);
  }, []);

  const triggerPowerAction = useCallback((action: 'sleep' | 'restart' | 'shutdown') => {
    closeAllOverlays();
    if (action === 'sleep') {
      setPowerPhase('sleeping');
    } else if (action === 'restart') {
      setPowerPhase('restarting');
      setTimeout(() => {
        setWindows([]);
        setPowerPhase('boot');
      }, 1800);
    } else {
      setPowerPhase('shutdown');
    }
  }, [closeAllOverlays]);

  const resetAllSimulatorData = useCallback(async () => {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(DESKTOP_ICONS_KEY);
    localStorage.removeItem(NOTIFICATIONS_KEY);
    localStorage.removeItem(ALARMS_KEY);
    await clearAllVfs();
    const freshSeed = createInitialVfsSeed();
    await putVfsNodes(freshSeed);
    setVfsNodes(freshSeed);
    setSettings(DEFAULT_SETTINGS);
    setDesktopIcons(INITIAL_DESKTOP_ICONS);
    setWindows([]);
    addNotification('System Reset', 'Simulator Reset Complete', 'All settings and virtual files restored to factory defaults.');
  }, [addNotification]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (powerPhase !== 'desktop') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+Esc -> Task Manager
      if (e.ctrlKey && e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        openApp('taskmanager');
        return;
      }

      // Ctrl+Esc -> Start Menu
      if (e.ctrlKey && !e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        setStartMenuOpen((o) => !o);
        return;
      }

      // Alt+Tab -> Task Switcher
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        setTaskViewOpen((o) => !o);
        return;
      }

      // Alt+F4 or Ctrl+Q -> Close active window
      if ((e.altKey && e.key === 'F4') || (e.ctrlKey && e.key.toLowerCase() === 'q')) {
        if (activeWindowId) {
          e.preventDefault();
          closeWindow(activeWindowId);
        }
        return;
      }

      // Win+D or Alt+D -> Show Desktop
      if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleShowDesktop();
        return;
      }

      // Win+E or Alt+E -> File Explorer
      if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        openApp('explorer');
        return;
      }

      // Escape closes overlays
      if (e.key === 'Escape') {
        if (snipOverlayOpen) {
          setSnipOverlayOpen(false);
        } else if (startMenuOpen || actionCenterOpen || activeFlyout || taskViewOpen) {
          closeAllOverlays();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    powerPhase,
    activeWindowId,
    closeWindow,
    openApp,
    toggleShowDesktop,
    snipOverlayOpen,
    startMenuOpen,
    actionCenterOpen,
    activeFlyout,
    taskViewOpen,
    closeAllOverlays,
  ]);

  const hasShellOverlay =
    powerPhase !== 'desktop' ||
    startMenuOpen ||
    actionCenterOpen ||
    taskViewOpen ||
    activeFlyout !== null ||
    snipOverlayOpen ||
    contextMenuOpen;

  const value = useMemo<OSContextValue>(
    () => ({
      powerPhase,
      setPowerPhase,
      triggerPowerAction,
      settings,
      updateSettings,
      vfsNodes,
      vfsReady,
      createVfsFolder,
      createVfsFile,
      updateVfsFileContent,
      renameVfsNode,
      trashVfsNodes,
      restoreVfsNodes,
      emptyRecycleBin,
      deleteVfsPermanently,
      copyVfsNodes,
      moveVfsNodes,
      uploadRealFiles,
      windows,
      activeWindowId,
      openApp,
      openFileWithDefaultApp,
      closeWindow,
      focusWindow,
      minimizeWindow,
      maximizeWindow,
      restoreWindow,
      updateWindowBounds,
      snapWindow,
      toggleShowDesktop,
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
      closeAllOverlays,
      notifications,
      addNotification,
      dismissNotification,
      clearNotifications,
      markNotificationsRead,
      desktopIcons,
      moveDesktopIcon,
      refreshDesktop,
      desktopRefreshTick,
      getAppDefinition,
      installStoreApp,
      uninstallStoreApp,
      installWebApp,
      uninstallWebApp,
      pinToTaskbar,
      unpinFromTaskbar,
      pinToStart,
      unpinFromStart,
      snipOverlayOpen,
      setSnipOverlayOpen,
      snipCapturedImage,
      setSnipCapturedImage,
      interactingWindowId,
      setInteractingWindowId,
      contextMenuOpen,
      setContextMenuOpen,
      hasShellOverlay,
      alarms,
      setAlarms,
      isMobile,
      resetAllSimulatorData,
    }),
    [
      powerPhase,
      triggerPowerAction,
      settings,
      updateSettings,
      vfsNodes,
      vfsReady,
      createVfsFolder,
      createVfsFile,
      updateVfsFileContent,
      renameVfsNode,
      trashVfsNodes,
      restoreVfsNodes,
      emptyRecycleBin,
      deleteVfsPermanently,
      copyVfsNodes,
      moveVfsNodes,
      uploadRealFiles,
      windows,
      activeWindowId,
      openApp,
      openFileWithDefaultApp,
      closeWindow,
      focusWindow,
      minimizeWindow,
      maximizeWindow,
      restoreWindow,
      updateWindowBounds,
      snapWindow,
      toggleShowDesktop,
      startMenuOpen,
      searchQuery,
      actionCenterOpen,
      taskViewOpen,
      activeFlyout,
      closeAllOverlays,
      notifications,
      addNotification,
      dismissNotification,
      clearNotifications,
      markNotificationsRead,
      desktopIcons,
      moveDesktopIcon,
      refreshDesktop,
      desktopRefreshTick,
      getAppDefinition,
      installStoreApp,
      uninstallStoreApp,
      installWebApp,
      uninstallWebApp,
      pinToTaskbar,
      unpinFromTaskbar,
      pinToStart,
      unpinFromStart,
      snipOverlayOpen,
      snipCapturedImage,
      interactingWindowId,
      contextMenuOpen,
      hasShellOverlay,
      alarms,
      isMobile,
      resetAllSimulatorData,
    ]
  );

  return <OSContext.Provider value={value}>{children}</OSContext.Provider>;
};

export function useOS() {
  const ctx = useContext(OSContext);
  if (!ctx) throw new Error('useOS must be used within OSProvider');
  return ctx;
}
