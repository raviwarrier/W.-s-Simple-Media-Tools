import React, { useState } from 'react';
import {
  AudiobookTranscriberState,
  SecretStore,
  CostTrackerState,
  ModuleId,
} from '../../types';
import { useToast } from '../../context/ToastContext';
import {
  BookOpen,
  Download,
  Copy,
  Check,
  Play,
  FileAudio,
  Tag,
  Clock,
  CheckCircle2,
  FileText,
  Key,
  FolderOpen,
  Upload,
  Info,
} from 'lucide-react';

export function parseAudiobookTranscriptAndMeta(
  rawText: string,
  fallbackModel: string,
  fallbackBook: string,
  fallbackAuthor: string,
  fallbackTimestamp: string,
  fallbackDuration: number
): {
  cleanText: string;
  meta: { model: string; book: string; author: string; timestamp: string; duration: number };
} {
  if (!rawText) {
    return {
      cleanText: '',
      meta: {
        model: fallbackModel,
        book: fallbackBook,
        author: fallbackAuthor,
        timestamp: fallbackTimestamp,
        duration: fallbackDuration,
      },
    };
  }

  const lines = rawText.split('\n');
  let book = fallbackBook;
  let author = fallbackAuthor;
  let timestamp = fallbackTimestamp;
  let model = fallbackModel;
  let duration = fallbackDuration;
  let headerLineCount = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (/^Book:\s*/i.test(line) || /^Title:\s*/i.test(line)) {
      book = line.replace(/^(?:Book|Title):\s*/i, '').trim();
      headerLineCount = i + 1;
    } else if (/^Author:\s*/i.test(line)) {
      author = line.replace(/^Author:\s*/i, '').trim();
      headerLineCount = i + 1;
    } else if (/^Timestamp:\s*/i.test(line) || /^Timestamp Range:\s*/i.test(line)) {
      timestamp = line.replace(/^Timestamp(?:\s*Range)?:\s*/i, '').trim();
      headerLineCount = i + 1;
    } else if (/^Whisper Model:\s*/i.test(line) || /^Model:\s*/i.test(line)) {
      model = line.replace(/^(?:Whisper\s*)?Model:\s*/i, '').trim();
      headerLineCount = i + 1;
    } else if (line.startsWith('--- TRANSCRIPT ---') || line === '') {
      headerLineCount = i + 1;
    } else if (headerLineCount > 0) {
      break;
    }
  }

  let cleanText = rawText;
  if (headerLineCount > 0) {
    cleanText = lines.slice(headerLineCount).join('\n').trim();
  }

  return {
    cleanText,
    meta: {
      model: model || fallbackModel,
      book: book || fallbackBook,
      author: author || fallbackAuthor,
      timestamp: timestamp || fallbackTimestamp,
      duration: duration || fallbackDuration,
    },
  };
}

interface AudiobookTranscriberModuleProps {
  state: AudiobookTranscriberState;
  onChange: (updater: (prev: AudiobookTranscriberState) => AudiobookTranscriberState) => void;
  secretStore: SecretStore;
  costTracker: CostTrackerState;
  onRecordCost: (
    module: 'audiobook-transcriber',
    operation: string,
    durationSec: number,
    inputTokens?: number,
    outputTokens?: number,
    details?: string
  ) => void;
  onRegisterBackgroundTask: (task: {
    moduleId: 'audiobook-transcriber';
    title: string;
    estimatedTotalSec: number;
    execute: (
      onProgress: (p: number, msg: string) => void,
      checkCancelled: () => boolean
    ) => Promise<{
      transcript: string;
      filename: string;
      dataUrl: string;
      durationSec: number;
    }>;
  }) => void;
  onNavigateToSettings?: (module: ModuleId) => void;
  isDarkMode: boolean;
}

export const AudiobookTranscriberModule: React.FC<AudiobookTranscriberModuleProps> = ({
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
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedMeta, setCopiedMeta] = useState(false);

  const activeKey =
    secretStore.keyMode === 'unified'
      ? secretStore.unifiedOpenAiKey?.trim()
      : secretStore.moduleOpenAiKeys.audiobookTranscriber?.trim();

  const fallbackStartLabel = `${state.hours.toString().padStart(2, '0')}:${state.minutes.toString().padStart(2, '0')}:${state.seconds.toString().padStart(2, '0')}`;
  const fallbackModel = `Whisper (${state.modelSize})`;
  const fallbackBook = state.detectedBook || 'Unknown Book';
  const fallbackAuthor = state.detectedAuthor || 'Unknown Author';

  const { cleanText, meta } = parseAudiobookTranscriptAndMeta(
    state.transcript,
    state.transcriptMeta?.model || fallbackModel,
    state.transcriptMeta?.book || fallbackBook,
    state.transcriptMeta?.author || fallbackAuthor,
    state.transcriptMeta?.timestamp || `${fallbackStartLabel} (+${state.duration}s)`,
    state.transcriptMeta?.duration || state.duration
  );

  const handleCopyTranscript = () => {
    if (!cleanText) return;
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    showToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: 'Audiobook transcript copied successfully (without metadata).',
      duration: 5000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyMeta = () => {
    if (!meta) return;
    const metaLines = [
      `Book: ${meta.book}`,
      `Author: ${meta.author}`,
      `Model: ${meta.model}`,
      `Timestamp: ${meta.timestamp}`,
      `Duration: ${meta.duration}s`,
    ];

    navigator.clipboard.writeText(metaLines.join('\n'));
    setCopiedMeta(true);
    showToast({
      type: 'info',
      title: 'Metadata Copied',
      message: 'Audiobook snippet metadata copied to clipboard.',
      duration: 4000,
    });
    setTimeout(() => setCopiedMeta(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Infer title & author from filename as fallback
    const rawName = file.name.replace(/\.[^/.]+$/, '');
    let book = rawName;
    let author = '';
    if (rawName.includes('-')) {
      const parts = rawName.split('-');
      book = parts[0].trim();
      author = parts[1].trim();
    }

    onChange((prev) => ({
      ...prev,
      sourceMode: 'upload',
      uploadedFileName: file.name,
      uploadedFileBlob: file,
      detectedBook: prev.detectedBook || book,
      detectedAuthor: prev.detectedAuthor || author,
    }));
  };

  const handleTranscribeSnippet = () => {
    setErrorMsg('');
    const hasFile = !!(state.uploadedFileBlob || state.uploadedFileName);
    const hasPath = !!(state.filePath && state.filePath.trim());

    if (state.sourceMode === 'path' && !hasPath) {
      const msg = 'Please enter a valid server or local file path (e.g. /srv/ssd/Bookshelf/Audiobooks/book/book.m4b or B:\\audiobooks\\book\\book.m4b).';
      setErrorMsg(msg);
      showToast({
        type: 'warning',
        title: 'Missing File Path',
        message: msg,
        duration: 15000,
      });
      return;
    }

    if (!hasFile && !hasPath) {
      const msg = 'Please upload an audiobook file (.m4b, .mp3, .m4a, .ogg) or specify a server file path.';
      setErrorMsg(msg);
      showToast({
        type: 'warning',
        title: 'No Audiobook Specified',
        message: msg,
        duration: 15000,
      });
      return;
    }

    if (!activeKey) {
      const msg = 'OpenAI API key is not set. Audiobook Whisper transcription requires an OpenAI API key (sk-...). Please configure your key in Encrypted Secrets.';
      setErrorMsg(msg);
      showToast({
        type: 'warning',
        title: 'OpenAI API Key Missing',
        message: msg,
        duration: 15000,
      });
      return;
    }

    const startSeconds = state.hours * 3600 + state.minutes * 60 + state.seconds;
    const startLabel = `${state.hours.toString().padStart(2, '0')}h${state.minutes
      .toString()
      .padStart(2, '0')}m${state.seconds.toString().padStart(2, '0')}s`;

    const cleanBook = (state.detectedBook.trim() || 'Audiobook').replace(/[/\\:*?"<>|]/g, '-');
    const cleanAuthor = (state.detectedAuthor.trim() || 'Author').replace(/[/\\:*?"<>|]/g, '-');
    const targetFilename = `${cleanBook} - ${cleanAuthor} - ${startLabel}-${state.duration}s.txt`;

    // Revoke previous downloadReady URL for this module
    if (state.downloadReady?.url) {
      URL.revokeObjectURL(state.downloadReady.url);
    }

    onChange((prev) => ({
      ...prev,
      downloadReady: null,
      transcript: '',
      isProcessing: true,
    }));

    onRegisterBackgroundTask({
      moduleId: 'audiobook-transcriber',
      title: `Audiobook: ${cleanBook} (${startLabel})`,
      estimatedTotalSec: Math.min(30, Math.max(5, state.duration * 0.3)),
      execute: async (onProgress, checkCancelled) => {
        try {
          onProgress(15, 'Extracting audio snippet with FFmpeg pcm_s16le 16kHz...');
          if (checkCancelled()) throw new Error('Cancelled');

          const formData = new FormData();
          if (state.sourceMode === 'path' || (!state.uploadedFileBlob && state.filePath.trim())) {
            formData.append('filePath', state.filePath.trim());
          } else if (state.uploadedFileBlob) {
            formData.append('file', state.uploadedFileBlob);
          }
          if (state.detectedBook.trim()) {
            formData.append('book', state.detectedBook.trim());
          }
          if (state.detectedAuthor.trim()) {
            formData.append('author', state.detectedAuthor.trim());
          }
          formData.append('hours', state.hours.toString());
          formData.append('minutes', state.minutes.toString());
          formData.append('seconds', state.seconds.toString());
          formData.append('duration', state.duration.toString());
          formData.append('modelSize', state.modelSize);
          if (activeKey) {
            formData.append('openaiApiKey', activeKey);
          }

          onProgress(45, 'Querying FFprobe metadata tags and sending snippet to AI transcriber...');
          if (checkCancelled()) throw new Error('Cancelled');

          const response = await fetch('/api/audiobook/process', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Audiobook transcription failed' }));
            throw new Error(err.error || 'Server audiobook transcription failed');
          }

          onProgress(85, 'Finalizing snippet transcription and formatting...');
          if (checkCancelled()) throw new Error('Cancelled');

          const resData = (await response.json()) as {
            book: string;
            author: string;
            timestamp: string;
            duration: number;
            transcript: string;
            filename: string;
            audioDataUrl: string;
          };

          const finalBook = resData.book || cleanBook;
          const finalAuthor = resData.author || cleanAuthor;
          const finalFilename = resData.filename || targetFilename;

          const parsed = parseAudiobookTranscriptAndMeta(
            resData.transcript,
            `Whisper (${state.modelSize})`,
            finalBook,
            finalAuthor,
            `${startLabel} (+${state.duration}s)`,
            state.duration
          );

          const cleanTranscript = parsed.cleanText;

          const transcriptDownloadContent =
            `Book: ${finalBook}\nAuthor: ${finalAuthor}\nTimestamp: ${startLabel} (+${state.duration}s)\n` +
            `Whisper Model: ${state.modelSize}\n` +
            `\n--- TRANSCRIPT ---\n` +
            cleanTranscript;

          const blob = new Blob([transcriptDownloadContent], { type: 'text/plain;charset=utf-8' });
          const dataUrl = URL.createObjectURL(blob);

          onRecordCost(
            'audiobook-transcriber',
            `Audiobook Snippet (${state.duration}s)`,
            state.duration,
            0,
            0,
            `${finalBook} at ${startLabel}`
          );

          onProgress(100, 'Done. Transcript ready for download.');

          onChange((prev) => ({
            ...prev,
            detectedBook: finalBook,
            detectedAuthor: finalAuthor,
            transcript: cleanTranscript,
            transcriptMeta: parsed.meta,
            downloadReady: {
              filename: finalFilename,
              url: dataUrl,
              size: blob.size,
            },
            isProcessing: false,
          }));

          return {
            transcript: cleanTranscript,
            filename: finalFilename,
            dataUrl,
            durationSec: state.duration,
          };
        } catch (err: unknown) {
          onChange((prev) => ({ ...prev, isProcessing: false }));
          throw err;
        }
      },
    });
  };

  return (
    <div id="audiobook-transcriber-module" className="p-6 max-w-7xl mx-auto space-y-6">
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
              Audiobook Source & Snippet Range
            </h4>
          </div>

          {/* Source Mode Switcher */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Source Mode:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, sourceMode: 'upload' }))}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-medium border transition-colors ${
                  (state.sourceMode || 'upload') === 'upload'
                    ? isDarkMode
                      ? 'bg-[#222222] border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-amber-50 border-amber-400 text-amber-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-neutral-400 hover:text-white'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload from Browser</span>
              </button>

              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, sourceMode: 'path' }))}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-medium border transition-colors ${
                  state.sourceMode === 'path'
                    ? isDarkMode
                      ? 'bg-[#222222] border-[#f3e79a] text-[#f3e79a]'
                      : 'bg-amber-50 border-amber-400 text-amber-900 font-semibold'
                    : isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-neutral-400 hover:text-white'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Server / Local Path</span>
              </button>
            </div>
          </div>

          {/* Upload File View */}
          {(state.sourceMode || 'upload') === 'upload' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Audiobook File (mp3, m4a, m4b, ogg):</label>
              <div
                className={`border border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'border-[#383838] hover:border-[#f3e79a] bg-[#121212]'
                    : 'border-[#d4d4d8] hover:border-[#ffd600] bg-[#fafafa]'
                }`}
                onClick={() => document.getElementById('audiobook-upload-input')?.click()}
              >
                <input
                  id="audiobook-upload-input"
                  type="file"
                  accept=".mp3,.m4a,.m4b,.ogg,audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <FileAudio className={`w-6 h-6 mx-auto mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
                <p className="text-xs font-medium">
                  {state.uploadedFileName ? (
                    <span className={isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}>
                      {state.uploadedFileName}
                    </span>
                  ) : (
                    'Click to upload audiobook file'
                  )}
                </p>
                <p className={`text-xs mt-0.5 font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
                  Supports M4B, MP3, M4A, OGG
                </p>
              </div>
            </div>
          ) : (
            /* Server Path View (Linux & Windows) */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Audiobook Server Path (Linux or Windows):</label>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-[#222222] text-[#888888]' : 'bg-neutral-100 text-neutral-600'}`}>
                  Direct Disk Access
                </span>
              </div>
              <input
                type="text"
                id="input-audiobook-path"
                value={state.filePath || ''}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    filePath: e.target.value,
                  }))
                }
                placeholder="b:\audiobooks\book\book.m4b or /srv/ssd/Bookshelf/Audiobooks/book/book.m4b"
                className={`w-full px-3 py-2 text-xs font-mono rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
              <p className={`text-[11px] ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                Allows users of CLI-based Linux systems, headless servers, or local NAS to access audiobooks directly from disk without upload overhead.
              </p>
            </div>
          )}

          {/* Metadata Fields (editable, optional) */}
          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Tag className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
                  <span>Book Title:</span>
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'text-[#888888] bg-[#222222]' : 'text-[#666666] bg-neutral-100'}`}>
                  Optional
                </span>
              </label>
              <input
                type="text"
                value={state.detectedBook}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, detectedBook: e.target.value }))
                }
                placeholder="Auto-detected from ID3 tags if empty"
                className={`w-full px-3 py-2 text-xs rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Tag className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
                  <span>Author / Artist:</span>
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'text-[#888888] bg-[#222222]' : 'text-[#666666] bg-neutral-100'}`}>
                  Optional
                </span>
              </label>
              <input
                type="text"
                value={state.detectedAuthor}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, detectedAuthor: e.target.value }))
                }
                placeholder="Auto-detected from ID3 tags if empty"
                className={`w-full px-3 py-2 text-xs rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
            </div>
          </div>

          {/* Snippet Range Columns (Hours, Minutes, Seconds) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-medium flex items-center gap-1">
              <Clock className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
              <span>Start Time:</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={`text-xs font-mono block mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Hours</label>
                <input
                  type="number"
                  min="0"
                  value={state.hours}
                  onChange={(e) =>
                    onChange((prev) => ({ ...prev, hours: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                  }
                  className={`w-full px-3 py-2 text-xs rounded border focus:outline-none font-mono ${
                    isDarkMode
                      ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                      : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                  }`}
                />
              </div>
              <div>
                <label className={`text-xs font-mono block mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={state.minutes}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      minutes: Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)),
                    }))
                  }
                  className={`w-full px-3 py-2 text-xs rounded border focus:outline-none font-mono ${
                    isDarkMode
                      ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                      : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                  }`}
                />
              </div>
              <div>
                <label className={`text-xs font-mono block mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Seconds</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={state.seconds}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      seconds: Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)),
                    }))
                  }
                  className={`w-full px-3 py-2 text-xs rounded border focus:outline-none font-mono ${
                    isDarkMode
                      ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                      : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Duration & Model */}
          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Duration (seconds):</label>
              <input
                type="number"
                min="5"
                max="600"
                value={state.duration}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    duration: Math.max(5, parseInt(e.target.value, 10) || 60),
                  }))
                }
                className={`w-full px-3 py-2 text-xs rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Whisper Model:</label>
              <select
                value={state.modelSize}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    modelSize: e.target.value as AudiobookTranscriberState['modelSize'],
                  }))
                }
                className={`w-full px-3 py-2 text-xs rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
                }`}
              >
                <option value="tiny">tiny</option>
                <option value="base">base (standard)</option>
                <option value="small">small</option>
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 text-xs rounded border border-rose-800 bg-rose-950/40 text-rose-200">
              <span className="block font-medium">{errorMsg}</span>
              {(errorMsg.toLowerCase().includes('key') || errorMsg.includes('Secrets')) && onNavigateToSettings && (
                <button
                  type="button"
                  onClick={() => onNavigateToSettings('secrets-settings')}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-mono font-medium text-xs border border-rose-400 bg-rose-200/80 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-900 dark:border-rose-700 text-rose-950 dark:text-rose-100 cursor-pointer transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Open Encrypted Secrets & Enter API Key →</span>
                </button>
              )}
            </div>
          )}

          {/* Action */}
          <button
            onClick={handleTranscribeSnippet}
            disabled={state.isProcessing}
            id="btn-transcribe-audiobook"
            className={`w-full py-2.5 px-4 rounded font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 ${
              isDarkMode
                ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{state.isProcessing ? 'Transcribing in Background…' : 'Transcribe Snippet'}</span>
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
                Audiobook Transcript Output
              </h4>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                Standard format: "Book Title - Author - starttime-duration.txt"
              </p>
            </div>

            <div className="flex items-center gap-2">
              {state.transcript && (
                <button
                  type="button"
                  onClick={handleCopyTranscript}
                  id="btn-copy-audiobook-transcript"
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
                  id="btn-download-audiobook-transcript"
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

          {cleanText ? (
            <div className="space-y-3 flex-1 flex flex-col">
              <div
                className={`p-3.5 rounded border flex items-center justify-between ${
                  isDarkMode ? 'border-[#333333] bg-[#121212]' : 'border-[#e0e0e0] bg-[#fafafa]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-5 h-5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                  <div>
                    <p className={`text-sm font-semibold font-mono ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                      {state.downloadReady?.filename}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                      Snippet extracted & transcribed • Zero-retention memory cache
                    </p>
                  </div>
                </div>
              </div>

              {/* Metadata Section - Outside transcripted text textbox */}
              {meta && (
                <div
                  id="section-audiobook-metadata"
                  className={`p-3.5 rounded border transition-colors ${
                    isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-inherit pb-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Info className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                      <h5 className="text-xs font-semibold uppercase tracking-wider">
                        Metadata Information
                      </h5>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyMeta}
                      id="btn-copy-audiobook-meta"
                      title="Copy metadata information to clipboard"
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
                      <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Model:</span>
                      <span className="font-semibold font-mono text-xs">{meta.model}</span>
                    </div>
                    <div>
                      <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Timestamp:</span>
                      <span className="font-semibold font-mono text-xs">{meta.timestamp}</span>
                    </div>
                    <div className="truncate">
                      <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Book:</span>
                      <span className="font-semibold font-mono text-xs truncate block" title={meta.book}>{meta.book}</span>
                    </div>
                    <div className="truncate">
                      <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Author:</span>
                      <span className="font-semibold font-mono text-xs truncate block" title={meta.author}>{meta.author}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Transcript Area - ONLY clean transcribed text */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <label className="flex items-center gap-1.5">
                    <FileText className={`w-4 h-4 ${isDarkMode ? 'text-[#888888]' : 'text-[#777777]'}`} />
                    <span>Transcription Output:</span>
                  </label>
                  {cleanText && (
                    <span className={`font-mono text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                      {cleanText.split('\n').length} lines
                    </span>
                  )}
                </div>
                <textarea
                  readOnly
                  rows={14}
                  id="textarea-audiobook-transcription-output"
                  value={cleanText}
                  className={`w-full p-3.5 font-mono text-sm leading-relaxed rounded border resize-none focus:outline-none ${
                    isDarkMode
                      ? 'bg-[#121212] border-[#2c2c2c] text-neutral-200 focus:border-[#f3e79a]'
                      : 'bg-[#fafafa] border-[#e0e0e0] text-neutral-800 focus:border-[#ffd600]'
                  }`}
                />
              </div>
            </div>
          ) : (
            <div className={`h-64 flex flex-col items-center justify-center text-center text-sm ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              <BookOpen className="w-10 h-10 mb-2.5 opacity-30" />
              <p className="font-semibold text-base">No audiobook snippet transcribed yet</p>
              <p className="text-xs mt-1 max-w-sm">
                Upload an audiobook, select a starting hour/minute/second, and click 'Transcribe Snippet'.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
