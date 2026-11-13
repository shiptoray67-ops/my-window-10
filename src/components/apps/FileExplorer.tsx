import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Clipboard,
  Copy,
  Download,
  Eye,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Grid,
  HardDrive,
  Image as ImageIcon,
  List,
  Music,
  RotateCcw,
  Scissors,
  Search,
  Trash2,
  Upload,
  Video,
  Edit3,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { VfsNode, WindowInstance } from '../../types/os';
import { formatBytes, getBreadcrumbs, getWindowsPath, ROOT_IDS } from '../../utils/vfs';

export const FileExplorer: React.FC<{ win: WindowInstance }> = ({ win }) => {
  const {
    vfsNodes,
    createVfsFolder,
    createVfsFile,
    renameVfsNode,
    trashVfsNodes,
    restoreVfsNodes,
    emptyRecycleBin,
    deleteVfsPermanently,
    copyVfsNodes,
    moveVfsNodes,
    uploadRealFiles,
    openFileWithDefaultApp,
  } = useOS();

  const initialFolder = win.launchPayload?.initialPath || ROOT_IDS.THIS_PC;
  const [navHistory, setNavHistory] = useState<string[]>([initialFolder]);
  const [navIndex, setNavIndex] = useState(0);
  const currentFolderId = navHistory[navIndex];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<{ mode: 'copy' | 'cut'; ids: string[] } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigateTo = (folderId: string) => {
    if (folderId === currentFolderId) return;
    const next = [...navHistory.slice(0, navIndex + 1), folderId];
    setNavHistory(next);
    setNavIndex(next.length - 1);
    setSelectedIds([]);
    setSearchQuery('');
  };

  const goBack = () => {
    if (navIndex > 0) {
      setNavIndex(navIndex - 1);
      setSelectedIds([]);
    }
  };

  const goForward = () => {
    if (navIndex < navHistory.length - 1) {
      setNavIndex(navIndex + 1);
      setSelectedIds([]);
    }
  };

  const goUp = () => {
    if (currentFolderId === ROOT_IDS.THIS_PC || currentFolderId === ROOT_IDS.RECYCLE_BIN) return;
    const cur = vfsNodes.find((n) => n.id === currentFolderId);
    navigateTo(cur?.parentId || ROOT_IDS.THIS_PC);
  };

  const isRecycleBin = currentFolderId === ROOT_IDS.RECYCLE_BIN;

  const currentItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = isRecycleBin
      ? vfsNodes.filter((n) => n.isTrashed)
      : vfsNodes.filter((n) => n.parentId === currentFolderId && !n.isTrashed);

    const filtered = q ? list.filter((n) => n.name.toLowerCase().includes(q)) : list;
    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [currentFolderId, isRecycleBin, searchQuery, vfsNodes]);

  const primarySelected = useMemo(
    () => vfsNodes.find((n) => n.id === selectedIds[0]) || null,
    [selectedIds, vfsNodes]
  );

  const breadcrumbs = useMemo(() => getBreadcrumbs(vfsNodes, currentFolderId), [vfsNodes, currentFolderId]);

  const handleNewFolder = async () => {
    if (isRecycleBin) return;
    const node = await createVfsFolder(currentFolderId, 'New folder');
    setSelectedIds([node.id]);
    setRenamingId(node.id);
    setRenameText(node.name);
  };

  const handleNewTextFile = async () => {
    if (isRecycleBin) return;
    const node = await createVfsFile(currentFolderId, 'New Document.txt', '', 'text/plain');
    setSelectedIds([node.id]);
    setRenamingId(node.id);
    setRenameText(node.name);
  };

  const handlePaste = async () => {
    if (!clipboard || isRecycleBin) return;
    if (clipboard.mode === 'copy') {
      await copyVfsNodes(clipboard.ids, currentFolderId);
    } else {
      await moveVfsNodes(clipboard.ids, currentFolderId);
      setClipboard(null);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    if (isRecycleBin) {
      await deleteVfsPermanently(selectedIds);
    } else {
      await trashVfsNodes(selectedIds);
    }
    setSelectedIds([]);
  };

  const handleDownload = (node: VfsNode) => {
    if (node.type !== 'file') return;
    const content = node.content || '';
    const a = document.createElement('a');
    if (content.startsWith('data:') || content.startsWith('/')) {
      a.href = content;
    } else {
      const blob = new Blob([content], { type: node.mimeType || 'text/plain' });
      a.href = URL.createObjectURL(blob);
    }
    a.download = node.name;
    a.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (renamingId) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && selectedIds.length > 0) {
      e.preventDefault();
      setClipboard({ mode: 'copy', ids: selectedIds });
    } else if (e.ctrlKey && e.key.toLowerCase() === 'x' && selectedIds.length > 0) {
      e.preventDefault();
      setClipboard({ mode: 'cut', ids: selectedIds });
    } else if (e.ctrlKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      handlePaste();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      handleDelete();
    } else if (e.key === 'F2' && primarySelected && !primarySelected.isSystem) {
      e.preventDefault();
      setRenamingId(primarySelected.id);
      setRenameText(primarySelected.name);
    }
  };

  const renderNodeIcon = (node: VfsNode, size = 32) => {
    if (node.type === 'folder') {
      return <Folder style={{ width: size, height: size }} className="text-amber-500 fill-amber-400/80 shrink-0" />;
    }
    const mime = node.mimeType || '';
    const ext = node.name.toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/.test(ext)) {
      return <ImageIcon style={{ width: size, height: size }} className="text-sky-500 shrink-0" />;
    }
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg)$/.test(ext)) {
      return <Music style={{ width: size, height: size }} className="text-rose-500 shrink-0" />;
    }
    if (mime.startsWith('video/') || /\.(mp4|webm)$/.test(ext)) {
      return <Video style={{ width: size, height: size }} className="text-purple-500 shrink-0" />;
    }
    return <FileText style={{ width: size, height: size }} className="text-neutral-500 dark:text-neutral-300 shrink-0" />;
  };

  const sidebarLinks = [
    { id: ROOT_IDS.THIS_PC, label: 'This PC', icon: <HardDrive className="w-4 h-4 text-[#0078D7]" /> },
    { id: ROOT_IDS.DESKTOP, label: 'Desktop', icon: <Folder className="w-4 h-4 text-sky-500" /> },
    { id: ROOT_IDS.DOCUMENTS, label: 'Documents', icon: <Folder className="w-4 h-4 text-amber-500" /> },
    { id: ROOT_IDS.DOWNLOADS, label: 'Downloads', icon: <Folder className="w-4 h-4 text-emerald-500" /> },
    { id: ROOT_IDS.PICTURES, label: 'Pictures', icon: <ImageIcon className="w-4 h-4 text-sky-500" /> },
    { id: ROOT_IDS.MUSIC, label: 'Music', icon: <Music className="w-4 h-4 text-rose-500" /> },
    { id: ROOT_IDS.VIDEOS, label: 'Videos', icon: <Video className="w-4 h-4 text-purple-500" /> },
    { id: ROOT_IDS.RECYCLE_BIN, label: 'Recycle Bin', icon: <Trash2 className="w-4 h-4 text-neutral-500" /> },
  ];

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !isRecycleBin) {
          await uploadRealFiles(currentFolderId, e.dataTransfer.files);
        }
      }}
      className="flex flex-col h-full bg-white dark:bg-[#191919] text-neutral-900 dark:text-neutral-100 outline-none"
    >
      {/* Command Ribbon Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 bg-neutral-100 dark:bg-[#222222] border-b border-neutral-200 dark:border-neutral-800 text-xs">
        {!isRecycleBin ? (
          <>
            <button
              onClick={handleNewFolder}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
              <span>New folder</span>
            </button>
            <button
              onClick={handleNewTextFile}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5 text-sky-500" />
              <span>New file</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-500" />
              <span>Upload</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                if (e.target.files?.length) {
                  await uploadRealFiles(currentFolderId, e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </>
        ) : (
          <>
            <button
              onClick={() => selectedIds.length > 0 && restoreVfsNodes(selectedIds)}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
              <span>Restore selected</span>
            </button>
            <button
              onClick={emptyRecycleBin}
              disabled={currentItems.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Recycle Bin</span>
            </button>
          </>
        )}

        <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        <button
          onClick={() => selectedIds.length && setClipboard({ mode: 'copy', ids: selectedIds })}
          disabled={selectedIds.length === 0 || isRecycleBin}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
          title="Copy (Ctrl+C)"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => selectedIds.length && setClipboard({ mode: 'cut', ids: selectedIds })}
          disabled={selectedIds.length === 0 || isRecycleBin}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
          title="Cut (Ctrl+X)"
        >
          <Scissors className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handlePaste}
          disabled={!clipboard || isRecycleBin}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
          title="Paste (Ctrl+V)"
        >
          <Clipboard className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (primarySelected && !primarySelected.isSystem) {
              setRenamingId(primarySelected.id);
              setRenameText(primarySelected.name);
            }
          }}
          disabled={!primarySelected || primarySelected.isSystem || isRecycleBin}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
          title="Rename (F2)"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => primarySelected && primarySelected.type === 'file' && handleDownload(primarySelected)}
          disabled={!primarySelected || primarySelected.type !== 'file'}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
          title="Download to device"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={selectedIds.length === 0 || selectedIds.some((id) => vfsNodes.find((n) => n.id === id)?.isSystem)}
          className="p-1.5 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 disabled:opacity-35 cursor-pointer"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPreviewOpen((p) => !p)}
            className={`p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
              previewOpen ? 'bg-black/10 dark:bg-white/15' : ''
            }`}
            title="Preview pane"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            title={viewMode === 'grid' ? 'Details list view' : 'Large icons view'}
          >
            {viewMode === 'grid' ? <List className="w-3.5 h-3.5" /> : <Grid className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Navigation + Breadcrumb Address Bar + Search */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={goBack}
            disabled={navIndex <= 0}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={goForward}
            disabled={navIndex >= navHistory.length - 1}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={goUp}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            title="Up one level"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-1 px-2.5 h-7 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs overflow-x-auto">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              {idx > 0 && <span className="text-neutral-400">›</span>}
              <button
                onClick={() => navigateTo(crumb.id)}
                className="hover:underline whitespace-nowrap cursor-pointer"
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 h-7 w-44 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search folder"
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
      </div>

      {/* Body: Sidebar + File Canvas + Preview Pane */}
      <div className="flex-1 min-h-0 flex">
        {/* Left Quick Access Sidebar */}
        <div className="w-40 sm:w-44 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#1e1e1e] overflow-y-auto py-2">
          <div className="px-3 pb-1 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            Quick access
          </div>
          {sidebarLinks.map((item) => (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                if (draggedNodeId && item.id !== ROOT_IDS.RECYCLE_BIN) {
                  await moveVfsNodes([draggedNodeId], item.id);
                  setDraggedNodeId(null);
                }
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left cursor-pointer ${
                currentFolderId === item.id
                  ? 'bg-[#0078D7]/15 text-[#0078D7] font-medium'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Center File View */}
        <div
          onClick={() => setSelectedIds([])}
          className="flex-1 min-w-0 overflow-y-auto p-3"
        >
          {currentItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 gap-2">
              <Folder className="w-10 h-10 opacity-30" />
              <p className="text-xs">
                {isRecycleBin ? 'Recycle Bin is empty.' : 'This folder is empty. Drag files here or click Upload.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {currentItems.map((node) => {
                const isSelected = selectedIds.includes(node.id);
                return (
                  <div
                    key={node.id}
                    draggable={!node.isSystem && !isRecycleBin}
                    onDragStart={() => setDraggedNodeId(node.id)}
                    onDragOver={(e) => node.type === 'folder' && e.preventDefault()}
                    onDrop={async (e) => {
                      e.stopPropagation();
                      if (node.type === 'folder' && draggedNodeId && draggedNodeId !== node.id) {
                        await moveVfsNodes([draggedNodeId], node.id);
                        setDraggedNodeId(null);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIds([node.id]);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (isRecycleBin) return;
                      if (node.type === 'folder') navigateTo(node.id);
                      else openFileWithDefaultApp(node);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2.5 border text-center cursor-default transition-colors ${
                      isSelected
                        ? 'bg-[#0078D7]/18 border-[#0078D7]'
                        : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {node.mimeType?.startsWith('image/') && node.content ? (
                      <img
                        src={node.content}
                        alt={node.name}
                        className="w-11 h-11 object-cover rounded-sm border border-neutral-300 dark:border-neutral-700"
                      />
                    ) : (
                      renderNodeIcon(node, 40)
                    )}

                    {renamingId === node.id ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await renameVfsNode(node.id, renameText);
                          setRenamingId(null);
                        }}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onBlur={async () => {
                            await renameVfsNode(node.id, renameText);
                            setRenamingId(null);
                          }}
                          className="w-full px-1 py-0.5 text-xs text-center bg-white dark:bg-neutral-800 border border-[#0078D7] outline-none"
                        />
                      </form>
                    ) : (
                      <span className="text-xs leading-tight line-clamp-2 break-words w-full">
                        {node.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500">
                  <th className="py-1.5 px-2 font-medium">Name</th>
                  <th className="py-1.5 px-2 font-medium">Date modified</th>
                  <th className="py-1.5 px-2 font-medium">Type</th>
                  <th className="py-1.5 px-2 font-medium text-right">Size</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((node) => {
                  const isSelected = selectedIds.includes(node.id);
                  return (
                    <tr
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIds([node.id]);
                      }}
                      onDoubleClick={() => {
                        if (isRecycleBin) return;
                        if (node.type === 'folder') navigateTo(node.id);
                        else openFileWithDefaultApp(node);
                      }}
                      className={`cursor-default ${
                        isSelected
                          ? 'bg-[#0078D7]/18'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <td className="py-1.5 px-2 flex items-center gap-2">
                        {renderNodeIcon(node, 16)}
                        <span className="truncate">{node.name}</span>
                      </td>
                      <td className="py-1.5 px-2 text-neutral-500 tabular-nums">
                        {new Date(node.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-1.5 px-2 text-neutral-500">
                        {node.type === 'folder' ? 'File folder' : node.mimeType || 'File'}
                      </td>
                      <td className="py-1.5 px-2 text-right text-neutral-500 tabular-nums">
                        {node.type === 'folder' ? '' : formatBytes(node.size)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Preview Pane */}
        {previewOpen && primarySelected && (
          <div className="hidden md:flex w-60 shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#1e1e1e] p-3 flex-col gap-3 overflow-y-auto">
            <div className="text-xs font-semibold truncate">{primarySelected.name}</div>

            {primarySelected.type === 'file' && primarySelected.mimeType?.startsWith('image/') && primarySelected.content ? (
              <img
                src={primarySelected.content}
                alt={primarySelected.name}
                className="w-full max-h-40 object-contain bg-black/5 dark:bg-black/30 border border-neutral-200 dark:border-neutral-700"
              />
            ) : primarySelected.type === 'file' && primarySelected.mimeType?.startsWith('audio/') && primarySelected.content ? (
              <audio controls src={primarySelected.content} className="w-full h-9" />
            ) : primarySelected.type === 'file' && primarySelected.mimeType?.startsWith('video/') && primarySelected.content ? (
              <video controls src={primarySelected.content} className="w-full max-h-36 bg-black" />
            ) : primarySelected.type === 'file' && primarySelected.content && !primarySelected.content.startsWith('data:') ? (
              <pre className="p-2 text-[11px] font-mono bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 max-h-44 overflow-auto whitespace-pre-wrap break-words">
                {primarySelected.content.slice(0, 600)}
              </pre>
            ) : (
              <div className="py-6 flex justify-center">{renderNodeIcon(primarySelected, 48)}</div>
            )}

            <div className="text-[11px] text-neutral-500 space-y-1 border-t border-neutral-200 dark:border-neutral-800 pt-2">
              <div>Type: {primarySelected.type === 'folder' ? 'Folder' : primarySelected.mimeType || 'File'}</div>
              {primarySelected.type === 'file' && <div>Size: {formatBytes(primarySelected.size)}</div>}
              <div>Modified: {new Date(primarySelected.updatedAt).toLocaleString()}</div>
            </div>

            {primarySelected.type === 'file' && !isRecycleBin && (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => openFileWithDefaultApp(primarySelected)}
                  className="w-full py-1.5 bg-[#0078D7] text-white text-xs font-medium hover:bg-[#106EBE] cursor-pointer"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDownload(primarySelected)}
                  className="w-full py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  Download to device
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="h-6 shrink-0 px-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#222222] flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          {currentItems.length} item{currentItems.length === 1 ? '' : 's'}
          {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
        </span>
        <span className="truncate max-w-[260px]">{getWindowsPath(vfsNodes, currentFolderId)}</span>
      </div>
    </div>
  );
};
