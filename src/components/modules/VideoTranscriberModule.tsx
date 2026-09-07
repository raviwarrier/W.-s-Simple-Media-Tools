import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  VideoTranscriberState,
  SecretStore,
  CostTrackerState,
  ModuleId,
} from '../../types';
import {
  Video,
  Download,
  Copy,
  Check,
  Play,
  StopCircle,
  Key,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
} from 'lucide-react';

interface VideoTranscriberModuleProps {
  state: VideoTranscriberState;
  onChange: (updater: (prev: VideoTranscriberState) => VideoTranscriberState) => void;
  secretStore: SecretStore;
  costTracker: CostTrackerState;
  onRecordCost: (
    module: 'video-transcriber',
    operation: string,
    durationSec: number,
    inputTokens?: number,
    outputTokens?: number,
    details?: string
  ) => void;
  onRegisterBackgroundTask: (task: {
    moduleId: 'video-transcriber';
    title: string;
    estimatedTotalSec: number;
    execute: (
      onProgress: (p: number, msg: string) => void,
      checkCancelled: () => boolean
    ) => Promise<{
      transcription: string;
      summary?: string;
      filename: string;
      dataUrl: string;
      durationSec: number;
    }>;
  }) => void;
  onNavigateToSettings?: (moduleId: ModuleId) => void;
  isDarkMode: boolean;
}

// Helper to transform timestamped lines to flowing passages/paragraphs without timestamps
export function formatTranscript(rawText: string, omitTimestamps: boolean): string {
  if (!rawText) return '';
  if (!omitTimestamps) return rawText;

  const headerSplit = rawText.split('\n\n');
  let header = '';
  let body = rawText;
  if (headerSplit.length > 1 && headerSplit[0].includes('Title:')) {
    header = headerSplit[0].replace(/Format: .*/, 'Format: Passages / Paragraphs (No Timestamps)').replace(/Chunk Duration: .*/, 'Format: Passages / Paragraphs (No Timestamps)') + '\n\n';
    body = headerSplit.slice(1).join('\n\n');
  }

  const lines = body.split('\n');
  const sentences = lines
    .map((line) => line.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/g, '').trim())
    .filter(Boolean);

  if (sentences.length === 0) return rawText;

  const paragraphs: string[] = [];
  let currentGroup: string[] = [];
  for (const s of sentences) {
    currentGroup.push(s);
    if (
      currentGroup.length >= 3 &&
      (s.endsWith('.') || s.endsWith('!') || s.endsWith('?') || currentGroup.join(' ').length > 240)
    ) {
      paragraphs.push(currentGroup.join(' '));
      currentGroup = [];
    }
  }
  if (currentGroup.length > 0) {
    paragraphs.push(currentGroup.join(' '));
  }

  return header + (paragraphs.length > 0 ? paragraphs.join('\n\n') : sentences.join(' '));
}

export const VideoTranscriberModule: React.FC<VideoTranscriberModuleProps> = ({
  state,
  onChange,
  secretStore,
  costTracker,
  onRecordCost,
  onRegisterBackgroundTask,
  onNavigateToSettings,
  isDarkMode,
}) => {
  const { showToast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localUrl, setLocalUrl] = useState(state.videoUrl);
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeKey =
    secretStore.keyMode === 'unified'
      ? secretStore.unifiedOpenAiKey
      : secretStore.moduleOpenAiKeys.videoTranscriber || secretStore.unifiedOpenAiKey;

  const moduleTotal = costTracker.moduleTotals['video-transcriber'] || { costUSD: 0, runs: 0 };

  const handleCopyTranscript = () => {
    if (!state.finalTranscription) return;
    navigator.clipboard.writeText(state.finalTranscription);
    setCopied(true);
    showToast({
      type: 'info',
      title: 'Transcription Copied',
      message: 'Full transcription text copied to clipboard.',
      duration: 5000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySummary = () => {
    if (!state.finalSummary) return;
    navigator.clipboard.writeText(state.finalSummary);
    setCopiedSummary(true);
    showToast({
      type: 'info',
      title: 'Summary Copied',
      message: 'AI Executive Summary copied to clipboard.',
      duration: 5000,
    });
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleValidateUrl = (url: string) => {
    setLocalUrl(url);
    const trimmed = url.trim();
    let status = '';
    if (trimmed.length > 0) {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        status = 'URL validated! Ready for extraction.';
      } else {
        status = 'Invalid URL format. Please start with https:// or http://';
      }
    }
    onChange((prev) => ({
      ...prev,
      videoUrl: trimmed,
      urlValidationStatus: status,
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    onChange((prev) => ({
      ...prev,
      uploadedFileName: file.name,
      uploadedFileBlob: file,
    }));
  };

  const handleStartProcessing = () => {
    if (!state.videoUrl && !state.uploadedFileBlob) {
      setErrorMessage('Please provide either a video URL or upload a video file before starting transcription.');
      return;
    }

    if (!activeKey) {
      setErrorMessage('OpenAI API key is not set. Whisper transcription requires an OpenAI API key. Click below to configure your key in Encrypted Secrets.');
      return;
    }

    setErrorMessage(null);

    // Revoke previous in-memory object URL for this module
    if (state.downloadReady?.url) {
      URL.revokeObjectURL(state.downloadReady.url);
    }

    const title = state.uploadedFileName
      ? state.uploadedFileName.replace(/\.[^/.]+$/, '')
      : state.videoUrl.replace(/^https?:\/\//, '').slice(0, 28);

    onChange((prev) => ({
      ...prev,
      downloadReady: null,
      finalTranscription: '',
      finalSummary: '',
      isProcessing: true,
    }));

    onRegisterBackgroundTask({
      moduleId: 'video-transcriber',
      title: `Transcribe: ${title}`,
      estimatedTotalSec: 40,
      execute: async (onProgress, checkCancelled) => {
        try {
          onProgress(15, 'Preparing media source and downloading audio stream...');
          if (checkCancelled()) throw new Error('Cancelled');

          const formData = new FormData();
          if (state.uploadedFileBlob) {
            formData.append('file', state.uploadedFileBlob);
          } else if (state.videoUrl) {
            formData.append('url', state.videoUrl);
          }
          formData.append('chunkDuration', state.chunkDuration.toString());
          formData.append('modelSize', state.modelSize);
          formData.append('operationMode', state.operationMode);
          formData.append('omitTimestamps', (state.omitTimestamps || false).toString());
          if (activeKey) {
            formData.append('openaiApiKey', activeKey);
          }

          onProgress(40, `Extracting 16kHz audio track and decoding speech into ${state.chunkDuration}s chunks...`);
          if (checkCancelled()) throw new Error('Cancelled');

          const response = await fetch('/api/video-transcriber/process', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'Transcription failed' }));
            throw new Error(errData.error || 'Server transcription failed');
          }

          onProgress(85, 'Finalizing transcription timestamps and generating summary...');
          if (checkCancelled()) throw new Error('Cancelled');

          const result = (await response.json()) as {
            title: string;
            durationSec: number;
            transcript: string;
            summary: string;
          };

          const fullTranscription = result.transcript;
          const finalSummary = result.summary || '';

          const fullTextFileContent =
            fullTranscription + (finalSummary ? `\n\n=== AI EXECUTIVE SUMMARY ===\n${finalSummary}` : '');

          const blob = new Blob([fullTextFileContent], { type: 'text/plain;charset=utf-8' });
          const dataUrl = URL.createObjectURL(blob);
          const filename = `${(result.title || title).replace(/[^a-zA-Z0-9_-]/g, '_')}_transcript.txt`;

          const inputTokens = Math.round(fullTranscription.length / 4);
          const outputTokens = finalSummary ? Math.round(finalSummary.length / 4) : 0;

          onRecordCost(
            'video-transcriber',
            `Transcription (${state.modelSize})`,
            result.durationSec || 60,
            inputTokens,
            outputTokens,
            `${state.operationMode} for ${title}`
          );

          onProgress(100, 'Finished. Transcription is ready.');

          onChange((prev) => ({
            ...prev,
            finalTranscription: fullTranscription,
            finalSummary,
            downloadReady: { filename, url: dataUrl, size: blob.size },
            isProcessing: false,
          }));

          return {
            transcription: fullTranscription,
            summary: finalSummary,
            filename,
            dataUrl,
            durationSec: result.durationSec || 60,
          };
        } catch (err: unknown) {
          const msg = (err as Error)?.message || 'Processing failed';
          setErrorMessage(msg);
          onChange((prev) => ({
            ...prev,
            isProcessing: false,
          }));
          throw err;
        }
      },
    });
  };

  return (
    <div id="video-transcriber-module" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Key & Cost Header Banner */}
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
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Video Transcription Engine</h3>
            <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Chunked Whisper transcription & optional GPT-4o-mini summary
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs font-mono">
          <button
            type="button"
            id="btn-video-transcriber-key-status"
            onClick={() => onNavigateToSettings?.('secrets-settings')}
            title={
              activeKey
                ? 'OpenAI Whisper API key is set. Click to manage in Encrypted Secrets.'
                : 'API key is not set. Click to configure your key in Encrypted Secrets.'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono transition-all cursor-pointer ${
              activeKey
                ? isDarkMode
                  ? 'bg-[#222222] hover:bg-[#2a2a2a] border-emerald-900/60 text-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900 font-medium'
                : isDarkMode
                ? 'bg-[#222222] hover:bg-[#2a2a2a] border-amber-800/60 text-amber-400'
                : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900 font-medium'
            }`}
          >
            <Key
              className={`w-3.5 h-3.5 ${
                activeKey
                  ? 'text-emerald-500'
                  : 'text-amber-500'
              }`}
            />
            <span className={isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}>Key:</span>
            <span className="font-semibold">
              {activeKey ? 'set' : 'not set'}
            </span>
          </button>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono ${
              isDarkMode
                ? 'bg-[#222222] border-[#333333] text-[#f3e79a]'
                : 'bg-[#f8f8f8] border-[#e0e0e0] text-[#854d0e] font-semibold'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>${moduleTotal.costUSD.toFixed(4)}</span>
            <span className={isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}>({moduleTotal.runs})</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Input & Settings) */}
        <div
          className={`lg:col-span-5 p-5 rounded border space-y-4 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="border-b border-inherit pb-2">
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Input Media & Transcription Parameters
            </h4>
          </div>

          {/* Video URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Video URL (YouTube or Direct Link):</label>
            <input
              type="text"
              id="input-video-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={localUrl}
              onChange={(e) => handleValidateUrl(e.target.value)}
              className={`w-full px-3 py-2 rounded border text-xs transition-colors focus:outline-none ${
                isDarkMode
                  ? 'bg-[#121212] border-[#333333] text-white placeholder-neutral-500 focus:border-[#f3e79a]'
                  : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
              }`}
            />
            {localUrl.trim().length > 0 && state.urlValidationStatus && (
              <div
                className={`flex items-center gap-1.5 text-xs ${
                  state.urlValidationStatus.includes('validated')
                    ? isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'
                    : isDarkMode ? 'text-[#e8dc86]' : 'text-[#b45309]'
                }`}
              >
                {state.urlValidationStatus.includes('validated') ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                <span>{state.urlValidationStatus}</span>
              </div>
            )}
          </div>

          {/* Video Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Or Upload Video File:</label>
            <div
              className={`border border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
                isDarkMode
                  ? 'border-[#383838] hover:border-[#f3e79a] bg-[#121212]'
                  : 'border-[#d4d4d8] hover:border-[#ffd600] bg-[#fafafa]'
              }`}
              onClick={() => document.getElementById('file-upload-video')?.click()}
            >
              <input
                id="file-upload-video"
                type="file"
                accept="video/*,audio/*,.mp4,.mov,.avi,.mkv,.webm"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Video className={`w-6 h-6 mx-auto mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
              <p className="text-xs font-medium">
                {state.uploadedFileName ? (
                  <span className={isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}>
                    {state.uploadedFileName}
                  </span>
                ) : (
                  'Click to browse or drop media file'
                )}
              </p>
              <p className={`text-xs mt-0.5 font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
                MP4, MOV, MKV, AVI, WEBM, FLV
              </p>
            </div>
          </div>

          {/* Model Size */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Whisper Model Size:</label>
            <select
              value={state.modelSize}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  modelSize: e.target.value as VideoTranscriberState['modelSize'],
                }))
              }
              className={`w-full px-3 py-2 rounded border text-xs focus:outline-none ${
                isDarkMode
                  ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                  : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
              }`}
            >
              <option value="tiny">tiny — Fastest (~39M params)</option>
              <option value="base">base — Balanced (~74M params, Recommended)</option>
              <option value="small">small — High accuracy (~244M params)</option>
              <option value="medium">medium — Advanced accuracy (~769M params)</option>
              <option value="large">large — Maximum precision (~1550M params)</option>
            </select>
          </div>

          {/* Advanced Settings Expander */}
          <div className="border rounded overflow-hidden border-inherit">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              id="btn-toggle-advanced"
              className={`w-full px-3 py-2 flex items-center justify-between text-xs font-medium ${
                isDarkMode ? 'bg-[#121212] hover:bg-[#1a1a1a]' : 'bg-[#f4f4f5] hover:bg-[#ebebeb]'
              }`}
            >
              <span>Advanced Decoding Parameters</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAdvanced && (
              <div className="p-3.5 space-y-3 text-xs border-t border-inherit">
                <div>
                  <div className="flex justify-between mb-1.5 text-xs">
                    <span>Temperature ({state.temperature.toFixed(1)})</span>
                    <span className={`font-mono ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>0.0 = deterministic</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={state.temperature}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                    }
                    className={`w-full ${isDarkMode ? 'accent-[#f3e79a]' : 'accent-[#ffd600]'}`}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1.5 text-xs">
                    <span>Beam Size ({state.beamSize})</span>
                    <span className={`font-mono ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>1 to 10 beams</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={state.beamSize}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, beamSize: parseInt(e.target.value, 10) }))
                    }
                    className={`w-full ${isDarkMode ? 'accent-[#f3e79a]' : 'accent-[#ffd600]'}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chunk Duration Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Chunk Duration (Audio Slices)</span>
              <span className={`font-mono font-semibold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                {state.chunkDuration}s
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={state.chunkDuration}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, chunkDuration: parseInt(e.target.value, 10) }))
              }
              className={`w-full h-2 cursor-pointer ${isDarkMode ? 'accent-[#f3e79a]' : 'accent-[#ffd600]'}`}
            />
            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Interval size of audio segments dispatched for transcription and timestamped in output [HH:MM:SS].
            </p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2 pt-1 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="checkbox-omit-timestamps"
                checked={state.omitTimestamps || false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange((prev) => ({
                    ...prev,
                    omitTimestamps: checked,
                    finalTranscription: prev.finalTranscription
                      ? formatTranscript(prev.finalTranscription, checked)
                      : prev.finalTranscription,
                  }));
                }}
                className={`w-4 h-4 rounded ${isDarkMode ? 'accent-[#f3e79a]' : 'accent-[#ffd600]'}`}
              />
              <span className={isDarkMode ? 'text-[#cccccc]' : 'text-[#333333]'}>
                Transcribe without timestamps (passages / paragraphs)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="checkbox-clear-temporary-audio"
                checked={state.deleteAudioAfter}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, deleteAudioAfter: e.target.checked }))
                }
                className={`w-4 h-4 rounded ${isDarkMode ? 'accent-[#f3e79a]' : 'accent-[#ffd600]'}`}
              />
              <span className={isDarkMode ? 'text-[#cccccc]' : 'text-[#333333]'}>
                Clear temporary audio after completion
              </span>
            </label>
          </div>

          {/* Operation Mode */}
          <div className="space-y-2 pt-1">
            <label className="text-sm font-medium">Operation Mode:</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, operationMode: 'Transcribe' }))}
                className={`py-2.5 px-3 rounded text-sm font-medium border transition-all ${
                  state.operationMode === 'Transcribe'
                    ? isDarkMode
                      ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#ffd600]/25 border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-[#888888] hover:text-white'
                    : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                }`}
              >
                Transcribe Only
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({ ...prev, operationMode: 'Transcribe & Summarize' }))
                }
                className={`py-2.5 px-3 rounded text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
                  state.operationMode === 'Transcribe & Summarize'
                    ? isDarkMode
                      ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#ffd600]/25 border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-[#888888] hover:text-white'
                    : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Transcribe & Summarize</span>
              </button>
            </div>
          </div>

          {/* Error Feedback */}
          {errorMessage && (
            <div
              className={`p-3 rounded border text-xs flex items-start gap-2.5 ${
                isDarkMode
                  ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Transcription failed</p>
                <p className="mt-0.5 opacity-90">{errorMessage}</p>
                {(errorMessage.toLowerCase().includes('key') || errorMessage.includes('Secrets')) && onNavigateToSettings && (
                  <button
                    type="button"
                    onClick={() => onNavigateToSettings('secrets-settings')}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-mono font-medium text-xs border border-rose-400 bg-rose-200/80 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-900 dark:border-rose-700 text-rose-950 dark:text-rose-100 cursor-pointer transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Open Encrypted Secrets & Enter API Key →</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Run Action */}
          <div className="pt-2">
            <button
              onClick={handleStartProcessing}
              disabled={state.isProcessing}
              id="btn-process-video"
              className={`w-full py-3 px-4 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 ${
                isDarkMode
                  ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                  : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{state.isProcessing ? 'Processing in Background…' : 'Start Transcription'}</span>
            </button>
          </div>
        </div>

        {/* Right Column (Results & Downloads) */}
        <div
          className={`lg:col-span-7 p-6 rounded border flex flex-col space-y-4 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-inherit pb-3">
            <div>
              <h4 className={`text-sm font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#e5e5e5]' : 'text-[#222222]'}`}>
                Transcription & Output
              </h4>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                Results retained in-memory until next task or browser close.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {state.finalSummary && (
                <button
                  type="button"
                  onClick={handleCopySummary}
                  id="btn-copy-summary-top"
                  title="Copy AI Executive Summary to clipboard"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded font-medium text-sm border transition-colors ${
                    copiedSummary
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : isDarkMode
                      ? 'bg-[#222222] border-[#333333] text-neutral-200 hover:bg-[#2a2a2a]'
                      : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-800 hover:bg-[#e4e4e7]'
                  }`}
                >
                  {copiedSummary ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSummary ? 'Summary Copied!' : 'Copy Summary'}</span>
                </button>
              )}

              {state.finalTranscription && (
                <button
                  type="button"
                  onClick={handleCopyTranscript}
                  id="btn-copy-transcription-txt"
                  title="Copy full transcription text to clipboard"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded font-medium text-sm border transition-colors ${
                    copied
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : isDarkMode
                      ? 'bg-[#222222] border-[#333333] text-neutral-200 hover:bg-[#2a2a2a]'
                      : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-800 hover:bg-[#e4e4e7]'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              )}

              {state.downloadReady && (
                <a
                  href={state.downloadReady.url}
                  download={state.downloadReady.filename}
                  id="btn-download-transcription-txt"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded font-semibold text-sm shadow-xs transition-colors ${
                    isDarkMode
                      ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                      : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download .txt</span>
                </a>
              )}
            </div>
          </div>

          {/* Transcript Area */}
          <div className="flex-1 flex flex-col space-y-2">
            <div className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{state.omitTimestamps ? 'Paragraph Transcription:' : 'Timestamped Transcription:'}</span>
              </div>
              <div className="flex items-center gap-2">
                {state.finalTranscription && (
                  <span className={`font-mono text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                    {state.finalTranscription.split('\n').length} lines
                  </span>
                )}
              </div>
            </div>
            <textarea
              readOnly
              rows={state.operationMode === 'Transcribe' ? 26 : (state.finalSummary ? 12 : 16)}
              id="textarea-transcription-output"
              value={state.finalTranscription || 'No transcription yet. Click "Start Transcription" to process audio.'}
              className={`w-full flex-1 p-3.5 rounded font-mono text-sm leading-relaxed border resize-y focus:outline-none transition-all ${
                isDarkMode
                  ? 'bg-[#121212] border-[#2c2c2c] text-neutral-200 focus:border-[#f3e79a]'
                  : 'bg-[#fafafa] border-[#e0e0e0] text-neutral-800 focus:border-[#ffd600]'
              } ${
                state.operationMode === 'Transcribe'
                  ? 'min-h-[540px] lg:min-h-[640px]'
                  : state.finalSummary
                  ? 'min-h-[250px]'
                  : 'min-h-[340px]'
              }`}
            />
          </div>

          {/* Summary Area */}
          {state.finalSummary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-sm font-semibold flex items-center gap-1.5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                  <Sparkles className="w-4 h-4" />
                  <span>AI Executive Summary:</span>
                </label>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  id="btn-copy-summary-section"
                  title="Copy AI Executive Summary"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium text-xs border transition-colors ${
                    copiedSummary
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : isDarkMode
                      ? 'bg-[#222222] border-[#333333] text-neutral-200 hover:bg-[#2a2a2a]'
                      : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-800 hover:bg-[#e4e4e7]'
                  }`}
                >
                  {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
                </button>
              </div>
              <div
                id="container-ai-summary"
                className={`p-4 rounded border text-sm leading-relaxed ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#2c2c2c] text-neutral-200'
                    : 'bg-[#fefce8] border-[#fef08a] text-neutral-900'
                }`}
              >
                <div className="whitespace-pre-line">{state.finalSummary}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
