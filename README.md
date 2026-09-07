# W.'s Simple Media Tools

A local-first web utility for media transcription and trimming.

**Repository**: [https://github.com/raviwarrier/W.-s-Simple-Media-Tools](https://github.com/raviwarrier/W.-s-Simple-Media-Tools)

---

## Overview

W.'s Simple Media Tools provides three core utilities for media processing:
1. **Video Transcriber**: Transcribes speech from uploaded video/audio files or supported URLs, with optional summary and chapter generation.
2. **Media Clipper**: Trims and extracts user-defined segments from video and audio files by timestamp (`hh:mm:ss`).
3. **Audiobook Transcriber**: Transcribes audiobook files with chunked processing and automatic metadata extraction.

---

## AI Models Used

This application connects to external AI models via the OpenAI API for transcription and language tasks:
- **OpenAI Whisper (`whisper-1`)**: Used for speech-to-text audio transcription in the Video Transcriber and Audiobook Transcriber modules.
- **OpenAI GPT-4o-mini (`gpt-4o-mini`)**: Used for optional post-transcription summarization, key takeaway extraction, and structured outline generation.

*Note: Media Clipper runs entirely via local FFmpeg processing on your machine or container and does not call any external AI models.*

---

## Cost Notice (It Costs Money)

Using the AI transcription and summarization features in this application **incurs financial charges** billed directly to your OpenAI API account.

### Current Pricing Reference
- **Whisper Speech-to-Text**: $0.006 per minute of audio (~$0.36 per hour).
- **GPT-4o-mini (Summarization)**:
  - Input: $0.15 per 1,000,000 tokens.
  - Output: $0.60 per 1,000,000 tokens.
- **Media Clipper**: $0.00 API cost (processed locally via FFmpeg).

The built-in Cost Analytics module logs approximate costs based on audio duration and processed tokens, but actual amounts billed are determined solely by OpenAI.

---

## ⚠️ Audiobook & Large File Cost Warning

Transcribing an audiobook or lengthy recording entails uploading large files and might incur **significant AI API costs**:
- **High Audio Duration**: Because Whisper is billed by total audio duration ($0.006/min), an 8-hour audiobook costs approximately **$2.88**, a 15-hour audiobook costs approximately **$5.40**, and a 30-hour audiobook costs approximately **$10.80** for transcription alone.
- **Summarization Token Multiplier**: Requesting extensive summaries or chapter outlines on long transcripts submits tens of thousands of tokens to the language model, adding further charges.
- **Large File Uploads**: Audiobook files (e.g., MP3, M4B, AAC) often range from 200 MB to multiple gigabytes. Uploading and splitting these files requires substantial upload bandwidth and processing time.
- **Pre-flight Check**: Always verify the exact duration and size of your files, and configure hard spending limits in your OpenAI dashboard before initiating long transcription runs.

---

## Usage Caution

- **Set Spending Limits**: Configure hard and soft monthly spending caps in your OpenAI account dashboard (`platform.openai.com/account/limits`) to prevent unintended charges.
- **API Key Security**: Your API keys are stored in an AES-256-GCM encrypted client-side vault with a device passkey and optionally mirrored to an encrypted local backup file (`data/vault.enc.json`). Never commit API keys or unencrypted secret files to version control.
- **Ephemeral Storage**: Uploaded files and temporary processing segments are purged when tasks finish, when manually cleared, or when the server restarts.

---

## System Requirements

- **Node.js**: Version 18.0.0 or higher (Node 20+ LTS recommended)
- **FFmpeg & ffprobe**: Self-contained static binaries (`ffmpeg-static` and `ffprobe-static`) are bundled automatically as npm dependencies. If you have a system-level installation or hardware-accelerated build, you can point to it via `FFMPEG_PATH` and `FFPROBE_PATH` environment variables.
- **yt-dlp**: Required for fetching media from supported external URLs (optional if only uploading local files)

On Debian/Ubuntu systems:
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg curl python3
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

On macOS (using Homebrew):
```bash
brew install node ffmpeg yt-dlp
```

---

## Installation & Setup

### Option 1: Direct Run with npm

#### Initial Installation
```bash
# 1. Clone the repository
git clone https://github.com/raviwarrier/W.-s-Simple-Media-Tools.git
cd W.-s-Simple-Media-Tools

# 2. Install dependencies
npm install

# 3. Build client and server bundles
npm run build

# 4. Start the application
npm start
```
The application will be accessible at `http://localhost:4261`.

#### Updating via npm
```bash
# 1. Pull latest code
git pull

# 2. Update dependencies
npm install

# 3. Rebuild bundles
npm run build

# 4. Restart server (press Ctrl+C on existing process and restart)
npm start
```

---

### Option 2: Production Service with PM2

[PM2](https://pm2.keymetrics.io/) keeps the application running in the background and automatically restarts it if the server restarts or crashes.

#### Initial Installation
```bash
# 1. Install PM2 globally if not already installed
npm install -g pm2

# 2. Clone and install dependencies
git clone https://github.com/raviwarrier/W.-s-Simple-Media-Tools.git
cd W.-s-Simple-Media-Tools
npm install

# 3. Build the application
npm run build

# 4. Start with PM2 (listening on default port 4261)
pm2 start dist/server.cjs --name "w-simple-media-tools"

# 5. (Optional) Save process list to restart on system boot
pm2 save
pm2 startup
```

#### Managing PM2 Process
```bash
# View status
pm2 status

# View live output logs
pm2 logs w-simple-media-tools

# Restart or stop the service
pm2 restart w-simple-media-tools
pm2 stop w-simple-media-tools
```

#### Updating via PM2
```bash
# 1. Pull latest code
git pull

# 2. Update dependencies and recompile
npm install
npm run build

# 3. Gracefully reload or restart the process
pm2 restart w-simple-media-tools
```

---

### Option 3: Containerized with Docker

A multi-stage container build containing Node.js 20, FFmpeg, and yt-dlp is provided.

#### Initial Installation with Docker
```bash
# 1. Clone the repository
git clone https://github.com/raviwarrier/W.-s-Simple-Media-Tools.git
cd W.-s-Simple-Media-Tools

# 2. Build the Docker image
docker build -t w-simple-media-tools .

# 3. Run the container with a persistent volume for data/ (cost logs & encrypted vault)
docker run -d \
  --name w-simple-media-tools \
  -p 4261:4261 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  w-simple-media-tools
```

#### Initial Installation with Docker Compose
```bash
# 1. Clone the repository
git clone https://github.com/raviwarrier/W.-s-Simple-Media-Tools.git
cd W.-s-Simple-Media-Tools

# 2. Start container in background
docker compose up -d --build
```
The application will run on `http://localhost:4261`.

#### Updating with Docker
```bash
# 1. Pull latest changes
git pull

# 2. Rebuild and restart using Docker:
docker stop w-simple-media-tools
docker rm w-simple-media-tools
docker build -t w-simple-media-tools .
docker run -d \
  --name w-simple-media-tools \
  -p 4261:4261 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  w-simple-media-tools

# OR using Docker Compose:
docker compose up -d --build
```

---

## Technologies and Libraries Used

- **Frontend**:
  - React 19 / React 18
  - TypeScript
  - Vite
  - Tailwind CSS
  - Lucide React (UI icons)
  - Web Crypto API (AES-256-GCM vault encryption)
- **Backend & Server**:
  - Node.js
  - Express
  - Multer (temporary multipart file handling)
- **Processing Engines**:
  - FFmpeg (stream analysis, chunking, and video trimming)
  - ffprobe (media duration and audio metadata extraction)
  - yt-dlp (stream downloading from supported URLs)

---

## Vibe Coding Disclosure

This codebase was developed and iterated using AI-assisted "vibe coding" — prompted in natural language through AI Studio and Antigravity coding agents. Code structures, UI components, and backend endpoints were generated, tested, and refined through AI-assisted workflows.

---

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
