import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FilePlus,
  FolderPlus,
  Monitor,
  Paintbrush,
  RefreshCw,
  Eye,
  Trash2,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { AppIcon } from '../icons/WinIcons';
import { ROOT_IDS } from '../../utils/vfs';
import { AppId, VfsNode } from '../../types/os';

export const Desktop: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const {
    settings,
    updateSettings,
    desktopIcons,
    moveDesktopIcon,
    refreshDesktop,
    desktopRefreshTick,
    vfsNodes,
    createVfsFolder,
    createVfsFile,
    openApp,
    openFileWithDefaultApp,
    closeAllOverlays,
    isMobile,
    getAppDefinition,
    uninstallStoreApp,
    uninstallWebApp,
    setContextMenuOpen,
  } = useOS();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetIconId?: string;
    targetVfsId?: string;
  } | null>(null);
  const [viewSubmenu, setViewSubmenu] = useState(false);
  const [newSubmenu, setNewSubmenu] = useState(false);
  const [newModal, setNewModal] = useState<{ type: 'folder' | 'file'; name: string } | null>(null);
  const [dragIconId, setDragIconId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 768
  );

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setContextMenuOpen(Boolean(contextMenu || newModal));
    return () => setContextMenuOpen(false);
  }, [contextMenu, newModal, setContextMenuOpen]);

  // Also show user-created VFS items inside Desktop folder
  const vfsDesktopItems = useMemo(() => {
    return vfsNodes.filter((n) => n.parentId === ROOT_IDS.DESKTOP && !n.isTrashed);
  }, [vfsNodes]);

  const uiScale = (settings.resolutionScale || 100) / 100;
  const baseIconDims =
    settings.desktopIconSize === 'large'
      ? { cellW: 98, cellH: 108, iconSize: 44 }
      : settings.desktopIconSize === 'small'
      ? { cellW: 76, cellH: 82, iconSize: 28 }
      : { cellW: 86, cellH: 96, iconSize: 36 };

  const iconDims = {
    cellW: Math.round(baseIconDims.cellW * uiScale),
    cellH: Math.round(baseIconDims.cellH * uiScale),
    iconSize: Math.round(baseIconDims.iconSize * uiScale),
  };
  const padOffset = Math.round(12 * uiScale);
  const maxRows = Math.max(2, Math.floor((viewportH - 64 * uiScale) / iconDims.cellH));

  const handleDesktopMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    closeAllOverlays();
    setContextMenu(null);
    if ((e.target as HTMLElement).dataset.desktopSurface === 'true') {
      setSelectedIds([]);
      setMarquee({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    }
  };

  useEffect(() => {
    if (!marquee) return;
    const onMove = (e: MouseEvent) => {
      setMarquee((m) => (m ? { ...m, x2: e.clientX, y2: e.clientY } : null));
    };
    const onUp = () => setMarquee(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [marquee]);

  const handleContextMenu = (e: React.MouseEvent, iconId?: string, vfsId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    closeAllOverlays();
    setViewSubmenu(false);
    setNewSubmenu(false);
    const menuW = 210;
    const menuH = 230;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 52);
    setContextMenu({ x, y, targetIconId: iconId, targetVfsId: vfsId });
  };

  const launchDesktopIcon = (icon: (typeof desktopIcons)[number]) => {
    if (icon.type === 'app') {
      openApp(icon.targetId as AppId);
    } else {
      openApp('explorer', { initialPath: icon.targetId });
    }
  };

  const [mouseDragPreview, setMouseDragPreview] = useState<{
    iconId: string;
    x: number;
    y: number;
  } | null>(null);
  const suppressNextIconClickRef = useRef(false);

  const startIconMouseDrag = (e: React.MouseEvent, iconId: string, curCol: number, curRow: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const surfaceEl = (e.currentTarget as HTMLElement).parentElement;
    const rect = surfaceEl?.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const iconLeft = (rect?.left || 0) + padOffset + curCol * iconDims.cellW;
    const iconTop = (rect?.top || 0) + padOffset + curRow * iconDims.cellH;
    const offsetX = startX - iconLeft;
    const offsetY = startY - iconTop;
    let moved = false;

    const onMove = (ev: MouseEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      moved = true;
      setMouseDragPreview({
        iconId,
        x: ev.clientX - offsetX,
        y: ev.clientY - offsetY,
      });
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved && rect) {
        suppressNextIconClickRef.current = true;
        window.setTimeout(() => {
          suppressNextIconClickRef.current = false;
        }, 60);
        const col = Math.floor((ev.clientX - rect.left - padOffset) / iconDims.cellW);
        const row = Math.floor((ev.clientY - rect.top - padOffset) / iconDims.cellH);
        moveDesktopIcon(iconId, col, row);
      }
      setMouseDragPreview(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleDropIcon = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragIconId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left - padOffset) / iconDims.cellW);
    const row = Math.floor((e.clientY - rect.top - padOffset) / iconDims.cellH);
    moveDesktopIcon(dragIconId, col, row);
    setDragIconId(null);
  };

  const createDesktopItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModal) return;
    const trimmed = newModal.name.trim();
    if (!trimmed) return;
    if (newModal.type === 'folder') {
      await createVfsFolder(ROOT_IDS.DESKTOP, trimmed);
    } else {
      const fileName = trimmed.includes('.') ? trimmed : `${trimmed}.txt`;
      await createVfsFile(ROOT_IDS.DESKTOP, fileName, '', 'text/plain');
    }
    setNewModal(null);
  };

  const isGradient = settings.wallpaper.startsWith('linear-gradient');
  const paddingClass =
    settings.taskbarPosition === 'top'
      ? 'pt-11'
      : settings.taskbarPosition === 'left'
      ? 'pl-[3.25rem]'
      : settings.taskbarPosition === 'right'
      ? 'pr-[3.25rem]'
      : 'pb-11';

  const maxDesktopCol = desktopIcons.reduce(
    (mx, ic) => Math.max(mx, ic.col + Math.floor(ic.row / maxRows)),
    0
  );
  const vfsBaseCol = Math.max(2, maxDesktopCol + 1);

  const targetApp = contextMenu?.targetIconId
    ? desktopIcons.find((d) => d.id === contextMenu.targetIconId)
    : undefined;
  const targetAppDef = targetApp?.type === 'app' ? getAppDefinition(targetApp.targetId as AppId) : undefined;

  return (
    <div
      data-desktop-surface="true"
      onMouseDown={handleDesktopMouseDown}
      onContextMenu={(e) => handleContextMenu(e)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropIcon}
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).dataset.desktopSurface === 'true') {
          const touch = e.touches[0];
          longPressTimerRef.current = window.setTimeout(() => {
            setContextMenu({
              x: Math.min(touch.clientX, window.innerWidth - 216),
              y: Math.min(touch.clientY, window.innerHeight - 250),
            });
          }, 550);
        }
      }}
      onTouchEnd={() => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }}
      style={
        isGradient
          ? { background: settings.wallpaper }
          : {
              backgroundImage: `url(${settings.wallpaper})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
      }
      className={`relative w-dvw h-dvh overflow-hidden select-none pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] ${paddingClass}`}
    >
      {/* Desktop Icons Layer */}
      {settings.showDesktopIcons && (
        <div
          key={desktopRefreshTick}
          data-desktop-surface="true"
          className="relative w-full h-full p-2 sm:p-3"
        >
          {/* Mobile responsive flex grid when mouseMode is off vs Desktop positioned grid */}
          {isMobile && !settings.mouseMode ? (
            <div data-desktop-surface="true" className="grid grid-cols-4 gap-2 pt-2">
              {desktopIcons.map((icon) => {
                const def = icon.type === 'app' ? getAppDefinition(icon.targetId as AppId) : undefined;
                return (
                  <button
                    key={icon.id}
                    data-desktop-icon="true"
                    title={icon.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      launchDesktopIcon(icon);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-sm hover:bg-white/15 active:bg-white/25 text-white transition-colors"
                  >
                    <AppIcon
                      appId={
                        icon.targetId === ROOT_IDS.THIS_PC
                          ? 'this-pc'
                          : icon.targetId === ROOT_IDS.RECYCLE_BIN
                          ? 'recycle-bin'
                          : icon.targetId === ROOT_IDS.DOCUMENTS
                          ? 'documents'
                          : (icon.targetId as AppId)
                      }
                      size={36}
                      webColor={def?.webColor}
                    />
                    <span className="text-[11px] leading-tight text-center line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      {icon.label}
                    </span>
                  </button>
                );
              })}
              {vfsDesktopItems.map((node) => (
                <button
                  key={node.id}
                  data-desktop-icon="true"
                  title={node.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    openFileWithDefaultApp(node);
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-sm hover:bg-white/15 text-white"
                >
                  <AppIcon appId={node.type === 'folder' ? 'documents' : 'notepad'} size={36} />
                  <span className="text-[11px] leading-tight text-center line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {node.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {desktopIcons.map((icon) => {
                const isSelected = selectedIds.includes(icon.id);
                const def = icon.type === 'app' ? getAppDefinition(icon.targetId as AppId) : undefined;
                const iconVisualId =
                  icon.targetId === ROOT_IDS.THIS_PC
                    ? 'this-pc'
                    : icon.targetId === ROOT_IDS.RECYCLE_BIN
                    ? 'recycle-bin'
                    : icon.targetId === ROOT_IDS.DOCUMENTS
                    ? 'documents'
                    : (icon.targetId as AppId);
                const isDraggingThis = mouseDragPreview?.iconId === icon.id;
                const effectiveCol = icon.col + Math.floor(icon.row / maxRows);
                const effectiveRow = icon.row % maxRows;

                return (
                  <div
                    key={icon.id}
                    data-desktop-icon="true"
                    title={icon.label}
                    draggable={!settings.mouseMode}
                    onDragStart={() => setDragIconId(icon.id)}
                    onMouseDown={(e) => startIconMouseDrag(e, icon.id, effectiveCol, effectiveRow)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (suppressNextIconClickRef.current) return;
                      setSelectedIds([icon.id]);
                      setContextMenu(null);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      launchDesktopIcon(icon);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, icon.id)}
                    style={
                      isDraggingThis && mouseDragPreview
                        ? {
                            left: mouseDragPreview.x,
                            top: mouseDragPreview.y,
                            width: iconDims.cellW - 4,
                            height: iconDims.cellH - 4,
                            zIndex: 50,
                          }
                        : {
                            left: padOffset + effectiveCol * iconDims.cellW,
                            top: padOffset + effectiveRow * iconDims.cellH,
                            width: iconDims.cellW - 4,
                            height: iconDims.cellH - 4,
                          }
                    }
                    className={`absolute flex flex-col items-center justify-center gap-1.5 p-1.5 rounded-sm border text-white cursor-default transition-colors ${
                      isSelected || isDraggingThis
                        ? 'bg-white/20 border-white/40 backdrop-blur-[2px]'
                        : 'border-transparent hover:bg-white/10 hover:border-white/15'
                    }`}
                  >
                    <AppIcon appId={iconVisualId} size={iconDims.iconSize} webColor={def?.webColor} />
                    <span className="text-[0.72rem] leading-tight text-center line-clamp-2 break-words w-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                      {icon.label}
                    </span>
                  </div>
                );
              })}

              {vfsDesktopItems.map((node: VfsNode, idx) => {
                const col = vfsBaseCol + Math.floor(idx / maxRows);
                const row = idx % maxRows;
                const isSelected = selectedIds.includes(node.id);
                return (
                  <div
                    key={node.id}
                    data-desktop-icon="true"
                    title={node.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIds([node.id]);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      openFileWithDefaultApp(node);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, undefined, node.id)}
                    style={{
                      left: padOffset + col * iconDims.cellW,
                      top: padOffset + row * iconDims.cellH,
                      width: iconDims.cellW - 4,
                      height: iconDims.cellH - 4,
                    }}
                    className={`absolute flex flex-col items-center justify-center gap-1.5 p-1.5 rounded-sm border text-white cursor-default transition-colors ${
                      isSelected
                        ? 'bg-white/20 border-white/40 backdrop-blur-[2px]'
                        : 'border-transparent hover:bg-white/10 hover:border-white/15'
                    }`}
                  >
                    <AppIcon
                      appId={node.type === 'folder' ? 'documents' : 'notepad'}
                      size={iconDims.iconSize}
                    />
                    <span className="text-[0.72rem] leading-tight text-center line-clamp-2 break-words w-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                      {node.name}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Selection Marquee Box */}
      {marquee && (
        <div
          style={{
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1),
          }}
          className="pointer-events-none fixed z-10 border border-[#0078D7] bg-[#0078D7]/25"
        />
      )}

      {/* Windows and Overlays */}
      {children}

      {/* Desktop Right-Click Context Menu */}
      {contextMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-[9500] w-52 bg-neutral-100/95 dark:bg-neutral-900/95 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 shadow-2xl py-1 text-xs backdrop-blur-xl"
        >
          {targetApp ? (
            <>
              <button
                onClick={() => {
                  launchDesktopIcon(targetApp);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-2 text-left font-medium hover:bg-[#0078D7] hover:text-white cursor-pointer"
              >
                Open
              </button>
              {(targetAppDef?.isStoreGame || targetAppDef?.isWebApp) && (
                <button
                  onClick={() => {
                    if (targetAppDef.isStoreGame) {
                      uninstallStoreApp(targetAppDef.id as Parameters<typeof uninstallStoreApp>[0]);
                    } else if (targetAppDef.isWebApp) {
                      uninstallWebApp(targetAppDef.id as Parameters<typeof uninstallWebApp>[0]);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Uninstall
                </button>
              )}
              <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
            </>
          ) : null}

          <div
            onMouseEnter={() => {
              setViewSubmenu(true);
              setNewSubmenu(false);
            }}
            className="relative"
          >
            <button
              onClick={() => setViewSubmenu((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Eye className="w-3.5 h-3.5 opacity-75" />
                View
              </span>
              <span>›</span>
            </button>
            {viewSubmenu && (
              <div className="absolute left-full top-0 ml-0.5 w-44 bg-neutral-100/95 dark:bg-neutral-900/95 border border-neutral-300 dark:border-neutral-700 shadow-xl py-1">
                {(['large', 'medium', 'small'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      updateSettings({ desktopIconSize: sz });
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#0078D7] hover:text-white capitalize cursor-pointer"
                  >
                    <span>{sz} icons</span>
                    {settings.desktopIconSize === sz && <span>•</span>}
                  </button>
                ))}
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
                <button
                  onClick={() => {
                    updateSettings({ showDesktopIcons: !settings.showDesktopIcons });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                >
                  <span>Show desktop icons</span>
                  {settings.showDesktopIcons && <span>✓</span>}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              refreshDesktop();
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 opacity-75" />
            Refresh
          </button>

          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />

          <div
            onMouseEnter={() => {
              setNewSubmenu(true);
              setViewSubmenu(false);
            }}
            className="relative"
          >
            <button
              onClick={() => setNewSubmenu((n) => !n)}
              className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <FolderPlus className="w-3.5 h-3.5 opacity-75" />
                New
              </span>
              <span>›</span>
            </button>
            {newSubmenu && (
              <div className="absolute left-full top-0 ml-0.5 w-44 bg-neutral-100/95 dark:bg-neutral-900/95 border border-neutral-300 dark:border-neutral-700 shadow-xl py-1">
                <button
                  onClick={() => {
                    setNewModal({ type: 'folder', name: 'New folder' });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                  Folder
                </button>
                <button
                  onClick={() => {
                    setNewModal({ type: 'file', name: 'New Text Document.txt' });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
                >
                  <FilePlus className="w-3.5 h-3.5 text-sky-500" />
                  Text Document
                </button>
              </div>
            )}
          </div>

          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />

          <button
            onClick={() => {
              openApp('settings', { settingsTab: 'display' });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 opacity-75" />
            Display settings
          </button>
          <button
            onClick={() => {
              openApp('settings', { settingsTab: 'personalization' });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#0078D7] hover:text-white cursor-pointer"
          >
            <Paintbrush className="w-3.5 h-3.5 opacity-75" />
            Personalize
          </button>
        </div>
      )}

      {/* Create New Folder/File Inline Modal */}
      {newModal && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 p-4"
        >
          <form
            onSubmit={createDesktopItem}
            className="w-full max-w-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-4 shadow-2xl space-y-3"
          >
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Create {newModal.type === 'folder' ? 'New Folder' : 'New Text File'}
            </h3>
            <input
              type="text"
              autoFocus
              value={newModal.name}
              onChange={(e) => setNewModal({ ...newModal, name: e.target.value })}
              className="w-full px-3 py-1.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white outline-none focus:border-[#0078D7]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewModal(null)}
                className="px-3 py-1.5 text-xs bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:opacity-80 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
