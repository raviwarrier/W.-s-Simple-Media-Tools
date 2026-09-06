# 🎧 Streamlit Unified Media Suite

A consolidated, production-grade Streamlit web application integrating four specialized video and audio processing modules with dark mode (default), persistent cross-module state, background task management, zero server-retention auto-cleanup, an AES-encrypted secret store, and per-module cost tracking.

---

## 🚀 Integrated Functional Modules

1. **🎥 Video Transcription Tool** (based on `v1.21.2`):
   - YouTube / Web URL downloading via `yt-dlp` or local video file upload (`mp4`, `mov`, `avi`, `mkv`, `webm`, etc.).
   - Chunked transcription using OpenAI Whisper (`tiny`, `base`, `small`, `medium`, `large`).
   - Real-time audio waveform visualizer and progress indicators.
   - AI summarization via OpenAI `gpt-4o-mini` with customizable temperatures and beams.
   - Immediate `.txt` transcript download and automated audio file deletion.

2. **🎬 Audio/Video Clipper**:
   - Downloads media via `yt-dlp` or handles direct file uploads.
   - Precise timestamp clipping using `hh:mm:ss` format.
   - High-fidelity FFmpeg extraction into either `.mp3` (re-encoded via `libmp3lame`) or `.mp4` stream copy.
   - Instant file delivery with automated clip cleanup.

3. **📚 Audiobook Snippet Transcriber** (based on `v1.7`):
   - Accepts audiobook files (`mp3`, `m4a`, `m4b`, `ogg`).
   - Extract snippets by hours, minutes, seconds, and custom duration.
   - Extracts ID3 metadata tags (Title, Artist/Author, Album) using `ffprobe`.
   - Generates standardized named transcripts (`Book - Author - 00h00m00s-60s.txt`) with Whisper `base`.

4. **🎵 Audio Extractor Tool**:
   - Extracts crystal-clear audio segments from uploaded media or video URLs.
   - Interactive duration and start-time sliders with video playback preview.
   - Extracts audio into `.mp3` via `pydub` and `moviepy`.

---

## 🛡️ Security & Privacy Architecture

### 1. Encrypted Secrets Vault (AES-GCM / Fernet)
- All secrets (OpenAI API keys, Whisper tokens, cookies) are stored in an encrypted vault (`.secrets_vault.enc`) derived from a master passphrase using PBKDF2 with 100,000 iterations and salt.
- **Provider Key Strategy**:
  - **Unified Key**: Use a single OpenAI API key for all modules.
  - **Per-Module Keys**: Specify different OpenAI API keys for Video Transcription vs Audiobook Transcriber vs General operations.
  - The UI provides clear indicators of which key is active for each module.

### 2. Zero-Retention Auto-Cleanup Policy
- To conserve server storage and protect user privacy:
  - Input files and intermediate `.wav` / `.mp4` / `.mp3` files are allocated in ephemeral temporary directories.
  - Files are served directly for immediate download and automatically purged via context managers or explicit post-run cleanup hooks.
  - No customer media is permanently retained on disk.

### 3. Usage Cost & Budget Monitoring
- Real-time cost indicators track usage across operations:
  - **Whisper Transcription**: ~$0.006 per audio minute.
  - **OpenAI GPT-4o-mini**: $0.15 / 1M input tokens, $0.60 / 1M output tokens.
  - **Compute & Bandwidth**: Estimated resource metrics.
- Users can set a daily/monthly budget ceiling with visual alert thresholds (e.g. 80% warning).

---

## ⚙️ Environment Setup & Installation

### Step 1: System Prerequisites (FFmpeg)
FFmpeg and FFprobe are required for media extraction and chunking.

- **Ubuntu / Debian Linux**:
  ```bash
  sudo apt-get update && sudo apt-get install -y ffmpeg
  ```
- **macOS** (via Homebrew):
  ```bash
  brew install ffmpeg
  ```
- **Windows** (via Chocolatey or Winget):
  ```powershell
  winget install Gyan.FFmpeg
  # or
  choco install ffmpeg
  ```
  *Ensure `ffmpeg` and `ffprobe` are available in your system `PATH`.*

---

### Step 2: Python Environment Setup

We recommend creating a fresh virtual environment using Python 3.10+:

#### Option A: Using `conda`
```bash
conda create -n media-suite python=3.10 -y
conda activate media-suite
```

#### Option B: Using `venv`
```bash
python3 -m venv venv
# On Linux/macOS:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate
```

---

### Step 3: Install Combined Dependencies

Install all consolidated requirements for the unified environment:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

> **Note on PyTorch**: If you have an NVIDIA GPU and want GPU-accelerated Whisper transcription, install the CUDA-enabled PyTorch build from [pytorch.org](https://pytorch.org/get-started/locally/):
> ```bash
> pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
> ```

---

### Step 4: Configuration & Environment Variables

Copy the example configuration:
```bash
cp .env.example .env
```

You can either enter your API keys into `.env` or manage them securely in the app's **Settings > Encrypted Secrets Vault** UI.

---

### Step 5: Launching the Application

Run the master Streamlit application:

```bash
streamlit run app.py
```

The application will open in your default browser at `http://localhost:8501`. Dark mode is configured as the default theme.

---

## 📁 Repository Structure

```
├── app.py                     # Master Streamlit entry point with navigation & state persistence
├── requirements.txt           # Unified dependency specifications
├── README.md                  # Comprehensive environment setup guide
├── modules/
│   ├── video_transcriber.py   # Module 1: Video Transcription & Summarizer
│   ├── media_clipper.py       # Module 2: Audio/Video Clipper
│   ├── audiobook_transcriber.py # Module 3: Audiobook Snippet Transcriber
│   └── audio_extractor.py     # Module 4: Quick Audio Extractor
└── utils/
    ├── crypto_vault.py        # PBKDF2 + AES-GCM Encrypted Key Storage
    ├── cost_calculator.py     # Per-module budget & token expense tracker
    └── cleanup.py             # Zero-retention ephemeral file purger
```
