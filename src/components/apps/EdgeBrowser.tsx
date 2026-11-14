import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  Globe,
  History,
  Home,
  Laptop,
  Layers,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  RotateCw,
  Search,
  Share2,
  ShieldAlert,
  Sliders,
  Smartphone,
  Star,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import {
  EmbeddedWebView,
} from '../../plugins/embeddedWebView';
import {
  BrowserDownloadItem,
  EdgeBookmark,
  EdgeHistoryItem,
  SearchEngine,
  WindowInstance,
} from '../../types/os';

interface Tab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  incognito: boolean;
  desktopMode: boolean;
  zoom: number;
  progress: number;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  nativeCreated: boolean;
  historyStack: string[];
  historyIndex: number;
}

const BOOKMARKS_KEY = 'win10_edge_bookmarks_v1';
const HISTORY_KEY = 'win10_edge_history_v1';
const DOWNLOADS_KEY = 'win10_edge_downloads_v1';
const IFRAME_LOAD_TIMEOUT_MS = 5000;

// Used ONLY for non-native web browser preview where third-party sites send X-Frame-Options
const WEB_PREVIEW_IFRAME_BLOCKED: Array<{ domain: string; label: string }> = [
  { domain: 'm.facebook.com', label: 'Facebook' },
  { domain: 'facebook.com', label: 'Facebook' },
  { domain: 'fb.com', label: 'Facebook' },
  { domain: 'google.com', label: 'Google' },
  { domain: 'youtube.com', label: 'YouTube' },
  { domain: 'youtu.be', label: 'YouTube' },
  { domain: 'instagram.com', label: 'Instagram' },
  { domain: 'web.whatsapp.com', label: 'WhatsApp Web' },
  { domain: 'whatsapp.com', label: 'WhatsApp' },
  { domain: 'twitter.com', label: 'Twitter' },
  { domain: 'x.com', label: 'X' },
  { domain: 'linkedin.com', label: 'LinkedIn' },
  { domain: 'netflix.com', label: 'Netflix' },
  { domain: 'amazon.com', label: 'Amazon' },
  { domain: 'github.com', label: 'GitHub' },
  { domain: 'reddit.com', label: 'Reddit' },
  { domain: 'discord.com', label: 'Discord' },
  { domain: 'tiktok.com', label: 'TikTok' },
  { domain: 'bing.com', label: 'Bing' },
  { domain: 'duckduckgo.com', label: 'DuckDuckGo' },
];

const DEFAULT_BOOKMARKS: EdgeBookmark[] = [
  { id: 'bm-google', title: 'Google', url: 'https://www.google.com' },
  { id: 'bm-youtube', title: 'YouTube', url: 'https://www.youtube.com' },
  { id: 'bm-wiki', title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { id: 'bm-osm', title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html' },
];

const NEW_TAB_SHORTCUTS = [
  { name: 'Google', url: 'https://www.google.com', color: '#4285F4', badge: 'G' },
  { name: 'YouTube', url: 'https://www.youtube.com', color: '#FF0000', badge: 'YT' },
  { name: 'Facebook', url: 'https://www.facebook.com', color: '#1877F2', badge: 'f' },
  { name: 'Instagram', url: 'https://www.instagram.com', color: '#E1306C', badge: 'IG' },
  { name: 'WhatsApp Web', url: 'https://web.whatsapp.com', color: '#25D366', badge: 'WA' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page', color: '#3366CC', badge: 'W' },
];

function getSiteMeta(urlStr: string): { hostname: string; siteName: string; isWebIframeBlocked: boolean } {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    const matched = WEB_PREVIEW_IFRAME_BLOCKED.find(
      (entry) => host === entry.domain || host.endsWith(`.${entry.domain}`)
    );
    const cleanHost = host.replace(/^www\./, '');
    const inferredName =
      matched?.label ||
      cleanHost
        .split('.')[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const searchQ = parsed.searchParams.get('q');
    const titleName = searchQ ? `${inferredName}: ${searchQ}` : inferredName || urlStr;

    return {
      hostname: cleanHost,
      siteName: titleName,
      isWebIframeBlocked: Boolean(matched),
    };
  } catch {
    return { hostname: urlStr, siteName: urlStr, isWebIframeBlocked: false };
  }
}

function buildSearchUrl(query: string, engine: SearchEngine): string {
  const encoded = encodeURIComponent(query);
  if (engine === 'bing') return `https://www.bing.com/search?q=${encoded}`;
  if (engine === 'duckduckgo') return `https://duckduckgo.com/?q=${encoded}`;
  return `https://www.google.com/search?q=${encoded}`;
}

function normalizeAddressInput(rawInput: string, engine: SearchEngine): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return 'edge://home';
  if (trimmed === 'edge://home') return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const hasSpaces = /\s/.test(trimmed);
  const looksLikeLocalhost = /^localhost(:\d+)?(\/.*)?$/i.test(trimmed);
  const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(trimmed);
  const looksLikeDomain =
    !hasSpaces && /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d+)?(\/.*)?$/.test(trimmed);

  if (looksLikeLocalhost || looksLikeIp) {
    return `http://${trimmed}`;
  }
  if (looksLikeDomain) {
    return `https://${trimmed}`;
  }
  return buildSearchUrl(trimmed, engine);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EdgeBrowser: React.FC<{
  win: WindowInstance;
  standaloneUrl?: string;
}> = ({ win, standaloneUrl }) => {
  const {
    windows,
    settings,
    updateSettings,
    hasShellOverlay,
    interactingWindowId,
    installWebApp,
    addNotification,
    openApp,
    focusModeWindowId,
    toggleFocusMode,
    chromeHiddenWindowIds,
    setWindowChromeHidden,
  } = useOS();

  const isNative = Capacitor.isNativePlatform();
  const searchEngine = settings.searchEngine || 'google';
  const defaultZoom = settings.browserTextZoom || 100;
  const isChromeHidden = Boolean(chromeHiddenWindowIds[win.instanceId]);
  const isFocusedMode = focusModeWindowId === win.instanceId;

  const makeTabId = useCallback(
    () => `${win.instanceId}-tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    [win.instanceId]
  );

  const rawInitial = standaloneUrl || win.launchPayload?.url || 'edge://home';
  const normalizedInitial = normalizeAddressInput(rawInitial, searchEngine);
  const initialMeta = normalizedInitial.startsWith('http')
    ? getSiteMeta(normalizedInitial)
    : null;

  const [tabs, setTabs] = useState<Tab[]>(() => [
    {
      id: `${win.instanceId}-tab-init`,
      title: standaloneUrl
        ? win.title
        : normalizedInitial === 'edge://home'
        ? 'New tab'
        : initialMeta?.siteName || normalizedInitial,
      url: normalizedInitial,
      incognito: false,
      desktopMode: false,
      zoom: defaultZoom,
      progress: 0,
      isLoading: normalizedInitial.startsWith('http'),
      canGoBack: false,
      canGoForward: false,
      nativeCreated: false,
      historyStack: [normalizedInitial],
      historyIndex: 0,
    },
  ]);

  const [activeTabId, setActiveTabId] = useState<string>(`${win.instanceId}-tab-init`);
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [addressInput, setAddressInput] = useState(activeTab.url);
  const [searchInput, setSearchInput] = useState('');
  const [bookmarks, setBookmarks] = useState<EdgeBookmark[]>(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_BOOKMARKS;
    } catch {
      return DEFAULT_BOOKMARKS;
    }
  });
  const [historyList, setHistoryList] = useState<EdgeHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [historySearch, setHistorySearch] = useState('');
  const [downloads, setDownloads] = useState<BrowserDownloadItem[]>(() => {
    try {
      const raw = localStorage.getItem(DOWNLOADS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [drawer, setDrawer] = useState<'bookmarks' | 'history' | 'downloads' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [findBarOpen, setFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatchInfo, setFindMatchInfo] = useState<{ active: number; total: number }>({
    active: 0,
    total: 0,
  });
  const [installAppModal, setInstallAppModal] = useState(false);
  const [installAppTitle, setInstallAppTitle] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(win.width || 360);

  // Web preview fallback state (only used when !isNative)
  const [reloadTick, setReloadTick] = useState(0);
  const [webIframeStatus, setWebIframeStatus] = useState<'idle' | 'loading' | 'loaded' | 'blocked' | 'timeout'>('idle');

  const rootContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const createdWebViewsRef = useRef<Set<string>>(new Set());
  const rafSyncRef = useRef<number | null>(null);
  const overlayLockRef = useRef(false);
  overlayLockRef.current = Boolean(menuOpen || tabMenuOpen || findBarOpen || drawer || installAppModal);
  const isNarrow = containerWidth < 560;

  // Persist bookmarks, history & downloads
  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
  }, [bookmarks]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyList.slice(0, 150)));
    } catch {
      // ignore
    }
  }, [historyList]);

  useEffect(() => {
    try {
      localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads.slice(0, 100)));
    } catch {
      // ignore
    }
  }, [downloads]);

  // Check whether any higher-z window overlaps this browser window
  const isCoveredByWindow = useMemo(() => {
    return windows.some((other) => {
      if (other.instanceId === win.instanceId || other.isMinimized || other.zIndex <= win.zIndex) {
        return false;
      }
      if (other.isMaximized || win.isMaximized) return true;
      const ax1 = win.x;
      const ay1 = win.y;
      const ax2 = win.x + win.width;
      const ay2 = win.y + win.height;
      const bx1 = other.x;
      const by1 = other.y;
      const bx2 = other.x + other.width;
      const by2 = other.y + other.height;
      return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
    });
  }, [windows, win.instanceId, win.isMaximized, win.x, win.y, win.width, win.height, win.zIndex]);

  const shouldShowNative =
    isNative &&
    activeTab.url.startsWith('http') &&
    !win.isMinimized &&
    !hasShellOverlay &&
    !isCoveredByWindow &&
    interactingWindowId === null &&
    !menuOpen &&
    !tabMenuOpen &&
    !installAppModal;

  const shouldShowNativeRef = useRef(shouldShowNative);
  shouldShowNativeRef.current = shouldShowNative;

  const syncBoundsNow = useCallback(() => {
    if (!isNative || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const tab = activeTabRef.current;
    if (!tab || !tab.url.startsWith('http') || !createdWebViewsRef.current.has(tab.id)) return;
    void EmbeddedWebView.setBounds({
      id: tab.id,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }, [isNative]);

  const scheduleSyncBounds = useCallback(() => {
    if (!isNative) return;
    if (rafSyncRef.current !== null) {
      cancelAnimationFrame(rafSyncRef.current);
    }
    rafSyncRef.current = requestAnimationFrame(() => {
      rafSyncRef.current = null;
      syncBoundsNow();
    });
  }, [isNative, syncBoundsNow]);

  // Helper to create or navigate a native tab WebView
  const ensureOrLoadNativeTab = useCallback(
    async (tab: Tab, url: string) => {
      if (!isNative || !url.startsWith('http')) return;
      const rect = viewportRef.current?.getBoundingClientRect() || {
        left: win.x,
        top: win.y + 80,
        width: win.width,
        height: Math.max(120, win.height - 90),
      };
      const visibleNow = shouldShowNativeRef.current && activeTabRef.current?.id === tab.id;

      if (!createdWebViewsRef.current.has(tab.id)) {
        createdWebViewsRef.current.add(tab.id);
        setTabs((prev) =>
          prev.map((t) => (t.id === tab.id ? { ...t, nativeCreated: true } : t))
        );
        try {
          await EmbeddedWebView.create({
            id: tab.id,
            url,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            devicePixelRatio: window.devicePixelRatio || 1,
            desktopMode: tab.desktopMode,
            incognito: tab.incognito,
            zoom: tab.zoom,
            visible: visibleNow,
          });
        } catch {
          createdWebViewsRef.current.delete(tab.id);
        }
      } else {
        try {
          await EmbeddedWebView.setBounds({
            id: tab.id,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            devicePixelRatio: window.devicePixelRatio || 1,
          });
          await EmbeddedWebView.loadUrl({ id: tab.id, url });
          if (visibleNow) {
            await EmbeddedWebView.show({ id: tab.id });
          }
        } catch {
          // ignore
        }
      }
    },
    [isNative, win.height, win.width, win.x, win.y]
  );

  // Destroy native WebView for a tab
  const destroyNativeTab = useCallback(
    async (tabId: string) => {
      if (!isNative || !createdWebViewsRef.current.has(tabId)) return;
      createdWebViewsRef.current.delete(tabId);
      try {
        await EmbeddedWebView.destroy({ id: tabId });
      } catch {
        // ignore
      }
    },
    [isNative]
  );

  // Initial creation if launched directly onto a URL (e.g. Web App shortcut or link)
  useEffect(() => {
    if (!isNative) return;
    const initTab = tabsRef.current[0];
    if (initTab && initTab.url.startsWith('http')) {
      const id = window.setTimeout(() => {
        void ensureOrLoadNativeTab(initTab, initTab.url);
      }, 30);
      return () => window.clearTimeout(id);
    }
  }, [ensureOrLoadNativeTab, isNative]);

  // Destroy all native WebViews when browser window closes
  useEffect(() => {
    const createdSet = createdWebViewsRef.current;
    return () => {
      if (rafSyncRef.current !== null) {
        cancelAnimationFrame(rafSyncRef.current);
      }
      if (!isNative) return;
      Array.from(createdSet).forEach((tabId) => {
        void EmbeddedWebView.destroy({ id: tabId }).catch(() => {});
      });
      createdSet.clear();
    };
  }, [isNative]);

  // Show/hide native WebViews cleanly when active tab, window focus, drag, minimize, or overlays change
  useEffect(() => {
    if (!isNative) return;

    createdWebViewsRef.current.forEach((tabId) => {
      if (tabId !== activeTab.id || !shouldShowNative) {
        void EmbeddedWebView.hide({ id: tabId }).catch(() => {});
      }
    });

    if (shouldShowNative && activeTab.url.startsWith('http')) {
      if (!createdWebViewsRef.current.has(activeTab.id)) {
        void ensureOrLoadNativeTab(activeTab, activeTab.url);
      } else {
        syncBoundsNow();
        void EmbeddedWebView.show({ id: activeTab.id }).catch(() => {});
      }
    }
  }, [
    activeTab,
    ensureOrLoadNativeTab,
    isNative,
    shouldShowNative,
    syncBoundsNow,
  ]);

  // Track Edge container width for responsive toolbar (Phone/narrow vs Tablet/desktop)
  useEffect(() => {
    const el = rootContainerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth || win.width || 360);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number' && w > 0) {
        setContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [win.width]);

  // Ensure chrome is visible on home page, tab switch, open popovers/drawers, or window unmount
  useEffect(() => {
    if (!activeTab.url.startsWith('http') || menuOpen || tabMenuOpen || findBarOpen || drawer || installAppModal) {
      setWindowChromeHidden(win.instanceId, false);
    }
  }, [activeTab.id, activeTab.url, drawer, findBarOpen, installAppModal, menuOpen, setWindowChromeHidden, tabMenuOpen, win.instanceId]);

  useEffect(() => {
    return () => {
      setWindowChromeHidden(win.instanceId, false);
    };
  }, [setWindowChromeHidden, win.instanceId]);

  // Apply global Browser text & page zoom updates from Settings > Display
  const lastAppliedGlobalZoomRef = useRef<number>(defaultZoom);
  useEffect(() => {
    if (lastAppliedGlobalZoomRef.current === defaultZoom) return;
    lastAppliedGlobalZoomRef.current = defaultZoom;
    setTabs((prev) => prev.map((t) => ({ ...t, zoom: defaultZoom })));
    if (isNative) {
      createdWebViewsRef.current.forEach((tabId) => {
        void EmbeddedWebView.setZoom({ id: tabId, zoom: defaultZoom }).catch(() => {});
      });
    }
  }, [defaultZoom, isNative]);

  // Observe placeholder div resizing, window moves, scroll events, keyboard/visualViewport, and UI scale changes
  useEffect(() => {
    if (!isNative) return;
    const el = viewportRef.current;
    const ro = el ? new ResizeObserver(() => scheduleSyncBounds()) : null;
    if (el && ro) ro.observe(el);

    window.addEventListener('resize', scheduleSyncBounds);
    window.addEventListener('scroll', scheduleSyncBounds, true);
    window.visualViewport?.addEventListener('resize', scheduleSyncBounds);
    window.visualViewport?.addEventListener('scroll', scheduleSyncBounds);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', scheduleSyncBounds);
      window.removeEventListener('scroll', scheduleSyncBounds, true);
      window.visualViewport?.removeEventListener('resize', scheduleSyncBounds);
      window.visualViewport?.removeEventListener('scroll', scheduleSyncBounds);
    };
  }, [isNative, scheduleSyncBounds, activeTab.id]);

  useEffect(() => {
    if (shouldShowNative) {
      scheduleSyncBounds();
    }
  }, [
    shouldShowNative,
    scheduleSyncBounds,
    win.x,
    win.y,
    win.width,
    win.height,
    win.isMaximized,
    settings.resolutionScale,
    settings.uiSize,
    isChromeHidden,
    isNarrow,
    focusModeWindowId,
    drawer,
    findBarOpen,
    tabMenuOpen,
  ]);

  // Open URL in a new tab inside the SAME browser window
  const openUrlInNewTab = useCallback(
    (url: string, incognito = false) => {
      const newId = makeTabId();
      const normalized = normalizeAddressInput(url, searchEngine);
      const meta = normalized.startsWith('http') ? getSiteMeta(normalized) : null;
      const title =
        normalized === 'edge://home' ? 'New tab' : meta?.siteName || normalized;
      const newTab: Tab = {
        id: newId,
        title,
        url: normalized,
        incognito,
        desktopMode: false,
        zoom: defaultZoom,
        progress: normalized.startsWith('http') ? 15 : 0,
        isLoading: normalized.startsWith('http'),
        canGoBack: false,
        canGoForward: false,
        nativeCreated: false,
        historyStack: [normalized],
        historyIndex: 0,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      setAddressInput(normalized);
      setTabMenuOpen(false);
      setWindowChromeHidden(win.instanceId, false);

      if (normalized.startsWith('http') && !incognito) {
        setHistoryList((prev) => [
          { id: `h-${Date.now()}`, title, url: normalized, visitedAt: Date.now() },
          ...prev,
        ]);
      }

      if (isNative && normalized.startsWith('http')) {
        window.setTimeout(() => {
          void ensureOrLoadNativeTab(newTab, normalized);
        }, 20);
      }
    },
    [defaultZoom, ensureOrLoadNativeTab, isNative, makeTabId, searchEngine, setWindowChromeHidden, win.instanceId]
  );

  const openUrlInNewTabRef = useRef(openUrlInNewTab);
  openUrlInNewTabRef.current = openUrlInNewTab;

  // Register EmbeddedWebView native event listeners
  useEffect(() => {
    if (!isNative) return;
    let active = true;
    const handles: PluginListenerHandle[] = [];

    const ownsTab = (tabId: string) => tabsRef.current.some((t) => t.id === tabId);

    (async () => {
      handles.push(
        await EmbeddedWebView.addListener('urlChanged', (ev) => {
          if (!active || !ownsTab(ev.id)) return;
          setTabs((prev) =>
            prev.map((t) =>
              t.id === ev.id
                ? {
                    ...t,
                    url: ev.url,
                    canGoBack: ev.canGoBack ?? t.canGoBack,
                    canGoForward: ev.canGoForward ?? t.canGoForward,
                  }
                : t
            )
          );
          if (activeTabRef.current?.id === ev.id) {
            setAddressInput(ev.url);
          }
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('titleChanged', (ev) => {
          if (!active || !ownsTab(ev.id) || !ev.title) return;
          setTabs((prev) =>
            prev.map((t) => (t.id === ev.id ? { ...t, title: ev.title } : t))
          );
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('progressChanged', (ev) => {
          if (!active || !ownsTab(ev.id)) return;
          setTabs((prev) =>
            prev.map((t) =>
              t.id === ev.id
                ? { ...t, progress: ev.progress, isLoading: ev.progress < 100 }
                : t
            )
          );
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('loadStarted', (ev) => {
          if (!active || !ownsTab(ev.id)) return;
          setTabs((prev) =>
            prev.map((t) =>
              t.id === ev.id ? { ...t, url: ev.url || t.url, isLoading: true, progress: 15 } : t
            )
          );
          if (activeTabRef.current?.id === ev.id && ev.url) {
            setAddressInput(ev.url);
          }
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('loadFinished', (ev) => {
          if (!active || !ownsTab(ev.id)) return;
          const targetTab = tabsRef.current.find((t) => t.id === ev.id);
          const cleanTitle = ev.title || getSiteMeta(ev.url).siteName;
          setTabs((prev) =>
            prev.map((t) =>
              t.id === ev.id
                ? {
                    ...t,
                    url: ev.url || t.url,
                    title: cleanTitle || t.title,
                    isLoading: false,
                    progress: 100,
                    canGoBack: ev.canGoBack,
                    canGoForward: ev.canGoForward,
                  }
                : t
            )
          );
          if (activeTabRef.current?.id === ev.id && ev.url) {
            setAddressInput(ev.url);
          }
          if (targetTab && !targetTab.incognito && ev.url && ev.url.startsWith('http')) {
            setHistoryList((prev) => {
              if (prev[0]?.url === ev.url) return prev;
              return [
                {
                  id: `h-${Date.now()}`,
                  title: cleanTitle || ev.url,
                  url: ev.url,
                  visitedAt: Date.now(),
                },
                ...prev,
              ];
            });
          }
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('faviconReceived', (ev) => {
          if (!active || !ownsTab(ev.id) || !ev.favicon) return;
          setTabs((prev) =>
            prev.map((t) => (t.id === ev.id ? { ...t, favicon: ev.favicon } : t))
          );
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('downloadStarted', (ev) => {
          if (!active || !ownsTab(ev.id)) return;
          const item: BrowserDownloadItem = {
            id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            filename: ev.filename,
            url: ev.url,
            mimeType: ev.mimeType,
            contentLength: ev.contentLength,
            timestamp: ev.timestamp || Date.now(),
          };
          setDownloads((prev) => [item, ...prev]);
          addNotification('Microsoft Edge', 'Download started', `${ev.filename} saved to Android Downloads.`);
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('newWindowRequested', (ev) => {
          if (!active || !ownsTab(ev.id) || !ev.url) return;
          const sourceTab = tabsRef.current.find((t) => t.id === ev.id);
          openUrlInNewTabRef.current(ev.url, Boolean(sourceTab?.incognito));
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('findResults', (ev) => {
          if (!active || activeTabRef.current?.id !== ev.id) return;
          setFindMatchInfo({
            active: ev.numberOfMatches > 0 ? ev.activeMatchOrdinal + 1 : 0,
            total: ev.numberOfMatches,
          });
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('scrollDirection', (ev) => {
          if (!active || activeTabRef.current?.id !== ev.id) return;
          if (ev.direction === 'down') {
            if (!overlayLockRef.current && activeTabRef.current?.url.startsWith('http')) {
              setWindowChromeHidden(win.instanceId, true);
            }
          } else if (ev.direction === 'up' || ev.direction === 'top') {
            setWindowChromeHidden(win.instanceId, false);
          }
        })
      );

      handles.push(
        await EmbeddedWebView.addListener('keyboardChanged', () => {
          if (!active) return;
          scheduleSyncBounds();
        })
      );
    })();

    return () => {
      active = false;
      handles.forEach((h) => {
        void h.remove().catch(() => {});
      });
    };
  }, [addNotification, isNative, scheduleSyncBounds, setWindowChromeHidden, win.instanceId]);

  // Sync address bar & non-native web iframe fallback on tab change
  useEffect(() => {
    setAddressInput(activeTab.url);
    if (isNative) return;

    if (!activeTab.url.startsWith('http')) {
      setWebIframeStatus('idle');
      return;
    }
    const meta = getSiteMeta(activeTab.url);
    if (meta.isWebIframeBlocked) {
      setWebIframeStatus('blocked');
      return;
    }
    setWebIframeStatus('loading');
    const timeoutId = window.setTimeout(() => {
      setWebIframeStatus((prev) => (prev === 'loading' ? 'timeout' : prev));
    }, IFRAME_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab.id, activeTab.url, isNative, reloadTick]);

  const navigateTab = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;
    const target = normalizeAddressInput(trimmed, searchEngine);
    const meta = target.startsWith('http') ? getSiteMeta(target) : null;
    const title =
      target === 'edge://home'
        ? 'New tab'
        : meta?.siteName || target.replace(/^https?:\/\//, '').split('/')[0];

    const updatedTab: Tab = {
      ...activeTab,
      title,
      url: target,
      isLoading: target.startsWith('http'),
      progress: target.startsWith('http') ? 15 : 0,
      historyStack: [...activeTab.historyStack.slice(0, activeTab.historyIndex + 1), target],
      historyIndex: activeTab.historyIndex + 1,
    };

    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? updatedTab : t)));
    setAddressInput(target);

    if (target === 'edge://home') {
      void destroyNativeTab(activeTab.id);
      setWebIframeStatus('idle');
      return;
    }

    if (!activeTab.incognito) {
      setHistoryList((prev) => [
        { id: `h-${Date.now()}`, title, url: target, visitedAt: Date.now() },
        ...prev,
      ]);
    }

    if (isNative) {
      void ensureOrLoadNativeTab(updatedTab, target);
    } else if (meta?.isWebIframeBlocked) {
      setWebIframeStatus('blocked');
      window.open(target, '_blank', 'noopener,noreferrer');
    } else {
      setWebIframeStatus('loading');
      setReloadTick((t) => t + 1);
    }
  };

  const handleBack = async () => {
    if (isNative && createdWebViewsRef.current.has(activeTab.id)) {
      const res = await EmbeddedWebView.goBack({ id: activeTab.id }).catch(() => ({ handled: false }));
      if (res.handled) return;
    }
    if (activeTab.historyIndex <= 0) return;
    const nextIdx = activeTab.historyIndex - 1;
    const prevUrl = activeTab.historyStack[nextIdx];
    const meta = prevUrl.startsWith('http') ? getSiteMeta(prevUrl) : null;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url: prevUrl,
              historyIndex: nextIdx,
              title: prevUrl === 'edge://home' ? 'New tab' : meta?.siteName || prevUrl,
              canGoBack: nextIdx > 0,
              canGoForward: nextIdx < t.historyStack.length - 1,
            }
          : t
      )
    );
    if (prevUrl === 'edge://home') {
      void destroyNativeTab(activeTab.id);
    } else if (isNative) {
      void ensureOrLoadNativeTab({ ...activeTab, url: prevUrl }, prevUrl);
    }
  };

  const handleForward = async () => {
    if (isNative && createdWebViewsRef.current.has(activeTab.id)) {
      const res = await EmbeddedWebView.goForward({ id: activeTab.id }).catch(() => ({ handled: false }));
      if (res.handled) return;
    }
    if (activeTab.historyIndex >= activeTab.historyStack.length - 1) return;
    const nextIdx = activeTab.historyIndex + 1;
    const nextUrl = activeTab.historyStack[nextIdx];
    const meta = nextUrl.startsWith('http') ? getSiteMeta(nextUrl) : null;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url: nextUrl,
              historyIndex: nextIdx,
              title: nextUrl === 'edge://home' ? 'New tab' : meta?.siteName || nextUrl,
              canGoBack: nextIdx > 0,
              canGoForward: nextIdx < t.historyStack.length - 1,
            }
          : t
      )
    );
    if (isNative && nextUrl.startsWith('http')) {
      void ensureOrLoadNativeTab({ ...activeTab, url: nextUrl }, nextUrl);
    }
  };

  const handleReloadOrStop = () => {
    if (!activeTab.url.startsWith('http')) return;
    if (isNative && createdWebViewsRef.current.has(activeTab.id)) {
      if (activeTab.isLoading) {
        void EmbeddedWebView.stop({ id: activeTab.id });
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: false, progress: 0 } : t))
        );
      } else {
        void EmbeddedWebView.reload({ id: activeTab.id });
      }
      return;
    }
    setReloadTick((t) => t + 1);
  };

  const addTab = (incognito = false) => {
    const id = makeTabId();
    setTabs((prev) => [
      ...prev,
      {
        id,
        title: incognito ? 'InPrivate tab' : 'New tab',
        url: 'edge://home',
        incognito,
        desktopMode: false,
        zoom: defaultZoom,
        progress: 0,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        nativeCreated: false,
        historyStack: ['edge://home'],
        historyIndex: 0,
      },
    ]);
    setActiveTabId(id);
    setMenuOpen(false);
    setTabMenuOpen(false);
    setWindowChromeHidden(win.instanceId, false);
  };

  const closeTab = (id: string) => {
    void destroyNativeTab(id);
    if (tabs.length === 1) {
      const resetId = makeTabId();
      setTabs([
        {
          id: resetId,
          title: 'New tab',
          url: 'edge://home',
          incognito: false,
          desktopMode: false,
          zoom: defaultZoom,
          progress: 0,
          isLoading: false,
          canGoBack: false,
          canGoForward: false,
          nativeCreated: false,
          historyStack: ['edge://home'],
          historyIndex: 0,
        },
      ]);
      setActiveTabId(resetId);
      setTabMenuOpen(false);
      setWindowChromeHidden(win.instanceId, false);
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (activeTabId === id) {
      setActiveTabId(next[Math.max(0, idx - 1)].id);
    }
  };

  const toggleDesktopMode = () => {
    const nextEnabled = !activeTab.desktopMode;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, desktopMode: nextEnabled } : t))
    );
    if (isNative && createdWebViewsRef.current.has(activeTab.id)) {
      void EmbeddedWebView.setDesktopMode({ id: activeTab.id, enabled: nextEnabled });
    }
  };

  const adjustZoom = (delta: number) => {
    const nextZoom = Math.max(50, Math.min(200, activeTab.zoom + delta));
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, zoom: nextZoom } : t))
    );
    if (isNative && createdWebViewsRef.current.has(activeTab.id)) {
      void EmbeddedWebView.setZoom({ id: activeTab.id, zoom: nextZoom });
    }
  };

  const runFind = (query: string, forward = true) => {
    if (!isNative || !createdWebViewsRef.current.has(activeTab.id)) return;
    void EmbeddedWebView.findInPage({
      id: activeTab.id,
      query,
      forward,
      clear: !query,
    });
    if (!query) {
      setFindMatchInfo({ active: 0, total: 0 });
    }
  };

  const closeFindBar = () => {
    setFindBarOpen(false);
    setFindQuery('');
    setFindMatchInfo({ active: 0, total: 0 });
    if (isNative && createdWebViewsRef.current.has(activeTab.id)) {
      void EmbeddedWebView.findInPage({ id: activeTab.id, query: '', clear: true });
    }
  };

  const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);
  const toggleBookmark = () => {
    if (!activeTab.url.startsWith('http')) return;
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
    } else {
      setBookmarks((prev) => [
        ...prev,
        { id: `bm-${Date.now()}`, title: activeTab.title, url: activeTab.url },
      ]);
    }
  };

  const handleCopyOrShare = async (mode: 'copy' | 'share') => {
    const targetUrl = activeTab.url;
    setMenuOpen(false);
    if (!targetUrl.startsWith('http')) return;
    if (mode === 'share' && navigator.share) {
      try {
        await navigator.share({ title: activeTab.title, url: targetUrl });
        return;
      } catch {
        // fallback to copy
      }
    }
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleClearCookiesAndCache = async () => {
    setMenuOpen(false);
    setHistoryList([]);
    setDownloads([]);
    if (isNative) {
      try {
        await EmbeddedWebView.clearData();
      } catch {
        // ignore
      }
    }
    addNotification('Microsoft Edge', 'Browsing data cleared', 'Cookies, cache, downloads list, and history cleared.');
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyList;
    return historyList.filter(
      (h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)
    );
  }, [historyList, historySearch]);

  const renderWebPreviewFallback = (url: string, reason: 'blocked' | 'timeout') => {
    const meta = getSiteMeta(url);
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-[#1b1b1c] dark:to-[#141414] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-[#232325] border border-neutral-200 dark:border-neutral-700 shadow-lg p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-sky-500/10 text-[#0078D7] flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">{meta.siteName}</div>
            <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate">{meta.hostname}</div>
          </div>
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300">
            {reason === 'timeout'
              ? 'This page blocked embedded display in web preview. Open it in a new browser tab, or install the Android APK for full embedded WebView browsing.'
              : 'Web browser security blocks iframe embedding for this site in web preview. In the Android APK it loads directly inside this window.'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0078D7] hover:bg-[#106EBE] text-white text-xs font-medium cursor-pointer"
            >
              <span>Open in new tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigateTab('edge://home')}
              className="px-3.5 py-2.5 border border-neutral-300 dark:border-neutral-600 text-xs cursor-pointer"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderNewTabHome = () => (
    <div
      className={`h-full overflow-y-auto p-5 sm:p-8 flex flex-col items-center ${
        activeTab.incognito
          ? 'bg-gradient-to-b from-[#1f222a] to-[#121318] text-white'
          : 'bg-gradient-to-b from-sky-50 to-white dark:from-[#161a20] dark:to-[#121212]'
      }`}
    >
      <div className="w-full max-w-2xl mt-2 sm:mt-6 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xl sm:text-2xl font-light">
            {activeTab.incognito ? (
              <EyeOff className="w-6 h-6 text-sky-400" />
            ) : (
              <Globe className="w-6 h-6 text-[#0078D7]" />
            )}
            <span>{activeTab.incognito ? 'InPrivate Browsing' : 'Microsoft Edge'}</span>
          </div>
          <p className="text-xs opacity-70">
            {activeTab.incognito
              ? 'Tabs in this session do not record Edge browsing history or cache.'
              : isNative
              ? 'Full embedded Android WebView — browse any website right inside this window.'
              : `Search with ${searchEngine.charAt(0).toUpperCase() + searchEngine.slice(1)} or enter any URL.`}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigateTab(searchInput);
            setSearchInput('');
          }}
          className="flex items-center bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 shadow-md px-3.5 h-10 text-neutral-900 dark:text-white"
        >
          <Search className="w-4 h-4 text-neutral-400 mr-2.5 shrink-0" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search ${searchEngine.charAt(0).toUpperCase() + searchEngine.slice(1)} or enter web address...`}
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
          />
          <button
            type="submit"
            className="px-3.5 py-1 bg-[#0078D7] text-white text-xs font-medium hover:bg-[#106EBE] cursor-pointer shrink-0"
          >
            Go
          </button>
        </form>

        <div>
          <h3 className="text-xs font-semibold opacity-70 mb-2.5">Top Sites</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {NEW_TAB_SHORTCUTS.map((sc) => (
              <button
                key={sc.url}
                onClick={() => navigateTab(sc.url)}
                className="flex flex-col items-center gap-2 p-3 bg-white/90 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 hover:border-[#0078D7] transition-colors cursor-pointer"
              >
                <div
                  style={{ backgroundColor: sc.color }}
                  className="w-9 h-9 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-sm"
                >
                  {sc.badge}
                </div>
                <span className="text-[11px] font-medium truncate w-full text-center text-neutral-800 dark:text-neutral-100">
                  {sc.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {bookmarks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold opacity-70 mb-2">Bookmarks</h3>
            <div className="flex flex-wrap gap-2">
              {bookmarks.map((bm) => (
                <button
                  key={bm.id}
                  onClick={() => navigateTab(bm.url)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-neutral-800/75 border border-neutral-200 dark:border-neutral-700 hover:border-[#0078D7] text-xs text-neutral-800 dark:text-neutral-100 cursor-pointer"
                >
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="truncate max-w-[140px]">{bm.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderViewport = () => {
    if (activeTab.url === 'edge://home') {
      return renderNewTabHome();
    }

    if (isNative) {
      // Transparent placeholder; native Android EmbeddedWebView sits pixel-aligned right above this div
      return (
        <div
          data-embedded-webview-placeholder={activeTab.id}
          data-native-webview-active={shouldShowNative ? 'true' : 'false'}
          className="w-full h-full bg-transparent flex items-center justify-center"
        >
          {!shouldShowNative && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 px-4 py-2 bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-700 shadow-sm">
              {activeTab.title} · {activeTab.url}
            </div>
          )}
        </div>
      );
    }

    // Web preview fallback (non-native browser)
    if (webIframeStatus === 'blocked') {
      return renderWebPreviewFallback(activeTab.url, 'blocked');
    }
    if (webIframeStatus === 'timeout') {
      return renderWebPreviewFallback(activeTab.url, 'timeout');
    }
    return (
      <div className="relative w-full h-full flex flex-col bg-white">
        {webIframeStatus === 'loading' && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-200 dark:bg-neutral-800 overflow-hidden z-10">
            <div className="h-full w-1/3 bg-[#0078D7] animate-pulse" />
          </div>
        )}
        <iframe
          key={`${activeTab.id}-${activeTab.url}-${reloadTick}`}
          src={activeTab.url}
          title={activeTab.title}
          onLoad={() => setWebIframeStatus('loaded')}
          onError={() => setWebIframeStatus('timeout')}
          className="flex-1 w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    );
  };

  return (
    <div
      ref={rootContainerRef}
      onMouseDown={() => {
        if (menuOpen) setMenuOpen(false);
        if (tabMenuOpen) setTabMenuOpen(false);
      }}
      className="flex flex-col h-full bg-neutral-100 dark:bg-[#202020] text-neutral-900 dark:text-neutral-100 relative"
    >
      {/* Wide Tab Strip (hidden in standalone web-app mode, narrow Phone mode, or auto-hidden chrome) */}
      {!standaloneUrl && !isNarrow && !isChromeHidden && (
        <div
          className={`flex items-center gap-1 px-2 pt-1 border-b overflow-x-auto no-scrollbar ${
            activeTab.incognito
              ? 'bg-[#171920] border-neutral-800'
              : 'bg-neutral-200 dark:bg-[#1a1a1a] border-neutral-300 dark:border-neutral-800'
          }`}
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-1.5 max-w-[175px] min-w-[96px] h-7 px-2 text-[11.5px] cursor-pointer transition-colors ${
                  active
                    ? 'bg-neutral-100 dark:bg-[#2b2b2b] text-neutral-900 dark:text-white border-t-2 border-t-[#0078D7]'
                    : 'hover:bg-neutral-300/60 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {tab.incognito ? (
                  <EyeOff className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                ) : tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-3.5 h-3.5 shrink-0 rounded-[2px]" />
                ) : (
                  <Globe className="w-3.5 h-3.5 shrink-0 text-[#0078D7]" />
                )}
                <span className="truncate flex-1">{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button
            onClick={() => addTab(false)}
            className="w-7 h-7 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer"
            title="New tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => addTab(true)}
            className="w-7 h-7 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer"
            title="New InPrivate tab"
          >
            <EyeOff className="w-3.5 h-3.5 opacity-75" />
          </button>
        </div>
      )}

      {/* Navigation & Address Bar */}
      {!isChromeHidden && (
        <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-neutral-100 dark:bg-[#2b2b2b] border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <button
            onClick={() => void handleBack()}
            disabled={!activeTab.canGoBack && activeTab.historyIndex <= 0}
            className="min-w-[30px] h-7 sm:p-1.5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer shrink-0"
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => void handleForward()}
            disabled={!activeTab.canGoForward && activeTab.historyIndex >= activeTab.historyStack.length - 1}
            className="min-w-[30px] h-7 sm:p-1.5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer shrink-0"
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReloadOrStop}
            className="min-w-[30px] h-7 sm:p-1.5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0"
            title={activeTab.isLoading ? 'Stop loading' : 'Reload'}
          >
            {activeTab.isLoading ? <X className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
          </button>
          {!standaloneUrl && !isNarrow && (
            <button
              onClick={() => navigateTab('edge://home')}
              className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0"
              title="Home"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigateTab(addressInput);
            }}
            className={`flex-1 flex items-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus-within:border-[#0078D7] px-2 h-7 ${
              isNarrow ? 'min-w-[50%]' : 'min-w-0'
            }`}
          >
            {activeTab.incognito && (
              <span className="px-1.5 py-0.5 mr-1 text-[9.5px] font-semibold bg-sky-600 text-white shrink-0">
                InPrivate
              </span>
            )}
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full bg-transparent text-xs outline-none min-w-0"
              placeholder="Search or enter URL"
            />
            {activeTab.url.startsWith('http') && !isNarrow && (
              <button
                type="button"
                onClick={toggleBookmark}
                className="p-1 text-neutral-400 hover:text-amber-500 cursor-pointer shrink-0"
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
              >
                <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
            )}
          </form>

          {/* Compact Tabs Switcher Button (narrow / Phone windows) */}
          {!standaloneUrl && isNarrow && (
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setTabMenuOpen((o) => !o);
                }}
                className={`min-w-[30px] h-7 px-1.5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
                  tabMenuOpen ? 'bg-black/10 dark:bg-white/15' : ''
                }`}
                title="Switch tabs"
              >
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold border-[1.5px] border-current rounded-[3px] leading-none">
                  {tabs.length}
                </span>
              </button>

              {tabMenuOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1 w-64 max-w-[calc(100vw-24px)] max-h-[70vh] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 shadow-2xl z-50 py-1.5 text-xs"
                >
                  <div className="px-3 py-1.5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
                    <span className="font-semibold text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#0078D7]" /> Open tabs ({tabs.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => addTab(false)}
                        className="px-2 py-0.5 bg-[#0078D7] text-white text-[10.5px] hover:bg-[#106EBE] cursor-pointer"
                        title="New tab"
                      >
                        + New
                      </button>
                      <button
                        onClick={() => addTab(true)}
                        className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
                        title="New InPrivate tab"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="py-1">
                    {tabs.map((tab) => {
                      const active = tab.id === activeTab.id;
                      return (
                        <div
                          key={tab.id}
                          onClick={() => {
                            setActiveTabId(tab.id);
                            setTabMenuOpen(false);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                            active
                              ? 'bg-[#0078D7]/15 text-[#0078D7] dark:text-sky-400 font-medium'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          {tab.incognito ? (
                            <EyeOff className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                          ) : tab.favicon ? (
                            <img src={tab.favicon} alt="" className="w-3.5 h-3.5 shrink-0 rounded-[2px]" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 shrink-0 text-[#0078D7]" />
                          )}
                          <span className="truncate flex-1">{tab.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.id);
                            }}
                            className="p-1 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                            title="Close tab"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wide-mode inline toolbar controls (hidden when narrow to preserve Address Bar >= 50%) */}
          {!isNarrow && (
            <>
              <button
                onClick={toggleDesktopMode}
                className={`p-1.5 cursor-pointer shrink-0 ${
                  activeTab.desktopMode
                    ? 'bg-[#0078D7] text-white'
                    : 'hover:bg-black/10 dark:hover:bg-white/10'
                }`}
                title={activeTab.desktopMode ? 'Desktop site: ON' : 'Desktop site: OFF (Mobile view)'}
              >
                {activeTab.desktopMode ? (
                  <Laptop className="w-3.5 h-3.5" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5" />
                )}
              </button>

              {activeTab.url.startsWith('http') && isNative && (
                <button
                  onClick={() => {
                    if (findBarOpen) closeFindBar();
                    else setFindBarOpen(true);
                  }}
                  className={`p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0 ${
                    findBarOpen ? 'bg-black/10 dark:bg-white/15' : ''
                  }`}
                  title="Find in page"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => toggleFocusMode(win.instanceId)}
                className={`p-1.5 cursor-pointer shrink-0 ${
                  isFocusedMode
                    ? 'bg-[#0078D7] text-white'
                    : 'hover:bg-black/10 dark:hover:bg-white/10'
                }`}
                title={isFocusedMode ? 'Exit Focus mode' : 'Focus mode (Full screen & auto-hide taskbar)'}
              >
                {isFocusedMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {!standaloneUrl && (
                <>
                  <button
                    onClick={() => setDrawer((d) => (d === 'bookmarks' ? null : 'bookmarks'))}
                    className={`p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0 ${
                      drawer === 'bookmarks' ? 'bg-black/10 dark:bg-white/15' : ''
                    }`}
                    title="Bookmarks"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDrawer((d) => (d === 'history' ? null : 'history'))}
                    className={`p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0 ${
                      drawer === 'history' ? 'bg-black/10 dark:bg-white/15' : ''
                    }`}
                    title="History"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDrawer((d) => (d === 'downloads' ? null : 'downloads'))}
                    className={`p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0 ${
                      drawer === 'downloads' ? 'bg-black/10 dark:bg-white/15' : ''
                    }`}
                    title="Downloads"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}

          {/* More Menu (...) */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setTabMenuOpen(false);
                setMenuOpen((o) => !o);
              }}
              className={`min-w-[30px] h-7 sm:p-1.5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
                menuOpen ? 'bg-black/10 dark:bg-white/15' : ''
              }`}
              title="Settings and more"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-64 max-w-[calc(100vw-24px)] max-h-[72vh] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 shadow-2xl z-50 py-1.5 text-xs"
              >
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
                  <span className="font-medium">Zoom</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustZoom(-15)}
                      className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center tabular-nums">{activeTab.zoom}%</span>
                    <button
                      onClick={() => adjustZoom(15)}
                      className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Focus Mode & Desktop Site */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    toggleFocusMode(win.instanceId);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    {isFocusedMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFocusedMode ? 'Exit Focus mode' : 'Focus mode (Full screen)'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    toggleDesktopMode();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    {activeTab.desktopMode ? <Laptop className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                    Desktop site
                  </span>
                  <span className="text-[10.5px] font-semibold opacity-80">
                    {activeTab.desktopMode ? 'ON' : 'OFF'}
                  </span>
                </button>

                {activeTab.url.startsWith('http') && (
                  <button
                    onClick={() => {
                      toggleBookmark();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                  >
                    <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
                    {isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
                  </button>
                )}

                {!standaloneUrl && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigateTab('edge://home');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                  >
                    <Home className="w-3.5 h-3.5" /> New tab page
                  </button>
                )}

                {activeTab.url.startsWith('http') && isNative && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (findBarOpen) closeFindBar();
                      else setFindBarOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" /> Find in page
                  </button>
                )}

                {!standaloneUrl && (
                  <>
                    <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setDrawer((d) => (d === 'bookmarks' ? null : 'bookmarks'));
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" /> Bookmarks
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setDrawer((d) => (d === 'history' ? null : 'history'));
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" /> History
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setDrawer((d) => (d === 'downloads' ? null : 'downloads'));
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Downloads
                    </button>
                    <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                    <button
                      onClick={() => addTab(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> New tab
                    </button>
                    <button
                      onClick={() => addTab(true)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" /> New InPrivate tab
                    </button>
                    {activeTab.url.startsWith('http') && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          openUrlInNewTab(activeTab.url, activeTab.incognito);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open link in new tab
                      </button>
                    )}
                  </>
                )}

                {activeTab.url.startsWith('http') && (
                  <>
                    <button
                      onClick={() => void handleCopyOrShare('copy')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy link
                    </button>
                    <button
                      onClick={() => void handleCopyOrShare('share')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share link
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setInstallAppTitle(activeTab.title);
                        setInstallAppModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Install site as Desktop app
                    </button>
                  </>
                )}

                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <div className="px-3 py-1.5 space-y-1">
                  <div className="text-[10.5px] text-neutral-500">Search engine</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['google', 'bing', 'duckduckgo'] as SearchEngine[]).map((eng) => (
                      <button
                        key={eng}
                        onClick={() => updateSettings({ searchEngine: eng })}
                        className={`py-1 text-[10.5px] capitalize border cursor-pointer ${
                          searchEngine === eng
                            ? 'bg-[#0078D7] text-white border-[#0078D7]'
                            : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        {eng === 'duckduckgo' ? 'DDG' : eng}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    openApp('settings', { settingsTab: 'display' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" /> Display &amp; UI size settings
                </button>
                <button
                  onClick={() => void handleClearCookiesAndCache()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear cookies &amp; cache
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Progress Bar */}
      {activeTab.url.startsWith('http') && activeTab.isLoading && (
        <div className="h-[2.5px] w-full bg-neutral-200 dark:bg-neutral-800 shrink-0 overflow-hidden">
          <div
            style={{ width: `${Math.max(12, activeTab.progress)}%` }}
            className="h-full bg-[#0078D7] transition-all duration-150"
          />
        </div>
      )}

      {/* Find in Page Bar */}
      {findBarOpen && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-700 text-xs shrink-0">
          <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              runFind(e.target.value, true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runFind(findQuery, !e.shiftKey);
              if (e.key === 'Escape') closeFindBar();
            }}
            placeholder="Find on page..."
            className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-1 outline-none min-w-0"
          />
          <span className="text-[11px] tabular-nums text-neutral-500">
            {findMatchInfo.total > 0 ? `${findMatchInfo.active}/${findMatchInfo.total}` : '0/0'}
          </span>
          <button
            onClick={() => runFind(findQuery, false)}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
            title="Previous match"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => runFind(findQuery, true)}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
            title="Next match"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={closeFindBar}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
            title="Close find bar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bookmarks Bar (hidden on narrow Phone windows or auto-hidden chrome) */}
      {!standaloneUrl && !isNarrow && !isChromeHidden && bookmarks.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-[#252525] border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar shrink-0">
          {bookmarks.map((bm) => (
            <button
              key={bm.id}
              onClick={() => navigateTab(bm.url)}
              className="px-2 py-0.5 text-[11px] hover:bg-black/10 dark:hover:bg-white/10 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {bm.title}
            </button>
          ))}
        </div>
      )}

      {/* Copied Toast */}
      {copiedToast && (
        <div className="absolute top-12 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs shadow-lg">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Link copied</span>
        </div>
      )}

      {/* Page Area + Side Drawer */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        <div ref={viewportRef} className="flex-1 min-w-0 h-full relative">
          {renderViewport()}
        </div>

        {drawer && (
          <div className="w-64 shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex flex-col">
            <div className="p-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-semibold capitalize">{drawer}</span>
              <div className="flex items-center gap-1">
                {drawer === 'history' && historyList.length > 0 && (
                  <button
                    onClick={() => setHistoryList([])}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    title="Clear history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {drawer === 'downloads' && downloads.length > 0 && (
                  <button
                    onClick={() => setDownloads([])}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    title="Clear downloads list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setDrawer(null)} className="p-1 cursor-pointer" title="Close drawer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {drawer === 'history' && (
              <div className="p-2 border-b border-neutral-200 dark:border-neutral-800">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search history..."
                  className="w-full px-2.5 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {drawer === 'bookmarks' &&
                (bookmarks.length === 0 ? (
                  <p className="text-xs text-neutral-500 p-2">No bookmarks yet.</p>
                ) : (
                  bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="flex items-center justify-between gap-1 p-2 hover:bg-black/5 dark:hover:bg-white/5 text-xs"
                    >
                      <button
                        onClick={() => navigateTab(bm.url)}
                        className="truncate text-left flex-1 cursor-pointer"
                      >
                        {bm.title}
                      </button>
                      <button
                        onClick={() => setBookmarks((prev) => prev.filter((b) => b.id !== bm.id))}
                        className="p-1 opacity-50 hover:opacity-100 cursor-pointer"
                        title="Remove bookmark"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ))}

              {drawer === 'history' &&
                (filteredHistory.length === 0 ? (
                  <p className="text-xs text-neutral-500 p-2">No history items.</p>
                ) : (
                  filteredHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigateTab(item.url)}
                      className="w-full text-left p-2 hover:bg-black/5 dark:hover:bg-white/5 text-xs cursor-pointer"
                    >
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="truncate text-[10px] text-neutral-500">{item.url}</div>
                    </button>
                  ))
                ))}

              {drawer === 'downloads' &&
                (downloads.length === 0 ? (
                  <p className="text-xs text-neutral-500 p-2">
                    Files downloaded in Edge are saved to your device Downloads folder and listed here.
                  </p>
                ) : (
                  downloads.map((dl) => (
                    <div
                      key={dl.id}
                      className="p-2 bg-white dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-xs space-y-0.5"
                    >
                      <div className="font-medium truncate">{dl.filename}</div>
                      <div className="text-[10px] text-neutral-500 truncate">
                        {formatBytes(dl.contentLength)} · {new Date(dl.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Install Site as Desktop App Dialog */}
      {installAppModal && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              installWebApp(installAppTitle || activeTab.title, activeTab.url, '#0078D7');
              setInstallAppModal(false);
            }}
            className="w-full max-w-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-4 shadow-2xl space-y-3"
          >
            <div className="text-sm font-semibold">Install site as Desktop app</div>
            <input
              type="text"
              autoFocus
              value={installAppTitle}
              onChange={(e) => setInstallAppTitle(e.target.value)}
              placeholder="App title"
              className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setInstallAppModal(false)}
                className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0078D7] text-white cursor-pointer"
              >
                Install
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
