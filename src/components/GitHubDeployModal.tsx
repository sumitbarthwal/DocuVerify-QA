import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Globe, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  FileCode, 
  Terminal, 
  GitBranch, 
  FolderGit2, 
  Sparkles,
  HelpCircle,
  Play
} from 'lucide-react';
import { downloadGitHubProjectZip } from '../services/gitExportService';

interface GitHubDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubDeployModal: React.FC<GitHubDeployModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsExporting(true);
      await downloadGitHubProjectZip();
    } finally {
      setIsExporting(false);
    }
  };

  const gitCliSteps = `git init
git add -A
git commit -m "feat: complete DocuVerify QA engine and native editor add-ins"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
git push -u origin main`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-xs">
              <FolderGit2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">GitHub &amp; GitHub Pages Guide</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready to Deploy
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Resolve GitHub export, repository push, or GitHub Pages deployment issues
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
          {/* Quick Diagnosis Banner */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Common Reasons Why GitHub Might Say "Not Working"</span>
            </div>
            <ul className="text-amber-800 space-y-1.5 list-disc list-inside pl-1 text-[11px] leading-relaxed">
              <li>
                <strong>AI Studio "Export to GitHub" authorization:</strong> If your GitHub account token expired or third-party permissions are restricted, use the <strong>Direct Git CLI commands</strong> or download the <strong>Repository ZIP</strong> below.
              </li>
              <li>
                <strong>GitHub Pages 404 error:</strong> In your GitHub repository, you must enable Pages: go to <strong>Settings &gt; Pages &gt; Source</strong> and choose either <strong>GitHub Actions</strong> or <strong>Deploy from branch &gt; /docs</strong>.
              </li>
              <li>
                <strong>Workflow permissions:</strong> Go to <strong>Settings &gt; Actions &gt; General &gt; Workflow permissions</strong> and select <strong>"Read and write permissions"</strong>.
              </li>
            </ul>
          </div>

          {/* Solution 1: Direct Download Codebase ZIP */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Option 1: Download Complete Repository (.zip)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Get the complete clean project with all source code, workflows, configs, and assets ready to drag into GitHub
                </p>
              </div>
              <button
                onClick={handleDownloadZip}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Packaging...' : 'Download Project ZIP'}</span>
              </button>
            </div>
          </div>

          {/* Solution 2: Standard Git CLI Push Commands */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-indigo-600" />
                <span>Option 2: Push via Git Terminal (5 Simple Commands)</span>
              </h3>
              <button
                onClick={() => copyToClipboard(gitCliSteps, 'cli')}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition"
              >
                {copiedCmd === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd === 'cli' ? 'Copied Commands!' : 'Copy All'}</span>
              </button>
            </div>

            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto space-y-1">
              <p className="text-slate-400"># 1. Initialize git and commit files (already executed in workspace):</p>
              <p className="text-emerald-400">git init</p>
              <p className="text-emerald-400">git add -A</p>
              <p className="text-emerald-400">git commit -m "feat: complete DocuVerify QA engine and native add-ins"</p>
              <p className="text-slate-400 pt-1"># 2. Set default branch to main:</p>
              <p className="text-emerald-400">git branch -M main</p>
              <p className="text-slate-400 pt-1"># 3. Add your GitHub remote and push:</p>
              <p className="text-amber-300">git remote add origin https://github.com/&lt;YOUR-USERNAME&gt;/&lt;YOUR-REPO-NAME&gt;.git</p>
              <p className="text-emerald-400">git push -u origin main</p>
            </div>
          </div>

          {/* Solution 3: GitHub Pages 2-Click Setup */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-white">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>How to Enable Free GitHub Pages Hosting</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px]">Method A: Automated GitHub Actions (Recommended)</span>
                <ol className="list-decimal list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                  <li>In your repo, go to <strong>Settings &gt; Pages</strong>.</li>
                  <li>Under <strong>Build and deployment &gt; Source</strong>, choose <strong>GitHub Actions</strong>.</li>
                  <li>Push to <strong>main</strong>. The bundled <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px]">.github/workflows/deploy.yml</code> automatically builds and publishes the site!</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px]">Method B: Instant /docs Folder Deployment</span>
                <ol className="list-decimal list-inside text-slate-600 space-y-1 pl-1 text-[11px]">
                  <li>In your repo, go to <strong>Settings &gt; Pages</strong>.</li>
                  <li>Under <strong>Source</strong>, select <strong>Deploy from a branch</strong>.</li>
                  <li>Select branch <strong>main</strong> and folder <strong>/docs</strong>.</li>
                  <li>Click <strong>Save</strong>. The site deploys instantly!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Repository initialized on branch 'main' &bull; GitHub Actions workflow configured</span>
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
