import React, { useEffect, useRef, useState } from 'react';
import { Camera, FlipHorizontal, Timer } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { ROOT_IDS } from '../../utils/vfs';

type CamFilter = 'none' | 'grayscale(100%)' | 'sepia(85%)' | 'contrast(125%) saturate(135%)';

export const CameraApp: React.FC = () => {
  const { createVfsFile, addNotification, openApp } = useOS();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [mirror, setMirror] = useState(true);
  const [filter, setFilter] = useState<CamFilter>('none');
  const [timerSec, setTimerSec] = useState<0 | 3>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [lastSnap, setLastSnap] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (active) {
          setHasCamera(false);
          setErrorMsg('Camera API unavailable in this browser.');
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (active) {
          setHasCamera(false);
          setErrorMsg('Camera access denied or no webcam detected.');
        }
      }
    })();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const performCapture = async () => {
    const canvas = document.createElement('canvas');
    const vid = videoRef.current;
    if (hasCamera && vid && vid.videoWidth > 0) {
      canvas.width = vid.videoWidth;
      canvas.height = vid.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = filter;
      if (mirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    } else {
      // Clean synthetic studio snapshot fallback if hardware camera is unavailable
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#0078D7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 24px "Segoe UI", sans-serif';
      ctx.fillText('Windows 10 Camera Snapshot', 150, 220);
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.fillText(new Date().toLocaleString(), 210, 260);
    }

    const dataUrl = canvas.toDataURL('image/png');
    setLastSnap(dataUrl);
    const name = `WIN_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.png`;
    await createVfsFile(ROOT_IDS.PICTURES, name, dataUrl, 'image/png');
    addNotification('Camera', 'Photo captured', `Saved ${name} to Pictures`);
  };

  const triggerCapture = () => {
    if (timerSec === 0) {
      performCapture();
      return;
    }
    setCountdown(timerSec);
    let left = timerSec;
    const t = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(t);
        setCountdown(null);
        performCapture();
      } else {
        setCountdown(left);
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white relative">
      {/* Top Toolbar */}
      <div className="h-11 shrink-0 px-3 bg-neutral-900/90 border-b border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimerSec((t) => (t === 0 ? 3 : 0))}
            className={`flex items-center gap-1.5 px-2.5 py-1 hover:bg-white/10 cursor-pointer ${
              timerSec > 0 ? 'text-[#0078D7]' : ''
            }`}
          >
            <Timer className="w-4 h-4" /> {timerSec === 0 ? 'Timer Off' : '3s Timer'}
          </button>
          <button
            onClick={() => setMirror((m) => !m)}
            className={`flex items-center gap-1.5 px-2.5 py-1 hover:bg-white/10 cursor-pointer ${
              mirror ? 'text-[#0078D7]' : ''
            }`}
          >
            <FlipHorizontal className="w-4 h-4" /> Mirror
          </button>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as CamFilter)}
          className="px-2 py-1 bg-neutral-800 border border-neutral-700 text-xs outline-none"
        >
          <option value="none">Normal</option>
          <option value="grayscale(100%)">Black &amp; White</option>
          <option value="sepia(85%)">Sepia</option>
          <option value="contrast(125%) saturate(135%)">Vivid</option>
        </select>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
        {hasCamera ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              filter,
              transform: mirror ? 'scaleX(-1)' : undefined,
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-6 space-y-2 max-w-sm">
            <Camera className="w-10 h-10 mx-auto text-neutral-500" />
            <div className="text-sm font-medium">{errorMsg}</div>
            <p className="text-xs text-neutral-400">
              You can still press the shutter button below to save a test snapshot into Pictures.
            </p>
          </div>
        )}

        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-7xl font-light tabular-nums">{countdown}</span>
          </div>
        )}

        {/* Shutter & Last Photo */}
        <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-8">
          <button
            onClick={triggerCapture}
            className="w-14 h-14 rounded-full border-4 border-white bg-white/20 hover:bg-white/35 flex items-center justify-center cursor-pointer transition-colors"
            title="Take photo"
          >
            <Camera className="w-6 h-6" />
          </button>

          {lastSnap && (
            <button
              onClick={() => openApp('photos')}
              className="absolute right-6 w-12 h-12 border-2 border-white overflow-hidden shadow-lg cursor-pointer"
              title="Open in Photos"
            >
              <img src={lastSnap} alt="Last capture" className="w-full h-full object-cover" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
