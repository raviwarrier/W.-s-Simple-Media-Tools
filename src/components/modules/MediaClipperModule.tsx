import React, { useState } from 'react';
import {
  MediaClipperState,
  SecretStore,
  CostTrackerState,
} from '../../types';
import {
  hhmmssToSeconds,
  clipAudioClientSide,
} from '../../utils/audioProcessor';
import { useToast } from '../../context/ToastContext';
import {
  Scissors,
  Download,
  Play,
  Film,
  Music,
  Clock,
  DollarSign,
  AlertCircle,
  FileCheck,
  Key,
  HardDrive,
  Copy,
  Check,
  Info,
} from 'lucide-react';

interface MediaClipperModuleProps {
  state: MediaClipperState;
  onChange: (updater: (prev: MediaClipperState) => MediaClipperState) => void;
  secretStore: SecretStore;
  costTracker: CostTrackerState;
  onRecordCost: (
    module: 'media-clipper',
    operation: string,
    durationSec: number,
    inputTokens?: number,
    outputTokens?: number,
    details?: string
  ) => void;
  onRegisterBackgroundTask: (task: {
    moduleId: 'media-clipper';
    title: string;
    estimatedTotalSec: number;
    execute: (
      onProgress: (p: number, msg: string) => void,
      checkCancelled: () => boolean
    ) => Promise<{
      filename: string;
      dataUrl: string;
      durationSec: number;
      mode: 'Audio' | 'Video';
    }>;
  }) => void;
  isDarkMode: boolean;
}

export const MediaClipperModule: React.FC<MediaClipperModuleProps> = ({
  state,
  onChange,
  costTracker,
  onRecordCost,
  onRegisterBackgroundTask,
  isDarkMode,
}) => {
  const { showToast } = useToast();
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedMeta, setCopiedMeta] = useState(false);

  const handleCopyMeta = () => {
    if (!state.clipResult) return;
    const source =
      state.sourceMode === 'URL'
        ? state.mediaUrl
        : state.sourceMode === 'Server Path'
        ? state.filePath || 'Server Path'
        : state.uploadedFileName || 'Uploaded File';

    const metaString = [
      `Format: ${state.clipResult.mode} (.${state.clipResult.mode === 'Audio' ? 'mp3' : 'mp4'})`,
      `Start Time: ${state.startTimeStr}`,
      `End Time: ${state.endTimeStr}`,
      `Duration: ${state.clipResult.duration.toFixed(1)}s`,
      `Source: ${source}`,
      `Filename: ${state.clipResult.filename}`,
    ].join('\n');

    navigator.clipboard.writeText(metaString);
    setCopiedMeta(true);
    showToast({
      type: 'info',
      title: 'Metadata Copied',
      message: 'Media clip metadata copied to clipboard.',
      duration: 3500,
    });
    setTimeout(() => setCopiedMeta(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onChange((prev) => ({
      ...prev,
      uploadedFileName: file.name,
      uploadedFileBlob: file,
    }));
  };

  const handleExtractClip = () => {
    setErrorMsg('');
    const startSec = hhmmssToSeconds(state.startTimeStr);
    const endSec = hhmmssToSeconds(state.endTimeStr);

    if (startSec === null || endSec === null || endSec <= startSec) {
      const msg = 'Invalid timestamps. Ensure End Time is strictly greater than Start Time.';
      setErrorMsg(msg);
      showToast({
        type: 'warning',
        title: 'Invalid Timestamp Range',
        message: msg,
        duration: 15000,
      });
      return;
    }

    if (state.sourceMode === 'Upload file' && !state.uploadedFileBlob) {
      const msg = 'Please upload a source video or audio file.';
      setErrorMsg(msg);
      showToast({
        type: 'warning',
        title: 'Missing Media File',
        message: msg,
        duration: 15000,
      });
      return;
    }

    if (state.sourceMode === 'Server Path' && (!state.filePath || !state.filePath.trim())) {
      const msg = 'Please enter a valid server file path (e.g. /srv/media/video.mp4 or B:\\media\\video.mp4).';
      setErrorMsg(msg);
      showToast({
        type: 'warning',
        title: 'Missing Server Path',
        message: msg,
        duration: 15000,
      });
      return;
    }

    if (state.sourceMode === 'URL' && !state.mediaUrl) {
      const msg = 'Please enter a media URL.';
      setErrorMsg(msg);
      showToast({
        type: 'warning',
        title: 'Missing Media URL',
        message: msg,
        duration: 15000,
      });
      return;
    }

    const clipDuration = endSec - startSec;
    let baseName = 'web_media';
    if (state.uploadedFileName) {
      baseName = state.uploadedFileName.replace(/\.[^/.]+$/, '');
    } else if (state.filePath) {
      const clean = state.filePath.trim().replace(/\\/g, '/');
      baseName = clean.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'server_media';
    }

    const ext = state.extractChoice === 'Audio' ? 'mp3' : 'mp4';
    const outFilename = `${baseName}_clip_${Math.floor(startSec)}-${Math.floor(endSec)}.${ext}`;

    // Revoke previous clip URL for this module
    if (state.clipResult?.url) {
      URL.revokeObjectURL(state.clipResult.url);
    }

    onChange((prev) => ({
      ...prev,
      clipResult: null,
      isProcessing: true,
    }));

    onRegisterBackgroundTask({
      moduleId: 'media-clipper',
      title: `Clip: ${outFilename}`,
      estimatedTotalSec: Math.min(25, Math.max(5, clipDuration * 0.4)),
      execute: async (onProgress, checkCancelled) => {
        try {
          onProgress(15, 'Preparing media stream and ephemeral storage...');
          if (checkCancelled()) throw new Error('Cancelled');

          const formData = new FormData();
          if (state.sourceMode === 'Upload file' && state.uploadedFileBlob) {
            formData.append('file', state.uploadedFileBlob);
          } else if (state.sourceMode === 'Server Path' && state.filePath) {
            formData.append('filePath', state.filePath.trim());
          } else if (state.mediaUrl) {
            formData.append('url', state.mediaUrl);
          }
          formData.append('startTime', state.startTimeStr);
          formData.append('endTime', state.endTimeStr);
          formData.append('extractChoice', state.extractChoice);

          onProgress(45, `Running FFmpeg slice (${state.startTimeStr} to ${state.endTimeStr})...`);
          if (checkCancelled()) throw new Error('Cancelled');

          const response = await fetch('/api/media-clipper/process', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Clipping failed' }));
            throw new Error(err.error || 'Server media clipping failed');
          }

          onProgress(85, 'Encoding stream and generating download payload...');
          if (checkCancelled()) throw new Error('Cancelled');

          const resJson = (await response.json()) as {
            filename: string;
            dataUrl: string;
            durationSec: number;
            sizeBytes: number;
            mode: 'Audio' | 'Video';
          };

          // Convert dataUrl to a Blob URL for reliable HTML5 video/audio playback and unlimited download size
          let finalUrl = resJson.dataUrl;
          if (resJson.dataUrl && resJson.dataUrl.startsWith('data:')) {
            try {
              const parts = resJson.dataUrl.split(',');
              const mime = parts[0].match(/:(.*?);/)?.[1] || (state.extractChoice === 'Audio' ? 'audio/mpeg' : 'video/mp4');
              const binaryStr = atob(parts[1]);
              const len = binaryStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: mime });
              if (state.clipResult?.url && state.clipResult.url.startsWith('blob:')) {
                URL.revokeObjectURL(state.clipResult.url);
              }
              finalUrl = URL.createObjectURL(blob);
            } catch (blobErr) {
              console.warn('Could not convert dataUrl to Blob:', blobErr);
            }
          }

          const finalSize = resJson.sizeBytes;
          const finalFilename = resJson.filename || outFilename;

          onProgress(100, 'Done. Clip ready for download.');

          showToast({
            type: 'success',
            title: 'Clip Generated',
            message: `${finalFilename} (${state.extractChoice}) is ready for preview and download.`,
            duration: 8000,
          });

          onRecordCost(
            'media-clipper',
            `FFmpeg Clip (${state.extractChoice})`,
            clipDuration,
            0,
            0,
            `${state.startTimeStr} - ${state.endTimeStr}`
          );

          onChange((prev) => ({
            ...prev,
            clipResult: {
              filename: finalFilename,
              url: finalUrl,
              size: finalSize,
              duration: clipDuration,
              mode: state.extractChoice,
            },
            isProcessing: false,
          }));

          return {
            filename: finalFilename,
            dataUrl: finalUrl,
            durationSec: clipDuration,
            mode: state.extractChoice,
          };
        } catch (err: unknown) {
          onChange((prev) => ({ ...prev, isProcessing: false }));
          const msg = (err as Error)?.message || 'Clipping failed';
          showToast({
            type: 'error',
            title: 'Media Clipping Failed',
            message: msg,
            duration: 15000,
          });
          throw err;
        }
      },
    });
  };

  return (
    <div id="media-clipper-module" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Controls */}
        <div
          className={`lg:col-span-5 p-5 rounded border space-y-4 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="border-b border-inherit pb-2">
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Source Selection & Timing Parameters
            </h4>
          </div>

          {/* Source Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Select Source Mode:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-src-upload"
                onClick={() => onChange((prev) => ({ ...prev, sourceMode: 'Upload file' }))}
                className={`py-2 px-2.5 rounded text-xs font-medium border transition-all ${
                  state.sourceMode === 'Upload file'
                    ? isDarkMode
                      ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#ffd600]/25 border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-[#888888] hover:text-white'
                    : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                id="btn-src-path"
                onClick={() => onChange((prev) => ({ ...prev, sourceMode: 'Server Path' }))}
                className={`py-2 px-2.5 rounded text-xs font-medium border transition-all ${
                  state.sourceMode === 'Server Path'
                    ? isDarkMode
                      ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#ffd600]/25 border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-[#888888] hover:text-white'
                    : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                }`}
              >
                Server Path
              </button>
              <button
                type="button"
                id="btn-src-url"
                onClick={() => onChange((prev) => ({ ...prev, sourceMode: 'URL' }))}
                className={`py-2 px-2.5 rounded text-xs font-medium border transition-all ${
                  state.sourceMode === 'URL'
                    ? isDarkMode
                      ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#ffd600]/25 border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-[#888888] hover:text-white'
                    : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                }`}
              >
                Media URL
              </button>
            </div>
          </div>

          {/* Source Input */}
          {state.sourceMode === 'Upload file' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Choose Video/Audio File:</label>
              <div
                className={`border border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'border-[#383838] hover:border-[#f3e79a] bg-[#121212]'
                    : 'border-[#d4d4d8] hover:border-[#ffd600] bg-[#fafafa]'
                }`}
                onClick={() => document.getElementById('clipper-file-input')?.click()}
              >
                <input
                  id="clipper-file-input"
                  type="file"
                  accept="video/*,audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Film className={`w-6 h-6 mx-auto mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
                <p className="text-xs font-medium">
                  {state.uploadedFileName ? (
                    <span className={isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}>
                      {state.uploadedFileName}
                    </span>
                  ) : (
                    'Click to upload video or audio'
                  )}
                </p>
                <p className={`text-xs mt-0.5 font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
                  MP4, MOV, MP3, WAV, AAC, MKV
                </p>
              </div>
            </div>
          )}

          {state.sourceMode === 'Server Path' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <HardDrive className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                <span>Media File Disk / Server Path:</span>
              </label>
              <input
                type="text"
                id="input-clipper-path"
                placeholder="e.g. /srv/media/video.mp4 or B:\movies\film.mkv"
                value={state.filePath || ''}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, filePath: e.target.value }))
                }
                className={`w-full px-3 py-2 rounded border text-xs font-mono focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white placeholder-neutral-500 focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
              <p className={`text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
                Accepts both Linux paths (<code>/srv/...</code>) and Windows paths (<code>B:\...</code>).
              </p>
            </div>
          )}

          {state.sourceMode === 'URL' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Media Stream URL:</label>
              <input
                type="text"
                id="input-clipper-url"
                placeholder="https://example.com/video.mp4"
                value={state.mediaUrl}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, mediaUrl: e.target.value }))
                }
                className={`w-full px-3 py-2 rounded border text-xs focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white placeholder-neutral-500 focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1">
                <Clock className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
                <span>Start Time</span>
              </label>
              <input
                type="text"
                value={state.startTimeStr}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, startTimeStr: e.target.value }))
                }
                placeholder="00:00:00"
                className={`w-full px-3 py-2 font-mono text-xs rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
              <span className={`text-xs font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>Format: hh:mm:ss</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1">
                <Clock className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
                <span>End Time</span>
              </label>
              <input
                type="text"
                value={state.endTimeStr}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, endTimeStr: e.target.value }))
                }
                placeholder="00:00:30"
                className={`w-full px-3 py-2 font-mono text-xs rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
              <span className={`text-xs font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>Format: hh:mm:ss</span>
            </div>
          </div>

          {/* Extraction Choice */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Extraction Format:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, extractChoice: 'Audio' }))}
                className={`py-2 px-3 rounded text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                  state.extractChoice === 'Audio'
                    ? isDarkMode
                      ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#ffd600]/25 border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-[#888888] hover:text-white'
                    : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>Audio (.mp3)</span>
              </button>
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, extractChoice: 'Video' }))}
                className={`py-2 px-3 rounded text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                  state.extractChoice === 'Video'
                    ? isDarkMode
                      ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#ffd600]/25 border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-[#888888] hover:text-white'
                    : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Video (.mp4)</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded border border-neutral-700 bg-neutral-900/60 text-xs">
              <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]'}`} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action */}
          <button
            onClick={handleExtractClip}
            disabled={state.isProcessing}
            id="btn-extract-clip"
            className={`w-full py-2.5 px-4 rounded font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 ${
              isDarkMode
                ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{state.isProcessing ? 'Clipping in Background…' : 'Extract Clip'}</span>
          </button>
        </div>

        {/* Right Output */}
        <div
          className={`lg:col-span-7 p-6 rounded border flex flex-col space-y-4 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-inherit pb-3">
            <div>
              <h4 className={`text-sm font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#e5e5e5]' : 'text-[#222222]'}`}>
                Extracted Media Output
              </h4>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                Results retained in-memory until next task or browser close.
              </p>
            </div>

            {state.clipResult && (
              <a
                href={state.clipResult.url}
                download={state.clipResult.filename}
                id="btn-download-clip-result"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded font-semibold text-sm shadow-xs transition-colors ${
                  isDarkMode
                    ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                    : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Download {state.clipResult.filename}</span>
              </a>
            )}
          </div>

          {state.clipResult ? (
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded border flex items-center justify-between ${
                  isDarkMode ? 'border-[#333333] bg-[#121212]' : 'border-[#e0e0e0] bg-[#fafafa]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck className={`w-5 h-5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                  <div>
                    <p className={`text-sm font-semibold font-mono ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                      {state.clipResult.filename}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                      Duration: {state.clipResult.duration.toFixed(1)}s • Ready for download
                    </p>
                  </div>
                </div>
              </div>

              {/* Metadata Section - Separate with Copy Button */}
              <div
                id="section-media-clipper-metadata"
                className={`p-3.5 rounded border transition-colors ${
                  isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-inherit pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Info className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                    <h5 className="text-xs font-semibold uppercase tracking-wider">
                      Clip Metadata
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMeta}
                    id="btn-copy-clipper-meta"
                    title="Copy clip metadata to clipboard"
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium text-xs border transition-colors ${
                      copiedMeta
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : isDarkMode
                        ? 'bg-[#222222] border-[#333333] text-neutral-200 hover:bg-[#2a2a2a]'
                        : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-800 hover:bg-[#e4e4e7]'
                    }`}
                  >
                    {copiedMeta ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMeta ? 'Meta Copied!' : 'Copy Metadata'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Format:</span>
                    <span className="font-semibold font-mono text-xs">{state.clipResult.mode} (.{state.clipResult.mode === 'Audio' ? 'mp3' : 'mp4'})</span>
                  </div>
                  <div>
                    <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Time Range:</span>
                    <span className="font-semibold font-mono text-xs">{state.startTimeStr} → {state.endTimeStr}</span>
                  </div>
                  <div>
                    <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Duration:</span>
                    <span className="font-semibold font-mono text-xs">{state.clipResult.duration.toFixed(1)}s</span>
                  </div>
                  <div className="truncate">
                    <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Filename:</span>
                    <span className="font-semibold font-mono text-xs truncate block" title={state.clipResult.filename}>{state.clipResult.filename}</span>
                  </div>
                </div>
              </div>

              {/* Player Preview */}
              <div
                className={`p-6 rounded border flex flex-col items-center justify-center min-h-48 ${
                  isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'
                }`}
              >
                {state.clipResult.mode === 'Audio' ? (
                  <div className="w-full max-w-md space-y-3 text-center">
                    <Music className={`w-10 h-10 mx-auto ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]'}`} />
                    <p className="text-sm font-semibold">Audio Clip Preview</p>
                    <audio
                      src={state.clipResult.url}
                      controls
                      className="w-full mt-2"
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-md space-y-3 text-center">
                    <video
                      src={state.clipResult.url}
                      controls
                      className="w-full rounded max-h-64 object-contain bg-black"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`h-64 flex flex-col items-center justify-center text-center text-sm ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              <Scissors className="w-10 h-10 mb-2.5 opacity-30" />
              <p className="font-semibold text-base">No clip extracted yet</p>
              <p className="text-xs mt-1 max-w-sm">
                Set start and end timestamps and click 'Extract Clip'.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
