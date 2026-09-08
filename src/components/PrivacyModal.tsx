import React from 'react';
import { ShieldCheck, Lock, WifiOff, Cpu, CheckCircle, X } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">100% Offline Privacy Guarantee</h3>
              <p className="text-xs text-emerald-800 font-medium">Zero Cloud Transmission • Air-Gapped Safe</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
          <p className="text-slate-800 text-sm font-medium">
            Your documents contain sensitive proprietary, clinical, financial, or confidential data. Chingham's DocuVerify is architected to operate with absolute privacy:
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Offline Native Verification</h4>
                <p className="text-slate-500 mt-0.5">
                  All grammar, mathematical continuity, arithmetic verification, and uniformity engines run directly inside your browser memory. You can disconnect your internet and the software functions completely.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Zero Server Storage & Telemetry</h4>
                <p className="text-slate-500 mt-0.5">
                  No keystrokes, uploaded Word documents (.docx), text files, or audit results are ever sent or logged to any external server or third party.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Client-Side Document Parsing</h4>
                <p className="text-slate-500 mt-0.5">
                  Uploaded Word files (.docx) are unpacked and rendered directly in client JavaScript using in-memory ArrayBuffers.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Compliant with strict confidential client NDA and GDPR privacy standards.</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
          >
            Understood & Close
          </button>
        </div>
      </div>
    </div>
  );
};
