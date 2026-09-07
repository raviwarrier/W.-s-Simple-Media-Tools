import React from 'react';
import { ModuleId, SecretStore, CostTrackerState } from '../types';
import { AppLogo } from './AppLogo';
import {
  Video,
  Scissors,
  BookOpen,
  DollarSign,
  Activity,
  Key,
  Trash2,
} from 'lucide-react';

interface SidebarProps {
  currentModule: ModuleId;
  onSelectModule: (id: ModuleId) => void;
  secretStore: SecretStore;
  costTracker: CostTrackerState;
  activeTasksCount: number;
  onOpenTaskDrawer: () => void;
  onPurgeMemory: () => void;
  isDarkMode: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  secretStore,
  costTracker,
  activeTasksCount,
  onOpenTaskDrawer,
  onPurgeMemory,
  isDarkMode,
}) => {
  const navItems: { id: ModuleId; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'video-transcriber',
      label: 'Video Transcription',
      icon: <Video className="w-4 h-4" />,
    },
    {
      id: 'media-clipper',
      label: 'Audio/Video Clipper',
      icon: <Scissors className="w-4 h-4" />,
    },
    {
      id: 'audiobook-transcriber',
      label: 'Audiobook Transcriber',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'secrets-settings',
      label: 'Encrypted Secrets',
      icon: <Key className="w-4 h-4" />,
    },
    {
      id: 'cost-analytics',
      label: 'Costs & Budget',
      icon: <DollarSign className="w-4 h-4" />,
    },
  ];

  const totalCost = costTracker.records.reduce((acc, r) => acc + r.costUSD, 0);
  const budgetPct = Math.min(100, (totalCost / (costTracker.budgetLimitUSD || 10)) * 100);

  return (
    <aside
      id="streamlit-sidebar"
      className={`w-64 flex-shrink-0 flex flex-col border-r transition-colors duration-150 z-20 select-none ${
        isDarkMode
          ? 'bg-[#141414] border-[#262626] text-[#e5e5e5]'
          : 'bg-[#fafafa] border-[#e5e5e5] text-[#1a1a1a]'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-inherit">
        <div className="flex items-center gap-2.5">
          <AppLogo isDarkMode={isDarkMode} className="w-7 h-7" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-semibold tracking-tight truncate">W.&apos;s Simple Media Tools</h1>
              <span
                id="badge-app-version"
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold shrink-0 ${
                  isDarkMode
                    ? 'bg-[#1e1e1e] border-[#333333] text-[#f3e79a]'
                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-800'
                }`}
              >
                v1.0
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <p className={`px-2 text-xs font-medium uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
          Functional Modules
        </p>

        {navItems.slice(0, 3).map((item) => {
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectModule(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all ${
                isActive
                  ? isDarkMode
                    ? 'bg-[#222222] text-[#f3e79a] border border-[#383838]'
                    : 'bg-white text-[#111111] border border-[#d8d8d8] font-semibold shadow-xs'
                  : isDarkMode
                  ? 'text-[#999999] hover:text-white hover:bg-[#1a1a1a] border border-transparent'
                  : 'text-[#555555] hover:text-[#111111] hover:bg-[#f0f0f0] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? (isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]') : 'text-[#888888]'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}

        <div className="pt-3">
          <p className={`px-2 text-xs font-medium uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
            Settings & Operations
          </p>

          {navItems.slice(3).map((item) => {
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onSelectModule(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all ${
                  isActive
                    ? isDarkMode
                      ? 'bg-[#222222] text-[#f3e79a] border border-[#383838]'
                      : 'bg-white text-[#111111] border border-[#d8d8d8] font-semibold shadow-xs'
                    : isDarkMode
                    ? 'text-[#999999] hover:text-white hover:bg-[#1a1a1a] border border-transparent'
                    : 'text-[#555555] hover:text-[#111111] hover:bg-[#f0f0f0] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? (isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]') : 'text-[#888888]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded border font-mono ${
                      isDarkMode
                        ? 'bg-[#1c1c1c] text-[#cccccc] border-[#333333]'
                        : 'bg-[#f0f0f0] text-[#333333] border-[#d8d8d8]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Status & Budget Widget */}
      <div className="p-3 border-t border-inherit space-y-2">
        {/* Background Tasks Bar */}
        <button
          onClick={onOpenTaskDrawer}
          id="btn-background-tasks-sidebar"
          className={`w-full flex items-center justify-between px-3 py-2 rounded border text-xs font-medium transition-all ${
            activeTasksCount > 0
              ? isDarkMode
                ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                : 'bg-[#ffd600]/20 border-[#ffd600] text-neutral-900 font-semibold'
              : isDarkMode
              ? 'bg-[#1a1a1a] border-[#282828] text-[#cccccc] hover:bg-[#222222]'
              : 'bg-[#ffffff] border-[#e0e0e0] text-[#333333] hover:bg-[#f4f4f4]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity
              className={`w-3.5 h-3.5 ${
                activeTasksCount > 0
                  ? isDarkMode ? 'animate-spin text-[#f3e79a]' : 'animate-spin text-[#ca8a04]'
                  : 'text-[#777777]'
              }`}
            />
            <span>Background Tasks</span>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${
              activeTasksCount > 0
                ? isDarkMode ? 'bg-[#f3e79a] text-neutral-950' : 'bg-[#ffd600] text-neutral-950'
                : isDarkMode ? 'bg-[#262626] text-[#888888]' : 'bg-[#e5e5e5] text-[#555555]'
            }`}
          >
            {activeTasksCount}
          </span>
        </button>

        {/* Live Budget Meter */}
        <div
          className={`p-2.5 rounded border text-xs ${
            isDarkMode ? 'bg-[#1a1a1a] border-[#262626]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="flex justify-between items-center mb-1.5">
            <span className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Session Expense</span>
            <span className={`font-mono text-xs font-medium ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
              ${totalCost.toFixed(4)}
            </span>
          </div>
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#2b2b2b]' : 'bg-[#e0e0e0]'}`}>
            <div
              className={`h-full transition-all duration-300 ${
                isDarkMode ? 'bg-[#f3e79a]' : 'bg-[#ffd600]'
              }`}
              style={{ width: `${Math.max(3, budgetPct)}%` }}
            />
          </div>
          <div className={`flex justify-between items-center mt-1 text-[11px] font-mono ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
            <span>Limit: ${costTracker.budgetLimitUSD.toFixed(2)}</span>
            <span>{budgetPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
