import os
import re
import datetime
import subprocess
import time
import numpy as np
import streamlit as st
import yt_dlp
import whisper
import openai
from utils.cleanup import ephemeral_workspace

def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/*?:"<>|]', "", name)

def quick_ytdlp_check(url: str, cookies_profile: str = "") -> bool:
    opts = {"quiet": True, "skip_download": True, "no_warnings": True}
    if cookies_profile and os.path.exists(cookies_profile):
        opts["cookies_from_browser"] = (f"firefox:{cookies_profile}",)
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info(url, download=False)
        return True
    except Exception:
        return False

def download_audio_ephemeral(url: str, target_dir: str, cookies_profile: str = ""):
    bar = st.progress(0)
    info_text = st.empty()

    def hook(d):
        if d.get("status") == "downloading":
            tb = d.get("total_bytes") or d.get("total_bytes_estimate")
            db = d.get("downloaded_bytes", 0)
            if tb:
                p = min(int(db / tb * 100), 100)
                bar.progress(p)
                eta = d.get("eta")
                info_text.text(f"Downloaded {db/1e6:.2f}/{tb/1e6:.2f} MB" + (f", ETA {eta}s" if eta else ""))
        elif d.get("status") == "finished":
            bar.progress(100)
            info_text.text("Download complete.")

    opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": os.path.join(target_dir, "%(title)s.%(ext)s"),
        "progress_hooks": [hook],
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav", "preferredquality": "192"}],
        "quiet": True,
        "no_warnings": True,
    }
    if cookies_profile and os.path.exists(cookies_profile):
        opts["cookies_from_browser"] = (f"firefox:{cookies_profile}",)

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        fn = ydl.prepare_filename(info)
        return info, os.path.splitext(fn)[0] + ".wav"

@st.cache_resource
def load_whisper_model(size: str):
    return whisper.load_model(size)

def transcribe_chunks(audio_file: str, chunk_dur: int, model_size: str, decode_opts, stop_key="m1_stop"):
    audio = whisper.load_audio(audio_file)
    total = len(audio)
    sr = 16000
    per = int(chunk_dur * sr)
    nchunks = int(np.ceil(total / per))
    model = load_whisper_model(model_size)
    out = ""
    prog = st.progress(0)
    for i in range(nchunks):
        if st.session_state.get(stop_key, False):
            out += "\n[Stopped by user]\n"
            break
        start = i * per
        end = min((i + 1) * per, total)
        chunk = audio[start:end]
        if len(chunk) < per:
            chunk = np.pad(chunk, (0, per - len(chunk)))
        mel = whisper.log_mel_spectrogram(chunk).to(model.device)
        try:
            r = model.decode(mel, decode_opts)
            ts = str(datetime.timedelta(seconds=i * chunk_dur))
            out += f"[{ts}] {r.text.strip()}\n"
        except Exception:
            ts = str(datetime.timedelta(seconds=i * chunk_dur))
            out += f"[{ts}] [Transcription Error]\n"
        prog.progress(int((i + 1) / nchunks * 100))
    return out, total / sr

def summarize_with_openai(text: str, api_key: str):
    if not api_key:
        return "[Error: No OpenAI API key configured. Please set in Settings.]"
    try:
        client = openai.OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Summarize the following transcript into concise, structured key points."},
                {"role": "user", "content": text}
            ],
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"[Summarization Error: {e}]"

def render_video_transcriber(vault, cost_tracker):
    st.header("🎥 Video Transcription Tool")
    st.caption("Extract audio from YouTube or local videos, transcribe with Whisper, and summarize with OpenAI.")

    # Key status badge
    active_key = vault.get_openai_key("video_transcriber")
    mode = vault.data.get("key_mode", "unified")
    if active_key:
        st.success(f"🔑 Active API Key: `{mode.upper()}` mode (Key ending in ...{active_key[-4:] if len(active_key) > 4 else '***'})")
    else:
        st.warning("⚠️ No OpenAI API key configured for this module. Transcriptions work, but summarization will be disabled.")

    col1, col2 = st.columns([1.5, 2.5])

    # Module state initialization
    st.session_state.setdefault("m1_url", "")
    st.session_state.setdefault("m1_url_status", "")
    st.session_state.setdefault("m1_in_progress", False)
    st.session_state.setdefault("m1_stop", False)
    st.session_state.setdefault("m1_transcription", "")
    st.session_state.setdefault("m1_summary", "")
    st.session_state.setdefault("m1_waveform", None)
    st.session_state.setdefault("m1_download_ready", None)

    with col1:
        st.markdown("### ⚙️ Input & Settings")
        url = st.text_input("Video URL (YouTube, etc.):", key="m1_url_input", value=st.session_state.m1_url)
        uploaded = st.file_uploader("Or upload video file:", type=["mp4","mov","avi","mkv","webm","flv","wmv"])

        size = st.selectbox("Whisper model size:", ["tiny","base","small","medium","large"], index=1)

        with st.expander("Advanced Decoding Settings"):
            temp = st.slider("Temperature:", 0.0, 1.0, 0.0, 0.1, help="0 = deterministic")
            beam = st.slider("Beam size:", 1, 10, 5, 1, help="Higher beam size = higher accuracy, slower")
            decode_opts = whisper.DecodingOptions(fp16=False, temperature=temp, beam_size=beam)

        chunk_dur = st.slider("Chunk duration (seconds):", 10, 60, 30, 5)
        show_waveform = st.checkbox("Show audio waveform visualization", value=True)
        op_choice = st.radio("Operation mode:", ["Transcribe Only", "Transcribe & Summarize"], index=0)

        # Action buttons
        c_btn1, c_btn2 = st.columns(2)
        with c_btn1:
            run_btn = st.button("🚀 Process Video", disabled=st.session_state.m1_in_progress)
        with c_btn2:
            if st.session_state.m1_in_progress:
                if st.button("⏹️ Stop"):
                    st.session_state.m1_stop = True

        if run_btn:
            if not url and not uploaded:
                st.error("Please provide either a video URL or an uploaded file.")
                return

            st.session_state.m1_stop = False
            st.session_state.m1_in_progress = True

            with ephemeral_workspace() as temp_dir:
                try:
                    start_time = time.time()
                    if uploaded:
                        temp_in = os.path.join(temp_dir, sanitize_filename(uploaded.name))
                        with open(temp_in, "wb") as f:
                            f.write(uploaded.getbuffer())
                        wav_path = os.path.splitext(temp_in)[0] + ".wav"
                        subprocess.run([
                            "ffmpeg", "-i", temp_in, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", wav_path, "-y"
                        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                        audio_file = wav_path
                        title = os.path.splitext(uploaded.name)[0]
                        src = f"Local Upload: {uploaded.name}"
                    else:
                        st.info("Downloading media audio...")
                        info, audio_file = download_audio_ephemeral(url, temp_dir)
                        title = info.get("title", "transcript")
                        src = f"URL: {url}"

                    arr = whisper.load_audio(audio_file)
                    st.session_state.m1_waveform = arr if show_waveform else None

                    st.info("Transcribing audio chunks...")
                    transcript, audio_duration = transcribe_chunks(audio_file, chunk_dur, size, decode_opts)
                    full_content = f"Title: {title}\nSource: {src}\nDuration: {audio_duration:.1f}s\n\n{transcript}"

                    summ = ""
                    input_toks, output_toks = 0, 0
                    if op_choice == "Transcribe & Summarize":
                        st.info("Generating AI summary via GPT-4o-mini...")
                        summ = summarize_with_openai(transcript, active_key)
                        input_toks = len(transcript.split()) * 2
                        output_toks = len(summ.split()) * 2

                    # Log cost
                    cost = cost_tracker.record_transcription("video_transcriber", audio_duration, input_toks, output_toks)

                    st.session_state.m1_transcription = full_content
                    st.session_state.m1_summary = summ
                    st.session_state.m1_download_ready = {
                        "filename": f"{sanitize_filename(title)}_transcript.txt",
                        "data": full_content + (f"\n\n--- SUMMARY ---\n{summ}" if summ else "")
                    }
                    st.success(f"✅ Finished in {time.time()-start_time:.1f}s (Est. Cost: ${cost:.4f})")
                except Exception as e:
                    st.error(f"Execution failed: {e}")
                finally:
                    st.session_state.m1_in_progress = False

    with col2:
        st.markdown("### 📄 Results & Immediate Download")
        st.caption("Zero-retention active: Media data is purged automatically. Download results below:")

        if st.session_state.m1_download_ready:
            st.download_button(
                label=f"⬇️ Download {st.session_state.m1_download_ready['filename']}",
                data=st.session_state.m1_download_ready["data"],
                file_name=st.session_state.m1_download_ready["filename"],
                mime="text/plain"
            )

        if st.session_state.m1_waveform is not None:
            st.subheader("📊 Audio Waveform")
            downsample = max(1, len(st.session_state.m1_waveform) // 800)
            st.line_chart(st.session_state.m1_waveform[::downsample])

        if st.session_state.m1_transcription:
            st.subheader("📝 Transcript")
            st.text_area("Full Transcription Output", st.session_state.m1_transcription, height=280)
            if st.session_state.m1_summary:
                st.subheader("💡 AI Summary")
                st.text_area("Summary Points", st.session_state.m1_summary, height=140)
        else:
            st.info("No active transcription. Process a video on the left to see results here.")
