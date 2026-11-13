import React from 'react';
import {
  Monitor,
  Trash2,
  Folder,
  FileText,
  Globe,
  Calculator,
  Palette,
  Calendar,
  Clock,
  Image as ImageIcon,
  Music,
  Camera,
  CloudSun,
  StickyNote,
  Scissors,
  Activity,
  Terminal,
  ShoppingBag,
  Settings,
  Gamepad2,
  Grid3X3,
  Bomb,
  Crown,
  Boxes,
  Hash,
  Spade,
  BookOpen,
} from 'lucide-react';
import { AppId } from '../../types/os';

export const WindowsLogo: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 88 88" fill="currentColor" className={className} aria-hidden="true">
    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349l-.011 41.34-47.318-6.678-.066-34.739z" />
  </svg>
);

export const AppIcon: React.FC<{
  appId: AppId | 'this-pc' | 'recycle-bin' | 'documents';
  size?: number;
  webColor?: string;
  className?: string;
}> = ({ appId, size = 24, webColor, className = '' }) => {
  const boxStyle = { width: size, height: size };
  const iconSize = Math.round(size * 0.62);

  if (appId === 'this-pc') {
    return (
      <div
        style={boxStyle}
        className={`flex items-center justify-center rounded-sm bg-gradient-to-br from-[#0078D7] to-[#004E8C] text-white shadow-sm shrink-0 ${className}`}
      >
        <Monitor style={{ width: iconSize, height: iconSize }} />
      </div>
    );
  }

  if (appId === 'recycle-bin') {
    return (
      <div
        style={boxStyle}
        className={`flex items-center justify-center rounded-sm bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-sm shrink-0 ${className}`}
      >
        <Trash2 style={{ width: iconSize, height: iconSize }} />
      </div>
    );
  }

  if (appId === 'documents') {
    return (
      <div
        style={boxStyle}
        className={`flex items-center justify-center rounded-sm bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shrink-0 ${className}`}
      >
        <Folder style={{ width: iconSize, height: iconSize }} />
      </div>
    );
  }

  if (typeof appId === 'string' && appId.startsWith('webapp-')) {
    return (
      <div
        style={{ ...boxStyle, backgroundColor: webColor || '#0078D7' }}
        className={`flex items-center justify-center rounded-sm text-white shadow-sm shrink-0 ${className}`}
      >
        <Globe style={{ width: iconSize, height: iconSize }} />
      </div>
    );
  }

  const map: Record<string, { bg: string; icon: React.ReactNode }> = {
    explorer: {
      bg: 'bg-gradient-to-br from-[#F7B500] to-[#D48806]',
      icon: <Folder style={{ width: iconSize, height: iconSize }} />,
    },
    edge: {
      bg: 'bg-gradient-to-br from-[#0078D7] via-[#00A4EF] to-[#10B981]',
      icon: <Globe style={{ width: iconSize, height: iconSize }} />,
    },
    notepad: {
      bg: 'bg-gradient-to-br from-[#2B88D8] to-[#005A9E]',
      icon: <FileText style={{ width: iconSize, height: iconSize }} />,
    },
    wordpad: {
      bg: 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A]',
      icon: <BookOpen style={{ width: iconSize, height: iconSize }} />,
    },
    calculator: {
      bg: 'bg-gradient-to-br from-[#334155] to-[#0F172A]',
      icon: <Calculator style={{ width: iconSize, height: iconSize }} />,
    },
    paint: {
      bg: 'bg-gradient-to-br from-[#EC4899] via-[#8B5CF6] to-[#3B82F6]',
      icon: <Palette style={{ width: iconSize, height: iconSize }} />,
    },
    calendar: {
      bg: 'bg-gradient-to-br from-[#0078D7] to-[#005A9E]',
      icon: <Calendar style={{ width: iconSize, height: iconSize }} />,
    },
    clock: {
      bg: 'bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]',
      icon: <Clock style={{ width: iconSize, height: iconSize }} />,
    },
    photos: {
      bg: 'bg-gradient-to-br from-[#0EA5E9] to-[#0369A1]',
      icon: <ImageIcon style={{ width: iconSize, height: iconSize }} />,
    },
    mediaplayer: {
      bg: 'bg-gradient-to-br from-[#E11D48] to-[#9F1239]',
      icon: <Music style={{ width: iconSize, height: iconSize }} />,
    },
    camera: {
      bg: 'bg-gradient-to-br from-[#475569] to-[#1E293B]',
      icon: <Camera style={{ width: iconSize, height: iconSize }} />,
    },
    weather: {
      bg: 'bg-gradient-to-br from-[#F59E0B] to-[#0284C7]',
      icon: <CloudSun style={{ width: iconSize, height: iconSize }} />,
    },
    stickynotes: {
      bg: 'bg-gradient-to-br from-[#FACC15] to-[#CA8A04] !text-neutral-900',
      icon: <StickyNote style={{ width: iconSize, height: iconSize }} />,
    },
    snipping: {
      bg: 'bg-gradient-to-br from-[#EF4444] to-[#B91C1C]',
      icon: <Scissors style={{ width: iconSize, height: iconSize }} />,
    },
    taskmanager: {
      bg: 'bg-gradient-to-br from-[#0D9488] to-[#115E59]',
      icon: <Activity style={{ width: iconSize, height: iconSize }} />,
    },
    cmd: {
      bg: 'bg-gradient-to-br from-[#18181B] to-[#09090B] border border-neutral-600',
      icon: <Terminal style={{ width: iconSize, height: iconSize }} />,
    },
    store: {
      bg: 'bg-gradient-to-br from-[#0078D7] to-[#005A9E]',
      icon: <ShoppingBag style={{ width: iconSize, height: iconSize }} />,
    },
    settings: {
      bg: 'bg-gradient-to-br from-[#52525B] to-[#27272A]',
      icon: <Settings style={{ width: iconSize, height: iconSize }} />,
    },
    'game-snake': {
      bg: 'bg-gradient-to-br from-[#16A34A] to-[#14532D]',
      icon: <Gamepad2 style={{ width: iconSize, height: iconSize }} />,
    },
    'game-2048': {
      bg: 'bg-gradient-to-br from-[#F59E0B] to-[#B45309]',
      icon: <Grid3X3 style={{ width: iconSize, height: iconSize }} />,
    },
    'game-minesweeper': {
      bg: 'bg-gradient-to-br from-[#2563EB] to-[#1E3A8A]',
      icon: <Bomb style={{ width: iconSize, height: iconSize }} />,
    },
    'game-chess': {
      bg: 'bg-gradient-to-br from-[#7C3AED] to-[#4C1D95]',
      icon: <Crown style={{ width: iconSize, height: iconSize }} />,
    },
    'game-tetris': {
      bg: 'bg-gradient-to-br from-[#0D9488] to-[#134E4A]',
      icon: <Boxes style={{ width: iconSize, height: iconSize }} />,
    },
    'game-sudoku': {
      bg: 'bg-gradient-to-br from-[#0284C7] to-[#075985]',
      icon: <Hash style={{ width: iconSize, height: iconSize }} />,
    },
    'game-solitaire': {
      bg: 'bg-gradient-to-br from-[#15803D] to-[#064E3B]',
      icon: <Spade style={{ width: iconSize, height: iconSize }} />,
    },
  };

  const entry = map[appId] || {
    bg: 'bg-[#0078D7]',
    icon: <Monitor style={{ width: iconSize, height: iconSize }} />,
  };

  return (
    <div
      style={boxStyle}
      className={`flex items-center justify-center rounded-sm text-white shadow-sm shrink-0 ${entry.bg} ${className}`}
    >
      {entry.icon}
    </div>
  );
};
