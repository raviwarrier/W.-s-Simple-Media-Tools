import React, { useState, useEffect, useRef } from 'react';
import {
  VideoDownloaderState,
  VideoDownloaderQuality,
  VideoDownloaderCookieMode,
  SupportedBrowser,
  DownloadQueueItem,
  SecretStore,
  CostTrackerState,
  ModuleId,
} from '../../types';
import { useToast } from '../../context/ToastContext';
import {
  Download,
  Search,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  Folder,
  RefreshCw,
  X,
  Copy,
  Shield,
  ChevronDown,
  ChevronUp,
  Terminal,
  Film,
  Music,
  Sliders,
  Play,
  Upload,
  ExternalLink,
  Layers,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface VideoDownloaderModuleProps {
  state: VideoDownloaderState;
  onChange: React.Dispatch<React.SetStateAction<VideoDownloaderState>>;
  secretStore: SecretStore;
  costTracker: CostTrackerState;
  onRecordCost: (
    module: ModuleId,
    operationName: string,
    durationSec: number,
    inputTokens: number,
    outputTokens: number,
    details: string
  ) => void;
  isDarkMode: boolean;
}

const BROWSER_OPTIONS: { id: SupportedBrowser; label: string }[] = [
  { id: 'chrome', label: 'Google Chrome' },
  { id: 'firefox', label: 'Mozilla Firefox' },
  { id: 'edge', label: 'Microsoft Edge' },
  { id: 'brave', label: 'Brave Browser' },
  { id: 'opera', label: 'Opera' },
  { id: 'vivaldi', label: 'Vivaldi' },
  { id: 'chromium', label: 'Chromium' },
  { id: 'safari', label: 'Safari (macOS)' },
];

const NAMING_PRESETS = [
  { value: '%(title)s.%(ext)s', label: 'Title Only (%(title)s.%(ext)s)' },
  { value: '%(uploader)s - %(title)s.%(ext)s', label: 'Uploader - Title (%(uploader)s - %(title)s.%(ext)s)' },
  { value: '%(id)s - %(title)s.%(ext)s', label: 'ID - Title (%(id)s - %(title)s.%(ext)s)' },
  { value: '%(upload_date)s - %(title)s.%(ext)s', label: 'Date - Title (%(upload_date)s - %(title)s.%(ext)s)' },
  { value: 'custom', label: 'Custom Template...' },
];

export const VideoDownloaderModule: React.FC<VideoDownloaderModuleProps> = ({
  state,
  onChange,
  onRecordCost,
  isDarkMode,
}) => {
  const { showToast } = useToast();
  const [showFirefoxHelp, setShowFirefoxHelp] = useState(false);
  const [isCopiedCommand, setIsCopiedCommand] = useState(false);
  const [customNamingInput, setCustomNamingInput] = useState(state.namingScheme);
  const [completedFolderFiles, setCompletedFolderFiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'folder' | 'logs'>('queue');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const autoTriggeredDownloads = useRef<Set<string>>(new Set());

  // Function to programmatically trigger browser download
  const triggerBrowserDownload = (downloadUrl: string, filename?: string) => {
    try {
      const fullUrl = `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}autodelete=true`;
      const link = document.createElement('a');
      link.href = fullUrl;
      if (filename) {
        link.download = filename;
      }
      link.setAttribute('rel', 'noopener noreferrer');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast({
        type: 'success',
        title: 'Downloading to PC',
        message: `Saving "${filename || 'media'}" to your browser downloads folder.`,
        duration: 4000,
      });
    } catch (err: any) {
      console.warn('Auto browser download trigger failed:', err);
    }
  };

  // Auto-cleanup on browser/tab close via beforeunload / pagehide beacon
  useEffect(() => {
    const handleUnload = () => {
      if (state.autoCleanServerOnClose) {
        // Send a reliable beacon to purge server-side downloaded files when the tab or window closes
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/downloader/purge');
        } else {
          fetch('/api/downloader/purge', { method: 'POST', keepalive: true }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [state.autoCleanServerOnClose]);

  // Poll or connect to Server-Sent Events (SSE) for 60fps real-time progress & terminal streaming
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/downloader/events');
      eventSourceRef.current = es;

      es.addEventListener('initial-jobs', (e) => {
        try {
          const jobs: DownloadQueueItem[] = JSON.parse(e.data);
          onChange((prev) => ({
            ...prev,
            queue: jobs,
          }));
        } catch {}
      });

      es.addEventListener('job-update', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const updatedJob: DownloadQueueItem = payload.job;
          const logLine: string | undefined = payload.logLine;

          // Automatic browser download trigger as soon as job reaches 'completed'
          if (
            updatedJob.status === 'completed' &&
            updatedJob.downloadUrl &&
            !autoTriggeredDownloads.current.has(updatedJob.id)
          ) {
            autoTriggeredDownloads.current.add(updatedJob.id);
            if (state.autoDownloadToPC) {
              triggerBrowserDownload(updatedJob.downloadUrl, updatedJob.filename);
            }
          }

          onChange((prev) => {
            const existingIdx = prev.queue.findIndex((j) => j.id === updatedJob.id);
            let newQueue = [...prev.queue];
            if (existingIdx !== -1) {
              newQueue[existingIdx] = updatedJob;
            } else {
              newQueue.unshift(updatedJob);
            }

            let newLogs = prev.rawTerminalLogs;
            if (logLine) {
              newLogs = [...prev.rawTerminalLogs, logLine].slice(-400);
            }

            return {
              ...prev,
              queue: newQueue,
              rawTerminalLogs: newLogs,
            };
          });
        } catch {}
      });

      es.onerror = () => {
        // Silent fallback: SSE error, will auto-reconnect
      };
    } catch {
      // Fallback
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [onChange]);

  // Initial engine check and downloaded files list
  useEffect(() => {
    fetch('/api/downloader/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          onChange((prev) => ({
            ...prev,
            ytdlpVersion: data.ytdlp || prev.ytdlpVersion,
            ffmpegVersion: data.ffmpeg || prev.ffmpegVersion,
          }));
        }
      })
      .catch(() => {});

    loadCompletedFiles();
  }, []);

  // Auto-scroll terminal log when new lines arrive
  useEffect(() => {
    if (state.showLogs && terminalEndRef.current) {
      terminalEndRef.current.scrollTop = terminalEndRef.current.scrollHeight;
    }
  }, [state.rawTerminalLogs, state.showLogs]);

  const loadCompletedFiles = async () => {
    try {
      const res = await fetch('/api/downloader/files');
      if (res.ok) {
        const data = await res.json();
        if (data.files) {
          setCompletedFolderFiles(data.files);
        }
      }
    } catch {}
  };

  const handleDeleteFile = async (filename: string) => {
    try {
      const res = await fetch(`/api/downloader/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.ok) {
        setCompletedFolderFiles((prev) => prev.filter((f) => f.name !== filename));
        showToast({
          type: 'info',
          title: 'File Deleted',
          message: `Removed "${filename}" from server storage.`,
          duration: 3000,
        });
      }
    } catch {}
  };

  const handlePurgeAllFiles = async () => {
    try {
      const res = await fetch('/api/downloader/purge', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCompletedFolderFiles([]);
        showToast({
          type: 'success',
          title: 'Downloads Purged',
          message: `Cleaned up ${data.count || 0} files from server storage.`,
          duration: 4000,
        });
      }
    } catch {}
  };

  // Helper to assemble cookie command flag preview
  const getAssembledCookieFlag = () => {
    if (!state.enableCookieAuth) {
      return '';
    }

    if (state.cookieMode === 'browser') {
      const browser = state.selectedBrowser;
      const profile = (state.browserProfile || '').trim();
      const container = (state.firefoxContainer || '').trim();

      if (browser === 'firefox') {
        if (container) {
          const prof = profile || 'default-release';
          return `--cookies-from-browser firefox:${prof}::${container}`;
        }
        if (profile) {
          return `--cookies-from-browser firefox:${profile}`;
        }
        return `--cookies-from-browser firefox`;
      }

      if (profile) {
        return `--cookies-from-browser ${browser}:"${profile}"`;
      }
      return `--cookies-from-browser ${browser}`;
    }

    if (state.cookieMode === 'file') {
      if (state.cookieFileName) {
        return `--cookies [Uploaded: ${state.cookieFileName}]`;
      }
      if (state.cookieFilePath) {
        return `--cookies "${state.cookieFilePath}"`;
      }
      return `--cookies cookies.txt`;
    }

    return '';
  };

  // Check for yt-dlp Updates
  const handleCheckUpdate = async () => {
    onChange((prev) => ({ ...prev, isCheckingUpdate: true, updateStatus: null }));
    try {
      const res = await fetch('/api/downloader/update', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onChange((prev) => ({
          ...prev,
          isCheckingUpdate: false,
          ytdlpVersion: data.currentVersion || prev.ytdlpVersion,
          updateStatus: data.output || 'yt-dlp is up to date.',
        }));
        showToast({
          type: 'success',
          title: 'yt-dlp Update Check Complete',
          message: data.output || `Current version: ${data.currentVersion}`,
          duration: 5000,
        });
      } else {
        onChange((prev) => ({
          ...prev,
          isCheckingUpdate: false,
          updateStatus: data.error || 'Update failed',
        }));
      }
    } catch (err: any) {
      onChange((prev) => ({
        ...prev,
        isCheckingUpdate: false,
        updateStatus: err.message,
      }));
    }
  };

  // Parse list of URLs
  const getParsedUrls = (): string[] => {
    return state.urlsInput
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://') || u.includes('.')));
  };

  // Fetch / Inspect Video Metadata (yt-dlp -J)
  const handleInspect = async () => {
    const urls = getParsedUrls();
    if (urls.length === 0) {
      showToast({
        type: 'warning',
        title: 'URL Required',
        message: 'Please paste a valid video or media link first.',
        duration: 4000,
      });
      return;
    }

    const targetUrl = urls[0];
    onChange((prev) => ({
      ...prev,
      isInspecting: true,
      inspectError: null,
    }));

    try {
      const res = await fetch('/api/downloader/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          auth: {
            enabled: !!state.enableCookieAuth,
            cookieMode: state.cookieMode,
            selectedBrowser: state.selectedBrowser,
            browserProfile: state.browserProfile,
            firefoxContainer: state.firefoxContainer,
            cookieFilePath: state.cookieFilePath,
            cookieFileContent: state.cookieFileContent,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to inspect media URL');
      }

      onChange((prev) => ({
        ...prev,
        isInspecting: false,
        inspectedMetadata: data.info,
      }));

      showToast({
        type: 'success',
        title: 'Metadata Fetched',
        message: `Found "${data.info.title}" (${data.info.durationString || 'Live'})`,
        duration: 4500,
      });
    } catch (err: any) {
      onChange((prev) => ({
        ...prev,
        isInspecting: false,
        inspectError: err.message,
      }));

      showToast({
        type: 'error',
        title: 'Inspection Failed',
        message: err.message,
        duration: 10000,
      });
    }
  };

  // Start Download Job
  const handleStartDownload = async () => {
    const urls = getParsedUrls();
    if (urls.length === 0) {
      showToast({
        type: 'warning',
        title: 'No URL Provided',
        message: 'Please provide at least one URL to download.',
        duration: 4000,
      });
      return;
    }

    showToast({
      type: 'info',
      title: 'Download Queued',
      message: `Starting download process for ${urls.length} item(s)...`,
      duration: 3500,
    });

    for (const url of urls) {
      const jobId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const payload = {
        jobId,
        url,
        title: state.inspectedMetadata?.webpageUrl === url ? state.inspectedMetadata.title : undefined,
        thumbnail: state.inspectedMetadata?.webpageUrl === url ? state.inspectedMetadata.thumbnail : undefined,
        quality: state.selectedQuality,
        format: state.outputFormat,
        outputDirectory: state.outputDirectory,
        namingScheme: state.namingScheme === 'custom' ? customNamingInput : state.namingScheme,
        embedSubtitles: state.embedSubtitles,
        embedThumbnail: state.embedThumbnail,
        embedMetadata: state.embedMetadata,
        auth: {
          enabled: !!state.enableCookieAuth,
          cookieMode: state.cookieMode,
          selectedBrowser: state.selectedBrowser,
          browserProfile: state.browserProfile,
          firefoxContainer: state.firefoxContainer,
          cookieFilePath: state.cookieFilePath,
          cookieFileContent: state.cookieFileContent,
        },
      };

      try {
        const res = await fetch('/api/downloader/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success && data.job) {
          onChange((prev) => ({
            ...prev,
            activeDownloadId: data.job.id,
            queue: [data.job, ...prev.queue.filter((q) => q.id !== data.job.id)],
          }));

          onRecordCost(
            'video-downloader',
            `yt-dlp Download (${state.selectedQuality})`,
            state.inspectedMetadata?.duration || 30,
            0,
            0,
            url
          );
        } else {
          showToast({
            type: 'error',
            title: 'Failed to Start Download',
            message: data.error || 'Server rejected job',
            duration: 8000,
          });
        }
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Connection Error',
          message: err.message,
          duration: 8000,
        });
      }
    }
  };

  // Cancel Download Job
  const handleCancelJob = async (id: string) => {
    try {
      await fetch(`/api/downloader/cancel/${id}`, { method: 'POST' });
      showToast({
        type: 'info',
        title: 'Download Cancelled',
        message: 'The download process has been terminated.',
        duration: 3000,
      });
      onChange((prev) => ({
        ...prev,
        queue: prev.queue.map((q) => (q.id === id ? { ...q, status: 'cancelled', currentStage: 'Cancelled by user' } : q)),
      }));
    } catch {}
  };

  // Cookie File Upload
  const handleCookieFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('cookieFile', file);

    try {
      const res = await fetch('/api/downloader/cookies/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        onChange((prev) => ({
          ...prev,
          cookieFilePath: data.filePath,
          cookieFileName: file.name,
        }));
        showToast({
          type: 'success',
          title: 'Cookie File Loaded',
          message: `Saved ${file.name} for authentication.`,
          duration: 4000,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Cookie Upload Failed',
        message: err.message,
        duration: 6000,
      });
    }
  };

  // Format preset selector handler
  const handlePresetSelect = (preset: 'best' | '1080p' | '720p' | 'audio-mp3' | 'custom') => {
    let quality: VideoDownloaderQuality = 'best';
    let format: 'mp4' | 'mkv' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'flac' = 'mp4';

    if (preset === '1080p') {
      quality = '1080p';
      format = 'mp4';
    } else if (preset === '720p') {
      quality = '720p';
      format = 'mp4';
    } else if (preset === 'audio-mp3') {
      quality = 'audio-mp3';
      format = 'mp3';
    } else if (preset === 'custom') {
      quality = state.selectedQuality;
      format = state.outputFormat;
    }

    onChange((prev) => ({
      ...prev,
      preset,
      selectedQuality: quality,
      outputFormat: format,
    }));
  };

  const parsedUrls = getParsedUrls();
  const activeJob = state.queue.find((q) => q.status === 'downloading' || q.status === 'merging' || q.status === 'inspecting');

  return (
    <div id="video-downloader-module" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Bar: Module Title + Version / Status Badges + Engine Update */}
      <div
        className={`p-4 rounded border flex flex-wrap items-center justify-between gap-4 ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded ${isDarkMode ? 'bg-[#242424] text-[#f3e79a]' : 'bg-[#f7f5e6] text-[#bda832]'}`}>
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-[#1a1a1a]'}`}>
                Video Downloader
              </h3>
              <span
                className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border ${
                  isDarkMode
                    ? 'bg-[#1e1e1e] border-[#383838] text-[#a0a0a0]'
                    : 'bg-[#f2f2f2] border-[#d8d8d8] text-[#666666]'
                }`}
              >
                yt-dlp v{state.ytdlpVersion || '2026.08.19'}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border ${
                  isDarkMode
                    ? 'bg-[#1a251b] border-[#2d4e30] text-[#78d684]'
                    : 'bg-[#eaf5eb] border-[#c0e3c3] text-[#2a7a35]'
                }`}
              >
                Engine Ready
              </span>
            </div>
            <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              High-performance stream ripper with browser cookie authentication, multi-format presets, and real-time monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Simple vs Advanced Mode Toggle */}
          <div
            className={`p-1 rounded border flex items-center space-x-1 text-xs ${
              isDarkMode ? 'bg-[#1e1e1e] border-[#383838]' : 'bg-[#f0f0f0] border-[#d8d8d8]'
            }`}
          >
            <button
              type="button"
              id="mode-simple-btn"
              onClick={() => onChange((prev) => ({ ...prev, uiMode: 'simple' }))}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                (state.uiMode ?? 'simple') === 'simple'
                  ? isDarkMode
                    ? 'bg-[#f3e79a] text-black shadow-xs'
                    : 'bg-white text-[#111111] shadow-xs border border-[#d0d0d0]'
                  : isDarkMode
                  ? 'text-[#888888] hover:text-white'
                  : 'text-[#666666] hover:text-black'
              }`}
            >
              Default / Simple
            </button>
            <button
              type="button"
              id="mode-advanced-btn"
              onClick={() => onChange((prev) => ({ ...prev, uiMode: 'advanced' }))}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                state.uiMode === 'advanced'
                  ? isDarkMode
                    ? 'bg-[#f3e79a] text-black shadow-xs'
                    : 'bg-white text-[#111111] shadow-xs border border-[#d0d0d0]'
                  : isDarkMode
                  ? 'text-[#888888] hover:text-white'
                  : 'text-[#666666] hover:text-black'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>Advanced</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={state.isCheckingUpdate}
            title="Check for yt-dlp engine updates (executes yt-dlp -U)"
            className={`px-3 py-1.5 rounded text-xs font-medium border flex items-center space-x-1.5 transition-colors ${
              state.isCheckingUpdate
                ? 'opacity-60 cursor-not-allowed'
                : isDarkMode
                ? 'bg-[#222222] border-[#383838] text-[#cccccc] hover:text-white hover:bg-[#2c2c2c]'
                : 'bg-[#f8f8f8] border-[#d0d0d0] text-[#444444] hover:bg-[#eeeeee]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state.isCheckingUpdate ? 'animate-spin text-[#f3e79a]' : ''}`} />
            <span>{state.isCheckingUpdate ? 'Checking...' : 'Check yt-dlp'}</span>
          </button>
        </div>
      </div>

      {/* Main Mode Rendering: Simple Mode vs Advanced Mode */}
      {(state.uiMode ?? 'simple') === 'simple' ? (
        <div className="max-w-4xl mx-auto space-y-6">
          <div
            className={`p-6 rounded-lg border space-y-5 shadow-sm ${
              isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-inherit pb-3">
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                  Media Target & URLs
                </span>
                {parsedUrls.length > 1 && (
                  <span className={`px-2 py-0.5 text-[10px] font-mono rounded ${isDarkMode ? 'bg-[#2c2c2c] text-[#f3e79a]' : 'bg-[#eaeaea] text-[#75681c]'}`}>
                    {parsedUrls.length} links in batch
                  </span>
                )}
              </div>
              <span className={`text-[11px] ${isDarkMode ? 'text-[#666666]' : 'text-[#999999]'}`}>
                Supports YouTube, Vimeo, Instagram, X/Twitter, TikTok, Facebook & 1000+ sites
              </span>
            </div>

            {/* URL Input Bar */}
            <div className="space-y-2">
              <label className={`block text-xs font-medium ${isDarkMode ? 'text-[#aaaaaa]' : 'text-[#555555]'}`}>
                Video / Playlist URL(s) (Single URL or line-by-line for batch downloading)
              </label>
              <textarea
                rows={4}
                value={state.urlsInput}
                onChange={(e) => onChange((prev) => ({ ...prev, urlsInput: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=...&#10;https://www.instagram.com/p/...&#10;https://vimeo.com/..."
                className={`w-full p-3.5 text-xs font-mono rounded border outline-none transition-colors ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#2c2c2c] text-[#e0e0e0] placeholder-[#555555] focus:border-[#f3e79a]'
                    : 'bg-[#fafafa] border-[#d8d8d8] text-[#1a1a1a] placeholder-[#999999] focus:border-[#c5b53e]'
                }`}
              />
            </div>

            {/* Simple Direct Download Button using Default Settings */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                id="simple-mode-download-btn"
                onClick={handleStartDownload}
                disabled={parsedUrls.length === 0}
                className={`w-full py-3.5 rounded text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow ${
                  parsedUrls.length === 0
                    ? 'opacity-50 cursor-not-allowed bg-[#333333] text-[#777777]'
                    : isDarkMode
                    ? 'bg-[#f3e79a] text-black hover:bg-[#faee9f] active:scale-[0.99]'
                    : 'bg-[#bfa82a] text-white hover:bg-[#a89324] active:scale-[0.99]'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {parsedUrls.length > 1
                    ? `Download Batch (${parsedUrls.length} Videos)`
                    : 'Download Video'}
                </span>
              </button>

              {/* Seamless Download & Auto-cleanup status badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 px-1 text-[11px]">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={state.autoDownloadToPC}
                    onChange={(e) => onChange((prev) => ({ ...prev, autoDownloadToPC: e.target.checked }))}
                    className="rounded accent-[#f3e79a]"
                  />
                  <span className={isDarkMode ? 'text-[#aaaaaa]' : 'text-[#555555]'}>
                    Auto-save directly to PC when ready (no extra click)
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={state.autoCleanServerOnClose}
                    onChange={(e) => onChange((prev) => ({ ...prev, autoCleanServerOnClose: e.target.checked }))}
                    className="rounded accent-[#f3e79a]"
                  />
                  <span className={isDarkMode ? 'text-[#aaaaaa]' : 'text-[#555555]'}>
                    Auto-delete server copies on tab close
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : (
      /* Main Grid: Left Input & Cards, Right Inspection & Quick Toggles */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Cards 1, 2, 3) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Card 1: URL Input & Quick Presets */}
          <div
            className={`p-5 rounded border space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-inherit pb-2">
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                  Media Target & URLs
                </span>
                {parsedUrls.length > 1 && (
                  <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded ${isDarkMode ? 'bg-[#2c2c2c] text-[#f3e79a]' : 'bg-[#eaeaea] text-[#75681c]'}`}>
                    {parsedUrls.length} links in batch
                  </span>
                )}
              </div>
              <span className={`text-[11px] ${isDarkMode ? 'text-[#666666]' : 'text-[#999999]'}`}>
                Supports YouTube, Vimeo, Instagram, X/Twitter, TikTok, Facebook & 1000+ sites
              </span>
            </div>

            {/* URL Input Bar */}
            <div className="space-y-1.5">
              <label className={`block text-xs font-medium ${isDarkMode ? 'text-[#aaaaaa]' : 'text-[#555555]'}`}>
                Video / Playlist URL(s) (Single URL or line-by-line for batch downloading)
              </label>
              <textarea
                rows={3}
                value={state.urlsInput}
                onChange={(e) => onChange((prev) => ({ ...prev, urlsInput: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=...&#10;https://www.instagram.com/p/...&#10;https://vimeo.com/..."
                className={`w-full p-3 text-xs font-mono rounded border outline-none transition-colors ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#2c2c2c] text-[#e0e0e0] placeholder-[#555555] focus:border-[#f3e79a]'
                    : 'bg-[#fafafa] border-[#d8d8d8] text-[#1a1a1a] placeholder-[#999999] focus:border-[#c5b53e]'
                }`}
              />
            </div>

            {/* Action Buttons: Inspect & Quick Format Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleInspect}
                disabled={state.isInspecting || parsedUrls.length === 0}
                className={`px-4 py-2 rounded text-xs font-semibold flex items-center space-x-2 transition-all ${
                  state.isInspecting || parsedUrls.length === 0
                    ? 'opacity-50 cursor-not-allowed bg-[#333333] text-[#777777]'
                    : isDarkMode
                    ? 'bg-[#282828] text-white border border-[#3e3e3e] hover:bg-[#323232] hover:border-[#f3e79a]'
                    : 'bg-[#f0f0f0] text-[#222222] border border-[#d0d0d0] hover:bg-[#e4e4e4]'
                }`}
              >
                <Search className={`w-3.5 h-3.5 ${state.isInspecting ? 'animate-spin text-[#f3e79a]' : ''}`} />
                <span>{state.isInspecting ? 'Inspecting Media (yt-dlp -J)...' : 'Inspect / Fetch Info'}</span>
              </button>

              {/* Quick Format Presets */}
              <div className="flex items-center space-x-1 bg-inherit">
                <span className={`text-[11px] mr-1 ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>Preset:</span>
                {[
                  { id: 'best', label: 'Best Quality' },
                  { id: '1080p', label: '1080p' },
                  { id: '720p', label: '720p' },
                  { id: 'audio-mp3', label: 'MP3' },
                  { id: 'custom', label: 'Custom' },
                ].map((p) => {
                  const isActive = state.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetSelect(p.id as any)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        isActive
                          ? isDarkMode
                            ? 'bg-[#f3e79a] border-[#f3e79a] text-black font-semibold shadow-sm'
                            : 'bg-[#e4d673] border-[#c0b040] text-black font-semibold'
                          : isDarkMode
                          ? 'bg-[#1e1e1e] border-[#303030] text-[#aaaaaa] hover:text-white hover:bg-[#252525]'
                          : 'bg-[#f6f6f6] border-[#d8d8d8] text-[#555555] hover:bg-[#eaeaea]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Card 2: Authentication & Cookies Collapsible Accordion (CRUCIAL) */}
          <div
            className={`rounded border transition-all ${
              isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
            }`}
          >
            {/* Accordion Header */}
            <div
              className={`p-4 flex items-center justify-between cursor-pointer select-none rounded-t ${
                isDarkMode ? 'hover:bg-[#1e1e1e]' : 'hover:bg-[#f9f9f9]'
              }`}
            >
              <div
                className="flex items-center space-x-2.5 flex-1"
                onClick={() => onChange((prev) => ({ ...prev, authExpanded: !prev.authExpanded }))}
              >
                <Shield className={`w-4 h-4 ${state.enableCookieAuth ? (isDarkMode ? 'text-[#f3e79a]' : 'text-[#bda832]') : 'text-[#777777]'}`} />
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#e5e5e5]' : 'text-[#222222]'}`}>
                      Authentication & Cookies (Login Walls & Private Media)
                    </h4>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded border font-semibold ${
                        !state.enableCookieAuth
                          ? isDarkMode
                            ? 'bg-[#202020] border-[#333333] text-[#777777]'
                            : 'bg-[#f0f0f0] border-[#d5d5d5] text-[#777777]'
                          : state.cookieMode === 'browser'
                          ? isDarkMode
                            ? 'bg-[#222222] border-[#383838] text-[#f3e79a]'
                            : 'bg-[#fcf9e8] border-[#ded48a] text-[#7a6f23]'
                          : state.cookieFileName
                          ? isDarkMode
                            ? 'bg-[#1c2c1c] border-[#2a4d2a] text-[#7ad97a]'
                            : 'bg-[#eef8ee] border-[#bfe2bf] text-[#2c772c]'
                          : isDarkMode
                          ? 'bg-[#202020] border-[#333333] text-[#888888]'
                          : 'bg-[#f0f0f0] border-[#d5d5d5] text-[#666666]'
                      }`}
                    >
                      {!state.enableCookieAuth
                        ? 'Disabled (Default / Public)'
                        : state.cookieMode === 'browser'
                        ? `Browser: ${state.selectedBrowser}${state.selectedBrowser === 'firefox' && state.firefoxContainer ? ` [Container: ${state.firefoxContainer}]` : ''}`
                        : state.cookieFileName
                        ? `File: ${state.cookieFileName}`
                        : 'Manual cookies.txt'}
                    </span>
                  </div>
                  <p className={`text-[11px] ${isDarkMode ? 'text-[#777777]' : 'text-[#777777]'}`}>
                    Only required for login-gated posts or private playlists. Disabled by default for standard public links.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {/* Direct quick toggle switch */}
                <label
                  className="flex items-center space-x-1.5 text-xs font-medium cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    id="enable-cookie-auth-toggle"
                    checked={!!state.enableCookieAuth}
                    onChange={(e) => onChange((prev) => ({ ...prev, enableCookieAuth: e.target.checked }))}
                    className="rounded accent-[#f3e79a] w-3.5 h-3.5"
                  />
                  <span className={`text-[11px] font-semibold ${state.enableCookieAuth ? (isDarkMode ? 'text-[#f3e79a]' : 'text-[#8b791e]') : 'text-[#777777]'}`}>
                    {state.enableCookieAuth ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
                <div
                  className="p-1 text-[#888888]"
                  onClick={() => onChange((prev) => ({ ...prev, authExpanded: !prev.authExpanded }))}
                >
                  {state.authExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {/* Accordion Body */}
            {state.authExpanded && (
              <div className={`p-4 border-t space-y-4 ${isDarkMode ? 'border-[#262626] bg-[#141414]' : 'border-[#e8e8e8] bg-[#fbfbfb]'}`}>
                {/* Explicit Enable/Disable Notice Banner */}
                <div
                  className={`p-3 rounded border text-xs flex items-center justify-between ${
                    state.enableCookieAuth
                      ? isDarkMode
                        ? 'bg-[#22221b] border-[#554d24] text-[#f3e79a]'
                        : 'bg-[#fcfaf0] border-[#d8ce7b] text-[#7a6a16]'
                      : isDarkMode
                      ? 'bg-[#181818] border-[#2c2c2c] text-[#888888]'
                      : 'bg-[#f5f5f5] border-[#e0e0e0] text-[#666666]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="font-semibold">
                        {state.enableCookieAuth
                          ? 'Cookie Authentication is Active'
                          : 'Cookie Authentication is Inactive (Recommended for Public Links)'}
                      </span>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        {state.enableCookieAuth
                          ? 'yt-dlp will read credentials to access private videos or bypass bot verification.'
                          : 'Public videos will be downloaded directly without touching local browser databases or cookie files.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange((prev) => ({ ...prev, enableCookieAuth: !prev.enableCookieAuth }))}
                    className={`px-3 py-1 text-xs rounded font-semibold border transition-colors shrink-0 ml-3 ${
                      state.enableCookieAuth
                        ? isDarkMode
                          ? 'bg-[#2c2c2c] border-[#444444] text-white hover:bg-[#383838]'
                          : 'bg-white border-[#d0d0d0] text-black hover:bg-[#f0f0f0]'
                        : isDarkMode
                        ? 'bg-[#f3e79a] border-[#f3e79a] text-black hover:bg-[#faee9f]'
                        : 'bg-[#bfa82a] border-[#bfa82a] text-white hover:bg-[#a89324]'
                    }`}
                  >
                    {state.enableCookieAuth ? 'Turn Off Cookies' : 'Enable Cookies'}
                  </button>
                </div>

                {/* Extraction Mode Switcher (Radio) */}
                <div className={`space-y-1.5 transition-opacity ${!state.enableCookieAuth ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                    Cookie Extraction Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`flex items-start space-x-3 p-3 rounded border cursor-pointer transition-colors ${
                        state.cookieMode === 'browser'
                          ? isDarkMode
                            ? 'bg-[#202020] border-[#f3e79a] text-white'
                            : 'bg-[#fbf9ed] border-[#c0b040] text-black'
                          : isDarkMode
                          ? 'bg-[#181818] border-[#2c2c2c] text-[#999999] hover:border-[#404040]'
                          : 'bg-white border-[#e0e0e0] text-[#666666] hover:border-[#cccccc]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cookieMode"
                        checked={state.cookieMode === 'browser'}
                        onChange={() => onChange((prev) => ({ ...prev, cookieMode: 'browser' }))}
                        className="mt-0.5 accent-[#f3e79a]"
                      />
                      <div>
                        <div className="text-xs font-semibold">Direct Browser Extraction</div>
                        <div className="text-[11px] opacity-75">
                          Reads session cookies directly from your installed desktop browser (Chrome, Firefox, Brave, Edge, etc.)
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-start space-x-3 p-3 rounded border cursor-pointer transition-colors ${
                        state.cookieMode === 'file'
                          ? isDarkMode
                            ? 'bg-[#202020] border-[#f3e79a] text-white'
                            : 'bg-[#fbf9ed] border-[#c0b040] text-black'
                          : isDarkMode
                          ? 'bg-[#181818] border-[#2c2c2c] text-[#999999] hover:border-[#404040]'
                          : 'bg-white border-[#e0e0e0] text-[#666666] hover:border-[#cccccc]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cookieMode"
                        checked={state.cookieMode === 'file'}
                        onChange={() => onChange((prev) => ({ ...prev, cookieMode: 'file' }))}
                        className="mt-0.5 accent-[#f3e79a]"
                      />
                      <div>
                        <div className="text-xs font-semibold">Manual cookies.txt File Upload</div>
                        <div className="text-[11px] opacity-75">
                          Upload a Netscape formatted cookies.txt exported via browser extensions (ideal if browser database is locked)
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Direct Browser Extraction Settings */}
                {state.cookieMode === 'browser' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Browser Dropdown */}
                    <div className="space-y-1.5">
                      <label className={`block text-xs font-medium ${isDarkMode ? 'text-[#cccccc]' : 'text-[#444444]'}`}>
                        Browser Source
                      </label>
                      <select
                        value={state.selectedBrowser}
                        onChange={(e) => onChange((prev) => ({ ...prev, selectedBrowser: e.target.value as SupportedBrowser }))}
                        className={`w-full p-2.5 text-xs rounded border outline-none ${
                          isDarkMode
                            ? 'bg-[#181818] border-[#303030] text-[#e0e0e0] focus:border-[#f3e79a]'
                            : 'bg-white border-[#d0d0d0] text-[#1a1a1a] focus:border-[#c0b040]'
                        }`}
                      >
                        {BROWSER_OPTIONS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Profile Directory Name */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className={`block text-xs font-medium ${isDarkMode ? 'text-[#cccccc]' : 'text-[#444444]'}`}>
                          Profile Directory Name
                        </label>
                        <span className={`text-[10px] ${isDarkMode ? 'text-[#666666]' : 'text-[#999999]'}`}>
                          Leave blank for default
                        </span>
                      </div>
                      <input
                        type="text"
                        value={state.browserProfile}
                        onChange={(e) => onChange((prev) => ({ ...prev, browserProfile: e.target.value }))}
                        placeholder={state.selectedBrowser === 'firefox' ? 'default-release' : 'Default or Profile 1'}
                        className={`w-full p-2.5 text-xs font-mono rounded border outline-none ${
                          isDarkMode
                            ? 'bg-[#181818] border-[#303030] text-[#e0e0e0] placeholder-[#555555] focus:border-[#f3e79a]'
                            : 'bg-white border-[#d0d0d0] text-[#1a1a1a] placeholder-[#999999] focus:border-[#c0b040]'
                        }`}
                      />
                    </div>

                    {/* Firefox Multi-Account Container Input (CONDITIONAL - ONLY visible when Firefox is selected) */}
                    {state.selectedBrowser === 'firefox' && (
                      <div className="md:col-span-2 space-y-1.5 p-3 rounded border border-dashed border-[#bda832]/40 bg-[#f3e79a]/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#f3e79a]" />
                            <label className={`text-xs font-semibold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#87781b]'}`}>
                              Firefox Multi-Account Container Name or ID (Optional)
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowFirefoxHelp((v) => !v)}
                            className="text-[11px] flex items-center space-x-1 text-[#bda832] hover:underline"
                          >
                            <Info className="w-3 h-3" />
                            <span>How do I find my Container Name/ID?</span>
                          </button>
                        </div>

                        <input
                          type="text"
                          value={state.firefoxContainer}
                          onChange={(e) => onChange((prev) => ({ ...prev, firefoxContainer: e.target.value }))}
                          placeholder="e.g. Meta, Google, Personal, or 2"
                          className={`w-full p-2.5 text-xs font-mono rounded border outline-none ${
                            isDarkMode
                              ? 'bg-[#181818] border-[#383838] text-[#e0e0e0] placeholder-[#666666] focus:border-[#f3e79a]'
                              : 'bg-white border-[#d0d0d0] text-[#1a1a1a] placeholder-[#999999] focus:border-[#c0b040]'
                          }`}
                        />

                        {/* Inline Info Popover / Tooltip */}
                        {showFirefoxHelp && (
                          <div
                            className={`p-3 text-[11px] rounded border space-y-1.5 ${
                              isDarkMode
                                ? 'bg-[#1f1f1f] border-[#383838] text-[#cccccc]'
                                : 'bg-[#f7f7f7] border-[#d8d8d8] text-[#333333]'
                            }`}
                          >
                            <div className="font-semibold text-xs flex items-center space-x-1 text-[#f3e79a]">
                              <Info className="w-3.5 h-3.5" />
                              <span>Finding your Firefox Container:</span>
                            </div>
                            <ul className="list-disc pl-4 space-y-1 text-[11px]">
                              <li>
                                <strong>Container Name:</strong> Enter the exact label shown in Firefox tabs or the Container extension (e.g. <code className="font-mono bg-[#333] px-1 rounded">Meta</code>, <code className="font-mono bg-[#333] px-1 rounded">Banking</code>, <code className="font-mono bg-[#333] px-1 rounded">Personal</code>).
                              </li>
                              <li>
                                <strong>Container ID:</strong> Open your Firefox profile folder, locate <code className="font-mono bg-[#333] px-1 rounded">containers.json</code>, and find the corresponding <code className="font-mono bg-[#333] px-1 rounded">userContextId</code> (e.g. <code className="font-mono bg-[#333] px-1 rounded">1</code> or <code className="font-mono bg-[#333] px-1 rounded">2</code>).
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual cookies.txt Upload Mode */}
                {state.cookieMode === 'file' && (
                  <div className="space-y-3 pt-1">
                    <div
                      className={`p-4 rounded border-2 border-dashed flex flex-col items-center justify-center text-center space-y-2 cursor-pointer transition-colors ${
                        isDarkMode
                          ? 'border-[#333333] hover:border-[#f3e79a] bg-[#1a1a1a]'
                          : 'border-[#cccccc] hover:border-[#bda832] bg-[#f9f9f9]'
                      }`}
                      onClick={() => document.getElementById('cookie-file-input')?.click()}
                    >
                      <Upload className="w-6 h-6 text-[#888888]" />
                      <div>
                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-[#222222]'}`}>
                          {state.cookieFileName ? `Loaded: ${state.cookieFileName}` : 'Click or drag & drop a cookies.txt file here'}
                        </span>
                        <p className={`text-[11px] ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
                          Supports standard Netscape format exported from extensions like &quot;Get cookies.txt LOCALLY&quot;
                        </p>
                      </div>
                      <input
                        id="cookie-file-input"
                        type="file"
                        accept=".txt"
                        className="hidden"
                        onChange={handleCookieFileUpload}
                      />
                    </div>

                    {/* Or paste cookie text */}
                    <div className="space-y-1">
                      <label className={`block text-[11px] ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                        Or paste raw Netscape cookies.txt content:
                      </label>
                      <textarea
                        rows={2}
                        value={state.cookieFileContent}
                        onChange={(e) => onChange((prev) => ({ ...prev, cookieFileContent: e.target.value }))}
                        placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1789374926&#9;LOGIN_INFO&#9;..."
                        className={`w-full p-2 text-[11px] font-mono rounded border outline-none ${
                          isDarkMode
                            ? 'bg-[#181818] border-[#303030] text-[#e0e0e0] placeholder-[#555555]'
                            : 'bg-white border-[#d0d0d0] text-[#1a1a1a] placeholder-[#999999]'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Backend Command Assembly Preview */}
                <div
                  className={`p-2.5 rounded border flex items-center justify-between font-mono text-[11px] ${
                    isDarkMode ? 'bg-[#101010] border-[#222222] text-[#aaaaaa]' : 'bg-[#f4f4f4] border-[#e0e0e0] text-[#555555]'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-[#f3e79a] font-semibold select-none">$ yt-dlp</span>
                    <span className="truncate">{getAssembledCookieFlag() || '--no-cookies (standard public mode)'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getAssembledCookieFlag());
                      setIsCopiedCommand(true);
                      setTimeout(() => setIsCopiedCommand(false), 2000);
                    }}
                    title="Copy cookie flag syntax"
                    className="p-1 text-[#888888] hover:text-white"
                  >
                    {isCopiedCommand ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Main Card 3: Output & Encoding Options */}
          <div
            className={`p-5 rounded border space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
            }`}
          >
            <div className="border-b border-inherit pb-2 flex items-center justify-between">
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                Output Encoding & Filesystem Parameters
              </h4>
              <Sliders className="w-3.5 h-3.5 text-[#888888]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quality Preset / Selector */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-medium ${isDarkMode ? 'text-[#cccccc]' : 'text-[#444444]'}`}>
                  Target Quality
                </label>
                <select
                  value={state.selectedQuality}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      selectedQuality: e.target.value as VideoDownloaderQuality,
                      preset: 'custom',
                    }))
                  }
                  className={`w-full p-2.5 text-xs rounded border outline-none ${
                    isDarkMode
                      ? 'bg-[#121212] border-[#2c2c2c] text-[#e0e0e0] focus:border-[#f3e79a]'
                      : 'bg-[#fafafa] border-[#d8d8d8] text-[#1a1a1a] focus:border-[#c0b040]'
                  }`}
                >
                  <optgroup label="Video Stream (Video + Best Audio)">
                    <option value="best">Best Quality Available (Auto Highest)</option>
                    <option value="2160p">4K UHD (2160p)</option>
                    <option value="1440p">2K QHD (1440p)</option>
                    <option value="1080p">Full HD (1080p)</option>
                    <option value="720p">HD (720p)</option>
                    <option value="480p">Standard (480p)</option>
                    <option value="360p">Low Bandwidth (360p)</option>
                  </optgroup>
                  <optgroup label="Audio Only (FFmpeg Extraction)">
                    <option value="audio-mp3">MP3 (320kbps High Quality)</option>
                    <option value="audio-m4a">M4A (AAC Pristine Audio)</option>
                    <option value="audio-wav">WAV (Uncompressed Lossless)</option>
                    <option value="audio-flac">FLAC (Lossless Hi-Fi)</option>
                    <option value="audio-best">Best Audio Stream (Direct)</option>
                  </optgroup>
                </select>
              </div>

              {/* Video Container Format */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-medium ${isDarkMode ? 'text-[#cccccc]' : 'text-[#444444]'}`}>
                  Muxing Container
                </label>
                <select
                  value={state.outputFormat}
                  onChange={(e) => onChange((prev) => ({ ...prev, outputFormat: e.target.value as any }))}
                  className={`w-full p-2.5 text-xs rounded border outline-none ${
                    isDarkMode
                      ? 'bg-[#121212] border-[#2c2c2c] text-[#e0e0e0] focus:border-[#f3e79a]'
                      : 'bg-[#fafafa] border-[#d8d8d8] text-[#1a1a1a] focus:border-[#c0b040]'
                  }`}
                >
                  {state.selectedQuality.startsWith('audio-') ? (
                    <>
                      <option value="mp3">.mp3 (Universal Audio)</option>
                      <option value="m4a">.m4a (Apple / iTunes AAC)</option>
                      <option value="wav">.wav (PCM Studio Audio)</option>
                      <option value="flac">.flac (Free Lossless Audio)</option>
                    </>
                  ) : (
                    <>
                      <option value="mp4">.mp4 (MPEG-4 Standard - Max Compatibility)</option>
                      <option value="mkv">.mkv (Matroska - Multi-Track & Subs)</option>
                      <option value="webm">.webm (WebM Open Media)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Output Directory */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`block text-xs font-medium ${isDarkMode ? 'text-[#cccccc]' : 'text-[#444444]'}`}>
                    Output Directory Path
                  </label>
                  <span className={`text-[10px] font-mono ${isDarkMode ? 'text-[#666666]' : 'text-[#999999]'}`}>
                    ./downloads
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={state.outputDirectory}
                    onChange={(e) => onChange((prev) => ({ ...prev, outputDirectory: e.target.value }))}
                    placeholder="downloads"
                    className={`w-full p-2.5 pl-8 text-xs font-mono rounded border outline-none ${
                      isDarkMode
                        ? 'bg-[#121212] border-[#2c2c2c] text-[#e0e0e0] focus:border-[#f3e79a]'
                        : 'bg-[#fafafa] border-[#d8d8d8] text-[#1a1a1a] focus:border-[#c0b040]'
                    }`}
                  />
                  <Folder className="w-3.5 h-3.5 absolute left-2.5 top-3 text-[#777777]" />
                </div>
              </div>

              {/* Custom Naming Scheme */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-medium ${isDarkMode ? 'text-[#cccccc]' : 'text-[#444444]'}`}>
                  File Naming Template
                </label>
                <select
                  value={state.namingScheme}
                  onChange={(e) => onChange((prev) => ({ ...prev, namingScheme: e.target.value }))}
                  className={`w-full p-2.5 text-xs font-mono rounded border outline-none ${
                    isDarkMode
                      ? 'bg-[#121212] border-[#2c2c2c] text-[#e0e0e0] focus:border-[#f3e79a]'
                      : 'bg-[#fafafa] border-[#d8d8d8] text-[#1a1a1a] focus:border-[#c0b040]'
                  }`}
                >
                  {NAMING_PRESETS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Naming Template Input if selected */}
            {state.namingScheme === 'custom' && (
              <div className="space-y-1">
                <label className={`block text-[11px] ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                  Custom Template String (yt-dlp syntax)
                </label>
                <input
                  type="text"
                  value={customNamingInput}
                  onChange={(e) => setCustomNamingInput(e.target.value)}
                  placeholder="%(uploader)s/%(upload_date)s - %(title)s.%(ext)s"
                  className={`w-full p-2 text-xs font-mono rounded border outline-none ${
                    isDarkMode
                      ? 'bg-[#121212] border-[#2c2c2c] text-[#e0e0e0]'
                      : 'bg-[#fafafa] border-[#d8d8d8] text-[#1a1a1a]'
                  }`}
                />
              </div>
            )}

            {/* Toggles: Embed Subtitles, Thumbnail, Metadata */}
            <div className="pt-2 border-t border-inherit flex flex-wrap items-center gap-6">
              <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={state.embedMetadata}
                  onChange={(e) => onChange((prev) => ({ ...prev, embedMetadata: e.target.checked }))}
                  className="rounded accent-[#f3e79a]"
                />
                <span className={isDarkMode ? 'text-[#cccccc]' : 'text-[#333333]'}>Embed Chapter Markers &amp; Metadata</span>
              </label>

              <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={state.embedThumbnail}
                  onChange={(e) => onChange((prev) => ({ ...prev, embedThumbnail: e.target.checked }))}
                  className="rounded accent-[#f3e79a]"
                />
                <span className={isDarkMode ? 'text-[#cccccc]' : 'text-[#333333]'}>Embed Thumbnail Artwork</span>
              </label>

              {!state.selectedQuality.startsWith('audio-') && (
                <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={state.embedSubtitles}
                    onChange={(e) => onChange((prev) => ({ ...prev, embedSubtitles: e.target.checked }))}
                    className="rounded accent-[#f3e79a]"
                  />
                  <span className={isDarkMode ? 'text-[#cccccc]' : 'text-[#333333]'}>Embed Subtitles (All languages)</span>
                </label>
              )}

              <label className="flex items-center space-x-2 text-xs cursor-pointer select-none pt-1 border-t border-inherit">
                <input
                  type="checkbox"
                  checked={state.autoDownloadToPC}
                  onChange={(e) => onChange((prev) => ({ ...prev, autoDownloadToPC: e.target.checked }))}
                  className="rounded accent-[#f3e79a]"
                />
                <span className={isDarkMode ? 'text-[#cccccc]' : 'text-[#333333]'}>Auto-save directly to PC browser downloads when ready</span>
              </label>

              <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={state.autoCleanServerOnClose}
                  onChange={(e) => onChange((prev) => ({ ...prev, autoCleanServerOnClose: e.target.checked }))}
                  className="rounded accent-[#f3e79a]"
                />
                <span className={isDarkMode ? 'text-[#cccccc]' : 'text-[#333333]'}>Auto-delete server file copies when tab/browser closes</span>
              </label>
            </div>

            {/* Start Download Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartDownload}
                disabled={parsedUrls.length === 0}
                className={`w-full py-3 rounded text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow ${
                  parsedUrls.length === 0
                    ? 'opacity-50 cursor-not-allowed bg-[#333333] text-[#777777]'
                    : isDarkMode
                    ? 'bg-[#f3e79a] text-black hover:bg-[#faee9f] active:scale-[0.99]'
                    : 'bg-[#bfa82a] text-white hover:bg-[#a89324] active:scale-[0.99]'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {parsedUrls.length > 1
                    ? `Download Batch (${parsedUrls.length} Videos) via yt-dlp`
                    : 'Start Video Download'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Video Inspection Preview & Metadata Card */}
        <div className="lg:col-span-5 space-y-6">
          {/* Inspected Video Details Card */}
          <div
            className={`p-5 rounded border space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-inherit pb-2">
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                Media Stream Inspection (Pre-Download Info)
              </h4>
              {state.inspectedMetadata && (
                <span className="text-[10px] text-green-400 flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>Inspected</span>
                </span>
              )}
            </div>

            {state.isInspecting && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-[#f3e79a]" />
                <div className={`text-xs ${isDarkMode ? 'text-[#cccccc]' : 'text-[#555555]'}`}>
                  Executing <code className="font-mono bg-[#222] px-1.5 py-0.5 rounded text-[#f3e79a]">yt-dlp -J</code> to analyze video streams...
                </div>
                <div className="text-[11px] text-[#777777]">
                  Extracting resolutions, audio encodings, container metadata, and file sizes
                </div>
              </div>
            )}

            {!state.isInspecting && state.inspectError && (
              <div
                className={`p-4 rounded border space-y-2 text-xs ${
                  isDarkMode ? 'bg-[#2a1a1a] border-[#552222] text-[#ff8888]' : 'bg-[#fff0f0] border-[#ffcccc] text-[#cc0000]'
                }`}
              >
                <div className="flex items-center space-x-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Stream Inspection Warning</span>
                </div>
                <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{state.inspectError}</p>
                <div className="text-[10px] opacity-80 pt-1">
                  Tip: If this is a login-walled or private link, expand &quot;Authentication &amp; Cookies&quot; and configure your browser profile or upload cookies.txt.
                </div>
              </div>
            )}

            {!state.isInspecting && !state.inspectError && state.inspectedMetadata && (
              <div className="space-y-4">
                {/* Thumbnail & Title */}
                <div className="space-y-2">
                  {state.inspectedMetadata.thumbnail ? (
                    <div className="relative rounded overflow-hidden aspect-video bg-black/40 border border-inherit">
                      <img
                        src={state.inspectedMetadata.thumbnail}
                        alt={state.inspectedMetadata.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px]">
                        {state.inspectedMetadata.durationString || 'Live'}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video rounded bg-[#101010] flex items-center justify-center text-[#555555]">
                      <Film className="w-8 h-8" />
                    </div>
                  )}

                  <div>
                    <h3 className={`text-sm font-semibold line-clamp-2 ${isDarkMode ? 'text-white' : 'text-[#111111]'}`}>
                      {state.inspectedMetadata.title}
                    </h3>
                    <div className={`text-xs flex items-center space-x-2 mt-0.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                      <span>{state.inspectedMetadata.uploader || state.inspectedMetadata.channel || 'Unknown Creator'}</span>
                      {state.inspectedMetadata.viewCount && (
                        <>
                          <span>•</span>
                          <span>{state.inspectedMetadata.viewCount.toLocaleString()} views</span>
                        </>
                      )}
                      {state.inspectedMetadata.estimatedSize && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[#f3e79a]">{state.inspectedMetadata.estimatedSize}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Available Video Resolutions */}
                <div className="space-y-1.5 pt-2 border-t border-inherit">
                  <span className={`block text-[11px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                    Detected Resolutions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {state.inspectedMetadata.availableResolutions.map((res) => (
                      <span
                        key={res}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          res.includes('4K') || res.includes('2K')
                            ? isDarkMode
                              ? 'bg-[#2b2414] border-[#6b581e] text-[#f3e79a]'
                              : 'bg-[#faf4d5] border-[#c0b040] text-[#7a6a12]'
                            : isDarkMode
                            ? 'bg-[#222222] border-[#383838] text-[#cccccc]'
                            : 'bg-[#f0f0f0] border-[#d0d0d0] text-[#444444]'
                        }`}
                      >
                        {res}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Available Streams Summary */}
                {state.inspectedMetadata.formatsSummary && (
                  <div className="space-y-2 pt-2 border-t border-inherit">
                    <span className={`block text-[11px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                      Stream Codecs &amp; Audio Tracks
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto text-[11px] font-mono pr-1">
                      {state.inspectedMetadata.formatsSummary.videoOptions.slice(0, 4).map((v, i) => (
                        <div
                          key={i}
                          className={`p-1.5 rounded flex items-center justify-between ${
                            isDarkMode ? 'bg-[#141414] text-[#aaaaaa]' : 'bg-[#f7f7f7] text-[#555555]'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 truncate">
                            <Film className="w-3 h-3 text-[#f3e79a] shrink-0" />
                            <span className="truncate">{v.note}</span>
                          </div>
                          <span className="shrink-0 text-[#888888]">{v.filesizeApprox || v.ext}</span>
                        </div>
                      ))}

                      {state.inspectedMetadata.formatsSummary.audioOptions.slice(0, 3).map((a, i) => (
                        <div
                          key={i}
                          className={`p-1.5 rounded flex items-center justify-between ${
                            isDarkMode ? 'bg-[#141414] text-[#aaaaaa]' : 'bg-[#f7f7f7] text-[#555555]'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 truncate">
                            <Music className="w-3 h-3 text-[#87d37c] shrink-0" />
                            <span className="truncate">Audio {a.note}</span>
                          </div>
                          <span className="shrink-0 text-[#888888]">{a.filesizeApprox || a.ext}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Copy Link */}
                <div className="pt-2 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(state.inspectedMetadata?.webpageUrl || '');
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className={`flex items-center space-x-1 text-[11px] ${isDarkMode ? 'text-[#aaaaaa] hover:text-white' : 'text-[#666666] hover:text-black'}`}
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl ? 'URL Copied' : 'Copy Clean Media URL'}</span>
                  </button>

                  <a
                    href={state.inspectedMetadata.webpageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-[11px] text-[#f3e79a] hover:underline"
                  >
                    <span>Open Webpage</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {!state.isInspecting && !state.inspectError && !state.inspectedMetadata && (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-2">
                <Search className="w-7 h-7 text-[#555555]" />
                <div className={`text-xs font-semibold ${isDarkMode ? 'text-[#aaaaaa]' : 'text-[#555555]'}`}>
                  No Video Inspected Yet
                </div>
                <p className={`text-[11px] max-w-xs ${isDarkMode ? 'text-[#666666]' : 'text-[#888888]'}`}>
                  Paste a link above and click &quot;Inspect / Fetch Info&quot; to preview available resolutions, file sizes, and audio tracks before downloading.
                </p>
              </div>
            )}
          </div>

          {/* Quick Engine Status Card */}
          <div
            className={`p-4 rounded border space-y-2 text-xs ${
              isDarkMode ? 'bg-[#181818] border-[#2c2c2c] text-[#aaaaaa]' : 'bg-white border-[#e0e0e0] text-[#666666]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Subsystem Engines</span>
              <span className="text-[10px] font-mono text-green-400">All Systems Operational</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className={`p-2 rounded ${isDarkMode ? 'bg-[#121212]' : 'bg-[#f8f8f8]'}`}>
                <div className="text-[#888888]">yt-dlp Core</div>
                <div className="font-mono text-white text-xs">{state.ytdlpVersion || '2026.08.19'}</div>
              </div>
              <div className={`p-2 rounded ${isDarkMode ? 'bg-[#121212]' : 'bg-[#f8f8f8]'}`}>
                <div className="text-[#888888]">FFmpeg / FFprobe</div>
                <div className="font-mono text-white text-xs">{state.ffmpegVersion || 'Available'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Bottom Queue / Progress Monitor Card */}
      <div
        className={`p-5 rounded border space-y-4 ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        {/* Tab Headers */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-inherit pb-3">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 transition-all ${
                activeTab === 'queue'
                  ? isDarkMode
                    ? 'border-[#f3e79a] text-white'
                    : 'border-[#c0b040] text-black'
                  : 'border-transparent text-[#777777] hover:text-white'
              }`}
            >
              Active Queue ({state.queue.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('folder');
                loadCompletedFiles();
              }}
              className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 transition-all ${
                activeTab === 'folder'
                  ? isDarkMode
                    ? 'border-[#f3e79a] text-white'
                    : 'border-[#c0b040] text-black'
                  : 'border-transparent text-[#777777] hover:text-white'
              }`}
            >
              Completed Downloads ({completedFolderFiles.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 transition-all flex items-center space-x-1 ${
                activeTab === 'logs'
                  ? isDarkMode
                    ? 'border-[#f3e79a] text-white'
                    : 'border-[#c0b040] text-black'
                  : 'border-transparent text-[#777777] hover:text-white'
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>Live Terminal ({state.rawTerminalLogs.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {activeJob && (
              <span className="flex items-center space-x-1.5 text-xs text-[#f3e79a] font-mono animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Downloading @ {activeJob.downloadSpeed || 'Calculating...'}</span>
              </span>
            )}
            {state.queue.length > 0 && (
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, queue: prev.queue.filter((q) => q.status === 'downloading') }))}
                className={`px-2.5 py-1 text-[11px] rounded border ${
                  isDarkMode
                    ? 'bg-[#222] border-[#333] text-[#999] hover:text-white'
                    : 'bg-[#f4f4f4] border-[#ddd] text-[#555] hover:text-black'
                }`}
              >
                Clear Inactive
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Active Queue */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {state.queue.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-2">
                <Download className="w-8 h-8 text-[#444444]" />
                <div className={`text-xs font-medium ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                  No Active Downloads
                </div>
                <p className={`text-[11px] ${isDarkMode ? 'text-[#555555]' : 'text-[#888888]'}`}>
                  Enter a URL above and click &quot;Start Video Download&quot; to queue downloads.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {state.queue.map((item) => {
                  const isRunning = item.status === 'downloading' || item.status === 'merging' || item.status === 'inspecting';
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded border space-y-3 transition-all ${
                        isDarkMode ? 'bg-[#141414] border-[#292929]' : 'bg-[#fafafa] border-[#e2e2e2]'
                      }`}
                    >
                      {/* Job Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3 truncate">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-12 h-8 rounded object-cover border border-inherit shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-8 rounded bg-[#222222] flex items-center justify-center shrink-0">
                              <Film className="w-4 h-4 text-[#777777]" />
                            </div>
                          )}
                          <div className="truncate">
                            <div className="text-xs font-semibold text-white truncate">{item.title || item.url}</div>
                            <div className={`text-[11px] flex items-center space-x-2 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                              <span className="font-mono uppercase">{item.quality}</span>
                              <span>•</span>
                              <span className="font-mono uppercase">.{item.format}</span>
                              <span>•</span>
                              <span className="truncate max-w-xs">{item.url}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge & Actions */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${
                              item.status === 'completed'
                                ? 'bg-green-950/60 border-green-700 text-green-400'
                                : item.status === 'error'
                                ? 'bg-red-950/60 border-red-700 text-red-400'
                                : item.status === 'cancelled'
                                ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                                : 'bg-[#312b15] border-[#726425] text-[#f3e79a]'
                            }`}
                          >
                            {item.status}
                          </span>

                          {isRunning && (
                            <button
                              type="button"
                              onClick={() => handleCancelJob(item.id)}
                              title="Cancel download"
                              className="p-1 rounded bg-red-900/40 text-red-400 hover:bg-red-900/80 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {item.status === 'completed' && item.downloadUrl && (
                            <a
                              href={`${item.downloadUrl}${item.downloadUrl.includes('?') ? '&' : '?'}autodelete=${state.autoCleanServerOnClose}`}
                              download={item.filename || 'download'}
                              className="px-2.5 py-1 text-xs rounded bg-[#f3e79a] text-black font-semibold hover:bg-[#faee9f] flex items-center space-x-1"
                            >
                              <Download className="w-3 h-3" />
                              <span>Save to PC</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {isRunning && (
                        <div className="space-y-1.5">
                          <div className="w-full h-2 rounded-full overflow-hidden bg-[#222222]">
                            <div
                              className="h-full bg-[#f3e79a] transition-all duration-300 rounded-full"
                              style={{ width: `${Math.max(2, item.progress)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-[#888888]">
                            <div>{item.currentStage || 'Processing...'}</div>
                            <div className="flex items-center space-x-3">
                              {item.downloadSpeed && <span>{item.downloadSpeed}</span>}
                              {item.totalSizeStr && <span>{item.totalSizeStr}</span>}
                              {item.eta && <span>ETA: {item.eta}</span>}
                              <span className="text-white font-semibold">{item.progress}%</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Error details if failed */}
                      {item.status === 'error' && item.errorMessage && (
                        <div className="p-2.5 rounded bg-red-950/30 border border-red-800/40 text-red-300 text-xs flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                          <div className="text-[11px] leading-relaxed whitespace-pre-wrap">{item.errorMessage}</div>
                        </div>
                      )}

                      {/* Completed File Details */}
                      {item.status === 'completed' && item.filename && (
                        <div
                          className={`p-2.5 rounded flex items-center justify-between text-xs ${
                            isDarkMode ? 'bg-[#181818]' : 'bg-[#efefef]'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                            <span className="font-mono truncate">{item.filename}</span>
                            {item.totalSizeStr && (
                              <span className="text-[10px] text-[#888888]">({item.totalSizeStr})</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            {item.downloadUrl && (
                              <a
                                href={`${item.downloadUrl}${item.downloadUrl.includes('?') ? '&' : '?'}autodelete=${state.autoCleanServerOnClose}`}
                                download={item.filename}
                                className="text-xs text-[#f3e79a] hover:underline flex items-center space-x-1"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Save to PC</span>
                              </a>
                            )}
                            {item.filename && (
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(item.filename!)}
                                title="Delete file from server now"
                                className="p-1 rounded text-[#777777] hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Completed Downloads in ./downloads */}
        {activeTab === 'folder' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#888888]">
              <span>Storage location: <code className="font-mono text-white">./downloads</code></span>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={loadCompletedFiles}
                  className="flex items-center space-x-1 text-[#f3e79a] hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Folder</span>
                </button>
                {completedFolderFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePurgeAllFiles}
                    className="flex items-center space-x-1 text-red-400 hover:text-red-300 hover:underline"
                    title="Purge all files from server storage now"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Purge All Server Files</span>
                  </button>
                )}
              </div>
            </div>

            {completedFolderFiles.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#666666]">
                No files downloaded in the destination folder yet.
              </div>
            ) : (
              <div className="space-y-2">
                {completedFolderFiles.map((f, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded border flex items-center justify-between ${
                      isDarkMode ? 'bg-[#141414] border-[#262626]' : 'bg-[#fafafa] border-[#e5e5e5]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      {f.name.endsWith('.mp3') || f.name.endsWith('.m4a') || f.name.endsWith('.wav') ? (
                        <Music className="w-4 h-4 text-[#87d37c] shrink-0" />
                      ) : (
                        <Film className="w-4 h-4 text-[#f3e79a] shrink-0" />
                      )}
                      <div className="truncate">
                        <div className="text-xs font-mono text-white truncate">{f.name}</div>
                        <div className="text-[10px] text-[#777777]">{f.sizeStr}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <a
                        href={`${f.downloadUrl}${f.downloadUrl.includes('?') ? '&' : '?'}autodelete=${state.autoCleanServerOnClose}`}
                        download={f.name}
                        className={`px-3 py-1 text-xs rounded border flex items-center space-x-1.5 transition-colors ${
                          isDarkMode
                            ? 'bg-[#222222] border-[#383838] text-white hover:bg-[#2c2c2c]'
                            : 'bg-white border-[#d0d0d0] text-black hover:bg-[#f0f0f0]'
                        }`}
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(f.name)}
                        title="Delete this file from server"
                        className="p-1.5 rounded border border-transparent hover:border-red-900/40 text-[#666666] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Collapsible Raw yt-dlp Terminal Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#888888]">
              <span>Live standard output &amp; error console from yt-dlp process</span>
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, rawTerminalLogs: [] }))}
                className="text-[11px] text-[#777777] hover:text-white"
              >
                Clear Console
              </button>
            </div>

            <div
              ref={terminalEndRef}
              className={`p-3 rounded font-mono text-[11px] h-64 overflow-y-auto space-y-0.5 select-text ${
                isDarkMode ? 'bg-[#0d0d0d] text-[#aaaaaa] border border-[#222222]' : 'bg-[#1e1e1e] text-[#cccccc]'
              }`}
            >
              {state.rawTerminalLogs.length === 0 ? (
                <div className="text-[#555555] italic">No active logs yet. Start an inspection or download to view live output.</div>
              ) : (
                state.rawTerminalLogs.map((log, idx) => {
                  let colorClass = 'text-[#aaaaaa]';
                  if (log.includes('[stderr]') || log.includes('ERROR:')) colorClass = 'text-red-400';
                  else if (log.includes('[download]')) colorClass = 'text-[#f3e79a]';
                  else if (log.includes('[Merger]') || log.includes('[ExtractAudio]')) colorClass = 'text-blue-300';
                  else if (log.includes('[completed]')) colorClass = 'text-green-400 font-semibold';

                  return (
                    <div key={idx} className={`leading-tight break-all ${colorClass}`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
