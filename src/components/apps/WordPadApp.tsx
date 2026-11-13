import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Calendar as CalIcon,
  FolderOpen,
  Italic,
  List,
  Save,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { WindowInstance } from '../../types/os';
import { ROOT_IDS } from '../../utils/vfs';

export const WordPadApp: React.FC<{ win: WindowInstance }> = ({ win }) => {
  const { vfsNodes, createVfsFile, updateVfsFileContent, addNotification } = useOS();
  const editorRef = useRef<HTMLDivElement>(null);

  const initialNode = win.launchPayload?.fileId
    ? vfsNodes.find((n) => n.id === win.launchPayload?.fileId)
    : vfsNodes.find((n) => n.id === 'file-notes-rtf');

  const [fileId, setFileId] = useState<string | null>(initialNode?.id || null);
  const [fileName, setFileName] = useState(initialNode?.name || 'Document.rtf');
  const [fontColor, setFontColor] = useState('#111827');
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    if (editorRef.current && initialNode?.content) {
      editorRef.current.innerHTML = initialNode.content;
    }
  }, [initialNode?.id]);

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const handleSave = async () => {
    const html = editorRef.current?.innerHTML || '';
    if (fileId) {
      await updateVfsFileContent(fileId, html);
      addNotification('WordPad', 'Document saved', `Updated ${fileName}`);
    } else {
      const created = await createVfsFile(ROOT_IDS.DOCUMENTS, fileName, html, 'text/html');
      setFileId(created.id);
      addNotification('WordPad', 'Document saved', `Saved ${created.name} to Documents`);
    }
  };

  const rtfFiles = vfsNodes.filter(
    (n) => n.type === 'file' && !n.isTrashed && (n.name.endsWith('.rtf') || n.mimeType === 'text/html')
  );

  return (
    <div className="flex flex-col h-full bg-neutral-200 dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
      {/* Ribbon Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 bg-neutral-100 dark:bg-[#252525] border-b border-neutral-300 dark:border-neutral-800 text-xs">
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

        <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        <select
          onChange={(e) => exec('fontName', e.target.value)}
          className="px-1.5 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs outline-none"
        >
          <option value="Segoe UI">Segoe UI</option>
          <option value="Georgia">Georgia</option>
          <option value="Arial">Arial</option>
          <option value="Consolas">Consolas</option>
        </select>

        <select
          onChange={(e) => exec('fontSize', e.target.value)}
          defaultValue="3"
          className="px-1.5 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs outline-none"
        >
          <option value="2">10pt</option>
          <option value="3">12pt</option>
          <option value="4">14pt</option>
          <option value="5">18pt</option>
          <option value="6">24pt</option>
        </select>

        <button onClick={() => exec('bold')} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => exec('italic')} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => exec('underline')} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Underline">
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => exec('strikeThrough')} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Strikethrough">
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <input
          type="color"
          value={fontColor}
          onChange={(e) => {
            setFontColor(e.target.value);
            exec('foreColor', e.target.value);
          }}
          className="w-6 h-6 border border-neutral-300 dark:border-neutral-600 cursor-pointer bg-transparent"
          title="Text color"
        />

        <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        <button onClick={() => exec('justifyLeft')} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Align left">
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => exec('justifyCenter')} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Center">
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => exec('justifyRight')} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Align right">
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => exec('insertUnorderedList')} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => exec('insertText', new Date().toLocaleString())}
          className="flex items-center gap-1 px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          title="Insert date & time"
        >
          <CalIcon className="w-3.5 h-3.5" /> Date
        </button>
      </div>

      {/* Document Page Canvas */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="w-full max-w-[680px] min-h-[420px] bg-white text-neutral-900 p-8 sm:p-12 shadow-md border border-neutral-300 outline-none text-sm leading-relaxed prose prose-sm"
        />
      </div>

      <div className="h-6 px-3 bg-neutral-100 dark:bg-[#252525] border-t border-neutral-300 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
        <span>{fileName}</span>
        <span>WordPad Rich Text</span>
      </div>

      {openModal && (
        <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-4 shadow-xl space-y-3">
            <h4 className="text-xs font-semibold">Open Rich Text Document</h4>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-neutral-200 dark:border-neutral-800 p-1">
              {rtfFiles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setFileId(f.id);
                    setFileName(f.name);
                    if (editorRef.current) editorRef.current.innerHTML = f.content || '';
                    setOpenModal(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[#0078D7] hover:text-white cursor-pointer"
                >
                  {f.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setOpenModal(false)}
              className="px-3 py-1 text-xs bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
