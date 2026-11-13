import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

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
}

export const EmbeddedWebView = registerPlugin<EmbeddedWebViewPluginInterface>('EmbeddedWebView');
