import React, { useEffect, useState } from 'react';
import { FolderOpen, Save, Search, WrapText, Plus } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { WindowInstance } from '../../types/os';
import { ROOT_IDS } from '../../utils/vfs';

export const NotepadApp: React.FC<{ win: WindowInstance }> = ({ win }) => {
  const { vfsNodes, createVfsFile, updateVfsFileContent, addNotification } = useOS();

  const initialNode = win.launchPayload?.fileId
    ? vfsNodes.find((n) => n.id === win.launchPayload?.fileId)
    : undefined;

  const [currentFileId, setCurrentFileId] = useState<string | null>(initialNode?.id || null);
  const [fileName, setFileName] = useState(initialNode?.name || 'Untitled.txt');
  const [text, setText] = useState(initialNode?.content || '');
  const [dirty, setDirty] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [saveAsModal, setSaveAsModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState('Note.txt');
  const [cursorInfo, setCursorInfo] = useState({ ln: 1, col: 1 });

  useEffect(() => {
    if (win.launchPayload?.fileId) {
      const n = vfsNodes.find((x) => x.id === win.launchPayload?.fileId);
      if (n) {
        setCurrentFileId(n.id);
        setFileName(n.name);
        setText(n.content || '');
        setDirty(false);
      }
    }
  }, [win.launchPayload?.fileId]);

  const handleSave = async () => {
    if (currentFileId) {
      await updateVfsFileContent(currentFileId, text);
      setDirty(false);
      addNotification('Notepad', 'File saved', `Saved changes to ${fileName}`);
    } else {
      setSaveAsName(fileName === 'Untitled.txt' ? 'New Note.txt' : fileName);
      setSaveAsModal(true);
    }
  };

  const handleSaveAs = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = saveAsName.trim() || 'Untitled.txt';
    const created = await createVfsFile(ROOT_IDS.DOCUMENTS, finalName, text, 'text/plain');
    setCurrentFileId(created.id);
    setFileName(created.name);
    setDirty(false);
    setSaveAsModal(false);
    addNotification('Notepad', 'File saved', `Saved ${created.name} to Documents`);
  };

  const updateCursor = (el: HTMLTextAreaElement) => {
    const pos = el.selectionStart || 0;
    const before = el.value.slice(0, pos);
    const lines = before.split('\n');
    setCursorInfo({ ln: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  const textFiles = vfsNodes.filter(
    (n) =>
      n.type === 'file' &&
      !n.isTrashed &&
      (!n.mimeType || n.mimeType.startsWith('text/') || n.name.endsWith('.txt') || n.name.endsWith('.md'))
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e] text-neutral-900 dark:text-neutral-100">
      {/* Menu Bar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-[#252525] border-b border-neutral-200 dark:border-neutral-800 text-xs">
        <button
          onClick={() => {
            setCurrentFileId(null);
            setFileName('Untitled.txt');
            setText('');
            setDirty(false);
          }}
          className="flex items-center gap-1 px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
        <button
          onClick={() => setOpenModal(true)}
          className="flex items-center gap-1 px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5" /> Open
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
        <button
          onClick={() => {
            setSaveAsName(fileName);
            setSaveAsModal(true);
          }}
          className="px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
        >
          Save As
        </button>

        <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        <button
          onClick={() => setShowFind((s) => !s)}
          className={`flex items-center gap-1 px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
            showFind ? 'bg-black/10 dark:bg-white/15' : ''
          }`}
        >
          <Search className="w-3.5 h-3.5" /> Find/Replace
        </button>
        <button
          onClick={() => setWordWrap((w) => !w)}
          className={`flex items-center gap-1 px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
            wordWrap ? 'bg-black/10 dark:bg-white/15' : ''
          }`}
        >
          <WrapText className="w-3.5 h-3.5" /> Word Wrap
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setFontSize((f) => Math.max(10, f - 1))}
            className="px-2 py-0.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          >
            A-
          </button>
          <span className="text-[11px] tabular-nums">{fontSize}px</span>
          <button
            onClick={() => setFontSize((f) => Math.min(28, f + 1))}
            className="px-2 py-0.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          >
            A+
          </button>
        </div>
      </div>

      {showFind && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs">
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Find..."
            className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
          />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="Replace with..."
            className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
          />
          <button
            onClick={() => {
              if (!findQuery) return;
              setText((t) => t.split(findQuery).join(replaceQuery));
              setDirty(true);
            }}
            className="px-3 py-1 bg-[#0078D7] text-white hover:bg-[#106EBE] cursor-pointer"
          >
            Replace All
          </button>
        </div>
      )}

      {/* Editor Area */}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
          updateCursor(e.target);
        }}
        onClick={(e) => updateCursor(e.currentTarget)}
        onKeyUp={(e) => updateCursor(e.currentTarget)}
        style={{ fontSize }}
        wrap={wordWrap ? 'soft' : 'off'}
        placeholder="Start typing..."
        className="flex-1 w-full p-3 bg-transparent font-mono leading-relaxed outline-none resize-none"
      />

      {/* Status Bar */}
      <div className="h-6 shrink-0 px-3 bg-neutral-100 dark:bg-[#252525] border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 tabular-nums">
        <span>
          {fileName}
          {dirty ? ' *' : ''}
        </span>
        <span>
          Ln {cursorInfo.ln}, Col {cursorInfo.col} · {text.length} chars · UTF-8
        </span>
      </div>

      {/* Open File Modal */}
      {openModal && (
        <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-4 shadow-xl space-y-3">
            <h4 className="text-xs font-semibold">Open Text File from PC</h4>
            <div className="max-h-52 overflow-y-auto space-y-1 border border-neutral-200 dark:border-neutral-800 p-1">
              {textFiles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setCurrentFileId(f.id);
                    setFileName(f.name);
                    setText(f.content || '');
                    setDirty(false);
                    setOpenModal(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[#0078D7] hover:text-white cursor-pointer"
                >
                  {f.name}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setOpenModal(false)}
                className="px-3 py-1 text-xs bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save As Modal */}
      {saveAsModal && (
        <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAs}
            className="w-full max-w-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-4 shadow-xl space-y-3"
          >
            <h4 className="text-xs font-semibold">Save to Documents</h4>
            <input
              type="text"
              autoFocus
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveAsModal(false)}
                className="px-3 py-1 text-xs bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs bg-[#0078D7] text-white cursor-pointer"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
