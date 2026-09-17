import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { getYtDlpPath, getFfmpegPath, getFfprobePath } from '../server';

export interface CookieAuthOptions {
  enabled?: boolean;
  cookieMode: 'browser' | 'file';
  selectedBrowser: string;
  browserProfile?: string;
  firefoxContainer?: string;
  cookieFilePath?: string;
  cookieFileContent?: string;
}

export interface VideoInspectResult {
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
  formatsSummary: {
    videoOptions: Array<{ formatId: string; resolution: string; ext: string; note: string; filesizeApprox?: string }>;
    audioOptions: Array<{ formatId: string; ext: string; note: string; filesizeApprox?: string }>;
  };
  extractor?: string;
  estimatedSize?: string;
  isLive?: boolean;
}

export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  quality: string;
  format: string;
  status: 'queued' | 'inspecting' | 'downloading' | 'merging' | 'completed' | 'error' | 'cancelled';
  progress: number; // 0 - 100
  downloadSpeed?: string;
  eta?: string;
  downloadedSizeStr?: string;
  totalSizeStr?: string;
  currentStage: string;
  filename?: string;
  localFilePath?: string;
  downloadUrl?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
  logs: string[];
  commandPreview?: string;
  startedAt: number;
  completedAt?: number;
}

// In-memory jobs tracking
const activeJobs = new Map<string, DownloadJob>();
const activeProcesses = new Map<string, any>();
const sseClients = new Set<(event: string, data: any) => void>();

export function getJobs(): DownloadJob[] {
  return Array.from(activeJobs.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export function getJob(id: string): DownloadJob | undefined {
  return activeJobs.get(id);
}

export function subscribeSSE(client: (event: string, data: any) => void) {
  sseClients.add(client);
  return () => {
    sseClients.delete(client);
  };
}

function broadcastJobUpdate(job: DownloadJob, logLine?: string) {
  const payload = { job, logLine };
  for (const send of sseClients) {
    try {
      send('job-update', payload);
    } catch {}
  }
}

/**
 * Automatically assembles the `--cookies-from-browser` or `--cookies` flags
 * strictly adhering to yt-dlp specification:
 * BROWSER[:PROFILE][::CONTAINER]
 * - Firefox + Container: `--cookies-from-browser firefox:default-release::Meta`
 * - Chrome + Profile: `--cookies-from-browser chrome:"Profile 1"`
 */
export function assembleCookieArgs(auth: CookieAuthOptions, tempDir: string): { args: string[]; tempCookieFile?: string } {
  if (!auth || !auth.enabled) return { args: [] };

  if (auth.cookieMode === 'browser') {
    const browser = (auth.selectedBrowser || 'chrome').toLowerCase().trim();
    const profile = (auth.browserProfile || '').trim();
    const container = (auth.firefoxContainer || '').trim();

    let spec = browser;
    if (browser === 'firefox') {
      if (container) {
        // firefox:profile::container
        const prof = profile || 'default-release';
        spec = `${browser}:${prof}::${container}`;
      } else if (profile) {
        spec = `${browser}:${profile}`;
      }
    } else {
      if (profile) {
        spec = `${browser}:${profile}`;
      }
    }

    return { args: ['--cookies-from-browser', spec] };
  }

  if (auth.cookieMode === 'file') {
    if (auth.cookieFilePath && fs.existsSync(auth.cookieFilePath)) {
      return { args: ['--cookies', auth.cookieFilePath] };
    }
    if (auth.cookieFileContent && auth.cookieFileContent.trim()) {
      const tempCookiePath = path.join(tempDir, `cookies_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.txt`);
      fs.writeFileSync(tempCookiePath, auth.cookieFileContent, 'utf8');
      return { args: ['--cookies', tempCookiePath], tempCookieFile: tempCookiePath };
    }
  }

  return { args: [] };
}

/**
 * Formats duration in seconds to HH:MM:SS or MM:SS
 */
function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format bytes to readable size
 */
function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Intercept SQLite database locked error message from browser extraction
 */
function formatFriendlyErrorMessage(rawError: string): string {
  if (!rawError) return 'Unknown error occurred during processing.';

  if (
    rawError.includes('OperationalError: database is locked') ||
    rawError.includes('database is locked') ||
    rawError.includes('Could not copy Chrome/Firefox cookies') ||
    rawError.includes('could not copy ... database')
  ) {
    return (
      'Browser Cookie Database Locked: Your browser is currently running and has locked its cookie database. ' +
      'To resolve this, please either close the browser or use the "Manual cookies.txt File Upload" option.'
    );
  }

  if (
    rawError.includes('could not find chrome cookies database') ||
    rawError.includes('could not find firefox cookies database') ||
    rawError.includes('could not find') && rawError.includes('cookies database')
  ) {
    return (
      'Browser Cookie Database Not Found: The selected local browser is not installed or has no active profile in this environment. ' +
      'For public videos, leave cookie authentication disabled. For restricted videos, upload a cookies.txt file instead.'
    );
  }

  if (rawError.includes('Sign in to confirm you’re not a bot') || rawError.includes('Sign in to confirm')) {
    return (
      'Bot Verification / Login Wall: The streaming service requires user authentication. ' +
      'Please enable "Authentication & Cookies" and specify your browser profile or upload cookies.txt.'
    );
  }

  if (rawError.includes('Video unavailable') || rawError.includes('Private video')) {
    return 'Video Unavailable: This video is private, deleted, or geographically restricted.';
  }

  if (rawError.includes('HTTP Error 403')) {
    return 'HTTP 403 Forbidden: Access denied by remote server. Providing authenticated cookies usually resolves this.';
  }

  return rawError;
}

/**
 * Inspect video URL using `yt-dlp -J`
 */
export async function inspectVideoUrl(url: string, auth: CookieAuthOptions): Promise<VideoInspectResult> {
  const binary = await getYtDlpPath();
  const tempDir = os.tmpdir();
  const { args: cookieArgs, tempCookieFile } = assembleCookieArgs(auth, tempDir);

  const baseArgs = [
    '--dump-single-json',
    '--no-warnings',
    '--no-playlist',
    '--skip-download',
    ...cookieArgs,
    url,
  ];

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(binary, baseArgs, {
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      if (tempCookieFile && fs.existsSync(tempCookieFile)) {
        try { fs.unlinkSync(tempCookieFile); } catch {}
      }
      reject(new Error(`Failed to execute yt-dlp: ${err.message}`));
    });

    child.on('close', (code) => {
      if (tempCookieFile && fs.existsSync(tempCookieFile)) {
        try { fs.unlinkSync(tempCookieFile); } catch {}
      }

      if (code !== 0 && !stdout.trim()) {
        const friendly = formatFriendlyErrorMessage(stderr || `Process exited with code ${code}`);
        return reject(new Error(friendly));
      }

      try {
        // Strip any leading non-JSON notices like deprecation warnings
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
          throw new Error('yt-dlp did not return valid JSON metadata.');
        }

        const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
        const data = JSON.parse(jsonStr);

        const formats: any[] = Array.isArray(data.formats) ? data.formats : [];
        const resolutionSet = new Set<string>();
        const videoOptions: any[] = [];
        const audioOptions: any[] = [];

        // Parse available resolutions and format options
        formats.forEach((f) => {
          const height = f.height;
          const formatNote = f.format_note || '';
          const ext = f.ext || 'mp4';
          const sizeApprox = f.filesize ? formatBytes(f.filesize) : f.filesize_approx ? `~${formatBytes(f.filesize_approx)}` : undefined;

          if (height && typeof height === 'number') {
            if (height >= 2160) resolutionSet.add('4K (2160p)');
            else if (height >= 1440) resolutionSet.add('2K (1440p)');
            else if (height >= 1080) resolutionSet.add('1080p (Full HD)');
            else if (height >= 720) resolutionSet.add('720p (HD)');
            else if (height >= 480) resolutionSet.add('480p (SD)');
            else if (height >= 360) resolutionSet.add('360p');

            if (f.vcodec && f.vcodec !== 'none') {
              videoOptions.push({
                formatId: f.format_id,
                resolution: `${height}p`,
                ext,
                note: `${height}p ${f.fps ? `${f.fps}fps` : ''} ${f.vcodec || ''}`.trim(),
                filesizeApprox: sizeApprox,
              });
            }
          }

          if ((f.vcodec === 'none' || !f.vcodec) && f.acodec && f.acodec !== 'none') {
            audioOptions.push({
              formatId: f.format_id,
              ext: ext === 'webm' ? 'opus' : ext,
              note: `${f.abr ? `${Math.round(f.abr)}kbps` : ''} ${f.acodec || ''}`.trim(),
              filesizeApprox: sizeApprox,
            });
          }
        });

        // Always provide standard resolution badges if video has height
        if (data.height) {
          if (data.height >= 2160) resolutionSet.add('4K (2160p)');
          if (data.height >= 1440) resolutionSet.add('2K (1440p)');
          if (data.height >= 1080) resolutionSet.add('1080p (Full HD)');
          if (data.height >= 720) resolutionSet.add('720p (HD)');
          if (data.height >= 480) resolutionSet.add('480p (SD)');
        }

        const availableResolutions = Array.from(resolutionSet);
        if (availableResolutions.length === 0) {
          availableResolutions.push('Best Available');
        }

        const result: VideoInspectResult = {
          id: data.id || 'video',
          title: data.title || data.fulltitle || 'Untitled Media',
          uploader: data.uploader || data.channel || data.creator,
          channel: data.channel || data.uploader,
          duration: data.duration,
          durationString: formatDuration(data.duration),
          thumbnail: data.thumbnail || (Array.isArray(data.thumbnails) && data.thumbnails.length > 0 ? data.thumbnails[data.thumbnails.length - 1].url : undefined),
          viewCount: data.view_count,
          uploadDate: data.upload_date,
          description: data.description ? data.description.slice(0, 400) : undefined,
          webpageUrl: data.webpage_url || url,
          availableResolutions,
          formatsSummary: {
            videoOptions: videoOptions.slice(-6).reverse(),
            audioOptions: audioOptions.slice(-4).reverse(),
          },
          extractor: data.extractor || 'Generic',
          estimatedSize: data.filesize ? formatBytes(data.filesize) : data.filesize_approx ? `~${formatBytes(data.filesize_approx)}` : undefined,
          isLive: data.is_live,
        };

        resolve(result);
      } catch (parseErr: any) {
        reject(new Error(`Failed to parse metadata: ${parseErr.message}\nRaw output: ${stdout.slice(0, 300)}`));
      }
    });
  });
}

export interface StartDownloadParams {
  jobId: string;
  url: string;
  title?: string;
  thumbnail?: string;
  quality: string;
  format: string; // 'mp4' | 'mkv' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'flac'
  outputDirectory?: string;
  namingScheme?: string;
  embedSubtitles?: boolean;
  embedThumbnail?: boolean;
  embedMetadata?: boolean;
  auth: CookieAuthOptions;
}

/**
 * Starts a real-time background download job with progress tracking
 */
export async function startDownloadJob(params: StartDownloadParams): Promise<DownloadJob> {
  const binary = await getYtDlpPath();
  const ffmpegPath = getFfmpegPath();
  const ffprobePath = getFfprobePath();

  const baseDir = params.outputDirectory && params.outputDirectory.trim()
    ? path.resolve(process.cwd(), params.outputDirectory.trim())
    : path.resolve(process.cwd(), 'downloads');

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const { args: cookieArgs, tempCookieFile } = assembleCookieArgs(params.auth, baseDir);

  // Template naming scheme
  const rawNaming = params.namingScheme && params.namingScheme.trim()
    ? params.namingScheme.trim()
    : '%(title)s.%(ext)s';

  const outputTemplate = path.join(baseDir, rawNaming);

  const isAudioOnly = params.quality.startsWith('audio-') || ['mp3', 'm4a', 'wav', 'flac'].includes(params.format);

  const dlArgs: string[] = [
    '--newline',
    '--no-playlist',
    '--ffmpeg-location', path.dirname(ffmpegPath),
    ...cookieArgs,
  ];

  // Quality and format specifiers
  if (isAudioOnly) {
    dlArgs.push('-x');
    let audioFormat = 'mp3';
    if (params.quality === 'audio-m4a' || params.format === 'm4a') audioFormat = 'm4a';
    else if (params.quality === 'audio-wav' || params.format === 'wav') audioFormat = 'wav';
    else if (params.quality === 'audio-flac' || params.format === 'flac') audioFormat = 'flac';
    else if (params.quality === 'audio-mp3' || params.format === 'mp3') audioFormat = 'mp3';
    else audioFormat = 'mp3';

    dlArgs.push('--audio-format', audioFormat);
    dlArgs.push('--audio-quality', '0');
  } else {
    // Video resolutions
    if (params.quality === '2160p') {
      dlArgs.push('-f', 'bestvideo[height<=2160]+bestaudio/best[height<=2160]/best');
    } else if (params.quality === '1440p') {
      dlArgs.push('-f', 'bestvideo[height<=1440]+bestaudio/best[height<=1440]/best');
    } else if (params.quality === '1080p') {
      dlArgs.push('-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best');
    } else if (params.quality === '720p') {
      dlArgs.push('-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best');
    } else if (params.quality === '480p') {
      dlArgs.push('-f', 'bestvideo[height<=480]+bestaudio/best[height<=480]/best');
    } else if (params.quality === '360p') {
      dlArgs.push('-f', 'bestvideo[height<=360]+bestaudio/best[height<=360]/best');
    } else {
      dlArgs.push('-f', 'bestvideo+bestaudio/best');
    }

    const mergeFormat = ['mp4', 'mkv', 'webm'].includes(params.format) ? params.format : 'mp4';
    dlArgs.push('--merge-output-format', mergeFormat);
  }

  // Embeddings
  if (params.embedSubtitles && !isAudioOnly) {
    dlArgs.push('--embed-subs', '--sub-langs', 'all,-live_chat');
  }
  if (params.embedThumbnail) {
    dlArgs.push('--embed-thumbnail');
  }
  if (params.embedMetadata) {
    dlArgs.push('--embed-metadata', '--embed-chapters');
  }

  dlArgs.push('-o', outputTemplate);
  dlArgs.push(params.url);

  const commandPreview = `${path.basename(binary)} ${dlArgs.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;

  const job: DownloadJob = {
    id: params.jobId,
    url: params.url,
    title: params.title || 'Fetching metadata...',
    thumbnail: params.thumbnail,
    quality: params.quality,
    format: params.format,
    status: 'inspecting',
    progress: 0,
    currentStage: 'Initializing download engine...',
    logs: [`[init] Starting yt-dlp job for ${params.url}`, `[cmd] ${commandPreview}`],
    commandPreview,
    startedAt: Date.now(),
  };

  activeJobs.set(params.jobId, job);
  broadcastJobUpdate(job);

  let targetFilename: string | undefined;

  const child = spawn(binary, dlArgs, {
    env: {
      ...process.env,
      PATH: `${path.dirname(ffmpegPath)}:${path.dirname(ffprobePath)}:${process.env.PATH}`,
      PYTHONUNBUFFERED: '1',
    },
  });

  activeProcesses.set(params.jobId, child);

  // Line buffers
  let stdoutBuffer = '';
  let stderrBuffer = '';

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;

    job.logs.push(line);
    if (job.logs.length > 500) {
      job.logs.shift();
    }

    // Capture destination filename
    const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)$/i) || line.match(/\[Merger\]\s+Merging formats into "(.+)"/i);
    if (destMatch && destMatch[1]) {
      const fullPath = destMatch[1].trim();
      targetFilename = path.basename(fullPath);
      job.filename = targetFilename;
      job.localFilePath = fullPath;
    }

    // Capture progress
    // e.g. [download]  42.5% of ~  50.12MiB at   5.20MiB/s ETA 00:08
    const progMatch = line.match(/\[download\]\s+([\d\.]+)%\s+of\s+(?:~?\s*([\d\.]+\w+))?(?:\s+at\s+([\d\.]+\w+\/s))?(?:\s+ETA\s+([\d:]+))?/i);
    if (progMatch) {
      const pct = parseFloat(progMatch[1]);
      if (!isNaN(pct)) {
        job.progress = Math.min(99, Math.max(job.progress, Math.round(pct)));
        job.status = 'downloading';
        job.currentStage = `Downloading media stream (${job.progress}%)`;
      }
      if (progMatch[2]) job.totalSizeStr = progMatch[2];
      if (progMatch[3]) job.downloadSpeed = progMatch[3];
      if (progMatch[4]) job.eta = progMatch[4];
    }

    // Capture stage markers
    if (line.includes('[Merger]')) {
      job.status = 'merging';
      job.currentStage = 'Merging video and audio streams via FFmpeg...';
      job.progress = Math.max(job.progress, 90);
    } else if (line.includes('[ExtractAudio]')) {
      job.status = 'merging';
      job.currentStage = 'Extracting audio & converting format via FFmpeg...';
      job.progress = Math.max(job.progress, 92);
    } else if (line.includes('[Metadata]')) {
      job.currentStage = 'Writing media metadata & chapter markers...';
      job.progress = Math.max(job.progress, 96);
    } else if (line.includes('[EmbedSubtitle]')) {
      job.currentStage = 'Embedding subtitle tracks...';
    } else if (line.includes('[ThumbnailsConvertor]')) {
      job.currentStage = 'Embedding thumbnail artwork...';
    } else if (line.includes('[download] 100% of')) {
      job.progress = Math.max(job.progress, 95);
      job.currentStage = 'Finalizing file muxing...';
    }

    broadcastJobUpdate(job, line);
  };

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() || '';
    lines.forEach(processLine);
  });

  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop() || '';
    lines.forEach((l) => {
      const trimmed = l.trim();
      if (trimmed) {
        job.logs.push(`[stderr] ${trimmed}`);
        if (job.logs.length > 500) job.logs.shift();
        broadcastJobUpdate(job, `[stderr] ${trimmed}`);
      }
    });
  });

  child.on('error', (err) => {
    activeProcesses.delete(params.jobId);
    if (tempCookieFile && fs.existsSync(tempCookieFile)) {
      try { fs.unlinkSync(tempCookieFile); } catch {}
    }
    job.status = 'error';
    job.errorMessage = `Failed to start download engine: ${err.message}`;
    job.currentStage = 'Execution Failed';
    broadcastJobUpdate(job);
  });

  child.on('close', (code) => {
    activeProcesses.delete(params.jobId);
    if (tempCookieFile && fs.existsSync(tempCookieFile)) {
      try { fs.unlinkSync(tempCookieFile); } catch {}
    }

    if (stdoutBuffer.trim()) processLine(stdoutBuffer);
    if (stderrBuffer.trim()) job.logs.push(`[stderr] ${stderrBuffer.trim()}`);

    if (job.status === 'cancelled') {
      broadcastJobUpdate(job);
      return;
    }

    if (code === 0) {
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = Date.now();
      job.currentStage = 'Download & Muxing Complete';

      // Scan directory to locate final output file if not yet resolved
      if (!targetFilename || !job.localFilePath || !fs.existsSync(job.localFilePath)) {
        try {
          const files = fs.readdirSync(baseDir);
          const recent = files
            .map((f) => ({ name: f, path: path.join(baseDir, f), stat: fs.statSync(path.join(baseDir, f)) }))
            .filter((f) => !f.stat.isDirectory() && !f.name.endsWith('.part') && !f.name.endsWith('.ytdl'))
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

          if (recent.length > 0) {
            targetFilename = recent[0].name;
            job.localFilePath = recent[0].path;
          }
        } catch {}
      }

      if (targetFilename && job.localFilePath && fs.existsSync(job.localFilePath)) {
        try {
          const st = fs.statSync(job.localFilePath);
          job.fileSizeBytes = st.size;
          job.totalSizeStr = formatBytes(st.size);
          job.filename = targetFilename;
          job.downloadUrl = `/api/downloader/download/${encodeURIComponent(targetFilename)}`;
        } catch {}
      }

      job.logs.push(`[completed] Download finished successfully: ${job.filename || 'File saved'}`);
      broadcastJobUpdate(job);
    } else {
      job.status = 'error';
      const allErr = job.logs.filter((l) => l.includes('[stderr]') || l.includes('ERROR:')).join('\n');
      job.errorMessage = formatFriendlyErrorMessage(allErr || `yt-dlp exited with error code ${code}`);
      job.currentStage = 'Download failed';
      broadcastJobUpdate(job);
    }
  });

  return job;
}

/**
 * Cancel an active download job and clean up partial files
 */
export function cancelDownloadJob(jobId: string): boolean {
  const child = activeProcesses.get(jobId);
  const job = activeJobs.get(jobId);

  if (job) {
    job.status = 'cancelled';
    job.currentStage = 'Cancelled by user';
    job.logs.push('[cancel] Job was cancelled by user.');
    broadcastJobUpdate(job);
  }

  if (child) {
    try {
      child.kill('SIGTERM');
      setTimeout(() => {
        try {
          if (!child.killed) child.kill('SIGKILL');
        } catch {}
      }, 1000);
    } catch {}
    activeProcesses.delete(jobId);
  }

  // Clean up partial downloads
  if (job && job.localFilePath) {
    try {
      const dir = path.dirname(job.localFilePath);
      const base = path.basename(job.localFilePath);
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.startsWith(base) && (f.endsWith('.part') || f.endsWith('.ytdl'))) {
          try { fs.unlinkSync(path.join(dir, f)); } catch {}
        }
      }
    } catch {}
  }

  return true;
}

/**
 * Check yt-dlp version or trigger self-update
 */
export async function updateYtDlp(): Promise<{ output: string; currentVersion: string; updatedVersion?: string }> {
  const binary = await getYtDlpPath();

  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(binary, ['-U'], {
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });

    child.on('close', async () => {
      let currentVersion = 'Unknown';
      try {
        const verProc = spawn(binary, ['--version']);
        let vOut = '';
        verProc.stdout.on('data', (d) => { vOut += d.toString(); });
        await new Promise((r) => verProc.on('close', r));
        currentVersion = vOut.trim().split('\n').pop()?.trim() || 'Unknown';
      } catch {}

      resolve({
        output: output.trim(),
        currentVersion,
      });
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to run update: ${err.message}`));
    });
  });
}

/**
 * Get current yt-dlp and FFmpeg version
 */
export async function getSystemEnginesVersion(): Promise<{
  ytdlp: string;
  ffmpeg: string;
  ffprobe: string;
  outputDirectory: string;
}> {
  let ytdlp = 'Unknown';
  let ffmpeg = 'Unknown';
  let ffprobe = 'Unknown';

  try {
    const yBin = await getYtDlpPath();
    const p = spawn(yBin, ['--version']);
    let out = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    await new Promise((r) => p.on('close', r));
    ytdlp = out.trim().split('\n').pop()?.trim() || 'Ready';
  } catch {
    ytdlp = 'Not installed';
  }

  try {
    const fBin = getFfmpegPath();
    const p = spawn(fBin, ['-version']);
    let out = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    await new Promise((r) => p.on('close', r));
    const firstLine = out.split('\n')[0] || '';
    const m = firstLine.match(/ffmpeg version ([^\s]+)/i);
    ffmpeg = m ? m[1] : (firstLine ? 'Installed' : 'Ready');
  } catch {
    ffmpeg = 'Not installed';
  }

  try {
    const fpBin = getFfprobePath();
    ffprobe = fs.existsSync(fpBin) ? 'Ready' : 'Not installed';
  } catch {
    ffprobe = 'Not installed';
  }

  const outputDirectory = path.resolve(process.cwd(), 'downloads');
  if (!fs.existsSync(outputDirectory)) {
    try { fs.mkdirSync(outputDirectory, { recursive: true }); } catch {}
  }

  return { ytdlp, ffmpeg, ffprobe, outputDirectory };
}

/**
 * List files in downloads folder
 */
export function listCompletedDownloads(outputDir?: string): Array<{
  name: string;
  sizeBytes: number;
  sizeStr: string;
  mtime: number;
  downloadUrl: string;
}> {
  const dir = outputDir && outputDir.trim()
    ? path.resolve(process.cwd(), outputDir.trim())
    : path.resolve(process.cwd(), 'downloads');

  if (!fs.existsSync(dir)) return [];

  try {
    const files = fs.readdirSync(dir);
    return files
      .filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl') && !f.startsWith('.'))
      .map((f) => {
        const full = path.join(dir, f);
        const st = fs.statSync(full);
        return {
          name: f,
          sizeBytes: st.size,
          sizeStr: formatBytes(st.size),
          mtime: st.mtimeMs,
          downloadUrl: `/api/downloader/download/${encodeURIComponent(f)}`,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

/**
 * Delete a specific downloaded file
 */
export function deleteCompletedFile(filename: string, outputDir?: string): boolean {
  const dir = outputDir && outputDir.trim()
    ? path.resolve(process.cwd(), outputDir.trim())
    : path.resolve(process.cwd(), 'downloads');
  const safeName = path.basename(filename);
  const fullPath = path.join(dir, safeName);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      return true;
    } catch {}
  }
  return false;
}

/**
 * Purge all downloaded files in downloads folder (e.g. on tab close or session reset)
 */
export function purgeAllDownloads(outputDir?: string): number {
  const dir = outputDir && outputDir.trim()
    ? path.resolve(process.cwd(), outputDir.trim())
    : path.resolve(process.cwd(), 'downloads');

  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (!f.startsWith('.')) {
        try {
          const p = path.join(dir, f);
          const st = fs.statSync(p);
          if (!st.isDirectory()) {
            fs.unlinkSync(p);
            count++;
          }
        } catch {}
      }
    }
  } catch {}
  return count;
}
