import React from 'react';
import { ModuleId, SecretStore, CostTrackerState } from '../types';
import {
  HardDrive,
  Key,
  DollarSign,
} from 'lucide-react';

interface HeaderBarProps {
  currentModule: ModuleId;
  memoryUsageBytes: number;
  onPurgeMemory?: () => void;
  isDarkMode: boolean;
  secretStore?: SecretStore;
  costTracker?: CostTrackerState;
  onNavigateToSettings?: (module: ModuleId) => void;
}

const MODULE_NAMES: Partial<Record<ModuleId, { title: string; desc: string }>> = {
  'video-transcriber': {
    title: 'Video Transcription Tool',
    desc: 'Whisper chunked transcription & OpenAI GPT-4o-mini summarization',
  },
  'media-clipper': {
    title: 'Audio/Video Clipper',
    desc: 'Exact timestamp clipping for audio (.mp3) and video (.mp4) files',
  },
  'audiobook-transcriber': {
    title: 'Audiobook Snippet Transcriber',
    desc: 'Audiobook range extraction with ffprobe metadata tags & Whisper',
  },
  'audible-fetcher': {
    title: 'Audible Book Details Fetcher',
    desc: 'Audible Catalog API & Audnex metadata lookup (adapted from Audiobookshelf GPL-3.0)',
  },
  'video-downloader': {
    title: 'Video Downloader',
    desc: 'High-performance yt-dlp downloader with browser auth & multi-format options',
  },
  'secrets-settings': {
    title: 'Encrypted Secrets Vault',
    desc: 'AES-GCM key management and unified vs per-module token policy',
  },
  'cost-analytics': {
    title: 'Usage Costs & Budget Monitor',
    desc: 'Real-time expenditure tracking per module and budget enforcement',
  },
  'code-environment': {
    title: 'Environment & Setup',
    desc: 'Unified requirements.txt, setup instructions, and code inspector',
  },
};

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentModule,
  memoryUsageBytes,
  onPurgeMemory,
  isDarkMode,
  secretStore,
  costTracker,
  onNavigateToSettings,
}) => {
  const meta = MODULE_NAMES[currentModule] || {
    title: "W.'s Simple Media Tools",
    desc: 'Media processing suite',
  };

  // Compute cost and operations count for current module
  const moduleCostStats = (costTracker?.records || [])
    .filter((r) => r.moduleId === currentModule)
    .reduce(
      (acc, r) => ({
        costUSD: acc.costUSD + r.costUSD,
        runs: acc.runs + 1,
      }),
      { costUSD: 0, runs: 0 }
    );

  // Determine API key status for the active module
  let keyStatus: 'not-required' | 'set' | 'not-set' = 'not-required';
  if (currentModule === 'video-transcriber') {
    const activeKey =
      secretStore?.keyMode === 'unified'
        ? secretStore.unifiedOpenAiKey?.trim()
        : secretStore?.moduleOpenAiKeys?.videoTranscriber?.trim();
    keyStatus = activeKey ? 'set' : 'not-set';
  } else if (currentModule === 'audiobook-transcriber') {
    const activeKey =
      secretStore?.keyMode === 'unified'
        ? secretStore.unifiedOpenAiKey?.trim()
        : secretStore?.moduleOpenAiKeys?.audiobookTranscriber?.trim();
    keyStatus = activeKey ? 'set' : 'not-set';
  } else if (currentModule === 'secrets-settings') {
    const hasAny =
      Boolean(secretStore?.unifiedOpenAiKey?.trim()) ||
      Boolean(
        secretStore?.moduleOpenAiKeys &&
          Object.values(secretStore.moduleOpenAiKeys).some(
            (k) => typeof k === 'string' && Boolean(k.trim())
          )
      );
    keyStatus = hasAny ? 'set' : 'not-set';
  } else {
    keyStatus = 'not-required';
  }

  const formatBytes = (bytes?: number) => {
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      id="header-bar"
      className={`h-14 px-5 border-b flex items-center justify-between transition-colors z-10 select-none shrink-0 ${
        isDarkMode
          ? 'bg-[#121212] border-[#262626] text-[#f2f2f2]'
          : 'bg-[#ffffff] border-[#e5e5e5] text-[#121212]'
      }`}
    >
      {/* Title & Description (without redundant version number) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight truncate">{meta.title}</h2>
          <p
            className={`text-xs hidden sm:block truncate mt-0.5 ${
              isDarkMode ? 'text-[#8c8c8c]' : 'text-[#666666]'
            }`}
          >
            {meta.desc}
          </p>
        </div>
      </div>

      {/* Right Controls: Key Status & Buffer Size */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Key Status Pill */}
        {keyStatus === 'not-required' ? (
          <div
            id="pill-header-key-status"
            title="No API key is required for this module."
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono select-none transition-colors ${
              isDarkMode
                ? 'bg-[#1a1a1a] border-[#2e2e2e] text-[#888888]'
                : 'bg-[#f8f8f8] border-[#e0e0e0] text-[#666666]'
            }`}
          >
            <Key className="w-3.5 h-3.5 opacity-60" />
            <span>Key: not required</span>
          </div>
        ) : keyStatus === 'set' ? (
          <button
            type="button"
            id="btn-header-key-status"
            onClick={() => onNavigateToSettings?.('secrets-settings')}
            title="API key is set. Click to manage in Encrypted Secrets."
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono cursor-pointer transition-colors ${
              isDarkMode
                ? 'bg-[#1a1a1a] hover:bg-[#252525] border-emerald-900/60 text-emerald-400'
                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-emerald-500" />
            <span>Key: <strong className="font-semibold">set</strong></span>
          </button>
        ) : (
          <button
            type="button"
            id="btn-header-key-status"
            onClick={() => onNavigateToSettings?.('secrets-settings')}
            title="API key is not set. Click to configure your key in Encrypted Secrets."
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono cursor-pointer transition-colors ${
              isDarkMode
                ? 'bg-[#1a1a1a] hover:bg-[#252525] border-amber-800/60 text-amber-400'
                : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
            <span>Key: <strong className="font-semibold underline">not set</strong></span>
          </button>
        )}

        {/* Module Cost Pill */}
        <button
          type="button"
          id="btn-header-module-cost"
          onClick={() => onNavigateToSettings?.('cost-analytics')}
          title={`Module cost: $${moduleCostStats.costUSD.toFixed(4)} across ${moduleCostStats.runs} operations. Click to view detailed cost analytics.`}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono cursor-pointer transition-colors ${
            isDarkMode
              ? 'bg-[#1a1a1a] hover:bg-[#252525] border-[#2e2e2e] text-[#f3e79a]'
              : 'bg-[#f8f8f8] hover:bg-[#f0f0f0] border-[#e0e0e0] text-[#854d0e] font-semibold'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>${moduleCostStats.costUSD.toFixed(4)}</span>
          <span className={isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}>
            ({moduleCostStats.runs})
          </span>
        </button>

        {/* Buffer Used Size Indicator (Preserved as requested: "one as a pill on the module header") */}
        <div
          title={`Active in-memory file buffer: ${formatBytes(memoryUsageBytes)}. Cleared when new task runs or window closes.`}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition-colors ${
            isDarkMode
              ? 'bg-[#1a1a1a] border-[#2e2e2e] text-[#b0b0b0]'
              : 'bg-[#f8f8f8] border-[#e0e0e0] text-[#444444]'
          }`}
        >
          <HardDrive className={`w-3.5 h-3.5 ${memoryUsageBytes && memoryUsageBytes > 0 ? (isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]') : 'text-[#777777]'}`} />
          <span>Buffer: {formatBytes(memoryUsageBytes)}</span>
          {memoryUsageBytes && memoryUsageBytes > 0 && onPurgeMemory && (
            <button
              onClick={onPurgeMemory}
              title="Clear buffer manually"
              className={`ml-1 text-[11px] underline hover:no-underline font-semibold ${
                isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'
              }`}
            >
              clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
