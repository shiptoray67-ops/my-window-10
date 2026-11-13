import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { InAppBrowser, ToolBarType } from '@capgo/inappbrowser';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ExternalLink,
  Globe,
  History,
  Home,
  Minimize2,
  Plus,
  RotateCw,
  Search,
  ShieldAlert,
  Smartphone,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { EdgeBookmark, EdgeHistoryItem, WindowInstance } from '../../types/os';

interface Tab {
  id: string;
  title: string;
  url: string;
  historyStack: string[];
  historyIndex: number;
}

const BOOKMARKS_KEY = 'win10_edge_bookmarks_v1';
const HISTORY_KEY = 'win10_edge_history_v1';
const IFRAME_LOAD_TIMEOUT_MS = 5000;

// Domains known to send X-Frame-Options: DENY/SAMEORIGIN or strict CSP frame-ancestors on web iframes
const IFRAME_BLOCKED_DOMAINS: Array<{ domain: string; label: string }> = [
  { domain: 'm.facebook.com', label: 'Facebook' },
  { domain: 'facebook.com', label: 'Facebook' },
  { domain: 'fb.com', label: 'Facebook' },
  { domain: 'google.com', label: 'Google' },
  { domain: 'youtube.com', label: 'YouTube' },
  { domain: 'youtu.be', label: 'YouTube' },
  { domain: 'instagram.com', label: 'Instagram' },
  { domain: 'twitter.com', label: 'Twitter' },
  { domain: 'x.com', label: 'X (Twitter)' },
  { domain: 'web.whatsapp.com', label: 'WhatsApp' },
  { domain: 'whatsapp.com', label: 'WhatsApp' },
  { domain: 'linkedin.com', label: 'LinkedIn' },
  { domain: 'netflix.com', label: 'Netflix' },
  { domain: 'amazon.com', label: 'Amazon' },
  { domain: 'github.com', label: 'GitHub' },
  { domain: 'reddit.com', label: 'Reddit' },
  { domain: 'discord.com', label: 'Discord' },
  { domain: 'tiktok.com', label: 'TikTok' },
  { domain: 'twitch.tv', label: 'Twitch' },
  { domain: 'spotify.com', label: 'Spotify' },
  { domain: 'bing.com', label: 'Bing' },
  { domain: 'duckduckgo.com', label: 'DuckDuckGo' },
  { domain: 'apple.com', label: 'Apple' },
  { domain: 'microsoft.com', label: 'Microsoft' },
  { domain: 'openai.com', label: 'OpenAI' },
  { domain: 'chatgpt.com', label: 'ChatGPT' },
  { domain: 'paypal.com', label: 'PayPal' },
  { domain: 'dropbox.com', label: 'Dropbox' },
  { domain: 'notion.so', label: 'Notion' },
  { domain: 'figma.com', label: 'Figma' },
  { domain: 'slack.com', label: 'Slack' },
  { domain: 'pinterest.com', label: 'Pinterest' },
  { domain: 'yahoo.com', label: 'Yahoo' },
  { domain: 'zoom.us', label: 'Zoom' },
];

const DEFAULT_BOOKMARKS: EdgeBookmark[] = [
  { id: 'bm-wiki', title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { id: 'bm-w3', title: 'W3Schools', url: 'https://www.w3schools.com/html/default.asp' },
  { id: 'bm-osm', title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html' },
  { id: 'bm-archive', title: 'Internet Archive', url: 'https://archive.org' },
];

const QUICK_LINKS = [
  {
    name: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Main_Page',
    desc: 'Free encyclopedia',
  },
  {
    name: 'W3Schools',
    url: 'https://www.w3schools.com/html/default.asp',
    desc: 'Web tutorials & references',
  },
  {
    name: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org/export/embed.html',
    desc: 'Interactive world map',
  },
  {
    name: 'Internet Archive',
    url: 'https://archive.org',
    desc: 'Digital library of web & media',
  },
];

const POPULAR_SITES = [
  { name: 'Google', url: 'https://www.google.com' },
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: 'Facebook', url: 'https://www.facebook.com' },
  { name: 'Instagram', url: 'https://www.instagram.com' },
  { name: 'GitHub', url: 'https://github.com' },
];

function getSiteMeta(urlStr: string): { hostname: string; siteName: string; isBlocked: boolean } {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    const matched = IFRAME_BLOCKED_DOMAINS.find(
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
    const titleName =
      cleanHost.includes('google.') && searchQ
        ? `Google: ${searchQ}`
        : inferredName || urlStr;

    return {
      hostname: cleanHost,
      siteName: titleName,
      isBlocked: Boolean(matched),
    };
  } catch {
    return { hostname: urlStr, siteName: urlStr, isBlocked: false };
  }
}

function normalizeAddressInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return 'edge://home';
  if (trimmed === 'edge://home') {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const hasSpaces = /\s/.test(trimmed);
  const looksLikeLocalhost = /^localhost(:\d+)?(\/.*)?$/i.test(trimmed);
  const looksLikeDomain =
    !hasSpaces && /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d+)?(\/.*)?$/.test(trimmed);

  if (looksLikeLocalhost) {
    return `http://${trimmed}`;
  }
  if (looksLikeDomain) {
    return `https://${trimmed}`;
  }
  // Treat plain text as a Google search query
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export const EdgeBrowser: React.FC<{
  win: WindowInstance;
  standaloneUrl?: string;
}> = ({ win, standaloneUrl }) => {
  const { minimizeWindow } = useOS();
  const isNative = Capacitor.isNativePlatform();

  const rawInitial = standaloneUrl || win.launchPayload?.url || 'edge://home';
  const normalizedInitial = normalizeAddressInput(rawInitial);
  const initialMeta = normalizedInitial.startsWith('http')
    ? getSiteMeta(normalizedInitial)
    : null;

  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'tab-1',
      title: standaloneUrl
        ? win.title
        : normalizedInitial === 'edge://home'
        ? 'New tab'
        : initialMeta?.siteName || normalizedInitial,
      url: normalizedInitial,
      historyStack: [normalizedInitial],
      historyIndex: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeTabIdRef = useRef(activeTab.id);
  activeTabIdRef.current = activeTab.id;

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
  const [drawer, setDrawer] = useState<'bookmarks' | 'history' | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // 'idle' for edge://home, 'loading' / 'loaded' / 'blocked' / 'timeout' / 'native' for http(s)
  const [pageStatus, setPageStatus] = useState<
    'idle' | 'loading' | 'loaded' | 'blocked' | 'timeout' | 'native'
  >(
    normalizedInitial.startsWith('http')
      ? isNative
        ? 'native'
        : initialMeta?.isBlocked
        ? 'blocked'
        : 'loading'
      : 'idle'
  );
  const [nativeWebViewActive, setNativeWebViewActive] = useState(false);
  const initialAutoOpenedRef = useRef(false);

  const openInNewTab = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const openNativeWebView = useCallback(async (url: string, title?: string) => {
    const meta = getSiteMeta(url);
    try {
      setNativeWebViewActive(true);
      await InAppBrowser.openWebView({
        url,
        title: title || meta.siteName || meta.hostname,
        toolbarType: ToolBarType.NAVIGATION,
        visibleTitle: true,
        showReloadButton: true,
        activeNativeNavigationForWebview: true,
        isPresentAfterPageLoad: false,
      });
    } catch {
      setNativeWebViewActive(false);
    }
  }, []);

  const closeNativeWebView = useCallback(async () => {
    try {
      await InAppBrowser.close();
    } catch {
      // ignore if already dismissed
    } finally {
      setNativeWebViewActive(false);
    }
  }, []);

  // Listen to native InAppBrowser URL navigation & close events so tabs/history stay in sync
  useEffect(() => {
    if (!isNative) return;
    let mounted = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    (async () => {
      try {
        const urlHandle = await InAppBrowser.addListener('urlChangeEvent', (ev) => {
          if (!mounted || !ev?.url || !ev.url.startsWith('http')) return;
          const meta = getSiteMeta(ev.url);
          const curTabId = activeTabIdRef.current;
          setTabs((prev) =>
            prev.map((t) => {
              if (t.id !== curTabId || t.url === ev.url) return t;
              const nextStack = [...t.historyStack.slice(0, t.historyIndex + 1), ev.url];
              return {
                ...t,
                title: meta.siteName,
                url: ev.url,
                historyStack: nextStack,
                historyIndex: nextStack.length - 1,
              };
            })
          );
          setAddressInput(ev.url);
          setHistoryList((prev) => {
            if (prev[0]?.url === ev.url) return prev;
            return [
              { id: `h-${Date.now()}`, title: meta.siteName, url: ev.url, visitedAt: Date.now() },
              ...prev,
            ];
          });
        });
        handles.push(urlHandle);

        const closeHandle = await InAppBrowser.addListener('closeEvent', () => {
          if (mounted) {
            setNativeWebViewActive(false);
          }
        });
        handles.push(closeHandle);
      } catch {
        // ignore outside native runtime
      }
    })();

    return () => {
      mounted = false;
      handles.forEach((h) => {
        h.remove().catch(() => {});
      });
    };
  }, [isNative]);

  // Auto-open on initial launch if launched directly onto a URL (native or blocked web site)
  useEffect(() => {
    if (!initialAutoOpenedRef.current && normalizedInitial.startsWith('http')) {
      initialAutoOpenedRef.current = true;
      if (isNative) {
        void openNativeWebView(normalizedInitial, initialMeta?.siteName);
      } else if (initialMeta?.isBlocked) {
        openInNewTab(normalizedInitial);
      }
    }
  }, [initialMeta?.isBlocked, initialMeta?.siteName, isNative, normalizedInitial, openInNewTab, openNativeWebView]);

  // Sync address bar and evaluate active tab status when switching tabs or reloading
  useEffect(() => {
    setAddressInput(activeTab.url);

    if (!activeTab.url.startsWith('http')) {
      setPageStatus('idle');
      return;
    }

    if (isNative) {
      setPageStatus('native');
      return;
    }

    const meta = getSiteMeta(activeTab.url);
    if (meta.isBlocked) {
      setPageStatus('blocked');
      return;
    }

    setPageStatus('loading');
    const timeoutId = window.setTimeout(() => {
      setPageStatus((prev) => (prev === 'loading' ? 'timeout' : prev));
    }, IFRAME_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab.id, activeTab.url, isNative, reloadTick]);

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
  }, [bookmarks]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyList.slice(0, 60)));
    } catch {
      // ignore
    }
  }, [historyList]);

  const navigateTab = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    const target = normalizeAddressInput(trimmed);
    const meta = target.startsWith('http') ? getSiteMeta(target) : null;

    const title =
      target === 'edge://home'
        ? 'New tab'
        : meta?.siteName || target.replace(/^https?:\/\//, '').split('/')[0];

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTab.id) return t;
        const nextStack = [...t.historyStack.slice(0, t.historyIndex + 1), target];
        return {
          ...t,
          title,
          url: target,
          historyStack: nextStack,
          historyIndex: nextStack.length - 1,
        };
      })
    );
    setAddressInput(target);

    if (target.startsWith('http')) {
      setHistoryList((prev) => [
        { id: `h-${Date.now()}`, title, url: target, visitedAt: Date.now() },
        ...prev,
      ]);

      if (isNative) {
        setPageStatus('native');
        void openNativeWebView(target, title);
      } else if (meta?.isBlocked) {
        setPageStatus('blocked');
        openInNewTab(target);
      } else {
        setPageStatus('loading');
        setReloadTick((t) => t + 1);
      }
    } else {
      setPageStatus('idle');
    }
  };

  const goBack = () => {
    if (activeTab.historyIndex <= 0) return;
    const nextIdx = activeTab.historyIndex - 1;
    const url = activeTab.historyStack[nextIdx];
    const meta = url.startsWith('http') ? getSiteMeta(url) : null;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url,
              historyIndex: nextIdx,
              title: url === 'edge://home' ? 'New tab' : meta?.siteName || url,
            }
          : t
      )
    );
  };

  const goForward = () => {
    if (activeTab.historyIndex >= activeTab.historyStack.length - 1) return;
    const nextIdx = activeTab.historyIndex + 1;
    const url = activeTab.historyStack[nextIdx];
    const meta = url.startsWith('http') ? getSiteMeta(url) : null;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url,
              historyIndex: nextIdx,
              title: url === 'edge://home' ? 'New tab' : meta?.siteName || url,
            }
          : t
      )
    );
  };

  const addTab = () => {
    const id = `tab-${Date.now()}`;
    setTabs((prev) => [
      ...prev,
      { id, title: 'New tab', url: 'edge://home', historyStack: ['edge://home'], historyIndex: 0 },
    ]);
    setActiveTabId(id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      navigateTab('edge://home');
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (activeTabId === id) {
      setActiveTabId(next[Math.max(0, idx - 1)].id);
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

  const renderEmbedBlockedPage = (url: string, reason: 'blocked' | 'timeout') => {
    const meta = getSiteMeta(url);
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-[#1b1b1c] dark:to-[#141414] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-[#232325] border border-neutral-200 dark:border-neutral-700 shadow-lg p-7 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-sky-500/10 text-[#0078D7] flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <div className="text-xl font-semibold text-neutral-900 dark:text-white">
              {meta.siteName}
            </div>
            <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate px-2">
              {meta.hostname}
            </div>
          </div>

          <div className="p-3 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-700 dark:text-neutral-200 space-y-1">
            <div className="font-medium text-neutral-900 dark:text-white">
              This site does not allow embedding
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {reason === 'timeout'
                ? 'The page took too long to respond inside an embedded frame or blocked frame display.'
                : 'In a web browser this site prevents iframe embedding. Package as an Android APK or open it in a new browser tab.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={() => openInNewTab(url)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0078D7] hover:bg-[#106EBE] text-white text-sm font-medium shadow-sm cursor-pointer transition-colors"
            >
              <span>Open in new tab</span>
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigateTab('edge://home')}
              className="px-4 py-3 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium cursor-pointer transition-colors"
            >
              New Tab Home
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderNativeTabCard = (url: string) => {
    const meta = getSiteMeta(url);
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-b from-sky-50 to-white dark:from-[#181b20] dark:to-[#121212] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-[#232325] border border-neutral-200 dark:border-neutral-700 shadow-lg p-6 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#0078D7]/15 text-[#0078D7] flex items-center justify-center">
            <Smartphone className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">
              {meta.siteName}
            </div>
            <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 break-all px-2">
              {url}
            </div>
          </div>

          <div className="p-3 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300">
            Running inside native Android WebView with persistent logins &amp; cookies.
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => void openNativeWebView(url, meta.siteName)}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0078D7] hover:bg-[#106EBE] text-white text-sm font-medium shadow-sm cursor-pointer transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>Open Full-Screen Native Browser</span>
            </button>

            <div className="flex gap-2">
              {nativeWebViewActive && (
                <button
                  onClick={() => void closeNativeWebView()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-medium cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close WebView</span>
                </button>
              )}
              <button
                onClick={() => {
                  void closeNativeWebView();
                  minimizeWindow(win.instanceId);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Back to Desktop</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (activeTab.url === 'edge://home') {
      return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-sky-50 to-white dark:from-[#161a20] dark:to-[#121212] p-6 sm:p-10 flex flex-col items-center">
          <div className="w-full max-w-2xl mt-2 sm:mt-8 space-y-7">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 text-2xl font-light text-neutral-800 dark:text-white">
                <Globe className="w-7 h-7 text-[#0078D7]" />
                <span>Microsoft Edge</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isNative
                  ? 'Android Native WebView active — open any website full screen with persistent logins'
                  : 'Enter any web address (like wikipedia.org or facebook.com) or search with Google'}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigateTab(searchInput);
              }}
              className="flex items-center bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 shadow-md px-4 h-11"
            >
              <Search className="w-4 h-4 text-neutral-400 mr-3 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search Google or enter web address..."
                className="flex-1 bg-transparent text-sm outline-none text-neutral-900 dark:text-white min-w-0"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0078D7] text-white text-xs font-medium hover:bg-[#106EBE] cursor-pointer shrink-0"
              >
                Search
              </button>
            </form>

            <div>
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-3">
                Quick Links
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUICK_LINKS.map((link) => (
                  <button
                    key={link.url}
                    onClick={() => navigateTab(link.url)}
                    className="p-3.5 bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 hover:border-[#0078D7] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                        {link.name}
                      </span>
                      <Globe className="w-3.5 h-3.5 text-[#0078D7]" />
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                      {link.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2.5">
                {isNative
                  ? 'Popular Sites (Full-Screen Native WebView)'
                  : 'Popular Sites (Opens in New Tab on Web / Native in APK)'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SITES.map((site) => (
                  <button
                    key={site.url}
                    onClick={() => navigateTab(site.url)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 hover:border-[#0078D7] text-xs cursor-pointer transition-colors"
                  >
                    <span>{site.name}</span>
                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (pageStatus === 'native') {
      return renderNativeTabCard(activeTab.url);
    }

    if (pageStatus === 'blocked') {
      return renderEmbedBlockedPage(activeTab.url, 'blocked');
    }

    if (pageStatus === 'timeout') {
      return renderEmbedBlockedPage(activeTab.url, 'timeout');
    }

    return (
      <div className="relative w-full h-full flex flex-col bg-white">
        {pageStatus === 'loading' && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-200 dark:bg-neutral-800 overflow-hidden z-10">
            <div className="h-full w-1/3 bg-[#0078D7] animate-pulse" />
          </div>
        )}
        <iframe
          key={`${activeTab.id}-${activeTab.url}-${reloadTick}`}
          src={activeTab.url}
          title={activeTab.title}
          onLoad={() => setPageStatus('loaded')}
          onError={() => setPageStatus('timeout')}
          className="flex-1 w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-neutral-100 dark:bg-[#202020] text-neutral-900 dark:text-neutral-100">
      {/* Tab Strip (hidden in standalone PWA app mode unless user wants tabs) */}
      {!standaloneUrl && (
        <div className="flex items-center gap-1 px-2 pt-1.5 bg-neutral-200 dark:bg-[#1a1a1a] border-b border-neutral-300 dark:border-neutral-800 overflow-x-auto">
          {tabs.map((tab) => {
            const active = tab.id === activeTab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-2 max-w-[190px] min-w-[110px] h-8 px-2.5 text-xs cursor-pointer transition-colors ${
                  active
                    ? 'bg-neutral-100 dark:bg-[#2b2b2b] text-neutral-900 dark:text-white border-t-2 border-t-[#0078D7]'
                    : 'hover:bg-neutral-300/60 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0 text-[#0078D7]" />
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
            onClick={addTab}
            className="w-7 h-7 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer"
            title="New tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation & Address Bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-neutral-100 dark:bg-[#2b2b2b] border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={goBack}
          disabled={activeTab.historyIndex <= 0}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={goForward}
          disabled={activeTab.historyIndex >= activeTab.historyStack.length - 1}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            if (!activeTab.url.startsWith('http')) return;
            if (isNative) {
              void openNativeWebView(activeTab.url, activeTab.title);
            } else if (getSiteMeta(activeTab.url).isBlocked) {
              setPageStatus('blocked');
            } else {
              setReloadTick((t) => t + 1);
            }
          }}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          title="Reload"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        {!standaloneUrl && (
          <button
            onClick={() => navigateTab('edge://home')}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
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
          className="flex-1 flex items-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus-within:border-[#0078D7] px-2.5 h-7 min-w-0"
        >
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="w-full bg-transparent text-xs outline-none min-w-0"
            placeholder="Search Google or enter web address (e.g. facebook.com)"
          />
          {activeTab.url.startsWith('http') && (
            <button
              type="button"
              onClick={toggleBookmark}
              className="p-1 text-neutral-400 hover:text-amber-500 cursor-pointer shrink-0"
              title="Bookmark this page"
            >
              <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          )}
        </form>

        {activeTab.url.startsWith('http') && (
          <button
            onClick={() =>
              isNative
                ? void openNativeWebView(activeTab.url, activeTab.title)
                : openInNewTab(activeTab.url)
            }
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0"
            title={isNative ? 'Open full-screen WebView' : 'Open in new tab'}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => setDrawer((d) => (d === 'bookmarks' ? null : 'bookmarks'))}
          className={`p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
            drawer === 'bookmarks' ? 'bg-black/10 dark:bg-white/15' : ''
          }`}
          title="Favorites"
        >
          <Bookmark className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setDrawer((d) => (d === 'history' ? null : 'history'))}
          className={`p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
            drawer === 'history' ? 'bg-black/10 dark:bg-white/15' : ''
          }`}
          title="History"
        >
          <History className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bookmarks Bar */}
      {!standaloneUrl && bookmarks.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-[#252525] border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
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

      {/* Main Content + Optional Favorites/History Side Drawer */}
      <div className="flex-1 min-h-0 flex relative">
        <div className="flex-1 min-w-0 h-full">{renderBody()}</div>

        {drawer && (
          <div className="w-64 shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex flex-col">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
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
                <button onClick={() => setDrawer(null)} className="p-1 cursor-pointer" title="Close drawer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {drawer === 'bookmarks'
                ? bookmarks.map((bm) => (
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
                : historyList.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigateTab(item.url)}
                      className="w-full text-left p-2 hover:bg-black/5 dark:hover:bg-white/5 text-xs cursor-pointer"
                    >
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="truncate text-[10px] text-neutral-500">{item.url}</div>
                    </button>
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
