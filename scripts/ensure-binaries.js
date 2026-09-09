import fs from 'fs';
import path from 'path';
import { execFile, execSync } from 'child_process';
import https from 'https';

const BIN_DIR = path.join(process.cwd(), 'bin');
const YTDLP_PATH = path.join(BIN_DIR, 'yt-dlp');

export function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: HTTP status ${response.statusCode}`));
      }
      const fileStream = fs.createWriteStream(dest);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => resolve(dest));
      });
      fileStream.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export async function ensureYtDlp() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  // Check if system already has yt-dlp
  try {
    const sysPath = execSync('which yt-dlp', { encoding: 'utf8' }).trim();
    if (sysPath && fs.existsSync(sysPath)) {
      console.log(`[ensure-binaries] yt-dlp found on system PATH: ${sysPath}`);
      return sysPath;
    }
  } catch {}

  // Check if project bin/yt-dlp exists and works
  if (fs.existsSync(YTDLP_PATH)) {
    try {
      fs.chmodSync(YTDLP_PATH, 0o755);
      const version = execSync(`"${YTDLP_PATH}" --version`, { encoding: 'utf8' }).trim();
      console.log(`[ensure-binaries] Local yt-dlp verified (v${version}) at ${YTDLP_PATH}`);
      return YTDLP_PATH;
    } catch (e) {
      console.warn(`[ensure-binaries] Local yt-dlp exists but execution check failed (${e.message}). Re-downloading...`);
    }
  }

  console.log(`[ensure-binaries] Downloading latest standalone yt-dlp binary to ${YTDLP_PATH}...`);
  const downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  try {
    // Try curl first (very fast and handles redirects natively)
    try {
      execSync(`curl -L "${downloadUrl}" -o "${YTDLP_PATH}"`, { stdio: 'ignore', timeout: 30000 });
    } catch {
      // Fallback to node https
      await downloadFile(downloadUrl, YTDLP_PATH);
    }

    fs.chmodSync(YTDLP_PATH, 0o755);
    const ver = execSync(`"${YTDLP_PATH}" --version`, { encoding: 'utf8' }).trim();
    console.log(`[ensure-binaries] yt-dlp successfully installed and verified: v${ver}`);
    return YTDLP_PATH;
  } catch (err) {
    console.error(`[ensure-binaries] Failed to download or verify yt-dlp:`, err);
    throw err;
  }
}

// When run directly as a script (e.g. via postinstall)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  ensureYtDlp()
    .then((p) => {
      console.log(`[ensure-binaries] yt-dlp readiness verified at ${p}`);
      process.exit(0);
    })
    .catch((err) => {
      console.warn(`[ensure-binaries] Warning: yt-dlp auto-setup encountered an error:`, err.message);
      // Don't fail build if offline during build, runtime self-healing in server.ts will catch it
      process.exit(0);
    });
}
