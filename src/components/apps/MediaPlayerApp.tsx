import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Music,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Upload,
  Video,
  Volume2,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { WindowInstance } from '../../types/os';
import { ROOT_IDS } from '../../utils/vfs';

export const MediaPlayerApp: React.FC<{ win: WindowInstance }> = ({ win }) => {
  const { vfsNodes, uploadRealFiles } = useOS();
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaNodes = useMemo(
    () =>
      vfsNodes.filter(
        (n) =>
          n.type === 'file' &&
          !n.isTrashed &&
          (n.mimeType?.startsWith('audio/') ||
            n.mimeType?.startsWith('video/') ||
            /\.(mp3|wav|ogg|mp4|webm)$/i.test(n.name))
      ),
    [vfsNodes]
  );

  const [currentId, setCurrentId] = useState<string | null>(
    win.launchPayload?.fileId || mediaNodes[0]?.id || null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [loop, setLoop] = useState(false);

  const currentNode = mediaNodes.find((m) => m.id === currentId) || mediaNodes[0] || null;
  const isVideo =
    currentNode?.mimeType?.startsWith('video/') ||
    /\.(mp4|webm)$/i.test(currentNode?.name || '');

  useEffect(() => {
    const el = isVideo ? videoRef.current : audioRef.current;
    if (!el) return;
    el.volume = volume;
  }, [volume, isVideo, currentNode?.id]);

  const togglePlay = () => {
    const el = isVideo ? videoRef.current : audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const stepTrack = (dir: -1 | 1) => {
    if (mediaNodes.length === 0) return;
    const idx = mediaNodes.findIndex((m) => m.id === currentNode?.id);
    const next = mediaNodes[(idx + dir + mediaNodes.length) % mediaNodes.length];
    setCurrentId(next.id);
    setProgress(0);
    setIsPlaying(false);
  };

  const fmtTime = (s: number) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col sm:flex-row h-full bg-[#141418] text-white">
      {/* Playlist Sidebar */}
      <div className="sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 bg-[#1b1b22] flex flex-col">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-semibold">Library ({mediaNodes.length})</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[#0078D7] hover:bg-[#106EBE] cursor-pointer"
          >
            <Upload className="w-3 h-3" /> Add Media
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              if (e.target.files?.length) {
                const uploaded = await uploadRealFiles(ROOT_IDS.MUSIC, e.target.files);
                if (uploaded[0]) setCurrentId(uploaded[0].id);
                e.target.value = '';
              }
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1 max-h-36 sm:max-h-none">
          {mediaNodes.map((m) => {
            const vid = m.mimeType?.startsWith('video/') || /\.(mp4|webm)$/i.test(m.name);
            const active = m.id === currentNode?.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setCurrentId(m.id);
                  setProgress(0);
                  setIsPlaying(false);
                }}
                className={`w-full flex items-center gap-2.5 p-2 text-left text-xs cursor-pointer ${
                  active ? 'bg-[#0078D7] text-white' : 'hover:bg-white/10 text-neutral-300'
                }`}
              >
                {vid ? <Video className="w-4 h-4 shrink-0" /> : <Music className="w-4 h-4 shrink-0" />}
                <span className="truncate">{m.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Player Stage */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          {!currentNode ? (
            <p className="text-xs text-neutral-400">No audio or video files found. Click Add Media to upload.</p>
          ) : isVideo ? (
            <video
              ref={videoRef}
              key={currentNode.id}
              src={currentNode.content}
              loop={loop}
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={() => setIsPlaying(false)}
              className="max-w-full max-h-full bg-black shadow-2xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-6 text-center">
              <audio
                ref={audioRef}
                key={currentNode.id}
                src={currentNode.content}
                loop={loop}
                onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setIsPlaying(false)}
              />
              <div className="w-36 h-36 bg-gradient-to-br from-rose-600 to-indigo-700 flex items-center justify-center shadow-2xl">
                <Music className="w-16 h-16 text-white/90" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{currentNode.name}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Groove Media Player</p>
              </div>
              {/* Animated Equalizer Bars */}
              <div className="flex items-end gap-1.5 h-8">
                {[0.5, 0.9, 0.65, 1, 0.75, 0.85, 0.55].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      height: isPlaying ? `${Math.round(h * 100)}%` : '20%',
                      transition: 'height 200ms ease',
                    }}
                    className={`w-1.5 bg-[#0078D7] ${isPlaying ? 'animate-pulse' : 'opacity-40'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Transport Controls */}
        <div className="shrink-0 p-4 bg-[#1c1c24] border-t border-white/10 space-y-2">
          <div className="flex items-center gap-3 text-[11px] text-neutral-400 tabular-nums">
            <span>{fmtTime(progress)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={progress}
              onChange={(e) => {
                const val = Number(e.target.value);
                setProgress(val);
                const el = isVideo ? videoRef.current : audioRef.current;
                if (el) el.currentTime = val;
              }}
              className="flex-1 accent-[#0078D7] cursor-pointer"
            />
            <span>{fmtTime(duration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setLoop((l) => !l)}
              className={`p-2 hover:bg-white/10 cursor-pointer ${loop ? 'text-[#0078D7]' : 'text-neutral-400'}`}
              title="Repeat"
            >
              <Repeat className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <button onClick={() => stepTrack(-1)} className="p-2 hover:bg-white/10 cursor-pointer">
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlay}
                disabled={!currentNode}
                className="w-10 h-10 rounded-full bg-[#0078D7] hover:bg-[#106EBE] flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button onClick={() => stepTrack(1)} className="p-2 hover:bg-white/10 cursor-pointer">
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 w-28">
              <Volume2 className="w-4 h-4 text-neutral-400" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-[#0078D7] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
