import React, { useState, useEffect } from 'react';
import { CODE_SNIPPETS } from '../../utils/codeSnippets';
import { useToast } from '../../context/ToastContext';
import {
  Terminal,
  FileCode,
  Download,
  Copy,
  Check,
  BookOpen,
  FolderTree,
  PackageCheck,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CodeEnvironmentModuleProps {
  isDarkMode: boolean;
}

interface HealthData {
  status: string;
  ffmpeg?: {
    ready: boolean;
    path: string;
    version: string;
  };
  ffprobe?: {
    path: string;
    ready: boolean;
  };
  ytDlp?: {
    ready: boolean;
    path: string;
    version: string;
  };
  python?: {
    ready: boolean;
    version: string;
  };
  system?: {
    platform: string;
    arch: string;
    node: string;
  };
}

export const CodeEnvironmentModule: React.FC<CodeEnvironmentModuleProps> = ({ isDarkMode }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'requirements' | 'readme' | 'appPy' | 'diagnostics'>('diagnostics');
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [installing, setInstalling] = useState(false);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleInstallBinaries = async () => {
    setInstalling(true);
    try {
      const res = await fetch('/api/install-binaries', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast({ type: 'success', message: data.message || 'yt-dlp binary verified and ready' });
        await fetchHealth();
      } else {
        showToast({ type: 'error', message: data.error || 'Failed to install yt-dlp binary' });
      }
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Network error verifying binaries' });
    } finally {
      setInstalling(false);
    }
  };

  const getCurrentText = () => {
    switch (activeTab) {
      case 'requirements':
        return CODE_SNIPPETS.requirements;
      case 'readme':
        return CODE_SNIPPETS.readme;
      case 'appPy':
        return CODE_SNIPPETS.appPy;
      default:
        return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    if (activeTab === 'diagnostics') {
      handleInstallBinaries();
      return;
    }
    const text = getCurrentText();
    let filename = 'requirements.txt';
    if (activeTab === 'readme') filename = 'README.md';
    if (activeTab === 'appPy') filename = 'app.py';

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="code-environment-module" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div
        className={`p-4 rounded border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${
              isDarkMode ? 'bg-[#262626] text-[#f3e79a]' : 'bg-[#f4f4f5] text-[#854d0e]'
            }`}
          >
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Environment & System Dependencies</h3>
            <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Real-time binary status (yt-dlp, FFmpeg, Python), automatic installation, and deployment setup guide.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'diagnostics' ? (
            <button
              onClick={handleInstallBinaries}
              disabled={installing}
              id="btn-reverify-binaries"
              className={`flex items-center gap-1.5 px-4 py-2 rounded font-semibold text-xs transition-colors shadow-xs ${
                isDarkMode
                  ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950 disabled:opacity-50'
                  : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950 disabled:opacity-50'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${installing ? 'animate-spin' : ''}`} />
              <span>{installing ? 'Verifying / Downloading...' : 'Re-verify & Auto-Install yt-dlp'}</span>
            </button>
          ) : (
            <button
              onClick={handleDownloadSingle}
              id="btn-download-active-spec"
              className={`flex items-center gap-1.5 px-4 py-2 rounded font-semibold text-xs transition-colors shadow-xs ${
                isDarkMode
                  ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                  : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>
                Download {activeTab === 'requirements' ? 'requirements.txt' : activeTab === 'readme' ? 'README.md' : 'app.py'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={`flex border-b gap-2 ${isDarkMode ? 'border-[#2c2c2c]' : 'border-[#e0e0e0]'}`}>
        <button
          onClick={() => setActiveTab('diagnostics')}
          id="tab-diagnostics"
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'diagnostics'
              ? isDarkMode
                ? 'border-[#f3e79a] text-[#f3e79a]'
                : 'border-[#ffd600] text-neutral-950'
              : isDarkMode
              ? 'border-transparent text-[#888888] hover:text-white'
              : 'border-transparent text-[#666666] hover:text-neutral-900'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>System Binaries & Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveTab('requirements')}
          id="tab-requirements"
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'requirements'
              ? isDarkMode
                ? 'border-[#f3e79a] text-[#f3e79a]'
                : 'border-[#ffd600] text-neutral-950'
              : isDarkMode
              ? 'border-transparent text-[#888888] hover:text-white'
              : 'border-transparent text-[#666666] hover:text-neutral-900'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>requirements.txt</span>
        </button>

        <button
          onClick={() => setActiveTab('readme')}
          id="tab-readme"
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'readme'
              ? isDarkMode
                ? 'border-[#f3e79a] text-[#f3e79a]'
                : 'border-[#ffd600] text-neutral-950'
              : isDarkMode
              ? 'border-transparent text-[#888888] hover:text-white'
              : 'border-transparent text-[#666666] hover:text-neutral-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>README.md</span>
        </button>

        <button
          onClick={() => setActiveTab('appPy')}
          id="tab-app-py"
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'appPy'
              ? isDarkMode
                ? 'border-[#f3e79a] text-[#f3e79a]'
                : 'border-[#ffd600] text-neutral-950'
              : isDarkMode
              ? 'border-transparent text-[#888888] hover:text-white'
              : 'border-transparent text-[#666666] hover:text-neutral-900'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>app.py (Streamlit Master Script)</span>
        </button>
      </div>

      {/* TAB CONTENT: System Diagnostics */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          {/* Live Binary Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* yt-dlp card */}
            <div
              className={`p-4 rounded border ${
                isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Streaming Tool</span>
                {health?.ytDlp?.ready ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3" /> Missing
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold">yt-dlp</h4>
              <p className={`text-xs mt-1 font-mono truncate ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {health?.ytDlp?.version ? `v${health.ytDlp.version}` : 'Not detected'}
              </p>
              <div className="mt-3 pt-2 border-t border-inherit flex items-center justify-between text-[11px] text-neutral-500">
                <span>Location:</span>
                <span className="font-mono text-[10px] truncate max-w-[150px]">
                  {health?.ytDlp?.path ? health.ytDlp.path.replace(process.cwd?.() || '', '.') : 'Auto-install ready'}
                </span>
              </div>
            </div>

            {/* FFmpeg card */}
            <div
              className={`p-4 rounded border ${
                isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Media Engine</span>
                {health?.ffmpeg?.ready ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3" /> Missing
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold">FFmpeg</h4>
              <p className={`text-xs mt-1 font-mono truncate ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {health?.ffmpeg?.version ? health.ffmpeg.version.split(' ')[2] || 'Bundled' : 'Bundled Static'}
              </p>
              <div className="mt-3 pt-2 border-t border-inherit flex items-center justify-between text-[11px] text-neutral-500">
                <span>Location:</span>
                <span className="font-mono text-[10px] truncate max-w-[150px]">
                  {health?.ffmpeg?.path ? health.ffmpeg.path.replace(process.cwd?.() || '', '.') : 'ffmpeg-static'}
                </span>
              </div>
            </div>

            {/* Python 3 card */}
            <div
              className={`p-4 rounded border ${
                isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Runtime</span>
                {health?.python?.ready ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400 bg-neutral-500/10 px-2 py-0.5 rounded">
                    Optional
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold">Python 3</h4>
              <p className={`text-xs mt-1 font-mono truncate ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {health?.python?.version || 'Python 3'}
              </p>
              <div className="mt-3 pt-2 border-t border-inherit flex items-center justify-between text-[11px] text-neutral-500">
                <span>Purpose:</span>
                <span className="text-[10px]">yt-dlp core & scripts</span>
              </div>
            </div>

            {/* Node.js / System card */}
            <div
              className={`p-4 rounded border ${
                isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Host Environment</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              </div>
              <h4 className="text-base font-bold">Node.js {health?.system?.node || process.version}</h4>
              <p className={`text-xs mt-1 font-mono truncate ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {health?.system?.platform || 'linux'} ({health?.system?.arch || 'x64'})
              </p>
              <div className="mt-3 pt-2 border-t border-inherit flex items-center justify-between text-[11px] text-neutral-500">
                <span>Container:</span>
                <span className="text-[10px]">Cloud Run / Full-Stack</span>
              </div>
            </div>
          </div>

          {/* Self-Healing & Automated Installation Explanation */}
          <div
            className={`p-5 rounded border space-y-3 ${
              isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
              <h4 className="text-xs font-semibold uppercase tracking-wider">
                Automated Self-Healing in Production (Cloud Run)
              </h4>
            </div>
            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              In containerized and cloud production environments (e.g. Cloud Run), external system packages like <code>yt-dlp</code> are not always pre-baked into base images.
              This application implements <strong>multi-layered automatic self-healing</strong>:
            </p>
            <ul className={`text-xs space-y-1.5 list-disc pl-5 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              <li><strong>Local Project Bundle:</strong> <code>bin/yt-dlp</code> is maintained in the project directory.</li>
              <li><strong>NPM Postinstall Hook:</strong> <code>npm run postinstall</code> automatically checks and downloads <code>yt-dlp</code> during container build.</li>
              <li><strong>Runtime On-Demand Self-Healing:</strong> If missing at runtime, <code>server.ts</code> automatically downloads the latest standalone binary and marks it executable without downtime.</li>
              <li><strong>Integrated FFmpeg Routing:</strong> Streaming downloads automatically link to <code>ffmpeg-static</code> via <code>--ffmpeg-location</code>.</li>
            </ul>
          </div>

          {/* Manual Installation Instructions for External Environments */}
          <div
            className={`p-5 rounded border space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Server className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
              <h4 className="text-xs font-semibold uppercase tracking-wider">
                Installation Guide for External Environments (Local / Custom Docker)
              </h4>
            </div>

            <div className="space-y-4 text-xs">
              {/* Linux / Debian / Ubuntu / Cloud Run */}
              <div>
                <h5 className="font-semibold text-neutral-300 mb-1">Linux / Ubuntu / Debian / Cloud Run:</h5>
                <pre
                  className={`p-3 rounded font-mono text-[11px] overflow-x-auto ${
                    isDarkMode ? 'bg-[#121212] border border-[#2c2c2c] text-neutral-300' : 'bg-[#fafafa] border border-[#e0e0e0] text-neutral-800'
                  }`}
                >
{`# 1. Install FFmpeg & Python
sudo apt-get update && sudo apt-get install -y ffmpeg python3 curl

# 2. Install latest standalone yt-dlp binary system-wide
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Verify
yt-dlp --version`}
                </pre>
              </div>

              {/* macOS */}
              <div>
                <h5 className="font-semibold text-neutral-300 mb-1">macOS (Homebrew):</h5>
                <pre
                  className={`p-3 rounded font-mono text-[11px] overflow-x-auto ${
                    isDarkMode ? 'bg-[#121212] border border-[#2c2c2c] text-neutral-300' : 'bg-[#fafafa] border border-[#e0e0e0] text-neutral-800'
                  }`}
                >
{`brew install yt-dlp ffmpeg python
yt-dlp --version`}
                </pre>
              </div>

              {/* Windows */}
              <div>
                <h5 className="font-semibold text-neutral-300 mb-1">Windows (winget / scoop):</h5>
                <pre
                  className={`p-3 rounded font-mono text-[11px] overflow-x-auto ${
                    isDarkMode ? 'bg-[#121212] border border-[#2c2c2c] text-neutral-300' : 'bg-[#fafafa] border border-[#e0e0e0] text-neutral-800'
                  }`}
                >
{`winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg`}
                </pre>
              </div>

              {/* Dockerfile snippet */}
              <div>
                <h5 className="font-semibold text-neutral-300 mb-1">Dockerfile (if building a custom production image):</h5>
                <pre
                  className={`p-3 rounded font-mono text-[11px] overflow-x-auto ${
                    isDarkMode ? 'bg-[#121212] border border-[#2c2c2c] text-neutral-300' : 'bg-[#fafafa] border border-[#e0e0e0] text-neutral-800'
                  }`}
                >
{`FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y ffmpeg python3 curl && rm -rf /var/lib/apt/lists/*
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \\
    && chmod a+rx /usr/local/bin/yt-dlp`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Display Area for requirements / readme / appPy */}
      {activeTab !== 'diagnostics' && (
        <div
          className={`rounded border overflow-hidden ${
            isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'
          }`}
        >
          <div
            className={`p-3 px-4 border-b flex items-center justify-between text-xs ${
              isDarkMode ? 'border-[#2c2c2c] bg-[#181818] text-[#888888]' : 'border-[#e0e0e0] bg-[#f4f4f5] text-[#666666]'
            }`}
          >
            <span className="font-mono text-xs">
              {activeTab === 'requirements'
                ? 'python_app/requirements.txt'
                : activeTab === 'readme'
                ? 'python_app/README.md'
                : 'python_app/app.py'}
            </span>

            <button
              onClick={handleCopy}
              id="btn-copy-code-snippet"
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors text-xs font-semibold ${
                isDarkMode
                  ? 'bg-[#262626] hover:bg-[#333333] text-neutral-200'
                  : 'bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300'
              }`}
            >
              {copied ? (
                <Check className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <pre
            className={`p-4 font-mono text-xs overflow-x-auto leading-relaxed max-h-[500px] ${
              isDarkMode ? 'text-neutral-200' : 'text-neutral-800'
            }`}
          >
            <code>{getCurrentText()}</code>
          </pre>
        </div>
      )}

      {/* Environment Architecture Tree */}
      <div
        className={`p-5 rounded border space-y-3 ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="flex items-center gap-2">
          <FolderTree className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
          <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
            Consolidated Python Project Structure
          </h4>
        </div>

        <pre
          className={`p-4 rounded font-mono text-xs leading-relaxed overflow-x-auto ${
            isDarkMode ? 'bg-[#121212] border border-[#2c2c2c] text-neutral-300' : 'bg-[#fafafa] border border-[#e0e0e0] text-neutral-800'
          }`}
        >
{`python_app/
├── app.py                      # Master Streamlit entry point (multi-page + state persistence)
├── requirements.txt            # Consolidated dependencies for all 4 modules
├── README.md                   # Environment setup & FFmpeg installation guide
├── modules/
│   ├── video_transcriber.py    # Module 1: Whisper + yt-dlp + GPT-4o-mini
│   ├── media_clipper.py        # Module 2: hh:mm:ss Audio/Video clipper
│   ├── audiobook_transcriber.py# Module 3: Audiobook snippet & ffprobe tag extractor
│   └── audio_extractor.py      # Module 4: Timeline audio extractor to MP3
└── utils/
    ├── crypto_vault.py         # Encrypted secret vault (PBKDF2 + AES-GCM)
    ├── cost_calculator.py      # Per-module real-time cost calculator
    └── cleanup.py              # Zero-retention ephemeral file purger`}
        </pre>
      </div>
    </div>
  );
};
