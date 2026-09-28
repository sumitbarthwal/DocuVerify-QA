import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  FileText, 
  FileSpreadsheet, 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Monitor, 
  Laptop, 
  Globe, 
  ShieldCheck, 
  Zap,
  Play
} from 'lucide-react';
import { generateOfficeManifestXml, generateAcrobatScript, generateGoogleDocsScript } from '../services/officeAddinService';

interface NativeAddinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchWordSimulator: () => void;
}

export const NativeAddinModal: React.FC<NativeAddinModalProps> = ({
  isOpen,
  onClose,
  onLaunchWordSimulator,
}) => {
  const [activeTab, setActiveTab] = useState<'word' | 'excel' | 'acrobat' | 'gdocs'>('word');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000';
  const manifestUrl = `${currentOrigin}/manifest.xml`;

  const handleCopyManifestUrl = () => {
    navigator.clipboard.writeText(manifestUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadWordManifest = () => {
    const xml = generateOfficeManifestXml(currentOrigin);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DocuVerify_Word_Manifest.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAcrobatScript = () => {
    const js = generateAcrobatScript(currentOrigin);
    const blob = new Blob([js], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DocuVerify_Acrobat_QA.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadGoogleDocsScript = () => {
    const gs = generateGoogleDocsScript(currentOrigin);
    const blob = new Blob([gs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DocuVerify_GoogleDocs.gs';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCodeSnippet = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">Native Editor Add-in &amp; Extension Suite</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 uppercase tracking-wider">
                  Zero Rendering Loss
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Integrates directly inside native MS Word, Excel, Adobe Acrobat &amp; Google Docs
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Value Proposition Callout */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>100% Native Fidelity Guaranteed:</strong> By running as an embedded Add-in taskpane, the native editor handles all layout, styles, tables, headers, footers &amp; PDF exports directly. No markdown conversion or layout degradation.
            </span>
          </div>
          <button
            onClick={() => {
              onClose();
              onLaunchWordSimulator();
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition shadow-xs text-xs cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Launch Word Simulator</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('word')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-t border-x transition cursor-pointer ${
              activeTab === 'word'
                ? 'bg-white text-blue-700 border-slate-200 border-b-transparent shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Microsoft Word (Office.js)</span>
            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-semibold">Recommended</span>
          </button>

          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-t border-x transition cursor-pointer ${
              activeTab === 'excel'
                ? 'bg-white text-emerald-700 border-slate-200 border-b-transparent shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Microsoft Excel</span>
          </button>

          <button
            onClick={() => setActiveTab('acrobat')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-t border-x transition cursor-pointer ${
              activeTab === 'acrobat'
                ? 'bg-white text-rose-700 border-slate-200 border-b-transparent shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Printer className="w-4 h-4 text-rose-600" />
            <span>Adobe Acrobat Pro</span>
          </button>

          <button
            onClick={() => setActiveTab('gdocs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-t border-x transition cursor-pointer ${
              activeTab === 'gdocs'
                ? 'bg-white text-indigo-700 border-slate-200 border-b-transparent shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Globe className="w-4 h-4 text-indigo-600" />
            <span>Google Docs (Workspace)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: MICROSOFT WORD */}
          {activeTab === 'word' && (
            <div className="space-y-6">
              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>In-Place Live Highlighting</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Clicking any issue in the taskpane instantly jumps to and highlights the exact run in your real Word document.
                  </p>
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>1-Click Native Text Replace</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Replaces incorrect text via Word.run without altering surrounding fonts, line spacing, margins, or paragraph styles.
                  </p>
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Native Word PDF &amp; Print</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Save as .docx or export to .pdf directly through Microsoft Word's own high-precision print engine.
                  </p>
                </div>
              </div>

              {/* Action Bar: Download & Copy Manifest */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Microsoft Office Add-in Manifest (.xml)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Production-ready XML manifest pre-configured for your active workspace URL
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopyManifestUrl}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                    title="Copy direct manifest URL for deployment"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copiedUrl ? 'Copied URL!' : 'Copy Manifest URL'}</span>
                  </button>
                  <button
                    onClick={handleDownloadWordManifest}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download manifest.xml</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Installation Guides */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  How to Sideload &amp; Install into Microsoft Word
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Method A: Word for the Web (Office 365) */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">Option 1: Word for the Web (Office 365)</h5>
                        <p className="text-[10px] text-slate-500">Fastest — No installation permissions required</p>
                      </div>
                    </div>
                    <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1">
                      <li>Open any document in <strong className="text-slate-800">Word Online (office.com)</strong>.</li>
                      <li>Click the <strong className="text-slate-800">Insert</strong> tab in the ribbon &gt; <strong className="text-slate-800">Add-ins</strong> (or "More Add-ins").</li>
                      <li>In the Office Add-ins dialog, select <strong className="text-slate-800">My Add-ins</strong> &gt; <strong className="text-slate-800">Upload My Add-in</strong>.</li>
                      <li>Choose the downloaded <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[11px]">DocuVerify_Word_Manifest.xml</code>.</li>
                      <li>Click <strong className="text-slate-800">Upload</strong>. The "DocuVerify QA" button will dock in your ribbon and open the taskpane!</li>
                    </ol>
                  </div>

                  {/* Method B: Word Desktop (Windows / Mac) */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">Option 2: Microsoft Word Desktop</h5>
                        <p className="text-[10px] text-slate-500">Windows 10/11 &amp; macOS Office 2019/2021/365</p>
                      </div>
                    </div>
                    <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1">
                      <li>In Word Desktop, open <strong className="text-slate-800">File &gt; Options &gt; Trust Center &gt; Trust Center Settings</strong>.</li>
                      <li>Select <strong className="text-slate-800">Trusted Add-in Catalogs</strong>.</li>
                      <li>Add your local folder containing <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">manifest.xml</code> as a trusted share.</li>
                      <li>Restart Word, go to <strong className="text-slate-800">Insert &gt; My Add-ins &gt; Shared Folder</strong>.</li>
                      <li>Click <strong className="text-slate-800">DocuVerify QA Assistant</strong> to launch the native taskpane!</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Try Interactive Simulator Callout */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-blue-950">Want to test before installing?</h5>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Launch our interactive Microsoft Word Simulator right here to see live taskpane highlights &amp; in-place Word fixes!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onLaunchWordSimulator();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Open Simulator</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MICROSOFT EXCEL */}
          {activeTab === 'excel' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Spreadsheet Cross-Verification &amp; Calculation Audit</h4>
                  <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                    The DocuVerify manifest also registers with Microsoft Excel. When opened in Excel, the taskpane scans active worksheets for sum discrepancies, duplicate line items, currency format inconsistencies ($ vs USD), and broken formula references.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Shared Office Manifest (Word + Excel)</h4>
                  <p className="text-[11px] text-slate-500 text-[11px] mt-0.5">
                    The same manifest XML works across both Word and Excel hosts via Office.js
                  </p>
                </div>
                <button
                  onClick={handleDownloadWordManifest}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Excel Manifest</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white">
                <h5 className="text-xs font-bold text-slate-800">Excel Sideloading Steps:</h5>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1">
                  <li>Open Microsoft Excel (Web or Desktop).</li>
                  <li>Go to <strong className="text-slate-800">Insert &gt; Add-ins &gt; Upload My Add-in</strong>.</li>
                  <li>Upload the downloaded <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700 font-mono text-[11px]">DocuVerify_Word_Manifest.xml</code>.</li>
                  <li>The DocuVerify QA ribbon icon appears in Excel's Home/Review tab.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: ADOBE ACROBAT PRO */}
          {activeTab === 'acrobat' && (
            <div className="space-y-6">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                <Printer className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-950">Adobe Acrobat Pro Automation &amp; Action Wizard</h4>
                  <p className="text-[11px] text-rose-800 mt-1 leading-relaxed">
                    Install the DocuVerify QA Preflight script into Adobe Acrobat Pro to verify PDF documents, detect unresolved placeholders ([TBD], [DRAFT]), audit document metadata (Title, Author, Permissions), and ensure print compliance directly in Acrobat.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">DocuVerify Acrobat Pro Script (JavaScript Plugin)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Folder-level Acrobat script that registers a "DocuVerify QA Audit..." tool in Acrobat's menu
                  </p>
                </div>
                <button
                  onClick={handleDownloadAcrobatScript}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download DocuVerify_Acrobat_QA.js</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
                <h5 className="text-xs font-bold text-slate-800">How to Install in Adobe Acrobat Pro:</h5>
                <div className="space-y-2 text-xs text-slate-600">
                  <p>Copy the downloaded <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-700 font-mono text-[11px]">DocuVerify_Acrobat_QA.js</code> file to your Acrobat JavaScript folder:</p>
                  <div className="p-2.5 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] space-y-1">
                    <p className="text-slate-400"># Windows:</p>
                    <p>C:\Users\&lt;YourUsername&gt;\AppData\Roaming\Adobe\Acrobat\Privileged\DC\JavaScripts\</p>
                    <p className="text-slate-400 mt-1"># macOS:</p>
                    <p>~/Library/Application Support/Adobe/Acrobat/DC/JavaScripts/</p>
                  </div>
                  <p>Restart Adobe Acrobat Pro. A new item <strong className="text-slate-800">Tools &gt; DocuVerify QA Audit...</strong> will now appear whenever any PDF report is open.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GOOGLE DOCS */}
          {activeTab === 'gdocs' && (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
                <Globe className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Google Docs &amp; Google Workspace Add-on</h4>
                  <p className="text-[11px] text-indigo-800 mt-1 leading-relaxed">
                    Embed the DocuVerify QA taskpane directly as a sidebar in Google Docs using Apps Script. Audits live document text with zero formatting alterations.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Google Apps Script Connector (.gs)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Embeds the live DocuVerify QA sidebar directly into any Google Doc
                  </p>
                </div>
                <button
                  onClick={handleDownloadGoogleDocsScript}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Code.gs</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white">
                <h5 className="text-xs font-bold text-slate-800">3-Minute Setup in Google Docs:</h5>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1">
                  <li>In Google Docs, click <strong className="text-slate-800">Extensions &gt; Apps Script</strong>.</li>
                  <li>Paste the code from <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">DocuVerify_GoogleDocs.gs</code> into <strong className="text-slate-800">Code.gs</strong>.</li>
                  <li>Click <strong className="text-slate-800">Save</strong> and then <strong className="text-slate-800">Run &gt; onOpen</strong>.</li>
                  <li>Return to your Google Doc. Click <strong className="text-slate-800">DocuVerify QA &gt; Open QA Taskpane</strong> in the top menu bar!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Zero cloud transfer &bull; Client-side security &bull; Compatible with Office 365, 2021, 2019</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
