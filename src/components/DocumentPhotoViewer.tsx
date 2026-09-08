import React, { useState } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Maximize2, 
  Image as ImageIcon 
} from 'lucide-react';

export interface DocumentPhotoViewerProps {
  isOpen: boolean;
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}

export const DocumentPhotoViewer: React.FC<DocumentPhotoViewerProps> = ({
  isOpen,
  src,
  alt,
  caption,
  onClose,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  if (!isOpen) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = alt.replace(/[^a-zA-Z0-9_-]/g, '_') || 'document_photo.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-xs flex flex-col animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top Controls Bar */}
      <div 
        className="px-6 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 max-w-md truncate">
          <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-sm truncate">{alt || 'Document Photo Plate'}</span>
          {caption && <span className="text-xs text-slate-400 truncate">({caption})</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1 text-slate-300">
            <button
              onClick={() => setZoom(z => Math.max(50, z - 20))}
              className="p-1 hover:text-white hover:bg-slate-700 rounded transition"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-2 font-semibold">{zoom}%</span>
            <button
              onClick={() => setZoom(z => Math.min(300, z + 20))}
              className="p-1 hover:text-white hover:bg-slate-700 rounded transition"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Rotate */}
          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
            title="Rotate 90 degrees"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
            title="Download high-resolution image"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg transition ml-2"
            title="Close viewer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div 
        className="flex-1 flex items-center justify-center p-6 overflow-auto"
        onClick={onClose}
      >
        <div 
          className="relative transition-transform duration-150 flex items-center justify-center max-w-full max-h-full"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[82vh] max-w-[90vw] object-contain rounded-md shadow-2xl border border-slate-700/50 bg-white"
          />
        </div>
      </div>

      {/* Bottom Caption Pill */}
      {alt && (
        <div className="py-2.5 px-4 text-center bg-slate-900/80 border-t border-slate-800 text-xs text-slate-300 select-none">
          <span>{alt}</span>
          <button
            onClick={handleReset}
            className="ml-3 text-blue-400 hover:text-blue-300 underline text-[11px]"
          >
            Reset view
          </button>
        </div>
      )}
    </div>
  );
};
