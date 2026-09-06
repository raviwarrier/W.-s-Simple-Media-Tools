import streamlit as st
import os
from utils.crypto_vault import EncryptedVault
from utils.cost_calculator import CostTracker
from modules.video_transcriber import render_video_transcriber
from modules.media_clipper import render_media_clipper
from modules.audiobook_transcriber import render_audiobook_transcriber
from modules.audio_extractor import render_audio_extractor

# 1. Page Configuration (Default Dark Mode & Wide Layout)
st.set_page_config(
    page_title="Streamlit Unified Media Suite",
    page_icon="🎙️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Streamlit Dark Theme CSS
st.markdown("""
<style>
    /* Dark mode styling enhancements */
    .stApp {
        background-color: #0E1117;
        color: #FAFAFA;
    }
    .stSidebar {
        background-color: #161A24 !important;
    }
    .metric-card {
        background-color: #1F2430;
        border-radius: 8px;
        padding: 14px 18px;
        border: 1px solid #2D3342;
        margin-bottom: 12px;
    }
    .zero-retention-pill {
        display: inline-block;
        background-color: #064E3B;
        color: #6EE7B7;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
        margin-bottom: 8px;
    }
    .stButton>button {
        border-radius: 6px;
        font-weight: 500;
    }
</style>
""", unsafe_allow_html=True)

# 2. Initialize Shared State (Encrypted Vault & Cost Tracker)
if "vault" not in st.session_state:
    st.session_state.vault = EncryptedVault()

if "cost_tracker" not in st.session_state:
    st.session_state.cost_tracker = CostTracker()

vault: EncryptedVault = st.session_state.vault
cost_tracker: CostTracker = st.session_state.cost_tracker

# 3. Sidebar Navigation & Global Controls
with st.sidebar:
    st.title("🎙️ Media Suite")
    st.markdown("<span class='zero-retention-pill'>🛡️ Zero Server Retention</span>", unsafe_allow_html=True)
    st.caption("Ephemeral memory architecture — temporary files are purged automatically after execution.")

    st.markdown("---")
    st.subheader("Navigation")
    pages = [
        "🎥 Video Transcription",
        "🎬 Audio/Video Clipper",
        "📚 Audiobook Transcriber",
        "🎵 Audio Extractor",
        "⚙️ Encrypted Secrets Vault",
        "📊 Usage Costs & Budget"
    ]
    selected_page = st.radio("Select Functional Module:", pages, index=0)

    st.markdown("---")
    st.subheader("💰 Live Budget Monitor")
    total_cost = cost_tracker.get_total_cost()
    pct = cost_tracker.get_budget_percentage()
    st.metric("Session Total Cost", f"${total_cost:.4f}", f"Budget: ${cost_tracker.budget_limit:.2f}")
    st.progress(int(pct), text=f"{pct:.1f}% of budget limit used")
    if pct >= 80:
        st.warning("⚠️ Budget alert: Reached 80%+ threshold!")

    st.markdown("---")
    st.caption("🔑 Provider Key Policy")
    key_mode = vault.data.get("key_mode", "unified")
    if key_mode == "unified":
        st.info("Using **Unified Provider Key** for all modules.")
    else:
        st.info("Using **Per-Module Isolated Keys**.")

# 4. Route to Selected Module
if selected_page == "🎥 Video Transcription":
    render_video_transcriber(vault, cost_tracker)

elif selected_page == "🎬 Audio/Video Clipper":
    render_media_clipper(vault, cost_tracker)

elif selected_page == "📚 Audiobook Transcriber":
    render_audiobook_transcriber(vault, cost_tracker)

elif selected_page == "🎵 Audio Extractor":
    render_audio_extractor(vault, cost_tracker)

elif selected_page == "⚙️ Encrypted Secrets Vault":
    st.header("⚙️ Encrypted Secrets & Provider Key Settings")
    st.caption("All credentials and tokens are encrypted at rest using AES-GCM (Fernet) with PBKDF2 salt derivation.")

    st.markdown("### 🔐 Provider Key Strategy")
    st.markdown("""
    When multiple modules utilize API tokens from the same provider (e.g. OpenAI for Video Transcription and Audiobook Summaries),
    you can decide whether to share a single key or isolate quotas with dedicated module tokens.
    """)

    current_mode = vault.data.get("key_mode", "unified")
    new_mode = st.radio(
        "Key Assignment Workflow:",
        ["unified", "per_module"],
        format_func=lambda x: "Use the SAME API Key for all modules (Recommended for personal use)" if x == "unified" else "Configure DIFFERENT API Keys per module (Recommended for billing separation)",
        index=0 if current_mode == "unified" else 1
    )
    if new_mode != current_mode:
        vault.set_key_mode(new_mode)
        st.success(f"Updated key mode to `{new_mode}`.")

    st.markdown("---")
    if new_mode == "unified":
        st.subheader("🌐 Unified OpenAI API Key")
        u_key = st.text_input("OpenAI API Key (used across all modules):",
                              value=vault.data.get("unified_openai_key", ""),
                              type="password")
        if st.button("Save Unified Key to Encrypted Vault"):
            vault.set_unified_key(u_key)
            st.success("✅ Unified API Key encrypted and saved.")
    else:
        st.subheader("🎯 Per-Module API Keys")
        m_keys = vault.data.get("module_openai_keys", {})

        k1 = st.text_input("Video Transcription OpenAI Key:", value=m_keys.get("video_transcriber", ""), type="password")
        if st.button("Save Video Transcriber Key"):
            vault.set_module_key("video_transcriber", k1)
            st.success("Saved for Video Transcriber.")

        k2 = st.text_input("Audiobook Transcriber OpenAI Key:", value=m_keys.get("audiobook_transcriber", ""), type="password")
        if st.button("Save Audiobook Transcriber Key"):
            vault.set_module_key("audiobook_transcriber", k2)
            st.success("Saved for Audiobook Transcriber.")

        k3 = st.text_input("Audio Extractor OpenAI Key:", value=m_keys.get("audio_extractor", ""), type="password")
        if st.button("Save Audio Extractor Key"):
            vault.set_module_key("audio_extractor", k3)
            st.success("Saved for Audio Extractor.")

elif selected_page == "📊 Usage Costs & Budget":
    st.header("📊 Usage Costs & Budget Monitor")
    st.caption("Monitor token and compute expenses per module in real-time to avoid unexpected cloud charges.")

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Cumulative Expense", f"${cost_tracker.get_total_cost():.4f}")
    with col2:
        st.metric("Active Budget Limit", f"${cost_tracker.budget_limit:.2f}")
    with col3:
        st.metric("Total Executed Operations", sum(m["runs"] for m in cost_tracker.ledger.values()))

    st.markdown("### 📋 Per-Module Cost Breakdown")
    for mod_name, stats in cost_tracker.ledger.items():
        with st.expander(f"{mod_name.replace('_', ' ').title()} — Cost: ${stats['cost_usd']:.4f} ({stats['runs']} runs)"):
            st.write(stats)

    st.markdown("### 🎯 Update Budget Ceiling")
    new_budget = st.number_input("Budget Threshold ($ USD):", min_value=1.0, max_value=1000.0, value=float(cost_tracker.budget_limit), step=1.0)
    if st.button("Update Budget Limit"):
        cost_tracker.budget_limit = new_budget
        st.success(f"Budget ceiling updated to ${new_budget:.2f}")
