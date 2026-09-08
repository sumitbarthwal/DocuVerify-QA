import React from 'react';
import { Sliders, X, Check, SearchCheck, Zap } from 'lucide-react';
import { RuleConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: RuleConfig;
  onChangeConfig: (newConfig: RuleConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
}) => {
  if (!isOpen) return null;

  const toggle = (key: keyof RuleConfig) => {
    onChangeConfig({
      ...config,
      [key]: !config[key],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">QA Inspection Rules Configuration</h3>
              <p className="text-[11px] text-slate-500">Configure client-side verification engines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rule Toggles */}
        <div className="p-5 space-y-3.5 text-xs text-slate-700 max-h-[70vh] overflow-y-auto">
          {/* Deep Scan Rigorous Cross-Referencing Toggle */}
          <div 
            onClick={() => toggle('deepScan')}
            className={`p-3.5 rounded-xl border transition cursor-pointer relative overflow-hidden ${
              config.deepScan 
                ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs' 
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition ${
                  config.deepScan ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                }`}>
                  <SearchCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">Deep Scan Mode</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      config.deepScan 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {config.deepScan ? 'Active' : 'Standard'}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                    Rigorous Table & Text Block Cross-Referencing
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Instructs the QA engine to perform an intensive, multi-pass cross-referencing between tables and text blocks for data consistency. Validates tabular schedule arithmetic, verifies cell figures against narrative remarks, and catches subtle cross-block figure divergences.
                  </p>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 mt-1.5 p-0.5 flex items-center ${
                config.deepScan ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
              }`}>
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </div>
            </div>
          </div>

          <div 
            onClick={() => toggle('checkDataContinuity')}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
          >
            <div>
              <div className="font-bold text-slate-900">Data Continuity & Formula Sums</div>
              <div className="text-[11px] text-slate-500">Flags sum variances, % sums ≠ 100%, and chronological inversions.</div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center transition ${
              config.checkDataContinuity ? 'bg-blue-600 text-white' : 'bg-slate-200'
            }`}>
              {config.checkDataContinuity && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div 
            onClick={() => toggle('checkRepetitiveData')}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
          >
            <div>
              <div className="font-bold text-slate-900">Repetitive Data & Cross-Section Consistency</div>
              <div className="text-[11px] text-slate-500">Flags conflicting figures for the same metric across different sections.</div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center transition ${
              config.checkRepetitiveData ? 'bg-blue-600 text-white' : 'bg-slate-200'
            }`}>
              {config.checkRepetitiveData && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div 
            onClick={() => toggle('checkStaleCopyPaste')}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
          >
            <div>
              <div className="font-bold text-slate-900">Stale Copy-Paste & Unchanged Defaults</div>
              <div className="text-[11px] text-slate-500">Detects identical numbers repeated across periods and unpopulated defaults.</div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center transition ${
              config.checkStaleCopyPaste ? 'bg-blue-600 text-white' : 'bg-slate-200'
            }`}>
              {config.checkStaleCopyPaste && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div 
            onClick={() => toggle('checkGrammar')}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
          >
            <div>
              <div className="font-bold text-slate-900">Grammar, Syntax & Typos</div>
              <div className="text-[11px] text-slate-500">Detects duplicated words, subject-verb agreement, and homophones.</div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center transition ${
              config.checkGrammar ? 'bg-blue-600 text-white' : 'bg-slate-200'
            }`}>
              {config.checkGrammar && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div 
            onClick={() => toggle('checkPlaceholders')}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
          >
            <div>
              <div className="font-bold text-slate-900">Draft Placeholders & Leaks</div>
              <div className="text-[11px] text-slate-500">Purges [TODO], [TBD], [INSERT], and scaffold text from final reports.</div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center transition ${
              config.checkPlaceholders ? 'bg-blue-600 text-white' : 'bg-slate-200'
            }`}>
              {config.checkPlaceholders && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div 
            onClick={() => toggle('checkUniformity')}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
          >
            <div>
              <div className="font-bold text-slate-900">Notation Uniformity</div>
              <div className="text-[11px] text-slate-500">Standardizes currency symbols ($ vs USD), numbers, and bullet periods.</div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center transition ${
              config.checkUniformity ? 'bg-blue-600 text-white' : 'bg-slate-200'
            }`}>
              {config.checkUniformity && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div 
            onClick={() => toggle('checkPunctuation')}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
          >
            <div>
              <div className="font-bold text-slate-900">Spacing & Typographical Cleanliness</div>
              <div className="text-[11px] text-slate-500">Detects double spaces and missing spaces around punctuation.</div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center transition ${
              config.checkPunctuation ? 'bg-blue-600 text-white' : 'bg-slate-200'
            }`}>
              {config.checkPunctuation && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
