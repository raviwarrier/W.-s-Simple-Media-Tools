import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import nodeCrypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import dotenv from 'dotenv';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const pExecFile = promisify(execFile);

// Dynamic, cross-platform binary resolution for FFmpeg and ffprobe
export function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const staticPath = (typeof ffmpegStatic === 'string' ? ffmpegStatic : (ffmpegStatic as any)?.default || (ffmpegStatic as any)?.path) as string | undefined;
  if (staticPath && fs.existsSync(staticPath)) {
    try {
      fs.chmodSync(staticPath, 0o755);
    } catch {}
    return staticPath;
  }
  const candidates = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

export function getFfprobePath(): string {
  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
    return process.env.FFPROBE_PATH;
  }
  const staticPath = (typeof ffprobeStatic === 'string' ? ffprobeStatic : (ffprobeStatic as any)?.path || (ffprobeStatic as any)?.default?.path) as string | undefined;
  if (staticPath && fs.existsSync(staticPath)) {
    try {
      fs.chmodSync(staticPath, 0o755);
    } catch {}
    return staticPath;
  }
  const candidates = ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe', '/opt/homebrew/bin/ffprobe'];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffprobe';
}

export async function runFfmpeg(args: string[], options?: any): Promise<{ stdout: string; stderr: string }> {
  const binary = getFfmpegPath();
  try {
    const res: any = await pExecFile(binary, args, { encoding: 'utf8', ...options });
    return {
      stdout: typeof res.stdout === 'string' ? res.stdout : String(res.stdout || ''),
      stderr: typeof res.stderr === 'string' ? res.stderr : String(res.stderr || ''),
    };
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      throw new Error(
        `FFmpeg binary not found (attempted: "${binary}"). Ensure ffmpeg is installed or ffmpeg-static is bundled.`
      );
    }
    throw err;
  }
}

export async function runFfprobe(args: string[], options?: any): Promise<{ stdout: string; stderr: string }> {
  const binary = getFfprobePath();
  try {
    const res: any = await pExecFile(binary, args, { encoding: 'utf8', ...options });
    return {
      stdout: typeof res.stdout === 'string' ? res.stdout : String(res.stdout || ''),
      stderr: typeof res.stderr === 'string' ? res.stderr : String(res.stderr || ''),
    };
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      throw new Error(
        `FFprobe binary not found (attempted: "${binary}"). Ensure ffprobe is installed or ffprobe-static is bundled.`
      );
    }
    throw err;
  }
}

const app = express();
const DEFAULT_PORT = 4261;
const PORT = parseInt(process.env.PORT || '4261', 10);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Ephemeral upload destination
const upload = multer({
  dest: path.join(os.tmpdir(), 'media-suite-uploads'),
  limits: { fileSize: 500 * 1024 * 1024 }, // up to 500MB
});

// Utility to clean up directory or files
async function safeRemove(targetPath: string) {
  try {
    if (fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
    }
  } catch (err) {
    console.warn(`Could not remove ${targetPath}:`, err);
  }
}

// Helper to convert hh:mm:ss to seconds
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map((p) => parseFloat(p) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

// Format seconds into HH:MM:SS
function formatSecondsToTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Helper to download URL using direct fetch for raw media files or yt-dlp for streaming sites
async function downloadUrlEphemeral(url: string, outputDir: string, extractAudioOnly: boolean = false): Promise<string> {
  // 1. Check if the URL points directly to an audio/video file and download via native fetch
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const directExts = ['.mp3', '.mp4', '.wav', '.m4a', '.aac', '.mov', '.mkv', '.webm', '.ogg', '.flac'];
    const matchedExt = directExts.find((ext) => pathname.endsWith(ext));

    if (matchedExt) {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (W-Simple-Media-Tools)' } });
      if (resp.ok) {
        const targetPath = path.join(outputDir, `direct_source${matchedExt}`);
        const arrayBuffer = await resp.arrayBuffer();
        fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
        return targetPath;
      }
    }
  } catch (directErr) {
    console.warn('Direct media download attempted and skipped, falling back to yt-dlp:', directErr);
  }

  // 2. Otherwise use yt-dlp for web streaming extraction
  const outTemplate = path.join(outputDir, 'source.%(ext)s');
  const args = ['--no-warnings', '--no-check-certificates', '-o', outTemplate];

  if (extractAudioOnly) {
    args.push('-x', '--audio-format', 'wav', '--audio-quality', '0');
  } else {
    args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
  }
  args.push(url);

  try {
    await pExecFile('yt-dlp', args, { timeout: 180000 });
  } catch (err: unknown) {
    const errText = (err as Error)?.message || '';
    if ((err as any)?.code === 'ENOENT' || errText.includes('ENOENT')) {
      throw new Error(
        'yt-dlp binary is not installed on this system for streaming site extraction. Please upload your video/audio file directly, or use a direct media file URL (ending in .mp4, .mp3, etc.).'
      );
    }
    if (errText.includes('Sign in') || errText.includes('bot') || errText.includes('403') || errText.includes('HTTP Error 403')) {
      throw new Error('Streaming source blocked automated extraction (bot check / 403). Please upload your video/audio file directly.');
    }
    throw new Error(`Failed to download stream (${errText.slice(0, 140)}...). Please upload the media file directly.`);
  }

  const files = fs.readdirSync(outputDir);
  if (files.length === 0) {
    throw new Error('Failed to download media from provided URL. Please try uploading the media file directly.');
  }
  return path.join(outputDir, files[0]);
}

// Extract audio duration via ffprobe
async function getMediaDuration(mediaPath: string): Promise<number> {
  try {
    const { stdout } = await runFfprobe([
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      mediaPath
    ]);
    const dur = parseFloat(stdout.trim());
    return isNaN(dur) ? 0 : dur;
  } catch {
    return 0;
  }
}

// -------------------------------------------------------------
// Persistent Storage Paths (cost-tracker & encrypted vault)
// -------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const COST_TRACKER_FILE = path.join(DATA_DIR, 'cost-tracker.json');
const VAULT_FILE = path.join(DATA_DIR, 'vault.enc.json');

function getDefaultCostTracker() {
  return {
    budgetLimitUSD: 10.0,
    records: [],
    moduleTotals: {
      'video-transcriber': { costUSD: 0, runs: 0, totalSeconds: 0 },
      'media-clipper': { costUSD: 0, runs: 0, totalSeconds: 0 },
      'audiobook-transcriber': { costUSD: 0, runs: 0, totalSeconds: 0 },
      'audio-extractor': { costUSD: 0, runs: 0, totalSeconds: 0 },
      'secrets-settings': { costUSD: 0, runs: 0, totalSeconds: 0 },
      'cost-analytics': { costUSD: 0, runs: 0, totalSeconds: 0 },
      'code-environment': { costUSD: 0, runs: 0, totalSeconds: 0 },
    },
    lastUpdated: Date.now(),
  };
}

// Cost Tracker Persistence APIs
app.get('/api/cost-tracker', (req, res) => {
  try {
    if (fs.existsSync(COST_TRACKER_FILE)) {
      const raw = fs.readFileSync(COST_TRACKER_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      res.json({ status: 'ok', data: parsed });
      return;
    }
  } catch (e) {
    console.warn('Failed to read cost tracker file:', e);
  }
  const defaultState = getDefaultCostTracker();
  try {
    fs.writeFileSync(COST_TRACKER_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
  } catch {}
  res.json({ status: 'ok', data: defaultState });
});

app.post('/api/cost-tracker', (req, res) => {
  try {
    const updatedState = req.body;
    if (updatedState && typeof updatedState === 'object') {
      fs.writeFileSync(COST_TRACKER_FILE, JSON.stringify(updatedState, null, 2), 'utf-8');
      res.json({ status: 'ok' });
      return;
    }
    res.status(400).json({ error: 'Invalid cost tracker payload' });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error)?.message || 'Failed to save cost tracker' });
  }
});

app.post('/api/cost-tracker/reset', (req, res) => {
  try {
    const defaultState = getDefaultCostTracker();
    fs.writeFileSync(COST_TRACKER_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
    res.json({ status: 'ok', data: defaultState });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error)?.message || 'Failed to reset cost tracker' });
  }
});

// Encrypted Vault Persistence & Cryptographic Fallback APIs
app.get('/api/vault', (req, res) => {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
      res.json({ status: 'ok', encryptedPayload: raw });
      return;
    }
    res.json({ status: 'empty', encryptedPayload: null });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error)?.message || 'Failed to read vault' });
  }
});

app.post('/api/vault', (req, res) => {
  try {
    const { encryptedPayload } = req.body;
    if (encryptedPayload && typeof encryptedPayload === 'string') {
      fs.writeFileSync(VAULT_FILE, encryptedPayload, 'utf-8');
      res.json({ status: 'ok' });
      return;
    }
    res.status(400).json({ error: 'Payload missing' });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error)?.message || 'Failed to write vault' });
  }
});

// Server-side fallback encryption (for browsers/contexts where crypto.subtle is disabled)
app.post('/api/vault/encrypt', (req, res) => {
  try {
    const { store, password } = req.body;
    if (!store || !password) {
      res.status(400).json({ error: 'Store and password required' });
      return;
    }
    const salt = nodeCrypto.randomBytes(16);
    const iv = nodeCrypto.randomBytes(12);
    const key = nodeCrypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = JSON.stringify(store);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combinedData = Buffer.concat([encrypted, tag]);

    const payload = {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      data: combinedData.toString('base64'),
      updated: Date.now(),
    };
    const serialized = JSON.stringify(payload);
    fs.writeFileSync(VAULT_FILE, serialized, 'utf-8');
    res.json({ status: 'ok', encryptedPayload: serialized });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error)?.message || 'Encryption failed' });
  }
});

// Server-side fallback decryption (for browsers/contexts where crypto.subtle is disabled)
app.post('/api/vault/decrypt', (req, res) => {
  try {
    const { payload, password } = req.body;
    if (!payload || !password) {
      res.status(400).json({ error: 'Payload and password required' });
      return;
    }
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!parsed || !parsed.salt || !parsed.iv || !parsed.data) {
      res.status(400).json({ error: 'Invalid envelope format' });
      return;
    }
    const salt = Buffer.from(parsed.salt, 'base64');
    const iv = Buffer.from(parsed.iv, 'base64');
    const rawData = Buffer.from(parsed.data, 'base64');
    if (rawData.length < 16) {
      res.status(400).json({ error: 'Ciphertext buffer too short' });
      return;
    }
    const ciphertext = rawData.subarray(0, rawData.length - 16);
    const tag = rawData.subarray(rawData.length - 16);

    const key = nodeCrypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const store = JSON.parse(decrypted.toString('utf8'));
    res.json({ status: 'ok', store });
  } catch (err: unknown) {
    res.status(400).json({ error: 'Decryption failed (password mismatch or format error)' });
  }
});

// -------------------------------------------------------------
// 1. Video Transcriber API
// -------------------------------------------------------------
app.post('/api/video-transcriber/process', upload.single('file'), async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-'));
  try {
    const { url, chunkDuration = '30', operationMode = 'Transcribe Only', modelSize = 'base', openaiApiKey } = req.body;
    const chunkDurNum = parseInt(chunkDuration, 10) || 30;

    let inputPath = '';
    let title = 'Transcript';

    if (req.file) {
      inputPath = req.file.path;
      title = path.parse(req.file.originalname).name;
    } else if (url && url.trim()) {
      title = 'Web_Media';
      inputPath = await downloadUrlEphemeral(url.trim(), tempDir, true);
    } else {
      res.status(400).json({ error: 'Please provide either an uploaded file or a video URL.' });
      return;
    }

    // Extract mono 16kHz WAV
    const wavPath = path.join(tempDir, 'audio_16k.wav');
    await runFfmpeg([
      '-i', inputPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      wavPath,
      '-y'
    ]);

    const totalDuration = await getMediaDuration(wavPath);

    // Transcribe with OpenAI Whisper
    let transcriptText = '';
    const isTranscribeAndSummarize = operationMode === 'Transcribe & Summarize';

    // Verify OpenAI API key is set for Whisper
    if (!openaiApiKey || !openaiApiKey.trim().startsWith('sk-')) {
      res.status(400).json({
        error:
          'OpenAI API key is not set. Whisper transcription requires an OpenAI API key (sk-...). Please configure your key in Encrypted Secrets.',
      });
      return;
    }

    // Call OpenAI Whisper API directly
    try {
      const fileBuffer = fs.readFileSync(wavPath);
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'audio/wav' });
      formData.append('file', blob, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: formData,
      });

      if (!whisperRes.ok) {
        const errorJson = (await whisperRes.json().catch(() => ({}))) as {
          error?: { message?: string; type?: string; code?: string };
        };
        const errMsg =
          errorJson?.error?.message ||
          `OpenAI Whisper API error (HTTP ${whisperRes.status})`;
        res.status(whisperRes.status).json({
          error: `Transcription failed: ${errMsg}`,
        });
        return;
      }

      const whisperData = (await whisperRes.json()) as {
        text: string;
        segments?: Array<{ start: number; end: number; text: string }>;
      };

      if (whisperData.segments && whisperData.segments.length > 0) {
        transcriptText = whisperData.segments
          .map((s) => `[${formatSecondsToTimestamp(s.start)}] ${s.text.trim()}`)
          .join('\n');
      } else {
        transcriptText = whisperData.text || '';
      }
    } catch (whisperErr) {
      console.error('OpenAI Whisper failed:', whisperErr);
      res.status(500).json({
        error: `Transcription failed: ${(whisperErr as Error)?.message || 'OpenAI network error'}`,
      });
      return;
    }

    // Generate AI Summary if requested using GPT-4o-mini
    let summaryText = '';
    if (isTranscribeAndSummarize && transcriptText) {
      try {
        const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'Summarize the following transcript into concise, structured key points with bullet points.',
              },
              {
                role: 'user',
                content: transcriptText,
              },
            ],
            temperature: 0.3,
          }),
        });
        if (gptRes.ok) {
          const gptData = (await gptRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          summaryText = gptData?.choices?.[0]?.message?.content?.trim() || '';
        }
      } catch (gptErr) {
        console.warn('GPT summary error:', gptErr);
      }
    }

    const fullTranscriptWithHeader = `Title: ${title}\nDuration: ${Math.round(totalDuration)}s\nModel: Whisper (${modelSize})\nChunk Duration: ${chunkDurNum}s\n\n${transcriptText}`;

    res.json({
      title,
      durationSec: Math.round(totalDuration) || 60,
      transcript: fullTranscriptWithHeader,
      summary: summaryText,
    });
  } catch (err: unknown) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: (err as Error)?.message || 'Transcription failed' });
  } finally {
    if (req.file?.path) await safeRemove(req.file.path);
    await safeRemove(tempDir);
  }
});

// -------------------------------------------------------------
// 2. Media Clipper API
// -------------------------------------------------------------
app.post('/api/media-clipper/process', upload.single('file'), async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipper-'));
  try {
    const { url, startTime = '00:00:00', endTime = '00:00:30', extractChoice = 'Audio (.mp3)' } = req.body;
    const isAudio = extractChoice.toLowerCase().includes('audio') || extractChoice.toLowerCase().includes('mp3');

    let inputPath = '';
    let baseName = 'media_clip';

    if (req.file) {
      inputPath = req.file.path;
      baseName = path.parse(req.file.originalname).name;
    } else if (url && url.trim()) {
      inputPath = await downloadUrlEphemeral(url.trim(), tempDir, isAudio);
      baseName = 'web_clip';
    } else {
      res.status(400).json({ error: 'Please provide either a media file or a media URL.' });
      return;
    }

    const startSec = parseTimeToSeconds(startTime);
    const endSec = parseTimeToSeconds(endTime);
    if (endSec <= startSec) {
      res.status(400).json({ error: 'End time must be greater than start time.' });
      return;
    }
    const duration = endSec - startSec;

    const outputExt = isAudio ? 'mp3' : 'mp4';
    const outputFilename = `${baseName}_clip_${startTime.replace(/:/g, '')}-${endTime.replace(/:/g, '')}.${outputExt}`;
    const outputPath = path.join(tempDir, outputFilename);

    if (isAudio) {
      await runFfmpeg([
        '-ss', startSec.toString(),
        '-i', inputPath,
        '-t', duration.toString(),
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        outputPath,
        '-y'
      ]);
    } else {
      // Check available streams via ffprobe
      let hasVideoStream = true;
      let hasAudioStream = true;
      try {
        const { stdout } = await runFfprobe([
          '-v', 'error',
          '-show_entries', 'stream=codec_type',
          '-of', 'json',
          inputPath
        ]);
        const streams = JSON.parse(stdout).streams || [];
        hasVideoStream = streams.some((s: any) => s.codec_type === 'video');
        hasAudioStream = streams.some((s: any) => s.codec_type === 'audio');
      } catch (probeErr) {
        console.warn('ffprobe stream check warning:', probeErr);
      }

      if (!hasVideoStream) {
        // Pure audio file provided, but user requested video clip (.mp4)
        // Synthesize a solid background video with the audio stream
        await runFfmpeg([
          '-ss', startSec.toString(),
          '-i', inputPath,
          '-f', 'lavfi',
          '-i', 'color=c=0x121212:s=640x360:r=30',
          '-t', duration.toString(),
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'fast',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-shortest',
          '-movflags', '+faststart',
          outputPath,
          '-y'
        ]);
      } else {
        // Normal video clip: ensure libx264 with yuv420p and faststart for browser playback
        const clipArgs = [
          '-ss', startSec.toString(),
          '-i', inputPath,
          '-t', duration.toString(),
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'fast',
        ];
        if (hasAudioStream) {
          clipArgs.push('-c:a', 'aac', '-b:a', '128k');
        } else {
          clipArgs.push('-an');
        }
        clipArgs.push('-movflags', '+faststart', outputPath, '-y');
        await runFfmpeg(clipArgs);
      }
    }

    const fileBuffer = fs.readFileSync(outputPath);
    const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

    res.json({
      filename: outputFilename,
      dataUrl,
      durationSec: duration,
      sizeBytes: fileBuffer.byteLength,
      mode: isAudio ? 'Audio' : 'Video',
    });
  } catch (err: unknown) {
    console.error('Clipping error:', err);
    res.status(500).json({ error: (err as Error)?.message || 'Clipping failed' });
  } finally {
    if (req.file?.path) await safeRemove(req.file.path);
    await safeRemove(tempDir);
  }
});

// -------------------------------------------------------------
// 3. Audiobook Snippet Transcriber API
// -------------------------------------------------------------
app.post('/api/audiobook/process', upload.single('file'), async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audiobook-'));
  try {
    const { hours = '0', minutes = '0', seconds = '0', duration = '60', modelSize = 'base', openaiApiKey, filePath } = req.body;
    
    let inputPath = '';
    let originalName = 'audiobook.m4b';

    if (req.file) {
      inputPath = req.file.path;
      originalName = req.file.originalname;
    } else if (filePath && typeof filePath === 'string' && filePath.trim()) {
      const cleanPath = filePath.trim();
      originalName = path.basename(cleanPath.replace(/\\/g, '/')) || 'audiobook.m4b';
      if (fs.existsSync(cleanPath)) {
        inputPath = cleanPath;
      } else {
        res.status(400).json({
          error: `Server file path not found: "${cleanPath}". When deployed in production on your local host, NAS, or Windows/Linux server, this path will be processed directly from disk without upload. In this preview container, please use the Upload File tab to test with a local file.`,
        });
        return;
      }
    } else {
      res.status(400).json({ error: 'Please provide either an uploaded audiobook file or a local server file path.' });
      return;
    }

    const startSec = (parseInt(hours, 10) || 0) * 3600 + (parseInt(minutes, 10) || 0) * 60 + (parseInt(seconds, 10) || 0);
    const durSec = parseInt(duration, 10) || 60;

    // Extract snippet
    const snippetPath = path.join(tempDir, 'snippet.wav');
    await runFfmpeg([
      '-ss', startSec.toString(),
      '-i', inputPath,
      '-t', durSec.toString(),
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      snippetPath,
      '-y'
    ]);

    // Extract ID3 metadata via ffprobe
    let book = path.parse(originalName).name;
    let author = 'Unknown Author';
    try {
      const { stdout } = await runFfprobe([
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        inputPath
      ]);
      const meta = JSON.parse(stdout);
      const tags = meta.format?.tags || {};
      if (tags.title) book = tags.title.replace(/[:/\\]/g, '-');
      if (tags.artist || tags.album_artist || tags.composer) {
        author = (tags.artist || tags.album_artist || tags.composer).replace(/[:/\\]/g, '-');
      }
    } catch (e) {
      console.warn('ffprobe metadata error:', e);
    }

    // Transcribe snippet with OpenAI Whisper
    if (!openaiApiKey || !openaiApiKey.trim().startsWith('sk-')) {
      res.status(400).json({
        error:
          'OpenAI API key is not set. Audiobook Whisper transcription requires an OpenAI API key (sk-...). Please configure your key in Encrypted Secrets.',
      });
      return;
    }

    let transcript = '';
    try {
      const fileBuffer = fs.readFileSync(snippetPath);
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'audio/wav' });
      formData.append('file', blob, 'snippet.wav');
      formData.append('model', 'whisper-1');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiApiKey}` },
        body: formData,
      });

      if (!whisperRes.ok) {
        const errorJson = (await whisperRes.json().catch(() => ({}))) as {
          error?: { message?: string; type?: string; code?: string };
        };
        const errMsg =
          errorJson?.error?.message ||
          `OpenAI Whisper API error (HTTP ${whisperRes.status})`;
        res.status(whisperRes.status).json({
          error: `Transcription failed: ${errMsg}`,
        });
        return;
      }

      const data = (await whisperRes.json()) as { text: string };
      transcript = data.text?.trim() || '';
    } catch (err) {
      console.error('Audiobook whisper error:', err);
      res.status(500).json({
        error: `Transcription failed: ${(err as Error)?.message || 'OpenAI network error'}`,
      });
      return;
    }

    // Create playable audio mp3
    const snippetMp3 = path.join(tempDir, 'snippet.mp3');
    await runFfmpeg([
      '-i', snippetPath,
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      snippetMp3,
      '-y'
    ]);
    const mp3Buffer = fs.readFileSync(snippetMp3);
    const audioDataUrl = `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`;

    const timestampLabel = `${hours.toString().padStart(2, '0')}h${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`;
    const resultFilename = `${book} - ${author} - ${timestampLabel}-${durSec}s.txt`;

    res.json({
      book,
      author,
      timestamp: timestampLabel,
      duration: durSec,
      transcript,
      filename: resultFilename,
      audioDataUrl,
    });
  } catch (err: unknown) {
    console.error('Audiobook error:', err);
    res.status(500).json({ error: (err as Error)?.message || 'Audiobook processing failed' });
  } finally {
    if (req.file?.path) await safeRemove(req.file.path);
    await safeRemove(tempDir);
  }
});

// -------------------------------------------------------------
// 4. Audio Extractor API
// -------------------------------------------------------------
app.post('/api/audio-extractor/process', upload.single('file'), async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extractor-'));
  try {
    const { url, startTimeSec = '0', durationSec = '30' } = req.body;
    let inputPath = '';
    let baseName = 'extracted_audio';

    if (req.file) {
      inputPath = req.file.path;
      baseName = path.parse(req.file.originalname).name;
    } else if (url && url.trim()) {
      inputPath = await downloadUrlEphemeral(url.trim(), tempDir, true);
      baseName = 'web_extracted';
    } else {
      res.status(400).json({ error: 'Please upload a media file or provide a URL.' });
      return;
    }

    const start = parseFloat(startTimeSec) || 0;
    const dur = parseFloat(durationSec) || 30;

    const outputFilename = `${baseName}_${Math.round(start)}s_${Math.round(dur)}s.mp3`;
    const outputPath = path.join(tempDir, outputFilename);

    await runFfmpeg([
      '-ss', start.toString(),
      '-i', inputPath,
      '-t', dur.toString(),
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      outputPath,
      '-y'
    ]);

    const fileBuffer = fs.readFileSync(outputPath);
    const dataUrl = `data:audio/mpeg;base64,${fileBuffer.toString('base64')}`;

    res.json({
      filename: outputFilename,
      dataUrl,
      durationSec: dur,
      sizeBytes: fileBuffer.byteLength,
    });
  } catch (err: unknown) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: (err as Error)?.message || 'Extraction failed' });
  } finally {
    if (req.file?.path) await safeRemove(req.file.path);
    await safeRemove(tempDir);
  }
});

// Health check & environment diagnostics
app.get('/api/health', async (req, res) => {
  const ffmpegPath = getFfmpegPath();
  const ffprobePath = getFfprobePath();
  let ffmpegReady = false;
  let ffmpegVersion = '';
  try {
    const { stdout } = await runFfmpeg(['-version']);
    ffmpegReady = true;
    ffmpegVersion = stdout.split('\n')[0];
  } catch (e: any) {
    ffmpegVersion = e?.message || 'FFmpeg unavailable';
  }

  res.json({
    status: 'ok',
    ffmpeg: {
      ready: ffmpegReady,
      path: ffmpegPath,
      version: ffmpegVersion,
    },
    ffprobe: {
      path: ffprobePath,
    },
  });
});

// Vite middleware / static files
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Primary listener on requested port
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Media Suite server listening on http://0.0.0.0:${PORT}`);
  });

  // Secondary listener: ensure both default 4261 and container proxy 3000 work simultaneously
  const secondaryPort = PORT === 4261 ? 3000 : 4261;
  try {
    const secondaryServer = app.listen(secondaryPort, '0.0.0.0', () => {
      console.log(`Also listening on port ${secondaryPort} (dual-port readiness)`);
    });
    secondaryServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${secondaryPort} is occupied by another process; running on port ${PORT}`);
      } else {
        console.warn(`Port ${secondaryPort} listener notice:`, err.message);
      }
    });
  } catch {
    // Ignored
  }
}

start();
