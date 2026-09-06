// Code snippets for Streamlit environment viewer & export

export const CODE_SNIPPETS = {
  requirements: `# Combined requirements.txt for Streamlit Unified Media Suite
streamlit>=1.35.0
altair>=5.0.0
yt-dlp>=2024.08.06
pytube>=15.0.0
openai-whisper>=20231117
torch>=2.2.0
torchaudio>=2.2.0
numpy>=1.24.0,<2.0.0
pydub>=0.25.1
moviepy>=1.0.3
ffmpeg-python>=0.2.0
openai>=1.30.0
cryptography>=42.0.5
python-dotenv>=1.0.1
requests>=2.31.0
typing-extensions>=4.10.0`,

  readme: `# 🎧 Streamlit Unified Media Suite

A consolidated, production-grade Streamlit web application integrating four specialized video and audio processing modules with dark mode (default), persistent cross-module state, background task management, zero server-retention auto-cleanup, an AES-encrypted secret store, and per-module cost tracking.

## 🚀 Integrated Functional Modules
1. Video Transcription Tool (Whisper + yt-dlp + GPT-4o-mini summary + waveform)
2. Audio/Video Clipper (Exact hh:mm:ss clipping via FFmpeg into mp3 or mp4)
3. Audiobook Snippet Transcriber (ffprobe metadata extraction + Whisper transcription)
4. Audio Extractor Tool (Timeline slider extraction into mp3)

## 🛡️ Key Features
- AES-GCM Encrypted Secrets Vault for OpenAI API keys & tokens
- Provider Key Strategy: Unified key across all modules OR dedicated per-module keys
- Zero Server Retention: Ephemeral temporary storage auto-cleared upon execution/download
- Real-time Cost Tracker: Monitors Whisper audio minutes, LLM tokens, and budget alerts

## ⚙️ Quickstart Setup
\`\`\`bash
# 1. Install FFmpeg
sudo apt-get install ffmpeg  # Linux
brew install ffmpeg          # macOS

# 2. Virtual Environment
python3 -m venv venv
source venv/bin/activate

# 3. Install Combined Dependencies
pip install -r requirements.txt

# 4. Run Streamlit App
streamlit run app.py
\`\`\``,

  appPy: `import streamlit as st
from utils.crypto_vault import EncryptedVault
from utils.cost_calculator import CostTracker
from modules.video_transcriber import render_video_transcriber
from modules.media_clipper import render_media_clipper
from modules.audiobook_transcriber import render_audiobook_transcriber
from modules.audio_extractor import render_audio_extractor

st.set_page_config(page_title="Streamlit Unified Media Suite", page_icon="🎙️", layout="wide")

if "vault" not in st.session_state:
    st.session_state.vault = EncryptedVault()
if "cost_tracker" not in st.session_state:
    st.session_state.cost_tracker = CostTracker()

# Sidebar Navigation with State Persistence
with st.sidebar:
    st.title("🎙️ Media Suite")
    st.caption("Zero-retention ephemeral memory architecture")
    page = st.radio("Navigation", [
        "🎥 Video Transcription",
        "🎬 Audio/Video Clipper",
        "📚 Audiobook Transcriber",
        "🎵 Audio Extractor",
        "⚙️ Encrypted Secrets Vault",
        "📊 Usage Costs & Budget"
    ])

if page == "🎥 Video Transcription":
    render_video_transcriber(st.session_state.vault, st.session_state.cost_tracker)
elif page == "🎬 Audio/Video Clipper":
    render_media_clipper(st.session_state.vault, st.session_state.cost_tracker)
elif page == "📚 Audiobook Transcriber":
    render_audiobook_transcriber(st.session_state.vault, st.session_state.cost_tracker)
elif page == "🎵 Audio Extractor":
    render_audio_extractor(st.session_state.vault, st.session_state.cost_tracker)`
};
