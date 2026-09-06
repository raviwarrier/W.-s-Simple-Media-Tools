import React, { useState, useEffect, useRef } from 'react';
import {
  ModuleId,
  SecretStore,
  CostTrackerState,
  BackgroundTask,
  VideoTranscriberState,
  MediaClipperState,
  AudiobookTranscriberState,
} from './types';
import {
  getInitialSecretStore,
  loadEncryptedVault,
  tryDecryptPayload,
  KNOWN_PASSPHRASES,
} from './utils/crypto';
import { getInitialCostState, addCostRecord } from './utils/costEstimator';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { ZeroRetentionBanner } from './components/ZeroRetentionBanner';
import { TaskDrawer } from './components/TaskDrawer';
import { VideoTranscriberModule } from './components/modules/VideoTranscriberModule';
import { MediaClipperModule } from './components/modules/MediaClipperModule';
import { AudiobookTranscriberModule } from './components/modules/AudiobookTranscriberModule';
import { SecretsSettingsModule } from './components/modules/SecretsSettingsModule';
import { CostAnalyticsModule } from './components/modules/CostAnalyticsModule';
import { CodeEnvironmentModule } from './components/modules/CodeEnvironmentModule';

export default function App() {
  // Navigation & Theme (Dark mode is default as explicitly requested)
  const [currentModule, setCurrentModule] = useState<ModuleId>('video-transcriber');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState<boolean>(false);

  // Encrypted Secret Store & Key Management
  const [secretStore, setSecretStore] = useState<SecretStore>(getInitialSecretStore);

  // Real-Time Usage Costs & Budget Monitor
  const [costTracker, setCostTracker] = useState<CostTrackerState>(getInitialCostState);

  // Background Task Engine
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const cancelledTasksRef = useRef<Set<string>>(new Set());

  // Restore Encrypted Secrets Vault on App Load / Refresh (AES-256-GCM)
  useEffect(() => {
    async function restoreVault() {
      try {
        const localVault = await loadEncryptedVault();
        if (
          localVault &&
          (localVault.unifiedOpenAiKey ||
            localVault.moduleOpenAiKeys.videoTranscriber ||
            localVault.moduleOpenAiKeys.audiobookTranscriber)
        ) {
          setSecretStore(localVault);
          return;
        }

        // Check if server-persisted encrypted vault backup exists
        const res = await fetch('/api/vault');
        if (res.ok) {
          const json = await res.json();
          if (json.encryptedPayload && typeof json.encryptedPayload === 'string') {
            for (const pass of KNOWN_PASSPHRASES) {
              const serverVault = await tryDecryptPayload(json.encryptedPayload, pass);
              if (serverVault) {
                try {
                  localStorage.setItem('vault_payload_enc_v1', json.encryptedPayload);
                } catch {}
                setSecretStore(serverVault);
                break;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not auto-restore encrypted vault on mount:', err);
      }
    }

    restoreVault();
  }, []);

  // Restore Persistent Cost Tracker JSON on App Load / Refresh
  useEffect(() => {
    async function restoreCostTracker() {
      try {
        const res = await fetch('/api/cost-tracker');
        if (res.ok) {
          const json = await res.json();
          if (json.data && typeof json.data === 'object' && Array.isArray(json.data.records)) {
            // Filter out any legacy sample records
            const cleanRecords = (json.data.records as any[]).filter(
              (r) => r.operationName !== 'Sample Initialization Run'
            );
            const cleanData: CostTrackerState = {
              ...json.data,
              records: cleanRecords,
            };
            setCostTracker(cleanData);
            localStorage.setItem('cost_tracker_v1', JSON.stringify(cleanData));
          }
        }
      } catch (err) {
        console.warn('Could not load server cost-tracker.json:', err);
      }
    }

    restoreCostTracker();
  }, []);

  // Cross-Module Persistent States (strictly preserved across all page transitions)
  const [videoTranscriberState, setVideoTranscriberState] = useState<VideoTranscriberState>({
    videoUrl: '',
    urlValidationStatus: '',
    uploadedFileName: null,
    uploadedFileBlob: null,
    modelSize: 'base',
    temperature: 0.0,
    beamSize: 5,
    chunkDuration: 30,
    deleteAudioAfter: true,
    operationMode: 'Transcribe',
    finalTranscription: '',
    finalSummary: '',
    downloadReady: null,
    isProcessing: false,
  });

  const [mediaClipperState, setMediaClipperState] = useState<MediaClipperState>({
    sourceMode: 'Upload file',
    mediaUrl: '',
    uploadedFileName: null,
    uploadedFileBlob: null,
    startTimeStr: '00:00:05',
    endTimeStr: '00:00:35',
    extractChoice: 'Audio',
    clipResult: null,
    isProcessing: false,
  });

  const [audiobookTranscriberState, setAudiobookTranscriberState] = useState<AudiobookTranscriberState>({
    sourceMode: 'upload',
    filePath: '',
    uploadedFileName: null,
    uploadedFileBlob: null,
    hours: 0,
    minutes: 4,
    seconds: 15,
    duration: 60,
    modelSize: 'base',
    detectedBook: 'Sapiens A Brief History of Humankind',
    detectedAuthor: 'Yuval Noah Harari',
    transcript: '',
    downloadReady: null,
    isProcessing: false,
  });

  // Calculate ephemeral in-memory buffer usage for zero-retention audit
  const calculateMemoryUsage = () => {
    let bytes = 0;
    if (videoTranscriberState.uploadedFileBlob) bytes += videoTranscriberState.uploadedFileBlob.size;
    if (videoTranscriberState.downloadReady) bytes += videoTranscriberState.downloadReady.size;
    if (mediaClipperState.uploadedFileBlob) bytes += mediaClipperState.uploadedFileBlob.size;
    if (mediaClipperState.clipResult) bytes += mediaClipperState.clipResult.size;
    if (audiobookTranscriberState.uploadedFileBlob) bytes += audiobookTranscriberState.uploadedFileBlob.size;
    if (audiobookTranscriberState.downloadReady) bytes += audiobookTranscriberState.downloadReady.size;
    return bytes;
  };

  const [memoryUsageBytes, setMemoryUsageBytes] = useState(0);

  useEffect(() => {
    setMemoryUsageBytes(calculateMemoryUsage());
  }, [
    videoTranscriberState,
    mediaClipperState,
    audiobookTranscriberState,
  ]);

  // Purge all ephemeral memory immediately
  const handlePurgeMemory = () => {
    // Revoke any created object URLs to prevent memory leak
    if (videoTranscriberState.downloadReady?.url) {
      URL.revokeObjectURL(videoTranscriberState.downloadReady.url);
    }
    if (mediaClipperState.clipResult?.url) {
      URL.revokeObjectURL(mediaClipperState.clipResult.url);
    }
    if (audiobookTranscriberState.downloadReady?.url) {
      URL.revokeObjectURL(audiobookTranscriberState.downloadReady.url);
    }

    setVideoTranscriberState((prev) => ({
      ...prev,
      uploadedFileName: null,
      uploadedFileBlob: null,
      downloadReady: null,
    }));
    setMediaClipperState((prev) => ({
      ...prev,
      uploadedFileName: null,
      uploadedFileBlob: null,
      clipResult: null,
    }));
    setAudiobookTranscriberState((prev) => ({
      ...prev,
      uploadedFileName: null,
      uploadedFileBlob: null,
      downloadReady: null,
    }));

    setMemoryUsageBytes(0);
  };

  // Automatically delete all temporary data, inputs, and outputs when browser tab is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      handlePurgeMemory();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    videoTranscriberState.downloadReady?.url,
    mediaClipperState.clipResult?.url,
    audiobookTranscriberState.downloadReady?.url,
  ]);

  // Cost Logging Handler (syncs state, localStorage, and persistent data/cost-tracker.json)
  const handleRecordCost = (
    moduleId: ModuleId,
    operationName: string,
    durationSec: number,
    inputTokens: number = 0,
    outputTokens: number = 0,
    details: string = ''
  ) => {
    setCostTracker((prev) => {
      const updated = addCostRecord(
        prev,
        moduleId,
        operationName,
        durationSec,
        inputTokens,
        outputTokens,
        details
      );
      // Persist to server JSON asynchronously
      fetch('/api/cost-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((e) => console.warn('Failed to sync cost record to server:', e));
      return updated;
    });
  };

  // Register Background Tasks (Runs asynchronously while user navigates!)
  const handleRegisterBackgroundTask = async (taskDef: {
    moduleId: ModuleId;
    title: string;
    estimatedTotalSec: number;
    execute: (
      onProgress: (p: number, msg: string) => void,
      checkCancelled: () => boolean
    ) => Promise<{
      filename: string;
      dataUrl: string;
      durationSec: number;
      transcription?: string;
      summary?: string;
      mode?: 'Audio' | 'Video';
    }>;
  }) => {
    const taskId = 'task_' + Math.random().toString(36).substring(2, 9);
    const newTask: BackgroundTask = {
      id: taskId,
      moduleId: taskDef.moduleId,
      title: taskDef.title,
      status: 'running',
      progress: 5,
      startTime: Date.now(),
      estimatedTotalSec: taskDef.estimatedTotalSec,
      message: 'Initializing ephemeral environment...',
      costUSD: 0,
    };

    setBackgroundTasks((prev) => [newTask, ...prev]);

    try {
      const result = await taskDef.execute(
        (progress, msg) => {
          setBackgroundTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, progress, message: msg } : t))
          );
        },
        () => cancelledTasksRef.current.has(taskId)
      );

      setBackgroundTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'completed',
                progress: 100,
                message: 'Processing complete. File ready for download.',
                outputDownload: {
                  filename: result.filename,
                  dataUrl: result.dataUrl,
                  blobSize: 1024 * 50,
                  mimeType: result.filename.endsWith('.txt') ? 'text/plain' : 'audio/mpeg',
                  previewText: result.transcription,
                  summaryText: result.summary,
                },
              }
            : t
        )
      );
    } catch (err: unknown) {
      const isCancelled = cancelledTasksRef.current.has(taskId);
      setBackgroundTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: isCancelled ? 'cancelled' : 'failed',
                message: isCancelled
                  ? 'Stopped by user.'
                  : (err as Error)?.message || 'Execution error encountered.',
              }
            : t
        )
      );
    }
  };

  const handleCancelTask = (taskId: string) => {
    cancelledTasksRef.current.add(taskId);
    setBackgroundTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'cancelled', message: 'Cancelled.' } : t))
    );
  };

  const handleClearCompletedTasks = () => {
    setBackgroundTasks((prev) => prev.filter((t) => t.status === 'running' || t.status === 'queued'));
  };

  const activeTasksCount = backgroundTasks.filter(
    (t) => t.status === 'running' || t.status === 'queued'
  ).length;

  const totalCost = costTracker.records.reduce((acc, r) => acc + r.costUSD, 0);

  return (
    <div
      className={`min-h-screen flex font-mono antialiased transition-colors ${
        isDarkMode ? 'bg-[#121212] text-[#e0e0e0]' : 'bg-[#f8f9fa] text-[#1a1a1a]'
      }`}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={setCurrentModule}
        secretStore={secretStore}
        costTracker={costTracker}
        activeTasksCount={activeTasksCount}
        onOpenTaskDrawer={() => setIsTaskDrawerOpen(true)}
        onPurgeMemory={handlePurgeMemory}
        isDarkMode={isDarkMode}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Bar */}
        <HeaderBar
          currentModule={currentModule}
          activeTasksCount={activeTasksCount}
          onOpenTaskDrawer={() => setIsTaskDrawerOpen(true)}
          totalCostUSD={totalCost}
          budgetLimitUSD={costTracker.budgetLimitUSD}
          memoryUsageBytes={memoryUsageBytes}
          onPurgeMemory={handlePurgeMemory}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          secretStore={secretStore}
          onNavigateToSettings={(mod) => setCurrentModule(mod)}
        />

        {/* Zero Retention Notification Strip */}
        <ZeroRetentionBanner
          memoryUsageBytes={memoryUsageBytes}
          onPurge={handlePurgeMemory}
          isDarkMode={isDarkMode}
        />

        {/* Active Module View */}
        <main className="flex-1 overflow-y-auto">
          {currentModule === 'video-transcriber' && (
            <VideoTranscriberModule
              state={videoTranscriberState}
              onChange={setVideoTranscriberState}
              secretStore={secretStore}
              costTracker={costTracker}
              onRecordCost={(mod, op, dur, inT, outT, det) =>
                handleRecordCost(mod, op, dur, inT, outT, det)
              }
              onRegisterBackgroundTask={handleRegisterBackgroundTask}
              onNavigateToSettings={(mod) => setCurrentModule(mod)}
              isDarkMode={isDarkMode}
            />
          )}

          {currentModule === 'media-clipper' && (
            <MediaClipperModule
              state={mediaClipperState}
              onChange={setMediaClipperState}
              secretStore={secretStore}
              costTracker={costTracker}
              onRecordCost={(mod, op, dur, inT, outT, det) =>
                handleRecordCost(mod, op, dur, inT, outT, det)
              }
              onRegisterBackgroundTask={handleRegisterBackgroundTask}
              isDarkMode={isDarkMode}
            />
          )}

          {currentModule === 'audiobook-transcriber' && (
            <AudiobookTranscriberModule
              state={audiobookTranscriberState}
              onChange={setAudiobookTranscriberState}
              secretStore={secretStore}
              costTracker={costTracker}
              onRecordCost={(mod, op, dur, inT, outT, det) =>
                handleRecordCost(mod, op, dur, inT, outT, det)
              }
              onRegisterBackgroundTask={handleRegisterBackgroundTask}
              onNavigateToSettings={(mod) => setCurrentModule(mod)}
              isDarkMode={isDarkMode}
            />
          )}

          {currentModule === 'secrets-settings' && (
            <SecretsSettingsModule
              secretStore={secretStore}
              onUpdateSecretStore={setSecretStore}
              isDarkMode={isDarkMode}
            />
          )}

          {currentModule === 'cost-analytics' && (
            <CostAnalyticsModule
              costTracker={costTracker}
              onUpdateBudgetLimit={(newLimit) => {
                setCostTracker((prev) => {
                  const updated = { ...prev, budgetLimitUSD: newLimit };
                  localStorage.setItem('cost_tracker_v1', JSON.stringify(updated));
                  fetch('/api/cost-tracker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updated),
                  }).catch((e) => console.warn('Failed to sync budget limit to server:', e));
                  return updated;
                });
              }}
              onClearRecords={() => {
                const cleanModuleTotals = {
                  'video-transcriber': { costUSD: 0, runs: 0, totalSeconds: 0 },
                  'media-clipper': { costUSD: 0, runs: 0, totalSeconds: 0 },
                  'audiobook-transcriber': { costUSD: 0, runs: 0, totalSeconds: 0 },
                  'audio-extractor': { costUSD: 0, runs: 0, totalSeconds: 0 },
                  'secrets-settings': { costUSD: 0, runs: 0, totalSeconds: 0 },
                  'cost-analytics': { costUSD: 0, runs: 0, totalSeconds: 0 },
                  'code-environment': { costUSD: 0, runs: 0, totalSeconds: 0 },
                };
                const cleared: CostTrackerState = {
                  budgetLimitUSD: costTracker.budgetLimitUSD,
                  records: [],
                  moduleTotals: cleanModuleTotals,
                };
                setCostTracker(cleared);
                localStorage.setItem('cost_tracker_v1', JSON.stringify(cleared));
                fetch('/api/cost-tracker/reset', { method: 'POST' }).catch((e) =>
                  console.warn('Failed to reset cost tracker on server:', e)
                );
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {currentModule === 'code-environment' && (
            <CodeEnvironmentModule isDarkMode={isDarkMode} />
          )}
        </main>
      </div>

      {/* Slide-out Background Task Drawer */}
      <TaskDrawer
        isOpen={isTaskDrawerOpen}
        onClose={() => setIsTaskDrawerOpen(false)}
        tasks={backgroundTasks}
        onCancelTask={handleCancelTask}
        onClearCompletedTasks={handleClearCompletedTasks}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
