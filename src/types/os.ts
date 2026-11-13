export type BuiltInAppId =
  | 'explorer'
  | 'edge'
  | 'notepad'
  | 'wordpad'
  | 'calculator'
  | 'paint'
  | 'calendar'
  | 'clock'
  | 'photos'
  | 'mediaplayer'
  | 'camera'
  | 'weather'
  | 'stickynotes'
  | 'snipping'
  | 'taskmanager'
  | 'cmd'
  | 'store'
  | 'settings';

export type StoreGameId =
  | 'game-snake'
  | 'game-2048'
  | 'game-minesweeper'
  | 'game-chess'
  | 'game-tetris'
  | 'game-sudoku'
  | 'game-solitaire';

export type AppId = BuiltInAppId | StoreGameId | `webapp-${string}`;

export type PowerPhase = 'boot' | 'lock' | 'login' | 'desktop' | 'sleeping' | 'restarting' | 'shutdown';

export type TaskbarPosition = 'bottom' | 'top' | 'left' | 'right';
export type DisplayOrientation = 'landscape' | 'auto';
export type ResolutionScale = 75 | 100 | 125 | 150;
export type SearchEngine = 'google' | 'bing' | 'duckduckgo';

export interface AppDefinition {
  id: AppId;
  title: string;
  category: 'Productivity' | 'Utilities' | 'Media' | 'System' | 'Games' | 'Web Apps';
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  isStoreGame?: boolean;
  isWebApp?: boolean;
  webUrl?: string;
  webColor?: string;
  description?: string;
}

export type SnapZone =
  | 'left'
  | 'right'
  | 'top'
  | 'top-half'
  | 'bottom-half'
  | 'tl'
  | 'tr'
  | 'bl'
  | 'br';

export type WindowSnapState = 'none' | Exclude<SnapZone, 'top'>;

export interface WindowInstance {
  instanceId: string;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  prevBounds?: { x: number; y: number; width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  snapState: WindowSnapState;
  zIndex: number;
  launchPayload?: {
    fileId?: string;
    initialPath?: string;
    url?: string;
    settingsTab?: string;
  };
}

export type VfsNodeType = 'folder' | 'file';

export interface VfsNode {
  id: string;
  name: string;
  type: VfsNodeType;
  parentId: string | null;
  content?: string; // text content or data URL for binary/media
  mimeType?: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  isSystem?: boolean;
  isTrashed?: boolean;
  originalParentId?: string | null;
}

export interface NotificationItem {
  id: string;
  appTitle: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface StickyNote {
  id: string;
  color: 'yellow' | 'green' | 'pink' | 'blue' | 'purple' | 'charcoal';
  content: string;
  updatedAt: number;
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title: string;
  notes?: string;
  color: string;
}

export interface AlarmItem {
  id: string;
  time: string; // HH:MM
  label: string;
  enabled: boolean;
  days: number[]; // 0-6
}

export interface EdgeBookmark {
  id: string;
  title: string;
  url: string;
}

export interface EdgeHistoryItem {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

export interface BrowserDownloadItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  contentLength: number;
  timestamp: number;
}

export interface InstalledWebApp {
  id: `webapp-${string}`;
  title: string;
  url: string;
  color: string;
  installedAt: number;
}

export interface DesktopIconEntry {
  id: string;
  label: string;
  type: 'app' | 'folder' | 'file';
  targetId: string; // AppId or VfsNode id
  col: number;
  row: number;
}

export interface SystemSettings {
  username: string;
  userTitle: string;
  password: string; // empty string = no password
  passwordHint: string;
  avatarUrl: string;
  deviceName: string;
  wallpaper: string;
  lockWallpaper: string;
  accentColor: string;
  darkMode: boolean;
  taskbarPosition: TaskbarPosition;
  brightness: number; // 30 - 100
  nightLight: boolean;
  nightLightStrength: number; // 10 - 80
  wifiEnabled: boolean;
  bluetoothEnabled: boolean;
  airplaneMode: boolean;
  focusAssist: boolean;
  volume: number; // 0 - 100
  muted: boolean;
  uiSounds: boolean;
  use24HourClock: boolean;
  language: 'ENG US' | 'ENG UK' | 'ESP' | 'FRA' | 'DEU';
  pinnedTaskbarApps: AppId[];
  pinnedStartApps: AppId[];
  installedStoreApps: StoreGameId[];
  installedWebApps: InstalledWebApp[];
  showDesktopIcons: boolean;
  desktopIconSize: 'small' | 'medium' | 'large';
  windowsUpdateVersion: string;
  lastUpdateCheck: number;
  mouseMode: boolean;
  touchpadSensitivity: number;
  showTouchpadPanel: boolean;
  orientation: DisplayOrientation;
  resolutionScale: ResolutionScale;
  searchEngine: SearchEngine;
}
