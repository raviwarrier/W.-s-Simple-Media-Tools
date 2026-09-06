import os
import uuid
from pathlib import Path
import streamlit as st
import yt_dlp
from pydub import AudioSegment
from utils.cleanup import ephemeral_workspace

def download_youtube_audio(url: str, output_path: str):
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

def extract_audio_segment_bytes(file_path: str, start_sec: int, duration_sec: int, temp_dir: str) -> str:
    audio = AudioSegment.from_file(file_path)
    end_sec = min(len(audio) // 1000, start_sec + duration_sec)
    extract = audio[start_sec * 1000:end_sec * 1000]
    out_path = os.path.join(temp_dir, f"clip_{uuid.uuid4().hex[:8]}.mp3")
    extract.export(out_path, format="mp3", bitrate="192k")
    return out_path

def render_audio_extractor(vault, cost_tracker):
    st.header("🎵 Audio Extractor Tool")
    st.caption("Extract high-quality MP3 clips from videos or audio files with slider controls.")

    st.session_state.setdefault("m4_clip", None)

    col1, col2 = st.columns([1.5, 2.5])

    with col1:
        st.markdown("### 🎛️ Audio Extraction Controls")
        source_type = st.radio("Source mode:", ["Upload File", "Paste URL"], horizontal=True, key="m4_src")

        uploaded = None
        url = None
        if source_type == "Upload File":
            uploaded = st.file_uploader("Upload video or audio file:", type=["mp4", "mov", "mkv", "avi", "mp3", "wav", "aac"])
        else:
            url = st.text_input("Media URL:")

        start_time = st.slider("Start Time (seconds):", min_value=0, max_value=3600, value=0, step=1)
        clip_dur = st.number_input("Duration (seconds):", min_value=1, max_value=300, value=30)

        if st.button("🎵 Extract MP3 Audio"):
            if source_type == "Upload File" and not uploaded:
                st.error("Please upload a file first.")
                return
            if source_type == "Paste URL" and not url:
                st.error("Please enter a URL first.")
                return

            with ephemeral_workspace() as temp_dir:
                try:
                    st.info("Downloading or preparing input media...")
                    if source_type == "Upload File":
                        input_path = os.path.join(temp_dir, uploaded.name)
                        with open(input_path, "wb") as f:
                            f.write(uploaded.getbuffer())
                    else:
                        base_out = os.path.join(temp_dir, f"dl_{uuid.uuid4().hex[:6]}")
                        download_youtube_audio(url, base_out)
                        input_path = f"{base_out}.mp3"

                    st.info("Extracting audio segment...")
                    out_mp3 = extract_audio_segment_bytes(input_path, start_time, clip_dur, temp_dir)

                    with open(out_mp3, "rb") as f:
                        data = f.read()

                    cost = cost_tracker.record_media_clipping("audio_extractor", clip_dur)

                    st.session_state.m4_clip = {
                        "filename": f"extracted_audio_{start_time}s_{clip_dur}s.mp3",
                        "data": data,
                        "duration": clip_dur,
                        "cost": cost
                    }
                    st.success(f"✅ Audio extracted into MP3! (Est. Cost: ${cost:.4f})")
                except Exception as e:
                    st.error(f"Extraction failed: {e}")

    with col2:
        st.markdown("### 🎧 Audio Output")
        if st.session_state.m4_clip:
            item = st.session_state.m4_clip
            st.success(f"Generated: `{item['filename']}` ({item['duration']}s)")

            st.download_button(
                label=f"⬇️ Download {item['filename']}",
                data=item["data"],
                file_name=item["filename"],
                mime="audio/mpeg"
            )

            st.audio(item["data"], format="audio/mp3")
        else:
            st.info("No audio extracted yet. Adjust settings on the left and click 'Extract MP3 Audio'.")
