import React, { useEffect, useRef, useState } from 'react';
import { useOS } from '../../context/OSContext';
import { BUILTIN_APPS } from '../../data/apps';
import { AppId, WindowInstance } from '../../types/os';
import { getWindowsPath, ROOT_IDS } from '../../utils/vfs';

interface OutputLine {
  id: string;
  text: string;
}

export const CmdApp: React.FC<{ win: WindowInstance }> = ({ win }) => {
  const {
    vfsNodes,
    createVfsFolder,
    createVfsFile,
    trashVfsNodes,
    settings,
    windows,
    openApp,
    closeWindow,
  } = useOS();

  const [cwdId, setCwdId] = useState<string>(ROOT_IDS.THIS_PC);
  const [lines, setLines] = useState<OutputLine[]>([
    { id: 'h1', text: 'Microsoft Windows [Version 10.0.19045.4651]' },
    { id: 'h2', text: '(c) Windows 10 Simulator. Type "help" for available commands.' },
    { id: 'h3', text: '' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [themeClass, setThemeClass] = useState('bg-[#0c0c0c] text-[#cccccc]');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const promptPath = getWindowsPath(vfsNodes, cwdId);

  const pushLines = (items: string[]) => {
    setLines((prev) => [
      ...prev,
      ...items.map((text, idx) => ({ id: `${Date.now()}-${idx}-${Math.random()}`, text })),
    ]);
  };

  const runCommand = async (raw: string) => {
    const trimmed = raw.trim();
    pushLines([`${promptPath}> ${raw}`]);
    if (!trimmed) return;

    setCmdHistory((prev) => [trimmed, ...prev]);
    setHistIdx(-1);

    // Handle echo redirection: echo hello > note.txt
    if (trimmed.toLowerCase().startsWith('echo ') && trimmed.includes('>')) {
      const arrowIdx = trimmed.indexOf('>');
      const content = trimmed.slice(5, arrowIdx).trim().replace(/^["']|["']$/g, '');
      const targetName = trimmed.slice(arrowIdx + 1).trim();
      if (targetName) {
        await createVfsFile(cwdId, targetName, content, 'text/plain');
        pushLines([`Created ${targetName}`]);
        return;
      }
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const argStr = trimmed.slice(parts[0].length).trim();

    switch (cmd) {
      case 'help':
        pushLines([
          'Supported commands:',
          '  DIR            List files and directories in current folder',
          '  CD <folder>    Change directory (supports .. and \\)',
          '  MKDIR <name>   Create a new directory',
          '  ECHO <text>    Print text (use "echo text > file.txt" to write file)',
          '  TYPE <file>    Display contents of a text file',
          '  DEL <file>     Move a file to Recycle Bin',
          '  CLS            Clear the screen',
          '  DATE           Display current date',
          '  TIME           Display current time',
          '  VER            Display Windows version',
          '  WHOAMI         Display current user',
          '  HOSTNAME       Display PC name',
          '  TASKLIST       Show currently running apps',
          '  START <app>    Launch an application (e.g. start notepad)',
          '  COLOR <0a|07>  Change console colors (0a = green, 07 = classic, 1f = blue)',
          '  EXIT           Close Command Prompt',
        ]);
        break;

      case 'cls':
        setLines([]);
        break;

      case 'ver':
        pushLines([`Microsoft ${settings.windowsUpdateVersion}`]);
        break;

      case 'date':
        pushLines([`The current date is: ${new Date().toLocaleDateString()}`]);
        break;

      case 'time':
        pushLines([`The current time is: ${new Date().toLocaleTimeString()}`]);
        break;

      case 'whoami':
        pushLines([`${settings.deviceName.toLowerCase()}\\${settings.username.toLowerCase().replace(/\s+/g, '')}`]);
        break;

      case 'hostname':
        pushLines([settings.deviceName]);
        break;

      case 'ipconfig':
        pushLines([
          'Windows IP Configuration',
          '',
          'Wireless LAN adapter Wi-Fi:',
          `   Media State . . . . . . . . . . . : ${settings.wifiEnabled ? 'Connected' : 'Media disconnected'}`,
          '   IPv4 Address. . . . . . . . . . . : 192.168.1.42',
          '   Subnet Mask . . . . . . . . . . . : 255.255.255.0',
          '   Default Gateway . . . . . . . . . : 192.168.1.1',
        ]);
        break;

      case 'dir': {
        const children = vfsNodes.filter((n) => n.parentId === cwdId && !n.isTrashed);
        const out = [` Directory of ${promptPath}`, ''];
        if (children.length === 0) {
          out.push('  (empty directory)');
        } else {
          children.forEach((c) => {
            const dt = new Date(c.updatedAt).toLocaleDateString();
            const kind = c.type === 'folder' ? '<DIR>     ' : `${String(c.size).padStart(9)} `;
            out.push(`${dt}  ${kind} ${c.name}`);
          });
        }
        pushLines(out);
        break;
      }

      case 'cd': {
        if (!argStr || argStr === '.') {
          pushLines([promptPath]);
          break;
        }
        if (argStr === '\\' || argStr === '/') {
          setCwdId(ROOT_IDS.THIS_PC);
          break;
        }
        if (argStr === '..') {
          const cur = vfsNodes.find((n) => n.id === cwdId);
          if (cur?.parentId) setCwdId(cur.parentId);
          break;
        }
        const match = vfsNodes.find(
          (n) =>
            n.parentId === cwdId &&
            n.type === 'folder' &&
            !n.isTrashed &&
            n.name.toLowerCase() === argStr.toLowerCase()
        );
        if (match) {
          setCwdId(match.id);
        } else {
          pushLines([`The system cannot find the path specified: ${argStr}`]);
        }
        break;
      }

      case 'mkdir':
      case 'md': {
        if (!argStr) {
          pushLines(['The syntax of the command is incorrect.']);
          break;
        }
        await createVfsFolder(cwdId, argStr);
        pushLines([`Directory "${argStr}" created.`]);
        break;
      }

      case 'echo':
        pushLines([argStr]);
        break;

      case 'type': {
        const file = vfsNodes.find(
          (n) =>
            n.parentId === cwdId &&
            n.type === 'file' &&
            !n.isTrashed &&
            n.name.toLowerCase() === argStr.toLowerCase()
        );
        if (!file) {
          pushLines([`The system cannot find the file specified: ${argStr}`]);
        } else if (file.content?.startsWith('data:')) {
          pushLines(['[Binary file content omitted]']);
        } else {
          pushLines((file.content || '').split('\n'));
        }
        break;
      }

      case 'del': {
        const file = vfsNodes.find(
          (n) =>
            n.parentId === cwdId &&
            !n.isTrashed &&
            !n.isSystem &&
            n.name.toLowerCase() === argStr.toLowerCase()
        );
        if (!file) {
          pushLines([`Could Not Find ${argStr}`]);
        } else {
          await trashVfsNodes([file.id]);
          pushLines([`Moved ${file.name} to Recycle Bin.`]);
        }
        break;
      }

      case 'tasklist':
        pushLines([
          'Image Name                     PID Window Title',
          '========================= ======== ================================',
          ...windows.map(
            (w, idx) =>
              `${(w.appId + '.exe').padEnd(25)} ${String(1040 + idx * 124).padStart(8)} ${w.title}`
          ),
        ]);
        break;

      case 'start': {
        const key = argStr.toLowerCase() as AppId;
        if (key in BUILTIN_APPS) {
          openApp(key);
          pushLines([`Started ${BUILTIN_APPS[key as keyof typeof BUILTIN_APPS].title}`]);
        } else {
          pushLines([`Windows cannot find '${argStr}'. Try: notepad, calc, edge, explorer, paint, settings.`]);
        }
        break;
      }

      case 'color': {
        if (argStr.toLowerCase() === '0a') setThemeClass('bg-[#0c0c0c] text-[#16c60c]');
        else if (argStr.toLowerCase() === '1f') setThemeClass('bg-[#0037da] text-[#ffffff]');
        else setThemeClass('bg-[#0c0c0c] text-[#cccccc]');
        break;
      }

      case 'exit':
        closeWindow(win.instanceId);
        break;

      default:
        pushLines([`'${parts[0]}' is not recognized as an internal or external command.`]);
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`h-full overflow-y-auto p-3 font-mono text-xs leading-relaxed ${themeClass}`}
    >
      {lines.map((l) => (
        <div key={l.id} className="whitespace-pre-wrap break-words min-h-[18px]">
          {l.text}
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cur = input;
          setInput('');
          runCommand(cur);
        }}
        className="flex items-center gap-1.5 mt-1"
      >
        <span className="shrink-0">{promptPath}&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
              e.preventDefault();
              const next = Math.min(cmdHistory.length - 1, histIdx + 1);
              setHistIdx(next);
              setInput(cmdHistory[next]);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (histIdx <= 0) {
                setHistIdx(-1);
                setInput('');
              } else {
                const next = histIdx - 1;
                setHistIdx(next);
                setInput(cmdHistory[next]);
              }
            }
          }}
          className="flex-1 bg-transparent outline-none caret-current"
        />
      </form>
      <div ref={bottomRef} />
    </div>
  );
};
