import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export type NativeCursorType =
  | 'arrow'
  | 'hand'
  | 'text'
  | 'resize-ew'
  | 'resize-ns'
  | 'resize-nwse'
  | 'resize-nesw';

export interface EmbeddedWebViewCreateOptions {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio?: number;
  desktopMode?: boolean;
  incognito?: boolean;
  zoom?: number;
  visible?: boolean;
}

export interface EmbeddedWebViewBoundsOptions {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio?: number;
}

export interface EmbeddedWebViewState {
  canGoBack: boolean;
  canGoForward: boolean;
  url: string;
  title: string;
  progress: number;
}

export interface EmbeddedWebViewUrlEvent {
  id: string;
  url: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
}

export interface EmbeddedWebViewTitleEvent {
  id: string;
  title: string;
}

export interface EmbeddedWebViewProgressEvent {
  id: string;
  progress: number;
}

export interface EmbeddedWebViewLoadStartedEvent {
  id: string;
  url: string;
}

export interface EmbeddedWebViewLoadFinishedEvent {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface EmbeddedWebViewFaviconEvent {
  id: string;
  favicon: string;
}

export interface EmbeddedWebViewDownloadEvent {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  contentLength: number;
  timestamp: number;
}

export interface EmbeddedWebViewNewWindowEvent {
  id: string;
  url: string;
}

export interface EmbeddedWebViewFindResultsEvent {
  id: string;
  activeMatchOrdinal: number;
  numberOfMatches: number;
}

export interface EmbeddedWebViewScrollDirectionEvent {
  id: string;
  direction: 'up' | 'down' | 'top';
  scrollY: number;
}

export interface EmbeddedWebViewKeyboardEvent {
  visible: boolean;
  heightPx: number;
}

export interface EmbeddedWebViewUpdateStatusEvent {
  status: 'downloading' | 'installing' | 'needs_permission' | 'error';
  progress: number;
  message: string;
}

export interface AppVersionInfo {
  versionCode: number;
  versionName: string;
  packageName: string;
}

export interface EmbeddedWebViewPluginInterface {
  create(options: EmbeddedWebViewCreateOptions): Promise<void>;
  setBounds(options: EmbeddedWebViewBoundsOptions): Promise<void>;
  loadUrl(options: { id: string; url: string }): Promise<void>;
  goBack(options: { id: string }): Promise<{ handled: boolean }>;
  goForward(options: { id: string }): Promise<{ handled: boolean }>;
  reload(options: { id: string }): Promise<void>;
  stop(options: { id: string }): Promise<void>;
  show(options: { id: string }): Promise<void>;
  hide(options: { id: string }): Promise<void>;
  destroy(options: { id: string }): Promise<void>;
  setDesktopMode(options: { id: string; enabled: boolean }): Promise<void>;
  setZoom(options: { id: string; zoom: number }): Promise<void>;
  findInPage(options: {
    id: string;
    query: string;
    forward?: boolean;
    clear?: boolean;
  }): Promise<void>;
  getState(options: { id: string }): Promise<EmbeddedWebViewState>;
  clearData(): Promise<void>;

  // Always-on-top native cursor & touch interception
  showCursor(options?: {
    x?: number;
    y?: number;
    devicePixelRatio?: number;
    type?: NativeCursorType;
  }): Promise<{ x: number; y: number }>;
  hideCursor(): Promise<void>;
  moveCursor(options: {
    x: number;
    y: number;
    devicePixelRatio?: number;
  }): Promise<{ x: number; y: number }>;
  resetCursor(options?: { devicePixelRatio?: number }): Promise<{ x: number; y: number }>;
  setCursorStyle(options: { type: NativeCursorType }): Promise<void>;
  showClickFeedback(options?: {
    kind?: 'left' | 'right';
    x?: number;
    y?: number;
    devicePixelRatio?: number;
  }): Promise<void>;
  setMouseModeTouchIntercept(options: { enabled: boolean }): Promise<void>;

  // Native MotionEvent forwarding into active WebView
  injectTap(options: {
    id?: string;
    x: number;
    y: number;
    devicePixelRatio?: number;
  }): Promise<void>;
  injectDoubleTap(options: {
    id?: string;
    x: number;
    y: number;
    devicePixelRatio?: number;
  }): Promise<void>;
  injectLongPress(options: {
    id?: string;
    x: number;
    y: number;
    devicePixelRatio?: number;
  }): Promise<void>;
  injectDrag(options: {
    id?: string;
    phase: 'start' | 'move' | 'end' | 'cancel';
    x: number;
    y: number;
    devicePixelRatio?: number;
  }): Promise<void>;
  injectScroll(options: {
    id?: string;
    dx: number;
    dy: number;
    x: number;
    y: number;
    devicePixelRatio?: number;
  }): Promise<void>;
  injectHover(options: {
    id?: string;
    x: number;
    y: number;
    devicePixelRatio?: number;
  }): Promise<void>;
  injectPinch(options: {
    id?: string;
    scaleDelta: number;
    x: number;
    y: number;
    devicePixelRatio?: number;
  }): Promise<{ zoom: number }>;

  // In-app APK updater
  getAppVersion(): Promise<AppVersionInfo>;
  downloadAndInstallUpdate(options: { url: string; filename?: string }): Promise<void>;
  openInstallPermissionSettings(): Promise<void>;
  installPendingUpdate(): Promise<{ launched: boolean; needsPermission: boolean }>;

  addListener(
    eventName: 'urlChanged',
    listenerFunc: (event: EmbeddedWebViewUrlEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'titleChanged',
    listenerFunc: (event: EmbeddedWebViewTitleEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'progressChanged',
    listenerFunc: (event: EmbeddedWebViewProgressEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'loadStarted',
    listenerFunc: (event: EmbeddedWebViewLoadStartedEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'loadFinished',
    listenerFunc: (event: EmbeddedWebViewLoadFinishedEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'faviconReceived',
    listenerFunc: (event: EmbeddedWebViewFaviconEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'downloadStarted',
    listenerFunc: (event: EmbeddedWebViewDownloadEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'newWindowRequested',
    listenerFunc: (event: EmbeddedWebViewNewWindowEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'findResults',
    listenerFunc: (event: EmbeddedWebViewFindResultsEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'scrollDirection',
    listenerFunc: (event: EmbeddedWebViewScrollDirectionEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'keyboardChanged',
    listenerFunc: (event: EmbeddedWebViewKeyboardEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'nativeResetGestures',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'updateStatus',
    listenerFunc: (event: EmbeddedWebViewUpdateStatusEvent) => void
  ): Promise<PluginListenerHandle>;
}

export const EmbeddedWebView = registerPlugin<EmbeddedWebViewPluginInterface>('EmbeddedWebView');
