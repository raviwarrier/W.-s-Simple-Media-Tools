export type ModuleId =
  | 'video-transcriber'
  | 'media-clipper'
  | 'audiobook-transcriber'
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
