import React, { useState } from 'react';
import { Check, Download, Globe, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { STORE_GAMES } from '../../data/apps';
import { StoreGameId } from '../../types/os';
import { AppIcon } from '../icons/WinIcons';

export const MicrosoftStoreApp: React.FC = () => {
  const {
    settings,
    installStoreApp,
    uninstallStoreApp,
    installWebApp,
    uninstallWebApp,
    openApp,
  } = useOS();

  const [tab, setTab] = useState<'games' | 'webapps' | 'library'>('games');
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<Record<string, number>>({});

  // Web app installer state
  const [webTitle, setWebTitle] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [webColor, setWebColor] = useState('#0078D7');

  const games = Object.values(STORE_GAMES).filter(
    (g) =>
      g.title.toLowerCase().includes(search.trim().toLowerCase()) ||
      g.tagline.toLowerCase().includes(search.trim().toLowerCase())
  );

  const startInstall = (id: StoreGameId) => {
    if (installing[id] !== undefined) return;
    setInstalling((prev) => ({ ...prev, [id]: 8 }));
    let pct = 8;
    const timer = setInterval(() => {
      pct += Math.floor(14 + Math.random() * 18);
      if (pct >= 100) {
        clearInterval(timer);
        setInstalling((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        installStoreApp(id);
      } else {
        setInstalling((prev) => ({ ...prev, [id]: pct }));
      }
    }, 180);
  };

  const handleInstallWebApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webTitle.trim() || !webUrl.trim()) return;
    installWebApp(webTitle, webUrl, webColor);
    setWebTitle('');
    setWebUrl('');
    setTab('library');
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-[#171717] text-neutral-900 dark:text-neutral-100">
      {/* Top Bar */}
      <div className="shrink-0 px-4 py-2.5 bg-white dark:bg-[#202020] border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-xs">
          {[
            { id: 'games', label: 'Games & Apps' },
            { id: 'webapps', label: 'Install Website App' },
            {
              id: 'library',
              label: `Library (${settings.installedStoreApps.length + settings.installedWebApps.length})`,
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-3 py-1.5 font-medium cursor-pointer ${
                tab === t.id
                  ? 'bg-[#0078D7] text-white'
                  : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-2.5 h-8 w-full sm:w-56 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps & games"
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'games' && (
          <div className="space-y-6">
            {/* Featured Banner */}
            <div className="p-6 bg-gradient-to-r from-[#004E8C] via-[#0078D7] to-[#008272] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs opacity-80">Microsoft Store · Free Collection</div>
                <h2 className="text-2xl font-light">Classic Arcade &amp; Strategy Games</h2>
                <p className="text-xs opacity-85 max-w-md">
                  Install lightweight offline games directly to your Start menu and Desktop, or pin any website as a standalone desktop app.
                </p>
              </div>
              <button
                onClick={() => setTab('webapps')}
                className="px-4 py-2 bg-white text-[#004E8C] text-xs font-semibold hover:bg-white/90 shrink-0 cursor-pointer"
              >
                + Add Website App
              </button>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((g) => {
                const isInstalled = settings.installedStoreApps.includes(g.id);
                const pct = installing[g.id];
                return (
                  <div
                    key={g.id}
                    className="p-4 bg-white dark:bg-[#222222] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <AppIcon appId={g.id} size={48} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{g.title}</div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {g.publisher} · {g.sizeLabel}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-amber-500 mt-0.5">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{g.rating}</span>
                          <span className="text-neutral-400 ml-1">Free</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      {g.tagline}
                    </p>

                    {pct !== undefined ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] text-neutral-500 tabular-nums">
                          <span>Installing...</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-[#0078D7] transition-all duration-150"
                          />
                        </div>
                      </div>
                    ) : isInstalled ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openApp(g.id)}
                          className="flex-1 py-1.5 bg-[#0078D7] hover:bg-[#106EBE] text-white text-xs font-medium cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => uninstallStoreApp(g.id)}
                          className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 text-xs transition-colors cursor-pointer"
                          title="Uninstall"
                        >
                          Uninstall
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startInstall(g.id)}
                        className="w-full py-1.5 bg-[#0078D7] hover:bg-[#106EBE] text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Get / Install
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'webapps' && (
          <div className="max-w-lg mx-auto bg-white dark:bg-[#222222] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#0078D7] text-white flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Install Website as Desktop App</h3>
                <p className="text-xs text-neutral-500">
                  Creates a standalone app shortcut in your Start menu and Desktop.
                </p>
              </div>
            </div>

            <form onSubmit={handleInstallWebApp} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">App Name</label>
                <input
                  type="text"
                  required
                  value={webTitle}
                  onChange={(e) => setWebTitle(e.target.value)}
                  placeholder="e.g., Wikipedia"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Website URL</label>
                <input
                  type="text"
                  required
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Tile Color</label>
                <div className="flex items-center gap-2">
                  {['#0078D7', '#107C10', '#D13438', '#5C2D91', '#CA5010', '#008272'].map((hex) => (
                    <button
                      type="button"
                      key={hex}
                      onClick={() => setWebColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 cursor-pointer flex items-center justify-center text-white ${
                        webColor === hex ? 'ring-2 ring-offset-2 ring-[#0078D7]' : ''
                      }`}
                    >
                      {webColor === hex && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#0078D7] hover:bg-[#106EBE] text-white font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Install Web App
              </button>
            </form>
          </div>
        )}

        {tab === 'library' && (
          <div className="space-y-3 max-w-2xl">
            <h3 className="text-sm font-semibold">Installed Store &amp; Web Apps</h3>
            {settings.installedStoreApps.length === 0 && settings.installedWebApps.length === 0 ? (
              <p className="text-xs text-neutral-500">No Store apps or Web shortcuts installed yet.</p>
            ) : (
              <div className="space-y-2">
                {settings.installedStoreApps.map((id) => {
                  const g = STORE_GAMES[id];
                  if (!g) return null;
                  return (
                    <div
                      key={id}
                      className="p-3 bg-white dark:bg-[#222222] border border-neutral-200 dark:border-neutral-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <AppIcon appId={id} size={32} />
                        <div>
                          <div className="text-xs font-semibold">{g.title}</div>
                          <div className="text-[11px] text-neutral-500">{g.sizeLabel}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openApp(id)}
                          className="px-3 py-1 bg-[#0078D7] text-white text-xs cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => uninstallStoreApp(id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          title="Uninstall"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {settings.installedWebApps.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 bg-white dark:bg-[#222222] border border-neutral-200 dark:border-neutral-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AppIcon appId={w.id} size={32} webColor={w.color} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{w.title}</div>
                        <div className="text-[11px] text-neutral-500 truncate">{w.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openApp(w.id)}
                        className="px-3 py-1 bg-[#0078D7] text-white text-xs cursor-pointer"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => uninstallWebApp(w.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Uninstall"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
