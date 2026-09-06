import os
import json
import subprocess
import streamlit as st
import whisper
from utils.cleanup import ephemeral_workspace

def render_audiobook_transcriber(vault, cost_tracker):
    st.header("📚 Audiobook Snippet Transcriber")
    st.caption("Upload audiobook files, extract specific chapters/snippets by hour/minute/second, read metadata, and transcribe.")

    # Provider Key Check
    active_key = vault.get_openai_key("audiobook_transcriber")
    mode = vault.data.get("key_mode", "unified")
    st.info(f"⚙️ Key Configuration: `{mode.upper()}` mode. Using local Whisper model for offline transcription.")

    st.session_state.setdefault("m3_result", None)

    col1, col2 = st.columns([1.5, 2.5])

    with col1:
        st.markdown("### 📖 Audiobook Upload & Range")
        uploaded_file = st.file_uploader("Upload audiobook file:", type=["mp3", "m4a", "m4b", "ogg"])

        col_h, col_m, col_s = st.columns(3)
        with col_h:
            hours = st.number_input("Hours", min_value=0, value=0)
        with col_m:
            minutes = st.number_input("Minutes", min_value=0, max_value=59, value=0)
        with col_s:
            seconds = st.number_input("Seconds", min_value=0, max_value=59, value=0)

        duration = st.number_input("Snippet duration (seconds):", min_value=5, max_value=1800, value=60)
        model_size = st.selectbox("Whisper model:", ["tiny", "base", "small"], index=1)

        if st.button("🎙️ Transcribe Audiobook Snippet"):
            if not uploaded_file:
                st.error("Please upload an audiobook file.")
                return

            start_time = hours * 3600 + minutes * 60 + seconds

            with ephemeral_workspace() as temp_dir:
                try:
                    filename = uploaded_file.name
                    temp_audio_path = os.path.join(temp_dir, filename)
                    with open(temp_audio_path, "wb") as f:
                        f.write(uploaded_file.getbuffer())

                    temp_snippet_path = os.path.join(temp_dir, "snippet.wav")

                    st.info("Extracting snippet via FFmpeg...")
                    ffmpeg_cmd = [
                        "ffmpeg", "-ss", str(start_time), "-i", temp_audio_path,
                        "-t", str(duration), "-acodec", "pcm_s16le", "-ar", "16000",
                        "-ac", "1", temp_snippet_path, "-y"
                    ]
                    subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

                    # Extract metadata using ffprobe
                    st.info("Extracting audio tags & metadata...")
                    ffprobe_cmd = [
                        "ffprobe", "-v", "quiet", "-print_format", "json",
                        "-show_format", temp_audio_path
                    ]
                    book = os.path.splitext(filename)[0]
                    author = "Unknown"
                    try:
                        meta_raw = subprocess.check_output(ffprobe_cmd)
                        tags = json.loads(meta_raw).get("format", {}).get("tags", {})
                        if "title" in tags:
                            book = tags["title"].replace(":", "-").replace("/", "-")
                        if "artist" in tags:
                            author = tags["artist"].replace(":", "-").replace("/", "-")
                    except Exception:
                        pass

                    st.info(f"Loading Whisper '{model_size}' and transcribing...")
                    model = whisper.load_model(model_size)
                    result = model.transcribe(temp_snippet_path)
                    transcript = result["text"].strip()

                    start_label = f"{int(hours):02}h{int(minutes):02}m{int(seconds):02}s"
                    text_filename = f"{book} - {author} - {start_label}-{duration}s.txt"

                    cost = cost_tracker.record_transcription("audiobook_transcriber", duration)

                    st.session_state.m3_result = {
                        "filename": text_filename,
                        "book": book,
                        "author": author,
                        "timestamp": start_label,
                        "duration": duration,
                        "transcript": transcript,
                        "cost": cost
                    }
                    st.success(f"✅ Snippet transcribed! (Est. Cost: ${cost:.4f})")
                except Exception as e:
                    st.error(f"Audiobook transcription failed: {e}")

    with col2:
        st.markdown("### 📄 Snippet Output")
        if st.session_state.m3_result:
            res = st.session_state.m3_result
            st.success(f"Book: **{res['book']}** | Author: **{res['author']}** | Timestamp: `{res['timestamp']}`")

            st.download_button(
                label=f"⬇️ Download {res['filename']}",
                data=f"Book: {res['book']}\nAuthor: {res['author']}\nRange: {res['timestamp']} (+{res['duration']}s)\n\nTranscript:\n{res['transcript']}",
                file_name=res["filename"],
                mime="text/plain"
            )

            st.subheader("Transcript")
            st.text_area("Snippet Text", res["transcript"], height=320)
        else:
            st.info("No audiobook snippet processed yet. Upload a file on the left to begin.")
