import React from 'react';
import { ModuleId, SecretStore, CostTrackerState } from '../types';
import {
  Video,
  Scissors,
  BookOpen,
  DollarSign,
  Key,
  Headphones,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
  isCollapsed,
  onToggleCollapse,
}) => {
  const navItems: { id: ModuleId; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'video-transcriber',
      label: 'Video Transcriber',
      icon: <Video className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'media-clipper',
      label: 'Audio/Video Clipper',
      icon: <Scissors className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'audiobook-transcriber',
      label: 'Audiobook Transcriber',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'audible-fetcher',
      label: 'Audible Fetcher',
      icon: <Headphones className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'video-downloader',
      label: 'Video Downloader',
      icon: <Download className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'secrets-settings',
      label: 'Encrypted Secrets',
      icon: <Key className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'cost-analytics',
      label: 'Costs & Budget',
      icon: <DollarSign className="w-4 h-4 shrink-0" />,
    },
  ];

  const totalCost = costTracker.records.reduce((acc, r) => acc + r.costUSD, 0);
  const budgetPct = Math.min(100, (totalCost / (costTracker.budgetLimitUSD || 10)) * 100);

  return (
    <aside
      id="streamlit-sidebar"
      className={`flex-shrink-0 flex flex-col border-r transition-all duration-200 z-20 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      } ${
        isDarkMode
          ? 'bg-[#141414] border-[#262626] text-[#e5e5e5]'
          : 'bg-[#fafafa] border-[#e5e5e5] text-[#1a1a1a]'
      }`}
    >
      {/* Sidebar Collapse Toggle Header */}
      <div className={`p-2.5 border-b border-inherit flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-3'}`}>
        {!isCollapsed && (
          <span className={`text-[11px] font-medium uppercase tracking-wider ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
            Navigation
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`p-1.5 rounded border transition-colors ${
            isDarkMode
              ? 'bg-[#1f1f1f] border-[#303030] text-[#aaaaaa] hover:text-white hover:bg-[#282828]'
              : 'bg-[#f0f0f0] border-[#d8d8d8] text-[#555555] hover:text-[#111111] hover:bg-[#e4e4e7]'
          }`}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {!isCollapsed && (
          <p className={`px-2 text-[11px] font-medium uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
            Functional Modules
          </p>
        )}

        {navItems.slice(0, 5).map((item) => {
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectModule(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center rounded text-xs font-medium transition-all ${
                isCollapsed ? 'justify-center p-2.5 my-1' : 'justify-between px-3 py-2'
              } ${
                isActive
                  ? isDarkMode
                    ? 'bg-[#222222] text-[#f3e79a] border border-[#383838]'
                    : 'bg-white text-[#111111] border border-[#d8d8d8] font-semibold shadow-xs'
                  : isDarkMode
                  ? 'text-[#999999] hover:text-white hover:bg-[#1a1a1a] border border-transparent'
                  : 'text-[#555555] hover:text-[#111111] hover:bg-[#f0f0f0] border border-transparent'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                <span className={isActive ? (isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]') : 'text-[#888888]'}>
                  {item.icon}
                </span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>
            </button>
          );
        })}

        <div className={`pt-2 ${isCollapsed ? 'border-t border-inherit my-2 pt-2' : ''}`}>
          {!isCollapsed && (
            <p className={`px-2 text-[11px] font-medium uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
              Settings & Operations
            </p>
          )}

          {navItems.slice(5).map((item) => {
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onSelectModule(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded text-xs font-medium transition-all ${
                  isCollapsed ? 'justify-center p-2.5 my-1' : 'justify-between px-3 py-2'
                } ${
                  isActive
                    ? isDarkMode
                      ? 'bg-[#222222] text-[#f3e79a] border border-[#383838]'
                      : 'bg-white text-[#111111] border border-[#d8d8d8] font-semibold shadow-xs'
                    : isDarkMode
                    ? 'text-[#999999] hover:text-white hover:bg-[#1a1a1a] border border-transparent'
                    : 'text-[#555555] hover:text-[#111111] hover:bg-[#f0f0f0] border border-transparent'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                  <span className={isActive ? (isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]') : 'text-[#888888]'}>
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Budget Meter */}
      <div className={`border-t border-inherit ${isCollapsed ? 'p-2 flex flex-col items-center' : 'p-3 space-y-2'}`}>
        {isCollapsed ? (
          <div
            title={`Session Expense: $${totalCost.toFixed(4)} / $${costTracker.budgetLimitUSD.toFixed(2)} (${budgetPct.toFixed(0)}%)`}
            className="w-full flex flex-col items-center gap-1 py-1"
          >
            <TrendingUp className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
            <span className="text-[10px] font-mono text-center">{budgetPct.toFixed(0)}%</span>
            <div className={`w-8 h-1 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#2b2b2b]' : 'bg-[#e0e0e0]'}`}>
              <div
                className={`h-full ${isDarkMode ? 'bg-[#f3e79a]' : 'bg-[#ffd600]'}`}
                style={{ width: `${Math.max(5, budgetPct)}%` }}
              />
            </div>
          </div>
        ) : (
          <div
            className={`p-2.5 rounded border text-xs ${
              isDarkMode ? 'bg-[#1a1a1a] border-[#262626]' : 'bg-white border-[#e0e0e0]'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-[11px] ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Session Expense</span>
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
        )}
      </div>
    </aside>
  );
};
