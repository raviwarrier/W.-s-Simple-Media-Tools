import React, { useState } from 'react';
import {
  AudioExtractorState,
  SecretStore,
  CostTrackerState,
} from '../../types';
import { clipAudioClientSide } from '../../utils/audioProcessor';
import { useToast } from '../../context/ToastContext';
import {
  Music,
  Download,
  Play,
  Film,
  DollarSign,
  FileCheck,
  Key,
} from 'lucide-react';

interface AudioExtractorModuleProps {
  state: AudioExtractorState;
  onChange: (updater: (prev: AudioExtractorState) => AudioExtractorState) => void;
  secretStore: SecretStore;
  costTracker: CostTrackerState;
  onRecordCost: (
    module: 'audio-extractor',
    operation: string,
    durationSec: number,
    inputTokens?: number,
    outputTokens?: number,
    details?: string
  ) => void;
  onRegisterBackgroundTask: (task: {
    moduleId: 'audio-extractor';
    title: string;
    estimatedTotalSec: number;
    execute: (
      onProgress: (p: number, msg: string) => void,
      checkCancelled: () => boolean
    ) => Promise<{
      filename: string;
      dataUrl: string;
      durationSec: number;
    }>;
  }) => void;
  isDarkMode: boolean;
}

export const AudioExtractorModule: React.FC<AudioExtractorModuleProps> = ({
  state,
  onChange,
  costTracker,
  onRecordCost,
  onRegisterBackgroundTask,
  isDarkMode,
}) => {
  const { showToast } = useToast();
  const [errorMsg, setErrorMsg] = useState('');
  const [videoDuration, setVideoDuration] = useState<number>(300); // default 5m
  const moduleTotal = costTracker.moduleTotals['audio-extractor'] || { costUSD: 0, runs: 0 };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onChange((prev) => ({
      ...prev,
      uploadedFileName: file.name,
      uploadedFileBlob: file,
    }));
  };

  const handleExtractAudio = () => {
    setErrorMsg('');
    if (state.sourceType === 'Upload File' && !state.uploadedFileBlob) {
      const msg = 'Please upload a video or audio file first.';
      setErrorMsg(msg);
      showToast({
        type: 'warning',
        title: 'Missing Source File',
        message: msg,
        duration: 15000,
      });
      return;
    }
    if (state.sourceType === 'Paste URL' && !state.mediaUrl) {
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

    const baseName = state.uploadedFileName
      ? state.uploadedFileName.replace(/\.[^/.]+$/, '')
      : 'extracted_audio';
    const outFilename = `${baseName}_${state.startTimeSec}s_${state.durationSec}s.mp3`;

    // Revoke previous audio clip URL for this module
    if (state.extractedClip?.url) {
      URL.revokeObjectURL(state.extractedClip.url);
    }

    onChange((prev) => ({
      ...prev,
      extractedClip: null,
      isProcessing: true,
    }));

    onRegisterBackgroundTask({
      moduleId: 'audio-extractor',
      title: `Extract MP3: ${outFilename}`,
      estimatedTotalSec: Math.min(20, Math.max(4, state.durationSec * 0.2)),
      execute: async (onProgress, checkCancelled) => {
        try {
          onProgress(20, 'Mounting input media into ephemeral storage...');
          if (checkCancelled()) throw new Error('Cancelled');

          const formData = new FormData();
          if (state.uploadedFileBlob) {
            formData.append('file', state.uploadedFileBlob);
          } else if (state.sourceUrl) {
            formData.append('url', state.sourceUrl);
          }
          formData.append('startTimeSec', state.startTimeSec.toString());
          formData.append('durationSec', state.durationSec.toString());

          onProgress(50, `Running FFmpeg slice (${state.startTimeSec}s to ${state.startTimeSec + state.durationSec}s)...`);
          if (checkCancelled()) throw new Error('Cancelled');

          const response = await fetch('/api/audio-extractor/process', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Audio extraction failed' }));
            throw new Error(err.error || 'Server audio extraction failed');
          }

          onProgress(80, 'Encoding audio slice into 192kbps MP3 payload...');
          if (checkCancelled()) throw new Error('Cancelled');

          const resJson = (await response.json()) as {
            filename: string;
            dataUrl: string;
            durationSec: number;
            sizeBytes: number;
          };

          const finalUrl = resJson.dataUrl;
          const finalSize = resJson.sizeBytes;
          const finalFilename = resJson.filename || outFilename;

          onProgress(100, 'Done. Audio clip ready for download.');

          showToast({
            type: 'success',
            title: 'Audio Extracted',
            message: `${finalFilename} has been extracted.`,
            duration: 8000,
          });

          onRecordCost(
            'audio-extractor',
            `Audio Extract (${state.durationSec}s)`,
            state.durationSec,
            0,
            0,
            `At ${state.startTimeSec}s from ${baseName}`
          );

          onChange((prev) => ({
            ...prev,
            extractedClip: {
              filename: finalFilename,
              url: finalUrl,
              size: finalSize,
              duration: state.durationSec,
            },
            isProcessing: false,
          }));

          return {
            filename: finalFilename,
            dataUrl: finalUrl,
            durationSec: state.durationSec,
          };
        } catch (err: unknown) {
          onChange((prev) => ({ ...prev, isProcessing: false }));
          const msg = (err as Error)?.message || 'Audio extraction failed';
          showToast({
            type: 'error',
            title: 'Audio Extraction Failed',
            message: msg,
            duration: 15000,
          });
          throw err;
        }
      },
    });
  };

  return (
    <div id="audio-extractor-module" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
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
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Audio Extractor Tool</h3>
            <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Extract high-bitrate MP3 audio clips with slider timeline scrubbing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs font-mono">
          <div
            id="pill-extractor-key-status"
            title="No API key is required for this module (runs via FFmpeg)."
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono select-none ${
              isDarkMode
                ? 'bg-[#222222] border-[#333333] text-[#888888]'
                : 'bg-[#f8f8f8] border-[#e0e0e0] text-[#666666]'
            }`}
          >
            <Key className="w-3.5 h-3.5 opacity-60" />
            <span className={isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}>Key:</span>
            <span className="font-semibold">not required</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-mono ${
              isDarkMode
                ? 'bg-[#222222] border-[#333333] text-[#f3e79a]'
                : 'bg-[#f8f8f8] border-[#e0e0e0] text-[#854d0e] font-semibold'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>${moduleTotal.costUSD.toFixed(4)}</span>
            <span className={isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}>({moduleTotal.runs} clips)</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs */}
        <div
          className={`lg:col-span-5 p-5 rounded border space-y-4 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="border-b border-inherit pb-2">
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Source Media & Clip Timeline
            </h4>
          </div>

          {/* Source Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Source Selection:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, sourceType: 'Upload File' }))}
                className={`py-2 px-3 rounded text-xs font-medium border transition-all ${
                  state.sourceType === 'Upload File'
                    ? isDarkMode
                      ? 'bg-[#262626] border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#fef9c3] border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-neutral-400 hover:text-neutral-200'
                    : 'bg-[#f4f4f5] border-neutral-200 text-neutral-600'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, sourceType: 'Paste URL' }))}
                className={`py-2 px-3 rounded text-xs font-medium border transition-all ${
                  state.sourceType === 'Paste URL'
                    ? isDarkMode
                      ? 'bg-[#262626] border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-[#fef9c3] border-[#ffd600] text-neutral-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-neutral-400 hover:text-neutral-200'
                    : 'bg-[#f4f4f5] border-neutral-200 text-neutral-600'
                }`}
              >
                Paste URL
              </button>
            </div>
          </div>

          {/* Source Input */}
          {state.sourceType === 'Upload File' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Video/Audio File:</label>
              <div
                className={`border border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'border-[#383838] hover:border-[#f3e79a] bg-[#121212]'
                    : 'border-[#d4d4d8] hover:border-[#ffd600] bg-[#fafafa]'
                }`}
                onClick={() => document.getElementById('extractor-file-input')?.click()}
              >
                <input
                  id="extractor-file-input"
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
                  MP4, MOV, MKV, AVI, MP3, WAV, AAC
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Paste Media URL:</label>
              <input
                type="text"
                placeholder="https://example.com/video"
                value={state.mediaUrl}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, mediaUrl: e.target.value }))
                }
                className={`w-full px-3 py-2 rounded border text-xs focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
            </div>
          )}

          {/* Slider for start time */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">Start Time:</span>
              <span className={`font-mono font-semibold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                {state.startTimeSec}s
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={videoDuration}
              step="1"
              value={state.startTimeSec}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, startTimeSec: parseInt(e.target.value, 10) || 0 }))
              }
              className={`w-full ${isDarkMode ? 'accent-[#f3e79a]' : 'accent-[#ffd600]'}`}
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium">Duration:</span>
              <span className={`font-mono font-semibold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                {state.durationSec}s
              </span>
            </div>
            <input
              type="number"
              min="1"
              max={videoDuration - state.startTimeSec || 180}
              value={state.durationSec}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  durationSec: Math.max(1, parseInt(e.target.value, 10) || 30),
                }))
              }
              className={`w-full px-3 py-2 text-xs rounded border focus:outline-none font-mono ${
                isDarkMode
                  ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                  : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
              }`}
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 text-xs rounded border border-neutral-700 bg-neutral-900/60 text-xs">
              <span className={isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]'}>{errorMsg}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleExtractAudio}
            disabled={state.isProcessing}
            id="btn-extract-audio-clip"
            className={`w-full py-2.5 px-4 rounded font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 ${
              isDarkMode
                ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{state.isProcessing ? 'Extracting in Background…' : 'Extract Audio'}</span>
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
                Extracted MP3 Output
              </h4>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                In-memory buffer retained until new task started.
              </p>
            </div>

            {state.extractedClip && (
              <a
                href={state.extractedClip.url}
                download={state.extractedClip.filename}
                id="btn-download-extracted-mp3"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded font-semibold text-sm shadow-xs transition-colors ${
                  isDarkMode
                    ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                    : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Download MP3</span>
              </a>
            )}
          </div>

          {state.extractedClip ? (
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
                      {state.extractedClip.filename}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                      Duration: {state.extractedClip.duration}s • Ready for download
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`p-6 rounded border flex flex-col items-center justify-center space-y-4 ${
                  isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'
                }`}
              >
                <Music className={`w-12 h-12 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                <p className="text-sm font-medium">Audio Clip Preview</p>
                <audio
                  src={state.extractedClip.url}
                  controls
                  className={`w-full max-w-md ${isDarkMode ? 'accent-[#f3e79a]' : 'accent-[#ffd600]'}`}
                />
              </div>
            </div>
          ) : (
            <div className={`h-64 flex flex-col items-center justify-center text-center text-sm ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              <Music className="w-10 h-10 mb-2.5 opacity-30" />
              <p className="font-semibold text-base">No audio segment extracted yet</p>
              <p className="text-xs mt-1 max-w-sm">
                Select your source and time range, then click 'Extract Audio'.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
