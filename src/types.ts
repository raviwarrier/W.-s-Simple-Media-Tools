export type ModuleId =
  | 'video-transcriber'
  | 'media-clipper'
  | 'audiobook-transcriber'
  | 'audible-fetcher'
  | 'video-downloader'
  | 'audio-extractor'
  | 'secrets-settings'
  | 'cost-analytics'
  | 'code-environment';

export type KeyMode = 'unified' | 'per-module';

export interface SecretStore {
  keyMode: KeyMode;
  unifiedOpenAiKey: string;
  moduleOpenAiKeys: {
    videoTranscriber: string;
    audiobookTranscriber: string;
    audioExtractor?: string;
  };
  customTokens: Record<string, string>;
  isLocked: boolean;
  masterPasswordHash?: string;
  salt?: string;
  encryptedBlob?: string;
  lastUpdated?: number;
}

export interface CostRecord {
  moduleId: ModuleId;
  operationName: string;
  timestamp: number;
  durationSec: number;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  details: string;
}

export interface CostTrackerState {
  budgetLimitUSD: number;
  records: CostRecord[];
  moduleTotals: Record<ModuleId, { costUSD: number; runs: number; totalSeconds: number }>;
}

export type TaskStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface BackgroundTask {
  id: string;
  moduleId: ModuleId;
  title: string;
  status: TaskStatus;
  progress: number; // 0 to 100
  startTime: number;
  estimatedTotalSec: number;
  message: string;
  outputDownload?: {
    filename: string;
    dataUrl: string;
    blobSize: number;
    mimeType: string;
    previewText?: string;
    summaryText?: string;
  };
  costUSD: number;
}

export interface TranscriptionMeta {
  model: string;
  format: string;
  title?: string;
  duration?: string | number;
  wordCount?: number;
  lineCount?: number;
}

export interface AudiobookTranscriptMeta {
  model: string;
  book: string;
  author: string;
  timestamp: string;
  duration: number;
  wordCount?: number;
}

// Module 1 State
export interface VideoTranscriberState {
  videoUrl: string;
  urlValidationStatus: string;
  uploadedFileName: string | null;
  uploadedFileBlob: Blob | null;
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  temperature: number;
  beamSize: number;
  chunkDuration: number;
  omitTimestamps?: boolean;
  deleteAudioAfter: boolean;
  operationMode: 'Transcribe' | 'Transcribe & Summarize';
  finalTranscription: string;
  finalSummary: string;
  transcriptionMeta?: TranscriptionMeta | null;
  downloadReady: { filename: string; url: string; size: number } | null;
  isProcessing: boolean;
}

// Module 2 State
export interface MediaClipperState {
  sourceMode: 'Upload file' | 'URL' | 'Server Path';
  mediaUrl: string;
  filePath?: string;
  uploadedFileName: string | null;
  uploadedFileBlob: Blob | null;
  startTimeStr: string; // hh:mm:ss
  endTimeStr: string;   // hh:mm:ss
  extractChoice: 'Audio' | 'Video';
  clipResult: {
    filename: string;
    url: string;
    size: number;
    duration: number;
    mode: 'Audio' | 'Video';
    downloadUrl?: string;
    streamUrl?: string;
  } | null;
  isProcessing: boolean;
}

// Module 3 State
export interface AudiobookTranscriberState {
  sourceMode: 'upload' | 'path';
  filePath: string;
  uploadedFileName: string | null;
  uploadedFileBlob: Blob | null;
  hours: number;
  minutes: number;
  seconds: number;
  duration: number;
  modelSize: 'tiny' | 'base' | 'small';
  detectedBook: string;
  detectedAuthor: string;
  transcript: string;
  transcriptMeta?: AudiobookTranscriptMeta | null;
  downloadReady: { filename: string; url: string; size: number } | null;
  isProcessing: boolean;
}

// Module 4 State
export interface AudioExtractorState {
  sourceType: 'Upload File' | 'Paste URL';
  mediaUrl: string;
  uploadedFileName: string | null;
  uploadedFileBlob: Blob | null;
  startTimeSec: number;
  durationSec: number;
  extractedClip: {
    filename: string;
    url: string;
    size: number;
    duration: number;
  } | null;
  isProcessing: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

// Module: Audible Fetcher State
export interface AudibleBookResult {
  title: string;
  subtitle: string | null;
  author: string | null;
  narrator: string | null;
  publisher: string | null;
  publishedYear: string | null;
  description: string | null;
  cover: string | null;
  asin: string | null;
  isbn: string | null;
  genres: string[] | null;
  tags: string[] | null;
  series: Array<{ series: string; sequence: string }> | null;
  language: string | null;
  duration: number; // in minutes
  region: string | null;
  rating: number | null;
  abridged: boolean;
}

export interface AudibleFetcherState {
  title: string;
  author: string;
  region: string;
  timeout: number;
  results: AudibleBookResult[];
  selectedBook: AudibleBookResult | null;
  isSearching: boolean;
  hasSearched: boolean;
  errorMessage: string | null;
}

// Module 5: Video Downloader State & Types
export type VideoDownloaderQuality =
  | 'best'
  | '2160p'
  | '1440p'
  | '1080p'
  | '720p'
  | '480p'
  | '360p'
  | 'audio-best'
  | 'audio-mp3'
  | 'audio-m4a'
  | 'audio-wav'
  | 'audio-flac';

export type VideoDownloaderCookieMode = 'browser' | 'file';

export type SupportedBrowser =
  | 'chrome'
  | 'firefox'
  | 'edge'
  | 'brave'
  | 'opera'
  | 'vivaldi'
  | 'chromium'
  | 'safari';

export interface VideoMetadataInfo {
  id: string;
  title: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  durationString?: string;
  thumbnail?: string;
  viewCount?: number;
  uploadDate?: string;
  description?: string;
  webpageUrl: string;
  availableResolutions: string[];
  formatsSummary?: {
    videoOptions: Array<{ formatId: string; resolution: string; ext: string; note: string; filesizeApprox?: string }>;
    audioOptions: Array<{ formatId: string; ext: string; note: string; filesizeApprox?: string }>;
  };
  extractor?: string;
  estimatedSize?: string;
  isLive?: boolean;
}

export interface DownloadQueueItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  quality: VideoDownloaderQuality;
  format: 'mp4' | 'mkv' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'flac';
  status: 'queued' | 'inspecting' | 'downloading' | 'merging' | 'completed' | 'error' | 'cancelled';
  progress: number; // 0 - 100
  downloadSpeed?: string; // e.g. "5.4 MB/s"
  eta?: string; // e.g. "00:12"
  downloadedSizeStr?: string;
  totalSizeStr?: string;
  currentStage: string;
  filename?: string;
  downloadUrl?: string;
  localFilePath?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
  logs: string[];
  commandPreview?: string;
  startedAt: number;
  completedAt?: number;
}

export interface VideoDownloaderState {
  // Mode selection: Default/simple vs Advanced
  uiMode: 'simple' | 'advanced';

  urlsInput: string;
  preset: 'best' | '1080p' | '720p' | 'audio-mp3' | 'custom';
  selectedQuality: VideoDownloaderQuality;
  outputFormat: 'mp4' | 'mkv' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'flac';
  outputDirectory: string;
  namingScheme: string;
  embedSubtitles: boolean;
  embedThumbnail: boolean;
  embedMetadata: boolean;

  // Authentication & Cookies Accordion (Advanced mode only; cookies disabled by default)
  authExpanded: boolean;
  enableCookieAuth: boolean;
  cookieMode: VideoDownloaderCookieMode;
  selectedBrowser: SupportedBrowser;
  browserProfile: string;
  firefoxContainer: string;
  cookieFilePath: string;
  cookieFileContent: string;
  cookieFileName: string | null;

  // Inspected Metadata Cache
  inspectedMetadata: VideoMetadataInfo | null;
  isInspecting: boolean;
  inspectError: string | null;

  // Queue & Progress
  queue: DownloadQueueItem[];
  activeDownloadId: string | null;
  showLogs: boolean;
  rawTerminalLogs: string[];

  // Automated browser download & ephemeral server file lifecycle
  autoDownloadToPC: boolean;
  autoCleanServerOnClose: boolean;

  // Engine status
  ytdlpVersion: string;
  ffmpegVersion: string;
  isCheckingUpdate: boolean;
  updateStatus: string | null;
}
