import React, { useMemo, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Menu,
  Moon,
  Pin,
  Power,
  RotateCcw,
  Search,
  Settings,
  Lock,
  LogOut,
  Trash2,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { BUILTIN_APPS, STORE_GAMES } from '../../data/apps';
import { AppDefinition, AppId } from '../../types/os';
import { AppIcon } from '../icons/WinIcons';
import { ROOT_IDS } from '../../utils/vfs';

export const StartMenu: React.FC = () => {
  const {
    startMenuOpen,
    setStartMenuOpen,
    searchQuery,
    setSearchQuery,
    settings,
    openApp,
    openFileWithDefaultApp,
    vfsNodes,
    triggerPowerAction,
    setPowerPhase,
    pinToStart,
    unpinFromStart,
    pinToTaskbar,
    unpinFromTaskbar,
    uninstallStoreApp,
    uninstallWebApp,
    isMobile,
  } = useOS();

  const [railExpanded, setRailExpanded] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);
  const [appMenuId, setAppMenuId] = useState<AppId | null>(null);

  const allApps = useMemo<AppDefinition[]>(() => {
    const builtIn = Object.values(BUILTIN_APPS);
    const storeInstalled = settings.installedStoreApps
      .map((id) => STORE_GAMES[id])
      .filter(Boolean);
    const webInstalled: AppDefinition[] = settings.installedWebApps.map((w) => ({
      id: w.id,
      title: w.title,
      category: 'Web Apps',
      defaultWidth: 940,
      defaultHeight: 620,
      isWebApp: true,
      webUrl: w.url,
      webColor: w.color,
    }));
    return [...builtIn, ...storeInstalled, ...webInstalled].sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }, [settings.installedStoreApps, settings.installedWebApps]);

  const groupedApps = useMemo(() => {
    const groups = new Map<string, AppDefinition[]>();
    allApps.forEach((app) => {
      const letter = app.title[0].toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(app);
    });
    return Array.from(groups.entries());
  }, [allApps]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const apps = allApps.filter(
      (a) => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
    const files = vfsNodes
      .filter((n) => !n.isTrashed && !n.isSystem && n.name.toLowerCase().includes(q))
      .slice(0, 8);
    return { apps, files, query: searchQuery.trim() };
  }, [allApps, searchQuery, vfsNodes]);

  if (!startMenuOpen) return null;

  const posClass = isMobile
    ? 'left-0 right-0 bottom-12 top-12 w-full'
    : settings.taskbarPosition === 'top'
    ? 'left-0 top-11 w-[40rem] max-w-[96dvw] h-[33.75rem] max-h-[calc(100dvh-3rem)]'
    : settings.taskbarPosition === 'left'
    ? 'left-[3.25rem] bottom-0 w-[40rem] max-w-[calc(100dvw-3.5rem)] h-[33.75rem] max-h-[calc(100dvh-0.5rem)]'
    : settings.taskbarPosition === 'right'
    ? 'right-[3.25rem] bottom-0 w-[40rem] max-w-[calc(100dvw-3.5rem)] h-[33.75rem] max-h-[calc(100dvh-0.5rem)]'
    : 'left-0 bottom-11 w-[40rem] max-w-[96dvw] h-[33.75rem] max-h-[calc(100dvh-3rem)]';

  const now = new Date();
  const dayNum = now.getDate();
  const weekday = now.toLocaleDateString([], { weekday: 'long' });

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`fixed ${posClass} z-[9200] flex flex-col border border-neutral-300/60 dark:border-white/15 shadow-2xl fluent-acrylic-light dark:fluent-acrylic-dark text-neutral-900 dark:text-white overflow-hidden`}
    >
      {/* Search bar inside Start Menu for mobile or quick filtering */}
      <div className="p-2.5 border-b border-neutral-200/70 dark:border-white/10 flex items-center gap-2 shrink-0">
        <Search className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type here to search apps, files, and settings"
          className="w-full bg-transparent text-xs outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs px-2 py-0.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {searchResults ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div>
            <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
              Apps ({searchResults.apps.length})
            </h4>
            {searchResults.apps.length === 0 ? (
              <p className="text-xs text-neutral-500">No matching apps.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {searchResults.apps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => {
                      openApp(app.id);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-black/10 dark:hover:bg-white/10 text-left cursor-pointer"
                  >
                    <AppIcon appId={app.id} size={26} webColor={app.webColor} />
                    <div>
                      <div className="text-xs font-medium">{app.title}</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {app.category}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
              Documents & Files ({searchResults.files.length})
            </h4>
            {searchResults.files.length === 0 ? (
              <p className="text-xs text-neutral-500">No matching files in your PC.</p>
            ) : (
              <div className="space-y-1">
                {searchResults.files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => {
                      openFileWithDefaultApp(file);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 p-2 hover:bg-black/10 dark:hover:bg-white/10 text-left cursor-pointer"
                  >
                    <AppIcon appId={file.type === 'folder' ? 'documents' : 'notepad'} size={22} />
                    <span className="text-xs truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              openApp('edge', { url: `search://${encodeURIComponent(searchResults.query)}` });
              setSearchQuery('');
            }}
            className="w-full flex items-center gap-3 p-2.5 bg-[#0078D7]/15 hover:bg-[#0078D7]/25 border border-[#0078D7]/30 text-left cursor-pointer"
          >
            <AppIcon appId="edge" size={24} />
            <div className="text-xs">
              Search the web in Microsoft Edge for{' '}
              <span className="font-semibold">&ldquo;{searchResults.query}&rdquo;</span>
            </div>
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Left Navigation Rail */}
          <div
            className={`shrink-0 flex flex-col justify-between border-r border-neutral-200/60 dark:border-white/10 transition-all duration-150 ${
              railExpanded ? 'w-44 bg-black/5 dark:bg-black/25' : 'w-12'
            }`}
          >
            <div>
              <button
                onClick={() => setRailExpanded((e) => !e)}
                className="w-full h-11 flex items-center gap-3 px-3.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title="Expand Start navigation"
              >
                <Menu className="w-4 h-4 shrink-0" />
                {railExpanded && <span className="text-xs font-semibold">START</span>}
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => openApp('settings', { settingsTab: 'accounts' })}
                className="w-full h-11 flex items-center gap-3 px-3 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title={settings.username}
              >
                <img
                  src={settings.avatarUrl}
                  alt={settings.username}
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                />
                {railExpanded && (
                  <span className="text-xs truncate">{settings.username}</span>
                )}
              </button>

              <button
                onClick={() => openApp('explorer', { initialPath: ROOT_IDS.DOCUMENTS })}
                className="w-full h-11 flex items-center gap-3 px-3.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title="Documents"
              >
                <FileText className="w-4 h-4 shrink-0" />
                {railExpanded && <span className="text-xs">Documents</span>}
              </button>

              <button
                onClick={() => openApp('explorer', { initialPath: ROOT_IDS.PICTURES })}
                className="w-full h-11 flex items-center gap-3 px-3.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title="Pictures"
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                {railExpanded && <span className="text-xs">Pictures</span>}
              </button>

              <button
                onClick={() => openApp('settings')}
                className="w-full h-11 flex items-center gap-3 px-3.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title="Settings"
              >
                <Settings className="w-4 h-4 shrink-0" />
                {railExpanded && <span className="text-xs">Settings</span>}
              </button>

              <button
                onClick={() => setPowerOpen((p) => !p)}
                className="w-full h-11 flex items-center gap-3 px-3.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title="Power"
              >
                <Power className="w-4 h-4 shrink-0" />
                {railExpanded && <span className="text-xs">Power</span>}
              </button>

              {powerOpen && (
                <div className="absolute bottom-11 left-1 w-44 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 shadow-2xl py-1 z-30 text-xs">
                  <button
                    onClick={() => {
                      setStartMenuOpen(false);
                      setPowerPhase('lock');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" /> Lock
                  </button>
                  <button
                    onClick={() => {
                      setStartMenuOpen(false);
                      setPowerPhase('login');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                  <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
                  <button
                    onClick={() => triggerPowerAction('sleep')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <Moon className="w-3.5 h-3.5" /> Sleep
                  </button>
                  <button
                    onClick={() => triggerPowerAction('shutdown')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" /> Shut down
                  </button>
                  <button
                    onClick={() => triggerPowerAction('restart')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restart
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* All Apps Alphabetical Column */}
          <div className="w-56 sm:w-60 shrink-0 overflow-y-auto px-2 py-2 border-r border-neutral-200/60 dark:border-white/10">
            <div className="px-2 pb-1 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              All Apps
            </div>
            {groupedApps.map(([letter, apps]) => (
              <div key={letter} className="mb-1">
                <div className="px-2 py-1 text-[11px] font-semibold text-[#0078D7]">
                  {letter}
                </div>
                {apps.map((app) => {
                  const isPinnedStart = settings.pinnedStartApps.includes(app.id);
                  const isPinnedTaskbar = settings.pinnedTaskbarApps.includes(app.id);
                  return (
                    <div key={app.id} className="relative group">
                      <button
                        onClick={() => openApp(app.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setAppMenuId((cur) => (cur === app.id ? null : app.id));
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:bg-black/10 dark:hover:bg-white/10 text-left cursor-pointer"
                      >
                        <AppIcon appId={app.id} size={22} webColor={app.webColor} />
                        <span className="text-xs truncate flex-1">{app.title}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAppMenuId((cur) => (cur === app.id ? null : app.id));
                        }}
                        className="opacity-0 group-hover:opacity-100 absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] hover:bg-black/15 dark:hover:bg-white/15 cursor-pointer"
                        title="App options"
                      >
                        •••
                      </button>

                      {appMenuId === app.id && (
                        <div className="mt-0.5 mb-1 ml-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-lg py-1 text-[11px] z-20">
                          <button
                            onClick={() => {
                              isPinnedStart ? unpinFromStart(app.id) : pinToStart(app.id);
                              setAppMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                          >
                            <Pin className="w-3 h-3" />
                            {isPinnedStart ? 'Unpin from Start' : 'Pin to Start'}
                          </button>
                          <button
                            onClick={() => {
                              isPinnedTaskbar ? unpinFromTaskbar(app.id) : pinToTaskbar(app.id);
                              setAppMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                          >
                            <Pin className="w-3 h-3" />
                            {isPinnedTaskbar ? 'Unpin from taskbar' : 'Pin to taskbar'}
                          </button>
                          {(app.isStoreGame || app.isWebApp) && (
                            <button
                              onClick={() => {
                                if (app.isStoreGame) {
                                  uninstallStoreApp(app.id as Parameters<typeof uninstallStoreApp>[0]);
                                } else if (app.isWebApp) {
                                  uninstallWebApp(app.id as Parameters<typeof uninstallWebApp>[0]);
                                }
                                setAppMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              Uninstall
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Right Pinned Tiles Grid */}
          <div className="hidden sm:block flex-1 overflow-y-auto p-3.5">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2.5">
              Productivity &amp; Live Tiles
            </div>
            <div className="grid grid-cols-3 gap-2">
              {settings.pinnedStartApps.map((appId) => {
                const app = allApps.find((a) => a.id === appId);
                if (!app) return null;

                // Special Live Tiles for Calendar and Weather
                if (app.id === 'calendar') {
                  return (
                    <button
                      key={app.id}
                      onClick={() => openApp('calendar')}
                      style={{ backgroundColor: settings.accentColor }}
                      className="col-span-2 h-24 p-3 flex flex-col justify-between text-white text-left hover:brightness-110 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] opacity-85">{weekday}</span>
                        <AppIcon appId="calendar" size={18} />
                      </div>
                      <div className="text-3xl font-light tabular-nums">{dayNum}</div>
                    </button>
                  );
                }

                if (app.id === 'weather') {
                  return (
                    <button
                      key={app.id}
                      onClick={() => openApp('weather')}
                      className="col-span-2 h-24 p-3 flex flex-col justify-between bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white text-left hover:brightness-110 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium">San Francisco</span>
                        <AppIcon appId="weather" size={20} />
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-light tabular-nums">68°</span>
                        <span className="text-[11px] opacity-85">Partly Sunny</span>
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={app.id}
                    onClick={() => openApp(app.id)}
                    style={{ backgroundColor: `${settings.accentColor}dd` }}
                    className="h-24 p-2.5 flex flex-col items-center justify-between text-white hover:brightness-110 transition-all cursor-pointer shadow-sm"
                  >
                    <div className="flex-1 flex items-center justify-center">
                      <AppIcon appId={app.id} size={32} webColor={app.webColor} />
                    </div>
                    <span className="w-full text-[11px] text-left truncate">{app.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
