import React from 'react';
import { Trash2, HardDrive } from 'lucide-react';

interface ZeroRetentionBannerProps {
  memoryUsageBytes: number;
  onPurge: () => void;
  isDarkMode: boolean;
}

export const ZeroRetentionBanner: React.FC<ZeroRetentionBannerProps> = ({
  memoryUsageBytes,
  onPurge,
  isDarkMode,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      id="buffer-status-bar"
      className={`mx-6 mt-3 px-4 py-2 rounded border flex flex-row items-center justify-between gap-3 text-xs transition-colors select-none ${
        isDarkMode
          ? 'bg-[#181818] border-[#2c2c2c] text-[#aaaaaa]'
          : 'bg-white border-[#e0e0e0] text-[#555555]'
      }`}
    >
      <div className="flex items-center gap-2">
        <HardDrive className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
        <span className="font-mono text-xs">
          Buffer in use: <strong className={isDarkMode ? 'text-white' : 'text-neutral-900'}>{formatBytes(memoryUsageBytes)}</strong>
        </span>
      </div>

      {memoryUsageBytes > 0 && (
        <button
          onClick={onPurge}
          id="btn-banner-purge"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
            isDarkMode
              ? 'bg-[#262626] hover:bg-[#333333] text-neutral-300'
              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
          }`}
        >
          <Trash2 className="w-3 h-3 text-rose-400" />
          <span>Clear Buffer</span>
        </button>
      )}
    </div>
  );
};
