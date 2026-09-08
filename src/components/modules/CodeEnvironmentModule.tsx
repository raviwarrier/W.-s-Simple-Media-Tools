import React, { useState } from 'react';
import { CODE_SNIPPETS } from '../../utils/codeSnippets';
import {
  Terminal,
  FileCode,
  Download,
  Copy,
  Check,
  BookOpen,
  FolderTree,
  ExternalLink,
  PackageCheck,
} from 'lucide-react';

interface CodeEnvironmentModuleProps {
  isDarkMode: boolean;
}

export const CodeEnvironmentModule: React.FC<CodeEnvironmentModuleProps> = ({ isDarkMode }) => {
  const [activeTab, setActiveTab] = useState<'requirements' | 'readme' | 'appPy'>('requirements');
  const [copied, setCopied] = useState(false);

  const getCurrentText = () => {
    switch (activeTab) {
      case 'requirements':
        return CODE_SNIPPETS.requirements;
      case 'readme':
        return CODE_SNIPPETS.readme;
      case 'appPy':
        return CODE_SNIPPETS.appPy;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
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
            <h3 className="text-sm font-semibold tracking-tight">Environment & Python Setup</h3>
            <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Single unified environment specification (`requirements.txt`), complete setup guide, and Python sources.
            </p>
          </div>
        </div>

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
      </div>

      {/* Navigation Tabs */}
      <div className={`flex border-b gap-2 ${isDarkMode ? 'border-[#2c2c2c]' : 'border-[#e0e0e0]'}`}>
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

      {/* Code Display Area */}
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

        <pre className={`p-4 font-mono text-xs overflow-x-auto leading-relaxed max-h-[500px] ${
          isDarkMode ? 'text-neutral-200' : 'text-neutral-800'
        }`}>
          <code>{getCurrentText()}</code>
        </pre>
      </div>

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

        <pre className={`p-4 rounded font-mono text-xs leading-relaxed overflow-x-auto ${
          isDarkMode ? 'bg-[#121212] border border-[#2c2c2c] text-neutral-300' : 'bg-[#fafafa] border border-[#e0e0e0] text-neutral-800'
        }`}>
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
