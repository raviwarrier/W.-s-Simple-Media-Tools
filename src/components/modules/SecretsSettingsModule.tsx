import React, { useState, useEffect } from 'react';
import { SecretStore, KeyMode } from '../../types';
import { encryptVault, DEFAULT_VAULT_PASSPHRASE } from '../../utils/crypto';
import { useToast } from '../../context/ToastContext';
import {
  Key,
  Shield,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Share2,
  Split,
  Layers,
  Sparkles,
  HelpCircle,
  BookOpen,
  Copy,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SecretsSettingsModuleProps {
  secretStore: SecretStore;
  onUpdateSecretStore: (updated: SecretStore) => void;
  isDarkMode: boolean;
}

export const SecretsSettingsModule: React.FC<SecretsSettingsModuleProps> = ({
  secretStore,
  onUpdateSecretStore,
  isDarkMode,
}) => {
  const { showToast } = useToast();
  const [masterPassword, setMasterPassword] = useState(DEFAULT_VAULT_PASSPHRASE);
  const [showPassword, setShowPassword] = useState(false);
  const [keyMode, setKeyMode] = useState<KeyMode>(secretStore.keyMode);
  const [unifiedKey, setUnifiedKey] = useState(secretStore.unifiedOpenAiKey);
  const [videoKey, setVideoKey] = useState(secretStore.moduleOpenAiKeys.videoTranscriber);
  const [audiobookKey, setAudiobookKey] = useState(secretStore.moduleOpenAiKeys.audiobookTranscriber);
  const [extractorKey, setExtractorKey] = useState(secretStore.moduleOpenAiKeys.audioExtractor);
  const [cookiesPath, setCookiesPath] = useState(secretStore.customTokens.firefoxProfile || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cookie guide states
  const [showCookieGuideModal, setShowCookieGuideModal] = useState(false);
  const [showInlineGuide, setShowInlineGuide] = useState(false);
  const [guideActiveTab, setGuideActiveTab] = useState<'firefox' | 'chromium' | 'extension' | 'reference'>('firefox');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopySnippet = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(text);
    showToast({
      type: 'info',
      title: 'Path Copied',
      message: `Copied ${label} to clipboard.`,
      duration: 5000,
    });
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  // Sync state if secretStore is loaded asynchronously on mount
  useEffect(() => {
    setKeyMode(secretStore.keyMode);
    setUnifiedKey(secretStore.unifiedOpenAiKey);
    setVideoKey(secretStore.moduleOpenAiKeys.videoTranscriber);
    setAudiobookKey(secretStore.moduleOpenAiKeys.audiobookTranscriber);
    setExtractorKey(secretStore.moduleOpenAiKeys.audioExtractor);
    setCookiesPath(secretStore.customTokens.firefoxProfile || '');
  }, [secretStore]);

  const handleSaveVault = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSavedSuccess(false);

    try {
      const updatedStore: SecretStore = {
        ...secretStore,
        keyMode,
        unifiedOpenAiKey: unifiedKey.trim(),
        moduleOpenAiKeys: {
          videoTranscriber: videoKey.trim(),
          audiobookTranscriber: audiobookKey.trim(),
          audioExtractor: extractorKey.trim(),
        },
        customTokens: {
          ...secretStore.customTokens,
          firefoxProfile: cookiesPath.trim(),
        },
        lastUpdated: Date.now(),
      };

      const encryptedPayload = await encryptVault(updatedStore, masterPassword);
      onUpdateSecretStore(updatedStore);

      // Persist to server data/vault.enc.json as secondary storage
      try {
        await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedPayload }),
        });
      } catch (syncErr) {
        console.warn('Server vault backup non-blocking error:', syncErr);
      }

      setSavedSuccess(true);
      showToast({
        type: 'success',
        title: 'Vault Encrypted & Saved',
        message: 'All API keys and browser cookie paths were encrypted with AES-GCM and saved securely.',
        duration: 8000,
      });
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (e: any) {
      console.error('Failed to encrypt and store secrets:', e);
      const errMsg = (e && e.message) ? e.message : String(e);
      setSaveError(errMsg);
      showToast({
        type: 'error',
        title: 'Vault Encryption Failed',
        message: errMsg,
        duration: 15000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="secrets-settings-module" className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div
        className={`p-4 rounded border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${
              isDarkMode ? 'bg-[#262626] text-[#f3e79a]' : 'bg-[#f4f4f5] text-[#854d0e]'
            }`}
          >
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Encrypted Secrets Vault & Key Management</h3>
            <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              All credentials and provider API keys are encrypted at rest with AES-GCM (256-bit).
            </p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold border ${
            isDarkMode
              ? 'bg-[#222222] text-[#f3e79a] border-[#333333]'
              : 'bg-[#fef9c3] text-[#854d0e] border-[#ffd600]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>AES-GCM Encryption Armed</span>
        </div>
      </div>

      {/* Master Password Vault Barrier */}
      <div
        className={`p-5 rounded border space-y-3 ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Master Vault Passphrase
            </h4>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-[#222222] text-[#888888]' : 'bg-neutral-100 text-neutral-600'}`}>
              Optional to customize
            </span>
          </div>
          <span className={`text-xs font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>PBKDF2 SHA-256 (100,000 iter)</span>
        </div>

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            id="input-master-password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            className={`w-full px-3 py-2 pr-10 text-xs font-mono rounded border focus:outline-none ${
              isDarkMode
                ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            id="btn-toggle-vault-password"
            className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-200"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className={`text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
          This passphrase generates the cryptographic encryption key. Do not share it with untrusted parties.
        </p>
      </div>

      {/* CRITICAL WORKFLOW: Unified vs Per-Module Provider Key Selection */}
      <div
        className={`p-5 rounded border space-y-4 ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="border-b border-inherit pb-2.5">
          <div className="flex items-center gap-2">
            <Share2 className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Provider Key Assignment Workflow
            </h4>
          </div>
          <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
            Multiple modules in this suite utilize tokens from the same provider (e.g. OpenAI for Video Transcription and Audiobook Summaries).
            Choose how you would like to allocate credentials:
          </p>
        </div>

        {/* Strategy Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => setKeyMode('unified')}
            id="card-unified-key-mode"
            className={`p-4 rounded border cursor-pointer transition-all ${
              keyMode === 'unified'
                ? isDarkMode
                  ? 'bg-[#222222] border-[#f3e79a]'
                  : 'bg-[#fef9c3] border-[#ffd600]'
                : isDarkMode
                ? 'bg-[#121212] border-[#2c2c2c] hover:border-neutral-600'
                : 'bg-[#fafafa] border-[#e0e0e0] hover:border-neutral-400'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                  keyMode === 'unified'
                    ? isDarkMode ? 'bg-[#f3e79a] text-neutral-950' : 'bg-[#ffd600] text-neutral-950'
                    : isDarkMode ? 'bg-[#262626] text-neutral-400' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">Use Same Key for All Modules</span>
                  {keyMode === 'unified' && (
                    <CheckCircle2 className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                  )}
                </div>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                  Single unified OpenAI API key shared across Video Transcription, Summarization, and Audiobooks. Best for personal usage.
                </p>
                <span
                  className={`inline-block mt-0.5 text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                    isDarkMode ? 'text-[#f3e79a] bg-[#2a2a2a]' : 'text-[#854d0e] bg-white border border-[#e0e0e0]'
                  }`}
                >
                  Recommended Default
                </span>
              </div>
            </div>
          </div>

          <div
            onClick={() => setKeyMode('per-module')}
            id="card-per-module-key-mode"
            className={`p-4 rounded border cursor-pointer transition-all ${
              keyMode === 'per-module'
                ? isDarkMode
                  ? 'bg-[#222222] border-[#f3e79a]'
                  : 'bg-[#fef9c3] border-[#ffd600]'
                : isDarkMode
                ? 'bg-[#121212] border-[#2c2c2c] hover:border-neutral-600'
                : 'bg-[#fafafa] border-[#e0e0e0] hover:border-neutral-400'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                  keyMode === 'per-module'
                    ? isDarkMode ? 'bg-[#f3e79a] text-neutral-950' : 'bg-[#ffd600] text-neutral-950'
                    : isDarkMode ? 'bg-[#262626] text-neutral-400' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                <Split className="w-4 h-4" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">Use Different Keys per Module</span>
                  {keyMode === 'per-module' && (
                    <CheckCircle2 className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                  )}
                </div>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                  Specify distinct API keys for each module independently. Ideal for strict quota enforcement, billing separation, or project boundaries.
                </p>
                <span
                  className={`inline-block mt-0.5 text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                    isDarkMode ? 'text-[#f3e79a] bg-[#2a2a2a]' : 'text-[#854d0e] bg-white border border-[#e0e0e0]'
                  }`}
                >
                  Isolated Budgeting
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Input Fields depending on Mode */}
        {keyMode === 'unified' ? (
          <div
            className={`p-4 rounded border space-y-2 ${
              isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'
            }`}
          >
            <label className="text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
                <span>Unified OpenAI API Key:</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-[#222222] text-[#888888]' : 'bg-neutral-100 text-neutral-600'}`}>
                Required only for Whisper / AI Summaries
              </span>
            </label>
            <input
              type="password"
              id="input-unified-openai-key"
              value={unifiedKey}
              onChange={(e) => setUnifiedKey(e.target.value)}
              placeholder="sk-proj-..."
              className={`w-full px-3 py-2 text-xs font-mono rounded border focus:outline-none ${
                isDarkMode
                  ? 'bg-[#181818] border-[#333333] text-white focus:border-[#f3e79a]'
                  : 'bg-white border-neutral-300 text-neutral-900 focus:border-[#ffd600]'
              }`}
            />
            <p className={`text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
              This single token will power all Whisper & GPT-4o-mini summarization features across all modules.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div
              className={`p-4 rounded border space-y-1.5 ${
                isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'
              }`}
            >
              <label className="text-xs font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>Video Transcription OpenAI Key:</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-[#222222] text-[#888888]' : 'bg-neutral-100 text-neutral-600'}`}>
                    Optional if module unused
                  </span>
                </div>
                <span className={`text-xs font-mono ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                  video-transcriber
                </span>
              </label>
              <input
                type="password"
                id="input-video-openai-key"
                value={videoKey}
                onChange={(e) => setVideoKey(e.target.value)}
                placeholder="sk-proj-video-..."
                className={`w-full px-3 py-2 text-xs font-mono rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#181818] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-neutral-300 text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
            </div>

            <div
              className={`p-4 rounded border space-y-1.5 ${
                isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'
              }`}
            >
              <label className="text-xs font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>Audiobook Transcriber OpenAI Key:</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-[#222222] text-[#888888]' : 'bg-neutral-100 text-neutral-600'}`}>
                    Optional if module unused
                  </span>
                </div>
                <span className={`text-xs font-mono ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                  audiobook-transcriber
                </span>
              </label>
              <input
                type="password"
                id="input-audiobook-openai-key"
                value={audiobookKey}
                onChange={(e) => setAudiobookKey(e.target.value)}
                placeholder="sk-proj-audiobook-..."
                className={`w-full px-3 py-2 text-xs font-mono rounded border focus:outline-none ${
                  isDarkMode
                    ? 'bg-[#181818] border-[#333333] text-white focus:border-[#f3e79a]'
                    : 'bg-white border-neutral-300 text-neutral-900 focus:border-[#ffd600]'
                }`}
              />
            </div>
          </div>
        )}

        {/* Additional configuration: Cookies Profile for yt-dlp */}
        <div className="pt-2 space-y-2 border-t border-inherit">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <span>Browser Profile / Cookies Path (for yt-dlp):</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-[#222222] text-[#888888]' : 'bg-neutral-100 text-neutral-600'}`}>
                Optional
              </span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInlineGuide(!showInlineGuide)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border transition-colors ${
                  isDarkMode
                    ? 'border-[#333333] hover:border-[#f3e79a] text-neutral-300 hover:text-white bg-[#181818]'
                    : 'border-neutral-300 hover:border-neutral-500 text-neutral-700 bg-white'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Paths</span>
                {showInlineGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setShowCookieGuideModal(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                  isDarkMode
                    ? 'bg-[#222222] border-[#f3e79a] text-[#f3e79a] hover:bg-[#2a2a2a]'
                    : 'bg-amber-50 border-amber-400 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>How-to Guide (Firefox & Chromium)</span>
              </button>
            </div>
          </div>

          <input
            type="text"
            id="input-cookies-path"
            value={cookiesPath}
            onChange={(e) => setCookiesPath(e.target.value)}
            placeholder="e.g. /home/user/.mozilla/firefox/xxx.default or C:\path\to\cookies.txt"
            className={`w-full px-3 py-2 text-xs font-mono rounded border focus:outline-none ${
              isDarkMode
                ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                : 'bg-white border-neutral-300 text-neutral-900 focus:border-[#ffd600]'
            }`}
          />
          <p className={`text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
            Allows yt-dlp to bypass YouTube "Sign in to confirm you're not a bot" and access age-restricted or private media.
          </p>

          {/* Quick Inline Guide Accordion */}
          {showInlineGuide && (
            <div
              className={`p-3.5 rounded border text-xs space-y-2.5 ${
                isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fbfbfe] border-[#e2e8f0]'
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Common Default Profile & Cookies Locations</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                <div className={`p-2 rounded border ${isDarkMode ? 'bg-[#1a1a1a] border-[#333333]' : 'bg-white border-neutral-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-semibold text-xs">Firefox (Linux):</span>
                    <button
                      type="button"
                      onClick={() => handleCopySnippet('~/.mozilla/firefox/', 'Firefox Linux path')}
                      className="text-amber-500 hover:text-amber-400 p-0.5"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <code className="text-neutral-400 select-all block truncate">~/.mozilla/firefox/&lt;profile&gt;.default-release</code>
                </div>

                <div className={`p-2 rounded border ${isDarkMode ? 'bg-[#1a1a1a] border-[#333333]' : 'bg-white border-neutral-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-semibold text-xs">Firefox / Zen (Windows):</span>
                    <button
                      type="button"
                      onClick={() => handleCopySnippet('%APPDATA%\\Mozilla\\Firefox\\Profiles\\', 'Firefox Windows path')}
                      className="text-amber-500 hover:text-amber-400 p-0.5"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <code className="text-neutral-400 select-all block truncate">%APPDATA%\Mozilla\Firefox\Profiles\*.default-release</code>
                </div>

                <div className={`p-2 rounded border ${isDarkMode ? 'bg-[#1a1a1a] border-[#333333]' : 'bg-white border-neutral-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-semibold text-xs">Chrome (Linux):</span>
                    <button
                      type="button"
                      onClick={() => handleCopySnippet('~/.config/google-chrome/Default', 'Chrome Linux path')}
                      className="text-amber-500 hover:text-amber-400 p-0.5"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <code className="text-neutral-400 select-all block truncate">~/.config/google-chrome/Default</code>
                </div>

                <div className={`p-2 rounded border ${isDarkMode ? 'bg-[#1a1a1a] border-[#333333]' : 'bg-white border-neutral-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-semibold text-xs">cookies.txt Export (Universal):</span>
                    <button
                      type="button"
                      onClick={() => handleCopySnippet('/srv/cookies.txt', 'cookies.txt example path')}
                      className="text-amber-500 hover:text-amber-400 p-0.5"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <code className="text-neutral-400 select-all block truncate">/path/to/cookies.txt or C:\cookies.txt</code>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1">
                <span>Tip: You can also pass browser names like <code>firefox</code>, <code>chrome</code>, or <code>brave</code> directly.</span>
                <button
                  type="button"
                  onClick={() => setShowCookieGuideModal(true)}
                  className="text-amber-500 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  <span>Open full walkthrough</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save to Vault Action */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            onClick={handleSaveVault}
            disabled={isSaving}
            id="btn-save-encrypted-vault"
            className={`flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-xs transition-colors shadow-xs ${
              isSaving ? 'opacity-70 cursor-not-allowed' : ''
            } ${
              isDarkMode
                ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Encrypting & Saving...' : 'Encrypt & Save Secrets to Vault'}</span>
          </button>

          {savedSuccess && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Vault updated & encrypted successfully!</span>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-950/30 border border-red-800/50 px-3 py-1.5 rounded">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: How to Get Cookies for yt-dlp (Firefox & Chromium) */}
      {showCookieGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className={`w-full max-w-2xl max-h-[85vh] rounded-lg border shadow-2xl flex flex-col overflow-hidden ${
              isDarkMode ? 'bg-[#181818] border-[#333333] text-neutral-200' : 'bg-white border-neutral-300 text-neutral-800'
            }`}
          >
            {/* Modal Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-[#2c2c2c] bg-[#141414]' : 'border-neutral-200 bg-neutral-50'}`}>
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold">How to Get Cookies for yt-dlp</h3>
                  <p className="text-xs opacity-75">Firefox, Chromium (Chrome / Brave / Edge), and Extension Guide</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCookieGuideModal(false)}
                className="p-1 rounded-md hover:bg-neutral-500/20 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Navigation */}
            <div className={`flex border-b text-xs font-semibold px-4 gap-2 pt-2 ${isDarkMode ? 'border-[#2c2c2c] bg-[#161616]' : 'border-neutral-200 bg-neutral-100'}`}>
              <button
                type="button"
                onClick={() => setGuideActiveTab('firefox')}
                className={`pb-2.5 px-3 border-b-2 transition-colors ${
                  guideActiveTab === 'firefox'
                    ? isDarkMode
                      ? 'border-[#f3e79a] text-[#f3e79a]'
                      : 'border-amber-600 text-amber-800'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Firefox / LibreWolf / Zen
              </button>
              <button
                type="button"
                onClick={() => setGuideActiveTab('chromium')}
                className={`pb-2.5 px-3 border-b-2 transition-colors ${
                  guideActiveTab === 'chromium'
                    ? isDarkMode
                      ? 'border-[#f3e79a] text-[#f3e79a]'
                      : 'border-amber-600 text-amber-800'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Chromium / Chrome / Brave
              </button>
              <button
                type="button"
                onClick={() => setGuideActiveTab('extension')}
                className={`pb-2.5 px-3 border-b-2 transition-colors ${
                  guideActiveTab === 'extension'
                    ? isDarkMode
                      ? 'border-[#f3e79a] text-[#f3e79a]'
                      : 'border-amber-600 text-amber-800'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                cookies.txt Extension (Easiest)
              </button>
              <button
                type="button"
                onClick={() => setGuideActiveTab('reference')}
                className={`pb-2.5 px-3 border-b-2 transition-colors ${
                  guideActiveTab === 'reference'
                    ? isDarkMode
                      ? 'border-[#f3e79a] text-[#f3e79a]'
                      : 'border-amber-600 text-amber-800'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                yt-dlp Format Reference
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
              {guideActiveTab === 'firefox' && (
                <div className="space-y-3.5">
                  <div className={`p-3 rounded border ${isDarkMode ? 'bg-[#1e1e1e] border-[#333333]' : 'bg-amber-50 border-amber-200'}`}>
                    <h4 className="font-semibold text-xs mb-1">Why Firefox is great for yt-dlp:</h4>
                    <p className="opacity-80 text-[11px]">
                      Firefox stores its cookies unencrypted in standard SQLite databases (<code>cookies.sqlite</code>). yt-dlp can read them directly without requiring browser shutdown or OS keychain decryptions.
                    </p>
                  </div>

                  <h5 className="font-semibold text-xs uppercase tracking-wider text-amber-500">
                    Step-by-Step Instructions:
                  </h5>

                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Open <strong>Firefox</strong> (or LibreWolf, Zen, Waterfox).
                    </li>
                    <li>
                      In the URL address bar, type <code className="px-1.5 py-0.5 rounded bg-neutral-800 text-amber-300 font-mono">about:profiles</code> and press Enter.
                    </li>
                    <li>
                      Find the profile marked as <strong>Default Profile: yes</strong> (typically named <code>default-release</code>).
                    </li>
                    <li>
                      Look for the line that says <strong>Root Directory</strong> and click <strong>Open Directory</strong> (or copy the path).
                    </li>
                    <li>
                      Copy the full folder path and paste it into the <strong>Browser Profile / Cookies Path</strong> input in this module.
                    </li>
                  </ol>

                  <div className="space-y-1.5 pt-1">
                    <span className="font-semibold text-xs">Typical Firefox Profile Paths:</span>

                    <div className={`p-2 rounded border font-mono text-[11px] flex items-center justify-between ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="truncate">
                        <span className="text-amber-400 font-sans font-medium mr-2">Windows:</span>
                        <span>%APPDATA%\Mozilla\Firefox\Profiles\&lt;id&gt;.default-release</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopySnippet('%APPDATA%\\Mozilla\\Firefox\\Profiles\\', 'Firefox Windows path')}
                        className="ml-2 text-amber-500 hover:text-amber-400 shrink-0"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className={`p-2 rounded border font-mono text-[11px] flex items-center justify-between ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="truncate">
                        <span className="text-amber-400 font-sans font-medium mr-2">Linux:</span>
                        <span>~/.mozilla/firefox/&lt;id&gt;.default-release</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopySnippet('~/.mozilla/firefox/', 'Firefox Linux path')}
                        className="ml-2 text-amber-500 hover:text-amber-400 shrink-0"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className={`p-2 rounded border font-mono text-[11px] flex items-center justify-between ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="truncate">
                        <span className="text-amber-400 font-sans font-medium mr-2">macOS:</span>
                        <span>~/Library/Application Support/Firefox/Profiles/&lt;id&gt;.default-release</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopySnippet('~/Library/Application Support/Firefox/Profiles/', 'Firefox macOS path')}
                        className="ml-2 text-amber-500 hover:text-amber-400 shrink-0"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {guideActiveTab === 'chromium' && (
                <div className="space-y-3.5">
                  <div className={`p-3 rounded border ${isDarkMode ? 'bg-[#1e1e1e] border-[#333333]' : 'bg-amber-50 border-amber-200'}`}>
                    <h4 className="font-semibold text-xs mb-1">Important Chromium Note:</h4>
                    <p className="opacity-80 text-[11px]">
                      Chrome, Brave, and Edge encrypt cookies via Windows DPAPI or macOS Keychain, and place exclusive file locks while running.
                      If you get a lock error, either close the browser temporarily or use the <strong>cookies.txt extension</strong> (recommended below).
                    </p>
                  </div>

                  <h5 className="font-semibold text-xs uppercase tracking-wider text-amber-500">
                    Default Chromium Profile Directories:
                  </h5>

                  <div className="space-y-2">
                    <div className={`p-2.5 rounded border font-mono text-[11px] ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="flex items-center justify-between mb-1 font-sans font-semibold">
                        <span>Google Chrome (Windows):</span>
                        <button
                          type="button"
                          onClick={() => handleCopySnippet('%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default', 'Chrome Windows profile')}
                          className="text-amber-500 hover:text-amber-400"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <code className="text-neutral-400 block truncate">%LOCALAPPDATA%\Google\Chrome\User Data\Default</code>
                    </div>

                    <div className={`p-2.5 rounded border font-mono text-[11px] ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="flex items-center justify-between mb-1 font-sans font-semibold">
                        <span>Google Chrome / Chromium (Linux):</span>
                        <button
                          type="button"
                          onClick={() => handleCopySnippet('~/.config/google-chrome/Default', 'Chrome Linux profile')}
                          className="text-amber-500 hover:text-amber-400"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <code className="text-neutral-400 block truncate">~/.config/google-chrome/Default (or ~/.config/chromium/Default)</code>
                    </div>

                    <div className={`p-2.5 rounded border font-mono text-[11px] ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="flex items-center justify-between mb-1 font-sans font-semibold">
                        <span>Brave Browser (Windows):</span>
                        <button
                          type="button"
                          onClick={() => handleCopySnippet('%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data\\Default', 'Brave profile')}
                          className="text-amber-500 hover:text-amber-400"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <code className="text-neutral-400 block truncate">%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\Default</code>
                    </div>

                    <div className={`p-2.5 rounded border font-mono text-[11px] ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="flex items-center justify-between mb-1 font-sans font-semibold">
                        <span>Microsoft Edge (Windows):</span>
                        <button
                          type="button"
                          onClick={() => handleCopySnippet('%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default', 'Edge profile')}
                          className="text-amber-500 hover:text-amber-400"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <code className="text-neutral-400 block truncate">%LOCALAPPDATA%\Microsoft\Edge\User Data\Default</code>
                    </div>
                  </div>
                </div>
              )}

              {guideActiveTab === 'extension' && (
                <div className="space-y-3.5">
                  <div className={`p-3 rounded border ${isDarkMode ? 'bg-[#1e1e1e] border-[#333333]' : 'bg-emerald-50 border-emerald-200'}`}>
                    <h4 className="font-semibold text-xs mb-1 text-emerald-500">Universal & Recommended Method for all systems</h4>
                    <p className="opacity-80 text-[11px]">
                      Exporting a Netscape format <code>cookies.txt</code> is completely immune to browser database file locks, OS keyring decryption limits, and multi-profile issues.
                    </p>
                  </div>

                  <h5 className="font-semibold text-xs uppercase tracking-wider text-amber-500">
                    Three-Minute Setup:
                  </h5>

                  <ol className="list-decimal pl-5 space-y-2.5">
                    <li>
                      Install the open-source extension <strong>Get cookies.txt LOCALLY</strong>:
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-[11px] font-mono">Chrome Web Store / Brave / Edge</span>
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-[11px] font-mono">Firefox Add-ons</span>
                      </div>
                    </li>
                    <li>
                      Open your target website (e.g. <strong>YouTube</strong>) while logged in to your account.
                    </li>
                    <li>
                      Click the extension icon in your browser toolbar, then click <strong>Export</strong>.
                    </li>
                    <li>
                      Save the file as <code>cookies.txt</code> in an accessible location on your server or local machine (e.g. <code>/srv/cookies.txt</code> or <code>C:\tools\cookies.txt</code>).
                    </li>
                    <li>
                      Paste that exact file path into the <strong>Browser Profile / Cookies Path</strong> field in this module.
                    </li>
                  </ol>
                </div>
              )}

              {guideActiveTab === 'reference' && (
                <div className="space-y-3.5">
                  <h5 className="font-semibold text-xs uppercase tracking-wider text-amber-500">
                    How yt-dlp Uses Your Input:
                  </h5>

                  <p className="text-[11px] opacity-80">
                    The path you enter in this module is automatically mapped to the appropriate yt-dlp argument flags when extracting videos or audio:
                  </p>

                  <div className="space-y-2 font-mono text-[11px]">
                    <div className={`p-2.5 rounded border ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="font-sans font-semibold text-xs mb-1">If pointing to a .txt file:</div>
                      <code>yt-dlp --cookies "/path/to/cookies.txt" ...</code>
                    </div>

                    <div className={`p-2.5 rounded border ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="font-sans font-semibold text-xs mb-1">If pointing to a Firefox profile folder:</div>
                      <code>yt-dlp --cookies-from-browser firefox:"/path/to/profile" ...</code>
                    </div>

                    <div className={`p-2.5 rounded border ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-neutral-200'}`}>
                      <div className="font-sans font-semibold text-xs mb-1">If just typing a browser name:</div>
                      <code>yt-dlp --cookies-from-browser firefox (or chrome / brave / edge)</code>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-3 border-t flex items-center justify-between ${isDarkMode ? 'border-[#2c2c2c] bg-[#141414]' : 'border-neutral-200 bg-neutral-50'}`}>
              <div className="text-[11px] opacity-75">
                {copiedSnippet ? 'Copied to clipboard!' : 'All paths can be pasted directly into the cookies input field.'}
              </div>
              <button
                type="button"
                onClick={() => setShowCookieGuideModal(false)}
                className={`px-4 py-1.5 rounded text-xs font-semibold ${
                  isDarkMode ? 'bg-[#f3e79a] text-neutral-950 hover:bg-[#e8dc86]' : 'bg-[#ffd600] text-neutral-950 hover:bg-[#eab308]'
                }`}
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
