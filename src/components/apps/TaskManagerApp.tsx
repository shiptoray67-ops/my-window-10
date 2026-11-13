import React, { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, XCircle } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { AppIcon } from '../icons/WinIcons';

export const TaskManagerApp: React.FC = () => {
  const { windows, closeWindow, focusWindow, getAppDefinition } = useOS();
  const [tab, setTab] = useState<'processes' | 'performance'>('processes');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cpuSeries, setCpuSeries] = useState<number[]>(() => Array(24).fill(14));

  const baseCpu = Math.min(92, 6 + windows.length * 9);
  const totalMemPct = Math.min(88, 22 + windows.length * 7);

  useEffect(() => {
    const t = setInterval(() => {
      setCpuSeries((prev) => {
        const jitter = Math.round((Math.random() - 0.5) * 8);
        const nextVal = Math.max(4, Math.min(98, baseCpu + jitter));
        return [...prev.slice(1), nextVal];
      });
    }, 1000);
    return () => clearInterval(t);
  }, [baseCpu]);

  const currentCpu = cpuSeries[cpuSeries.length - 1];

  const polyPoints = cpuSeries
    .map((val, i) => `${(i / (cpuSeries.length - 1)) * 300},${100 - val}`)
    .join(' ');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#191919] text-neutral-900 dark:text-neutral-100">
      {/* Tabs */}
      <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#222222] px-2 text-xs">
        <button
          onClick={() => setTab('processes')}
          className={`px-4 py-2 border-b-2 cursor-pointer ${
            tab === 'processes'
              ? 'border-[#0078D7] font-semibold text-[#0078D7]'
              : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Processes ({windows.length + 3})
        </button>
        <button
          onClick={() => setTab('performance')}
          className={`px-4 py-2 border-b-2 cursor-pointer ${
            tab === 'performance'
              ? 'border-[#0078D7] font-semibold text-[#0078D7]'
              : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Performance
        </button>
      </div>

      {tab === 'processes' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-neutral-50 dark:bg-[#222222] border-b border-neutral-200 dark:border-neutral-800 text-neutral-500">
                <tr>
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium text-right">CPU</th>
                  <th className="py-2 px-3 font-medium text-right">Memory</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((w, idx) => {
                  const def = getAppDefinition(w.appId);
                  const isSel = selectedId === w.instanceId;
                  const cpu = ((idx + 1) * 2.4 + (w.isMinimized ? 0.2 : 3.1)).toFixed(1);
                  const mem = (64 + ((w.title.length * 13) % 140)).toFixed(1);
                  return (
                    <tr
                      key={w.instanceId}
                      onClick={() => setSelectedId(w.instanceId)}
                      onDoubleClick={() => focusWindow(w.instanceId)}
                      className={`border-b border-neutral-100 dark:border-neutral-800/60 cursor-default ${
                        isSel ? 'bg-[#0078D7]/20' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <td className="py-2 px-3 flex items-center gap-2">
                        <AppIcon appId={w.appId} size={16} webColor={def?.webColor} />
                        <span className="font-medium truncate">{w.title}</span>
                      </td>
                      <td className="py-2 px-3 text-neutral-500">
                        {w.isMinimized ? 'Suspended' : 'Running'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{cpu}%</td>
                      <td className="py-2 px-3 text-right tabular-nums">{mem} MB</td>
                    </tr>
                  );
                })}

                {/* Background OS Shell Processes */}
                {[
                  { name: 'Desktop Window Manager', cpu: '1.8%', mem: '94.2 MB' },
                  { name: 'Windows Explorer Shell', cpu: '0.6%', mem: '52.4 MB' },
                  { name: 'IndexedDB Storage Host', cpu: '0.3%', mem: '31.0 MB' },
                ].map((sys) => (
                  <tr key={sys.name} className="border-b border-neutral-100 dark:border-neutral-800/60 text-neutral-500">
                    <td className="py-2 px-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#0078D7]" />
                      <span>{sys.name}</span>
                    </td>
                    <td className="py-2 px-3">System</td>
                    <td className="py-2 px-3 text-right tabular-nums">{sys.cpu}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{sys.mem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222] flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">
              Total CPU: {currentCpu}% · Memory: {totalMemPct}%
            </span>
            <button
              disabled={!selectedId}
              onClick={() => {
                if (selectedId) {
                  closeWindow(selectedId);
                  setSelectedId(null);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-rose-600 hover:text-white disabled:opacity-40 text-xs font-medium transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" /> End task
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Cpu className="w-4 h-4 text-[#0078D7]" /> CPU Utilization
              </div>
              <div className="text-3xl font-light tabular-nums mt-1">{currentCpu}%</div>
            </div>
            <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <MemoryStick className="w-4 h-4 text-purple-500" /> Memory
              </div>
              <div className="text-3xl font-light tabular-nums mt-1">{totalMemPct}%</div>
            </div>
            <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <HardDrive className="w-4 h-4 text-emerald-500" /> Virtual Disk (C:)
              </div>
              <div className="text-3xl font-light tabular-nums mt-1">Active</div>
            </div>
          </div>

          <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#222222]">
            <div className="text-xs font-semibold mb-2">CPU History (%)</div>
            <svg viewBox="0 0 300 100" className="w-full h-40 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800">
              <polyline
                fill="none"
                stroke="#0078D7"
                strokeWidth="2"
                points={polyPoints}
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
