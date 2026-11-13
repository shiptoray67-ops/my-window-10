import { VfsNode } from '../types/os';
import { createSampleWavDataUrl } from './sound';
import { ASSETS } from '../data/assets';

const DB_NAME = 'Win10SimVFS';
const DB_VERSION = 1;
const STORE_FILES = 'nodes';

export const ROOT_IDS = {
  THIS_PC: 'root-this-pc',
  DESKTOP: 'folder-desktop',
  DOCUMENTS: 'folder-documents',
  DOWNLOADS: 'folder-downloads',
  PICTURES: 'folder-pictures',
  MUSIC: 'folder-music',
  VIDEOS: 'folder-videos',
  RECYCLE_BIN: 'root-recycle-bin',
} as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllVfsNodes(): Promise<VfsNode[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as VfsNode[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function putVfsNodes(nodes: VfsNode[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      nodes.forEach((n) => store.put(n));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fallback silently
  }
}

export async function deleteVfsNodeIds(ids: string[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function clearAllVfs(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      tx.objectStore(STORE_FILES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export function createInitialVfsSeed(): VfsNode[] {
  const now = Date.now();
  const sampleWav = createSampleWavDataUrl();
  const sampleText = `Welcome to Windows 10 Desktop Simulator!\n\nEverything in this environment runs locally in your browser.\n- Files created in Notepad, WordPad, Paint, Snipping Tool, or Camera are saved in IndexedDB.\n- You can upload real files from your device into File Explorer and download them back anytime.\n- Try keyboard shortcuts: Win+E (Explorer), Win+D (Show Desktop), Alt+Tab (Switch Windows), Ctrl+Shift+Esc (Task Manager).\n`;

  const sampleRtf = `<h2>Project Roadmap &amp; Notes</h2><p>Welcome to <strong>WordPad</strong> inside your Windows 10 environment.</p><ul><li>Edit rich formatted text with bold, italic, underline, colors, and alignment.</li><li>Save directly to your virtual Documents folder.</li><li>Install free mini games or web apps from the <strong>Microsoft Store</strong>.</li></ul>`;

  return [
    {
      id: ROOT_IDS.THIS_PC,
      name: 'Local Disk (C:)',
      type: 'folder',
      parentId: null,
      size: 0,
      createdAt: now,
      updatedAt: now,
      isSystem: true,
    },
    {
      id: ROOT_IDS.DESKTOP,
      name: 'Desktop',
      type: 'folder',
      parentId: ROOT_IDS.THIS_PC,
      size: 0,
      createdAt: now,
      updatedAt: now,
      isSystem: true,
    },
    {
      id: ROOT_IDS.DOCUMENTS,
      name: 'Documents',
      type: 'folder',
      parentId: ROOT_IDS.THIS_PC,
      size: 0,
      createdAt: now,
      updatedAt: now,
      isSystem: true,
    },
    {
      id: ROOT_IDS.DOWNLOADS,
      name: 'Downloads',
      type: 'folder',
      parentId: ROOT_IDS.THIS_PC,
      size: 0,
      createdAt: now,
      updatedAt: now,
      isSystem: true,
    },
    {
      id: ROOT_IDS.PICTURES,
      name: 'Pictures',
      type: 'folder',
      parentId: ROOT_IDS.THIS_PC,
      size: 0,
      createdAt: now,
      updatedAt: now,
      isSystem: true,
    },
    {
      id: ROOT_IDS.MUSIC,
      name: 'Music',
      type: 'folder',
      parentId: ROOT_IDS.THIS_PC,
      size: 0,
      createdAt: now,
      updatedAt: now,
      isSystem: true,
    },
    {
      id: ROOT_IDS.VIDEOS,
      name: 'Videos',
      type: 'folder',
      parentId: ROOT_IDS.THIS_PC,
      size: 0,
      createdAt: now,
      updatedAt: now,
      isSystem: true,
    },
    {
      id: 'file-welcome-txt',
      name: 'Welcome to Windows 10.txt',
      type: 'file',
      parentId: ROOT_IDS.DOCUMENTS,
      content: sampleText,
      mimeType: 'text/plain',
      size: sampleText.length,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'file-notes-rtf',
      name: 'Project Notes.rtf',
      type: 'file',
      parentId: ROOT_IDS.DOCUMENTS,
      content: sampleRtf,
      mimeType: 'text/html',
      size: sampleRtf.length,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'file-coastal-jpg',
      name: 'Coastal Cliffs.jpg',
      type: 'file',
      parentId: ROOT_IDS.PICTURES,
      content: ASSETS.coastalPhoto,
      mimeType: 'image/jpeg',
      size: 482400,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'file-hero-jpg',
      name: 'Windows Hero.jpg',
      type: 'file',
      parentId: ROOT_IDS.PICTURES,
      content: ASSETS.heroWallpaper,
      mimeType: 'image/jpeg',
      size: 512000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'file-ambient-wav',
      name: 'Ambient Horizon.wav',
      type: 'file',
      parentId: ROOT_IDS.MUSIC,
      content: sampleWav,
      mimeType: 'audio/wav',
      size: 264644,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : '';
}

export function getBreadcrumbs(nodes: VfsNode[], folderId: string): VfsNode[] {
  if (folderId === ROOT_IDS.RECYCLE_BIN) {
    return [{
      id: ROOT_IDS.RECYCLE_BIN,
      name: 'Recycle Bin',
      type: 'folder',
      parentId: null,
      size: 0,
      createdAt: 0,
      updatedAt: 0,
      isSystem: true,
    }];
  }
  const map = new Map(nodes.map((n) => [n.id, n]));
  const chain: VfsNode[] = [];
  let cur = map.get(folderId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return chain;
}

export function getWindowsPath(nodes: VfsNode[], folderId: string): string {
  if (folderId === ROOT_IDS.RECYCLE_BIN) return 'Recycle Bin';
  const chain = getBreadcrumbs(nodes, folderId);
  if (chain.length === 0) return 'C:\\';
  return chain
    .map((c, idx) => (idx === 0 && c.id === ROOT_IDS.THIS_PC ? 'C:' : c.name))
    .join('\\');
}
