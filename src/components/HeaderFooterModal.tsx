import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  FileText, 
  RotateCcw, 
  AlignLeft, 
  AlignRight, 
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export interface HeaderFooterModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerText: string;
  footerText: string;
  onSave: (header: string, footer: string) => void;
  autoHeader: string;
  autoFooter: string;
}

export const HeaderFooterModal: React.FC<HeaderFooterModalProps> = ({
  isOpen,
  onClose,
  headerText,
  footerText,
  onSave,
  autoHeader,
  autoFooter,
}) => {
  const [currentHeader, setCurrentHeader] = useState<string>(headerText || autoHeader);
  const [currentFooter, setCurrentFooter] = useState<string>(footerText || autoFooter);

  useEffect(() => {
    setCurrentHeader(headerText || autoHeader);
    setCurrentFooter(footerText || autoFooter);
  }, [headerText, footerText, autoHeader, autoFooter, isOpen]);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(currentHeader, currentFooter);
    onClose();
  };

  const handleResetToAuto = () => {
    setCurrentHeader(autoHeader);
    setCurrentFooter(autoFooter);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-base">Running Header &amp; Footer Settings</h3>
              <p className="text-xs text-slate-500">Configure header &amp; footer fidelity as per your original draft file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleApply} className="p-6 space-y-5">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Original File Fidelity</p>
              <p className="text-blue-800 leading-relaxed">
                When importing Word (.docx) or draft documents, extracted running headers and footers are automatically synchronized into both view mode and exported Word/PDF files.
              </p>
            </div>
          </div>

          {/* Running Header Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <label htmlFor="modal-header-input" className="flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-blue-600" />
                <span>Running Header Text (Top of Pages)</span>
              </label>
              <span className="text-[11px] text-slate-400">Printed on every page</span>
            </div>
            <textarea
              id="modal-header-input"
              value={currentHeader}
              onChange={(e) => setCurrentHeader(e.target.value)}
              placeholder="e.g., ABC Surveyors Ltd | Motor Survey Assessment | Ref: SRV-2026-908"
              rows={2}
              className="w-full p-2.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-mono"
            />
          </div>

          {/* Running Footer Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <label htmlFor="modal-footer-input" className="flex items-center gap-1.5">
                <AlignRight className="w-3.5 h-3.5 text-blue-600" />
                <span>Running Footer Text (Bottom of Pages)</span>
              </label>
              <span className="text-[11px] text-slate-400">Page number dynamically added</span>
            </div>
            <textarea
              id="modal-footer-input"
              value={currentFooter}
              onChange={(e) => setCurrentFooter(e.target.value)}
              placeholder="e.g., Policy: POL-98421 | Claim: CLM-44219 | Confidential Audit Document"
              rows={2}
              className="w-full p-2.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-mono"
            />
          </div>

          {/* Live Preview Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Live Preview</div>
            <div className="bg-white p-3 rounded border border-slate-300 shadow-2xs space-y-3">
              <div className="border-b border-slate-200 pb-1 flex justify-between text-[10px] text-slate-500 font-mono">
                <span className="truncate max-w-[70%] font-semibold">{currentHeader || '(Empty Header)'}</span>
                <span>Page 1</span>
              </div>
              <div className="text-[11px] text-slate-400 italic text-center py-2">
                [ Document Body Content Area ]
              </div>
              <div className="border-t border-slate-200 pt-1 flex justify-between text-[10px] text-slate-500 font-mono">
                <span className="truncate max-w-[70%]">{currentFooter || '(Empty Footer)'}</span>
                <span>Chingham&apos;s DocuVerify</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetToAuto}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Auto-detected</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition"
              >
                <Check className="w-4 h-4" />
                <span>Save Header &amp; Footer</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
