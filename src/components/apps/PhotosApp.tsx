import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  RotateCw,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
  Grid,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { WindowInstance } from '../../types/os';
import { ROOT_IDS } from '../../utils/vfs';

export const PhotosApp: React.FC<{ win: WindowInstance }> = ({ win }) => {
  const { vfsNodes, updateSettings, trashVfsNodes, uploadRealFiles, addNotification } = useOS();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageNodes = useMemo(
    () =>
      vfsNodes.filter(
        (n) =>
          n.type === 'file' &&
          !n.isTrashed &&
          (n.mimeType?.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/i.test(n.name))
      ),
    [vfsNodes]
  );

  const [selectedId, setSelectedId] = useState<string | null>(win.launchPayload?.fileId || null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const activePhoto = imageNodes.find((n) => n.id === selectedId) || null;
  const activeIndex = activePhoto ? imageNodes.findIndex((n) => n.id === activePhoto.id) : -1;

  const stepPhoto = (dir: -1 | 1) => {
    if (imageNodes.length === 0) return;
    const nextIdx = (activeIndex + dir + imageNodes.length) % imageNodes.length;
    setSelectedId(imageNodes[nextIdx].id);
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] text-white">
      {/* Header Bar */}
      <div className="h-11 shrink-0 px-3 bg-[#1c1c1c] border-b border-white/10 flex items-center justify-between gap-2 text-xs">
        {activePhoto ? (
          <>
            <button
              onClick={() => {
                setSelectedId(null);
                setZoom(1);
                setRotation(0);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 cursor-pointer"
            >
              <Grid className="w-4 h-4" /> All Photos
            </button>

            <span className="truncate font-medium">{activePhoto.name}</span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.25).toFixed(2)))}
                className="p-1.5 hover:bg-white/10 cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] tabular-nums w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                className="p-1.5 hover:bg-white/10 cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 hover:bg-white/10 cursor-pointer"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (activePhoto.content) {
                    updateSettings({ wallpaper: activePhoto.content });
                    addNotification('Photos', 'Wallpaper updated', `${activePhoto.name} set as desktop background.`);
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#0078D7] hover:bg-[#106EBE] cursor-pointer"
              >
                <Monitor className="w-3.5 h-3.5" /> Set as wallpaper
              </button>
              <button
                onClick={async () => {
                  await trashVfsNodes([activePhoto.id]);
                  setSelectedId(null);
                }}
                className="p-1.5 hover:bg-rose-600/80 cursor-pointer"
                title="Delete to Recycle Bin"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="font-semibold">Collection ({imageNodes.length})</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0078D7] hover:bg-[#106EBE] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Import Photos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                if (e.target.files?.length) {
                  await uploadRealFiles(ROOT_IDS.PICTURES, e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </>
        )}
      </div>

      {/* Viewer or Grid */}
      {activePhoto ? (
        <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden bg-black">
          <img
            src={activePhoto.content}
            alt={activePhoto.name}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            className="max-w-full max-h-full object-contain transition-transform duration-150"
          />

          {imageNodes.length > 1 && (
            <>
              <button
                onClick={() => stepPhoto(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 hover:bg-black/80 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => stepPhoto(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 hover:bg-black/80 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {imageNodes.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-400">
              No photos in Pictures yet. Click Import Photos or take a snapshot in Camera.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {imageNodes.map((img) => (
                <button
                  key={img.id}
                  onClick={() => {
                    setSelectedId(img.id);
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="group relative aspect-[4/3] bg-neutral-900 overflow-hidden border border-white/10 hover:border-[#0078D7] cursor-pointer"
                >
                  <img
                    src={img.content}
                    alt={img.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-left text-[11px] truncate">
                    {img.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
