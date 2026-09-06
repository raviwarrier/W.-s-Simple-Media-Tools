import os
import re
import subprocess
from pathlib import Path
from typing import Optional
import streamlit as st
import yt_dlp
from utils.cleanup import ephemeral_workspace

def sanitize_name(name: str) -> str:
    name = re.sub(r"[^\w\-. ]+", "_", name).strip()
    return re.sub(r"\s+", " ", name)

def hhmmss_to_seconds(ts: str) -> Optional[float]:
    ts = ts.strip()
    if not ts:
        return None
    parts = ts.split(":")
    try:
        if len(parts) == 3:
            h, m, s = parts
            return int(h) * 3600 + int(m) * 60 + float(s)
        elif len(parts) == 2:
            m, s = parts
            return int(m) * 60 + float(s)
        elif len(parts) == 1:
            return float(parts[0])
    except ValueError:
        return None
    return None

def download_media_ephemeral(url: str, mode: str, target_dir: str) -> Optional[Path]:
    outtmpl = os.path.join(target_dir, "%(title)s.%(ext)s")
    fmt = "bestaudio[ext=m4a]/bestaudio" if mode == "audio" else "bv*+ba/best"
    ydl_opts = {
        "outtmpl": outtmpl,
        "quiet": True,
        "no_warnings": True,
        "format": fmt,
        "merge_output_format": "mp4" if mode == "video" else None,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if not info:
                return None
            return Path(ydl.prepare_filename(info))
    except Exception as e:
        st.error(f"Download failed: {e}")
        return None

def render_media_clipper(vault, cost_tracker):
    st.header("🎬 Audio/Video Clipper")
    st.caption("Clip precise segments from web media or uploaded files with exact hh:mm:ss timestamps.")

    st.session_state.setdefault("m2_clip_ready", None)
    st.session_state.setdefault("m2_source_mode", "Upload File")
    st.session_state.setdefault("m2_start_ts", "00:00:00")
    st.session_state.setdefault("m2_end_ts", "00:00:30")

    col1, col2 = st.columns([1.5, 2.5])

    with col1:
        st.markdown("### ✂️ Clip Configuration")
        source_mode = st.radio("Source mode:", ["Upload File", "Paste URL"], horizontal=True, key="m2_src_mode")

        uploaded_file = None
        url_input = None
        if source_mode == "Upload File":
            uploaded_file = st.file_uploader("Upload video or audio file:", type=["mp4","mov","avi","mkv","mp3","wav","m4a"])
        else:
            url_input = st.text_input("Media URL:")

        col_a, col_b = st.columns(2)
        with col_a:
            start_ts = st.text_input("Start (hh:mm:ss):", value=st.session_state.m2_start_ts)
        with col_b:
            end_ts = st.text_input("End (hh:mm:ss):", value=st.session_state.m2_end_ts)

        extract_choice = st.selectbox("Output format:", ["Audio (.mp3)", "Video (.mp4)"])

        if st.button("✂️ Extract & Generate Clip"):
            start_s = hhmmss_to_seconds(start_ts)
            end_s = hhmmss_to_seconds(end_ts)
            if start_s is None or end_s is None or end_s <= start_s:
                st.error("Invalid start/end times. Ensure End Time is greater than Start Time.")
                return

            clip_duration = end_s - start_s
            mode = "audio" if "Audio" in extract_choice else "video"

            with ephemeral_workspace() as temp_dir:
                try:
                    st.info("Preparing source media...")
                    if source_mode == "Paste URL":
                        if not url_input:
                            st.error("Please enter a media URL.")
                            return
                        src_path = download_media_ephemeral(url_input, mode, temp_dir)
                        if not src_path or not src_path.exists():
                            st.error("Could not download media from URL.")
                            return
                    else:
                        if not uploaded_file:
                            st.error("Please upload a media file.")
                            return
                        src_path = Path(temp_dir) / uploaded_file.name
                        with open(src_path, "wb") as f:
                            f.write(uploaded_file.getbuffer())

                    ext = ".mp3" if mode == "audio" else ".mp4"
                    out_filename = f"{sanitize_name(src_path.stem)}_clip_{int(start_s)}-{int(end_s)}{ext}"
                    out_file = Path(temp_dir) / out_filename

                    st.info("Clipping with FFmpeg...")
                    if mode == "audio":
                        cmd = [
                            "ffmpeg", "-y", "-ss", str(start_s), "-to", str(end_s),
                            "-i", str(src_path), "-vn", "-acodec", "libmp3lame",
                            "-ar", "44100", "-ab", "192k", "-ac", "2", str(out_file)
                        ]
                    else:
                        cmd = [
                            "ffmpeg", "-y", "-ss", str(start_s), "-to", str(end_s),
                            "-i", str(src_path), "-c", "copy", str(out_file)
                        ]

                    res = subprocess.run(cmd, capture_output=True, text=True)
                    if res.returncode != 0:
                        st.error(f"FFmpeg clipping error: {res.stderr}")
                        return

                    with open(out_file, "rb") as f:
                        clip_bytes = f.read()

                    cost = cost_tracker.record_media_clipping("media_clipper", clip_duration)

                    st.session_state.m2_clip_ready = {
                        "filename": out_filename,
                        "data": clip_bytes,
                        "mode": mode,
                        "duration": clip_duration,
                        "cost": cost
                    }
                    st.success(f"✅ Clip generated successfully! (Est. Cost: ${cost:.4f})")
                except Exception as e:
                    st.error(f"Clipping operation failed: {e}")

    with col2:
        st.markdown("### 📥 Download & Preview")
        st.caption("All media is cleared from server memory automatically.")

        if st.session_state.m2_clip_ready:
            item = st.session_state.m2_clip_ready
            st.success(f"Ready: `{item['filename']}` ({item['duration']:.1f}s)")

            mime_type = "audio/mpeg" if item["mode"] == "audio" else "video/mp4"
            st.download_button(
                label=f"⬇️ Download {item['filename']}",
                data=item["data"],
                file_name=item["filename"],
                mime=mime_type
            )

            if item["mode"] == "audio":
                st.audio(item["data"], format="audio/mp3")
            else:
                st.video(item["data"])
        else:
            st.info("No clipped media generated yet. Fill in times on the left and click 'Extract & Generate Clip'.")
