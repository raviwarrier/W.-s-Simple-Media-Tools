import React, { useState, useEffect } from 'react';
import { SecretStore, KeyMode } from '../../types';
import { encryptVault, DEFAULT_VAULT_PASSPHRASE } from '../../utils/crypto';
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
  const [masterPassword, setMasterPassword] = useState(DEFAULT_VAULT_PASSPHRASE);
  const [showPassword, setShowPassword] = useState(false);
  const [keyMode, setKeyMode] = useState<KeyMode>(secretStore.keyMode);
  const [unifiedKey, setUnifiedKey] = useState(secretStore.unifiedOpenAiKey);
  const [videoKey, setVideoKey] = useState(secretStore.moduleOpenAiKeys.videoTranscriber);
  const [audiobookKey, setAudiobookKey] = useState(secretStore.moduleOpenAiKeys.audiobookTranscriber);
  const [extractorKey, setExtractorKey] = useState(secretStore.moduleOpenAiKeys.audioExtractor);
  const [cookiesPath, setCookiesPath] = useState(secretStore.customTokens.firefoxProfile || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

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
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (e) {
      alert('Failed to encrypt and store secrets: ' + e);
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
            <label className="text-xs font-semibold flex items-center gap-2">
              <Key className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
              <span>Unified OpenAI API Key:</span>
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
                <span>Video Transcription OpenAI Key:</span>
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
                <span>Audiobook Transcriber OpenAI Key:</span>
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
        <div className="pt-1 space-y-1.5">
          <label className="text-xs font-semibold">Optional Browser Profile / Cookies Path (for yt-dlp):</label>
          <input
            type="text"
            value={cookiesPath}
            onChange={(e) => setCookiesPath(e.target.value)}
            placeholder="e.g. C:\Users\name\AppData\Roaming\zen\Profiles\..."
            className={`w-full px-3 py-2 text-xs font-mono rounded border focus:outline-none ${
              isDarkMode
                ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                : 'bg-white border-neutral-300 text-neutral-900 focus:border-[#ffd600]'
            }`}
          />
          <p className={`text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
            Allows yt-dlp to access age-restricted or login-required media by reading browser session cookies.
          </p>
        </div>

        {/* Save to Vault Action */}
        <div className="pt-2 flex items-center justify-between">
          <button
            onClick={handleSaveVault}
            id="btn-save-encrypted-vault"
            className={`flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-xs transition-colors shadow-xs ${
              isDarkMode
                ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>Encrypt & Save Secrets to Vault</span>
          </button>

          {savedSuccess && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Vault updated & encrypted successfully!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
